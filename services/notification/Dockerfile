# ─── Stage 1: production deps ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app/services/notification
COPY services/notification/package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force

# ─── Stage 2: development ─────────────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app/services/notification
COPY services/notification/package*.json ./
RUN npm ci --ignore-scripts
COPY shared/ /app/shared/
COPY services/notification/src/ ./src/
RUN addgroup -S agritrade && adduser -S agritrade -G agritrade
USER agritrade
EXPOSE 3006
CMD ["node", "--max-old-space-size=256", "src/index.js"]

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app/services/notification
RUN apk add --no-cache tini \
 && addgroup -S agritrade \
 && adduser  -S agritrade -G agritrade
COPY --from=deps --chown=agritrade:agritrade /app/services/notification/node_modules ./node_modules
COPY --chown=agritrade:agritrade shared/ /app/shared/
COPY --chown=agritrade:agritrade services/notification/src/ ./src/
COPY --chown=agritrade:agritrade services/notification/package.json ./
USER agritrade
ENTRYPOINT ["/sbin/tini", "--"]
EXPOSE 3006
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3006/health || exit 1
CMD ["node", "--max-old-space-size=256", "--disable-proto=delete", "src/index.js"]
