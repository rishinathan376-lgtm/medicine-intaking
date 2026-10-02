from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.medicines import router as medicines_router
from app.routes.schedules import router as schedules_router
from app.routes.logs import router as logs_router
from app.routes.patients import router as patients_router
from app.routes.notifications import router as notifications_router
from app.routes.caregivers import router as caregivers_router
from app.routes.admin import router as admin_router

__all__ = [
    "auth_router",
    "dashboard_router",
    "medicines_router",
    "schedules_router",
    "logs_router",
    "patients_router",
    "notifications_router",
    "caregivers_router",
    "admin_router",
]
