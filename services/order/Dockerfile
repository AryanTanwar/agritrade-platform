# ─── Stage 1: production deps ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app/services/order
COPY services/order/package*.json ./
RUN npm install --omit=dev --ignore-scripts \
 && npm cache clean --force

# ─── Stage 2: development ─────────────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app/services/order
COPY services/order/package*.json ./
RUN npm install --ignore-scripts
# shared/ has its own package.json — install its deps so Node can resolve them
# from /app/shared/node_modules (services/<name>/node_modules is not in shared/'s ancestor chain).
COPY shared/package.json /app/shared/
RUN cd /app/shared && npm install --ignore-scripts
COPY shared/ /app/shared/
COPY services/order/src/ ./src/
RUN addgroup -S agritrade && adduser -S agritrade -G agritrade
USER agritrade
EXPOSE 3003
CMD ["node", "--max-old-space-size=256", "src/index.js"]

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app/services/order
RUN apk add --no-cache tini \
 && addgroup -S agritrade \
 && adduser  -S agritrade -G agritrade
COPY --from=deps --chown=agritrade:agritrade /app/services/order/node_modules ./node_modules
COPY --chown=agritrade:agritrade shared/ /app/shared/
COPY --chown=agritrade:agritrade services/order/src/ ./src/
COPY --chown=agritrade:agritrade services/order/package.json ./
USER agritrade
ENTRYPOINT ["/sbin/tini", "--"]
EXPOSE 3003
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["node", "--max-old-space-size=256", "--disable-proto=delete", "src/index.js"]
