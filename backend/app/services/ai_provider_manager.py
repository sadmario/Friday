import asyncio
import json
import re
import time
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Optional, Any
import httpx
from app.core.config import settings
from app.database import sqlite
from app.services.ollama_client import ollama_service, FRIDAY_SYSTEM_PROMPT

def mask_api_key(key: str) -> str:
    """Safely masks an API key for logs and UI display."""
    if not key or len(key) < 8:
        return ""
    return f"{key[:5]}...{key[-4:]}"

class BaseAIProvider(ABC):
    def __init__(self, name: str, display_name: str):
        self.name = name
        self.display_name = display_name

    @abstractmethod
    async def chat_complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        pass

    @abstractmethod
    async def validate_key(self, api_key: str, model: Optional[str] = None) -> Dict[str, Any]:
        pass

    @abstractmethod
    def list_supported_models(self) -> List[str]:
        pass


class GroqProvider(BaseAIProvider):
    def __init__(self):
        super().__init__("groq", "Groq Cloud (Ultra-Fast LPU)")
        self.base_url = "https://api.groq.com/openai/v1"
        self.default_model = "qwen/qwen3.8-27b"

    def list_supported_models(self) -> List[str]:
        return [
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant"
        ]

    async def chat_complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        if not api_key:
            return {"success": False, "error": "Groq API key not configured.", "provider": self.name}

        target_model = model or self.default_model
        formatted_messages = [{"role": "system", "content": FRIDAY_SYSTEM_PROMPT}]
        formatted_messages.extend(messages)

        t0 = time.time()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": target_model,
                        "messages": formatted_messages,
                        "temperature": temperature,
                        "stream": False
                    }
                )
                latency_ms = int((time.time() - t0) * 1000)

                if res.status_code == 200:
                    data = res.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return {
                        "success": True,
                        "content": content,
                        "model": target_model,
                        "provider": self.name,
                        "latency_ms": latency_ms
                    }
                elif res.status_code == 404:
                    return {
                        "success": False,
                        "error": f"Groq model '{target_model}' not found. Select an available Groq model.",
                        "provider": self.name,
                        "status_code": 404
                    }
                elif res.status_code == 429:
                    return {
                        "success": False,
                        "error": "Groq rate limit reached.",
                        "provider": self.name,
                        "status_code": 429
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Groq HTTP {res.status_code}: {res.text[:150]}",
                        "provider": self.name,
                        "status_code": res.status_code
                    }
        except httpx.TimeoutException:
            return {"success": False, "error": f"Groq request timed out after {int(timeout)}s.", "provider": self.name}
        except Exception as e:
            return {"success": False, "error": f"Groq error: {str(e)}", "provider": self.name}

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        if not api_key:
            yield "[Error: Groq API key is not configured]"
            return

        target_model = model or self.default_model
        formatted_messages = [{"role": "system", "content": FRIDAY_SYSTEM_PROMPT}]
        formatted_messages.extend(messages)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": target_model,
                        "messages": formatted_messages,
                        "temperature": temperature,
                        "stream": True
                    }
                ) as response:
                    if response.status_code != 200:
                        yield f"[Groq Error: HTTP {response.status_code}]"
                        return

                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            continue
        except Exception as e:
            yield f"[Groq Stream Error: {str(e)}]"

    async def validate_key(self, api_key: str, model: Optional[str] = None) -> Dict[str, Any]:
        target_model = model or self.default_model
        t0 = time.time()
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": target_model,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 5
                    }
                )
                latency_ms = int((time.time() - t0) * 1000)
                if res.status_code == 200:
                    return {"valid": True, "latency_ms": latency_ms, "message": f"Connected to Groq ({target_model})"}
                elif res.status_code == 401:
                    return {"valid": False, "error": "Invalid Groq API key."}
                elif res.status_code == 404:
                    return {"valid": False, "error": f"Model '{target_model}' not found on Groq."}
                elif res.status_code == 429:
                    return {"valid": False, "error": "Groq quota / rate limit reached."}
                return {"valid": False, "error": f"Groq returned HTTP {res.status_code}: {res.text[:120]}"}
        except Exception as e:
            err_msg = str(e).strip() or type(e).__name__ or "Network/Connection error"
            return {"valid": False, "error": f"Connection failed: {err_msg}"}


