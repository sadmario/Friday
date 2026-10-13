"""
F.R.I.D.A.Y. Backend Test Suite
Tests run with asyncio_mode=auto (see pytest.ini) and a session-scoped event loop
plus a temp SQLite DB (see conftest.py) to avoid aiosqlite threading issues.
"""
import pytest
from app.database import sqlite
from app.core.security import is_path_allowed, validate_executable_allowed
from app.tools.registry import tool_registry
from app.services.scheduler import reminder_scheduler
from app.core.config import WORKSPACE_DIR


# ──────────────────────────────────────────────────────────────────────────────
# Database tests
# ──────────────────────────────────────────────────────────────────────────────

async def test_database_initialization():
    """DB init must succeed and return an empty-or-list task result."""
    await sqlite.init_db()
    tasks = await sqlite.get_tasks()
    assert isinstance(tasks, list)


async def test_task_crud():
    """Full create → update → read → delete lifecycle for a task."""
    await sqlite.init_db()
    task = await sqlite.create_task("Test Task", "Test Description", "high")
    assert task["title"] == "Test Task"
    task_id = task["id"]

    updated = await sqlite.update_task(task_id, {"status": "completed"})
    assert updated is not None
    assert updated["status"] == "completed"

    tasks = await sqlite.get_tasks()
    matching = [t for t in tasks if t["id"] == task_id]
    assert len(matching) == 1

    deleted = await sqlite.delete_task(task_id)
    assert deleted is True


async def test_reminder_crud():
    """Full create → update lifecycle for a reminder."""
    await sqlite.init_db()
    rem = await sqlite.create_reminder("Test Reminder", "2026-10-15T10:00:00Z", "Reminder details")
    assert rem["title"] == "Test Reminder"
    rem_id = rem["id"]

    updated = await sqlite.update_reminder_status(rem_id, "triggered")
    assert updated is True


# ──────────────────────────────────────────────────────────────────────────────
# Security tests  (sync — no event loop needed)
# ──────────────────────────────────────────────────────────────────────────────

def test_security_path_boundaries():
    """Allowed workspace path should pass; sensitive/system paths must be blocked."""
    assert is_path_allowed(str(WORKSPACE_DIR)) is True
    assert is_path_allowed("C:\\Windows\\System32\\cmd.exe") is False
    assert is_path_allowed("C:\\Users\\aravi\\.ssh\\id_rsa") is False


def test_executable_validation():
    """Only safelisted executables should be permitted."""
    assert validate_executable_allowed("notepad") is True
    assert validate_executable_allowed("calc") is True
    assert validate_executable_allowed("malicious_hacker_script.bat") is False


# ──────────────────────────────────────────────────────────────────────────────
# Tool registry tests
# ──────────────────────────────────────────────────────────────────────────────

async def test_tool_registry():
    """Tool registry must list required tools and execute get_system_time correctly."""
    # Ensure DB is ready for log_action calls inside tool execute()
    await sqlite.init_db()

    tools = tool_registry.list_tools()
    tool_names = [t["name"] for t in tools]
    assert "get_system_status" in tool_names
    assert "get_system_time" in tool_names

    res = await tool_registry.execute("get_system_time", {})
    assert res["success"] is True
    assert "time" in res["result"]


# ──────────────────────────────────────────────────────────────────────────────
# Scheduler / briefing tests
# ──────────────────────────────────────────────────────────────────────────────

async def test_daily_briefing():
    """Daily briefing must return the expected top-level keys."""
    await sqlite.init_db()
    briefing = await reminder_scheduler.get_daily_briefing()
    assert "greeting" in briefing
    assert "pending_tasks_count" in briefing
    assert "system_status" in briefing


# ──────────────────────────────────────────────────────────────────────────────
# Voice Service & Settings tests
# ──────────────────────────────────────────────────────────────────────────────

def test_clean_text_for_speech():
    """Text sanitizer must remove code fences, tool JSON, markdown markup, and URLs."""
    from app.services.voice_service import clean_text_for_speech
    
    raw = 'Sure! Here is the python code:\n```python\nprint("Hello")\n```\n{"tool": "open_app", "parameters": {"app": "notepad"}}\nCheck [Docs](https://example.com) for **details**.'
    cleaned = clean_text_for_speech(raw)
    
    assert "```" not in cleaned
    assert '{"tool":' not in cleaned
    assert "https://example.com" not in cleaned
    assert "**" not in cleaned
    assert "Docs" in cleaned
    assert "code snippet you requested" in cleaned


def test_candidate_voices_listing():
    """Voice service must list candidate voices with AvaNeural as the recommended voice."""
    from app.services.voice_service import voice_service
    
    voices = voice_service.list_candidate_voices()
    assert len(voices) >= 5
    ids = [v["id"] for v in voices]
    assert "en-US-AvaNeural" in ids
    assert "local-sapi5" in ids
    
    ava = next(v for v in voices if v["id"] == "en-US-AvaNeural")
    assert ava["recommended"] is True
    assert ava["gender"] == "Female"


