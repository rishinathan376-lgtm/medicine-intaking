from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Caregiver(Base):
    __tablename__ = "caregivers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    relationship_to_patient = Column(String(100), default="Family Member")  # e.g., Daughter, Son, Nurse, Spouse
    alternate_phone = Column(String(50), nullable=True)
    receive_email_alerts = Column(Boolean, default=True, nullable=False)
    receive_sms_alerts = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="caregiver_profile")
    patients = relationship("Patient", back_populates="caregiver")
