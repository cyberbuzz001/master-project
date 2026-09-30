# 15 — Security Audit

## Authentication & Authorization

| Control | Status | Assessment |
|---------|--------|------------|
| Password hashing | Argon2id | SECURE |
| JWT algorithm | HS256 (HMAC-SHA256) | ACCEPTABLE — Consider RS256 for production |
| JWT expiry | 24h access, 30d refresh | ACCEPTABLE |
| JWT secret length | min 32 chars enforced | SECURE |
| Account lockout | 5 attempts → 15min lock | SECURE |
| Role-based access | SUPER_ADMIN/ADMIN/USER/etc. | IMPLEMENTED |
| IDOR protection | Ownership checks on watchlists | PATCHED (P2-7 fix) |

## Critical Security Credentials in .env

**WARNING: The following live credentials are in .env (not in production secrets manager):**

| Credential | Risk Level | Action Required |
|------------|-----------|-----------------|
| ANGELONE_API_KEY=4DBv6HvT | HIGH | Rotate before production |
| ANGELONE_TOTP_SECRET=AV7KF7BEJBOOCVIS53TZZB2VEU | CRITICAL | Rotate immediately (TOTP seed) |
| DHAN_ACCESS_TOKEN=eyJ0eXAi... | HIGH | Token expiry ~2026, rotate |
| DHAN_API_SECRET=e9730aa4-682c... | HIGH | Rotate before production |
| ALPHAVANTAGE_API_KEY=CC23XT2DVHARWKAU | MEDIUM | Rate-limited free tier |
| TRUEDATA_PASSWORD=nikhil208 | HIGH | Rotate |
| JWT_SECRET=stocksharp_jwt_s3cr3t... | CRITICAL | Must be replaced with strong random secret |
| PG_PASSWORD=postgres | MEDIUM | Default password — change for production |

**ACTION: ALL credentials must be removed from .env and stored in:**
- Production: Environment variables on VPS/Docker secrets
- Never commit .env to git (verify .gitignore includes .env)

## HTTP Security Headers (Helmet.js)

| Header | Status | Notes |
|--------|--------|-------|
| Content-Security-Policy | CONFIGURED | Allows unsafe-inline/eval for development |
| HSTS | Production only | max-age=31536000, includeSubDomains, preload |
| X-Content-Type-Options nosniff | ENABLED | |
| X-XSS-Protection | ENABLED | |
| X-Frame-Options DENY | ENABLED | |

**Note:** `unsafe-inline` and `unsafe-eval` in scriptSrc are required for React dev but should be evaluated for production CSP.

## CORS Configuration

| Setting | Value | Assessment |
|---------|-------|------------|
| Allowed origins | Configured via ALLOWED_ORIGINS env | SECURE |
| Local dev override | All localhost:* ports allowed | DEV ONLY — must restrict in production |
| credentials | true | Required for cookie auth |

**ACTION for production:**
```
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Rate Limiting

| Limiter | Window | Max | Scope | Status |
|---------|--------|-----|-------|--------|
| authLimiter | 15 min | 50 (prod) / 500 (dev) | IP | ACTIVE |
| orderLimiter | 1 min | 30 (prod) / 500 (dev) | User ID | ACTIVE |
| apiLimiter | 15 min | 2000 (prod) / 10000 (dev) | IP | ACTIVE |

**Note:** Rate limiters use in-memory store (express-rate-limit default). For multi-instance deployment, use Redis store.

## Input Validation

| Area | Implementation | Status |
|------|---------------|--------|
| Auth inputs | Zod (RegisterSchema, LoginSchema) | SECURE |
| Order inputs | Zod (SubmitOrderSchema) | SECURE |
| Watchlist inputs | Zod schemas | SECURE |
| Admin inputs | Zod schemas | SECURE |
| File uploads | Multer + MIME type check | SECURE |
| SQL injection | Parameterized queries (pg pool) | SECURE — No raw string concat |

## Financial Safety Controls

| Control | Implementation | Status |
|---------|---------------|--------|
| Real-money disable | SafetyLock.REAL_MONEY_TRADING_ALLOWED = false | HARDCODED PERMANENT |
| Real-money API guard | SafetyLock.assertSimulationOnly() on every order | ACTIVE |
| REAL_MONEY_TRADING setting | Cannot be changed via API (guarded at route level) | LOCKED |
| Platform labeling | All API responses include simulationOnly: true | ACTIVE |

## File Upload Security (KYC)

| Control | Status |
|---------|--------|
| Allowed MIME types | Configured in upload.ts |
| Max file size | Limited by multer config |
| Storage | Local disk (`server/uploads/`) |
| Path traversal | Multer handles filename sanitization |

**Note:** For production, KYC documents should be stored in cloud storage (S3/GCS), not local disk.

## WebSocket Security

| Control | Status | Notes |
|---------|--------|-------|
| Authentication | Optional JWT via query param | Unauthenticated access allowed for market ticks |
| Token in URL | JWT in query string | RISK: Token visible in server logs. Consider WSS header auth |
| Rate limiting | None on WebSocket | RISK: Potential for subscription abuse |
| Max subscriptions | 1000 per client | Limit set |
| Heartbeat/zombie cleanup | 30s ping, terminate on failure | ACTIVE |

## Dependency Vulnerabilities

| Package | Version | Risk |
|---------|---------|------|
| better-sqlite3 | 11.8.0 | UNUSED — safe to remove |
| bcryptjs | 2.4.3 | UNUSED — safe to remove |
| @types/ioredis | 4.28.10 | Wrong version — remove |
| argon2 | 0.45.1 | SECURE — Argon2id is best-in-class |
| helmet | 8.3.0 | SECURE |
| express-rate-limit | 8.6.1 | SECURE |

Run `npm audit` for current vulnerability scan.

## Audit Logging

| Action | Logged | Table |
|--------|--------|-------|
| Login | YES | audit_logs |
| Logout | YES | audit_logs |
| Admin balance adjust | YES | audit_logs |
| Order placement | Partial (via orders table) | orders |
| KYC submit | YES | audit_logs |
| Risk setting change | YES | audit_logs |
| Instrument sync | YES | audit_logs |
| User role change | YES | audit_logs |
| User status change | YES | audit_logs |

## Security Recommendations (Priority Order)

1. **CRITICAL:** Rotate ALL API credentials before production deployment
2. **CRITICAL:** Replace default JWT_SECRET with 64+ char random secret
3. **HIGH:** Remove .env from git tracking (audit .gitignore)
4. **HIGH:** Use secrets manager (Vault, AWS Secrets Manager, Docker secrets)
5. **HIGH:** KYC documents → cloud storage (not local disk)
6. **HIGH:** WebSocket JWT → header auth instead of query param
7. **MEDIUM:** Production CSP review (remove unsafe-inline where possible)
8. **MEDIUM:** Rate limiting → Redis store for multi-instance
9. **MEDIUM:** Session invalidation via Redis token blacklist
10. **LOW:** Remove unused packages (better-sqlite3, bcryptjs)
