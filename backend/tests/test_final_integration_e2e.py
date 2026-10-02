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

client = TestClient(app)

def run_final_integration_test():
    passed_tests = []
    failed_tests = []

    def record_result(name: str, passed: bool, message: str = ""):
        if passed:
            passed_tests.append(name)
            print(f"  ✓ [PASS] {name} {message}")
        else:
            failed_tests.append((name, message))
            print(f"  ✗ [FAIL] {name} - {message}")

    print("\n" + "="*75)
    print("   ELDERMED: FINAL END-TO-END INTEGRATION TEST & SYSTEM AUDIT   ")
    print("="*75 + "\n")

    db = SessionLocal()
    ts = int(datetime.now().timestamp())

    # =========================================================================
    # PART 1: COMPLETE PATIENT JOURNEY (1-12)
    # =========================================================================
    print("▶ PART 1: Testing Complete Patient Flow (1-12)...")
    patient_email = f"patient_e2e_{ts}@eldermed.org"
    patient_password = "PatientPass123!"

    # 1.1 Patient Registration
    reg_pt_res = client.post("/api/v1/auth/register", json={
        "email": patient_email,
        "password": patient_password,
        "full_name": "E2E Test Patient",
        "phone_number": "+1 (555) 789-0001",
        "role": "patient"
    })
    record_result("1.1 Patient Registration", reg_pt_res.status_code == 201, f"Status: {reg_pt_res.status_code}")
    pt_data = reg_pt_res.json()
    pt_token = pt_data.get("access_token")
    pt_user_id = pt_data.get("user", {}).get("id")

    # 1.2 Patient Login & JWT Acquisition
    login_pt_res = client.post("/api/v1/auth/login", json={
        "email": patient_email,
        "password": patient_password
    })
    record_result("1.2 Patient Login & JWT Token", login_pt_res.status_code == 200 and "access_token" in login_pt_res.json(), f"Status: {login_pt_res.status_code}")
    if login_pt_res.status_code == 200:
        pt_token = login_pt_res.json()["access_token"]
    pt_headers = {"Authorization": f"Bearer {pt_token}"}

    # Fetch patient profile record ID
    pt_record = db.query(Patient).filter(Patient.user_id == pt_user_id).first()
    patient_id = pt_record.id if pt_record else 1

    # 1.3 Patient Dashboard
    pt_dash_res = client.get(f"/api/v1/patients/{patient_id}/dashboard", headers=pt_headers)
    record_result("1.3 Patient Dashboard Summary", pt_dash_res.status_code == 200, f"Status: {pt_dash_res.status_code}")

    # 1.4 Patient Profile View
    pt_prof_res = client.get(f"/api/v1/patients/{patient_id}", headers=pt_headers)
    record_result("1.4 View Complete Patient Profile", pt_prof_res.status_code == 200 and pt_prof_res.json()["id"] == patient_id, f"Patient ID: {patient_id}")

    # 1.5 View Prescribed Medicines
    pt_meds_res = client.get(f"/api/v1/medicines?patient_id={patient_id}", headers=pt_headers)
    record_result("1.5 View Patient Medicines List", pt_meds_res.status_code == 200, f"Status: {pt_meds_res.status_code}")

    # Create a test medicine for patient
    today_str = date.today().isoformat()
    now_time = datetime.now()
    time_due = (now_time - timedelta(minutes=5)).strftime("%H:%M")
    time_future = (now_time + timedelta(minutes=30)).strftime("%H:%M")

    med_create_res = client.post("/api/v1/medicines", headers=pt_headers, json={
        "patient_id": patient_id,
        "name": "Atorvastatin E2E",
        "medicine_type": "Tablet",
        "dosage": "20 mg",
        "quantity": 30,
        "instructions": "Take at bedtime with water",
        "start_date": today_str,
        "end_date": (date.today() + timedelta(days=30)).isoformat(),
        "reminder_times": [time_due, time_future],
        "frequency": "twice_daily",
        "before_after_food": "after_food"
    })
    record_result("1.5b Prescribe Medicine with Multiple Times", med_create_res.status_code == 201, f"Medicine ID: {med_create_res.json().get('id')}")
    test_med_id = med_create_res.json().get("id")

    # 1.6 View Today's Schedule
    schedules_res = client.get(f"/api/v1/schedules/today?patient_id={patient_id}", headers=pt_headers)
    schedules = schedules_res.json() if schedules_res.status_code == 200 else []
    record_result("1.6 View Today's Medication Schedule", schedules_res.status_code == 200 and len(schedules) >= 2, f"Found {len(schedules)} doses today")

    due_sched = schedules[0] if len(schedules) > 0 else None
    second_sched = schedules[1] if len(schedules) > 1 else None

    # 1.7 Receive Reminder (Trigger Due Now)
    trigger_due_res = client.post(f"/api/v1/schedules/{due_sched['id']}/trigger-due", headers=pt_headers)
    record_result("1.7 Receive/Trigger Due Reminder", trigger_due_res.status_code == 200 and trigger_due_res.json()["status"] == "due", f"Dose #{due_sched['id']} marked DUE")

    # Verify patient sees due reminder on Reminder Home
    pt_home_res = client.get(f"/api/v1/patients/{patient_id}/reminder-home", headers=pt_headers)
    record_result("1.7b Patient Home Shows Active Due Reminder", pt_home_res.status_code == 200 and pt_home_res.json().get("active_reminder") is not None, "Active reminder displayed")

    # 1.8 Take Medicine Action
    take_res = client.post(f"/api/v1/schedules/{due_sched['id']}/action", headers=pt_headers, json={
        "action": "taken",
        "patient_notes": "Taken with a glass of water"
    })
    record_result("1.8 TAKE MEDICINE Action", take_res.status_code == 200 and take_res.json()["status"] == "taken", f"Taken at: {take_res.json().get('taken_at')}")

    # Verify MedicationLog created
    log_check = db.query(MedicationLog).filter(MedicationLog.schedule_id == due_sched["id"]).first()
    record_result("1.8b MedicationLog Persisted on TAKE", log_check is not None and log_check.status == "taken", f"Log ID #{log_check.id if log_check else 'N/A'}")

    # 1.9 Mark Medicine as Missed Action
    if second_sched:
        miss_res = client.post(f"/api/v1/schedules/{second_sched['id']}/action", headers=pt_headers, json={
            "action": "missed",
            "patient_notes": "Felt nauseous, skipped dose"
        })
        record_result("1.9 Mark Medicine as MISSED Action", miss_res.status_code == 200 and miss_res.json()["status"] == "missed", f"Schedule #{second_sched['id']} marked missed")

        # Verify MedicationLog created for missed dose
        miss_log_check = db.query(MedicationLog).filter(MedicationLog.schedule_id == second_sched["id"]).first()
        record_result("1.9b MedicationLog Persisted on MISSED", miss_log_check is not None and miss_log_check.status == "missed", f"Log ID #{miss_log_check.id if miss_log_check else 'N/A'}")

    # 1.10 View Medication History & Filtering
    hist_res = client.get(f"/api/v1/logs?patient_id={patient_id}&status_filter=taken", headers=pt_headers)
    record_result("1.10 View Medication History (Filtered by Taken)", hist_res.status_code == 200 and len(hist_res.json()) >= 1, f"Found {len(hist_res.json())} taken logs")

    # 1.11 View Notifications & Mark Read
    notifs_res = client.get(f"/api/v1/notifications?patient_id={patient_id}", headers=pt_headers)
    notifs = notifs_res.json() if notifs_res.status_code == 200 else []
    record_result("1.11 View Patient Notifications", notifs_res.status_code == 200, f"Found {len(notifs)} notifications")

    if len(notifs) > 0:
        notif_id = notifs[0]["id"]
        read_res = client.put(f"/api/v1/notifications/{notif_id}/read", headers=pt_headers)
        record_result("1.11b Mark Single Notification Read", read_res.status_code == 200, f"Notification #{notif_id} read")

    read_all_res = client.put(f"/api/v1/notifications/patient/{patient_id}/read-all", headers=pt_headers)
    record_result("1.11c Mark All Notifications Read", read_all_res.status_code == 200, f"Updated count: {read_all_res.json().get('updated_count')}")

    # 1.12 Update Patient Profile
    update_prof_res = client.put(f"/api/v1/patients/{patient_id}", headers=pt_headers, json={
        "full_name": "E2E Test Patient Updated",
        "phone_number": "+1 (555) 789-9999",
        "age": 75,
        "gender": "Female",
        "health_conditions": "Hypertension, Hyperlipidemia",
        "allergies": "Sulfa drugs",
        "emergency_contact_name": "Emergency Contact Person",
        "emergency_contact_phone": "+1 (555) 999-8888"
    })
    record_result("1.12 Update Patient Profile Details", update_prof_res.status_code == 200 and update_prof_res.json()["age"] == 75, "Profile updated successfully")

    # 1.13 Patient Logout
    logout_pt_res = client.post("/api/v1/auth/logout", headers=pt_headers)
    record_result("1.13 Patient Logout Endpoint", logout_pt_res.status_code == 200, f"Message: {logout_pt_res.json().get('message')}")

    # =========================================================================
    # PART 2: COMPLETE CAREGIVER JOURNEY (1-12)
    # =========================================================================
    print("\n▶ PART 2: Testing Complete Caregiver Flow (1-12)...")
    cg_email = f"caregiver_e2e_{ts}@eldermed.org"
    cg_password = "CaregiverPass123!"

    # 2.1 Caregiver Registration & Login
    reg_cg_res = client.post("/api/v1/auth/register", json={
        "email": cg_email,
        "password": cg_password,
        "full_name": "E2E Caregiver Nurse",
        "phone_number": "+1 (555) 444-3322",
        "role": "caregiver"
    })
    cg_user_id = reg_cg_res.json()["user"]["id"] if reg_cg_res.status_code == 201 else None

    login_cg_res = client.post("/api/v1/auth/login", json={"email": cg_email, "password": cg_password})
    record_result("2.1 Caregiver Login & JWT Authentication", login_cg_res.status_code == 200, f"Status: {login_cg_res.status_code}")
    cg_token = login_cg_res.json()["access_token"] if login_cg_res.status_code == 200 else ""
    cg_headers = {"Authorization": f"Bearer {cg_token}"}

    cg_record = db.query(Caregiver).filter(Caregiver.user_id == cg_user_id).first()
    caregiver_id = cg_record.id if cg_record else 1

    # Assign patient to caregiver
    assign_res = client.put(f"/api/v1/caregivers/{caregiver_id}/assign-patient/{patient_id}", headers=cg_headers)
    record_result("2.2 Caregiver Assignment to Patient", assign_res.status_code == 200, f"Caregiver ID: {caregiver_id} assigned to Patient ID: {patient_id}")

    # 2.3 View Assigned Patients
    cg_pts_res = client.get("/api/v1/caregivers/patients", headers=cg_headers)
    record_result("2.3 View Assigned Patients List", cg_pts_res.status_code == 200 and any(p["patient_id"] == patient_id for p in cg_pts_res.json()), f"Found {len(cg_pts_res.json())} assigned patients")

    # 2.4 Open Patient Details & Profile
    cg_pt_detail_res = client.get(f"/api/v1/caregivers/patients/{patient_id}/details", headers=cg_headers)
    record_result("2.4 Open Detailed Patient Profile as Caregiver", cg_pt_detail_res.status_code == 200, f"Patient Name: {cg_pt_detail_res.json().get('patient', {}).get('user', {}).get('full_name')}")

    # 2.5 View Patient Medicines as Caregiver
    cg_meds_res = client.get(f"/api/v1/medicines?patient_id={patient_id}", headers=cg_headers)
    record_result("2.5 View Patient Medicines as Caregiver", cg_meds_res.status_code == 200, f"Total medicines: {len(cg_meds_res.json())}")

    # 2.6 View Patient Today's Schedule as Caregiver
    cg_sched_res = client.get(f"/api/v1/schedules/today?patient_id={patient_id}", headers=cg_headers)
    record_result("2.6 View Patient Today's Schedule", cg_sched_res.status_code == 200, f"Doses: {len(cg_sched_res.json())}")

    # 2.7 Monitor Taken Medicines on Caregiver Dashboard
    cg_dash_res = client.get("/api/v1/caregivers/dashboard", headers=cg_headers)
    cg_dash = cg_dash_res.json() if cg_dash_res.status_code == 200 else {}
    record_result("2.7 Monitor Taken Medicines on Dashboard", cg_dash_res.status_code == 200 and cg_dash.get("total_taken_today", 0) >= 1, f"Today Taken: {cg_dash.get('total_taken_today')}")

    # 2.8 Monitor Missed Medicines on Dashboard
    record_result("2.8 Monitor Missed Medicines on Dashboard", cg_dash.get("total_missed_today", 0) >= 1, f"Today Missed: {cg_dash.get('total_missed_today')}")

    # 2.9 Receive Missed-Medicine Notification / Alerts
    alerts_res = client.get("/api/v1/caregivers/alerts", headers=cg_headers)
    alerts_list = alerts_res.json() if alerts_res.status_code == 200 else []
    record_result("2.9 Receive Missed-Medicine Notification Alerts", alerts_res.status_code == 200 and len(alerts_list) >= 1, f"Active alerts count: {len(alerts_list)}")

    # 2.10 View Patient Medication History with Filters
    cg_hist_res = client.get(f"/api/v1/caregivers/patients/{patient_id}/history?status=missed", headers=cg_headers)
    record_result("2.10 View Patient Medication History with Filters", cg_hist_res.status_code == 200, f"Found {len(cg_hist_res.json())} missed logs")

    # 2.11 Check Medication Adherence Percentage Calculation
    pt_summary = next((p for p in cg_dash.get("assigned_patients", []) if p["patient_id"] == patient_id), None)
    adherence = pt_summary.get("adherence_percentage") if pt_summary else None
    record_result("2.11 Check Adherence Percentage Calculation", adherence is not None and 0.0 <= adherence <= 100.0, f"Adherence: {adherence}%")

    # 2.12 Review & Resolve Caregiver Alerts
    if len(alerts_list) > 0:
        alert_id = alerts_list[0]["id"]
        # Review alert
        rev_res = client.patch(f"/api/v1/caregivers/alerts/{alert_id}", headers=cg_headers, json={
            "status": "reviewed",
            "notes": "Spoke with patient by phone, confirmed dose skipped safely"
        })
        record_result("2.12a Review Caregiver Alert", rev_res.status_code == 200 and rev_res.json()["alert_status"] == "reviewed", "Alert marked as reviewed")

        # Resolve alert
        res_res = client.patch(f"/api/v1/caregivers/alerts/{alert_id}", headers=cg_headers, json={
            "status": "resolved",
            "notes": "Next dose scheduled on time"
        })
        record_result("2.12b Resolve Caregiver Alert", res_res.status_code == 200 and res_res.json()["alert_status"] == "resolved", "Alert marked as resolved")

    # 2.13 Caregiver Logout
    logout_cg_res = client.post("/api/v1/auth/logout", headers=cg_headers)
    record_result("2.13 Caregiver Logout Endpoint", logout_cg_res.status_code == 200, "Caregiver session terminated")

    # =========================================================================
    # PART 3: COMPLETE ADMIN JOURNEY & ACCESS CONTROL (1-7)
    # =========================================================================
    print("\n▶ PART 3: Testing Complete Admin Flow & Access Control (1-7)...")
    admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    admin_email = admin_user.email if admin_user else "admin@eldermed.org"

    # 3.1 Admin Login
    admin_login_res = client.post("/api/v1/auth/login", json={"email": admin_email, "password": "AdminPass123!"})
    record_result("3.1 Admin Login & JWT Authentication", admin_login_res.status_code == 200, f"Status: {admin_login_res.status_code}")
    admin_token = admin_login_res.json()["access_token"] if admin_login_res.status_code == 200 else ""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3.2 Access Admin Overview Page
    overview_res = client.get("/api/v1/admin/overview", headers=admin_headers)
    record_result("3.2 Access Authorized Admin Overview Page", overview_res.status_code == 200 and overview_res.json()["status"] == "healthy", f"Users: {overview_res.json().get('metrics', {}).get('total_users')}")

    # 3.3 Manage System Users
    admin_users_res = client.get("/api/v1/admin/users", headers=admin_headers)
    record_result("3.3 Access User Management List", admin_users_res.status_code == 200 and len(admin_users_res.json()) >= 3, f"Total accounts: {len(admin_users_res.json())}")

    # 3.4 Manage Patients Directory across System
    admin_pts_res = client.get("/api/v1/patients", headers=admin_headers)
    record_result("3.4 Access Patients Directory as Admin", admin_pts_res.status_code == 200, f"Total patients: {len(admin_pts_res.json())}")

    # 3.5 Verify Role Permissions (Patient & Caregiver Denied Admin Access)
    pt_admin_attempt = client.get("/api/v1/admin/overview", headers=pt_headers)
    record_result("3.5a Patient Access to Admin Overview Denied (HTTP 403)", pt_admin_attempt.status_code == 403, f"Status: {pt_admin_attempt.status_code}")

    cg_admin_attempt = client.get("/api/v1/admin/overview", headers=cg_headers)
    record_result("3.5b Caregiver Access to Admin Overview Denied (HTTP 403)", cg_admin_attempt.status_code == 403, f"Status: {cg_admin_attempt.status_code}")

    # 3.6 Admin Delete User & Cascade Verification
    # Create a temporary user to test deletion
    temp_user_email = f"temp_user_{ts}@test.org"
    temp_user_res = client.post("/api/v1/auth/register", json={
        "email": temp_user_email,
        "password": "TempUserPass123!",
        "full_name": "Temporary User for Deletion",
        "role": "patient"
    })
    temp_id = temp_user_res.json()["user"]["id"] if temp_user_res.status_code == 201 else None

    if temp_id:
        del_user_res = client.delete(f"/api/v1/admin/users/{temp_id}", headers=admin_headers)
        record_result("3.6 Admin Delete User Account", del_user_res.status_code == 204, "User account deleted with 204 No Content")

        # Verify user is gone
        user_in_db = db.query(User).filter(User.id == temp_id).first()
        record_result("3.6b User Account Permanently Cleared from DB", user_in_db is None, "Verified zero rows in database")

    # 3.7 Admin Logout
    logout_admin_res = client.post("/api/v1/auth/logout", headers=admin_headers)
    record_result("3.7 Admin Logout Endpoint", logout_admin_res.status_code == 200, "Admin session closed")

    # =========================================================================
    # PART 4: TEMPORARY TEST MEDICINE SCHEDULE & REMINDER LIFECYCLE FLOW
    # =========================================================================
    print("\n▶ PART 4: Testing Dynamic Reminder Lifecycle & Auto-Transitions...")
    
    # Create medicine with dose 2 minutes in future
    future_time_str = (datetime.now() + timedelta(minutes=2)).strftime("%H:%M")
    temp_med_res = client.post("/api/v1/medicines", headers=pt_headers, json={
        "patient_id": patient_id,
        "name": "Insulin Glargine E2E",
        "medicine_type": "Injection",
        "dosage": "10 Units",
        "quantity": 5,
        "instructions": "Inject subcutaneously into abdomen",
        "start_date": today_str,
        "end_date": (date.today() + timedelta(days=7)).isoformat(),
        "reminder_times": [future_time_str],
        "frequency": "once_daily",
        "before_after_food": "none"
    })
    record_result("4.1 Temporary Medicine Created (Future Dose)", temp_med_res.status_code == 201, f"Scheduled for {future_time_str}")
    temp_med_id = temp_med_res.json()["id"]

    # Verify schedule created
    future_sched = db.query(MedicineSchedule).filter(
        MedicineSchedule.medicine_id == temp_med_id,
        MedicineSchedule.scheduled_date == today_str
    ).first()
    record_result("4.2 Schedule Occurrence Generated in DB", future_sched is not None and future_sched.status == "upcoming", f"Schedule ID: {future_sched.id if future_sched else 'N/A'}")

    # Flow A: Fast-forward / Simulate time reaches dose -> becomes DUE
    trigger_future_due = client.post(f"/api/v1/schedules/{future_sched.id}/trigger-due", headers=pt_headers)
    record_result("4.3 Schedule Transitions to DUE NOW", trigger_future_due.status_code == 200 and trigger_future_due.json()["status"] == "due", "Status: due")

    # Verify patient sees reminder
    pt_home_reminder = client.get(f"/api/v1/patients/{patient_id}/reminder-home", headers=pt_headers)
    active_reminder = pt_home_reminder.json().get("active_reminder")
    record_result("4.4 Patient Sees Active Due Reminder on Screen", active_reminder is not None and active_reminder.get("medicine_id") == temp_med_id, "Reminder displayed to patient")

    # Patient takes medicine
    take_future_res = client.post(f"/api/v1/schedules/{future_sched.id}/action", headers=pt_headers, json={
        "action": "taken",
        "patient_notes": "Confirmed injection"
    })
    record_result("4.5 Patient Clicks TAKE MEDICINE", take_future_res.status_code == 200 and take_future_res.json()["status"] == "taken", "Status changed to taken")

    # Verify Caregiver Dashboard updates
    cg_dash_updated = client.get("/api/v1/caregivers/dashboard", headers=cg_headers).json()
    pt_card_updated = next((p for p in cg_dash_updated.get("assigned_patients", []) if p["patient_id"] == patient_id), {})
    record_result("4.6 Caregiver Dashboard Reflects Taken Dose", pt_card_updated.get("today_taken", 0) >= 2, f"Total taken today: {pt_card_updated.get('today_taken')}")

    # Flow B: Unresponded Dose -> Becomes MISSED -> Caregiver Alert Dispatched
    miss_test_time = (datetime.now() + timedelta(minutes=5)).strftime("%H:%M")
    miss_med_res = client.post("/api/v1/medicines", headers=pt_headers, json={
        "patient_id": patient_id,
        "name": "Metformin Auto-Miss Test",
        "medicine_type": "Tablet",
        "dosage": "500 mg",
        "quantity": 10,
        "instructions": "Take with breakfast",
        "start_date": today_str,
        "end_date": (date.today() + timedelta(days=7)).isoformat(),
        "reminder_times": [miss_test_time],
        "frequency": "once_daily",
        "before_after_food": "with_food"
    })
    miss_med_id = miss_med_res.json()["id"]

    miss_sched = db.query(MedicineSchedule).filter(
        MedicineSchedule.medicine_id == miss_med_id,
        MedicineSchedule.scheduled_date == today_str
    ).first()

    # Trigger Missed due to non-response
    trigger_auto_miss = client.post(f"/api/v1/schedules/{miss_sched.id}/trigger-missed", headers=pt_headers)
    record_result("4.7 Patient Does Not Respond -> Becomes MISSED", trigger_auto_miss.status_code == 200 and trigger_auto_miss.json()["status"] == "missed", "Auto-transitioned to missed")

    # Verify Caregiver Notification Alert Generated
    missed_notif = db.query(Notification).filter(
        Notification.patient_id == patient_id,
        Notification.notification_type == "missed_alert"
    ).order_by(Notification.id.desc()).first()
    record_result("4.8 Caregiver Missed Notification Created", missed_notif is not None, f"Title: {missed_notif.title if missed_notif else 'None'}")

    # Verify Caregiver Dashboard Displays Missed Alert
    cg_alerts_updated = client.get("/api/v1/caregivers/alerts", headers=cg_headers).json()
    record_result("4.9 Caregiver Dashboard Displays Active Alert", len(cg_alerts_updated) >= 1, f"Active alerts: {len(cg_alerts_updated)}")

    # =========================================================================
    # PART 5: REMINDER RELIABILITY & DUPLICATE PREVENTION
    # =========================================================================
    print("\n▶ PART 5: Testing Reminder Reliability & Constraint Validation...")

    # Duplicate Dose Prevention: Attempt to record action again on already taken schedule
    dup_take_res = client.post(f"/api/v1/schedules/{future_sched.id}/action", headers=pt_headers, json={
        "action": "taken"
    })
    record_result("5.1 Duplicate Dose Action Prevention", dup_take_res.status_code == 200, "Idempotent response returned")
    log_count = db.query(MedicationLog).filter(MedicationLog.schedule_id == future_sched.id).count()
    record_result("5.2 Zero Duplicate MedicationLog Rows Created", log_count == 1, f"Exact count in DB: {log_count}")

    # Medicine Start / End Date Validation:
    # Medicine with past end date should NOT generate active schedules
    past_start = (date.today() - timedelta(days=10)).isoformat()
    past_end = (date.today() - timedelta(days=2)).isoformat()
    expired_med_res = client.post("/api/v1/medicines", headers=pt_headers, json={
        "patient_id": patient_id,
        "name": "Amoxicillin Expired Course",
        "medicine_type": "Capsule",
        "dosage": "250 mg",
        "quantity": 10,
        "start_date": past_start,
        "end_date": past_end,
        "reminder_times": ["08:00"],
        "frequency": "once_daily",
        "before_after_food": "none"
    })
    expired_med_id = expired_med_res.json()["id"]

    # Verify no schedule generated for today for expired medicine
    expired_sched_today = db.query(MedicineSchedule).filter(
        MedicineSchedule.medicine_id == expired_med_id,
        MedicineSchedule.scheduled_date == today_str
    ).first()
    record_result("5.3 Expired Medicine Does Not Generate Today Schedule", expired_sched_today is None, "Correctly respects end_date")

    # Timezone & Date Formatting Check
    app_time = get_current_app_time()
    record_result("5.4 Application Timezone & Time Formatting", app_time is not None, f"Current app time: {app_time.isoformat()}")

    # =========================================================================
    # PART 6: DATABASE PERSISTENCE & INTEGRATION RESTART SIMULATION
    # =========================================================================
    print("\n▶ PART 6: Testing Database Integrity & Persistence Across Restart Simulation...")
    
    # Close active database session
    db.close()

    # Reopen fresh database session (Simulating application restart)
    new_db = SessionLocal()
    try:
        persisted_user = new_db.query(User).filter(User.id == pt_user_id).first()
        record_result("6.1 User Record Persisted Across Session Restart", persisted_user is not None and persisted_user.email == patient_email, "User row verified")

        persisted_patient = new_db.query(Patient).filter(Patient.id == patient_id).first()
        record_result("6.2 Patient Record Persisted Across Session Restart", persisted_patient is not None and persisted_patient.age == 75, "Patient row verified")

        persisted_med = new_db.query(Medicine).filter(Medicine.id == test_med_id).first()
        record_result("6.3 Medicine Prescriptions Persisted", persisted_med is not None and persisted_med.name == "Atorvastatin E2E", "Medicine row verified")

        persisted_logs_count = new_db.query(MedicationLog).filter(MedicationLog.patient_id == patient_id).count()
        record_result("6.4 Medication Logs Persisted", persisted_logs_count >= 2, f"Total logs found: {persisted_logs_count}")

        persisted_notifs_count = new_db.query(Notification).filter(Notification.patient_id == patient_id).count()
        record_result("6.5 Notifications Persisted", persisted_notifs_count >= 1, f"Total notifications: {persisted_notifs_count}")
    finally:
        new_db.close()

    # =========================================================================
    # PART 7: RIGOROUS SECURITY & TENANT ISOLATION RE-CHECK
    # =========================================================================
    print("\n▶ PART 7: Testing Security, Privacy & Tenant Isolation...")

    # 7.1 Unauthenticated Request Denied
    unauth_res = client.get(f"/api/v1/patients/{patient_id}")
    record_result("7.1 Unauthenticated Access Blocked (HTTP 401)", unauth_res.status_code == 401, f"Status: {unauth_res.status_code}")

    # 7.2 Cross-Patient Isolation: Patient cannot access another patient's data
    other_patient = db.query(Patient).filter(Patient.id != patient_id).first()
    if other_patient:
        cross_pt_res = client.get(f"/api/v1/patients/{other_patient.id}/dashboard", headers=pt_headers)
        record_result("7.2 Cross-Patient Data Access Blocked (HTTP 403)", cross_pt_res.status_code == 403, f"Status: {cross_pt_res.status_code}")

    # 7.3 Caregiver Unassigned Patient Access Blocked
    if other_patient and other_patient.caregiver_id != caregiver_id:
        unassigned_cg_res = client.get(f"/api/v1/caregivers/patients/{other_patient.id}/details", headers=cg_headers)
        record_result("7.3 Caregiver Unassigned Patient Access Blocked (HTTP 403)", unassigned_cg_res.status_code == 403, f"Status: {unassigned_cg_res.status_code}")

    # 7.4 Zero Secret / Password Hash Leakage in API Responses
    user_check_res = client.get("/api/v1/admin/users", headers=admin_headers)
    if user_check_res.status_code == 200:
        users_list = user_check_res.json()
        has_hash_leak = any("password" in u or "hashed_password" in u for u in users_list)
        record_result("7.4 Zero Password or Hash Leakage in User Schemas", not has_hash_leak, f"Verified across {len(users_list)} returned user objects")

    # =========================================================================
    # SUMMARY OF RESULTS
    # =========================================================================
    print("\n" + "="*75)
    print(f"      FINAL INTEGRATION TEST AUDIT: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED       ")
    print("="*75)

    if failed_tests:
        print("\nFailed Tests:")
        for name, msg in failed_tests:
            print(f"  ✗ {name}: {msg}")
        return False
    else:
        print("\nALL SYSTEM JOURNEYS AND RELIABILITY CHECKS PASSED WITH 100% SUCCESS!\n")
        return True

if __name__ == "__main__":
    success = run_final_integration_test()
    sys.exit(0 if success else 1)
