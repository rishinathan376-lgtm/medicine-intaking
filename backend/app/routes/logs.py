from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import get_current_user, verify_patient_data_access
from app.models.user import User, UserRole
from app.models.log import MedicationLog
from app.models.patient import Patient
from app.schemas.log import MedicationLogOut

router = APIRouter(prefix="/logs", tags=["Medication History"])

@router.get("", response_model=List[MedicationLogOut])
def get_medication_logs(
    patient_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve historical medication adherence logs with privacy check."""
    query = db.query(MedicationLog).options(joinedload(MedicationLog.medicine))

    if current_user.role == UserRole.PATIENT:
        pt = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not pt:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        if patient_id and patient_id != pt.id:
            raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view another patient's medication logs.")
        query = query.filter(MedicationLog.patient_id == pt.id)
    elif patient_id:
        verify_patient_data_access(patient_id, current_user, db)
        query = query.filter(MedicationLog.patient_id == patient_id)
    else:
        patient = db.query(Patient).first()
        if patient:
            query = query.filter(MedicationLog.patient_id == patient.id)

    if status_filter and status_filter.lower() in ["taken", "missed"]:
        query = query.filter(MedicationLog.status == status_filter.lower())

    return query.order_by(MedicationLog.created_at.desc()).limit(limit).all()

