from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class MedicineReminderTime(Base):
    __tablename__ = "medicine_reminder_times"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True)
    reminder_time = Column(String(20), nullable=False)  # e.g., "08:00", "14:00", "20:00"
    dose_label = Column(String(100), nullable=True)     # e.g., "Morning dose", "Afternoon dose", "Evening dose"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship back to Medicine
    medicine = relationship("Medicine", back_populates="reminder_times_rel")
