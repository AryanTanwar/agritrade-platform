# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: deps — production node_modules only
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app/services/user

COPY services/user/package*.json ./

RUN npm ci --omit=dev --ignore-scripts

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: development — full deps + source
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app/services/user

# Install all deps (including devDependencies)
COPY services/user/package*.json ./
RUN npm ci --ignore-scripts

# Copy shared utilities
COPY shared/ /app/shared/

# Copy service source
COPY services/user/src/ ./src/

# Create non-root user and fix ownership
RUN addgroup -S agritrade && adduser -S agritrade -G agritrade \
    && chown -R agritrade:agritrade /app/services/user /app/shared

USER agritrade

EXPOSE 3001

CMD ["node", "--max-old-space-size=256", "src/index.js"]

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3: production — minimal, tini-based
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install tini for proper PID 1 / signal handling
RUN apk add --no-cache tini wget

WORKDIR /app/services/user

# Copy production node_modules from deps stage
COPY --from=deps /app/services/user/node_modules ./node_modules

# Copy shared utilities
COPY shared/ /app/shared/

# Copy service source and manifest
COPY services/user/src/ ./src/
COPY services/user/package.json ./

# Create non-root user
RUN addgroup -S agritrade && adduser -S agritrade -G agritrade \
    && chown -R agritrade:agritrade /app/services/user /app/shared

USER agritrade

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=256", "--disable-proto=delete", "src/index.js"]
