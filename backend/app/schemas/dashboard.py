from typing import List, Optional
from pydantic import BaseModel
from app.schemas.patient import PatientOut
from app.schemas.schedule import ScheduleOut
from app.schemas.log import MedicationLogOut

class RecentActivityItem(BaseModel):
    id: int
    title: str
    description: str
    timestamp: str
    type: str  # "taken", "missed", "alert", "added"
    badge_color: str

class DashboardSummary(BaseModel):
    total_medicines: int
    today_total: int
    taken_count: int
    missed_count: int
    upcoming_count: int
    adherence_percentage: float
    patient: Optional[PatientOut] = None
    today_schedules: List[ScheduleOut] = []
    recent_activities: List[RecentActivityItem] = []
