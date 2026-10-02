from datetime import date, datetime
from typing import List, Optional, Union
from pydantic import BaseModel, Field

class MedicineReminderTimeOut(BaseModel):
    id: int
    medicine_id: int
    reminder_time: str
    dose_label: Optional[str] = None

    class Config:
        from_attributes = True

class MedicineBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    medicine_type: str = Field(default="Tablet", description="Tablet, Capsule, Syrup, Injection, Drops, Inhaler, Patch, Ointment")
    dosage: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(default=30, ge=0)
    instructions: Optional[str] = None
    start_date: date = Field(default_factory=date.today)
    end_date: Optional[date] = None
    reminder_times: Union[List[str], str] = Field(..., description="List of times like ['08:00', '14:00', '20:00'] or string")
    frequency: str = Field(default="Once daily")
    before_after_food: str = Field(default="after_food")
    additional_notes: Optional[str] = None
    is_active: bool = True

class MedicineCreate(MedicineBase):
    patient_id: int

class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    medicine_type: Optional[str] = None
    dosage: Optional[str] = None
    quantity: Optional[int] = None
    instructions: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reminder_times: Optional[Union[List[str], str]] = None
    frequency: Optional[str] = None
    before_after_food: Optional[str] = None
    additional_notes: Optional[str] = None
    is_active: Optional[bool] = None

class MedicineOut(BaseModel):
    id: int
    patient_id: int
    name: str
    medicine_type: str
    dosage: str
    quantity: int
    instructions: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    frequency: str
    before_after_food: str
    additional_notes: Optional[str] = None
    is_active: bool
    reminder_times: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    reminder_times_rel: List[MedicineReminderTimeOut] = []
    times_list: List[str] = []

    class Config:
        from_attributes = True
