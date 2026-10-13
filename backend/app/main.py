import os
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.security import verify_local_token
from app.database import sqlite
from app.models import schemas
from app.services.ollama_client import ollama_service
from app.services.ai_provider_manager import ai_provider_manager
from app.services.voice_service import voice_service
from app.services.file_service import file_service
from app.services.scheduler import reminder_scheduler
from app.services.sync_service import sync_service
from app.tools.registry import tool_registry
from app.tools import windows_tools

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await sqlite.init_db()
    await ai_provider_manager.init()
    reminder_scheduler.start()
    print("[F.R.I.D.A.Y. Backend] Initialized SQLite, AI Provider Manager, and background scheduler.")
    yield
    # Shutdown
    reminder_scheduler.stop()
    voice_service.stop()
    print("[F.R.I.D.A.Y. Backend] Shutdown complete.")


app = FastAPI(
    title="F.R.I.D.A.Y. AI Local Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health & Diagnostics ---
@app.get("/api/health")
async def get_health():
    ollama_health = await ollama_service.check_health()
    cloud_health = await sync_service.check_cloud_health()
    sys_metrics = windows_tools.get_system_status()
    
    return {
        "status": "online",
        "backend": "healthy",
        "version": settings.app_version,
        "ollama": ollama_health,
        "cloud": cloud_health,
        "system": sys_metrics,
        "automation_enabled": settings.automation_enabled
    }

@app.get("/api/ollama/status")
async def get_ollama_status():
    return await ollama_service.get_model_status()

@app.get("/api/ollama/models")
async def get_ollama_installed_models():
    """Returns the list of models actually installed in local Ollama."""
    health = await ollama_service.check_health()
    if not health.get("online"):
        return {"online": False, "models": [], "error": "Ollama service is not reachable. Start it with `ollama serve`."}
    installed = health.get("models", [])
    # Update OllamaProvider's supported_models in ai_provider_manager with live list
    if installed:
        from app.services.ai_provider_manager import ai_provider_manager
        ai_provider_manager.providers["ollama"]._live_models = installed
    return {"online": True, "models": installed, "selected": health.get("selected_model")}

# --- Daily Briefing ---
@app.get("/api/briefing")
async def get_briefing():
    return await reminder_scheduler.get_daily_briefing()

# --- Chat & AI Inference ---
@app.post("/api/chat")
async def chat(request: schemas.ChatRequest):
    msgs = [{"role": m.role, "content": m.content} for m in request.messages]
    res = await ai_provider_manager.chat_complete(msgs, model=request.model, temperature=request.temperature or 0.7)
    if not res.get("success"):
        return res
    
    # Auto-log conversation in local SQLite
    if request.messages:
        user_msg = request.messages[-1].content
        p_name = res.get("provider", "ai")
        await sqlite.log_action("chat", f"User: {user_msg[:40]}... [{p_name}]", "success")
        
    return res

@app.post("/api/chat/stream")
async def chat_stream(request: schemas.ChatRequest):
    msgs = [{"role": m.role, "content": m.content} for m in request.messages]
    
    async def event_generator():
        async for chunk in ai_provider_manager.chat_stream(msgs, model=request.model, temperature=request.temperature or 0.7):
            yield chunk

    return StreamingResponse(event_generator(), media_type="text/plain")


# --- Tasks API ---
@app.get("/api/tasks")
async def list_tasks(status: Optional[str] = Query(None)):
    return await sqlite.get_tasks(status=status)

@app.post("/api/tasks")
async def create_task(task: schemas.TaskCreate):
    return await sqlite.create_task(
        title=task.title,
        description=task.description or "",
        priority=task.priority or "medium",
        due_at=task.due_at
    )

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, updates: schemas.TaskUpdate):
    data = updates.model_dump(exclude_unset=True)
    res = await sqlite.update_task(task_id, data)
    if not res:
        raise HTTPException(status_code=404, detail="Task not found")
    return res

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    ok = await sqlite.delete_task(task_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

# --- Reminders API ---
@app.get("/api/reminders")
async def list_reminders(status: Optional[str] = Query(None)):
    return await sqlite.get_reminders(status=status)

@app.post("/api/reminders")
async def create_reminder(rem: schemas.ReminderCreate):
    return await sqlite.create_reminder(
        title=rem.title,
        scheduled_at=rem.scheduled_at,
        message=rem.message or "",
        task_id=rem.task_id
    )

@app.put("/api/reminders/{rem_id}/status")
async def update_reminder_status(rem_id: str, payload: schemas.ReminderStatusUpdate):
    ok = await sqlite.update_reminder_status(rem_id, payload.status, payload.snoozed_until)
    return {"success": ok}

# --- Memories & Notes ---
@app.get("/api/memories")
async def list_memories():
    return await sqlite.get_memories()

@app.post("/api/memories")
async def add_memory(mem: schemas.MemoryCreate):
    return await sqlite.add_memory(mem.category, mem.content)

@app.delete("/api/memories/{mem_id}")
async def delete_memory(mem_id: str):
    await sqlite.delete_memory(mem_id)
    return {"success": True}

@app.get("/api/notes")
async def list_notes():
    return await sqlite.get_notes()

@app.post("/api/notes")
async def create_note(note: schemas.NoteCreate):
    return await sqlite.create_note(note.title, note.content)

# --- File Intelligence ---
@app.post("/api/files/search")
async def search_files(req: schemas.FileSearchRequest):
    return file_service.search_files(req.query, req.extension, req.directory)

@app.get("/api/files/read")
async def read_file(path: str = Query(...)):
    return file_service.read_document_content(path)

@app.get("/api/files/directories")
async def get_approved_directories():
    return file_service.list_approved_directories()

# --- Tools & Automation ---
@app.get("/api/tools")
async def list_tools():
    return tool_registry.list_tools()

@app.post("/api/tools/execute")
async def execute_tool(req: schemas.ToolCallRequest):
    return await tool_registry.execute(req.tool_name, req.parameters, req.confirmed)

@app.post("/api/automation/toggle")
async def toggle_automation(enabled: bool = Query(...)):
    settings.automation_enabled = enabled
    await sqlite.log_action("automation_toggle", f"Global automation set to {enabled}")
    return {"automation_enabled": settings.automation_enabled}

# --- Voice Engine ---
@app.post("/api/voice/speak")
async def speak(req: schemas.SpeakRequest):
    voice_service.speak(req.text, req.rate or 180, req.volume or 1.0)
    return {"success": True, "speaking": True}

@app.post("/api/voice/synthesize")
async def synthesize_voice(req: schemas.SynthesizeRequest):
    audio_bytes, media_type = await voice_service.synthesize_audio(
        text=req.text,
        voice=req.voice or "en-US-AvaNeural",
        rate=req.rate or "-4%",
        pitch=req.pitch or "-2Hz",
        volume=req.volume or "+0%"
    )
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="Voice synthesis produced no audio")
    return Response(content=audio_bytes, media_type=media_type)

