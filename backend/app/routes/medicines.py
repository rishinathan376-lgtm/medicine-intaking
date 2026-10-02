from datetime import date, datetime
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import get_current_user, verify_patient_data_access
from app.models.user import User, UserRole
from app.models.medicine import Medicine
from app.models.reminder_time import MedicineReminderTime
from app.models.schedule import MedicineSchedule
from app.models.patient import Patient
from app.schemas.medicine import MedicineCreate, MedicineUpdate, MedicineOut
from app.schemas.schedule import ScheduleOut
from app.services.reminder_service import ReminderService
from pydantic import BaseModel

router = APIRouter(prefix="/medicines", tags=["Medicines"])

class PatientMedicineOverview(BaseModel):
    today_schedules: List[ScheduleOut]
    upcoming_schedules: List[ScheduleOut]
    active_medicines: List[MedicineOut]
    completed_medicines: List[MedicineOut]

import re

TIME_REGEX = re.compile(r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")

def normalize_times(times_in: Union[List[str], str]) -> List[str]:
    """Parse, clean, format, and validate reminder times list."""
    if isinstance(times_in, list):
        raw = [t.strip() for t in times_in if t.strip()]
    elif isinstance(times_in, str):
        raw = [t.strip() for t in times_in.split(",") if t.strip()]
    else:
        raw = []

    validated = []
    for t in raw:
        parts = t.split(":")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            formatted = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
            if TIME_REGEX.match(formatted):
                if formatted not in validated:
                    validated.append(formatted)
                continue
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reminder time format '{t}'. Expected 24-hour time 'HH:MM' (00:00 to 23:59)."
        )
    return sorted(validated)

@router.get("", response_model=List[MedicineOut])
def get_medicines(
    patient_id: Optional[int] = None,
    status_filter: Optional[str] = Query("all", description="all, active, disabled, expired"),
    search: Optional[str] = Query(None, description="Search medicine name, type, or instructions"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch medicines list with optional patient, status, and search filters with privacy check."""
    query = db.query(Medicine).options(
        joinedload(Medicine.reminder_times_rel)
    )

    if current_user.role == UserRole.PATIENT:
        pt = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not pt:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        if patient_id and patient_id != pt.id:
            raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view another patient's medicines.")
        query = query.filter(Medicine.patient_id == pt.id)
    elif patient_id:
        verify_patient_data_access(patient_id, current_user, db)
        query = query.filter(Medicine.patient_id == patient_id)

    today = date.today()
    if status_filter == "active":
        query = query.filter(
            Medicine.is_active == True,
            (Medicine.end_date == None) | (Medicine.end_date >= today)
        )
    elif status_filter == "disabled":
        query = query.filter(Medicine.is_active == False)
    elif status_filter == "expired":
        query = query.filter(
            Medicine.end_date != None,
            Medicine.end_date < today
        )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                Medicine.name.ilike(term),
                Medicine.medicine_type.ilike(term),
                Medicine.instructions.ilike(term),
                Medicine.dosage.ilike(term),
            )
        )

    return query.order_by(Medicine.is_active.desc(), Medicine.name.asc()).all()

@router.post("", response_model=MedicineOut, status_code=status.HTTP_201_CREATED)
def create_medicine(
    med_in: MedicineCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new medicine prescription for a patient with multiple reminder times."""
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == med_in.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Patient with ID {med_in.patient_id} not found."
        )

    # Authorization verification
    verify_patient_data_access(med_in.patient_id, current_user, db)

    # Date validation: end_date cannot be earlier than start_date
    if med_in.end_date and med_in.end_date < med_in.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Medicine end_date cannot be earlier than start_date."
        )

    parsed_times = normalize_times(med_in.reminder_times)
    if not parsed_times:
        raise HTTPException(status_code=400, detail="At least one valid reminder time is required (e.g. '08:00').")

    cached_string = ", ".join(parsed_times)

    medicine = Medicine(
        patient_id=med_in.patient_id,
        name=med_in.name,
        medicine_type=med_in.medicine_type,
        dosage=med_in.dosage,
        quantity=med_in.quantity,
        instructions=med_in.instructions,
        start_date=med_in.start_date,
        end_date=med_in.end_date,
        frequency=med_in.frequency,
        before_after_food=med_in.before_after_food,
        additional_notes=med_in.additional_notes,
        is_active=med_in.is_active,
        reminder_times=cached_string
    )
    db.add(medicine)
    db.flush()

    # Create relational MedicineReminderTime records
    for t in parsed_times:
        db.add(MedicineReminderTime(
            medicine_id=medicine.id,
            reminder_time=t,
            dose_label=f"Dose at {t}"
        ))

    db.commit()
    db.refresh(medicine)

    # Immediately generate today's schedule for this new medicine
    ReminderService.generate_daily_schedules(db)

    return medicine

