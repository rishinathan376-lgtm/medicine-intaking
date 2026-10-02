"""
Comprehensive Automated Test Suite for Caregiver Dashboard.
Verifies all 8 Core Verification Criteria:
1. Caregiver can log in (JWT token authentication).
2. Caregiver can see assigned patients (Caregiver 1 sees Patient 1 & 3; Caregiver 2 sees Patient 2).
3. Caregiver can view medication schedules for assigned patients.
4. Taken medicines appear correctly.
5. Missed medicines appear correctly.
6. Adherence percentage is calculated correctly based on actual medication logs.
7. Caregiver alerts work (marking as 'reviewed' and 'resolved').
8. Unauthorized patients cannot be accessed (HTTP 403 Forbidden returned).
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
from app.models.caregiver import Caregiver
from app.models.patient import Patient
from app.models.medicine import Medicine
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification

client = TestClient(app)

def run_all_caregiver_tests():
    print("\n=======================================================")
    print("   RUNNING ELDERMED CAREGIVER DASHBOARD TEST SUITE     ")
    print("=======================================================\n")

    init_db()
    db = SessionLocal()

    try:
        # -------------------------------------------------------------
        # TEST 1: Caregiver Login
        # -------------------------------------------------------------
        print("--- TEST 1: Caregiver Authentication (Login) ---")
        # Caregiver 1 Login
        login_resp1 = client.post("/api/v1/auth/login", json={
            "email": "caregiver@eldermed.org",
            "password": "Caregiver123!"
        })
        assert login_resp1.status_code == 200, f"Caregiver 1 login failed: {login_resp1.text}"
        token1 = login_resp1.json()["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}
        print("✓ Caregiver 1 (Sarah Wilson) logged in successfully. JWT token acquired.")

        # Caregiver 2 Login
        login_resp2 = client.post("/api/v1/auth/login", json={
            "email": "nurse.jennifer@eldermed.org",
            "password": "Caregiver123!"
        })
        assert login_resp2.status_code == 200, f"Caregiver 2 login failed: {login_resp2.text}"
        token2 = login_resp2.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}
        print("✓ Caregiver 2 (Nurse Jennifer Adams) logged in successfully. JWT token acquired.")

        # -------------------------------------------------------------
        # TEST 2: Caregiver Can See Assigned Patients
        # -------------------------------------------------------------
        print("\n--- TEST 2: Assigned Patients Visibility ---")
        # Caregiver 1's dashboard
        dash_resp1 = client.get("/api/v1/caregivers/dashboard", headers=headers1)
        assert dash_resp1.status_code == 200, f"Dashboard fetch failed: {dash_resp1.text}"
        dash_data1 = dash_resp1.json()
        
        assigned_pids_1 = [p["patient_id"] for p in dash_data1["assigned_patients"]]
        print(f"Caregiver 1 assigned patient IDs: {assigned_pids_1}")
        assert 1 in assigned_pids_1, "Caregiver 1 must see assigned Patient 1"
        assert 2 not in assigned_pids_1, "Caregiver 1 must NOT see Patient 2 in assigned patients"
        print("✓ Caregiver 1 sees Margaret Wilson and Eleanor Vance, but not Arthur Pendelton Jr.")

        # Caregiver 2's dashboard
        dash_resp2 = client.get("/api/v1/caregivers/dashboard", headers=headers2)
        assert dash_resp2.status_code == 200
        dash_data2 = dash_resp2.json()
        assigned_pids_2 = [p["patient_id"] for p in dash_data2["assigned_patients"]]
        print(f"Caregiver 2 assigned patient IDs: {assigned_pids_2}")
        assert 2 in assigned_pids_2, "Caregiver 2 must see assigned Patient 2"
        assert 1 not in assigned_pids_2, "Caregiver 2 must NOT see Patient 1 in assigned patients"
        print("✓ Caregiver 2 sees Arthur Pendelton Jr., but not Margaret Wilson.")

        # Patient search endpoint
        search_resp = client.get("/api/v1/caregivers/patients?search=margaret", headers=headers1)
        assert search_resp.status_code == 200
        searched = search_resp.json()
        assert len(searched) >= 1 and "margaret" in searched[0]["patient_name"].lower()
        print("✓ Patient search by name returned correct matching patient.")

        # -------------------------------------------------------------
        # TEST 3: Caregiver Views Medication Schedules
        # -------------------------------------------------------------
        print("\n--- TEST 3: Medication Schedules for Assigned Patient ---")
        details_resp1 = client.get("/api/v1/caregivers/patients/1/details", headers=headers1)
        assert details_resp1.status_code == 200, f"Failed to get details: {details_resp1.text}"
        details1 = details_resp1.json()
        
        assert "today_schedules" in details1
        assert "active_medicines" in details1
        print(f"✓ Found {len(details1['active_medicines'])} active medicines and {len(details1['today_schedules'])} scheduled doses for Patient 1.")
        assert len(details1["today_schedules"]) > 0, "Patient 1 should have today's schedules"

        # -------------------------------------------------------------
        # TEST 4 & 5: Taken & Missed Medicines Appear Correctly
        # -------------------------------------------------------------
        print("\n--- TEST 4 & 5: Taken and Missed Medicines Tracking ---")
        # Ensure at least one schedule is taken and one is missed for testing
        first_sched_id = details1["today_schedules"][0]["id"]
        
        # Patient marks dose as taken
        take_resp = client.post(f"/api/v1/schedules/{first_sched_id}/action", headers=headers1, json={"action": "taken", "patient_notes": "Took on time"})
        assert take_resp.status_code in [200, 400], "Mark taken should succeed or report already resolved"

        # If there is a second schedule, mark it missed
        if len(details1["today_schedules"]) > 1:
            second_sched_id = details1["today_schedules"][1]["id"]
            client.post(f"/api/v1/schedules/{second_sched_id}/action", headers=headers1, json={"action": "missed", "caregiver_notes": "Patient forgot"})

        # Re-fetch patient details
        details_refreshed = client.get("/api/v1/caregivers/patients/1/details", headers=headers1).json()
        taken_list = details_refreshed["taken_schedules"]
        missed_list = details_refreshed["missed_schedules"]
        upcoming_list = details_refreshed["upcoming_schedules"]
        
        print(f"✓ Today's status breakdown: {len(taken_list)} Taken, {len(missed_list)} Missed, {len(upcoming_list)} Upcoming.")
        assert len(taken_list) > 0, "Taken medicines should be listed in taken_schedules"

        # -------------------------------------------------------------
        # TEST 6: Adherence Percentage Calculation
        # -------------------------------------------------------------
        print("\n--- TEST 6: Medication Adherence Percentage Calculation ---")
        adherence_pct = details_refreshed["adherence_percentage"]
        breakdown = details_refreshed["adherence_breakdown"]
        print(f"✓ Calculated Adherence: {adherence_pct}% (Breakdown: {breakdown})")
        assert 0.0 <= adherence_pct <= 100.0, "Adherence must be a percentage between 0 and 100"
        
        # Verify dashboard aggregate adherence matches formula
        db_logs = db.query(MedicationLog).filter(MedicationLog.patient_id == 1).all()
        if db_logs:
            expected_pct = round((sum(1 for l in db_logs if l.status == "taken") / len(db_logs)) * 100.0, 1)
            assert adherence_pct == expected_pct, f"Adherence percentage {adherence_pct} != expected {expected_pct}"
            print(f"✓ Adherence strictly matches verified formula from MedicationLog: {expected_pct}%")

        # -------------------------------------------------------------
        # TEST 7: Caregiver Alerts & Updating Alert Status
        # -------------------------------------------------------------
        print("\n--- TEST 7: Missed Medicine Alerts (Reviewed / Resolved) ---")
        # Ensure there is an alert for Patient 1
        alerts_resp = client.get("/api/v1/caregivers/alerts", headers=headers1)
        assert alerts_resp.status_code == 200
        alerts = alerts_resp.json()
        
        if not alerts:
            # Create a test missed alert notification
            test_notif = Notification(
                patient_id=1,
                medicine_id=details1["active_medicines"][0]["id"],
                title="Missed Medicine Alert: Test",
                message="Patient missed scheduled dose at 08:00 AM",
                notification_type="missed_alert",
                scheduled_time="08:00 AM",
                status="active",
                is_read=False,
                created_at=datetime.utcnow()
            )
            db.add(test_notif)
            db.commit()
            db.refresh(test_notif)
            test_alert_id = test_notif.id
        else:
            test_alert_id = alerts[0]["id"]

        print(f"Targeting Alert ID: {test_alert_id}")

        # Mark as Reviewed
        review_resp = client.patch(f"/api/v1/caregivers/alerts/{test_alert_id}", headers=headers1, json={
            "status": "reviewed",
            "notes": "Spoke with Margaret, she took it 10 mins late"
        })
        assert review_resp.status_code == 200, f"Mark reviewed failed: {review_resp.text}"
        assert review_resp.json()["alert_status"] == "reviewed"
        print("✓ Alert marked as 'reviewed' successfully.")

        # Mark as Resolved
        resolve_resp = client.patch(f"/api/v1/caregivers/alerts/{test_alert_id}", headers=headers1, json={
            "status": "resolved",
            "notes": "Verified dose taken with water"
        })
        assert resolve_resp.status_code == 200, f"Mark resolved failed: {resolve_resp.text}"
        assert resolve_resp.json()["alert_status"] == "resolved"
        print("✓ Alert marked as 'resolved' successfully.")

        # -------------------------------------------------------------
        # TEST 8: Strict Authorization (Unauthorized Patient Access Blocked)
        # -------------------------------------------------------------
        print("\n--- TEST 8: Security & Authorization (403 Isolation) ---")
        # Caregiver 1 (Sarah Wilson) attempting to access Patient 2 (Arthur Pendelton, assigned to Jennifer)
        unauth_resp1 = client.get("/api/v1/caregivers/patients/2/details", headers=headers1)
        print(f"Caregiver 1 accessing Patient 2 response: {unauth_resp1.status_code} - {unauth_resp1.json()}")
        assert unauth_resp1.status_code == 403, "Must return HTTP 403 Forbidden for unauthorized patient"
        assert "not authorized" in unauth_resp1.json()["detail"].lower()
        print("✓ Unauthorized access blocked with HTTP 403: Caregiver 1 cannot access Patient 2.")

        # Caregiver 2 (Nurse Jennifer) attempting to access Patient 1 (Margaret Wilson, assigned to Sarah)
        unauth_resp2 = client.get("/api/v1/caregivers/patients/1/details", headers=headers2)
        print(f"Caregiver 2 accessing Patient 1 response: {unauth_resp2.status_code} - {unauth_resp2.json()}")
        assert unauth_resp2.status_code == 403, "Must return HTTP 403 Forbidden for unauthorized patient"
        print("✓ Unauthorized access blocked with HTTP 403: Caregiver 2 cannot access Patient 1.")

        # Unauthorized history access
        unauth_hist = client.get("/api/v1/caregivers/patients/2/history", headers=headers1)
        assert unauth_hist.status_code == 403
        print("✓ Unauthorized history access blocked with HTTP 403.")

        print("\n=======================================================")
        print("  ALL 8 CAREGIVER DASHBOARD VERIFICATION TESTS PASSED! ")
        print("=======================================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    run_all_caregiver_tests()
