# CymbalFintech Core - Implementation Checklist

- [x] Setup repository structure, copy Cymbal logo asset to portal/docs, and initialize `.gitignore`.
- [x] Implement `services/core-banking` (Go): Ledger, account domain models, SQLite repository, HTTP API, unit tests, and Dockerfile (with concurrency race condition on debit / TOCTOU double-spending and cross-layer statement cache key collision).
- [x] Implement `services/identity-service` (Node.js): Customer KYC onboarding, profile enrichment, JWT auth, unit tests, and Dockerfile (with prototype pollution via recursive merge and JWT RS256/HS256 key confusion flaw).
- [ ] Implement `services/payments-service` (Python/FastAPI): Instant transfers (PIX/TED), idempotency manager, webhook dispatcher, unit tests, and Dockerfile (with idempotency race condition / double-execution and SSRF with flawed DNS/metadata filter bypass).
- [ ] Implement `services/credit-service` (Node.js): Loan origination, proposal underwriting, contract generator, unit tests, and Dockerfile (with state machine transition bypass and code injection via dynamic financial rule evaluation).
- [ ] Implement `services/risk-engine` (Python/FastAPI): Fraud scoring engine, challenge OTP generator, signature verification, unit tests, and Dockerfile (with weak PRNG in financial challenge OTP and timing discrepancy with fallback secret).
- [ ] Implement `services/web-portal` (Node.js/Express + Modern UI): Central dashboard integrating Cymbal logo, balances, transfer flow, KYC profile, credit simulator, and live risk metrics.
- [ ] Implement root orchestration: `docker-compose.yml`, local startup script `scripts/start-local.sh`, and `Makefile`.
- [ ] Implement Cloud Run deployment script `scripts/deploy-cloudrun.sh` with GCP `gcloud` commands and configuration guide.
- [ ] Write comprehensive enterprise documentation in `README.md` showcasing architecture, microservices topology, and run guides.
- [ ] Verify all services with unit tests, health check endpoints, and local startup validation.
