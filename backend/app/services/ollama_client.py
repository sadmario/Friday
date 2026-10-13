import json
from typing import AsyncGenerator, Optional
import httpx
from app.core.config import settings

FRIDAY_SYSTEM_PROMPT = """You are F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth), an advanced AI personal desktop assistant for Windows 11.
Personality:
- Professional, calm, intelligent, concise, and friendly.
- Proactive without being intrusive.
- You speak with elegance, clarity, and precision.
- Honest about capabilities, uncertainties, and failures.
- You have access to Windows desktop automation tools, task and reminder management, file intelligence, and system diagnostics.

Available Registered Tools (return tool call JSON if user asks to perform an action):
1. `get_system_status`: Retrieve system CPU, memory, battery, and disk stats.
2. `get_today_briefing`: Get today's date, time, pending tasks, and upcoming reminders.
3. `open_app`: Open an approved application (params: `{"app_name": "notepad" | "calculator" | "explorer" | "code" | "edge" | "chrome"}`).
4. `open_url`: Open a validated web link (params: `{"url": "https://..."}`).
5. `search_files`: Search approved local files (params: `{"query": "filename", "extension": ".pdf"}`).
6. `read_document`: Read and summarize a document (params: `{"file_path": "path"}`).
7. `create_task`: Add a new task (params: `{"title": "...", "description": "...", "priority": "low"|"medium"|"high"|"urgent"}`).
8. `create_reminder`: Add a reminder (params: `{"title": "...", "scheduled_at": "YYYY-MM-DDTHH:MM:SSZ"}`).
9. `send_notification`: Show a Windows desktop notification (params: `{"title": "...", "message": "..."}`).

When a tool call is needed, format it strictly as:
```json
{
  "tool": "tool_name",
  "parameters": { ... }
}
```
Otherwise, respond directly in natural language with your polite and sharp F.R.I.D.A.Y. demeanor.
"""

class OllamaClient:
    def __init__(self, base_url: str = None, timeout: float = 120.0):
        self.base_url = base_url or settings.ollama_base_url
        self.timeout = timeout

    async def check_health(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name") for m in data.get("models", [])]
                    target = settings.ollama_model
                    has_target = any(target in m or m in target for m in models)
                    selected = target if has_target else (models[0] if models else None)
                    return {
                        "online": True,
                        "status": "healthy",
                        "models": models,
                        "selected_model": selected,
                        "model_ready": has_target
                    }
                return {"online": False, "status": f"HTTP {res.status_code}", "models": [], "selected_model": None, "model_ready": False}
        except Exception as e:
            return {"online": False, "status": f"Connection error: {str(e)}", "models": [], "selected_model": None, "model_ready": False}

    async def get_model_status(self) -> dict:
        health = await self.check_health()
        if not health["online"]:
            return {
                "online": False,
                "model": settings.ollama_model,
                "model_available": False,
                "status": "Ollama service is unreachable. Ensure Ollama is running (`ollama serve`).",
                "installed_models": []
            }
        
        models = health.get("models", [])
        target = settings.ollama_model
        model_exists = any(target in m or m in target for m in models)
        
        is_running = False
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/ps")
                if res.status_code == 200:
                    running_models = [m.get("name") for m in res.json().get("models", [])]
                    is_running = any(target in m or m in target for m in running_models)
        except Exception:
            pass

        return {
            "online": True,
            "model": target,
            "model_available": model_exists,
            "loaded_in_memory": is_running,
            "status": "Ready" if model_exists else f"Model '{target}' not installed. Run `ollama pull {target}`.",
            "installed_models": models
        }

    async def chat_complete(self, messages: list[dict], model: Optional[str] = None, temperature: float = 0.7) -> dict:
        target_model = model or settings.ollama_model
        
        # Verify model availability first
        health = await self.check_health()
        if not health.get("online"):
            return {
                "success": False,
                "error": "Ollama is offline. Please start Ollama by running `ollama serve` in a terminal."
            }
        
        models = health.get("models", [])
        if models and not any(target_model in m or m in target_model for m in models):
            return {
                "success": False,
                "error": f"Model '{target_model}' is not installed. Available models: {', '.join(models)}. Run `ollama pull {target_model}`."
            }

        formatted_messages = [{"role": "system", "content": FRIDAY_SYSTEM_PROMPT}]
        for m in messages:
            formatted_messages.append({"role": m["role"], "content": m["content"]})
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "model": target_model,
                    "messages": formatted_messages,
                    "stream": False,
                    "options": {"temperature": temperature}
                }
                res = await client.post(f"{self.base_url}/api/chat", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    msg = data.get("message", {})
                    content = msg.get("content", "")
                    # qwen3 thinking models: if visible content is empty, use thinking text as fallback
                    if not content.strip():
                        content = msg.get("thinking", "")
                    if not content.strip():
                        content = "(No response generated. The model may be overwhelmed. Try again.)"
                    return {"success": True, "content": content, "model": target_model}
                return {"success": False, "error": f"Ollama error: HTTP {res.status_code} — {res.text[:200]}"}
        except httpx.ConnectError:
            return {
                "success": False,
                "error": "Cannot connect to local Ollama. Please ensure Ollama is running (`ollama serve`)."
            }
        except httpx.ReadTimeout:
            return {
                "success": False,
                "error": f"Request to model '{target_model}' timed out after {int(self.timeout)}s. The local hardware may be compiling or generating reasoning. Try again."
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def chat_stream(self, messages: list[dict], model: Optional[str] = None) -> AsyncGenerator[str, None]:
        target_model = model or settings.ollama_model
        formatted_messages = [{"role": "system", "content": FRIDAY_SYSTEM_PROMPT}]
        for m in messages:
            formatted_messages.append({"role": m["role"], "content": m["content"]})
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "model": target_model,
                    "messages": formatted_messages,
                    "stream": True
                }
                async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                    async for chunk in response.aiter_lines():
                        if not chunk.strip():
                            continue
                        try:
                            data = json.loads(chunk)
                            content_piece = data.get("message", {}).get("content", "")
                            if content_piece:
                                yield content_piece
                        except Exception:
                            continue
        except Exception as e:
            yield f"\n[F.R.I.D.A.Y. Error: {str(e)}]"

ollama_service = OllamaClient()
