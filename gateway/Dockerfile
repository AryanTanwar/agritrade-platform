# ─── Stage 1: production deps ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app/gateway
COPY gateway/package*.json ./
# Use npm install (not npm ci) — gateway is a workspace member and has no
# standalone package-lock.json; the root lockfile lives one level up.
RUN npm install --omit=dev --ignore-scripts \
 && npm cache clean --force

# ─── Stage 2: development ─────────────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app/gateway
COPY gateway/package*.json ./
RUN npm install --ignore-scripts
# shared/ has its own package.json so Node resolves its deps (ioredis, pg,
# winston, etc.) from /app/shared/node_modules — gateway's node_modules is not
# in shared/'s ancestor chain.
COPY shared/package.json /app/shared/
RUN cd /app/shared && npm install --ignore-scripts
COPY shared/ /app/shared/
COPY gateway/src/ ./src/
RUN addgroup -S agritrade && adduser -S agritrade -G agritrade
USER agritrade
EXPOSE 8080
CMD ["node", "--max-old-space-size=256", "src/index.js"]

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app/gateway
RUN apk add --no-cache tini \
 && addgroup -S agritrade \
 && adduser  -S agritrade -G agritrade
COPY --from=deps --chown=agritrade:agritrade /app/gateway/node_modules ./node_modules
# Install shared's own deps so Node can resolve them when shared/*.js requires.
COPY --chown=agritrade:agritrade shared/package.json /app/shared/
RUN cd /app/shared && npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=agritrade:agritrade shared/ /app/shared/
COPY --chown=agritrade:agritrade gateway/src/ ./src/
COPY --chown=agritrade:agritrade gateway/package.json ./
USER agritrade
ENTRYPOINT ["/sbin/tini", "--"]
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["node", "--max-old-space-size=256", "--disable-proto=delete", "src/index.js"]