@app.post("/api/voice/stop")
async def stop_voice():
    voice_service.stop()
    return {"success": True, "speaking": False}

@app.get("/api/voice/voices")
async def get_voices():
    return voice_service.list_candidate_voices()

# --- AI Provider Management ---
@app.get("/api/providers/config")
async def get_providers_config():
    return ai_provider_manager.get_public_config()

@app.post("/api/providers/config")
async def update_providers_config(payload: dict):
    if "active_provider" in payload:
        ai_provider_manager.active_provider = payload["active_provider"]
    if "fallback_order" in payload and isinstance(payload["fallback_order"], list):
        ai_provider_manager.fallback_order = payload["fallback_order"]
    if "provider_models" in payload and isinstance(payload["provider_models"], dict):
        ai_provider_manager.provider_models.update(payload["provider_models"])
    if "provider_keys" in payload and isinstance(payload["provider_keys"], dict):
        for p, k in payload["provider_keys"].items():
            clean_k = str(k).strip() if k is not None else ""
            if clean_k and "..." not in clean_k and not set(clean_k).issubset({"*", "\u2022", "."}):
                ai_provider_manager.provider_keys[p] = clean_k
            elif clean_k == "":
                ai_provider_manager.provider_keys[p] = ""
    if "max_history_turns" in payload:
        ai_provider_manager.max_history_turns = int(payload["max_history_turns"])
    if "timeout_seconds" in payload:
        ai_provider_manager.timeout_seconds = float(payload["timeout_seconds"])
    await ai_provider_manager.save_config()
    return {"success": True, "config": ai_provider_manager.get_public_config()}

