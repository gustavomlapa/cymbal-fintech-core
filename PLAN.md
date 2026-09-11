# CymbalFintech Core - Security Remediation Plan

Branch: `hot-fix-security`

### Vulnerabilidades Mantidas (Intocadas por solicitação)
- `341eb542` (Critical) - Code Injection em `services/credit-service/src/services/contract_engine.js`
- `eb2ac6aa` (Critical) - JWT Algorithm Confusion em `services/identity-service/src/services/jwt_service.js`
- `6c4ec467` (High) - TOCTOU Race Condition em `services/core-banking/internal/service/banking.go`
- `01186ec6` (High) - Broken State Machine Transition em `services/credit-service/src/services/proposal_store.js`

### Checklist de Execução (TDD)
- [x] In `services/identity-service/test/identity.test.js`, write a failing unit test asserting that `deepMerge` does not pollute `Object.prototype` when `__proto__` is passed.
- [x] In `services/identity-service/src/utils/merge.js`, filter out forbidden prototype keys (`__proto__`, `constructor`, `prototype`) until test passes (Fix `cadfef6a`).
- [x] In `services/risk-engine/tests/test_risk.py`, write a failing unit test asserting OTP generation uses non-predictable CSPRNG.
- [x] In `services/risk-engine/app/engine/otp.py`, replace weak PRNG `random.seed(now_ts)` with CSPRNG `secrets` until test passes (Fix `b850817a`).
- [x] In `services/risk-engine/tests/test_risk.py`, write a failing unit test asserting `PartnerSignatureVerifier` uses constant-time comparison and avoids default vulnerable secrets.
- [x] In `services/risk-engine/app/engine/auth.py`, implement `hmac.compare_digest` and ephemeral random fallback key instead of hardcoded default string until test passes (Fix `27454088`).
- [x] In `services/payments-service/tests/test_payments.py`, write failing unit tests asserting `is_safe_callback_url` rejects metadata IP (169.254.169.254) and private RFC 1918 IPs.
- [x] In `services/payments-service/app/services/webhook_dispatcher.py`, implement DNS resolution and IP address range checks with `ipaddress` until tests pass (Fix `0c2e133f`).
- [x] Run full test suites across all services and verify git status.

