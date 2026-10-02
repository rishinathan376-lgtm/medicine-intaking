import time
from collections import defaultdict
from threading import Lock
from typing import Dict, List, Tuple
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings

class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Lightweight, thread-safe in-memory sliding-window rate limiter.
    Protects authentication and sensitive API endpoints from brute-force & denial-of-service abuse
    without requiring external infrastructure dependencies.
    """
    def __init__(self, app):
        super().__init__(app)
        self.lock = Lock()
        # Maps client_ip -> list of timestamps
        self.auth_requests: Dict[str, List[float]] = defaultdict(list)
        self.general_requests: Dict[str, List[float]] = defaultdict(list)
        self.last_cleanup = time.time()

    def _cleanup_old_entries(self, current_time: float):
        """Periodically purge entries older than 60 seconds to keep memory minimal."""
        if current_time - self.last_cleanup > 60:
            for ip in list(self.auth_requests.keys()):
                self.auth_requests[ip] = [t for t in self.auth_requests[ip] if current_time - t < 60]
                if not self.auth_requests[ip]:
                    del self.auth_requests[ip]

            for ip in list(self.general_requests.keys()):
                self.general_requests[ip] = [t for t in self.general_requests[ip] if current_time - t < 60]
                if not self.general_requests[ip]:
                    del self.general_requests[ip]

            self.last_cleanup = current_time

    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Skip rate limiting for static docs or OpenAPI spec
        path = request.url.path
        if path in ["/docs", "/redoc", "/openapi.json", "/"]:
            return await call_next(request)

        # Determine client IP (handles standard X-Forwarded-For if behind a proxy)
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not client_ip:
            client_ip = request.client.host if request.client else "127.0.0.1"

        now = time.time()

        with self.lock:
            self._cleanup_old_entries(now)

            # 1. Stricter limit on authentication endpoints (/auth/login, /auth/register)
            if "/auth/login" in path or "/auth/register" in path:
                window = [t for t in self.auth_requests[client_ip] if now - t < 60]
                if len(window) >= settings.AUTH_RATE_LIMIT_PER_MINUTE:
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={"detail": "Too many authentication attempts. Please try again in 1 minute."},
                        headers={"Retry-After": "60"}
                    )
                window.append(now)
                self.auth_requests[client_ip] = window

            # 2. General limit on API endpoints
            window = [t for t in self.general_requests[client_ip] if now - t < 60]
            if len(window) >= settings.API_RATE_LIMIT_PER_MINUTE:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests. Please slow down and try again later."},
                    headers={"Retry-After": "60"}
                )
            window.append(now)
            self.general_requests[client_ip] = window

        return await call_next(request)
