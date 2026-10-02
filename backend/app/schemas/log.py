from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel
from app.schemas.medicine import MedicineOut

class MedicationLogCreate(BaseModel):
    schedule_id: Optional[int] = None
    medicine_id: int
    patient_id: int
    status: str  # "taken", "missed"
    scheduled_date: Optional[date] = None
    scheduled_time: str
    actual_taken_time: Optional[datetime] = None
    caregiver_notes: Optional[str] = None
    patient_notes: Optional[str] = None

class MedicationLogOut(BaseModel):
    id: int
    schedule_id: Optional[int] = None
    medicine_id: int
    patient_id: int
    status: str
    scheduled_date: Optional[date] = None
    scheduled_time: str
    actual_taken_time: Optional[datetime] = None
    caregiver_notes: Optional[str] = None
    patient_notes: Optional[str] = None
    created_at: datetime
    medicine: Optional[MedicineOut] = None

    class Config:
        from_attributes = True