class OpenAIProvider(BaseAIProvider):
    def __init__(self):
        super().__init__("openai", "OpenAI (GPT-4o)")
        self.base_url = "https://api.openai.com/v1"
        self.default_model = "gpt-4o-mini"

    def list_supported_models(self) -> List[str]:
        return [
            "gpt-4o-mini",
            "gpt-4o",
            "gpt-3.5-turbo",
            "o3-mini"
        ]

    async def chat_complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        if not api_key:
            return {"success": False, "error": "OpenAI API key not configured.", "provider": self.name}

        target_model = model or self.default_model
        formatted_messages = [{"role": "system", "content": FRIDAY_SYSTEM_PROMPT}]
        formatted_messages.extend(messages)

        t0 = time.time()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": target_model,
                        "messages": formatted_messages,
                        "temperature": temperature,
                        "stream": False
                    }
                )
                latency_ms = int((time.time() - t0) * 1000)

                if res.status_code == 200:
                    data = res.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return {
                        "success": True,
                        "content": content,
                        "model": target_model,
                        "provider": self.name,
                        "latency_ms": latency_ms
                    }
                elif res.status_code == 429:
                    err_json = res.json().get("error", {})
                    msg = err_json.get("message", "OpenAI rate limit or insufficient credits.")
                    return {"success": False, "error": msg, "provider": self.name, "status_code": 429}
                elif res.status_code == 401:
                    return {"success": False, "error": "Invalid OpenAI API key.", "provider": self.name, "status_code": 401}
                else:
                    return {"success": False, "error": f"OpenAI HTTP {res.status_code}: {res.text[:150]}", "provider": self.name, "status_code": res.status_code}
        except httpx.TimeoutException:
            return {"success": False, "error": f"OpenAI request timed out after {int(timeout)}s.", "provider": self.name}
        except Exception as e:
            return {"success": False, "error": f"OpenAI error: {str(e)}", "provider": self.name}

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        if not api_key:
            yield "[Error: OpenAI API key is not configured]"
            return

        target_model = model or self.default_model
        formatted_messages = [{"role": "system", "content": FRIDAY_SYSTEM_PROMPT}]
        formatted_messages.extend(messages)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": target_model,
                        "messages": formatted_messages,
                        "temperature": temperature,
                        "stream": True
                    }
                ) as response:
                    if response.status_code != 200:
                        yield f"[OpenAI Error: HTTP {response.status_code}]"
                        return

                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            continue
        except Exception as e:
            yield f"[OpenAI Stream Error: {str(e)}]"

    async def validate_key(self, api_key: str, model: Optional[str] = None) -> Dict[str, Any]:
        target_model = model or self.default_model
        t0 = time.time()
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": target_model,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 5
                    }
                )
                latency_ms = int((time.time() - t0) * 1000)
                if res.status_code == 200:
                    return {"valid": True, "latency_ms": latency_ms, "message": f"Connected to OpenAI ({target_model})"}
                elif res.status_code == 401:
                    return {"valid": False, "error": "Invalid OpenAI API key."}
                elif res.status_code == 429:
                    data = res.json().get("error", {})
                    return {"valid": False, "error": data.get("message", "OpenAI quota balance exhausted / rate limited.")}
                return {"valid": False, "error": f"OpenAI returned HTTP {res.status_code}"}
        except Exception as e:
            err_msg = str(e).strip() or type(e).__name__ or "Network/Connection error"
            return {"valid": False, "error": f"Connection failed: {err_msg}"}


