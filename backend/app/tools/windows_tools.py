import os
import subprocess
import webbrowser
import psutil
from datetime import datetime, timezone
from typing import Dict, Any
from app.core.config import settings
from app.core.security import validate_executable_allowed
from app.database.sqlite import log_action

def get_system_status() -> Dict[str, Any]:
    """Retrieves real Windows 11 system metrics."""
    cpu_percent = psutil.cpu_percent(interval=0.1)
    virtual_mem = psutil.virtual_memory()
    disk = psutil.disk_usage(os.getenv("SystemDrive", "C:") + "\\")
    battery = psutil.sensors_battery()
    
    return {
        "cpu_percent": cpu_percent,
        "memory_used_gb": round(virtual_mem.used / (1024**3), 2),
        "memory_total_gb": round(virtual_mem.total / (1024**3), 2),
        "memory_percent": virtual_mem.percent,
        "disk_free_gb": round(disk.free / (1024**3), 2),
        "disk_total_gb": round(disk.total / (1024**3), 2),
        "disk_percent": disk.percent,
        "battery_percent": battery.percent if battery else None,
        "battery_plugged": battery.power_plugged if battery else True,
        "platform": "Windows 11"
    }

def get_system_time() -> Dict[str, str]:
    now = datetime.now()
    return {
        "iso": now.isoformat(),
        "time": now.strftime("%I:%M %p"),
        "date": now.strftime("%A, %B %d, %Y"),
        "timezone": str(now.astimezone().tzinfo)
    }

def open_app(app_name: str) -> Dict[str, Any]:
    if not settings.automation_enabled:
        return {"success": False, "error": "Automation is globally disabled by user."}
    
    app_clean = app_name.lower().strip()
    allowlist = {
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "calc": "calc.exe",
        "explorer": "explorer.exe",
        "files": "explorer.exe",
        "code": "code",
        "vscode": "code",
        "edge": "msedge.exe",
        "chrome": "chrome.exe"
    }
    
    target_cmd = allowlist.get(app_clean)
    if not target_cmd:
        return {"success": False, "error": f"Application '{app_name}' is not in the approved allowlist."}
    
    try:
        subprocess.Popen(target_cmd, shell=True)
        return {"success": True, "message": f"Successfully launched {app_name}."}
    except Exception as e:
        return {"success": False, "error": f"Failed to launch {app_name}: {str(e)}"}

def open_url(url: str) -> Dict[str, Any]:
    if not settings.automation_enabled:
        return {"success": False, "error": "Automation is globally disabled."}
    
    url_clean = url.strip()
    if not (url_clean.startswith("http://") or url_clean.startswith("https://")):
        return {"success": False, "error": "Only valid HTTP and HTTPS URLs can be opened."}
    
    try:
        webbrowser.open(url_clean)
        return {"success": True, "message": f"Opened {url_clean} in default browser."}
    except Exception as e:
        return {"success": False, "error": f"Failed to open URL: {str(e)}"}

def show_notification(title: str, message: str) -> Dict[str, Any]:
    """Displays a native Windows toast notification via PowerShell."""
    try:
        # PowerShell script to show a toast without external DLLs
        ps_script = f"""
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode("{title}")) > $null
        $textNodes.Item(1).AppendChild($template.CreateTextNode("{message}")) > $null
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("F.R.I.D.A.Y. AI")
        $notification = [Windows.UI.Notifications.ToastNotification]::new($template)
        $notifier.Show($notification)
        """
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, timeout=5)
        return {"success": True, "message": "Notification dispatched."}
    except Exception as e:
        return {"success": False, "error": f"Notification error: {str(e)}"}

def open_settings_page(page: str = "") -> Dict[str, Any]:
    if not settings.automation_enabled:
        return {"success": False, "error": "Automation is globally disabled."}
    
    allowed_pages = {
        "": "ms-settings:",
        "display": "ms-settings:display",
        "sound": "ms-settings:sound",
        "notifications": "ms-settings:notifications",
        "power": "ms-settings:powersleep",
        "apps": "ms-settings:appsfeatures",
        "wifi": "ms-settings:network-wifi",
        "windowsupdate": "ms-settings:windowsupdate"
    }
    
    uri = allowed_pages.get(page.lower().strip(), "ms-settings:")
    try:
        os.startfile(uri)
        return {"success": True, "message": f"Opened Windows Settings ({page})."}
    except Exception as e:
        return {"success": False, "error": f"Failed to open settings: {str(e)}"}
