from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.schemas.user import UserOut

class PatientBase(BaseModel):
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    health_conditions: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    caregiver_name: Optional[str] = None
    caregiver_phone: Optional[str] = None
    caregiver_email: Optional[str] = None
    profile_photo: Optional[str] = None
    notes: Optional[str] = None

class PatientCreate(PatientBase):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone_number: str = Field(..., min_length=5, max_length=50)
    caregiver_id: Optional[int] = None

class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    health_conditions: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    caregiver_name: Optional[str] = None
    caregiver_phone: Optional[str] = None
    caregiver_email: Optional[str] = None
    caregiver_id: Optional[int] = None
    profile_photo: Optional[str] = None
    notes: Optional[str] = None

class PatientOut(PatientBase):
    id: int
    user_id: int
    caregiver_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True

from app.schemas.schedule import ScheduleOut

class PatientHomeScreenData(BaseModel):
    patient_id: int
    patient_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    profile_photo: Optional[str] = None
    caregiver_name: Optional[str] = None
    caregiver_phone: Optional[str] = None
    server_time: datetime
    formatted_date: str
    formatted_time: str
    active_reminder: Optional[ScheduleOut] = None
    next_medicine: Optional[ScheduleOut] = None
    today_schedules: list[ScheduleOut]
    today_total: int
    today_taken: int
    today_missed: int
    today_pending: int
    today_due: int
    unread_notifications_count: int
    adherence_percentage: float

    class Config:
        from_attributes = True

