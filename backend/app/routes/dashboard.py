from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.models.medicine import Medicine
from app.models.schedule import MedicineSchedule
from app.models.patient import Patient
from app.models.log import MedicationLog
from app.schemas.dashboard import DashboardSummary, RecentActivityItem
from app.schemas.schedule import ScheduleOut
from app.schemas.patient import PatientOut
from app.services.reminder_service import ReminderService

from app.core.dependencies import get_current_user, verify_patient_data_access
from app.models.user import User, UserRole
from fastapi import HTTPException

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    patient_id: Optional[int] = None, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch complete dashboard summary statistics, today's schedule, and recent activity."""
    # Ensure today's schedules are generated and statuses evaluated
    ReminderService.process_reminder_lifecycle(db)

    # Resolve patient with security validation
    if current_user.role == UserRole.PATIENT:
        pt = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not pt:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        if patient_id and patient_id != pt.id:
            raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view another patient's dashboard.")
        patient = pt
    elif patient_id:
        patient = verify_patient_data_access(patient_id, current_user, db)
    else:
        patient = db.query(Patient).options(joinedload(Patient.user)).first()

    # Active medicines count
    med_query = db.query(Medicine).filter(Medicine.is_active == True)
    if patient:
        med_query = med_query.filter(Medicine.patient_id == patient.id)
    total_medicines = med_query.count()

    # Today's schedules
    today = date.today()
    sched_query = db.query(MedicineSchedule).options(joinedload(MedicineSchedule.medicine)).filter(
        MedicineSchedule.scheduled_date == today
    )
    if patient:
        sched_query = sched_query.filter(MedicineSchedule.patient_id == patient.id)
    
    today_schedules = sched_query.order_by(MedicineSchedule.scheduled_time.asc()).all()

    today_total = len(today_schedules)
    taken_count = sum(1 for s in today_schedules if s.status == "taken")
    missed_count = sum(1 for s in today_schedules if s.status == "missed")
    upcoming_count = sum(1 for s in today_schedules if s.status in ["upcoming", "due", "pending"])

    # Overall Adherence Percentage calculation
    logs_query = db.query(MedicationLog)
    if patient:
        logs_query = logs_query.filter(MedicationLog.patient_id == patient.id)
    all_logs = logs_query.all()
    
    total_logged = len(all_logs)
    taken_logged = sum(1 for l in all_logs if l.status == "taken")
    if total_logged > 0:
        adherence_percentage = round((taken_logged / total_logged) * 100, 1)
    elif today_total > 0 and (taken_count + missed_count) > 0:
        adherence_percentage = round((taken_count / (taken_count + missed_count)) * 100, 1)
    else:
        adherence_percentage = 100.0

    # Build recent activity items
    recent_logs = logs_query.order_by(MedicationLog.created_at.desc()).limit(10).all()
    activities = []
    for log in recent_logs:
        med_name = log.medicine.name if log.medicine else "Medication"
        time_str = log.created_at.strftime("%I:%M %p") if log.created_at else ""
        if log.status == "taken":
            activities.append(RecentActivityItem(
                id=log.id,
                title=f"Taken: {med_name}",
                description=f"Confirmed at {time_str}. Scheduled for {log.scheduled_time}.",
                timestamp=time_str,
                type="taken",
                badge_color="green"
            ))
        else:
            activities.append(RecentActivityItem(
                id=log.id,
                title=f"Missed: {med_name}",
                description=f"Scheduled for {log.scheduled_time}. Caregiver alerted.",
                timestamp=time_str,
                type="missed",
                badge_color="red"
            ))

    patient_out = PatientOut.model_validate(patient) if patient else None

    return DashboardSummary(
        total_medicines=total_medicines,
        today_total=today_total,
        taken_count=taken_count,
        missed_count=missed_count,
        upcoming_count=upcoming_count,
        adherence_percentage=adherence_percentage,
        patient=patient_out,
        today_schedules=[ScheduleOut.model_validate(s) for s in today_schedules],
        recent_activities=activities
    )
