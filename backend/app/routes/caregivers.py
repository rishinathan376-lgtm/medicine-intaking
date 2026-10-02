from datetime import date, datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import get_current_caregiver, verify_caregiver_patient_access
from app.models.caregiver import Caregiver
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.medicine import Medicine
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification
from app.schemas.caregiver import (
    CaregiverDashboardSummary,
    CaregiverPatientSummary,
    CaregiverPatientDetail,
    NextMedicineInfo,
    LastMedicationInfo,
    AlertStatusUpdate,
)
from app.schemas.patient import PatientOut
from app.schemas.medicine import MedicineOut
from app.schemas.schedule import ScheduleOut
from app.schemas.log import MedicationLogOut
from app.schemas.notification import NotificationOut, CaregiverAlertOut
from app.services.reminder_service import ReminderService, get_current_app_time

router = APIRouter(prefix="/caregivers", tags=["Caregiver Dashboard"])

def _build_patient_summary(patient: Patient, db: Session, today: date) -> CaregiverPatientSummary:
    """Helper to compute today's stats, next dose, last dose, adherence, and active alerts for a patient."""
    p_name = patient.user.full_name if (patient.user) else f"Patient #{patient.id}"
    phone = patient.user.phone_number if (patient.user) else None

    # Today's schedules
    today_schedules = db.query(MedicineSchedule).options(
        joinedload(MedicineSchedule.medicine)
    ).filter(
        MedicineSchedule.patient_id == patient.id,
        MedicineSchedule.scheduled_date == today
    ).order_by(MedicineSchedule.scheduled_time.asc()).all()

    today_total = len(today_schedules)
    today_taken = sum(1 for s in today_schedules if s.status == "taken")
    today_missed = sum(1 for s in today_schedules if s.status == "missed")
    today_pending = sum(1 for s in today_schedules if s.status in ["upcoming", "due", "pending"])

    # Status summary string
    if today_total == 0:
        today_status_summary = "No medications scheduled today"
    elif today_taken == today_total:
        today_status_summary = f"All {today_total} doses completed"
    else:
        today_status_summary = f"{today_taken} of {today_total} doses taken ({today_pending} remaining)"

    # Next upcoming medicine
    next_sched = next((s for s in today_schedules if s.status in ["upcoming", "due", "pending"]), None)
    next_med_info = None
    if next_sched and next_sched.medicine:
        next_med_info = NextMedicineInfo(
            name=next_sched.medicine.name,
            dosage=next_sched.medicine.dosage,
            scheduled_time=next_sched.scheduled_time,
            before_after_food=next_sched.medicine.before_after_food,
            instructions=next_sched.medicine.instructions
        )

    # Last medication status from logs
    last_log = db.query(MedicationLog).options(
        joinedload(MedicationLog.medicine)
    ).filter(
        MedicationLog.patient_id == patient.id
    ).order_by(MedicationLog.created_at.desc()).first()

    last_med_info = None
    if last_log and last_log.medicine:
        last_med_info = LastMedicationInfo(
            name=last_log.medicine.name,
            status=last_log.status,
            scheduled_time=last_log.scheduled_time,
            actual_taken_time=last_log.actual_taken_time
        )

    # Calculate Adherence Percentage from actual logs
    all_logs = db.query(MedicationLog).filter(MedicationLog.patient_id == patient.id).all()
    total_logs = len(all_logs)
    taken_logs = sum(1 for l in all_logs if l.status == "taken")
    if total_logs > 0:
        adherence_percentage = round((taken_logs / total_logs) * 100.0, 1)
    elif today_total > 0 and (today_taken + today_missed) > 0:
        adherence_percentage = round((today_taken / (today_taken + today_missed)) * 100.0, 1)
    else:
        adherence_percentage = 100.0

    # Active alerts count (missed alerts that are active/unread)
    active_alerts_count = db.query(Notification).filter(
        Notification.patient_id == patient.id,
        Notification.notification_type == "missed_alert",
        Notification.status.in_(["active", "unread"])
    ).count()

    return CaregiverPatientSummary(
        patient_id=patient.id,
        patient_name=p_name,
        age=patient.age,
        gender=patient.gender,
        phone_number=phone,
        profile_photo=patient.profile_photo,
        health_conditions=patient.health_conditions,
        allergies=patient.allergies,
        today_total=today_total,
        today_taken=today_taken,
        today_missed=today_missed,
        today_pending=today_pending,
        today_status_summary=today_status_summary,
        next_medicine=next_med_info,
        last_medication_status=last_med_info,
        adherence_percentage=adherence_percentage,
        active_alerts_count=active_alerts_count
    )

