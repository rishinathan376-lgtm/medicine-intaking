from datetime import datetime, date, timezone
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("medicine_schedules.id", ondelete="SET NULL"), nullable=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(30), nullable=False)  # "taken", "missed"
    scheduled_date = Column(Date, nullable=True, index=True)
    scheduled_time = Column(String(50), nullable=False)
    actual_taken_time = Column(DateTime, nullable=True)
    caregiver_notes = Column(Text, nullable=True)
    patient_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    schedule = relationship("MedicineSchedule", back_populates="log")
    medicine = relationship("Medicine", back_populates="logs")
    patient = relationship("Patient", back_populates="logs")
