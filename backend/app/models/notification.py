from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=True)
    schedule_id = Column(Integer, ForeignKey("medicine_schedules.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="reminder", nullable=False)  # reminder, due_alert, missed_alert, emergency, general
    channel = Column(String(30), default="in_app", nullable=False)  # in_app, email
    status = Column(String(30), default="unread", nullable=False)  # unread, read, active, acknowledged, resolved
    scheduled_time = Column(String(50), nullable=True)
    missed_at = Column(DateTime, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    sent_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
    patient = relationship("Patient", back_populates="notifications")
    medicine = relationship("Medicine", back_populates="notifications")
    schedule = relationship("MedicineSchedule", back_populates="notifications")
