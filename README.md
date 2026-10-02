# ElderMed — Medicine Intaking & Reminder System

> A reliable, enterprise-grade medication management and adherence monitoring platform designed for elderly patients, caregivers, and healthcare administrators.

[![FastAPI](https://img.shields.io/badge/FastAPI-1.0.0-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com)
[![Tests](https://img.shields.io/badge/Tests-147%20Passed-brightgreen)](tests/)

---

## 🏗️ Architecture & Core Components

ElderMed is structured as a decoupled full-stack architecture that can be deployed unified or completely independently:

```text
                                 +-----------------------+
                                 |  React Web App (SPA)  |
                                 |  TypeScript + Tailwind|
                                 +-----------+-----------+
                                             |
                                 HTTPS REST  | (JWT Bearer Auth)
                                             v
+------------------------+       +-----------+-----------+       +------------------------+
|  Continuous Reminder   | <---> |  FastAPI Backend API  | <---> | PostgreSQL Database    |
|  Worker Process        |       |  Uvicorn ASGI Engine  |       | Relational Adherence DB|
+------------------------+       +-----------+-----------+       +------------------------+
                                             |
                                 SMTP TLS    | (Transactional Alerts)
                                             v
                                 +-----------+-----------+
                                 |  Caregiver Email Gate |
                                 +-----------------------+
```

- **Frontend (`/frontend`)**: React 19 + TypeScript + Vite + Tailwind CSS with accessibility-first design:
  - Text scaling controls (`A`, `A+`, `A++`)
  - High-contrast toggle for visual clarity
  - Touch targets $\ge 48\text{ px}$ with auditory chime feedback
  - Decoupled API service driven by `VITE_API_URL`
- **Backend (`/backend`)**: Python + FastAPI + SQLAlchemy 2.0 ORM:
  - Strict Role-Based Access Control (Patient, Caregiver, Administrator)
  - Bcrypt 12-round secure password hashing
  - Sliding-window rate limiting & brute-force throttling
  - Database-backed health check probe at `/health`
  - Automated database migration engine via Alembic
- **Database**: PostgreSQL 14+ via `psycopg3` driver with foreign key cascades and automatic fallback for development.
- **Reminder Engine**: State-machine transition lifecycle (`upcoming` $\to$ `due` $\to$ `taken` / `missed`), 30-minute grace period enforcement, and duplicate prevention.

---

## 📁 Repository Directory Structure

```text
medicine-intakeing/
├── docker-compose.yml           # Production-like multi-container orchestration
├── .env.example                 # Root environment variables template
├── README.md                    # Core project documentation
├── DEPLOYMENT.md                # In-depth production deployment guide
│
├── backend/                     # FastAPI Python Backend
│   ├── Dockerfile               # Multi-stage lightweight Python production image
│   ├── .dockerignore
│   ├── .env.example             # Backend configuration template
│   ├── requirements.txt         # Production Python dependencies
│   ├── setup_db.py              # Database verification script
│   ├── alembic.ini              # Alembic migration configuration
│   ├── alembic/                 # Database schema migration revisions
│   ├── app/
│   │   ├── main.py              # FastAPI application & /health probe
│   │   ├── worker.py            # Standalone background reminder worker process
│   │   ├── core/
│   │   │   ├── config.py        # Settings & environment variable validation
│   │   │   ├── database.py      # SQLAlchemy engine, pool, sessionmaker
│   │   │   ├── security.py      # Bcrypt hashing & JWT token issuing
│   │   │   ├── rate_limiter.py  # IP-based rate limiting middleware
│   │   │   └── init_db.py       # Table creation, migrations, and admin initialization
│   │   ├── models/              # Relational database models
│   │   ├── schemas/             # Pydantic validation schemas
│   │   ├── routes/              # REST API controllers
│   │   └── services/            # Reminder engine & email services
│   └── tests/                   # 147 Comprehensive automated test cases
│
└── frontend/                    # React + Vite + TypeScript Frontend
    ├── Dockerfile               # Multi-stage builder + Nginx production image
    ├── nginx.conf               # Production Nginx SPA routing & API reverse proxy
    ├── .dockerignore
    ├── .env.example             # Frontend configuration template
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── App.tsx
    │   ├── components/          # Reusable healthcare UI components
    │   ├── services/            # ApiService client
    │   └── types/               # TypeScript interfaces
    └── dist/                    # Production bundle output
```

---

## ⚙️ Environment Configuration

### Backend Environment (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

| Key | Example / Default | Description |
|:---|:---|:---|
| `ENVIRONMENT` | `production` | Enables production security constraints |
| `DEBUG` | `false` | Disables debug mode and hides Swagger docs in production |
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/medreminder_db` | PostgreSQL connection string |
| `SECRET_KEY` | *(64-hex string)* | Secret for signing JWT authentication tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| `1440` | JWT token lifetime (24 hours) |
| `FRONTEND_URL` | `https://app.eldermed.org` | Primary frontend web application URL |
| `CORS_ORIGINS` | `https://app.eldermed.org` | Comma-separated allowed CORS origins |
| `RUN_SCHEDULER_IN_APP` | `true` | Runs scheduler inside FastAPI lifespan (set `false` if using worker) |
| `SEED_DEMO_DATA` | `false` | Set to `false` in production to prevent mock demo data |
| `ADMIN_INITIAL_EMAIL` | `admin@eldermed.org` | Initial system administrator email |
| `ADMIN_INITIAL_PASSWORD` | `YourSecurePassword!` | Initial system administrator password |
| `GRACE_PERIOD_MINUTES` | `30` | Minutes before unresponded due dose transitions to missed |
| `APP_TIMEZONE` | `Asia/Kolkata` | Timezone for medication scheduling |
| `REMINDER_CHECK_INTERVAL_SECONDS` | `15` | Frequency of reminder lifecycle scans |
| `EMAIL_ENABLED` | `false` | Set `true` to enable SMTP notification delivery |
| `SMTP_HOST` | `smtp.sendgrid.net` | Outgoing SMTP mail server |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS) |
| `SMTP_USER` | `apikey` | SMTP account username |
| `SMTP_PASSWORD` | `secret` | SMTP account password |
| `SMTP_FROM_EMAIL` | `notifications@eldermed.org` | Verified sender email address |

### Frontend Environment (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

| Key | Example | Description |
|:---|:---|:---|
| `VITE_API_URL` | `https://api.eldermed.org` | Backend API URL (leave empty if reverse-proxied at `/api/v1`) |

---

## 🚀 Local Development Setup

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run database setup & table migrations
python setup_db.py

# Start FastAPI development server with hot-reload
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- Interactive API Docs: `http://127.0.0.1:8000/docs`
- Health Check Probe: `http://127.0.0.1:8000/health`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:3000`

---

## 🧪 Testing Suite Execution

ElderMed includes a comprehensive test suite of **147 automated tests**:

```bash
cd backend
source venv/bin/activate

# 1. Run Complete Final End-to-End Integration Suite (64 Tests)
python tests/test_final_integration_e2e.py

# 2. Run Production Security & RBAC Audit (16 Tests)
python tests/test_production_security.py

# 3. Run Full System Workflow Suite (40 Tests)
python tests/test_e2e_complete_system.py

# 4. Run Patient Reminder & Notification Suite (11 Tests)
python tests/test_patient_reminder_system.py

# 5. Run Caregiver Dashboard Monitoring Suite (8 Tests)
python tests/test_caregiver_dashboard.py

# 6. Run Core Reminder Engine Lifecycle Suite (8 Tests)
python tests/test_reminder_system.py
```

Frontend build and lint validation:

```bash
cd frontend
npm run build    # Validates TypeScript compilation and builds dist/ bundle
npx oxlint       # Runs fast static analysis across all TSX components
```

---

## 🐳 Docker & Docker Compose Deployment

ElderMed is packaged with production-ready Docker containers:

### Start Complete Stack (PostgreSQL + Backend + Frontend)

```bash
# Build and run all services in detached mode
docker compose up -d --build

# Inspect running service status
docker compose ps

# View backend and worker logs
docker compose logs -f backend
```

Services exposed:
- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **PostgreSQL**: `localhost:5432`

### Run with Dedicated Background Worker Container

In high-throughput environments where the web server runs multiple ASGI workers:

```bash
docker compose --profile worker up -d
```

---

## ⏰ Production Reminder Scheduler

ElderMed provides two ways to run the reminder engine:

1. **Single-Instance Deployment (Default):**
   Set `RUN_SCHEDULER_IN_APP=true`. The scheduler runs automatically inside the FastAPI lifespan using `asyncio`.
2. **Decoupled Worker Process (Horizontal Scaling):**
   Set `RUN_SCHEDULER_IN_APP=false` on web instances. Run a single dedicated worker container/process:
   ```bash
   cd backend
   source venv/bin/activate
   python -m app.worker
   ```
   *The database engine ensures complete idempotency, preventing duplicate notifications even if multiple scans run.*

---

## 🛡️ Production Health & Monitoring

- **Health Check Endpoint**:
  ```bash
  curl -i http://localhost:8000/health
  ```
  Returns `200 OK` with JSON:
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "environment": "production",
    "version": "1.0.0"
  }
  ```
  If database connectivity is lost, the endpoint returns `503 Service Unavailable`, allowing AWS ALB, Cloudflare, Kubernetes, or Render health probes to trigger automated recovery.

---

## 📜 License

ElderMed is proprietary and confidential. Built for healthcare medication management and patient safety.
