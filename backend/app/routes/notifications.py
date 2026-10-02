from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import get_current_user, verify_patient_data_access
from app.models.user import User, UserRole
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.medicine import Medicine
from app.schemas.notification import NotificationOut, CaregiverAlertOut

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def _enrich_notification(notif: Notification) -> NotificationOut:
    p_name = None
    if notif.patient and notif.patient.user:
        p_name = notif.patient.user.full_name
    m_name = notif.medicine.name if notif.medicine else None

    return NotificationOut(
        id=notif.id,
        user_id=notif.user_id,
        patient_id=notif.patient_id,
        medicine_id=notif.medicine_id,
        schedule_id=notif.schedule_id,
        title=notif.title,
        message=notif.message,
        notification_type=notif.notification_type,
        channel=notif.channel,
        status=notif.status,
        scheduled_time=notif.scheduled_time,
        missed_at=notif.missed_at,
        is_read=notif.is_read,
        sent_at=notif.sent_at,
        created_at=notif.created_at,
        patient_name=p_name,
        medicine_name=m_name
    )

@router.get("", response_model=List[NotificationOut])
def get_notifications(
    patient_id: Optional[int] = None,
    notification_type: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List recent notifications and alerts with privacy validation."""
    query = db.query(Notification).options(
        joinedload(Notification.patient).joinedload(Patient.user),
        joinedload(Notification.medicine)
    )

    if current_user.role == UserRole.PATIENT:
        pt = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not pt:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        if patient_id and patient_id != pt.id:
            raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view another patient's notifications.")
        query = query.filter(Notification.patient_id == pt.id)
    elif patient_id:
        verify_patient_data_access(patient_id, current_user, db)
        query = query.filter(Notification.patient_id == patient_id)

    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    notifs = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return [_enrich_notification(n) for n in notifs]

@router.get("/alerts", response_model=List[CaregiverAlertOut])
def get_caregiver_alerts(
    patient_id: Optional[int] = None, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve all Caregiver Alerts for missed or critical medication events.
    Displays patient name, medicine name, dosage, scheduled time, time of missed reminder,
    alert status, and caregiver contact info.
    """
    query = db.query(Notification).options(
        joinedload(Notification.patient).joinedload(Patient.user),
        joinedload(Notification.medicine)
    ).filter(Notification.notification_type == "missed_alert")

    if current_user.role == UserRole.PATIENT:
        pt = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not pt:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        if patient_id and patient_id != pt.id:
            raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view another patient's alerts.")
        query = query.filter(Notification.patient_id == pt.id)
    elif patient_id:
        verify_patient_data_access(patient_id, current_user, db)
        query = query.filter(Notification.patient_id == patient_id)

    alerts = query.order_by(Notification.created_at.desc()).limit(100).all()

    result = []
    for a in alerts:
        p_name = a.patient.user.full_name if (a.patient and a.patient.user) else "Unknown Patient"
        m_name = a.medicine.name if a.medicine else "Medication"
        m_dose = a.medicine.dosage if a.medicine else None
        c_name = a.patient.caregiver_name if a.patient else None
        c_email = a.patient.caregiver_email if a.patient else None
        c_phone = a.patient.caregiver_phone if a.patient else None

        result.append(CaregiverAlertOut(
            id=a.id,
            patient_id=a.patient_id or 0,
            patient_name=p_name,
            medicine_id=a.medicine_id,
            medicine_name=m_name,
            dosage=m_dose,
            scheduled_time=a.scheduled_time or "N/A",
            status="missed",
            missed_at=a.missed_at or a.created_at,
            alert_status=a.status,
            caregiver_name=c_name,
            caregiver_email=c_email,
            caregiver_phone=c_phone,
            created_at=a.created_at
        ))
    return result

@router.get("/patient/{patient_id}/due", response_model=List[NotificationOut])
def get_patient_due_reminders(
    patient_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve active due reminders awaiting intake confirmation for the given patient."""
    verify_patient_data_access(patient_id, current_user, db)

    due_notifs = db.query(Notification).options(
        joinedload(Notification.patient).joinedload(Patient.user),
        joinedload(Notification.medicine)
    ).filter(
        Notification.patient_id == patient_id,
        Notification.notification_type == "reminder",
        Notification.status == "unread"
    ).order_by(Notification.created_at.desc()).all()

    return [_enrich_notification(n) for n in due_notifs]

@router.put("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if notif.patient_id:
        verify_patient_data_access(notif.patient_id, current_user, db)
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return _enrich_notification(notif)

@router.patch("/{notification_id}/acknowledge", response_model=NotificationOut)
def acknowledge_alert(
    notification_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Acknowledge caregiver alert."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if notif.patient_id:
        verify_patient_data_access(notif.patient_id, current_user, db)
    notif.status = "acknowledged"
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return _enrich_notification(notif)

@router.put("/patient/{patient_id}/read-all")
def mark_all_patient_notifications_read(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all unread notifications for a patient as read."""
    verify_patient_data_access(patient_id, current_user, db)
    updated_count = db.query(Notification).filter(
        Notification.patient_id == patient_id,
        Notification.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read.", "updated_count": updated_count}

