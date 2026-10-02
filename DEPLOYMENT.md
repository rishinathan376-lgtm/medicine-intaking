# ElderMed Production Deployment & Hardening Guide

This document outlines the deployment, security hardening, database setup, and operational instructions for running the **ElderMed Medicine Intaking & Reminder System** in production.

---

## 1. System Architecture

- **Backend**: Python 3.10+ / FastAPI / SQLAlchemy / Uvicorn (ASGI)
- **Database**: PostgreSQL 14+ with `psycopg` (v3) binary driver (with automatic SQLite fallback for local developer environments)
- **Frontend**: React 18 / TypeScript / Vite / Tailwind CSS
- **Scheduler**: APScheduler background daemon checking reminder windows and grace periods every 15 seconds
- **Security**: JWT (HS256) bearer authentication, bcrypt password hashing, sliding-window IP rate limiting, strict CORS filtering, and role-based access control (RBAC).

---

## 2. Environment Configuration

Copy the template file `.env.example` in the `backend/` directory to `.env`:

```bash
cd backend
cp .env.example .env
```

### Essential Production Variables

| Variable | Recommended Production Value | Description |
|---|---|---|
| `ENVIRONMENT` | `production` | Enables production mode |
| `DATABASE_URL` | `postgresql+psycopg://user:pwd@db-host:5432/medreminder_db` | PostgreSQL connection string |
| `SECRET_KEY` | *64-character random hex string* | Used to sign JWTs (`python3 -c "import secrets; print(secrets.token_hex(32))"`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24h) or `720` (12h) | JWT lifespan |
| `CORS_ORIGINS` | `https://app.eldermed.org` | Comma-separated allowed frontend origins (no wildcards) |
| `RATE_LIMIT_ENABLED` | `true` | Enables anti-abuse & brute force throttling |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `60` | Max auth requests/min per IP |
| `API_RATE_LIMIT_PER_MINUTE` | `300` | Max general API requests/min per IP |
| `GRACE_PERIOD_MINUTES` | `30` | Grace period before auto-marking missed dose |
| `APP_TIMEZONE` | `Asia/Kolkata` (or regional tz) | Timezone for schedule calculations |
| `EMAIL_ENABLED` | `true` | Enables real-time SMTP emails to caregivers |
| `SMTP_HOST` | `smtp.sendgrid.net` / `email-smtp.us-east-1.amazonaws.com` | Production SMTP host |
| `SMTP_PORT` | `587` | STARTTLS port |
| `SMTP_USER` | `apikey` | SMTP username |
| `SMTP_PASSWORD` | `<secure-api-key>` | SMTP password or API token |
| `SMTP_FROM_EMAIL` | `notifications@eldermed.org` | Verified sender address |

---

## 3. Database Setup (PostgreSQL)

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS (Homebrew)
   brew install postgresql@16 && brew services start postgresql@16

   # Ubuntu / Debian
   sudo apt update && sudo apt install -y postgresql postgresql-contrib
   sudo systemctl enable --now postgresql
   ```

2. **Create Database and User**:
   ```sql
   CREATE DATABASE medreminder_db;
   CREATE USER eldermed_admin WITH ENCRYPTED PASSWORD 'StrongSecurePassword123!';
   GRANT ALL PRIVILEGES ON DATABASE medreminder_db TO eldermed_admin;
   \c medreminder_db
   GRANT ALL ON SCHEMA public TO eldermed_admin;
   ```

3. **Initialize Tables and Seed Data**:
   The backend auto-creates all tables and relationships on startup via `lifespan` in `app/main.py`. You can also manually trigger initialization:
   ```bash
   cd backend
   source venv/bin/activate
   python setup_db.py
   ```

---

## 4. Backend Startup (Production)

### Running with Gunicorn + Uvicorn Workers

In production, run using `gunicorn` with multiple `uvicorn` workers behind an Nginx reverse proxy:

```bash
cd backend
source venv/bin/activate
pip install gunicorn

# Start with 4 worker processes
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 127.0.0.1:8000 \
  --access-logfile /var/log/eldermed/access.log \
  --error-logfile /var/log/eldermed/error.log \
  --daemon
```

### Systemd Service Configuration (`/etc/systemd/system/eldermed-api.service`)

```ini
[Unit]
Description=ElderMed API Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/eldermed/backend
EnvironmentFile=/var/www/eldermed/backend/.env
ExecStart=/var/www/eldermed/backend/venv/bin/gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 5. Frontend Build (Production)

1. **Install Dependencies**:
   ```bash
   cd frontend
   npm ci
   ```

2. **Validate and Lint**:
   ```bash
   npx oxlint
   ```

3. **Build Optimized Production Bundle**:
   ```bash
   npm run build
   ```
   The compiled static assets are output to `frontend/dist/`.

4. **Nginx Reverse Proxy & Static Hosting Config**:
   ```nginx
   server {
       listen 80;
       server_name app.eldermed.org;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name app.eldermed.org;

       ssl_certificate /etc/letsencrypt/live/app.eldermed.org/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/app.eldermed.org/privkey.pem;

       # Security Headers
       add_header X-Frame-Options "DENY" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-XSS-Protection "1; mode=block" always;
       add_header Referrer-Policy "strict-origin-when-cross-origin" always;
       add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://app.eldermed.org; style-src 'self' 'unsafe-inline'; script-src 'self';" always;

       # Serve React Static Assets
       root /var/www/eldermed/frontend/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Proxy API Requests to FastAPI Backend
       location /api/ {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

---

## 6. Security Hardening Checklist Verified

- [x] **Password Hashing**: Passwords stored as salted `bcrypt` hashes; plaintext never stored.
- [x] **Password Strength**: Minimum 8 characters with required letters and digits/special characters.
- [x] **No Secret Leaks**: `hashed_password` excluded from all API output schemas (`UserOut`).
- [x] **Rate Limiting**: Sliding-window throttling active on `/auth/login` and `/auth/register` (60 req/min).
- [x] **Strict CORS**: Configurable via `CORS_ORIGINS` with explicit HTTP methods and headers.
- [x] **Multi-Tenant Privacy**: Strict isolation between patients; attempting to view another patient's records returns `HTTP 403 Forbidden`.
- [x] **Caregiver Assignment Guard**: Caregivers can only access patients assigned to them (`HTTP 403 Forbidden` if unassigned).
- [x] **Admin Authorization Guard**: Supervisory operations (`/api/v1/admin/*`) strictly restricted to `admin` users.
- [x] **Safe Error Handling**: Global exception handler prevents database traces or stack traces from reaching clients.
- [x] **Scheduler Isolation**: Automatic reminder checks run in background thread with exception isolation so background email failures do not crash the app.
