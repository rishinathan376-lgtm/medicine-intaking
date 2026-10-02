from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.dependencies import get_current_user, verify_patient_data_access
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.medicine import Medicine
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification
from app.schemas.patient import PatientOut, PatientCreate, PatientUpdate, PatientHomeScreenData
from app.schemas.dashboard import DashboardSummary, RecentActivityItem
from app.schemas.schedule import ScheduleOut
from app.services.reminder_service import ReminderService, get_current_app_time

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=List[PatientOut])
def get_patients(
    search: Optional[str] = Query(None, description="Search by name, phone, email, or health conditions"),
    db: Session = Depends(get_db)
):
    """List all registered patients with optional search filter."""
    query = db.query(Patient).join(Patient.user).options(joinedload(Patient.user))

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(term),
                User.phone_number.ilike(term),
                User.email.ilike(term),
                Patient.health_conditions.ilike(term),
                Patient.emergency_contact_name.ilike(term),
                Patient.caregiver_name.ilike(term),
            )
        )

    return query.order_by(User.full_name.asc()).all()

@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    """Create a new patient with account, emergency contacts, and caregiver details."""
    # Check if email is already taken
    existing_user = db.query(User).filter(User.email == patient_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{patient_in.email}' already exists."
        )

    # 1. Create User account
    user = User(
        email=patient_in.email.lower(),
        full_name=patient_in.full_name,
        phone_number=patient_in.phone_number,
        role=UserRole.PATIENT,
        hashed_password=get_password_hash("Patient123!"),
        is_active=True
    )
    db.add(user)
    db.flush()

    # 2. Create Patient profile
    patient = Patient(
        user_id=user.id,
        age=patient_in.age,
        gender=patient_in.gender,
        date_of_birth=patient_in.date_of_birth,
        address=patient_in.address,
        health_conditions=patient_in.health_conditions,
        allergies=patient_in.allergies,
        emergency_contact_name=patient_in.emergency_contact_name,
        emergency_contact_phone=patient_in.emergency_contact_phone,
        emergency_contact_relation=patient_in.emergency_contact_relation,
        caregiver_name=patient_in.caregiver_name,
        caregiver_phone=patient_in.caregiver_phone,
        caregiver_email=patient_in.caregiver_email,
        caregiver_id=patient_in.caregiver_id,
        profile_photo=patient_in.profile_photo,
        notes=patient_in.notes
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    db.refresh(user)

    return patient

@router.get("/primary", response_model=PatientOut)
def get_primary_patient(db: Session = Depends(get_db)):
    """Fetch the primary patient profile for default dashboard presentation."""
    patient = db.query(Patient).options(joinedload(Patient.user)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="No patient found in the system.")
    return patient

@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch complete patient profile by ID with strict patient privacy check."""
    patient = verify_patient_data_access(patient_id, current_user, db)
    return patient

@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int, 
    patient_in: PatientUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update patient information and user contact details."""
    patient = verify_patient_data_access(patient_id, current_user, db)

    update_dict = patient_in.model_dump(exclude_unset=True)

    # Synchronize User fields if updated
    if "full_name" in update_dict and patient.user:
        patient.user.full_name = update_dict.pop("full_name")
    if "email" in update_dict and patient.user:
        email_val = update_dict.pop("email")
        if email_val:
            # Check for conflict
            conflict = db.query(User).filter(User.email == email_val.lower(), User.id != patient.user_id).first()
            if conflict:
                raise HTTPException(status_code=400, detail="This email is already in use by another user.")
            patient.user.email = email_val.lower()
    if "phone_number" in update_dict and patient.user:
        patient.user.phone_number = update_dict.pop("phone_number")

    # Update Patient fields
    for field, val in update_dict.items():
        setattr(patient, field, val)

    db.commit()
    db.refresh(patient)
    return patient

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a patient record and cascade to related data."""
    patient = verify_patient_data_access(patient_id, current_user, db)

    user = db.query(User).filter(User.id == patient.user_id).first()
    db.delete(patient)
    if user:
        db.delete(user)
    db.commit()
    return None

@router.get("/{patient_id}/dashboard", response_model=DashboardSummary)
def get_patient_dashboard(
    patient_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the complete dashboard overview specific to a single patient with privacy check."""
    patient = verify_patient_data_access(patient_id, current_user, db)
    today = date.today()
    ReminderService.process_reminder_lifecycle(db)

    # Patient's active medicines
    total_medicines = db.query(Medicine).filter(
        Medicine.patient_id == patient.id,
        Medicine.is_active == True
    ).count()

    # Today's schedules for this patient
    today_schedules = db.query(MedicineSchedule).options(
        joinedload(MedicineSchedule.medicine)
    ).filter(
        MedicineSchedule.patient_id == patient.id,
        MedicineSchedule.scheduled_date == today
    ).order_by(MedicineSchedule.scheduled_time.asc()).all()

    today_total = len(today_schedules)
    taken_count = sum(1 for s in today_schedules if s.status == "taken")
    missed_count = sum(1 for s in today_schedules if s.status == "missed")
    upcoming_count = sum(1 for s in today_schedules if s.status in ["upcoming", "pending"])

    # Adherence percentage
    all_logs = db.query(MedicationLog).filter(MedicationLog.patient_id == patient.id).all()
    total_logged = len(all_logs)
    taken_logged = sum(1 for l in all_logs if l.status == "taken")
    if total_logged > 0:
        adherence_percentage = round((taken_logged / total_logged) * 100, 1)
    elif today_total > 0 and (taken_count + missed_count) > 0:
        adherence_percentage = round((taken_count / (taken_count + missed_count)) * 100, 1)
    else:
        adherence_percentage = 100.0

    # Recent activities
    recent_logs = db.query(MedicationLog).filter(
        MedicationLog.patient_id == patient.id
    ).order_by(MedicationLog.created_at.desc()).limit(10).all()

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

    return DashboardSummary(
        total_medicines=total_medicines,
        today_total=today_total,
        taken_count=taken_count,
        missed_count=missed_count,
        upcoming_count=upcoming_count,
        adherence_percentage=adherence_percentage,
        patient=PatientOut.model_validate(patient),
        today_schedules=[ScheduleOut.model_validate(s) for s in today_schedules],
        recent_activities=activities
    )

@router.get("/{patient_id}/reminder-home", response_model=PatientHomeScreenData)
def get_patient_reminder_home(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete Patient Reminder Home Screen Data:
    Returns patient profile, current live date & time, active due reminder,
    next upcoming medicine, chronological schedule with statuses,
    unread notification count, and adherence rate.
    Strictly authorized to the patient or assigned caregiver (403 if unauthorized).
    """
    patient = verify_patient_data_access(patient_id, current_user, db)
    now = get_current_app_time()
    today = now.date()

    # Run lifecycle check to guarantee statuses (due, upcoming, missed) are fresh
    ReminderService.process_reminder_lifecycle(db)

    # Chronological today's schedules
    today_schedules = db.query(MedicineSchedule).options(
        joinedload(MedicineSchedule.medicine)
    ).filter(
        MedicineSchedule.patient_id == patient.id,
        MedicineSchedule.scheduled_date == today
    ).order_by(MedicineSchedule.scheduled_time.asc()).all()

    today_total = len(today_schedules)
    today_taken = sum(1 for s in today_schedules if s.status == "taken")
    today_missed = sum(1 for s in today_schedules if s.status == "missed")
    today_due = sum(1 for s in today_schedules if s.status == "due")
    today_pending = sum(1 for s in today_schedules if s.status in ["upcoming", "pending"])

    # Active reminder: first dose with status 'due'
    active_reminder = next((s for s in today_schedules if s.status == "due"), None)

    # Next medicine: next upcoming or pending dose
    next_medicine = next((s for s in today_schedules if s.status in ["upcoming", "pending"]), None)
    if not next_medicine and active_reminder:
        next_medicine = active_reminder

    # Unread notifications count
    unread_count = db.query(Notification).filter(
        Notification.patient_id == patient.id,
        Notification.is_read == False
    ).count()

    # Adherence percentage from actual logs
    all_logs = db.query(MedicationLog).filter(MedicationLog.patient_id == patient.id).all()
    if all_logs:
        adherence_pct = round((sum(1 for l in all_logs if l.status == "taken") / len(all_logs)) * 100.0, 1)
    elif today_total > 0 and (today_taken + today_missed) > 0:
        adherence_pct = round((today_taken / (today_taken + today_missed)) * 100.0, 1)
    else:
        adherence_pct = 100.0

    p_name = patient.user.full_name if patient.user else f"Patient #{patient.id}"

    return PatientHomeScreenData(
        patient_id=patient.id,
        patient_name=p_name,
        age=patient.age,
        gender=patient.gender,
        profile_photo=patient.profile_photo,
        caregiver_name=patient.caregiver_name,
        caregiver_phone=patient.caregiver_phone,
        server_time=now,
        formatted_date=now.strftime("%A, %B %d, %Y"),
        formatted_time=now.strftime("%I:%M %p"),
        active_reminder=ScheduleOut.model_validate(active_reminder) if active_reminder else None,
        next_medicine=ScheduleOut.model_validate(next_medicine) if next_medicine else None,
        today_schedules=[ScheduleOut.model_validate(s) for s in today_schedules],
        today_total=today_total,
        today_taken=today_taken,
        today_missed=today_missed,
        today_pending=today_pending,
        today_due=today_due,
        unread_notifications_count=unread_count,
        adherence_percentage=adherence_pct
    )

