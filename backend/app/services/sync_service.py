import httpx
from typing import Dict, Any, List
from app.core.config import settings
from app.database import sqlite

class SyncService:
    def __init__(self):
        self.supabase_url = settings.supabase_url
        self.anon_key = settings.supabase_anon_key

    async def check_cloud_health(self) -> Dict[str, Any]:
        """Verifies Supabase API reachability."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(
                    f"{self.supabase_url}/rest/v1/",
                    headers={
                        "apikey": self.anon_key,
                        "Authorization": f"Bearer {self.anon_key}",
                    }
                )
                # 200/404 = healthy, 401 = reachable but RLS blocked (still online)
                return {
                    "online": res.status_code in [200, 404, 401],
                    "status_code": res.status_code,
                    "endpoint": self.supabase_url
                }
        except Exception as e:
            return {
                "online": False,
                "error": str(e),
                "endpoint": self.supabase_url
            }

    async def sync_all(self, auth_token: str = None) -> Dict[str, Any]:
        """Pushes unsynced local records to Supabase when authenticated."""
        health = await self.check_cloud_health()
        if not health["online"]:
            return {"success": False, "message": "Supabase cloud endpoint is unreachable."}
        
        token = auth_token or self.anon_key
        headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        
        synced_counts = {"tasks": 0, "reminders": 0, "memories": 0}
        
        # Sync tasks
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                tasks = await sqlite.get_tasks()
                for t in tasks:
                    if not t.get("synced", 0) and auth_token:
                        payload = {
                            "id": t["id"],
                            "title": t["title"],
                            "description": t.get("description", ""),
                            "priority": t.get("priority", "medium"),
                            "status": t.get("status", "pending"),
                            "due_at": t.get("due_at")
                        }
                        res = await client.post(f"{self.supabase_url}/rest/v1/tasks", json=payload, headers=headers)
                        if res.status_code in [200, 201]:
                            synced_counts["tasks"] += 1
        except Exception as e:
            print(f"[SyncService] Tasks sync notice: {e}")
            
        return {
            "success": True,
            "cloud_online": True,
            "synced": synced_counts
        }

sync_service = SyncService()
