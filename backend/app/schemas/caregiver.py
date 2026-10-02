from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.schemas.patient import PatientOut
from app.schemas.medicine import MedicineOut
from app.schemas.schedule import ScheduleOut
from app.schemas.log import MedicationLogOut
from app.schemas.notification import NotificationOut, CaregiverAlertOut

class NextMedicineInfo(BaseModel):
    name: str
    dosage: str
    scheduled_time: str
    before_after_food: Optional[str] = None
    instructions: Optional[str] = None

class LastMedicationInfo(BaseModel):
    name: str
    status: str  # "taken", "missed"
    scheduled_time: str
    actual_taken_time: Optional[datetime] = None

class CaregiverPatientSummary(BaseModel):
    patient_id: int
    patient_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    profile_photo: Optional[str] = None
    health_conditions: Optional[str] = None
    allergies: Optional[str] = None
    today_total: int
    today_taken: int
    today_missed: int
    today_pending: int
    today_status_summary: str
    next_medicine: Optional[NextMedicineInfo] = None
    last_medication_status: Optional[LastMedicationInfo] = None
    adherence_percentage: float
    active_alerts_count: int

    class Config:
        from_attributes = True

class CaregiverDashboardSummary(BaseModel):
    caregiver_id: int
    caregiver_name: str
    caregiver_email: str
    relationship: Optional[str] = None
    total_assigned_patients: int
    total_scheduled_today: int
    total_taken_today: int
    total_missed_today: int
    total_pending_today: int
    overall_adherence_percentage: float
    assigned_patients: List[CaregiverPatientSummary]
    missed_alerts: List[CaregiverAlertOut]
    recent_notifications: List[NotificationOut]

    class Config:
        from_attributes = True

class CaregiverPatientDetail(BaseModel):
    patient: PatientOut
    active_medicines: List[MedicineOut]
    today_schedules: List[ScheduleOut]
    taken_schedules: List[ScheduleOut]
    missed_schedules: List[ScheduleOut]
    upcoming_schedules: List[ScheduleOut]
    medication_history: List[MedicationLogOut]
    notifications: List[NotificationOut]
    active_alerts: List[CaregiverAlertOut]
    adherence_percentage: float
    adherence_breakdown: Dict[str, Any]

    class Config:
        from_attributes = True

class AlertStatusUpdate(BaseModel):
    status: str  # "reviewed", "resolved", "active"
    notes: Optional[str] = None
