"""
ElderMed - Dedicated Production Reminder Background Worker Process
Run this standalone worker in scaled, multi-replica, or containerized deployments:
    python -m app.worker

Guarantees continuous reminder checking, transition processing, and caregiver
alerting without requiring the web server process to run the scheduler.
"""
import asyncio
import logging
import signal
import sys
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.reminder_service import ReminderService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] eldermed.worker: %(message)s"
)
logger = logging.getLogger("eldermed.worker")

stop_event = asyncio.Event()

def signal_handler(sig, frame):
    logger.info(f"Received termination signal ({sig}). Shutting down worker...")
    stop_event.set()

async def run_worker():
    logger.info("=" * 65)
    logger.info("  ELDERMED PRODUCTION REMINDER BACKGROUND WORKER STARTED")
    logger.info(f"  Check Interval : {settings.REMINDER_CHECK_INTERVAL_SECONDS} seconds")
    logger.info(f"  Grace Period   : {settings.GRACE_PERIOD_MINUTES} minutes")
    logger.info(f"  App Timezone   : {settings.APP_TIMEZONE}")
    logger.info(f"  Target DB      : {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    logger.info("=" * 65)

    loop_count = 0
    while not stop_event.is_set():
        loop_count += 1
        try:
            with SessionLocal() as db:
                result = ReminderService.process_reminder_lifecycle(db)
                if result.get("due_processed", 0) > 0 or result.get("missed_processed", 0) > 0:
                    logger.info(f"Cycle #{loop_count}: Processed {result}")
        except Exception as e:
            logger.error(f"Error in Reminder Worker cycle #{loop_count}: {e}", exc_info=True)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=settings.REMINDER_CHECK_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass

    logger.info("ElderMed Reminder Worker stopped cleanly.")

def main():
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    try:
        asyncio.run(run_worker())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Worker terminated.")

if __name__ == "__main__":
    main()
