import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
from app.core.init_db import init_db
from app.routes import (
    auth_router,
    dashboard_router,
    medicines_router,
    schedules_router,
    logs_router,
    patients_router,
    notifications_router,
    caregivers_router,
    admin_router,
)
from app.core.rate_limiter import RateLimiterMiddleware
from app.services.scheduler import start_reminder_scheduler, stop_reminder_scheduler
from fastapi.responses import JSONResponse
from fastapi import Request, status

from sqlalchemy import text
from app.core.database import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and schema migrations
    init_db()
    # Start background reminder engine if enabled in-app
    if settings.RUN_SCHEDULER_IN_APP:
        start_reminder_scheduler()
    yield
    # Cleanly stop background scheduler on shutdown
    if settings.RUN_SCHEDULER_IN_APP:
        stop_reminder_scheduler()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Elder-Friendly Medicine Intaking & Reminder System Backend API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if (settings.DEBUG or settings.ENABLE_DOCS or settings.ENVIRONMENT != "production") else None,
    redoc_url="/redoc" if (settings.DEBUG or settings.ENABLE_DOCS or settings.ENVIRONMENT != "production") else None
)

# 1. Rate Limiting Middleware (abuse & brute force protection)
app.add_middleware(RateLimiterMiddleware)

# 2. Strict CORS Configuration for Production (supports custom domains and any Vercel deployment URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Patient-Id",
        "X-Patient-Email",
        "X-Caregiver-Email",
        "X-Caregiver-Id",
        "Accept",
        "Origin",
    ],
)

# 3. Global Exception Handler: Sanitize errors and prevent stack trace leaks
@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    logging.getLogger("eldermed.api").error(
        f"Unhandled Server Error on {request.method} {request.url.path}: {exc}",
        exc_info=True
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please contact system support."}
    )

# 4. API V1 Router Registration
api_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_prefix)
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(medicines_router, prefix=api_prefix)
app.include_router(schedules_router, prefix=api_prefix)
app.include_router(logs_router, prefix=api_prefix)
app.include_router(patients_router, prefix=api_prefix)
app.include_router(notifications_router, prefix=api_prefix)
app.include_router(caregivers_router, prefix=api_prefix)
app.include_router(admin_router, prefix=api_prefix)

@app.get("/")
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR
    }

@app.get("/health")
@app.get("/api/health")
@app.get("/api/v1/health")
def health_check():
    """Production health probe for load balancers, Vercel, and container orchestrators."""
    db_status = "connected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as ex:
        db_status = f"error: {ex}"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": db_status,
                "environment": settings.ENVIRONMENT
            }
        )
    return {
        "status": "healthy",
        "database": db_status,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0"
    }

# 5. Vercel Cron Endpoint for Serverless Reminder Lifecycle Execution
@app.get("/api/v1/cron/reminders")
@app.get("/api/cron/reminders")
def cron_reminders():
    """Vercel Cron endpoint: periodic sweep for due reminders and overdue grace periods."""
    from app.services.reminder_service import ReminderService
    from app.core.database import SessionLocal
    with SessionLocal() as db:
        result = ReminderService.process_reminder_lifecycle(db)
        return {
            "status": "success",
            "cycle": "cron",
            "result": result
        }

# 6. Swagger Documentation Aliases for Vercel
@app.get("/api/docs", include_in_schema=False)
@app.get("/api/v1/docs", include_in_schema=False)
async def get_api_documentation():
    if not (settings.DEBUG or settings.ENABLE_DOCS or settings.ENVIRONMENT != "production"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    from fastapi.openapi.docs import get_swagger_ui_html
    return get_swagger_ui_html(
        openapi_url="/api/openapi.json" if app.openapi_url else "/openapi.json",
        title=f"{settings.PROJECT_NAME} - API Docs"
    )

@app.get("/api/openapi.json", include_in_schema=False)
@app.get("/api/v1/openapi.json", include_in_schema=False)
async def get_api_openapi():
    if not (settings.DEBUG or settings.ENABLE_DOCS or settings.ENVIRONMENT != "production"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return JSONResponse(app.openapi())