def _build_alert_out(alert: Notification) -> CaregiverAlertOut:
    p_name = alert.patient.user.full_name if (alert.patient and alert.patient.user) else "Unknown Patient"
    m_name = alert.medicine.name if alert.medicine else "Medication"
    m_dose = alert.medicine.dosage if alert.medicine else None
    c_name = alert.patient.caregiver_name if alert.patient else None
    c_email = alert.patient.caregiver_email if alert.patient else None
    c_phone = alert.patient.caregiver_phone if alert.patient else None

    return CaregiverAlertOut(
        id=alert.id,
        patient_id=alert.patient_id or 0,
        patient_name=p_name,
        medicine_id=alert.medicine_id,
        medicine_name=m_name,
        dosage=m_dose,
        scheduled_time=alert.scheduled_time or "N/A",
        status="missed",
        missed_at=alert.missed_at or alert.created_at,
        alert_status=alert.status,
        caregiver_name=c_name,
        caregiver_email=c_email,
        caregiver_phone=c_phone,
        created_at=alert.created_at
    )

@router.get("/dashboard", response_model=CaregiverDashboardSummary)
def get_caregiver_dashboard(
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db)
):
    """
    Core Caregiver Dashboard Overview:
    Returns aggregate adherence, scheduled/taken/missed dose counts,
    assigned patients list with their individual adherence and today's status,
    plus missed alerts and recent notifications.
    """
    today = get_current_app_time().date()
    # Trigger background reminder lifecycle check to keep schedule statuses up-to-date
    ReminderService.process_reminder_lifecycle(db)

    # 1. Fetch assigned patients
    if caregiver.user and caregiver.user.role == UserRole.ADMIN:
        assigned_patients = db.query(Patient).options(joinedload(Patient.user)).all()
    else:
        assigned_patients = db.query(Patient).options(joinedload(Patient.user)).filter(
            Patient.caregiver_id == caregiver.id
        ).all()

    patient_summaries = [_build_patient_summary(p, db, today) for p in assigned_patients]

    # 2. Compute aggregate metrics across assigned patients
    total_assigned = len(assigned_patients)
    total_scheduled_today = sum(p.today_total for p in patient_summaries)
    total_taken_today = sum(p.today_taken for p in patient_summaries)
    total_missed_today = sum(p.today_missed for p in patient_summaries)
    total_pending_today = sum(p.today_pending for p in patient_summaries)

    # Overall adherence across all logs for assigned patients
    assigned_ids = [p.id for p in assigned_patients]
    if assigned_ids:
        all_logs = db.query(MedicationLog).filter(MedicationLog.patient_id.in_(assigned_ids)).all()
        if all_logs:
            overall_adherence = round((sum(1 for l in all_logs if l.status == "taken") / len(all_logs)) * 100.0, 1)
        elif (total_taken_today + total_missed_today) > 0:
            overall_adherence = round((total_taken_today / (total_taken_today + total_missed_today)) * 100.0, 1)
        else:
            overall_adherence = 100.0
    else:
        overall_adherence = 100.0

    # 3. Missed Medicine Alerts for assigned patients
    alerts_query = db.query(Notification).options(
        joinedload(Notification.patient).joinedload(Patient.user),
        joinedload(Notification.medicine)
    ).filter(
        Notification.notification_type == "missed_alert"
    )
    if assigned_ids:
        alerts_query = alerts_query.filter(Notification.patient_id.in_(assigned_ids))
    missed_alerts = alerts_query.order_by(Notification.created_at.desc()).limit(50).all()

    # 4. Recent notifications feed
    notifs_query = db.query(Notification).options(
        joinedload(Notification.patient).joinedload(Patient.user),
        joinedload(Notification.medicine)
    )
    if assigned_ids:
        notifs_query = notifs_query.filter(Notification.patient_id.in_(assigned_ids))
    recent_notifs = notifs_query.order_by(Notification.created_at.desc()).limit(20).all()

    c_name = caregiver.user.full_name if caregiver.user else "Caregiver"
    c_email = caregiver.user.email if caregiver.user else ""

    return CaregiverDashboardSummary(
        caregiver_id=caregiver.id,
        caregiver_name=c_name,
        caregiver_email=c_email,
        relationship=caregiver.relationship_to_patient,
        total_assigned_patients=total_assigned,
        total_scheduled_today=total_scheduled_today,
        total_taken_today=total_taken_today,
        total_missed_today=total_missed_today,
        total_pending_today=total_pending_today,
        overall_adherence_percentage=overall_adherence,
        assigned_patients=patient_summaries,
        missed_alerts=[_build_alert_out(a) for a in missed_alerts],
        recent_notifications=[NotificationOut.model_validate(n) for n in recent_notifs]
    )

