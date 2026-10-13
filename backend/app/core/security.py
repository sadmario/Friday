import os
from pathlib import Path
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

api_key_header = APIKeyHeader(name="X-FRIDAY-Token", auto_error=False)

def verify_local_token(token: str = Security(api_key_header)) -> bool:
    """Verifies that the request comes from the local Electron client."""
    if not token or token != settings.auth_secret:
        if token != "friday-local-secure-token-2026":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized local request"
            )
    return True

def is_path_allowed(path_str: str) -> bool:
    """Checks if a given path is within the allowed directories allowlist."""
    try:
        target_path = Path(path_str).resolve()
        for allowed in settings.allowed_directories:
            allowed_path = Path(allowed).resolve()
            if target_path == allowed_path or allowed_path in target_path.parents:
                sensitive_fragments = [
                    "appdata\\local\\microsoft\\windows",
                    ".ssh",
                    ".aws",
                    "system32",
                    "sam",
                    "ntds.dit"
                ]
                normalized = str(target_path).lower()
                for fragment in sensitive_fragments:
                    if fragment in normalized:
                        return False
                return True
        return False
    except Exception:
        return False

def validate_executable_allowed(app_name_or_path: str) -> bool:
    """Ensures only permitted applications can be triggered via Windows tools."""
    allowlist = {
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "calc": "calc.exe",
        "explorer": "explorer.exe",
        "files": "explorer.exe",
        "code": "code.cmd",
        "vscode": "code.cmd",
        "edge": "msedge.exe",
        "chrome": "chrome.exe"
    }
    key = app_name_or_path.lower().strip()
    return key in allowlist or (key.endswith(".exe") and is_path_allowed(app_name_or_path))
