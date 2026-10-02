from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)  # Male, Female, Other
    date_of_birth = Column(String(50), nullable=True)  # e.g., "1952-05-14"
    address = Column(Text, nullable=True)  # e.g., "742 Evergreen Terrace, Springfield"
    health_conditions = Column(Text, nullable=True)  # Comma-separated or text: e.g., "Hypertension, Type 2 Diabetes"
    allergies = Column(Text, nullable=True)  # e.g., "Penicillin, Sulfa drugs, Peanuts"
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    emergency_contact_relation = Column(String(100), nullable=True)
    caregiver_name = Column(String(255), nullable=True)
    caregiver_phone = Column(String(50), nullable=True)
    caregiver_email = Column(String(255), nullable=True)
    caregiver_id = Column(Integer, ForeignKey("caregivers.id", ondelete="SET NULL"), nullable=True)
    profile_photo = Column(Text, nullable=True)  # URL or data URI
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="patient_profile")
    caregiver = relationship("Caregiver", back_populates="patients")
    medicines = relationship("Medicine", back_populates="patient", cascade="all, delete-orphan")
    schedules = relationship("MedicineSchedule", back_populates="patient", cascade="all, delete-orphan")
    logs = relationship("MedicationLog", back_populates="patient", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="patient", cascade="all, delete-orphan")
