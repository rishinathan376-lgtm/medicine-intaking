from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.caregiver import Caregiver
from app.models.medicine import Medicine
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification
from app.schemas.user import UserOut

router = APIRouter(prefix="/admin", tags=["Admin Supervisory Operations"])

@router.get("/overview")
def get_system_overview(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Admin-only system overview:
    Returns global system statistics, user counts, and database health.
    Strictly protected: non-admins receive HTTP 403 Forbidden.
    """
    total_users = db.query(User).count()
    patients_count = db.query(User).filter(User.role == UserRole.PATIENT).count()
    caregivers_count = db.query(User).filter(User.role == UserRole.CAREGIVER).count()
    admins_count = db.query(User).filter(User.role == UserRole.ADMIN).count()
    medicines_count = db.query(Medicine).count()
    schedules_count = db.query(MedicineSchedule).count()
    logs_count = db.query(MedicationLog).count()
    alerts_count = db.query(Notification).filter(Notification.notification_type == "missed_alert").count()

    return {
        "status": "healthy",
        "system": "ElderMed Production Backend",
        "admin_user": current_admin.email,
        "metrics": {
            "total_users": total_users,
            "patients": patients_count,
            "caregivers": caregivers_count,
            "admins": admins_count,
            "total_medicines": medicines_count,
            "total_schedules": schedules_count,
            "total_medication_logs": logs_count,
            "total_missed_alerts": alerts_count
        }
    }

@router.get("/users", response_model=List[UserOut])
def list_system_users(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Retrieve all system user accounts.
    """
    return db.query(User).order_by(User.id.asc()).all()

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_system_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Permanently delete a user account and cascade to related profile records.
    """
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot delete their own active account."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User #{user_id} not found.")

    db.delete(user)
    db.commit()
    return None