class GeminiProvider(BaseAIProvider):
    def __init__(self):
        super().__init__("gemini", "Google Gemini")
        self.default_model = "gemini-flash-latest"

    def list_supported_models(self) -> List[str]:
        return [
            "gemini-flash-latest",
            "gemini-3.8-flash",
            "gemini-2.5-pro",
            "gemini-pro-latest"
        ]

    def _convert_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        gemini_contents = []
        for m in messages:
            role = "model" if m["role"] == "assistant" else "user"
            gemini_contents.append({"role": role, "parts": [{"text": m["content"]}]})
        return gemini_contents

    async def chat_complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        if not api_key:
            return {"success": False, "error": "Gemini API key not configured.", "provider": self.name}

        target_model = model or self.default_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"

        payload = {
            "systemInstruction": {"parts": [{"text": FRIDAY_SYSTEM_PROMPT}]},
            "contents": self._convert_messages(messages),
            "generationConfig": {"temperature": temperature}
        }

        t0 = time.time()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(url, json=payload)
                latency_ms = int((time.time() - t0) * 1000)

                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text = "".join(p.get("text", "") for p in parts)
                        return {
                            "success": True,
                            "content": text,
                            "model": target_model,
                            "provider": self.name,
                            "latency_ms": latency_ms
                        }
                    return {"success": False, "error": "Gemini returned empty candidate list.", "provider": self.name}
                elif res.status_code == 503:
                    return {"success": False, "error": "Gemini model temporarily overloaded (HTTP 503).", "provider": self.name, "status_code": 503}
                elif res.status_code == 404:
                    return {"success": False, "error": f"Gemini model '{target_model}' not found or deprecated.", "provider": self.name, "status_code": 404}
                else:
                    return {"success": False, "error": f"Gemini HTTP {res.status_code}: {res.text[:150]}", "provider": self.name, "status_code": res.status_code}
        except httpx.TimeoutException:
            return {"success": False, "error": f"Gemini request timed out after {int(timeout)}s.", "provider": self.name}
        except Exception as e:
            return {"success": False, "error": f"Gemini error: {str(e)}", "provider": self.name}

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        if not api_key:
            yield "[Error: Gemini API key is not configured]"
            return

        target_model = model or self.default_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:streamGenerateContent?alt=sse&key={api_key}"

        payload = {
            "systemInstruction": {"parts": [{"text": FRIDAY_SYSTEM_PROMPT}]},
            "contents": self._convert_messages(messages),
            "generationConfig": {"temperature": temperature}
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        yield f"[Gemini Error: HTTP {response.status_code}]"
                        return

                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        try:
                            chunk = json.loads(data_str)
                            candidates = chunk.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    txt = p.get("text", "")
                                    if txt:
                                        yield txt
                        except Exception:
                            continue
        except Exception as e:
            yield f"[Gemini Stream Error: {str(e)}]"

    async def validate_key(self, api_key: str, model: Optional[str] = None) -> Dict[str, Any]:
        target_model = model or self.default_model
        t0 = time.time()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json={"contents": [{"parts": [{"text": "ping"}]}]})
                latency_ms = int((time.time() - t0) * 1000)
                if res.status_code == 200:
                    return {"valid": True, "latency_ms": latency_ms, "message": f"Connected to Gemini ({target_model})"}
                elif res.status_code == 400 and "API_KEY_INVALID" in res.text:
                    return {"valid": False, "error": "Invalid Gemini API key."}
                elif res.status_code == 503:
                    return {"valid": True, "latency_ms": latency_ms, "warning": "API key valid, but model temporarily busy."}
                return {"valid": False, "error": f"Gemini returned HTTP {res.status_code}"}
        except Exception as e:
            err_msg = str(e).strip() or type(e).__name__ or "Network/Connection error"
            return {"valid": False, "error": f"Connection failed: {err_msg}"}


class OllamaProvider(BaseAIProvider):
    def __init__(self):
        super().__init__("ollama", "Local Ollama (Offline)")

    def list_supported_models(self) -> List[str]:
        return ["qwen3:4b", "llama3.2:3b", "mistral:7b", "phi3:mini"]

    async def chat_complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 120.0,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        t0 = time.time()
        res = await ollama_service.chat_complete(messages, model=model, temperature=temperature)
        latency_ms = int((time.time() - t0) * 1000)
        res["latency_ms"] = latency_ms
        res["provider"] = self.name
        return res

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        timeout: float = 120.0,
        api_key: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        async for chunk in ollama_service.chat_stream(messages, model=model):
            yield chunk

    async def validate_key(self, api_key: str = "", model: Optional[str] = None) -> Dict[str, Any]:
        health = await ollama_service.check_health()
        if health.get("online"):
            return {
                "valid": True,
                "latency_ms": 15,
                "message": f"Local Ollama online ({len(health.get('models', []))} models installed)"
            }
        return {"valid": False, "error": "Local Ollama service is unreachable. Run `ollama serve`."}


