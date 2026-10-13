from typing import Dict, Any, Callable
from app.tools import windows_tools
from app.services.file_service import file_service
from app.database import sqlite
from app.core.config import settings

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._register_default_tools()

    def register(self, name: str, description: str, func: Callable, requires_confirmation: bool = False):
        self._tools[name] = {
            "name": name,
            "description": description,
            "func": func,
            "requires_confirmation": requires_confirmation
        }

    def _register_default_tools(self):
        self.register(
            "get_system_status",
            "Retrieve system CPU, memory, battery, and disk stats",
            windows_tools.get_system_status,
            requires_confirmation=False
        )
        self.register(
            "get_system_time",
            "Retrieve current system date and time",
            windows_tools.get_system_time,
            requires_confirmation=False
        )
        self.register(
            "open_app",
            "Open an approved Windows application (notepad, calc, explorer, code, edge, chrome)",
            windows_tools.open_app,
            requires_confirmation=False
        )
        self.register(
            "open_url",
            "Open a validated HTTP/HTTPS URL in the default browser",
            windows_tools.open_url,
            requires_confirmation=False
        )
        self.register(
            "send_notification",
            "Show a Windows desktop toast notification",
            windows_tools.show_notification,
            requires_confirmation=False
        )
        self.register(
            "open_settings",
            "Open Windows Settings page",
            windows_tools.open_settings_page,
            requires_confirmation=False
        )
        self.register(
            "search_files",
            "Search files in approved folders",
            lambda query, extension=None, directory=None: file_service.search_files(query, extension, directory),
            requires_confirmation=False
        )
        self.register(
            "read_document",
            "Read and extract text from an approved document (.txt, .md, .pdf, .docx)",
            lambda file_path: file_service.read_document_content(file_path),
            requires_confirmation=False
        )

    def list_tools(self) -> list[dict]:
        return [
            {
                "name": t["name"],
                "description": t["description"],
                "requires_confirmation": t["requires_confirmation"]
            }
            for t in self._tools.values()
        ]

    async def execute(self, tool_name: str, params: dict, confirmed: bool = False) -> dict:
        if tool_name not in self._tools:
            return {"success": False, "error": f"Tool '{tool_name}' is not registered."}
        
        tool = self._tools[tool_name]
        if tool["requires_confirmation"] and not confirmed:
            return {
                "success": False,
                "requires_confirmation": True,
                "message": f"Action '{tool_name}' requires explicit user confirmation.",
                "parameters": params
            }
        
        try:
            func = tool["func"]
            import inspect
            if inspect.iscoroutinefunction(func):
                result = await func(**params)
            else:
                result = func(**params)
            
            await sqlite.log_action(f"tool:{tool_name}", f"Executed tool {tool_name}", "success", {"params": params})
            return {"success": True, "result": result}
        except Exception as e:
            await sqlite.log_action(f"tool:{tool_name}", f"Failed tool {tool_name}: {str(e)}", "error", {"params": params})
            return {"success": False, "error": str(e)}

tool_registry = ToolRegistry()
