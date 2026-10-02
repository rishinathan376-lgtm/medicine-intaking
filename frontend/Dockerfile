# ==============================================================================
# ELDERMED FRONTEND PRODUCTION DOCKERFILE
# Multi-stage build: compiles Vite bundle and serves with optimized Nginx
# ==============================================================================

# Stage 1: Build production bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci

# Copy frontend source code
COPY . .

# Optional build-time argument for external API URL
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# Build production bundle
RUN npm run build

# Stage 2: Production Web Server
FROM nginx:1.25-alpine

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration with SPA routing and API proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose web port
EXPOSE 80

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
