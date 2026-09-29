# CymbalFintech Core - Implementation Checklist

- [x] Setup repository structure, copy Cymbal logo asset to portal/docs, and initialize `.gitignore`.
- [x] Implement `services/core-banking` (Go): Ledger, account domain models, SQLite repository, HTTP API, unit tests, and Dockerfile (with concurrency race condition on debit / TOCTOU double-spending and cross-layer statement cache key collision).
- [x] Implement `services/identity-service` (Node.js): Customer KYC onboarding, profile enrichment, JWT auth, unit tests, and Dockerfile (with prototype pollution via recursive merge and JWT RS256/HS256 key confusion flaw).
- [x] Implement `services/payments-service` (Python/FastAPI): Instant transfers (PIX/TED), idempotency manager, webhook dispatcher, unit tests, and Dockerfile (with idempotency race condition / double-execution and SSRF with flawed DNS/metadata filter bypass).
- [x] Implement `services/credit-service` (Node.js): Loan origination, proposal underwriting, contract generator, unit tests, and Dockerfile (with state machine transition bypass and code injection via dynamic financial rule evaluation).
- [x] Implement `services/risk-engine` (Python/FastAPI): Fraud scoring engine, challenge OTP generator, signature verification, unit tests, and Dockerfile (with weak PRNG in financial challenge OTP and timing discrepancy with fallback secret).
- [x] Implement `services/web-portal` (Node.js/Express + Modern UI): Central dashboard integrating Cymbal logo, balances, transfer flow, KYC profile, credit simulator, and live risk metrics.
- [x] Implement root orchestration: `docker-compose.yml`, local startup script `scripts/start-local.sh`, and `Makefile`.
- [x] Implement Cloud Run deployment script `scripts/deploy-cloudrun.sh` with GCP `gcloud` commands and configuration guide.
- [x] Write comprehensive enterprise documentation in `README.md` showcasing architecture, microservices topology, and run guides.
- [x] Verify all services with unit tests, health check endpoints, and local startup validation.

## Phase 2: Web Portal Spanish Localization (es)
- [x] In `services/web-portal/test/portal.test.js`, add tests asserting Spanish transaction descriptions, dates, and error messages.
- [x] In `services/web-portal/portal_controller.js`, translate transaction descriptions, dates, and transfer validation errors to Spanish.
- [x] In `services/web-portal/public/index.html`, translate all UI labels, navigation tabs, metrics, table headers, forms, and descriptions from Portuguese to Spanish, and set `<html lang="es">`.
- [x] In `services/web-portal/public/app.js`, translate UI dynamic strings, toast notifications, risk status messages, and receipt labels to Spanish, using Spanish locale formatting.
- [x] Run `npm test` in `services/web-portal` and project `make test` to verify all tests pass.

## Phase 3: Cloud Run Build Fix
- [x] In `services/core-banking/internal/repository/memory.go`, remove the unused `"fmt"` package import to fix Go compilation failure during container image build.
