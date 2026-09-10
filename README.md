# CymbalFintech - Core Financial Infrastructure Platform

<p align="center">
  <img src="docs/assets/cymbal-logo.png" alt="CymbalFintech Logo" width="160"/>
</p>

<p align="center">
  <strong>Next-Generation Cloud-Native Banking & Digital Financial Core</strong><br>
  Microservices architecture handling Multi-Tenant Ledgers, Instant Payments (PIX/TED), KYC Verification, Credit Origination, and Real-Time Behavioral Anti-Fraud.
</p>

---

## 1. Overview

**CymbalFintech** is an enterprise-grade digital banking and financial services platform built to support high-velocity, resilient, and multi-tenant financial operations. Designed with a polyglot microservices paradigm, the platform decouples the double-entry transactional ledger from client-facing orchestration and real-time risk decisioning.

### Key Capabilities
- **Core Banking Ledger:** Immutable double-entry bookkeeping, transactional idempotency, and multi-currency accounts.
- **Identity & KYC Service:** Regulatory customer onboarding, Tier 1–3 profile verification, and tokenized session issuance.
- **Instant Payments Engine (PIX / TED):** High-throughput settlement orchestration conforming to Central Bank instant payment protocols.
- **Credit & Loan Origination:** Automated credit simulation, French amortization modeling (Tabela Price), and underwriting pipeline.
- **Real-Time Risk Engine:** Context-aware behavioral anomaly detection, dynamic step-up OTP challenge, and partner HMAC verification.
- **Central Web Portal & BFF:** Unified, responsive executive dashboard with transaction feeds, balance statements, and credit simulators.

---

## 2. Platform Architecture

The platform follows a domain-driven microservices topology deployed across isolated container runtime boundaries:

```
                          ┌───────────────────────────┐
                          │   Cymbal Web Portal (BFF) │
                          │     (Node.js / Port 3000) │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
           ▼                            ▼                            ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│  Core Banking API   │      │  Identity & KYC API │      │ Payments & PIX API  │
│   (Go / Port 8081)  │      │(Node.js / Port 8082)│      │(Python / Port 8083) │
└──────────┬──────────┘      └─────────────────────┘      └──────────┬──────────┘
           │                                                         │
           └────────────────────────────┬────────────────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
              ┌─────────────────────┐       ┌─────────────────────┐
              │ Credit & Loans API  │       │  Risk & Anti-Fraud  │
              │(Node.js / Port 8084)│       │(Python / Port 8085) │
              └─────────────────────┘       └─────────────────────┘
```

---

## 3. Microservices Portfolio

| Service | Language / Stack | Port | Domain & Responsibilities | Health Endpoint |
|---|---|:---:|---|---|
| **`web-portal`** | Node.js (Vanilla SSR/API) | `3000` | Unified web dashboard, BFF orchestration, frontend assets | `GET /health` |
| **`core-banking`** | Go 1.22 Standard Library | `8081` | Chart of accounts, double-entry ledger, balance transfers | `GET /health` |
| **`identity-service`** | Node.js CommonJS | `8082` | Customer KYC records, document enrichment, JWT tokens | `GET /health` |
| **`payments-service`** | Python 3.11 / FastAPI | `8083` | Instant PIX rails, idempotency cache, partner webhooks | `GET /health` |
| **`credit-service`** | Node.js CommonJS | `8084` | Loan origination, Price schedule engine, proposal states | `GET /health` |
| **`risk-engine`** | Python 3.11 / FastAPI | `8085` | Fraud scoring matrix, step-up OTP generator, HMAC validation | `GET /health` |

---

## 4. Getting Started (Local Development)

### Prerequisites
- **Node.js** (v18+ or v20+)
- **Python** (v3.10+ or v3.11+)
- **Go** (v1.21+ optional, required for native Go compilation)
- **Docker & Docker Compose** (optional for containerized execution)

### Option A: Run Directly on Host
The repository includes a zero-dependency local orchestrator:

```bash
# Clone the repository
git clone https://github.com/cymbal-fintech/core.git
cd cymbal-fintech-core

# Execute all microservices concurrently
bash scripts/start-local.sh
```

Access the web portal at:
```
http://localhost:3000
```

### Option B: Run via Docker Compose
To build and launch all 6 services with containerized health monitoring:

```bash
docker compose up --build -d
```

To view logs or stop the stack:
```bash
docker compose logs -f
docker compose down
```

---

## 5. Automated Testing

All services include comprehensive unit and domain test suites. You can execute all tests with a single command:

```bash
make test
```

This runs:
1. `identity-service` test suite (`node:test`)
2. `payments-service` test suite (`python3 unittest`)
3. `credit-service` test suite (`node:test`)
4. `risk-engine` test suite (`python3 unittest`)
5. `web-portal` test suite (`node:test`)

---

## 6. Google Cloud Run Deployment

All microservices are containerized with multi-stage, hardened Dockerfiles optimized for serverless execution on **Google Cloud Run**.

### Deployment Script
Run the automated deployment script with `gcloud`:

```bash
# Authenticate with your Google Cloud account
gcloud auth login

# Set project ID and region
export GCP_PROJECT="your-gcp-project-id"
export GCP_REGION="southamerica-east1"

# Trigger deployment automation
bash scripts/deploy-cloudrun.sh
```

The script will:
1. Enable `run.googleapis.com`, `cloudbuild.googleapis.com`, and `artifactregistry.googleapis.com`.
2. Build container images and deploy each microservice with serverless scaling.
3. Automatically link backend microservice URLs to the `web-portal` BFF.
4. Output verified public HTTPS endpoints.

---

## 7. API Reference Examples

### Core Banking
```bash
# Fetch Account Balance
curl -s http://localhost:8081/api/v1/accounts/acc_1001

# Execute Account Transfer
curl -s -X POST http://localhost:8081/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{"sourceAccountId": "acc_1001", "destinationAccountId": "acc_1002", "amount": 250.00, "description": "Consultoria"}'
```

### Payments & PIX
```bash
# Process Instant PIX Payment
curl -s -X POST http://localhost:8083/api/v1/payments/pix \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: idem_test_9981" \
  -d '{"sourceAccountId": "acc_1001", "pixKey": "bruno.santos@cymbalfintech.demo", "amount": 180.50, "description": "Servicos"}'
```

### Credit & Underwriting
```bash
# Simulate Personal Loan
curl -s -X POST http://localhost:8084/api/v1/credit/simulate \
  -H "Content-Type: application/json" \
  -d '{"amount": 30000, "termMonths": 24, "annualRate": 0.165}'
```

### Risk & Fraud Engine
```bash
# Evaluate Transaction Risk
curl -s -X POST http://localhost:8085/api/v1/risk/evaluate \
  -H "Content-Type: application/json" \
  -d '{"accountId": "acc_1001", "amount": 65000.00, "destinationPix": "ext@bank.com", "isNewDevice": true}'
```

---

## 8. Regulatory & Security Posture

CymbalFintech architecture follows strict regulatory and data privacy practices:
- **BACEN Resolution No. 1 / PIX Compliance:** End-to-end idempotency and payment message integrity.
- **LGPD (Lei Geral de Proteção de Dados):** Pseudonymized customer profile data and compartmentalized PII access.
- **PCI-DSS Level 1 Principles:** Segregated account vaults and isolated credit underwriting networks.

---

<p align="center">
  <sub>&copy; 2026 CymbalFintech S.A. All rights reserved. Confidential and proprietary.</sub>
</p>