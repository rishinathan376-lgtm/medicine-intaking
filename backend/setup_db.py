"""
ElderMed Database Setup & Verification Script
Runs schema creation and seed data initialization.
"""
import os
import sys

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.database import engine, Base
from app.core.init_db import init_db

def main():
    print("=" * 60)
    print("ElderMed - Database Setup & Verification")
    print("=" * 60)
    print(f"Target Database URL: {settings.DATABASE_URL}")
    print(f"Active Engine: {engine.url}")
    print("\n1. Creating database tables if not exist...")
    Base.metadata.create_all(bind=engine)
    print("   ✓ All tables created / verified.")

    print("\n2. Initializing seed data...")
    init_db()
    print("   ✓ Initial seed data confirmed.")

    print("\nDatabase is ready for ElderMed application usage.")
    print("=" * 60)

if __name__ == "__main__":
    main()
