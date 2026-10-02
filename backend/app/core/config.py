import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ElderMed - Medicine Intaking & Reminder System"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Database Configuration - Defaults to PostgreSQL with fallback capability
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg://postgres:postgres@localhost:5432/medreminder_db"
    )
    
    # JWT Security Configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-eldermed-production-key-change-in-env-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))  # 24 hours
    
    # Frontend URL & CORS Configuration
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    CORS_ORIGINS_STR: str = os.getenv(
        "CORS_ORIGINS", 
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    )
    
    @property
    def CORS_ORIGINS(self) -> List[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS_STR.split(",") if origin.strip()]
        if self.FRONTEND_URL and self.FRONTEND_URL.strip():
            f_url = self.FRONTEND_URL.strip()
            if f_url not in origins:
                origins.append(f_url)
        return origins

    # Rate Limiting & Abuse Protection
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    AUTH_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "60"))
    API_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("API_RATE_LIMIT_PER_MINUTE", "300"))
    
    # Reminder & Grace Period (minutes after scheduled time before caregiver alert)
    GRACE_PERIOD_MINUTES: int = int(os.getenv("GRACE_PERIOD_MINUTES", "30"))
    APP_TIMEZONE: str = os.getenv("APP_TIMEZONE", "Asia/Kolkata")
    REMINDER_CHECK_INTERVAL_SECONDS: int = int(os.getenv("REMINDER_CHECK_INTERVAL_SECONDS", "15"))
    RUN_SCHEDULER_IN_APP: bool = os.getenv("RUN_SCHEDULER_IN_APP", "true").lower() == "true"
    
    # Production Database Seeding Control
    SEED_DEMO_DATA: bool = os.getenv("SEED_DEMO_DATA", "true" if os.getenv("ENVIRONMENT", "development") != "production" else "false").lower() == "true"
    ADMIN_INITIAL_EMAIL: str = os.getenv("ADMIN_INITIAL_EMAIL", "admin@eldermed.org")
    ADMIN_INITIAL_PASSWORD: str = os.getenv("ADMIN_INITIAL_PASSWORD", "AdminPass123!")

    # Email / SMTP Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "notifications@eldermed.org")
    EMAIL_ENABLED: bool = os.getenv("EMAIL_ENABLED", "false").lower() == "true"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
