from datetime import datetime, date, timezone
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class MedicineSchedule(Base):
    __tablename__ = "medicine_schedules"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    scheduled_date = Column(Date, default=date.today, nullable=False, index=True)
    scheduled_time = Column(String(20), nullable=False)  # "08:00", "13:00", "20:00"
    status = Column(String(30), default="upcoming", nullable=False, index=True)  # upcoming, due, taken, missed
    taken_at = Column(DateTime, nullable=True)
    notified_caregiver = Column(Boolean, default=False, nullable=False)
    reminder_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    medicine = relationship("Medicine", back_populates="schedules")
    patient = relationship("Patient", back_populates="schedules")
    log = relationship("MedicationLog", back_populates="schedule", uselist=False)
    notifications = relationship("Notification", back_populates="schedule", cascade="all, delete-orphan")