@router.get("/{medicine_id}", response_model=MedicineOut)
def get_medicine(
    medicine_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get single medicine by ID with privacy authorization check."""
    medicine = db.query(Medicine).options(
        joinedload(Medicine.reminder_times_rel)
    ).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    verify_patient_data_access(medicine.patient_id, current_user, db)
    return medicine

@router.put("/{medicine_id}", response_model=MedicineOut)
def update_medicine(
    medicine_id: int, 
    med_in: MedicineUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update medicine prescription details, dosage, instructions, and reminder times."""
    medicine = db.query(Medicine).options(
        joinedload(Medicine.reminder_times_rel)
    ).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    verify_patient_data_access(medicine.patient_id, current_user, db)

    update_data = med_in.model_dump(exclude_unset=True)

    # Date validation: end_date cannot be earlier than start_date
    eff_start = update_data.get("start_date", medicine.start_date)
    eff_end = update_data.get("end_date", medicine.end_date)
    if eff_end and eff_start and eff_end < eff_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Medicine end_date cannot be earlier than start_date."
        )

    # If reminder_times was provided, update relational records
    if "reminder_times" in update_data:
        raw_times = update_data.pop("reminder_times")
        if raw_times is not None:
            parsed_times = normalize_times(raw_times)
            if parsed_times:
                # Delete existing reminder times
                db.query(MedicineReminderTime).filter(MedicineReminderTime.medicine_id == medicine.id).delete()
                # Insert updated reminder times
                for t in parsed_times:
                    db.add(MedicineReminderTime(
                        medicine_id=medicine.id,
                        reminder_time=t,
                        dose_label=f"Dose at {t}"
                    ))
                medicine.reminder_times = ", ".join(parsed_times)

    for field, value in update_data.items():
        setattr(medicine, field, value)

    db.commit()
    db.refresh(medicine)

    # Regenerate schedules
    ReminderService.generate_daily_schedules(db)
    return medicine

@router.patch("/{medicine_id}/toggle", response_model=MedicineOut)
def toggle_medicine_active(
    medicine_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enable or disable a medicine prescription."""
    medicine = db.query(Medicine).options(
        joinedload(Medicine.reminder_times_rel)
    ).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    verify_patient_data_access(medicine.patient_id, current_user, db)

    medicine.is_active = not medicine.is_active
    db.commit()
    db.refresh(medicine)

    # If enabled, ensure today's schedule is generated
    if medicine.is_active:
        ReminderService.generate_daily_schedules(db)
    return medicine

@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medicine(
    medicine_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently delete a medicine prescription and associated schedules/logs."""
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    verify_patient_data_access(medicine.patient_id, current_user, db)

    db.delete(medicine)
    db.commit()
    return None

@router.get("/patient/{patient_id}/overview", response_model=PatientMedicineOverview)
def get_patient_medicine_overview(
    patient_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get complete patient medicine view:
    - Today's Medicines (scheduled for today)
    - Upcoming Medicines (pending today)
    - Active Medicines (active prescriptions)
    - Completed/Expired Medicines
    """
    verify_patient_data_access(patient_id, current_user, db)

    today = date.today()
    ReminderService.generate_daily_schedules(db, target_date=today)

    # 1. Today's schedules
    today_schedules = db.query(MedicineSchedule).options(
        joinedload(MedicineSchedule.medicine)
    ).filter(
        MedicineSchedule.patient_id == patient_id,
        MedicineSchedule.scheduled_date == today
    ).order_by(MedicineSchedule.scheduled_time.asc()).all()

    upcoming_schedules = [s for s in today_schedules if s.status == "pending"]

    # 2. All medicines for patient
    all_meds = db.query(Medicine).options(
        joinedload(Medicine.reminder_times_rel)
    ).filter(
        Medicine.patient_id == patient_id
    ).all()

    active_meds = [
        m for m in all_meds
        if m.is_active and (m.end_date is None or m.end_date >= today)
    ]

    completed_meds = [
        m for m in all_meds
        if not m.is_active or (m.end_date is not None and m.end_date < today)
    ]

    return PatientMedicineOverview(
        today_schedules=[ScheduleOut.model_validate(s) for s in today_schedules],
        upcoming_schedules=[ScheduleOut.model_validate(s) for s in upcoming_schedules],
        active_medicines=[MedicineOut.model_validate(m) for m in active_meds],
        completed_medicines=[MedicineOut.model_validate(m) for m in completed_meds]
    )
