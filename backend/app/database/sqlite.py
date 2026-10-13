import aiosqlite
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional
from app.core.config import settings

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

@asynccontextmanager
async def get_db():
    async with aiosqlite.connect(settings.sqlite_db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db

async def init_db():
    async with get_db() as db:
        await db.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'local-user',
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            priority TEXT NOT NULL DEFAULT 'medium',
            status TEXT NOT NULL DEFAULT 'pending',
            due_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0
        )
        """)
        
        await db.execute("""
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'local-user',
            task_id TEXT,
            title TEXT NOT NULL,
            message TEXT NOT NULL DEFAULT '',
            scheduled_at TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            status TEXT NOT NULL DEFAULT 'pending',
            snoozed_until TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0
        )
        """)
        
        await db.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'local-user',
            category TEXT NOT NULL DEFAULT 'general',
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0
        )
        """)
        
        await db.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'local-user',
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0
        )
        """)
        
        await db.execute("""
        CREATE TABLE IF NOT EXISTS conversation_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'local-user',
            title TEXT NOT NULL DEFAULT 'New Conversation',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0
        )
        """)
        
        await db.execute("""
        CREATE TABLE IF NOT EXISTS conversation_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            user_id TEXT NOT NULL DEFAULT 'local-user',
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE
        )
        """)
        
        await db.execute("""
        CREATE TABLE IF NOT EXISTS action_logs (
            id TEXT PRIMARY KEY,
            action_type TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'success',
            details TEXT NOT NULL DEFAULT '{}',
            timestamp TEXT NOT NULL
        )
        """)
        
        await db.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """)
        
        await db.commit()

# --- Action Logging ---
async def log_action(action_type: str, description: str, status: str = "success", details: dict = None):
    log_id = str(uuid.uuid4())
    details_str = json.dumps(details or {})
    async with get_db() as db:
        await db.execute(
            "INSERT INTO action_logs (id, action_type, description, status, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (log_id, action_type, description, status, details_str, now_iso())
        )
        await db.commit()

# --- Task Operations ---
async def get_tasks(status: Optional[str] = None) -> list[dict]:
    async with get_db() as db:
        if status:
            cursor = await db.execute("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC", (status,))
        else:
            cursor = await db.execute("SELECT * FROM tasks ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def create_task(title: str, description: str = "", priority: str = "medium", due_at: Optional[str] = None) -> dict:
    task_id = str(uuid.uuid4())
    ts = now_iso()
    async with get_db() as db:
        await db.execute(
            """INSERT INTO tasks (id, title, description, priority, status, due_at, created_at, updated_at) 
               VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)""",
            (task_id, title, description, priority, due_at, ts, ts)
        )
        await db.commit()
    await log_action("create_task", f"Created task: {title}", "success", {"task_id": task_id, "title": title})
    return {"id": task_id, "title": title, "description": description, "priority": priority, "status": "pending", "due_at": due_at, "created_at": ts}

async def update_task(task_id: str, updates: dict) -> Optional[dict]:
    ts = now_iso()
    fields = []
    values = []
    for k, v in updates.items():
        if k in ["title", "description", "priority", "status", "due_at", "completed_at"]:
            fields.append(f"{k} = ?")
            values.append(v)
    if not fields:
        return None
    fields.append("updated_at = ?")
    values.append(ts)
    values.append(task_id)
    
    async with get_db() as db:
        await db.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
        await db.commit()
        cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = await cursor.fetchone()
        if row:
            res = dict(row)
            await log_action("update_task", f"Updated task {task_id}", "success", updates)
            return res
    return None

async def delete_task(task_id: str) -> bool:
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        await db.commit()
        if cursor.rowcount > 0:
            await log_action("delete_task", f"Deleted task {task_id}")
            return True
        return False

# --- Reminder Operations ---
async def get_reminders(status: Optional[str] = None) -> list[dict]:
    async with get_db() as db:
        if status:
            cursor = await db.execute("SELECT * FROM reminders WHERE status = ? ORDER BY scheduled_at ASC", (status,))
        else:
            cursor = await db.execute("SELECT * FROM reminders ORDER BY scheduled_at ASC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def create_reminder(title: str, scheduled_at: str, message: str = "", task_id: Optional[str] = None) -> dict:
    rem_id = str(uuid.uuid4())
    ts = now_iso()
    async with get_db() as db:
        await db.execute(
            """INSERT INTO reminders (id, task_id, title, message, scheduled_at, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)""",
            (rem_id, task_id, title, message, scheduled_at, ts, ts)
        )
        await db.commit()
    await log_action("create_reminder", f"Created reminder: {title} at {scheduled_at}", "success", {"reminder_id": rem_id})
    return {"id": rem_id, "title": title, "message": message, "scheduled_at": scheduled_at, "status": "pending", "created_at": ts}

async def update_reminder_status(rem_id: str, new_status: str, snoozed_until: Optional[str] = None) -> bool:
    ts = now_iso()
    async with get_db() as db:
        await db.execute(
            "UPDATE reminders SET status = ?, snoozed_until = ?, updated_at = ? WHERE id = ?",
            (new_status, snoozed_until, ts, rem_id)
        )
        await db.commit()
    await log_action("update_reminder", f"Reminder {rem_id} marked {new_status}")
    return True

# --- Memory & Notes Operations ---
async def get_memories() -> list[dict]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM memories ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def add_memory(category: str, content: str) -> dict:
    mem_id = str(uuid.uuid4())
    ts = now_iso()
    async with get_db() as db:
        await db.execute(
            "INSERT INTO memories (id, category, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (mem_id, category, content, ts, ts)
        )
        await db.commit()
    return {"id": mem_id, "category": category, "content": content, "created_at": ts}

async def delete_memory(mem_id: str) -> bool:
    async with get_db() as db:
        await db.execute("DELETE FROM memories WHERE id = ?", (mem_id,))
        await db.commit()
        return True

async def get_notes() -> list[dict]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM notes ORDER BY updated_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def create_note(title: str, content: str) -> dict:
    note_id = str(uuid.uuid4())
    ts = now_iso()
    async with get_db() as db:
        await db.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (note_id, title, content, ts, ts)
        )
        await db.commit()
    return {"id": note_id, "title": title, "content": content, "created_at": ts, "updated_at": ts}

async def get_action_logs(limit: int = 50) -> list[dict]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM action_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

# --- User Settings Operations ---
async def get_setting(key: str, default: Any = None) -> Any:
    async with get_db() as db:
        cursor = await db.execute("SELECT value FROM user_settings WHERE key = ?", (key,))
        row = await cursor.fetchone()
        if row:
            try:
                return json.loads(row["value"])
            except Exception:
                return row["value"]
        return default

async def set_setting(key: str, value: Any) -> bool:
    val_str = json.dumps(value) if not isinstance(value, str) else value
    async with get_db() as db:
        await db.execute(
            "INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, val_str)
        )
        await db.commit()
    return True

async def get_all_settings() -> dict:
    async with get_db() as db:
        cursor = await db.execute("SELECT key, value FROM user_settings")
        rows = await cursor.fetchall()
        out = {}
        for r in rows:
            try:
                out[r["key"]] = json.loads(r["value"])
            except Exception:
                out[r["key"]] = r["value"]
        return out