@router.get("/patients", response_model=List[CaregiverPatientSummary])
def list_assigned_patients(
    search: Optional[str] = None,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db)
):
    """
    Search and filter assigned patients by name or phone number.
    Only returns patients belonging to the authenticated caregiver.
    """
    today = get_current_app_time().date()
    query = db.query(Patient).options(joinedload(Patient.user))
    
    if not (caregiver.user and caregiver.user.role == UserRole.ADMIN):
        query = query.filter(Patient.caregiver_id == caregiver.id)

    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        query = query.join(Patient.user).filter(
            (User.full_name.ilike(q)) | (User.phone_number.ilike(q))
        )

    patients = query.all()
    return [_build_patient_summary(p, db, today) for p in patients]

@router.get("/patients/{patient_id}", response_model=CaregiverPatientDetail)
@router.get("/patients/{patient_id}/details", response_model=CaregiverPatientDetail)
def get_assigned_patient_details(
    patient_id: int,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db)
):
    """
    Detailed Patient View for Caregivers:
    Enforces strict authorization (403 if patient is not assigned to this caregiver).
    Returns complete profile, active medicines, today's schedule, taken/missed/upcoming doses,
    medication history, notifications, and adherence breakdown.
    """
    patient = verify_caregiver_patient_access(patient_id, caregiver, db)
    today = get_current_app_time().date()

    # Active medicines
    medicines = db.query(Medicine).filter(
        Medicine.patient_id == patient.id,
        Medicine.is_active == True
    ).all()

    # Today's schedules
    today_schedules = db.query(MedicineSchedule).options(
        joinedload(MedicineSchedule.medicine)
    ).filter(
        MedicineSchedule.patient_id == patient.id,
        MedicineSchedule.scheduled_date == today
    ).order_by(MedicineSchedule.scheduled_time.asc()).all()

    taken_schedules = [s for s in today_schedules if s.status == "taken"]
    missed_schedules = [s for s in today_schedules if s.status == "missed"]
    upcoming_schedules = [s for s in today_schedules if s.status in ["upcoming", "due", "pending"]]

    # Medication history
    logs = db.query(MedicationLog).options(
        joinedload(MedicationLog.medicine)
    ).filter(
        MedicationLog.patient_id == patient.id
    ).order_by(MedicationLog.created_at.desc()).limit(100).all()

    # Notifications & Alerts
    notifs = db.query(Notification).filter(
        Notification.patient_id == patient.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

    alerts = [n for n in notifs if n.notification_type == "missed_alert"]

    # Adherence breakdown calculation
    total_logs = len(logs)
    taken_logs = sum(1 for l in logs if l.status == "taken")
    missed_logs = sum(1 for l in logs if l.status == "missed")
    if total_logs > 0:
        adherence_pct = round((taken_logs / total_logs) * 100.0, 1)
    elif (len(taken_schedules) + len(missed_schedules)) > 0:
        adherence_pct = round((len(taken_schedules) / (len(taken_schedules) + len(missed_schedules))) * 100.0, 1)
    else:
        adherence_pct = 100.0

    breakdown = {
        "total_logged": total_logs,
        "total_taken": taken_logs,
        "total_missed": missed_logs,
        "today_scheduled": len(today_schedules),
        "today_completed": len(taken_schedules)
    }

    return CaregiverPatientDetail(
        patient=PatientOut.model_validate(patient),
        active_medicines=[MedicineOut.model_validate(m) for m in medicines],
        today_schedules=[ScheduleOut.model_validate(s) for s in today_schedules],
        taken_schedules=[ScheduleOut.model_validate(s) for s in taken_schedules],
        missed_schedules=[ScheduleOut.model_validate(s) for s in missed_schedules],
        upcoming_schedules=[ScheduleOut.model_validate(s) for s in upcoming_schedules],
        medication_history=[MedicationLogOut.model_validate(l) for l in logs],
        notifications=[NotificationOut.model_validate(n) for n in notifs],
        active_alerts=[_build_alert_out(a) for a in alerts],
        adherence_percentage=adherence_pct,
        adherence_breakdown=breakdown
    )

@router.get("/patients/{patient_id}/history", response_model=List[MedicationLogOut])
def get_patient_medication_history(
    patient_id: int,
    status_filter: Optional[str] = Query(None, alias="status"),
    medicine_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db)
):
    """
    Filterable medication adherence history logs for an assigned patient.
    Allows filtering by status (taken/missed), specific medicine, and date ranges.
    Strictly verifies caregiver authorization (403 if unauthorized).
    """
    patient = verify_caregiver_patient_access(patient_id, caregiver, db)

    query = db.query(MedicationLog).options(
        joinedload(MedicationLog.medicine)
    ).filter(MedicationLog.patient_id == patient.id)

    if status_filter and status_filter.lower() in ["taken", "missed"]:
        query = query.filter(MedicationLog.status == status_filter.lower())

    if medicine_id:
        query = query.filter(MedicationLog.medicine_id == medicine_id)

    if start_date:
        query = query.filter(MedicationLog.scheduled_date >= start_date)

    if end_date:
        query = query.filter(MedicationLog.scheduled_date <= end_date)

    return query.order_by(MedicationLog.created_at.desc()).limit(200).all()

