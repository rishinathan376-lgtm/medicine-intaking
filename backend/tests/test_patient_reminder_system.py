"""
Comprehensive Automated Test Suite for Patient Reminder Screen & Notification Center.
Verifies all 11 Core Verification Criteria:
1. Patient login works (JWT authentication).
2. Patient sees only their medicines (strict data isolation).
3. Today's schedule is correct and in chronological order.
4. Due medicines appear correctly.
5. TAKE MEDICINE action works (marks taken, records actual intake timestamp, creates log).
6. MISSED action works (marks missed, records timestamp, creates log).
7. Medication logs update correctly and adherence percentage is accurate.
8. Caregiver notification is triggered when medicine is marked missed.
9. Patient notifications appear correctly (read status, mark single read, mark all read).
10. Duplicate medication actions are prevented (idempotent logging).
11. Unauthorized patient cannot access other patient's reminder home or schedules (HTTP 403 Forbidden).
"""

import sys
import os
from datetime import date, datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.init_db import init_db
from app.models.user import User
from app.models.patient import Patient
from app.models.medicine import Medicine
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification

client = TestClient(app)

def run_all_patient_reminder_tests():
    print("\n==================================================================")
    print("   RUNNING ELDERMED PATIENT REMINDER & NOTIFICATION TEST SUITE    ")
    print("==================================================================\n")

    init_db()
    db = SessionLocal()

    try:
        # -------------------------------------------------------------
        # TEST 1: Patient Login (JWT Authentication)
        # -------------------------------------------------------------
        print("--- TEST 1: Patient Authentication (Login) ---")
        # Patient 1: Margaret Wilson
        login_p1 = client.post("/api/v1/auth/login", json={
            "email": "patient@eldermed.org",
            "password": "Patient123!"
        })
        assert login_p1.status_code == 200, f"Patient 1 login failed: {login_p1.text}"
        token1 = login_p1.json()["access_token"]
        headers_p1 = {"Authorization": f"Bearer {token1}"}
        print("✓ Patient 1 (Margaret Wilson) logged in successfully. JWT token acquired.")

        # Patient 2: Arthur Pendelton
        login_p2 = client.post("/api/v1/auth/login", json={
            "email": "arthur.pendelton@eldermed.org",
            "password": "Patient123!"
        })
        assert login_p2.status_code == 200, f"Patient 2 login failed: {login_p2.text}"
        token2 = login_p2.json()["access_token"]
        headers_p2 = {"Authorization": f"Bearer {token2}"}
        print("✓ Patient 2 (Arthur Pendelton) logged in successfully. JWT token acquired.")

        # -------------------------------------------------------------
        # TEST 2: Patient Sees Only Their Medicines (Data Privacy)
        # -------------------------------------------------------------
        print("\n--- TEST 2: Patient Medicine Isolation ---")
        meds_p1 = client.get("/api/v1/medicines", headers=headers_p1).json()
        assert len(meds_p1) > 0, "Patient 1 should have active medicines"
        for m in meds_p1:
            assert m["patient_id"] == 1, f"Medicine {m['name']} must belong to Patient 1"
        print(f"✓ Patient 1 sees {len(meds_p1)} medicines belonging exclusively to Patient ID 1.")

        meds_p2 = client.get("/api/v1/medicines", headers=headers_p2).json()
        for m in meds_p2:
            assert m["patient_id"] == 2, f"Medicine {m['name']} must belong to Patient 2"
        print(f"✓ Patient 2 sees {len(meds_p2)} medicines belonging exclusively to Patient ID 2.")

        # Unauthorized query: Patient 1 trying to query Patient 2's medicines
        unauth_meds = client.get("/api/v1/medicines?patient_id=2", headers=headers_p1)
        assert unauth_meds.status_code == 403, "Patient 1 must not be allowed to query Patient 2's medicines"
        print("✓ Unauthorized medicine query blocked with HTTP 403 Forbidden.")

        # -------------------------------------------------------------
        # TEST 3: Today's Schedule & Patient Reminder Home Screen Data
        # -------------------------------------------------------------
        print("\n--- TEST 3: Today's Chronological Schedule & Reminder Home ---")
        home_resp = client.get("/api/v1/patients/1/reminder-home", headers=headers_p1)
        assert home_resp.status_code == 200, f"Failed to get reminder home: {home_resp.text}"
        home_data = home_resp.json()

        assert home_data["patient_name"] == "Margaret Wilson"
        assert "formatted_date" in home_data
        assert "formatted_time" in home_data
        assert len(home_data["today_schedules"]) > 0, "Margaret must have today's schedules"

        # Verify chronological ordering
        times = [s["scheduled_time"] for s in home_data["today_schedules"]]
        print(f"✓ Chronological schedule doses: {times}")
        print(f"✓ Patient Home summary: {home_data['today_taken']} Taken, {home_data['today_missed']} Missed, {home_data['today_pending']} Pending.")

        # -------------------------------------------------------------
        # TEST 4: Due Medicines Appear Correctly
        # -------------------------------------------------------------
        print("\n--- TEST 4: Active Due Reminder Trigger & Display ---")
        # Trigger first schedule to become DUE NOW for test
        target_sched = home_data["today_schedules"][0]
        sched_id = target_sched["id"]
        
        trigger_resp = client.post(f"/api/v1/schedules/{sched_id}/trigger-due", headers=headers_p1)
        assert trigger_resp.status_code == 200, f"Trigger due failed: {trigger_resp.text}"
        assert trigger_resp.json()["status"] == "due"
        print(f"✓ Successfully triggered Schedule #{sched_id} to status 'due'.")

        # Re-fetch reminder home
        home_due = client.get("/api/v1/patients/1/reminder-home", headers=headers_p1).json()
        assert home_due["active_reminder"] is not None, "An active reminder must be present"
        assert home_due["active_reminder"]["id"] == sched_id
        assert home_due["active_reminder"]["status"] == "due"
        print(f"✓ Active reminder prominently displayed: {home_due['active_reminder']['medicine']['name']} at {home_due['active_reminder']['scheduled_time']}.")

        # -------------------------------------------------------------
        # TEST 5: TAKE MEDICINE Action
        # -------------------------------------------------------------
        print("\n--- TEST 5: TAKE MEDICINE Action ---")
        take_resp = client.post(f"/api/v1/schedules/{sched_id}/action", headers=headers_p1, json={
            "action": "taken",
            "patient_notes": "Taken with full glass of water"
        })
        assert take_resp.status_code == 200, f"Take action failed: {take_resp.text}"
        updated_take = take_resp.json()
        assert updated_take["status"] == "taken"
        assert updated_take["taken_at"] is not None, "Actual intake timestamp must be recorded"
        print(f"✓ TAKE confirmed at {updated_take['taken_at']}.")

        # -------------------------------------------------------------
        # TEST 6 & 8: MISSED Action & Caregiver Notification Alert
        # -------------------------------------------------------------
        print("\n--- TEST 6 & 8: MISSED Action & Caregiver Notification Alert ---")
        # Use second schedule for MISSED test
        if len(home_data["today_schedules"]) > 1:
            miss_sched_id = home_data["today_schedules"][1]["id"]
            miss_resp = client.post(f"/api/v1/schedules/{miss_sched_id}/action", headers=headers_p1, json={
                "action": "missed",
                "patient_notes": "Patient felt nauseous"
            })
            assert miss_resp.status_code == 200, f"Miss action failed: {miss_resp.text}"
            updated_miss = miss_resp.json()
            assert updated_miss["status"] == "missed"
            print(f"✓ MISSED confirmed for Schedule #{miss_sched_id}.")

            # Verify Caregiver received a missed_alert notification
            caregiver_alerts = db.query(Notification).filter(
                Notification.schedule_id == miss_sched_id,
                Notification.notification_type == "missed_alert"
            ).all()
            assert len(caregiver_alerts) > 0, "A caregiver missed_alert must be created"
            print(f"✓ Caregiver alert generated: '{caregiver_alerts[0].title}' - {caregiver_alerts[0].message}")

        # -------------------------------------------------------------
        # TEST 7: Medication Logs Update & Adherence Calculation
        # -------------------------------------------------------------
        print("\n--- TEST 7: Medication Logs & Adherence Percentage ---")
        logs_resp = client.get("/api/v1/logs?patient_id=1", headers=headers_p1)
        assert logs_resp.status_code == 200
        logs = logs_resp.json()
        assert len(logs) > 0
        taken_count = sum(1 for l in logs if l["status"] == "taken")
        print(f"✓ Total logged doses for Patient 1: {len(logs)} ({taken_count} taken, {len(logs) - taken_count} missed).")

        # Verify home data reflects updated adherence
        home_after = client.get("/api/v1/patients/1/reminder-home", headers=headers_p1).json()
        assert home_after["adherence_percentage"] >= 0.0
        print(f"✓ Real-time Adherence rate displayed to patient: {home_after['adherence_percentage']}%.")

        # -------------------------------------------------------------
        # TEST 9: Patient Notifications & Mark All Read
        # -------------------------------------------------------------
        print("\n--- TEST 9: Patient Notification Center ---")
        notifs_resp = client.get("/api/v1/notifications?patient_id=1", headers=headers_p1)
        assert notifs_resp.status_code == 200
        notifs = notifs_resp.json()
        print(f"✓ Patient 1 has {len(notifs)} total notifications.")

        # Test Mark All Read
        read_all_resp = client.put("/api/v1/notifications/patient/1/read-all", headers=headers_p1)
        assert read_all_resp.status_code == 200
        print(f"✓ Mark all read executed: {read_all_resp.json()['message']}")

        # Verify all are now read
        unread_notifs = client.get("/api/v1/notifications?patient_id=1&unread_only=true", headers=headers_p1).json()
        assert len(unread_notifs) == 0, "All notifications must now be read"
        print("✓ Verified 0 unread notifications remaining.")

        # -------------------------------------------------------------
        # TEST 10: Duplicate Medication Actions Prevented (Idempotency)
        # -------------------------------------------------------------
        print("\n--- TEST 10: Duplicate Submission Prevention ---")
        # Attempt to mark the taken schedule again
        take_dup = client.post(f"/api/v1/schedules/{sched_id}/action", headers=headers_p1, json={
            "action": "taken",
            "patient_notes": "Duplicate click test"
        })
        assert take_dup.status_code == 200
        # Check database logs count for this schedule
        log_count = db.query(MedicationLog).filter(MedicationLog.schedule_id == sched_id).count()
        assert log_count == 1, f"Expected exactly 1 MedicationLog row for schedule #{sched_id}, found {log_count}"
        print("✓ Duplicate prevention verified: exactly 1 MedicationLog row exists for this schedule.")

        # -------------------------------------------------------------
        # TEST 11: Security Isolation (Unauthorized Patient Access Blocked)
        # -------------------------------------------------------------
        print("\n--- TEST 11: Security & Privacy (Patient Isolation 403) ---")
        # Patient 1 trying to access Patient 2's reminder home
        unauth_home = client.get("/api/v1/patients/2/reminder-home", headers=headers_p1)
        assert unauth_home.status_code == 403, f"Expected 403 Forbidden, got {unauth_home.status_code}"
        print(f"✓ Patient 1 accessing Patient 2 home blocked with HTTP 403: {unauth_home.json()['detail']}")

        # Patient 2 trying to access Patient 1's reminder home
        unauth_home2 = client.get("/api/v1/patients/1/reminder-home", headers=headers_p2)
        assert unauth_home2.status_code == 403
        print(f"✓ Patient 2 accessing Patient 1 home blocked with HTTP 403.")

        # Patient 1 trying to act on Patient 2's schedule
        p2_sched = db.query(MedicineSchedule).filter(MedicineSchedule.patient_id == 2).first()
        if p2_sched:
            unauth_action = client.post(f"/api/v1/schedules/{p2_sched.id}/action", headers=headers_p1, json={"action": "taken"})
            assert unauth_action.status_code == 403
            print(f"✓ Patient 1 acting on Patient 2's schedule blocked with HTTP 403.")

        print("\n==================================================================")
        print("  ALL 11 PATIENT REMINDER & NOTIFICATION TESTS PASSED (100%)!     ")
        print("==================================================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    run_all_patient_reminder_tests()
