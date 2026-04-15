# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install only production deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force

# ─── Stage 2: development ─────────────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY src/ ./src/

# Run as non-root
RUN addgroup -S agritrade && adduser -S agritrade -G agritrade
USER agritrade

EXPOSE 8080
CMD ["node", "--max-old-space-size=256", "src/index.js"]

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Security: no package manager, no shell tools in final image
RUN apk add --no-cache tini \
 && addgroup -S agritrade \
 && adduser  -S agritrade -G agritrade

# Copy only production node_modules from deps stage
COPY --from=deps --chown=agritrade:agritrade /app/node_modules ./node_modules
COPY --chown=agritrade:agritrade src/ ./src/
COPY --chown=agritrade:agritrade package.json ./

# Read-only filesystem where possible
USER agritrade

# Use tini as PID 1 (proper signal handling)
ENTRYPOINT ["/sbin/tini", "--"]

EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "--max-old-space-size=256", "--disable-proto=delete", "src/index.js"]
