from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.medicine import MedicineOut

class ScheduleActionRequest(BaseModel):
    action: str  # "taken" or "missed"
    patient_notes: Optional[str] = None
    caregiver_notes: Optional[str] = None

class ScheduleOut(BaseModel):
    id: int
    medicine_id: int
    patient_id: int
    scheduled_date: date
    scheduled_time: str
    status: str  # upcoming, due, taken, missed
    taken_at: Optional[datetime] = None
    notified_caregiver: bool
    reminder_sent_at: Optional[datetime] = None
    created_at: datetime
    medicine: Optional[MedicineOut] = None

    class Config:
        from_attributes = True
