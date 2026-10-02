import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

logger = logging.getLogger("eldermed.db")

Base = declarative_base()

def get_engine():
    db_url = settings.DATABASE_URL
    # Normalize postgres connection strings for psycopg3
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    # Attempt connecting with configured DATABASE_URL
    try:
        connect_args = {}
        if db_url.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
        
        test_engine = create_engine(
            db_url,
            pool_pre_ping=True,
            connect_args=connect_args
        )
        
        # Test connection
        with test_engine.connect() as conn:
            pass
        logger.info(f"Connected successfully to database: {db_url.split('@')[-1] if '@' in db_url else db_url}")
        return test_engine
    except Exception as e:
        if settings.ENVIRONMENT == "production":
            logger.critical(
                f"FATAL: Production database connection failed for URL: {db_url.split('@')[-1] if '@' in db_url else db_url}. Error: {e}"
            )
            raise
        logger.warning(
            f"Could not connect to configured database at '{db_url}': {e}. "
            "Falling back to local SQLite database (sqlite:///./medreminder.db) for development convenience."
        )
        fallback_url = "sqlite:///./medreminder.db"
        fallback_engine = create_engine(
            fallback_url,
            connect_args={"check_same_thread": False}
        )
        return fallback_engine

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
