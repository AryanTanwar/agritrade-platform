.PHONY: all setup dev build test lint security-audit clean fabric-up fabric-down docker-up docker-down k8s-bootstrap deploy help

# ─── Variables ────────────────────────────────────────────────────────────────
DOCKER_COMPOSE       = docker compose
DOCKER_COMPOSE_PROD  = docker compose -f docker-compose.prod.yml
NODE                 = node
NPM                  = npm

# ─── Default ──────────────────────────────────────────────────────────────────
all: help

help:
	@echo ""
	@echo "AgriTrade Platform — Available Commands"
	@echo "════════════════════════════════════════"
	@echo "  make setup            Install all dependencies"
	@echo "  make dev              Start all services in dev mode"
	@echo "  make build            Build all services for production"
	@echo "  make test             Run full test suite"
	@echo "  make lint             Run ESLint + GoLint"
	@echo "  make security-audit   Run Snyk + npm audit + Trivy"
	@echo "  make fabric-up        Start Hyperledger Fabric network"
	@echo "  make fabric-down      Tear down Fabric network"
	@echo "  make docker-up        Start all Docker services (dev)"
	@echo "  make docker-down      Stop all Docker services"
	@echo "  make deploy           Deploy to Kubernetes cluster"
	@echo "  make clean            Remove build artefacts"
	@echo ""

# ─── Setup ────────────────────────────────────────────────────────────────────
setup:
	@echo "→ Installing root dependencies..."
	$(NPM) install
	@echo "→ Installing gateway dependencies..."
	cd gateway && $(NPM) install
	@echo "→ Installing service dependencies..."
	for svc in user listing order payment logistics notification; do \
		cd services/$$svc && $(NPM) install && cd ../..; \
	done
	@echo "→ Copying .env.example to .env (if not exists)..."
	cp -n .env.example .env || true
	@echo "✅ Setup complete. Edit .env before starting."

# ─── Development ──────────────────────────────────────────────────────────────
dev:
	$(DOCKER_COMPOSE) up --build

dev-backend:
	$(DOCKER_COMPOSE) up gateway services-user services-listing services-order services-payment services-logistics services-notification postgres redis

# ─── Build ────────────────────────────────────────────────────────────────────
build:
	@echo "→ Building gateway..."
	cd gateway && $(NPM) run build
	@for svc in user listing order payment logistics notification; do \
		echo "→ Building services/$$svc..."; \
		cd services/$$svc && $(NPM) run build && cd ../..; \
	done
	@echo "✅ All services built."

# ─── Tests ────────────────────────────────────────────────────────────────────
test:
	@echo "→ Running unit tests..."
	$(NPM) run test:unit
	@echo "→ Running integration tests..."
	$(NPM) run test:integration
	@echo "→ Running chaincode tests (Go)..."
	cd chaincode && go test ./...

test-e2e:
	npx playwright test

test-load:
	k6 run tests/load/trade-flow.js

# ─── Lint ─────────────────────────────────────────────────────────────────────
lint:
	npx eslint "**/*.js" --ignore-path .gitignore
	cd chaincode && golint ./...

# ─── Security ─────────────────────────────────────────────────────────────────
security-audit:
	@echo "→ npm audit (all services)..."
	$(NPM) audit --audit-level=high
	@echo "→ Snyk test..."
	npx snyk test
	@echo "→ Trivy container scan..."
	trivy image agritrade/gateway:latest
	@echo "→ Secret scan..."
	bash .github/scripts/secret-scan.sh
	@echo "✅ Security audit complete."

dependency-check:
	npx audit-ci --config audit-ci.json

# ─── Hyperledger Fabric ───────────────────────────────────────────────────────
fabric-up:
	bash fabric/scripts/generate.sh
	bash fabric/scripts/network-up.sh

fabric-down:
	bash fabric/scripts/teardown.sh

fabric-deploy-chaincode:
	bash fabric/scripts/deploy-chaincode.sh

# ─── Docker ───────────────────────────────────────────────────────────────────
docker-up:
	$(DOCKER_COMPOSE) up -d

docker-down:
	$(DOCKER_COMPOSE) down

docker-prod-up:
	$(DOCKER_COMPOSE_PROD) up -d

docker-prod-down:
	$(DOCKER_COMPOSE_PROD) down

# ─── Kubernetes ───────────────────────────────────────────────────────────────
# Postgres bootstrap script — mounted by 10-postgres.yaml as an optional ConfigMap.
# Apply via stdin so re-runs are idempotent (kubectl create alone errors on conflict).
k8s-bootstrap:
	kubectl apply -f k8s/deployments/00-namespace.yaml
	kubectl create configmap agritrade-postgres-init \
		--namespace=agritrade \
		--from-file=init.sql=infra/postgres/init.sql \
		--dry-run=client -o yaml | kubectl apply -f -

deploy: k8s-bootstrap
	kubectl apply -f k8s/secrets/
	kubectl apply -f k8s/network-policy/
	kubectl apply -f k8s/deployments/
	kubectl apply -f k8s/ingress/

# ─── Clean ────────────────────────────────────────────────────────────────────
clean:
	find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "build" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "coverage" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.log" -delete 2>/dev/null || true
	@echo "✅ Cleaned."
