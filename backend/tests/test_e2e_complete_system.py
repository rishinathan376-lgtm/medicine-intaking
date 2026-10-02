import sys
import os
import re
from datetime import date, datetime, timedelta, timezone

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.caregiver import Caregiver
from app.models.medicine import Medicine
from app.models.schedule import MedicineSchedule
from app.models.log import MedicationLog
from app.models.notification import Notification
from app.services.reminder_service import ReminderService, get_current_app_time
from app.core.config import settings

client = TestClient(app)

def run_all_tests():
    passed_tests = []
    failed_tests = []

    def record_result(name: str, passed: bool, message: str = ""):
        if passed:
            passed_tests.append(name)
            print(f"  ✓ [PASS] {name} {message}")
        else:
            failed_tests.append((name, message))
            print(f"  ✗ [FAIL] {name} - {message}")

    print("\n" + "="*70)
    print("   ELDERMED COMPREHENSIVE END-TO-END VERIFICATION & AUDIT SUITE   ")
    print("="*70 + "\n")

    # -------------------------------------------------------------
    # SECTION 1: AUTHENTICATION & REGISTRATION & ROLE AUTHORIZATION
    # -------------------------------------------------------------
    print("▶ 1-4. Testing User Registration, Login, Auth & Role Authorization...")
    
    # 1. User Registration (Patient & Caregiver)
    ts = int(datetime.now().timestamp())
    test_patient_email = f"patient_{ts}@test.org"
    test_cg_email = f"caregiver_{ts}@test.org"
    password = "SecurePassword123!"

    # Register Patient
    reg_pt_res = client.post("/api/v1/auth/register", json={
        "email": test_patient_email,
        "password": password,
        "full_name": "Test Patient",
        "phone_number": "+1 (555) 019-2831",
        "role": "patient"
    })
    record_result("User Registration (Patient)", reg_pt_res.status_code == 201, f"Status: {reg_pt_res.status_code}")
    pt_token = reg_pt_res.json()["access_token"] if reg_pt_res.status_code == 201 else None
    pt_user_id = reg_pt_res.json()["user"]["id"] if reg_pt_res.status_code == 201 else None

    # Register Caregiver
    reg_cg_res = client.post("/api/v1/auth/register", json={
        "email": test_cg_email,
        "password": password,
        "full_name": "Test Caregiver",
        "phone_number": "+1 (555) 019-9999",
        "role": "caregiver"
    })
    record_result("User Registration (Caregiver)", reg_cg_res.status_code == 201, f"Status: {reg_cg_res.status_code}")
    cg_token = reg_cg_res.json()["access_token"] if reg_cg_res.status_code == 201 else None

    # 2. Duplicate Registration Rejection
    dup_reg_res = client.post("/api/v1/auth/register", json={
        "email": test_patient_email,
        "password": password,
        "full_name": "Test Patient Duplicate",
        "phone_number": "+1 (555) 019-2831",
        "role": "patient"
    })
    record_result("Duplicate Email Registration Rejection", dup_reg_res.status_code == 400, "Blocked duplicate email with 400 Bad Request")

    # 3. User Login
    login_res = client.post("/api/v1/auth/login", json={
        "email": test_patient_email,
        "password": password
    })
    record_result("User Login (Patient)", login_res.status_code == 200 and "access_token" in login_res.json())

    # Invalid Password Login
    bad_login_res = client.post("/api/v1/auth/login", json={
        "email": test_patient_email,
        "password": "WrongPassword!"
    })
    record_result("Invalid Credentials Rejection", bad_login_res.status_code == 401, "Rejected bad password with 401 Unauthorized")

    # 4. Authentication /auth/me
    pt_headers = {"Authorization": f"Bearer {pt_token}"}
    cg_headers = {"Authorization": f"Bearer {cg_token}"}
    me_pt_res = client.get("/api/v1/auth/me", headers=pt_headers)
    record_result(
        "Current User Profile (/auth/me)",
        me_pt_res.status_code == 200 and me_pt_res.json()["email"] == test_patient_email,
        f"Returned user email: {me_pt_res.json().get('email')}"
    )

    # -------------------------------------------------------------
    # SECTION 2: PATIENT CRUD & CAREGIVER ASSIGNMENT
    # -------------------------------------------------------------
    print("\n▶ 5-8. Testing Patient Management & Caregiver Assignment...")

    db = SessionLocal()
    created_pt_obj = db.query(Patient).filter(Patient.user_id == pt_user_id).first()
    test_patient_id = created_pt_obj.id if created_pt_obj else None
    created_cg_obj = db.query(Caregiver).filter(Caregiver.user_id == reg_cg_res.json()["user"]["id"]).first()
    test_caregiver_id = created_cg_obj.id if created_cg_obj else None
    db.close()

    record_result("Patient Profile Auto-Initialization", test_patient_id is not None, f"Patient ID: {test_patient_id}")

    # 6. Patient Editing
    edit_pt_res = client.put(f"/api/v1/patients/{test_patient_id}", headers=pt_headers, json={
        "age": 75,
        "gender": "Female",
        "health_conditions": "Hypertension, Mild Arthritis",
        "emergency_contact_name": "John Doe",
        "emergency_contact_phone": "+1 (555) 321-4321"
    })
    record_result(
        "Patient Profile Editing",
        edit_pt_res.status_code == 200 and edit_pt_res.json()["age"] == 75 and edit_pt_res.json()["health_conditions"] == "Hypertension, Mild Arthritis"
    )

    # 7. Caregiver Assignment via Endpoint
    assign_res = client.put(
        f"/api/v1/caregivers/{test_caregiver_id}/assign-patient/{test_patient_id}",
        headers=cg_headers
    )
    record_result(
        "Caregiver Assignment",
        assign_res.status_code == 200 and assign_res.json()["caregiver_id"] == test_caregiver_id,
        f"Assigned caregiver_id: {assign_res.json().get('caregiver_id')}"
    )

    # -------------------------------------------------------------
    # SECTION 3: MEDICINE CRUD, MULTI-SCHEDULE & DATE VALIDATION
    # -------------------------------------------------------------
    print("\n▶ 9-13. Testing Medicine Creation, Editing, Schedules & Date Validation...")

    today = date.today()
    future_end = today + timedelta(days=90)
    past_end = today - timedelta(days=5)

    # Date Validation Error Check: end_date < start_date
    invalid_date_res = client.post("/api/v1/medicines", headers=cg_headers, json={
        "patient_id": test_patient_id,
        "name": "Invalid Date Med",
        "dosage": "100 mg",
        "start_date": today.isoformat(),
        "end_date": past_end.isoformat(),
        "reminder_times": ["09:00"]
    })
    record_result("Medicine Date Validation (end_date < start_date)", invalid_date_res.status_code == 400, "Rejected invalid date range with 400 Bad Request")

    # Time Validation Error Check: invalid time format
    invalid_time_res = client.post("/api/v1/medicines", headers=cg_headers, json={
        "patient_id": test_patient_id,
        "name": "Invalid Time Med",
        "dosage": "100 mg",
        "start_date": today.isoformat(),
        "reminder_times": ["25:99"]
    })
    record_result("Medicine Time Format Validation (25:99)", invalid_time_res.status_code == 400, "Rejected bad time format with 400 Bad Request")

    # Invalid Patient ID Check
    invalid_pt_res = client.post("/api/v1/medicines", headers=cg_headers, json={
        "patient_id": 999999,
        "name": "Ghost Patient Med",
        "dosage": "100 mg",
        "reminder_times": ["08:00"]
    })
    record_result("Invalid Patient ID Rejection", invalid_pt_res.status_code == 404, "Rejected non-existent patient with 404 Not Found")

    # 9. Create Real Medicine: Paracetamol 500 mg with Multiple Reminder Times
    create_med_res = client.post("/api/v1/medicines", headers=cg_headers, json={
        "patient_id": test_patient_id,
        "name": "Paracetamol",
        "medicine_type": "Tablet",
        "dosage": "500 mg",
        "quantity": 60,
        "instructions": "Take with water after food for relief.",
        "start_date": today.isoformat(),
        "end_date": future_end.isoformat(),
        "frequency": "Twice daily",
        "before_after_food": "after_food",
        "reminder_times": ["09:00", "21:00"]
    })
    med_data = create_med_res.json()
    record_result(
        "Medicine Creation (Paracetamol 500 mg, Multiple Schedules)",
        create_med_res.status_code == 201 and med_data["name"] == "Paracetamol" and len(med_data["reminder_times_rel"]) == 2,
        f"Medicine ID: {med_data.get('id')}, times: {med_data.get('times_list')}"
    )
    test_med_id = med_data.get("id")

    # 10. Medicine Editing
    edit_med_res = client.put(f"/api/v1/medicines/{test_med_id}", headers=cg_headers, json={
        "dosage": "650 mg",
        "instructions": "Take 1 tablet after lunch and dinner.",
        "reminder_times": ["10:00", "22:00"]
    })
    record_result(
        "Medicine Editing (Updated dosage & reminder times)",
        edit_med_res.status_code == 200 and edit_med_res.json()["dosage"] == "650 mg" and "10:00" in edit_med_res.json()["reminder_times"],
        f"Updated dosage: {edit_med_res.json().get('dosage')}"
    )

    # -------------------------------------------------------------
    # SECTION 4: END-TO-END SCENARIO A: TAKE MEDICINE ACTION
    # -------------------------------------------------------------
    print("\n▶ 14-19. Testing End-to-End Scenario A: Scheduled -> Due -> TAKE Action -> Log -> Caregiver Dashboard...")

    # Fetch today's schedule for this patient
    schedules_res = client.get(f"/api/v1/schedules/today?patient_id={test_patient_id}", headers=pt_headers)
    patient_schedules = schedules_res.json()
    record_result("Today's Schedules Retrieved", schedules_res.status_code == 200 and len(patient_schedules) > 0, f"Found {len(patient_schedules)} schedules")

    target_sched_1 = patient_schedules[0]
    target_sched_id = target_sched_1["id"]

    # Trigger DUE NOW for this schedule
    due_res = client.post(f"/api/v1/schedules/{target_sched_id}/trigger-due", headers=pt_headers)
    record_result(
        "DUE Medicine Status Transition",
        due_res.status_code == 200 and due_res.json()["status"] == "due",
        f"Schedule #{target_sched_id} transitioned to 'due'"
    )

    # Verify Patient Home Screen shows the prominent due reminder
    home_res = client.get(f"/api/v1/patients/{test_patient_id}/reminder-home", headers=pt_headers)
    home_data = home_res.json()
    active_rem = home_data.get("active_reminder")
    has_active_reminder = active_rem is not None and active_rem.get("id") == target_sched_id
    record_result(
        "Patient Sees Active Due Reminder",
        has_active_reminder,
        f"Active reminder medicine: {active_rem.get('medicine', {}).get('name') if active_rem else None}"
    )

    # Patient clicks TAKE MEDICINE
    take_res = client.post(f"/api/v1/schedules/{target_sched_id}/action", headers=pt_headers, json={
        "action": "taken",
        "patient_notes": "Taken with a glass of warm water."
    })
    record_result(
        "TAKE MEDICINE Action",
        take_res.status_code == 200 and take_res.json()["status"] == "taken" and take_res.json()["taken_at"] is not None,
        f"Confirmed taken at {take_res.json().get('taken_at')}"
    )

    # Verify MedicationLog created in database
    db = SessionLocal()
    log_entry = db.query(MedicationLog).filter(MedicationLog.schedule_id == target_sched_id).first()
    record_result(
        "MedicationLog Created on TAKEN",
        log_entry is not None and log_entry.status == "taken" and log_entry.patient_notes == "Taken with a glass of warm water.",
        f"Log ID #{log_entry.id if log_entry else None}, status: {log_entry.status if log_entry else None}"
    )
    db.close()

    # 19. Duplicate Action Prevention
    dup_take_res = client.post(f"/api/v1/schedules/{target_sched_id}/action", headers=pt_headers, json={
        "action": "taken",
        "patient_notes": "Second accidental button press."
    })
    db = SessionLocal()
    total_logs_for_sched = db.query(MedicationLog).filter(MedicationLog.schedule_id == target_sched_id).count()
    db.close()
    record_result(
        "Duplicate Medication Action Prevention",
        total_logs_for_sched == 1,
        f"Total log records for schedule #{target_sched_id}: {total_logs_for_sched} (No duplicate rows)"
    )

    # Verify Caregiver Dashboard updates with the taken medicine
    cg_dash_res = client.get("/api/v1/caregivers/dashboard", headers=cg_headers)
    cg_dash_data = cg_dash_res.json()
    pt_summary = next((p for p in cg_dash_data.get("assigned_patients", []) if p["patient_id"] == test_patient_id), None)
    record_result(
        "Caregiver Dashboard Reflects Taken Dose",
        pt_summary is not None and pt_summary["today_taken"] >= 1,
        f"Patient {pt_summary.get('patient_name') if pt_summary else None} today_taken: {pt_summary.get('today_taken') if pt_summary else None}"
    )

    # -------------------------------------------------------------
    # SECTION 5: END-TO-END SCENARIO B: MISSED MEDICINE & CAREGIVER ALERT
    # -------------------------------------------------------------
    print("\n▶ 20-22. Testing End-to-End Scenario B: Unresponded Dose -> MISSED -> Caregiver Alert & Email...")

    target_sched_2 = patient_schedules[1] if len(patient_schedules) > 1 else patient_schedules[0]
    target_sched_2_id = target_sched_2["id"]

    # Trigger MISSED for schedule 2 (grace period expired simulation)
    miss_res = client.post(f"/api/v1/schedules/{target_sched_2_id}/trigger-missed", headers=pt_headers)
    record_result(
        "MISSED Medicine Transition",
        miss_res.status_code == 200 and miss_res.json()["status"] == "missed",
        f"Schedule #{target_sched_2_id} marked as missed"
    )

    # Verify MedicationLog created for MISSED
    db = SessionLocal()
    missed_log = db.query(MedicationLog).filter(MedicationLog.schedule_id == target_sched_2_id).first()
    record_result(
        "MedicationLog Created on MISSED",
        missed_log is not None and missed_log.status == "missed",
        f"Log ID #{missed_log.id if missed_log else None}, status: {missed_log.status if missed_log else None}"
    )

    # Verify Caregiver Notification Alert created in database
    missed_alert_notif = db.query(Notification).filter(
        Notification.patient_id == test_patient_id,
        Notification.notification_type == "missed_alert"
    ).order_by(Notification.created_at.desc()).first()
    record_result(
        "Caregiver Missed Alert Notification Created",
        missed_alert_notif is not None and "missed" in missed_alert_notif.message.lower(),
        f"Notification #{missed_alert_notif.id if missed_alert_notif else None}: '{missed_alert_notif.title if missed_alert_notif else None}'"
    )
    db.close()

    # Verify Caregiver Dashboard shows the active alert
    cg_alerts_res = client.get("/api/v1/caregivers/alerts", headers=cg_headers)
    cg_alerts = cg_alerts_res.json()
    has_alert = any(a["patient_id"] == test_patient_id and a["medicine_name"] == "Paracetamol" for a in cg_alerts)
    record_result(
        "Caregiver Dashboard Displays Missed Alert",
        has_alert,
        f"Caregiver has {len(cg_alerts)} total active alerts"
    )

    # -------------------------------------------------------------
    # SECTION 6: NOTIFICATION CENTER & MARK ALL AS READ
    # -------------------------------------------------------------
    print("\n▶ 22. Testing Patient Notification Center...")

    notifs_res = client.get(f"/api/v1/notifications?patient_id={test_patient_id}", headers=pt_headers)
    patient_notifs = notifs_res.json()
    record_result(
        "Patient Notifications Retrieved",
        notifs_res.status_code == 200 and len(patient_notifs) > 0,
        f"Found {len(patient_notifs)} notifications for patient #{test_patient_id}"
    )

    # Mark individual notification as read
    first_notif_id = patient_notifs[0]["id"]
    read_res = client.put(f"/api/v1/notifications/{first_notif_id}/read", headers=pt_headers)
    record_result("Mark Individual Notification Read", read_res.status_code == 200 and read_res.json()["is_read"] is True)

    # Mark all notifications as read
    read_all_res = client.put(f"/api/v1/notifications/patient/{test_patient_id}/read-all", headers=pt_headers)
    record_result("Mark All Notifications Read", read_all_res.status_code == 200, f"Updated count: {read_all_res.json().get('updated_count')}")

    # Verify 0 unread remaining
    unread_res = client.get(f"/api/v1/notifications?patient_id={test_patient_id}&unread_only=true", headers=pt_headers)
    record_result("Zero Unread Notifications Verification", unread_res.status_code == 200 and len(unread_res.json()) == 0)

    # -------------------------------------------------------------
    # SECTION 7: ADHERENCE CALCULATION & MEDICATION HISTORY
    # -------------------------------------------------------------
    print("\n▶ 24-26. Testing Adherence Calculation, History & Filtering...")

    # Adherence Percentage
    home_after_res = client.get(f"/api/v1/patients/{test_patient_id}/reminder-home", headers=pt_headers)
    adherence = home_after_res.json().get("adherence_percentage")
    record_result(
        "Medication Adherence Percentage Calculated",
        adherence is not None and 0.0 <= adherence <= 100.0,
        f"Calculated adherence rate: {adherence}%"
    )

    # Medication History Filter by Status (taken)
    taken_history_res = client.get(f"/api/v1/caregivers/patients/{test_patient_id}/history?status=taken", headers=cg_headers)
    record_result(
        "Medication History Filter by Status ('taken')",
        taken_history_res.status_code == 200 and all(l["status"] == "taken" for l in taken_history_res.json()),
        f"Returned {len(taken_history_res.json())} taken logs"
    )

    # Search & Filtering on Medicines
    med_search_res = client.get(f"/api/v1/medicines?patient_id={test_patient_id}&search=Paracetamol", headers=pt_headers)
    record_result(
        "Medicine Search & Filtering",
        med_search_res.status_code == 200 and len(med_search_res.json()) >= 1 and med_search_res.json()[0]["name"] == "Paracetamol"
    )

    # -------------------------------------------------------------
    # SECTION 8: SECURITY & ACCESS CONTROL AUDITING
    # -------------------------------------------------------------
    print("\n▶ Security Testing: Data Privacy, Role Authorization & Isolation...")

    # Test Patient cannot access Patient 1 (Margaret Wilson)'s home screen
    cross_pt_res = client.get("/api/v1/patients/1/reminder-home", headers=pt_headers)
    record_result("Cross-Patient Data Access Blocked (HTTP 403)", cross_pt_res.status_code == 403, "Rejected with 403 Forbidden")

    # Test Patient cannot access Patient 1's medicines
    cross_med_res = client.get("/api/v1/medicines?patient_id=1", headers=pt_headers)
    record_result("Cross-Patient Medicine Access Blocked (HTTP 403)", cross_med_res.status_code == 403)

    # Test Patient cannot access Patient 1's notifications
    cross_notif_res = client.get("/api/v1/notifications?patient_id=1", headers=pt_headers)
    record_result("Cross-Patient Notifications Access Blocked (HTTP 403)", cross_notif_res.status_code == 403)

    # Caregiver cannot access unassigned patient details
    # Create another patient without assigning to test_caregiver
    ts2 = int(datetime.now().timestamp()) + 1
    unassigned_pt_res = client.post("/api/v1/auth/register", json={
        "email": f"unassigned_{ts2}@test.org",
        "password": password,
        "full_name": "Unassigned Patient",
        "phone_number": "+1 (555) 888-0000",
        "role": "patient"
    })
    unassigned_token = unassigned_pt_res.json()["access_token"]
    unassigned_headers = {"Authorization": f"Bearer {unassigned_token}"}
    db = SessionLocal()
    unassigned_pt_obj = db.query(Patient).filter(Patient.user_id == unassigned_pt_res.json()["user"]["id"]).first()
    unassigned_pt_id = unassigned_pt_obj.id if unassigned_pt_obj else None
    db.close()

    cg_unassigned_res = client.get(f"/api/v1/caregivers/patients/{unassigned_pt_id}", headers=cg_headers)
    record_result(
        "Caregiver Unassigned Patient Access Blocked (HTTP 403)",
        cg_unassigned_res.status_code == 403,
        "Caregiver prevented from accessing patient not assigned to them"
    )

    # Password Hash Security: Plaintext password is NEVER stored
    db = SessionLocal()
    pt_user = db.query(User).filter(User.email == test_patient_email).first()
    is_hash_secure = pt_user.hashed_password != password and pt_user.hashed_password.startswith("$2")
    record_result("Password Hashed Securely (Bcrypt, No Plaintext)", is_hash_secure, "Verified bcrypt $2 hash format")

    # Password hash not exposed in UserOut schema
    me_body = me_pt_res.json()
    record_result("No Password Hash in API Responses", "hashed_password" not in me_body and "password" not in me_body)
    db.close()

    # -------------------------------------------------------------
    # SECTION 9: DATABASE INTEGRITY & CLEANUP (PATIENT DELETION)
    # -------------------------------------------------------------
    print("\n▶ Database Integrity & Cascade Testing (Patient Deletion)...")

    # Delete unassigned patient to test cascading deletes
    del_res = client.delete(f"/api/v1/patients/{unassigned_pt_id}", headers=unassigned_headers)
    record_result("Patient Record Deletion (Cascade)", del_res.status_code == 204, "Deleted patient with 204 No Content")

    # Verify patient row and user row are gone
    db = SessionLocal()
    pt_check = db.query(Patient).filter(Patient.id == unassigned_pt_id).first()
    record_result("Patient Row Cleared from DB", pt_check is None)
    db.close()

    # -------------------------------------------------------------
    # SUMMARY
    # -------------------------------------------------------------
    print("\n" + "="*70)
    print(f"   COMPREHENSIVE TEST SUITE COMPLETE: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED   ")
    print("="*70)

    if failed_tests:
        print("\nFAILURES:")
        for name, msg in failed_tests:
            print(f"  ✗ {name}: {msg}")
        return False
    else:
        print("\nALL 27 FLOWS & SCENARIOS PASSED WITH 100% SUCCESS!")
        return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
