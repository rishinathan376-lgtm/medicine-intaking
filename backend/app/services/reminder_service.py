import logging
from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.medicine import Medicine
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.user import User
from app.services.email_service import EmailService
from app.core.config import settings

logger = logging.getLogger("eldermed.reminder")

def get_app_timezone() -> ZoneInfo:
    """Retrieve configured application timezone with fallback to UTC."""
    try:
        return ZoneInfo(settings.APP_TIMEZONE)
    except Exception:
        return ZoneInfo("UTC")

def get_current_app_time() -> datetime:
    """Return timezone-aware current datetime for the application."""
    return datetime.now(get_app_timezone())

class ReminderService:

    @classmethod
    def generate_daily_schedules(cls, db: Session, target_date: Optional[date] = None) -> int:
        """
        Generate scheduled dose occurrences for all active medicines for target date.
        Uses relational MedicineReminderTime records, respects start/end dates,
        and sets appropriate initial status (upcoming, due, or missed).
        """
        if target_date is None:
            target_date = get_current_app_time().date()

        active_medicines = db.query(Medicine).filter(
            Medicine.is_active == True,
            Medicine.start_date <= target_date,
            (Medicine.end_date == None) | (Medicine.end_date >= target_date)
        ).all()

        now = get_current_app_time()
        created_count = 0

        for med in active_medicines:
            raw_times = med.times_list
            for time_str in raw_times:
                time_str = time_str.strip()
                if not time_str:
                    continue

                # Duplicate Prevention: Check if schedule already exists
                exists = db.query(MedicineSchedule).filter(
                    MedicineSchedule.medicine_id == med.id,
                    MedicineSchedule.patient_id == med.patient_id,
                    MedicineSchedule.scheduled_date == target_date,
                    MedicineSchedule.scheduled_time == time_str
                ).first()

                if not exists:
                    # Determine initial status based on scheduled time vs current time
                    initial_status = "upcoming"
                    try:
                        hour, minute = map(int, time_str.split(":"))
                        sched_dt = datetime(
                            target_date.year, target_date.month, target_date.day,
                            hour, minute, tzinfo=now.tzinfo
                        )
                        grace_deadline = sched_dt + timedelta(minutes=settings.GRACE_PERIOD_MINUTES)
                        
                        if now > grace_deadline:
                            initial_status = "missed"
                        elif now >= sched_dt:
                            initial_status = "due"
                        else:
                            initial_status = "upcoming"
                    except Exception as ex:
                        logger.warning(f"Could not parse scheduled time {time_str}: {ex}")
                        initial_status = "upcoming"

                    schedule = MedicineSchedule(
                        medicine_id=med.id,
                        patient_id=med.patient_id,
                        scheduled_date=target_date,
                        scheduled_time=time_str,
                        status=initial_status,
                        notified_caregiver=False
                    )
                    db.add(schedule)
                    created_count += 1

        if created_count > 0:
            db.commit()
            logger.info(f"Generated {created_count} schedules for date {target_date}")
        return created_count

    @classmethod
    def process_reminder_lifecycle(
        cls, 
        db: Session, 
        simulated_time_str: Optional[str] = None
    ) -> Dict[str, int]:
        """
        Core Reminder Engine:
        1. Checks active medicine schedules for today.
        2. Evaluates current time against scheduled times.
        3. Transitions 'upcoming' -> 'due' and generates patient reminder notifications.
        4. Transitions 'due' -> 'missed' if grace period has expired, creates caregiver alerts,
           stores notifications in PostgreSQL, and dispatches caregiver email notifications.
        5. Prevents duplicate notifications, duplicate logs, and duplicate alerts.
        """
        now = get_current_app_time()
        today = now.date()

        # Ensure schedules exist for today
        cls.generate_daily_schedules(db, target_date=today)

        if simulated_time_str:
            try:
                sim_hour, sim_minute = map(int, simulated_time_str.split(":"))
                eval_dt = datetime(
                    today.year, today.month, today.day,
                    sim_hour, sim_minute, tzinfo=now.tzinfo
                )
            except Exception as e:
                logger.error(f"Invalid simulated time {simulated_time_str}: {e}")
                eval_dt = now
        else:
            eval_dt = now

        # Fetch all unresolved schedules for today
        candidate_schedules = db.query(MedicineSchedule).filter(
            MedicineSchedule.scheduled_date == today,
            MedicineSchedule.status.in_(["upcoming", "due", "pending"])
        ).all()

        due_count = 0
        missed_count = 0

        for sched in candidate_schedules:
            try:
                hour, minute = map(int, sched.scheduled_time.split(":"))
                sched_dt = datetime(
                    today.year, today.month, today.day,
                    hour, minute, tzinfo=eval_dt.tzinfo
                )
                if sched.reminder_sent_at:
                    sent_dt = sched.reminder_sent_at.replace(tzinfo=eval_dt.tzinfo)
                    grace_deadline = max(sched_dt + timedelta(minutes=settings.GRACE_PERIOD_MINUTES),
                                         sent_dt + timedelta(minutes=settings.GRACE_PERIOD_MINUTES))
                elif sched.status == "due":
                    grace_deadline = max(sched_dt + timedelta(minutes=settings.GRACE_PERIOD_MINUTES),
                                         eval_dt + timedelta(minutes=settings.GRACE_PERIOD_MINUTES))
                else:
                    grace_deadline = sched_dt + timedelta(minutes=settings.GRACE_PERIOD_MINUTES)

                patient = db.query(Patient).filter(Patient.id == sched.patient_id).first()
                patient_name = patient.user.full_name if (patient and patient.user) else "Patient"
                med_name = sched.medicine.name if sched.medicine else "Medication"
                med_dosage = sched.medicine.dosage if sched.medicine else ""
                instructions = sched.medicine.instructions if sched.medicine else "Take with a full glass of water."

                # Case 1: Past Grace Period -> Transition to MISSED
                if eval_dt > grace_deadline:
                    sched.status = "missed"
                    missed_count += 1

                    # Duplicate Prevention: Create MedicationLog if not already logged
                    existing_log = db.query(MedicationLog).filter(
                        (MedicationLog.schedule_id == sched.id) |
                        ((MedicationLog.medicine_id == sched.medicine_id) & 
                         (MedicationLog.patient_id == sched.patient_id) &
                         (MedicationLog.scheduled_date == today) &
                         (MedicationLog.scheduled_time == sched.scheduled_time))
                    ).first()

                    if not existing_log:
                        log = MedicationLog(
                            schedule_id=sched.id,
                            medicine_id=sched.medicine_id,
                            patient_id=sched.patient_id,
                            status="missed",
                            scheduled_date=today,
                            scheduled_time=sched.scheduled_time,
                            actual_taken_time=None,
                            caregiver_notes=f"Auto-marked as missed: grace period ({settings.GRACE_PERIOD_MINUTES} min) expired."
                        )
                        db.add(log)

                    # Duplicate Prevention: Create Caregiver Alert notification if not already notified
                    if not sched.notified_caregiver:
                        sched.notified_caregiver = True
                        alert_notif = Notification(
                            user_id=patient.user_id if patient else None,
                            patient_id=sched.patient_id,
                            medicine_id=sched.medicine_id,
                            schedule_id=sched.id,
                            title=f"⚠️ Missed Medicine Alert: {patient_name}",
                            message=f"{patient_name} missed scheduled dose of {med_name} ({med_dosage}) at {sched.scheduled_time}. Grace period expired.",
                            notification_type="missed_alert",
                            channel="in_app",
                            status="active",
                            scheduled_time=sched.scheduled_time,
                            missed_at=eval_dt.replace(tzinfo=None)
                        )
                        db.add(alert_notif)

                        # Dispatch Email to Registered Caregiver
                        caregiver_email = patient.caregiver_email if patient else None
                        if caregiver_email:
                            EmailService.send_missed_alert(
                                caregiver_email=caregiver_email,
                                caregiver_name=patient.caregiver_name or "Caregiver",
                                patient_name=patient_name,
                                medicine_name=f"{med_name} ({med_dosage})",
                                scheduled_time=sched.scheduled_time,
                                phone=patient.user.phone_number if (patient and patient.user) else ""
                            )

                # Case 2: Due Window (sched_dt <= eval_dt <= grace_deadline) or already active due
                elif eval_dt >= sched_dt or sched.status == "due":
                    if sched.status != "due":
                        sched.status = "due"
                        due_count += 1

                    # Duplicate Prevention: Generate patient due reminder notification once
                    if sched.reminder_sent_at is None:
                        sched.reminder_sent_at = eval_dt.replace(tzinfo=None)
                        due_notif = Notification(
                            user_id=patient.user_id if patient else None,
                            patient_id=sched.patient_id,
                            medicine_id=sched.medicine_id,
                            schedule_id=sched.id,
                            title=f"⏰ Time to take {med_name}",
                            message=f"Scheduled dose: {med_name} ({med_dosage}) at {sched.scheduled_time}. Instructions: {instructions}",
                            notification_type="reminder",
                            channel="in_app",
                            status="unread",
                            scheduled_time=sched.scheduled_time
                        )
                        db.add(due_notif)

                        # Send reminder email if patient has registered email
                        if patient and patient.user and patient.user.email:
                            EmailService.send_medicine_reminder(
                                to_email=patient.user.email,
                                patient_name=patient_name,
                                medicine_name=med_name,
                                dosage=med_dosage,
                                scheduled_time=sched.scheduled_time,
                                instructions=instructions
                            )

                # Case 3: Still Upcoming (eval_dt < sched_dt)
                else:
                    if sched.status != "upcoming":
                        sched.status = "upcoming"

            except Exception as ex:
                logger.error(f"Error processing schedule id {sched.id}: {ex}")
                continue

        db.commit()
        return {"due_processed": due_count, "missed_processed": missed_count}

    @classmethod
    def record_dose_action(
        cls, 
        db: Session, 
        schedule_id: int, 
        action: str, 
        patient_notes: Optional[str] = None, 
        caregiver_notes: Optional[str] = None
    ) -> MedicineSchedule:
        """
        Record patient or caregiver action ('taken' or 'missed').
        - Updates schedule status.
        - Records actual timestamp when taken.
        - Safely decrements medicine inventory.
        - Persists MedicationLog with duplicate prevention.
        - Generates caregiver alert & email if missed.
        """
        schedule = db.query(MedicineSchedule).filter(MedicineSchedule.id == schedule_id).first()
        if not schedule:
            raise ValueError(f"Schedule #{schedule_id} not found.")

        now = get_current_app_time()
        action_lower = action.lower()
        if action_lower not in ["taken", "missed"]:
            raise ValueError("Action must be either 'taken' or 'missed'.")

        schedule.status = action_lower

        patient = db.query(Patient).filter(Patient.id == schedule.patient_id).first()
        patient_name = patient.user.full_name if (patient and patient.user) else "Patient"
        med_name = schedule.medicine.name if schedule.medicine else "Medication"

        if action_lower == "taken":
            schedule.taken_at = now.replace(tzinfo=None)
            # Safely decrement medicine inventory
            if schedule.medicine and schedule.medicine.quantity > 0:
                schedule.medicine.quantity -= 1

            # Acknowledge any active due notifications for this schedule
            db.query(Notification).filter(
                Notification.schedule_id == schedule.id,
                Notification.notification_type == "reminder"
            ).update({"is_read": True, "status": "acknowledged"}, synchronize_session=False)

        elif action_lower == "missed":
            # If manually recorded as missed, alert caregiver if not already notified
            if not schedule.notified_caregiver:
                schedule.notified_caregiver = True
                alert_notif = Notification(
                    user_id=patient.user_id if patient else None,
                    patient_id=schedule.patient_id,
                    medicine_id=schedule.medicine_id,
                    schedule_id=schedule.id,
                    title=f"⚠️ Missed Medicine Alert: {patient_name}",
                    message=f"{patient_name} marked {med_name} at {schedule.scheduled_time} as missed.",
                    notification_type="missed_alert",
                    channel="in_app",
                    status="active",
                    scheduled_time=schedule.scheduled_time,
                    missed_at=now.replace(tzinfo=None)
                )
                db.add(alert_notif)

                if patient and patient.caregiver_email:
                    EmailService.send_missed_alert(
                        caregiver_email=patient.caregiver_email,
                        caregiver_name=patient.caregiver_name or "Caregiver",
                        patient_name=patient_name,
                        medicine_name=med_name,
                        scheduled_time=schedule.scheduled_time,
                        phone=patient.user.phone_number if (patient and patient.user) else ""
                    )

        # Duplicate Prevention: Insert or update MedicationLog
        log = db.query(MedicationLog).filter(MedicationLog.schedule_id == schedule.id).first()
        if not log:
            log = MedicationLog(
                schedule_id=schedule.id,
                medicine_id=schedule.medicine_id,
                patient_id=schedule.patient_id,
                status=action_lower,
                scheduled_date=schedule.scheduled_date,
                scheduled_time=schedule.scheduled_time,
                actual_taken_time=now.replace(tzinfo=None) if action_lower == "taken" else None,
                patient_notes=patient_notes,
                caregiver_notes=caregiver_notes
            )
            db.add(log)
        else:
            log.status = action_lower
            log.actual_taken_time = now.replace(tzinfo=None) if action_lower == "taken" else None
            if patient_notes:
                log.patient_notes = patient_notes
            if caregiver_notes:
                log.caregiver_notes = caregiver_notes

        db.commit()
        db.refresh(schedule)
        return schedule

    @classmethod
    def trigger_schedule_due_now(cls, db: Session, schedule_id: int) -> MedicineSchedule:
        """
        Fast-Forward / Test Simulation Helper:
        Instantly puts a schedule into 'due' status, updates scheduled_time to current time,
        resets reminder_sent_at, and triggers reminder notifications immediately without waiting!
        """
        schedule = db.query(MedicineSchedule).filter(MedicineSchedule.id == schedule_id).first()
        if not schedule:
            raise ValueError(f"Schedule #{schedule_id} not found.")

        now = get_current_app_time()
        schedule.status = "due"
        schedule.reminder_sent_at = None
        db.commit()

        # Run lifecycle check to fire notifications
        cls.process_reminder_lifecycle(db)
        db.refresh(schedule)
        return schedule

    @classmethod
    def trigger_schedule_missed_now(cls, db: Session, schedule_id: int) -> MedicineSchedule:
        """
        Fast-Forward / Test Simulation Helper:
        Instantly marks a schedule as missed and fires caregiver alert + email immediately.
        """
        schedule = db.query(MedicineSchedule).filter(MedicineSchedule.id == schedule_id).first()
        if not schedule:
            raise ValueError(f"Schedule #{schedule_id} not found.")
        schedule.notified_caregiver = False
        db.commit()
        return cls.record_dose_action(
            db=db,
            schedule_id=schedule_id,
            action="missed",
            caregiver_notes="Triggered immediately via caregiver/test simulation tool."
        )

    @classmethod
    def check_and_alert_missed_doses(cls, db: Session) -> Dict[str, int]:
        """Convenience alias for process_reminder_lifecycle."""
        return cls.process_reminder_lifecycle(db)
