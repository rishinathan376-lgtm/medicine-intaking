from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.caregiver import Caregiver
from app.schemas.user import UserCreate, UserLogin, UserOut, Token

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user (Patient, Caregiver, or Admin) and initialize profile."""
    existing_user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Hash password securely
    hashed_pwd = get_password_hash(user_in.password)

    user = User(
        email=user_in.email.lower(),
        hashed_password=hashed_pwd,
        full_name=user_in.full_name,
        role=user_in.role,
        phone_number=user_in.phone_number,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize appropriate profile
    if user.role == UserRole.PATIENT:
        patient = Patient(user_id=user.id, emergency_contact_name="Family Member")
        db.add(patient)
    elif user.role == UserRole.CAREGIVER:
        caregiver = Caregiver(user_id=user.id)
        db.add(caregiver)
    db.commit()

    token = create_access_token(subject=user.id, role=user.role.value)
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user with email and password."""
    user = db.query(User).filter(User.email == login_data.email.lower()).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated."
        )

    token = create_access_token(subject=user.id, role=user.role.value)
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))

from app.core.dependencies import get_current_user

@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get the profile of the currently authenticated user."""
    return UserOut.model_validate(current_user)

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    Logout the authenticated user.
    Stateless JWT client should discard the token; endpoint acknowledges clean logout.
    """
    return {"message": "Successfully logged out.", "email": current_user.email}
