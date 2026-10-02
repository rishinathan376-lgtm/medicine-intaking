import asyncio
import logging
from typing import Optional
from app.core.database import SessionLocal
from app.services.reminder_service import ReminderService
from app.core.config import settings

logger = logging.getLogger("eldermed.scheduler")

_scheduler_task: Optional[asyncio.Task] = None
_is_running: bool = False

async def _scheduler_loop():
    global _is_running
    logger.info(
        f"ElderMed Reminder Engine background worker started! "
        f"[Check Interval: {settings.REMINDER_CHECK_INTERVAL_SECONDS}s, "
        f"Timezone: {settings.APP_TIMEZONE}, "
        f"Grace Period: {settings.GRACE_PERIOD_MINUTES}m]"
    )
    _is_running = True
    while _is_running:
        try:
            with SessionLocal() as db:
                ReminderService.process_reminder_lifecycle(db)
        except asyncio.CancelledError:
            logger.info("Reminder Engine background worker received cancellation signal.")
            break
        except Exception as e:
            logger.error(f"Error in Reminder Engine cycle: {e}", exc_info=True)
            
        try:
            await asyncio.sleep(settings.REMINDER_CHECK_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            break
    _is_running = False
    logger.info("ElderMed Reminder Engine background worker stopped.")

def start_reminder_scheduler() -> asyncio.Task:
    """Launch the reminder engine background worker task in the active asyncio loop."""
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_scheduler_loop())
    return _scheduler_task

def stop_reminder_scheduler():
    """Stop the reminder engine background worker cleanly."""
    global _scheduler_task, _is_running
    _is_running = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
