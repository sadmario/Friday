import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.database import sqlite
from app.tools.windows_tools import show_notification, get_system_status

class ReminderScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._is_running = False

    def start(self):
        if not self._is_running:
            self.scheduler.add_job(self.check_reminders, 'interval', seconds=10, id='check_reminders', replace_existing=True)
            self.scheduler.start()
            self._is_running = True
            # Check missed reminders on startup
            asyncio.create_task(self.recover_missed_reminders())

    def stop(self):
        if self._is_running:
            self.scheduler.shutdown(wait=False)
            self._is_running = False

    async def check_reminders(self):
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            reminders = await sqlite.get_reminders(status='pending')
            for r in reminders:
                scheduled_time = r['scheduled_at']
                snoozed_until = r.get('snoozed_until')
                target_time = snoozed_until if snoozed_until else scheduled_time
                
                # If target time is past or now
                if target_time <= now_iso:
                    # Trigger notification
                    title = f"F.R.I.D.A.Y. Reminder: {r['title']}"
                    msg = r.get('message') or "You have a scheduled reminder."
                    show_notification(title, msg)
                    
                    # Update status to triggered
                    await sqlite.update_reminder_status(r['id'], 'triggered')
        except Exception as e:
            print(f"[Scheduler] Error checking reminders: {e}")

    async def recover_missed_reminders(self):
        """Identifies reminders that were scheduled in the past while the app was closed."""
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            reminders = await sqlite.get_reminders(status='pending')
            missed = [r for r in reminders if r['scheduled_at'] < now_iso]
            if missed:
                print(f"[Scheduler] Recovered {len(missed)} missed reminders from shutdown.")
                show_notification(
                    "F.R.I.D.A.Y. Online",
                    f"Recovered {len(missed)} pending reminder(s) while assistant was offline."
                )
        except Exception as e:
            print(f"[Scheduler] Missed reminder recovery notice: {e}")

    async def get_daily_briefing(self) -> dict:
        now = datetime.now()
        date_str = now.strftime("%A, %B %d, %Y")
        time_str = now.strftime("%I:%M %p")
        
        tasks = await sqlite.get_tasks(status="pending")
        reminders = await sqlite.get_reminders(status="pending")
        stats = get_system_status()
        
        # Greeting phrasing
        hour = now.hour
        if hour < 12:
            time_greeting = "Good morning"
        elif hour < 17:
            time_greeting = "Good afternoon"
        else:
            time_greeting = "Good evening"
            
        greeting_text = (
            f"{time_greeting}. F.R.I.D.A.Y. is online. "
            f"You have {len(tasks)} pending task{'s' if len(tasks) != 1 else ''} and "
            f"{len(reminders)} upcoming reminder{'s' if len(reminders) != 1 else ''}. "
            f"System CPU is at {stats['cpu_percent']}%, and memory usage is {stats['memory_percent']}%."
        )
        
        return {
            "greeting": greeting_text,
            "date_str": date_str,
            "time_str": time_str,
            "pending_tasks_count": len(tasks),
            "upcoming_reminders_count": len(reminders),
            "tasks": tasks[:5],
            "reminders": reminders[:5],
            "system_status": stats
        }

reminder_scheduler = ReminderScheduler()
