from datetime import datetime, date, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), index=True, nullable=False)
    medicine_type = Column(String(50), default="Tablet", nullable=False)  # Tablet, Capsule, Syrup, Injection, Drops, Inhaler, Patch, Ointment
    dosage = Column(String(100), nullable=False)  # e.g., "500 mg", "1 Tablet", "10 ml"
    quantity = Column(Integer, default=30, nullable=False)  # Total/remaining quantity
    instructions = Column(Text, nullable=True)  # e.g., "Take with a full glass of water"
    start_date = Column(Date, default=date.today, nullable=False)
    end_date = Column(Date, nullable=True)
    frequency = Column(String(100), default="Once daily", nullable=False)  # "Once daily", "Twice daily", "3 times daily", etc.
    before_after_food = Column(String(50), default="after_food", nullable=False)  # "before_food", "after_food", "with_food", "none"
    additional_notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    reminder_times = Column(String(255), nullable=True)  # Cached string representation e.g. "08:00, 20:00"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    patient = relationship("Patient", back_populates="medicines")
    reminder_times_rel = relationship(
        "MedicineReminderTime",
        back_populates="medicine",
        cascade="all, delete-orphan",
        lazy="joined",
        order_by="MedicineReminderTime.reminder_time.asc()"
    )
    schedules = relationship("MedicineSchedule", back_populates="medicine", cascade="all, delete-orphan")
    logs = relationship("MedicationLog", back_populates="medicine", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="medicine", cascade="all, delete-orphan")

    @property
    def times_list(self):
        """Return list of reminder time strings from relational records."""
        if self.reminder_times_rel:
            return [r.reminder_time for r in self.reminder_times_rel]
        elif self.reminder_times:
            return [t.strip() for t in self.reminder_times.split(",") if t.strip()]
        return []
