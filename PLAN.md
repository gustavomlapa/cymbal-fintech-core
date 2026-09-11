# CymbalFintech Core - Security Remediation Plan

Branch: `hot-fix-security`

### Vulnerabilidades Mantidas (Intocadas por solicitação do usuário)
- `341eb542` (Critical) - Code Injection em `services/credit-service/src/services/contract_engine.js`
- `6c4ec467` (High) - TOCTOU Race Condition em `services/core-banking/internal/service/banking.go`
- `01186ec6` (High) - Broken State Machine Transition em `services/credit-service/src/services/proposal_store.js`
- `27454088` (High) - Hardcoded secret fallback & timing discrepancy em `services/risk-engine/app/engine/auth.py`

### Checklist de Ajustes (TDD)
- [x] In `services/risk-engine/app/engine/auth.py`, restore original fallback secret and comparison logic (Restore `27454088`).
- [x] In `services/risk-engine/tests/test_risk.py`, remove default secret negative test while keeping OTP test green.
- [x] In `services/identity-service/test/identity.test.js`, write a failing unit test asserting `verifyToken` rejects tokens forged with HS256 algorithm.
- [x] In `services/identity-service/src/services/jwt_service.js`, strictly enforce RS256 algorithm and remove HS256 verification path until test passes (Fix `eb2ac6aa`).
- [x] Run full test suites across all services.
- [x] Commit changes with generic messages (no vulnerability mentions) and push to remote branches (`hot-fix-security` and `hot-fix`).


