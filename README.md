# AgriTrade Platform

Farm-to-buyer agricultural trade platform with Hyperledger Fabric blockchain supply chain transparency.

## Architecture

```
Clients (Farmer App / Buyer Portal / Logistics Portal)
           │
    API Gateway (Express + Helmet + CORS + Rate Limiter)
           │
   ┌───────┼───────────────────────┐
   │       │                       │
 User   Listings  Orders  Payment  Logistics  Notifications
Service Service  Service  Service  Service    Service
   │       │       │        │        │
   └───────┴───────┴────────┴────────┘
                   │
      Hyperledger Fabric Network
   (Farmers Org | Buyers Org | Logistics Org)
                   │
         PostgreSQL + Redis + IPFS
```

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 20 | Backend services |
| Docker + Docker Compose | Latest | Local environment |
| Go | ≥ 1.22 | Chaincode |
| Hyperledger Fabric binaries | 2.5 | Blockchain network |
| kubectl | Latest | Kubernetes deployment |
| Vault CLI | ≥ 1.16 | Secrets management |

## Quick Start

```bash
# 1. Clone and set up
git clone https://github.com/your-org/agritrade.git
cd agritrade
make setup                 # installs deps + creates .env from template

# 2. Edit environment variables
nano .env                  # fill in all CHANGE_ME values

# 3. Start all services
make docker-up             # starts postgres, redis, vault, gateway, all services

# 4. Start Fabric network (in separate terminal)
make fabric-up

# 5. Verify everything is running
curl http://localhost:8080/health
```

## Development

```bash
make dev             # Hot-reload dev mode
make test            # Run all tests
make lint            # ESLint + GoLint
make security-audit  # npm audit + Snyk + Trivy
```

## Project Structure

```
agritrade/
├── gateway/               API gateway (entry point)
│   ├── src/
│   │   ├── index.js       Main server
│   │   ├── middleware/    Security middleware
│   │   └── routes/        Route handlers (Phase 3)
│   └── Dockerfile
├── services/              Microservices
│   ├── user/              Auth, KYC, 2FA
│   ├── listing/           Produce listings
│   ├── order/             Order lifecycle
│   ├── payment/           Escrow & payouts
│   ├── logistics/         3PL integration
│   └── notification/      SMS/Email/Push
├── shared/                Shared utilities
│   ├── crypto/            AES-256, bcrypt, HMAC
│   ├── validators/        Joi schemas
│   ├── logger.js          Structured logging
│   ├── db.js              PostgreSQL pool
│   ├── redis-client.js    Redis client
│   └── error-handler.js   Global error handling
├── chaincode/             Hyperledger Fabric smart contracts (Go)
│   ├── trade/
│   ├── escrow/
│   ├── supplychain/
│   └── logistics/
├── fabric/                Fabric network config
├── infra/                 Infrastructure config
│   ├── postgres/          DB schema + migrations
│   ├── vault/             Secrets policies
│   ├── cert-manager/      TLS certificates
│   └── ssl/               SSL scripts
├── k8s/                   Kubernetes manifests
│   ├── deployments/
│   ├── secrets/           SealedSecrets
│   ├── network-policy/    Zero-trust network policies
│   └── ingress/
├── monitoring/            Prometheus + Grafana + Alertmanager
├── siem/                  Wazuh SIEM config
├── tests/                 All tests
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   └── load/              k6 load tests
└── .github/workflows/     CI/CD pipelines
```

## Security Architecture

### Layers of Defence

1. **Network layer** — TLS 1.3 only, NGINX WAF, k8s NetworkPolicy (default deny-all)
2. **Gateway layer** — Helmet headers, CORS whitelist, rate limiting (Redis-backed), XSS clean, SQL injection guard
3. **Application layer** — JWT with refresh rotation, AES-256-GCM for PII, bcrypt for passwords, Joi validation
4. **Data layer** — PostgreSQL RLS, parameterised queries, audit log (append-only), AES-256 at rest
5. **Secrets layer** — HashiCorp Vault, SealedSecrets in k8s, no secrets in code or env files
6. **CI/CD layer** — Gitleaks secret scan, npm audit, Snyk, Trivy, CodeQL SAST, licence check
7. **Runtime layer** — Wazuh SIEM, Prometheus alerting, structured audit logs

### Environment Variables

Never commit `.env`. Use `.env.example` as a template.
All production secrets live in HashiCorp Vault — see `secrets/vault-init.sh`.

## Deployment

```bash
# Production deploy (requires k8s context)
make deploy
```

See `.github/workflows/deploy.yml` for the full CI/CD pipeline.

## Phase Progress

- [x] **Phase 1** — Project setup, security scaffold, CI/CD ← YOU ARE HERE
- [ ] **Phase 2** — Hyperledger Fabric network & chaincode
- [ ] **Phase 3** — Backend microservices (auth, listings, orders, payments)
- [ ] **Phase 4** — Frontend (React web + React Native)
- [ ] **Phase 5** — Testing, security audit & hardening
- [ ] **Phase 6** — Kubernetes deployment & monitoring
