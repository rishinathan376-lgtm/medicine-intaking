from datetime import date, datetime, timedelta, timezone
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.caregiver import Caregiver
from app.models.medicine import Medicine
from app.models.reminder_time import MedicineReminderTime
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification

def migrate_schema():
    """Ensure any newly added columns and tables exist without data loss."""
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        inspector = inspect(engine)
        
        # 1. Patients table columns
        existing_patient_cols = [c["name"] for c in inspector.get_columns("patients")]
        patient_cols = [
            ("date_of_birth", "VARCHAR(50)"),
            ("address", "TEXT"),
            ("allergies", "TEXT"),
            ("caregiver_name", "VARCHAR(255)"),
            ("caregiver_phone", "VARCHAR(50)"),
            ("caregiver_email", "VARCHAR(255)"),
            ("profile_photo", "TEXT"),
        ]
        for col_name, col_type in patient_cols:
            if col_name not in existing_patient_cols:
                try:
                    conn.execute(text(f"ALTER TABLE patients ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    print(f"Added column '{col_name}' to patients table.")
                except Exception as e:
                    print(f"Migration note for patients.{col_name}: {e}")

        # 2. Medicines table columns
        existing_med_cols = [c["name"] for c in inspector.get_columns("medicines")]
        if "medicine_type" not in existing_med_cols:
            try:
                conn.execute(text("ALTER TABLE medicines ADD COLUMN medicine_type VARCHAR(50) DEFAULT 'Tablet'"))
                conn.commit()
                print("Added column 'medicine_type' to medicines table.")
            except Exception as e:
                print(f"Migration note for medicines.medicine_type: {e}")

        # 3. Medicine Schedules table columns
        existing_sched_cols = [c["name"] for c in inspector.get_columns("medicine_schedules")]
        if "reminder_sent_at" not in existing_sched_cols:
            try:
                conn.execute(text("ALTER TABLE medicine_schedules ADD COLUMN reminder_sent_at DATETIME"))
                conn.commit()
                print("Added column 'reminder_sent_at' to medicine_schedules table.")
            except Exception as e:
                print(f"Migration note for medicine_schedules.reminder_sent_at: {e}")

        # 4. Medication Logs table columns
        existing_log_cols = [c["name"] for c in inspector.get_columns("medication_logs")]
        if "scheduled_date" not in existing_log_cols:
            try:
                conn.execute(text("ALTER TABLE medication_logs ADD COLUMN scheduled_date DATE"))
                conn.commit()
                print("Added column 'scheduled_date' to medication_logs table.")
            except Exception as e:
                print(f"Migration note for medication_logs.scheduled_date: {e}")

        # 5. Notifications table columns
        existing_notif_cols = [c["name"] for c in inspector.get_columns("notifications")]
        notif_cols = [
            ("medicine_id", "INTEGER"),
            ("schedule_id", "INTEGER"),
            ("status", "VARCHAR(30) DEFAULT 'unread'"),
            ("scheduled_time", "VARCHAR(50)"),
            ("missed_at", "DATETIME"),
        ]
        for col_name, col_type in notif_cols:
            if col_name not in existing_notif_cols:
                try:
                    conn.execute(text(f"ALTER TABLE notifications ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    print(f"Added column '{col_name}' to notifications table.")
                except Exception as e:
                    print(f"Migration note for notifications.{col_name}: {e}")

    # 3. Populate relational reminder times for existing medicines if empty
    db: Session = SessionLocal()
    try:
        meds = db.query(Medicine).all()
        for med in meds:
            times_count = db.query(MedicineReminderTime).filter(MedicineReminderTime.medicine_id == med.id).count()
            if times_count == 0 and med.reminder_times:
                parsed_times = [t.strip() for t in med.reminder_times.split(",") if t.strip()]
                for t in parsed_times:
                    db.add(MedicineReminderTime(
                        medicine_id=med.id,
                        reminder_time=t,
                        dose_label=f"Dose at {t}"
                    ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Note populating reminder times: {e}")
    finally:
        db.close()

def init_db():
    """Create all tables, migrate schema, and seed sample data if empty and enabled."""
    migrate_schema()
    
    db: Session = SessionLocal()
    try:
        # 1. Ensure System Administrator Account Exists
        admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin_user:
            admin_user = User(
                email=settings.ADMIN_INITIAL_EMAIL.lower(),
                hashed_password=get_password_hash(settings.ADMIN_INITIAL_PASSWORD),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                phone_number="+1 (555) 234-5678",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print(f"Initialized System Administrator ({settings.ADMIN_INITIAL_EMAIL}).")

        # 2. Skip demo data if disabled in production
        if not settings.SEED_DEMO_DATA:
            return

        # Check if demo users already exist
        if db.query(User).filter(User.email == "patient@eldermed.org").first() is not None:
            return

        print("Seeding initial database data (SEED_DEMO_DATA=True)...")

        # 2. Caregiver User
        caregiver_user = User(
            email="caregiver@eldermed.org",
            hashed_password=get_password_hash("Caregiver123!"),
            full_name="Sarah Wilson",
            role=UserRole.CAREGIVER,
            phone_number="+1 (555) 987-6543",
            is_active=True
        )
        db.add(caregiver_user)
        db.flush()

        caregiver_profile = Caregiver(
            user_id=caregiver_user.id,
            relationship_to_patient="Daughter & Primary Caregiver",
            alternate_phone="+1 (555) 987-6544",
            receive_email_alerts=True,
            receive_sms_alerts=True
        )
        db.add(caregiver_profile)
        db.flush()

        # 2b. Caregiver 2: Nurse Jennifer Adams
        caregiver2_user = User(
            email="nurse.jennifer@eldermed.org",
            hashed_password=get_password_hash("Caregiver123!"),
            full_name="Nurse Jennifer Adams",
            role=UserRole.CAREGIVER,
            phone_number="+1 (555) 456-7890",
            is_active=True
        )
        db.add(caregiver2_user)
        db.flush()

        caregiver2_profile = Caregiver(
            user_id=caregiver2_user.id,
            relationship_to_patient="Visiting Home Health Nurse",
            alternate_phone="+1 (555) 456-7891",
            receive_email_alerts=True,
            receive_sms_alerts=True
        )
        db.add(caregiver2_profile)
        db.flush()

        # 3. Patient 1: Margaret Wilson (Assigned to Caregiver 1 Sarah Wilson)
        patient1_user = User(
            email="patient@eldermed.org",
            hashed_password=get_password_hash("Patient123!"),
            full_name="Margaret Wilson",
            role=UserRole.PATIENT,
            phone_number="+1 (555) 123-4567",
            is_active=True
        )
        db.add(patient1_user)
        db.flush()

        patient1_profile = Patient(
            user_id=patient1_user.id,
            age=74,
            gender="Female",
            date_of_birth="1952-03-12",
            address="42 Elmwood Grove, Apt 4B, Springfield, MA 01103",
            health_conditions="Hypertension, Type 2 Diabetes Mellitus, Mild Osteoarthritis",
            allergies="Penicillin, Cephalosporins (mild rash)",
            emergency_contact_name="Sarah Wilson",
            emergency_contact_phone="+1 (555) 987-6543",
            emergency_contact_relation="Daughter",
            caregiver_name="Sarah Wilson",
            caregiver_phone="+1 (555) 987-6543",
            caregiver_email="caregiver@eldermed.org",
            caregiver_id=caregiver_profile.id,
            profile_photo="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256",
            notes="Prefers taking morning medications with a glass of warm water. Allergic to penicillin."
        )
        db.add(patient1_profile)
        db.flush()

        # 4. Patient 2: Arthur Pendelton (Assigned to Caregiver 2 Nurse Jennifer Adams)
        patient2_user = User(
            email="arthur.pendelton@eldermed.org",
            hashed_password=get_password_hash("Patient123!"),
            full_name="Arthur Pendelton",
            role=UserRole.PATIENT,
            phone_number="+1 (555) 789-0123",
            is_active=True
        )
        db.add(patient2_user)
        db.flush()

        patient2_profile = Patient(
            user_id=patient2_user.id,
            age=81,
            gender="Male",
            date_of_birth="1945-09-18",
            address="15 Oak Ridge Lane, Worcester, MA 01602",
            health_conditions="Congestive Heart Failure, Rheumatoid Arthritis, Insomnia",
            allergies="Aspirin (gastrointestinal upset), Codeine",
            emergency_contact_name="David Pendelton",
            emergency_contact_phone="+1 (555) 789-0124",
            emergency_contact_relation="Son",
            caregiver_name="Nurse Jennifer Adams",
            caregiver_phone="+1 (555) 456-7890",
            caregiver_email="nurse.jennifer@eldermed.org",
            caregiver_id=caregiver2_profile.id,
            profile_photo="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256",
            notes="Requires large font printouts. Monitor daily weight in morning."
        )
        db.add(patient2_profile)
        db.flush()

        # 5. Patient 3: Eleanor Vance (Assigned to Caregiver 1 Sarah Wilson)
        patient3_user = User(
            email="eleanor.vance@eldermed.org",
            hashed_password=get_password_hash("Patient123!"),
            full_name="Eleanor Vance",
            role=UserRole.PATIENT,
            phone_number="+1 (555) 345-6789",
            is_active=True
        )
        db.add(patient3_user)
        db.flush()

        patient3_profile = Patient(
            user_id=patient3_user.id,
            age=79,
            gender="Female",
            date_of_birth="1947-11-04",
            address="88 Meadowbrook Way, Springfield, MA 01108",
            health_conditions="Glaucoma, Osteoporosis, Hypothyroidism",
            allergies="Sulfa Antibiotics",
            emergency_contact_name="Sarah Wilson",
            emergency_contact_phone="+1 (555) 987-6543",
            emergency_contact_relation="Caregiver",
            caregiver_name="Sarah Wilson",
            caregiver_phone="+1 (555) 987-6543",
            caregiver_email="caregiver@eldermed.org",
            caregiver_id=caregiver_profile.id,
            profile_photo="https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=256",
            notes="Eye drops in evening. Take Levothyroxine 30 min before breakfast."
        )
        db.add(patient3_profile)
        db.flush()

        # 5. Prescriptions with multiple relational reminder times
        meds_data = [
            {
                "patient_id": patient1_profile.id,
                "name": "Metformin Hydrochloride",
                "medicine_type": "Tablet",
                "dosage": "500 mg Tablet",
                "quantity": 56,
                "instructions": "Take 1 tablet after meals with plenty of water. Do not crush or chew.",
                "start_date": date.today() - timedelta(days=30),
                "end_date": date.today() + timedelta(days=90),
                "reminder_times": "08:00, 20:00",
                "times": ["08:00", "20:00"],
                "frequency": "Twice daily",
                "before_after_food": "after_food",
                "additional_notes": "Maintains healthy blood sugar levels."
            },
            {
                "patient_id": patient1_profile.id,
                "name": "Lisinopril",
                "medicine_type": "Tablet",
                "dosage": "10 mg Tablet",
                "quantity": 28,
                "instructions": "Take in the morning with or after breakfast.",
                "start_date": date.today() - timedelta(days=30),
                "end_date": date.today() + timedelta(days=60),
                "reminder_times": "08:00",
                "times": ["08:00"],
                "frequency": "Once daily",
                "before_after_food": "after_food",
                "additional_notes": "Prescribed for blood pressure management."
            },
            {
                "patient_id": patient1_profile.id,
                "name": "Vitamin D3 (Cholecalciferol)",
                "medicine_type": "Capsule",
                "dosage": "1,000 IU Capsule",
                "quantity": 60,
                "instructions": "Take 1 softgel capsule with lunch.",
                "start_date": date.today() - timedelta(days=30),
                "end_date": date.today() + timedelta(days=120),
                "reminder_times": "13:00",
                "times": ["13:00"],
                "frequency": "Once daily",
                "before_after_food": "with_food",
                "additional_notes": "Bone strength and joint support."
            },
            {
                "patient_id": patient1_profile.id,
                "name": "Atorvastatin Calcium",
                "medicine_type": "Tablet",
                "dosage": "20 mg Tablet",
                "quantity": 30,
                "instructions": "Take at bedtime with or without food.",
                "start_date": date.today() - timedelta(days=30),
                "end_date": date.today() + timedelta(days=60),
                "reminder_times": "21:00",
                "times": ["21:00"],
                "frequency": "Once daily",
                "before_after_food": "none",
                "additional_notes": "Lowers cholesterol and protects cardiovascular health."
            },
            {
                "patient_id": patient2_profile.id,
                "name": "Furosemide (Lasix)",
                "medicine_type": "Tablet",
                "dosage": "20 mg Tablet",
                "quantity": 45,
                "instructions": "Take 1 tablet every morning with breakfast. Avoid taking late evening.",
                "start_date": date.today() - timedelta(days=15),
                "end_date": date.today() + timedelta(days=75),
                "reminder_times": "09:00",
                "times": ["09:00"],
                "frequency": "Once daily",
                "before_after_food": "after_food",
                "additional_notes": "Diuretic for fluid retention and heart health."
            },
            {
                "patient_id": patient2_profile.id,
                "name": "Carvedilol",
                "medicine_type": "Tablet",
                "dosage": "6.25 mg Tablet",
                "quantity": 60,
                "instructions": "Take with meals twice a day to reduce blood pressure drop.",
                "start_date": date.today() - timedelta(days=15),
                "end_date": date.today() + timedelta(days=75),
                "reminder_times": "09:00, 21:00",
                "times": ["09:00", "21:00"],
                "frequency": "Twice daily",
                "before_after_food": "with_food",
                "additional_notes": "Heart failure beta-blocker."
            }
        ]

        created_meds = []
        for m in meds_data:
            times = m.pop("times")
            med = Medicine(**m)
            db.add(med)
            db.flush()
            for t in times:
                db.add(MedicineReminderTime(
                    medicine_id=med.id,
                    reminder_time=t,
                    dose_label=f"Scheduled at {t}"
                ))
            created_meds.append(med)
        db.flush()

        # 6. Schedules for today
        today = date.today()
        # Metformin (Margaret) 08:00
        s1 = MedicineSchedule(
            medicine_id=created_meds[0].id,
            patient_id=patient1_profile.id,
            scheduled_date=today,
            scheduled_time="08:00",
            status="taken",
            taken_at=datetime.now(timezone.utc).replace(hour=8, minute=15)
        )
        db.add(s1)
        db.flush()
        db.add(MedicationLog(
            schedule_id=s1.id,
            medicine_id=created_meds[0].id,
            patient_id=patient1_profile.id,
            status="taken",
            scheduled_time=f"{today} 08:00",
            actual_taken_time=datetime.now(timezone.utc).replace(hour=8, minute=15),
            patient_notes="Taken with warm oatmeal."
        ))

        # Lisinopril (Margaret) 08:00
        s2 = MedicineSchedule(
            medicine_id=created_meds[1].id,
            patient_id=patient1_profile.id,
            scheduled_date=today,
            scheduled_time="08:00",
            status="taken",
            taken_at=datetime.now(timezone.utc).replace(hour=8, minute=16)
        )
        db.add(s2)
        db.flush()
        db.add(MedicationLog(
            schedule_id=s2.id,
            medicine_id=created_meds[1].id,
            patient_id=patient1_profile.id,
            status="taken",
            scheduled_time=f"{today} 08:00",
            actual_taken_time=datetime.now(timezone.utc).replace(hour=8, minute=16),
            patient_notes="Taken with water."
        ))

        # Vitamin D3 (Margaret) 13:00
        db.add(MedicineSchedule(
            medicine_id=created_meds[2].id,
            patient_id=patient1_profile.id,
            scheduled_date=today,
            scheduled_time="13:00",
            status="pending"
        ))

        # Metformin (Margaret) 20:00
        db.add(MedicineSchedule(
            medicine_id=created_meds[0].id,
            patient_id=patient1_profile.id,
            scheduled_date=today,
            scheduled_time="20:00",
            status="pending"
        ))

        # Atorvastatin (Margaret) 21:00
        db.add(MedicineSchedule(
            medicine_id=created_meds[3].id,
            patient_id=patient1_profile.id,
            scheduled_date=today,
            scheduled_time="21:00",
            status="pending"
        ))

        # Furosemide (Arthur) 09:00
        s6 = MedicineSchedule(
            medicine_id=created_meds[4].id,
            patient_id=patient2_profile.id,
            scheduled_date=today,
            scheduled_time="09:00",
            status="taken",
            taken_at=datetime.now(timezone.utc).replace(hour=9, minute=5)
        )
        db.add(s6)
        db.flush()
        db.add(MedicationLog(
            schedule_id=s6.id,
            medicine_id=created_meds[4].id,
            patient_id=patient2_profile.id,
            status="taken",
            scheduled_time=f"{today} 09:00",
            actual_taken_time=datetime.now(timezone.utc).replace(hour=9, minute=5),
            patient_notes="Taken after breakfast toast."
        ))

        # Carvedilol (Arthur) 09:00 & 21:00
        s7 = MedicineSchedule(
            medicine_id=created_meds[5].id,
            patient_id=patient2_profile.id,
            scheduled_date=today,
            scheduled_time="09:00",
            status="taken",
            taken_at=datetime.now(timezone.utc).replace(hour=9, minute=6)
        )
        db.add(s7)

        db.add(MedicineSchedule(
            medicine_id=created_meds[5].id,
            patient_id=patient2_profile.id,
            scheduled_date=today,
            scheduled_time="21:00",
            status="pending"
        ))

        # Sample Initial Notification
        db.add(Notification(
            user_id=patient1_user.id,
            patient_id=patient1_profile.id,
            title="Welcome to ElderMed",
            message="Your daily medication plan has been synchronized with your caregiver Sarah Wilson.",
            notification_type="general",
            channel="in_app",
            is_read=True
        ))

        db.commit()
        print("Database initialized, migrated, and seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()
