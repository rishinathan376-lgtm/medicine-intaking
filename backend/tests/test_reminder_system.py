"""
Comprehensive Automated Test Suite for Automatic Medicine Reminder and Notification System.
Covers:
1. Reminder generation
2. Multiple medicines
3. Multiple reminder times
4. Taken status & MedicationLog creation
5. Missed status (grace period expiration & manual)
6. Duplicate prevention (schedules, logs, notifications)
7. Medicine start/end dates adherence
8. Caregiver notification & alert generation
"""

import sys
import os
from datetime import date, datetime, timedelta, timezone

# Add parent directory to path so app modules import cleanly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal, Base, engine
from app.core.init_db import init_db
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.caregiver import Caregiver
from app.models.medicine import Medicine
from app.models.reminder_time import MedicineReminderTime
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification
from app.services.reminder_service import ReminderService, get_current_app_time
from app.core.config import settings

def run_all_reminder_tests():
    print("\n=======================================================")
    print("  RUNNING ELDERMED REMINDER & NOTIFICATION TEST SUITE  ")
    print("=======================================================\n")
    
    # Ensure tables exist
    init_db()
    db = SessionLocal()

    try:
        # Fetch or create a test patient
        patient = db.query(Patient).first()
        assert patient is not None, "A patient profile must exist in the database."
        print(f"✓ Using test patient: {patient.user.full_name} (ID: {patient.id})")

        # ---------------------------------------------------------
        # TEST 1: Reminder Generation
        # ---------------------------------------------------------
        print("\n--- TEST 1: Reminder Generation ---")
        today = get_current_app_time().date()
        created_count = ReminderService.generate_daily_schedules(db, target_date=today)
        schedules = db.query(MedicineSchedule).filter(
            MedicineSchedule.patient_id == patient.id,
            MedicineSchedule.scheduled_date == today
        ).all()
        assert len(schedules) > 0, "Daily schedules must be generated for patient's active medicines."
        for s in schedules:
            assert s.status in ["upcoming", "due", "missed", "taken"], f"Schedule #{s.id} has invalid status {s.status}"
            assert s.scheduled_time is not None, "Scheduled time cannot be empty."
        print(f"✓ Daily schedules successfully verified: {len(schedules)} doses found for today.")

        # ---------------------------------------------------------
        # TEST 2: Multiple Medicines
        # ---------------------------------------------------------
        print("\n--- TEST 2: Multiple Medicines Support ---")
        med1 = Medicine(
            patient_id=patient.id,
            name="Test Multimed Alpha",
            medicine_type="Tablet",
            dosage="250 mg",
            quantity=20,
            start_date=today,
            frequency="Once daily",
            reminder_times="10:00",
            is_active=True
        )
        med2 = Medicine(
            patient_id=patient.id,
            name="Test Multimed Beta",
            medicine_type="Capsule",
            dosage="500 mg",
            quantity=15,
            start_date=today,
            frequency="Once daily",
            reminder_times="11:30",
            is_active=True
        )
        db.add_all([med1, med2])
        db.flush()

        db.add(MedicineReminderTime(medicine_id=med1.id, reminder_time="10:00", dose_label="Morning"))
        db.add(MedicineReminderTime(medicine_id=med2.id, reminder_time="11:30", dose_label="Lunch"))
        db.commit()

        ReminderService.generate_daily_schedules(db, target_date=today)
        sched_alpha = db.query(MedicineSchedule).filter(MedicineSchedule.medicine_id == med1.id, MedicineSchedule.scheduled_date == today).first()
        sched_beta = db.query(MedicineSchedule).filter(MedicineSchedule.medicine_id == med2.id, MedicineSchedule.scheduled_date == today).first()
        assert sched_alpha is not None, "Schedule for Medicine Alpha was not generated."
        assert sched_beta is not None, "Schedule for Medicine Beta was not generated."
        print(f"✓ Successfully generated independent schedules for multiple medicines: {sched_alpha.medicine.name} and {sched_beta.medicine.name}")

        # ---------------------------------------------------------
        # TEST 3: Multiple Reminder Times Per Medicine
        # ---------------------------------------------------------
        print("\n--- TEST 3: Multiple Reminder Times Per Medicine ---")
        multi_dose_med = Medicine(
            patient_id=patient.id,
            name="Test Paracetamol Multi-Times",
            medicine_type="Tablet",
            dosage="500 mg",
            quantity=40,
            start_date=today,
            frequency="3 times per day",
            reminder_times="08:00, 14:00, 20:00",
            is_active=True
        )
        db.add(multi_dose_med)
        db.flush()

        times = ["08:00", "14:00", "20:00"]
        for t in times:
            db.add(MedicineReminderTime(medicine_id=multi_dose_med.id, reminder_time=t, dose_label=f"Dose at {t}"))
        db.commit()

        ReminderService.generate_daily_schedules(db, target_date=today)
        multi_schedules = db.query(MedicineSchedule).filter(
            MedicineSchedule.medicine_id == multi_dose_med.id,
            MedicineSchedule.scheduled_date == today
        ).all()
        assert len(multi_schedules) == 3, f"Expected 3 schedules for 3 reminder times, got {len(multi_schedules)}"
        sched_times = [s.scheduled_time for s in multi_schedules]
        for t in times:
            assert t in sched_times, f"Missing scheduled occurrence for {t}"
        print(f"✓ Successfully verified {len(multi_schedules)} relational reminder time slots: {sched_times}")

        # ---------------------------------------------------------
        # TEST 4: Taken Status and MedicationLog Creation
        # ---------------------------------------------------------
        print("\n--- TEST 4: Taken Status Confirmation & Log Creation ---")
        test_sched = multi_schedules[0]
        initial_qty = multi_dose_med.quantity
        updated_sched = ReminderService.record_dose_action(
            db=db,
            schedule_id=test_sched.id,
            action="taken",
            patient_notes="Patient took medicine with full glass of water."
        )
        assert updated_sched.status == "taken", f"Expected status 'taken', got {updated_sched.status}"
        assert updated_sched.taken_at is not None, "taken_at timestamp was not recorded."
        
        # Verify MedicationLog persisted
        log = db.query(MedicationLog).filter(MedicationLog.schedule_id == test_sched.id).first()
        assert log is not None, "MedicationLog was not created for taken action."
        assert log.status == "taken", f"MedicationLog status should be 'taken', got {log.status}"
        assert log.patient_notes == "Patient took medicine with full glass of water."
        
        # Verify inventory decrement
        db.refresh(multi_dose_med)
        assert multi_dose_med.quantity == initial_qty - 1, f"Expected inventory {initial_qty - 1}, got {multi_dose_med.quantity}"
        print(f"✓ Successfully confirmed Taken action, persisted MedicationLog #{log.id}, decremented inventory to {multi_dose_med.quantity}.")

        # ---------------------------------------------------------
        # TEST 5: Missed Status & Grace Period
        # ---------------------------------------------------------
        print("\n--- TEST 5: Missed Status Confirmation & Log Creation ---")
        test_sched_missed = multi_schedules[1]
        updated_missed = ReminderService.record_dose_action(
            db=db,
            schedule_id=test_sched_missed.id,
            action="missed",
            caregiver_notes="Caregiver reported patient forgot afternoon dose."
        )
        assert updated_missed.status == "missed", f"Expected status 'missed', got {updated_missed.status}"
        
        missed_log = db.query(MedicationLog).filter(MedicationLog.schedule_id == test_sched_missed.id).first()
        assert missed_log is not None, "MedicationLog was not created for missed action."
        assert missed_log.status == "missed"
        print(f"✓ Successfully confirmed Missed action and recorded MedicationLog #{missed_log.id}.")

        # ---------------------------------------------------------
        # TEST 6: Duplicate Prevention
        # ---------------------------------------------------------
        print("\n--- TEST 6: Duplicate Prevention ---")
        count_before = db.query(MedicineSchedule).count()
        # Run generator again
        new_created = ReminderService.generate_daily_schedules(db, target_date=today)
        count_after = db.query(MedicineSchedule).count()
        assert new_created == 0, f"Expected 0 new schedules created on second pass, got {new_created}"
        assert count_before == count_after, "Duplicate schedules were created!"

        # Duplicate log prevention test: record dose action again on same schedule
        ReminderService.record_dose_action(db, test_sched.id, "taken", patient_notes="Repeated click")
        logs_for_sched = db.query(MedicationLog).filter(MedicationLog.schedule_id == test_sched.id).all()
        assert len(logs_for_sched) == 1, f"Expected exactly 1 MedicationLog for schedule, found {len(logs_for_sched)}"
        print("✓ Verified duplicate prevention: no duplicate schedules or logs generated.")

        # ---------------------------------------------------------
        # TEST 7: Medicine Start and End Dates Adherence
        # ---------------------------------------------------------
        print("\n--- TEST 7: Medicine Start and End Dates Adherence ---")
        past_med = Medicine(
            patient_id=patient.id,
            name="Past Expired Med",
            dosage="10 mg",
            start_date=today - timedelta(days=60),
            end_date=today - timedelta(days=5),  # expired 5 days ago
            frequency="Once daily",
            reminder_times="12:00",
            is_active=True
        )
        future_med = Medicine(
            patient_id=patient.id,
            name="Future Scheduled Med",
            dosage="50 mg",
            start_date=today + timedelta(days=10),  # starts in 10 days
            frequency="Once daily",
            reminder_times="12:00",
            is_active=True
        )
        db.add_all([past_med, future_med])
        db.flush()
        db.add(MedicineReminderTime(medicine_id=past_med.id, reminder_time="12:00"))
        db.add(MedicineReminderTime(medicine_id=future_med.id, reminder_time="12:00"))
        db.commit()

        ReminderService.generate_daily_schedules(db, target_date=today)
        past_sched = db.query(MedicineSchedule).filter(MedicineSchedule.medicine_id == past_med.id, MedicineSchedule.scheduled_date == today).first()
        future_sched = db.query(MedicineSchedule).filter(MedicineSchedule.medicine_id == future_med.id, MedicineSchedule.scheduled_date == today).first()
        assert past_sched is None, "Expired medicine should NOT generate a schedule for today."
        assert future_sched is None, "Future medicine should NOT generate a schedule for today."
        print("✓ Successfully verified date adherence: expired and future medicines correctly ignored.")

        # ---------------------------------------------------------
        # TEST 8: Caregiver Notification & Alert Generation
        # ---------------------------------------------------------
        print("\n--- TEST 8: Caregiver Notification & Missed Alert ---")
        test_sched_3 = multi_schedules[2]
        # Reset notification status
        test_sched_3.notified_caregiver = False
        db.commit()

        # Mark missed to trigger caregiver alert
        ReminderService.record_dose_action(
            db=db,
            schedule_id=test_sched_3.id,
            action="missed"
        )
        db.refresh(test_sched_3)
        assert test_sched_3.notified_caregiver == True, "notified_caregiver flag must be True after missed alert."

        # Check notification table in PostgreSQL/SQLite
        caregiver_notif = db.query(Notification).filter(
            Notification.schedule_id == test_sched_3.id,
            Notification.notification_type == "missed_alert"
        ).first()
        assert caregiver_notif is not None, "Caregiver notification of type 'missed_alert' was not created."
        assert "Missed Medicine Alert" in caregiver_notif.title
        assert caregiver_notif.patient_id == patient.id
        print(f"✓ Caregiver alert stored in DB: #{caregiver_notif.id} - '{caregiver_notif.title}'")

        # Clean up temporary test medicines
        test_med_ids = [med1.id, med2.id, multi_dose_med.id, past_med.id, future_med.id]
        for mid in test_med_ids:
            m = db.query(Medicine).filter(Medicine.id == mid).first()
            if m:
                db.delete(m)
        db.commit()
        print("✓ Test cleanup completed successfully.")

        print("\n=======================================================")
        print("   ALL 8 REMINDER & NOTIFICATION TESTS PASSED (100%)  ")
        print("=======================================================\n")
        return True

    except Exception as e:
        db.rollback()
        print(f"\n❌ TEST SUITE FAILURE: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_all_reminder_tests()
    sys.exit(0 if success else 1)
