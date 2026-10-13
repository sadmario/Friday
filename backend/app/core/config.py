import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    app_name: str = "F.R.I.D.A.Y. AI"
    app_version: str = "1.0.0"
    backend_host: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    backend_port: int = int(os.getenv("BACKEND_PORT", "8765"))
    auth_secret: str = os.getenv("BACKEND_AUTH_SECRET", "friday-local-secure-token-2026")
    
    # Ollama
    ollama_base_url: str = os.getenv("VITE_OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen3:4b")
    ollama_timeout_seconds: float = 60.0
    
    # Supabase
    supabase_url: str = os.getenv("VITE_SUPABASE_URL", "https://gnyqvduouavuexkknrmh.supabase.co")
    supabase_anon_key: str = os.getenv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdueXF2ZHVvdWF2dWV4a2tucm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4OTY5NDgsImV4cCI6MjEwNzQ3Mjk0OH0.N2yXfVESc5DoUKsWpM0ZTSmVNqrCjIE2IYkxgDwyK3U")
    
    # Local Storage
    sqlite_db_path: str = str(DATA_DIR / "friday_local.db")
    
    # File Allowlist (default to workspace and standard user docs)
    allowed_directories: list[str] = [
        str(WORKSPACE_DIR),
        str(Path.home() / "Documents"),
        str(Path.home() / "Downloads"),
        str(Path.home() / "Desktop")
    ]
    
    # Automation Global Switch
    automation_enabled: bool = True

settings = Settings()
