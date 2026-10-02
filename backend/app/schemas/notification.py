from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.medicine import MedicineOut

class NotificationOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    patient_id: Optional[int] = None
    medicine_id: Optional[int] = None
    schedule_id: Optional[int] = None
    title: str
    message: str
    notification_type: str  # reminder, due_alert, missed_alert, emergency, general
    channel: str  # in_app, email
    status: str  # unread, read, active, acknowledged, resolved
    scheduled_time: Optional[str] = None
    missed_at: Optional[datetime] = None
    is_read: bool
    sent_at: Optional[datetime] = None
    created_at: datetime
    patient_name: Optional[str] = None
    medicine_name: Optional[str] = None

    class Config:
        from_attributes = True

class CaregiverAlertOut(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    medicine_id: Optional[int] = None
    medicine_name: str
    dosage: Optional[str] = None
    scheduled_time: str
    status: str  # missed, pending_confirmation
    missed_at: Optional[datetime] = None
    alert_status: str  # active, acknowledged, resolved
    caregiver_name: Optional[str] = None
    caregiver_email: Optional[str] = None
    caregiver_phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
