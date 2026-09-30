# API Architecture

## 1. Surface

| Prefix | Audience | Auth |
|---|---|---|
| `/api/v1/public/*` | Anonymous website visitors | None; strict rate limits; honeypot on forms |
| `/api/v1/auth/*` | All users | Sanctum SPA session (cookie) |
| `/api/v1/me/*` | Any authenticated user | Session |
| `/api/v1/admin/*` | Staff with admin-area permissions | Session + 2FA-verified for sensitive roles |
| `/api/v1/employee/*` | Staff | Session (+2FA per role) |
| `/api/v1/client/*` | Clients | Session |
| `/api/v1/integrations/*` | Vendors/partners/automation | Sanctum personal access token with abilities, IP allow-list, expiry |
| `/webhooks/{provider}` | Payment/WhatsApp/email providers | Provider signature; no session |
| `/api/v1/health` | Load balancer | Public liveness; detailed readiness requires `system.health.view` |

Same-origin deployment: browser → `https://expertstocks.in/api/v1/...` (Nginx → PHP-FPM).

## 2. Request pipeline

```
Nginx (TLS, body size, rate limit) →
  RequestId → SecurityHeaders → (sanctum stateful) → EncryptCookies → StartSession → VerifyCsrfToken →
  auth:sanctum → EnsureAccountActive → RequireTwoFactor (role-based) →
  throttle:<named limiter> → FormRequest validation → Controller → Policy → Domain service (DB transaction + audit) →
  API Resource (audience-filtered fields)
```

## 3. Conventions

- JSON only, `snake_case` fields, ISO-8601 UTC timestamps with offset, money as decimal **strings** (`"1234.50"`) plus `currency`.
- Pagination: `?page=&per_page=` (max 100). Response `meta: {current_page, per_page, total, last_page}`.
- Filtering: `?filter[status]=NEW&filter[assigned_employee_id]=12`; sorting `?sort=-created_at` (allow-listed fields only).
- Every response carries `X-Request-Id`. Mutations that create audit entries return `meta.audit_id`.
- Idempotency: `Idempotency-Key` header accepted on POST for payments, invoices, lead intake; replays return the original response for 24h.
- Versioning: breaking changes → `/api/v2`; additive changes stay in v1. Deprecations announced with `Deprecation` and `Sunset` headers.

## 4. Error envelope

```json
{
  "success": false,
  "error_code": "PAYMENT_VERIFICATION_FAILED",
  "message": "Payment could not be verified.",
  "errors": { "field": ["Validation message"] },
  "request_id": "0192b0c6-6c1e-7f3a-9a51-1c2d3e4f5a6b",
  "timestamp": "2026-09-16T10:15:00+00:00"
}
```

`errors` only appears for validation failures. Stack traces are never returned; they are logged with the request ID.

| HTTP | error_code (examples) |
|---|---|
| 400 | `BAD_REQUEST`, `INVALID_STATE_TRANSITION` |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `TWO_FACTOR_REQUIRED`, `TWO_FACTOR_ENROLLMENT_REQUIRED`, `ACCOUNT_INACTIVE` |
| 404 | `NOT_FOUND` |
| 409 | `DUPLICATE_RESOURCE`, `IDEMPOTENCY_CONFLICT` |
| 419 | `CSRF_TOKEN_MISMATCH` |
| 422 | `VALIDATION_FAILED`, `COMPLIANCE_CONFIGURATION_INCOMPLETE`, `DATA_VALIDATION_ERROR` |
| 423 | `ACCOUNT_LOCKED` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |
| 503 | `SERVICE_UNAVAILABLE`, `MARKET_DATA_UNAVAILABLE` |

Success envelope: `{ "success": true, "data": ..., "meta": {...} }`.

## 5. Rate limits (named limiters)

| Limiter | Limit |
|---|---|
| `login` | 5/min per email+IP; progressive account lock after 5 consecutive failures (15 min, doubling, max 24 h) |
| `two-factor` | 5/min per user |
| `public-forms` | 5/min and 20/day per IP |
| `api` (authenticated) | 120/min per user |
| `ai` | per-user and per-agent budgets (Phase 6) |
| `webhooks` | 600/min per provider |

