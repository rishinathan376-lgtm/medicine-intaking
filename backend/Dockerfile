# ==============================================================================
# ELDERMED BACKEND PRODUCTION DOCKERFILE
# Multi-stage lightweight Python container with non-root security execution
# ==============================================================================

FROM python:3.11-slim as base

# Set environment variables for Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Install system dependencies (curl for healthchecks and postgres client libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create unprivileged system user for secure runtime execution
RUN groupadd -g 10001 eldermed && \
    useradd -u 10001 -g eldermed -s /bin/bash -m eldermed

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source code
COPY --chown=eldermed:eldermed . .

# Switch to unprivileged user
USER eldermed

# Expose backend API port
EXPOSE 8000

# Container health probe
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production WSGI/ASGI execution command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
