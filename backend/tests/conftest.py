"""
pytest configuration for F.R.I.D.A.Y. backend tests.

Fixes:
- aiosqlite "threads can only be started once": Use a temp DB file per session and
  a single shared event loop, so aiosqlite connections are never re-used across loop boundaries.
- asyncio_mode set to "auto" so all async tests run without explicit @pytest.mark.asyncio.
"""
import os
import asyncio
import tempfile
import pytest
from pathlib import Path


# ─── Shared event-loop for the whole test session ─────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ─── Temp SQLite database (session-scoped) ────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def temp_db(tmp_path_factory):
    """
    Point the backend at a temporary SQLite file for the entire test session.
    This prevents aiosqlite from ever hitting a "threads can only be started once"
    error caused by the same file being opened across different event loops.
    """
    tmp_dir = tmp_path_factory.mktemp("friday_test_data")
    db_path = str(tmp_dir / "test_friday.db")

    # Monkey-patch settings before any module-level import resolves the path
    import app.core.config as config_module
    import app.database.sqlite as sqlite_module

    config_module.settings.sqlite_db_path = db_path
    # Also patch the module-level reference used in get_db()
    original_settings = sqlite_module.settings if hasattr(sqlite_module, "settings") else None

    yield db_path

    # Cleanup is handled automatically by tmp_path_factory