async def test_user_settings_storage():
    """Persistent settings must store and retrieve dictionary structures in SQLite."""
    await sqlite.init_db()
    
    config = {
        "voice": "en-US-AvaNeural",
        "always_speak_replies": True,
        "continuous_listening": True,
        "wake_phrase": "friday"
    }
    saved = await sqlite.set_setting("voice_preferences", config)
    assert saved is True
    
    loaded = await sqlite.get_setting("voice_preferences")
    assert loaded["voice"] == "en-US-AvaNeural"
    assert loaded["always_speak_replies"] is True
    assert loaded["wake_phrase"] == "friday"


async def test_voice_synthesis_audio_stream():
    """Synthesizing text must yield a non-empty audio byte stream (MP3 or WAV)."""
    from app.services.voice_service import voice_service

    audio_bytes, media_type = await voice_service.synthesize_audio(
        "Systems online. F.R.I.D.A.Y. ready for task execution.",
        voice="en-US-AvaNeural",
        rate="-4%",
        pitch="-2Hz"
    )
    assert len(audio_bytes) > 1000
    assert media_type in ["audio/mpeg", "audio/wav"]


def test_voice_stop_immediate():
    """Stopping voice service must immediately set speaking state to false."""
    from app.services.voice_service import voice_service

    voice_service.stop()
    assert voice_service.is_speaking() is False


async def test_api_voice_endpoints():
    """FastAPI voice endpoints must respond properly."""
    from app.main import app
    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Test candidate voices list
        res = await client.get("/api/voice/voices")
        assert res.status_code == 200
        voices = res.json()
        assert any(v["id"] == "en-US-AvaNeural" for v in voices)

        # Test voice stop
        res_stop = await client.post("/api/voice/stop")
        assert res_stop.status_code == 200
        assert res_stop.json()["speaking"] is False

        # Test settings store & retrieve
        res_set = await client.post("/api/settings", json={"test_key": {"always_speak": True}})
        assert res_set.status_code == 200

        res_get = await client.get("/api/settings")
        assert res_get.status_code == 200
        data = res_get.json()
        assert "test_key" in data
        assert data["test_key"]["always_speak"] is True


# ──────────────────────────────────────────────────────────────────────────────
# AI Provider Manager & Startup Greeting tests
# ──────────────────────────────────────────────────────────────────────────────

def test_ai_provider_key_masking():
    """Verify that sensitive API keys are masked securely in configs."""
    from app.services.ai_provider_manager import mask_api_key

    assert mask_api_key("") == ""
    assert mask_api_key(None) == ""
    short_masked = mask_api_key("short")
    assert short_masked == ""
    long_masked = mask_api_key("gsk_1234567890abcdefghijklmnop")
    assert long_masked.startswith("gsk_1")
    assert "..." in long_masked
    assert long_masked.endswith("mnop")
    assert "1234567890" not in long_masked


async def test_ai_provider_manager_config():
    """Verify provider manager returns safe masked config and valid provider list."""
    from app.services.ai_provider_manager import ai_provider_manager

    config = ai_provider_manager.get_public_config()
    assert "active_provider" in config
    assert "providers" in config
    names = [p["name"] for p in config["providers"]]
    assert "groq" in names
    assert "openai" in names
    assert "gemini" in names
    assert "ollama" in names
    assert isinstance(config["fallback_order"], list)


async def test_api_providers_endpoints():
    """Verify /api/providers/config and /api/providers/validate endpoints."""
    from app.main import app
    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Get providers config
        res = await client.get("/api/providers/config")
        assert res.status_code == 200
        data = res.json()
        assert "active_provider" in data
        assert "fallback_order" in data

        # Validate with invalid key should return valid=False without throwing unhandled 500
        res_val = await client.post("/api/providers/validate", json={"provider": "groq", "api_key": "invalid_test_key"})
        assert res_val.status_code == 200
        val_data = res_val.json()
        assert val_data["valid"] is False


async def test_api_startup_endpoints():
    """Verify /api/startup/config and /api/startup/greeting endpoints."""
    from app.main import app
    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Get startup config
        res = await client.get("/api/startup/config")
        assert res.status_code == 200
        cfg = res.json()
        assert "greet_after_startup" in cfg
        assert "greeting_delay_ms" in cfg

        # Save startup config
        res_post = await client.post("/api/startup/config", json={
            "greet_after_startup": True,
            "greeting_delay_ms": 2500,
            "start_with_windows": True
        })
        assert res_post.status_code == 200
        assert res_post.json()["success"] is True

        # Check greeting endpoint
        res_greet = await client.get("/api/startup/greeting")
        assert res_greet.status_code == 200
        greet_data = res_greet.json()
        assert "greeting" in greet_data
        assert "F.R.I.D.A.Y." in greet_data["greeting"]



