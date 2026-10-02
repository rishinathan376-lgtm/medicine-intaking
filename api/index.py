"""
ElderMed - Vercel Serverless Function Entry Point for FastAPI
Routes incoming HTTP requests to the FastAPI ASGI application.
"""
import os
import sys

# Ensure backend directory is in Python module search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
