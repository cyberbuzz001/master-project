# Security & Compliance Specification

## 1. Technical Safeguard Enforcement
- `REAL_MONEY_TRADING = false` hardcoded lock prevents real-money broker order placement.
- `SafetyLock.assertSimulationOnly()` called prior to any trading action.

---

## 2. Authentication & Session Security
- Passwords hashed using `bcrypt` (10 salt rounds).
- Stateful/stateless JWT token validation with 24-hour expiration.
- TOTP 2FA hook supported in user entity.

---

## 3. Data Isolation & RBAC
- All user resource queries enforce `WHERE user_id = :authenticated_user_id` to eliminate Insecure Direct Object Reference (IDOR) vulnerabilities.
- Administrative endpoints protected via `checkRole(['SUPER_ADMIN', 'ADMIN', ...])` middleware.

---

## 4. Audit Logging
- Every administrative funds adjustment, settings change, login, and order submission produces an immutable audit record in `audit_logs` and `admin_actions`.