## 6. Phase 1 endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/health` | — | Liveness |
| GET | `/api/v1/public/site` | — | Public company settings (brand, contact) |
| GET | `/api/v1/public/trust-center` | — | Verified regulatory info only + published policy list |
| GET | `/api/v1/public/policies/{slug}` | — | Published policy version |
| POST | `/api/v1/public/leads` | — | Lead intake with consent + attribution |
| POST | `/api/v1/auth/login` | — | Session login |
| POST | `/api/v1/auth/two-factor/challenge` | pending-2FA session | Verify TOTP/recovery code |
| POST | `/api/v1/auth/logout` | auth | Logout |
| GET | `/api/v1/me` | auth | Profile, roles, permissions, 2FA state, areas |
| PUT | `/api/v1/me/password` | auth | Change password (re-auth) |
| POST | `/api/v1/me/two-factor` | auth | Start TOTP enrollment (returns QR SVG + secret) |
| POST | `/api/v1/me/two-factor/confirm` | auth | Confirm enrollment, returns recovery codes once |
| DELETE | `/api/v1/me/two-factor` | auth + password | Disable (blocked for roles requiring 2FA) |
| GET | `/api/v1/me/sessions` | auth | Active sessions |
| DELETE | `/api/v1/me/sessions/{id}` | auth | Revoke a session |
| GET | `/api/v1/me/login-history` | auth | Own login history |
| GET | `/api/v1/admin/dashboard` | `dashboard.admin.view` | Command center metrics (only implemented modules) |
| GET/POST | `/api/v1/admin/users` | `users.view` / `users.create` | List/create staff users |
| GET/PATCH | `/api/v1/admin/users/{id}` | `users.view` / `users.update` | Show/update |
| PUT | `/api/v1/admin/users/{id}/roles` | `roles.assign` (+ Super Admin for privileged roles) | Replace roles |
| POST | `/api/v1/admin/users/{id}/deactivate` | `users.deactivate` | Deactivate + revoke sessions |
| GET | `/api/v1/admin/roles` | `roles.view` | Roles with permissions |
| GET/POST | `/api/v1/admin/teams` | `teams.view` / `teams.manage` | Teams |
| GET | `/api/v1/admin/audit-logs` | `audit.view` | Filterable audit log |
| GET | `/api/v1/admin/login-history` | `users.view` | All login attempts |
| GET | `/api/v1/admin/regulatory-profile` | `regulatory_profile.view` | Active + draft versions |
| POST | `/api/v1/admin/regulatory-profile/versions` | `regulatory_profile.edit` | New draft version |
| POST | `/api/v1/admin/regulatory-profile/versions/{id}/submit` | `regulatory_profile.edit` | Submit for verification |
| POST | `/api/v1/admin/regulatory-profile/versions/{id}/verify` | `regulatory_profile.verify` (≠ creator) | Verify & activate |
| GET | `/api/v1/admin/compliance/readiness` | `regulatory_profile.view` | Publication readiness checklist |
| GET | `/api/v1/admin/policies` | `policies.view_drafts` | Policy documents & versions |
| POST | `/api/v1/admin/policies/{slug}/versions` | `policies.edit` | New draft |
| POST | `/api/v1/admin/policies/versions/{id}/approve` | `policies.approve` (≠ creator) | Approve |
| POST | `/api/v1/admin/policies/versions/{id}/publish` | `policies.publish` | Publish (supersedes previous) |
| GET | `/api/v1/admin/settings` | `settings.view` | Settings (secrets masked) |
| PUT | `/api/v1/admin/settings` | `settings.manage` | Update non-secret settings |
| GET | `/api/v1/employee/dashboard` | `dashboard.employee.view` | Own workload summary |
| GET | `/api/v1/employee/leads` | `leads.view_own/_team/_all` | Scoped lead list (Phase 1 read-only) |
| GET | `/api/v1/client/dashboard` | `portal.access` | Own profile, service & notices |

OpenAPI source of truth: `docs/openapi/openapi.yaml` (served at `/docs/api` in non-production).

## 7. Webhooks (Phase 4+)

`POST /webhooks/{provider}` → store raw body + headers in `webhook_events` (status `received`) → verify signature against provider secret → dedupe on `(provider, event_id)` → enqueue `ProcessWebhookEvent` on `critical` queue → respond `200` quickly. Processing is idempotent; failures retry with backoff and surface in the admin webhook console with replay (re-process stored payload, never re-fetch unsigned data).