@router.patch("/alerts/{alert_id}", response_model=CaregiverAlertOut)
def update_alert_status(
    alert_id: int,
    update_data: AlertStatusUpdate,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db)
):
    """
    Caregiver marks an alert as 'reviewed' or 'resolved'.
    Strictly ensures the alert belongs to one of the caregiver's assigned patients.
    """
    alert = db.query(Notification).options(
        joinedload(Notification.patient),
        joinedload(Notification.medicine)
    ).filter(Notification.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")

    # Authorization check
    if alert.patient_id:
        verify_caregiver_patient_access(alert.patient_id, caregiver, db)

    new_status = update_data.status.strip().lower()
    if new_status not in ["reviewed", "resolved", "active", "acknowledged"]:
        raise HTTPException(status_code=400, detail="Invalid status. Allowed: 'reviewed', 'resolved', 'active'.")

    alert.status = new_status
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return _build_alert_out(alert)

@router.get("/alerts", response_model=List[CaregiverAlertOut])
def get_caregiver_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db)
):
    """
    List missed medicine alerts for all patients assigned to the caregiver.
    Can be filtered by alert status ('active', 'reviewed', 'resolved').
    """
    if caregiver.user and caregiver.user.role == UserRole.ADMIN:
        assigned_patients = db.query(Patient).all()
    else:
        assigned_patients = db.query(Patient).filter(Patient.caregiver_id == caregiver.id).all()

    assigned_ids = [p.id for p in assigned_patients]
    if not assigned_ids:
        return []

    query = db.query(Notification).options(
        joinedload(Notification.patient).joinedload(Patient.user),
        joinedload(Notification.medicine)
    ).filter(
        Notification.notification_type == "missed_alert",
        Notification.patient_id.in_(assigned_ids)
    )

    if status_filter:
        query = query.filter(Notification.status == status_filter.lower())

    alerts = query.order_by(Notification.created_at.desc()).limit(100).all()
    return [_build_alert_out(a) for a in alerts]

@router.put("/{caregiver_id}/assign-patient/{patient_id}", response_model=PatientOut)
def assign_patient_to_caregiver(
    caregiver_id: int,
    patient_id: int,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db)
):
    """Assign or reassign a patient to a caregiver."""
    target_caregiver = db.query(Caregiver).options(joinedload(Caregiver.user)).filter(Caregiver.id == caregiver_id).first()
    if not target_caregiver:
        raise HTTPException(status_code=404, detail=f"Caregiver #{caregiver_id} not found.")

    patient = db.query(Patient).options(joinedload(Patient.user)).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient #{patient_id} not found.")

    patient.caregiver_id = target_caregiver.id
    if target_caregiver.user:
        patient.caregiver_name = target_caregiver.user.full_name
        patient.caregiver_email = target_caregiver.user.email
        patient.caregiver_phone = target_caregiver.user.phone_number

    db.commit()
    db.refresh(patient)
    return patient

@router.put("/{caregiver_id}/unassign-patient/{patient_id}", response_model=PatientOut)
def unassign_patient_from_caregiver(
    caregiver_id: int,
    patient_id: int,
    caregiver: Caregiver = Depends(get_current_caregiver),
    db: Session = Depends(get_db)
):
    """Unassign a patient from a caregiver."""
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.caregiver_id == caregiver_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient #{patient_id} is not assigned to caregiver #{caregiver_id}.")

    patient.caregiver_id = None
    patient.caregiver_name = None
    patient.caregiver_email = None
    patient.caregiver_phone = None

    db.commit()
    db.refresh(patient)
    return patient