@app.post("/api/providers/validate")
async def validate_provider_key(payload: dict):
    try:
        provider = payload.get("provider", "groq")
        key = payload.get("api_key") or ai_provider_manager.provider_keys.get(provider, "")
        model = payload.get("model")
        if not key and provider != "ollama":
            return {"valid": False, "error": f"No API key saved for {provider}. Enter and save a key first."}
        result = await ai_provider_manager.validate_provider_key(provider, key, model=model)
        # Ensure error is always a string, never null/undefined
        if not result.get("valid") and not result.get("error"):
            result["error"] = f"Provider '{provider}' returned an unexpected response. Check logs."
        return result
    except Exception as e:
        return {"valid": False, "error": f"Validation failed: {str(e)}"}

# --- Windows Startup & Greeting Configuration ---
@app.get("/api/startup/config")
async def get_startup_config():
    cfg = await sqlite.get_setting("startup_greeting_config", default={
        "start_with_windows": False,
        "launch_minimized": False,
        "greet_after_startup": True,
        "greeting_delay_ms": 2000,
        "greeting_volume": 1.0,
        "do_not_greet_when_muted": True,
        "quiet_hours_enabled": True,
        "quiet_hours_start": 22,
        "quiet_hours_end": 7,
        "auto_start_listening": False
    })
    return cfg

@app.post("/api/startup/config")
async def update_startup_config(payload: dict):
    current = await sqlite.get_setting("startup_greeting_config", default={
        "start_with_windows": False,
        "launch_minimized": False,
        "greet_after_startup": True,
        "greeting_delay_ms": 2000,
        "greeting_volume": 1.0,
        "do_not_greet_when_muted": True,
        "quiet_hours_enabled": True,
        "quiet_hours_start": 22,
        "quiet_hours_end": 7,
        "auto_start_listening": False
    })
    current.update(payload)
    await sqlite.set_setting("startup_greeting_config", current)
    return {"success": True, "config": current}

@app.get("/api/startup/greeting")
async def get_startup_greeting():
    from datetime import datetime
    hour = datetime.now().hour
    if 5 <= hour < 12:
        greeting = "Good morning. F.R.I.D.A.Y. is online and ready."
    elif 12 <= hour < 17:
        greeting = "Good afternoon. F.R.I.D.A.Y. is online and ready."
    elif 17 <= hour < 22:
        greeting = "Good evening. F.R.I.D.A.Y. is online and ready."
    else:
        greeting = "F.R.I.D.A.Y. systems initialized. Standing by."
    return {"greeting": greeting, "hour": hour}

# --- Persistent Settings ---
@app.get("/api/settings")
async def get_settings():
    return await sqlite.get_all_settings()

@app.post("/api/settings")
async def update_settings(payload: dict):
    for k, v in payload.items():
        await sqlite.set_setting(k, v)
    return {"success": True, "settings": await sqlite.get_all_settings()}


# --- Cloud Sync & Audit Logs ---
@app.post("/api/sync")
async def sync_cloud(auth_token: Optional[str] = Query(None)):
    return await sync_service.sync_all(auth_token=auth_token)

@app.get("/api/logs")
async def get_logs(limit: int = Query(50)):
    return await sqlite.get_action_logs(limit=limit)

