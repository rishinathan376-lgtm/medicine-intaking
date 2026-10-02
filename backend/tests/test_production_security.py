import sys
import os
import time

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.caregiver import Caregiver
from app.core.config import settings

client = TestClient(app)

def run_security_tests():
    passed = []
    failed = []

    def record(name: str, condition: bool, msg: str = ""):
        if condition:
            passed.append(name)
            print(f"  ✓ [PASS] {name} {msg}")
        else:
            failed.append((name, msg))
            print(f"  ✗ [FAIL] {name} - {msg}")

    print("\n" + "="*70)
    print("      ELDERMED PRODUCTION SECURITY & HARDENING AUDIT SUITE       ")
    print("="*70 + "\n")

    # -------------------------------------------------------------
    # 1. UNAUTHENTICATED REQUESTS (MUST BE 401 UNAUTHORIZED)
    # -------------------------------------------------------------
    print("▶ 1. Testing Unauthenticated Request Enforcement (Zero Fallback)...")

    # Request without Authorization or simulation headers
    unauth_home = client.get("/api/v1/patients/1/reminder-home")
    record(
        "Unauthenticated /patients/1/reminder-home",
        unauth_home.status_code == 401,
        f"Status: {unauth_home.status_code} ({unauth_home.json().get('detail')})"
    )

    unauth_meds = client.get("/api/v1/medicines")
    record(
        "Unauthenticated /medicines",
        unauth_meds.status_code == 401,
        f"Status: {unauth_meds.status_code}"
    )

    unauth_cg_dash = client.get("/api/v1/caregivers/dashboard")
    record(
        "Unauthenticated /caregivers/dashboard",
        unauth_cg_dash.status_code == 401,
        f"Status: {unauth_cg_dash.status_code}"
    )

    # -------------------------------------------------------------
    # 2. INVALID AND TAMPERED TOKENS (MUST BE 401 UNAUTHORIZED)
    # -------------------------------------------------------------
    print("\n▶ 2. Testing Invalid & Tampered JWT Tokens...")

    bad_token_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.token"}
    )
    record(
        "Tampered JWT Token Rejection",
        bad_token_res.status_code == 401,
        f"Status: {bad_token_res.status_code}"
    )

    garbage_token_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-even-a-jwt"}
    )
    record(
        "Malformed Token Rejection",
        garbage_token_res.status_code == 401,
        f"Status: {garbage_token_res.status_code}"
    )

    # -------------------------------------------------------------
    # 3. PASSWORD STRENGTH VALIDATION
    # -------------------------------------------------------------
    print("\n▶ 3. Testing Password Strength Validation on Registration...")

    ts = int(time.time())
    # Too short (< 8 chars)
    short_pwd_res = client.post("/api/v1/auth/register", json={
        "email": f"short_{ts}@test.org",
        "password": "123",
        "full_name": "Short Password User",
        "role": "patient"
    })
    record(
        "Password Rejection: Too Short (< 8 chars)",
        short_pwd_res.status_code == 422,
        f"Status: {short_pwd_res.status_code}"
    )

    # No numbers / special chars
    no_digit_res = client.post("/api/v1/auth/register", json={
        "email": f"nodigit_{ts}@test.org",
        "password": "onlylettershere",
        "full_name": "No Digit User",
        "role": "patient"
    })
    record(
        "Password Rejection: No Digits or Symbols",
        no_digit_res.status_code == 422,
        f"Status: {no_digit_res.status_code}"
    )

    # Valid strong password
    strong_pwd = "StrongPassword123!"
    reg_valid = client.post("/api/v1/auth/register", json={
        "email": f"strong_{ts}@test.org",
        "password": strong_pwd,
        "full_name": "Strong Password User",
        "phone_number": "+1 (555) 444-2222",
        "role": "patient"
    })
    record(
        "Strong Password Accepted",
        reg_valid.status_code == 201,
        f"Status: {reg_valid.status_code}"
    )
    patient_token = reg_valid.json().get("access_token")
    pt_headers = {"Authorization": f"Bearer {patient_token}"}

    # -------------------------------------------------------------
    # 4. LOGOUT BEHAVIOR
    # -------------------------------------------------------------
    print("\n▶ 4. Testing User Logout...")

    logout_res = client.post("/api/v1/auth/logout", headers=pt_headers)
    record(
        "Logout Endpoint Acknowledgment",
        logout_res.status_code == 200 and "Successfully logged out" in logout_res.json().get("message", ""),
        f"Status: {logout_res.status_code}"
    )

    # -------------------------------------------------------------
    # 5. ADMIN-ONLY OPERATIONS & ROLE AUTHORIZATION
    # -------------------------------------------------------------
    print("\n▶ 5. Testing Admin-Only Operations Protection...")

    # Patient attempting to access admin overview -> 403 Forbidden
    pt_admin_res = client.get("/api/v1/admin/overview", headers=pt_headers)
    record(
        "Patient Access to /admin/overview Blocked (HTTP 403)",
        pt_admin_res.status_code == 403,
        f"Status: {pt_admin_res.status_code}"
    )

    # Caregiver attempting to access admin overview -> 403 Forbidden
    cg_reg = client.post("/api/v1/auth/register", json={
        "email": f"cg_sec_{ts}@test.org",
        "password": strong_pwd,
        "full_name": "Security Test Caregiver",
        "role": "caregiver"
    })
    cg_token = cg_reg.json().get("access_token")
    cg_headers = {"Authorization": f"Bearer {cg_token}"}

    cg_admin_res = client.get("/api/v1/admin/overview", headers=cg_headers)
    record(
        "Caregiver Access to /admin/overview Blocked (HTTP 403)",
        cg_admin_res.status_code == 403,
        f"Status: {cg_admin_res.status_code}"
    )

    # Login as system Admin (admin@eldermed.org / AdminPass123!)
    admin_login = client.post("/api/v1/auth/login", json={
        "email": "admin@eldermed.org",
        "password": "AdminPass123!"
    })
    admin_token = admin_login.json().get("access_token")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_overview_res = client.get("/api/v1/admin/overview", headers=admin_headers)
    record(
        "Admin Access to /admin/overview Granted (HTTP 200)",
        admin_overview_res.status_code == 200 and admin_overview_res.json().get("status") == "healthy",
        f"Total users in system: {admin_overview_res.json().get('metrics', {}).get('total_users')}"
    )

    # Admin lists users
    admin_users_res = client.get("/api/v1/admin/users", headers=admin_headers)
    record(
        "Admin List Users Granted (HTTP 200)",
        admin_users_res.status_code == 200 and len(admin_users_res.json()) > 0
    )

    # -------------------------------------------------------------
    # 6. SENSITIVE CREDENTIAL & SECRET LEAK PREVENTION
    # -------------------------------------------------------------
    print("\n▶ 6. Testing Data Privacy & Secret Exposure Prevention...")

    # Check that neither hashed_password nor password exists in user lists
    users_list = admin_users_res.json()
    has_leak = any("password" in u or "hashed_password" in u for u in users_list)
    record(
        "Zero Password/Hash Exposure in User Lists",
        not has_leak,
        "Checked all user objects: no password or hashed_password fields leaked"
    )

    # -------------------------------------------------------------
    # 7. RATE LIMITING / ABUSE PROTECTION
    # -------------------------------------------------------------
    print("\n▶ 7. Testing Rate Limiting & Abuse Protection...")

    # Test rate limiting by flooding the login endpoint with fast requests
    rate_limited = False
    for i in range(settings.AUTH_RATE_LIMIT_PER_MINUTE + 5):
        burst_res = client.post("/api/v1/auth/login", json={
            "email": "invalid@test.org",
            "password": "WrongPassword1!"
        })
        if burst_res.status_code == 429:
            rate_limited = True
            break

    record(
        "Rate Limiter Throttling (HTTP 429 Too Many Requests)",
        rate_limited,
        "Successfully throttled excessive authentication attempts"
    )

    # -------------------------------------------------------------
    # 8. GLOBAL SANITIZED ERROR HANDLING
    # -------------------------------------------------------------
    print("\n▶ 8. Testing Global Sanitized Error Handling...")

    # Request with invalid patient id in dashboard summary (should be 404, not 500 or leak stack trace)
    safe_err_res = client.get("/api/v1/dashboard/summary?patient_id=9999999", headers=admin_headers)
    record(
        "Sanitized Error on Non-Existent Entity (HTTP 404)",
        safe_err_res.status_code == 404 and "traceback" not in safe_err_res.text.lower(),
        f"Status: {safe_err_res.status_code}"
    )

    print("\n" + "="*70)
    print(f"      PRODUCTION SECURITY AUDIT: {len(passed)} PASSED, {len(failed)} FAILED       ")
    print("="*70)

    if failed:
        print("\nSECURITY FAILURES:")
        for name, msg in failed:
            print(f"  ✗ {name}: {msg}")
        return False
    else:
        print("\nALL PRODUCTION SECURITY CHECKS PASSED WITH 100% SUCCESS!")
        return True

if __name__ == "__main__":
    success = run_security_tests()
    sys.exit(0 if success else 1)
