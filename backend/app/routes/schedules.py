from datetime import date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import get_current_user, verify_patient_data_access
from app.models.user import User, UserRole
from app.models.schedule import MedicineSchedule
from app.models.patient import Patient
from app.schemas.schedule import ScheduleOut, ScheduleActionRequest
from app.services.reminder_service import ReminderService, get_current_app_time

router = APIRouter(prefix="/schedules", tags=["Schedules"])

@router.get("/today", response_model=List[ScheduleOut])
def get_today_schedules(
    patient_id: Optional[int] = None, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve today's medication schedules for patient with updated lifecycle statuses and authorization."""
    now = get_current_app_time()
    today = now.date()

    # Run lifecycle check to guarantee statuses (upcoming, due, taken, missed) are fresh
    ReminderService.process_reminder_lifecycle(db)

    query = db.query(MedicineSchedule).options(
        joinedload(MedicineSchedule.medicine)
    ).filter(MedicineSchedule.scheduled_date == today)

    if current_user.role == UserRole.PATIENT:
        pt = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not pt:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        if patient_id and patient_id != pt.id:
            raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view another patient's schedules.")
        query = query.filter(MedicineSchedule.patient_id == pt.id)
    elif patient_id:
        verify_patient_data_access(patient_id, current_user, db)
        query = query.filter(MedicineSchedule.patient_id == patient_id)
    else:
        patient = db.query(Patient).first()
        if patient:
            query = query.filter(MedicineSchedule.patient_id == patient.id)

    return query.order_by(MedicineSchedule.scheduled_time.asc()).all()

@router.post("/{schedule_id}/action", response_model=ScheduleOut)
def record_schedule_action(
    schedule_id: int, 
    action_in: ScheduleActionRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Patient or caregiver confirms a dose as 'taken' or 'missed'.
    Records medication log and alerts caregiver if missed.
    Prevents duplicate submissions and verifies authorization.
    """
    action_clean = action_in.action.strip().lower()
    if action_clean not in ["taken", "missed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be either 'taken' or 'missed'."
        )

    # Fetch schedule to check authorization
    schedule = db.query(MedicineSchedule).filter(MedicineSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail=f"Schedule #{schedule_id} not found.")

    # Authorization verification
    verify_patient_data_access(schedule.patient_id, current_user, db)

    try:
        updated_schedule = ReminderService.record_dose_action(
            db=db,
            schedule_id=schedule_id,
            action=action_clean,
            patient_notes=action_in.patient_notes,
            caregiver_notes=action_in.caregiver_notes
        )
        return updated_schedule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/process-reminders")
def process_reminders(db: Session = Depends(get_db)):
    """Manually invoke backend reminder lifecycle check."""
    result = ReminderService.process_reminder_lifecycle(db)
    return {"message": "Reminder lifecycle executed successfully.", "details": result}

@router.post("/simulate-time")
def simulate_time(
    simulated_time: str = Query(..., description="Simulated 24-hr time 'HH:MM' e.g. '11:00'"),
    db: Session = Depends(get_db)
):
    """
    Fast-forward simulation endpoint:
    Evaluates schedules as if the current clock were at the provided time string.
    """
    result = ReminderService.process_reminder_lifecycle(db, simulated_time_str=simulated_time)
    return {
        "message": f"Reminder engine evaluated for simulated time {simulated_time}.",
        "details": result
    }

@router.post("/{schedule_id}/trigger-due", response_model=ScheduleOut)
def trigger_schedule_due(
    schedule_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fast-forward test helper:
    Immediately forces a scheduled dose to become 'due',
    triggering reminder notification & audio chime without waiting!
    """
    schedule = db.query(MedicineSchedule).filter(MedicineSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail=f"Schedule #{schedule_id} not found.")
    verify_patient_data_access(schedule.patient_id, current_user, db)

    try:
        updated = ReminderService.trigger_schedule_due_now(db, schedule_id)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{schedule_id}/trigger-missed", response_model=ScheduleOut)
def trigger_schedule_missed(
    schedule_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fast-forward test helper:
    Immediately marks a schedule as missed and fires caregiver alert + email.
    """
    schedule = db.query(MedicineSchedule).filter(MedicineSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail=f"Schedule #{schedule_id} not found.")
    verify_patient_data_access(schedule.patient_id, current_user, db)

    try:
        updated = ReminderService.trigger_schedule_missed_now(db, schedule_id)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