class AIProviderManager:
    def __init__(self):
        self.providers: Dict[str, BaseAIProvider] = {
            "groq": GroqProvider(),
            "openai": OpenAIProvider(),
            "gemini": GeminiProvider(),
            "ollama": OllamaProvider()
        }
        self.active_provider: str = "auto"
        self.fallback_order: List[str] = ["groq", "openai", "gemini", "ollama"]
        self.provider_keys: Dict[str, str] = {}
        self.provider_models: Dict[str, str] = {
            "groq": "qwen/qwen3.8-27b",
            "openai": "gpt-4o-mini",
            "gemini": "gemini-flash-latest",
            "ollama": "qwen3:4b"
        }
        self.max_history_turns: int = 10
        self.timeout_seconds: float = 30.0

    async def init(self):
        """Loads persistent provider configuration from SQLite."""
        try:
            cfg = await sqlite.get_setting("ai_provider_config", default=None)
            if cfg and isinstance(cfg, dict):
                self.active_provider = cfg.get("active_provider", "auto")
                self.fallback_order = cfg.get("fallback_order", ["groq", "openai", "gemini", "ollama"])
                self.provider_keys = cfg.get("provider_keys", {})
                self.provider_models.update(cfg.get("provider_models", {}))
                self.max_history_turns = cfg.get("max_history_turns", 10)
                self.timeout_seconds = cfg.get("timeout_seconds", 30.0)
            else:
                # Default seed keys if not yet saved in database
                # API keys should be set via the Settings UI or environment variables — never hardcoded
                default_keys = {
                    "groq": "",
                    "openai": "",
                    "gemini": ""
                }
                self.provider_keys = default_keys
                await self.save_config()
        except Exception as e:
            print(f"[AIProviderManager] Initialization notice: {e}")

    async def save_config(self) -> bool:
        cfg = {
            "active_provider": self.active_provider,
            "fallback_order": self.fallback_order,
            "provider_keys": self.provider_keys,
            "provider_models": self.provider_models,
            "max_history_turns": self.max_history_turns,
            "timeout_seconds": self.timeout_seconds
        }
        return await sqlite.set_setting("ai_provider_config", cfg)

    def get_public_config(self) -> Dict[str, Any]:
        """Returns safe configuration with redacted/masked API keys."""
        masked_keys = {}
        for p, k in self.provider_keys.items():
            masked_keys[p] = mask_api_key(k) if k else ""

        providers_meta = []
        for name, p in self.providers.items():
            providers_meta.append({
                "name": name,
                "display_name": p.display_name,
                "has_key": bool(self.provider_keys.get(name)),
                "masked_key": masked_keys.get(name, ""),
                "selected_model": self.provider_models.get(name),
                "supported_models": p.list_supported_models()
            })

        return {
            "active_provider": self.active_provider,
            "fallback_order": self.fallback_order,
            "masked_keys": masked_keys,
            "provider_models": self.provider_models,
            "max_history_turns": self.max_history_turns,
            "timeout_seconds": self.timeout_seconds,
            "providers": providers_meta
        }

    def _bound_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Ensures conversation history remains bounded to prevent inference latency degradation."""
        max_msgs = self.max_history_turns * 2
        if len(messages) <= max_msgs:
            return messages
        return messages[-max_msgs:]

    async def chat_complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        bounded = self._bound_messages(messages)

        # Determine provider list to try
        if self.active_provider != "auto" and self.active_provider in self.providers:
            candidates = [self.active_provider]
        else:
            candidates = [p for p in self.fallback_order if p in self.providers]

        last_error = "No AI providers available."
        fallback_trail = []

        for p_name in candidates:
            provider = self.providers[p_name]
            p_key = self.provider_keys.get(p_name, "")
            p_model = model or self.provider_models.get(p_name)

            # Skip cloud providers if key is absent
            if p_name != "ollama" and not p_key:
                fallback_trail.append(f"{p_name}: no API key")
                continue

            res = await provider.chat_complete(
                bounded,
                model=p_model,
                temperature=temperature,
                timeout=self.timeout_seconds,
                api_key=p_key
            )

            if res.get("success"):
                if fallback_trail:
                    res["fallback_trail"] = fallback_trail
                return res

            err_msg = res.get("error", "Unknown error")
            fallback_trail.append(f"{p_name} failed ({err_msg[:60]})")
            last_error = err_msg

        return {
            "success": False,
            "error": f"All AI providers failed. Trail: {'; '.join(fallback_trail)}. Last error: {last_error}",
            "fallback_trail": fallback_trail
        }

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        bounded = self._bound_messages(messages)

        # For streaming, pick first working provider
        if self.active_provider != "auto" and self.active_provider in self.providers:
            candidates = [self.active_provider]
        else:
            candidates = [p for p in self.fallback_order if p in self.providers]

        selected_provider: Optional[BaseAIProvider] = None
        for p_name in candidates:
            p_key = self.provider_keys.get(p_name, "")
            if p_name == "ollama" or p_key:
                selected_provider = self.providers[p_name]
                break

        if not selected_provider:
            selected_provider = self.providers["ollama"]

        p_name = selected_provider.name
        p_key = self.provider_keys.get(p_name, "")
        p_model = model or self.provider_models.get(p_name)

        async for chunk in selected_provider.chat_stream(
            bounded,
            model=p_model,
            temperature=temperature,
            timeout=self.timeout_seconds,
            api_key=p_key
        ):
            yield chunk

    async def validate_provider_key(self, provider_name: str, api_key: str, model: Optional[str] = None) -> Dict[str, Any]:
        if provider_name not in self.providers:
            return {"valid": False, "error": f"Unknown provider: {provider_name}"}
        return await self.providers[provider_name].validate_key(api_key, model=model)


ai_provider_manager = AIProviderManager()
