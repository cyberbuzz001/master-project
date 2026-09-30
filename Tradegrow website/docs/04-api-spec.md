# Trade Grow — API Specification

**Base:** `https://api.tradegrow.in/v1` · JSON · Bearer JWT (internal) · **Status: spec, not built**

---

## 1. Conventions

- All requests and responses `application/json; charset=utf-8`
- Timestamps ISO 8601 with timezone
- Money as decimal strings (`"111.12"`), never floats — floats and currency do not mix
- Pagination: `?page=1&per_page=50`, max 200
- Idempotency: `Idempotency-Key` header required on all POST that create records
- Every mutating request is audit-logged with actor, IP and before/after

### Error shape

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "phone is required",
             "details": [{ "field": "phone", "issue": "required" }],
             "request_id": "req_01HX..." } }
```

Codes: `VALIDATION_FAILED` `UNAUTHENTICATED` `FORBIDDEN` `NOT_FOUND` `CONFLICT`
`RATE_LIMITED` `DND_BLOCKED` `CONSENT_MISSING` `COMPLIANCE_BLOCKED` `INTERNAL`

### Rate limits

| Scope | Limit |
|---|---|
| Public (`/public/*`) | 10 req / min / IP |
| Authenticated | 300 req / min / user |
| Bulk import | 5 req / hour / user |
| Failed login | 5 / 15 min / account, then lockout |

---

## 2. Public endpoints (Zone 1 → Zone 2)

These are the **only** endpoints the marketing site may call. No authentication, aggressively rate
limited, and they never return data — only accept it.

### `POST /public/tickets`

Support ticket from `/support#ticket`.

```json
{ "name": "…", "phone": "…", "email": "…", "clientCode": "…|null",
  "category": "Account opening", "message": "…" }
```

**201** → `{ "reference": "TG-2026-014892", "sla_hours": 24 }`

Rules:
- Rejects any payload containing what looks like an OTP, password, PAN or full account number
  (`COMPLIANCE_BLOCKED`). Customers do paste these; the API must refuse them rather than store them.
- Requires CAPTCHA or proof-of-work token above a threshold rate
- Category `Report suspicious contact or fraud` → priority `high`, routes to Compliance

### `POST /public/events`

Website analytics. See `docs/08-analytics-and-events.md`.

```json
{ "event": "verify_page_view", "path": "/verify/",
  "ts": "2026-09-16T10:00:00+05:30", "sid": "anon-uuid", "props": {} }
```

**202** → `{ "accepted": true }`

Rules: rejects `path` containing a query string; rejects any `props` value matching a phone, email
or PAN pattern; honours `DNT`/`GPC` at the client and drops server-side as a second line of defence.

### `GET /public/charges`

Serves the charge config to the calculator. Cacheable, no auth.

**200** → the contents of `charges.config.json`, minus internal `_README` keys.

> In the current static build this is a flat file at `/assets/config/charges.json`. Moving it behind
> the API is only necessary if rates must change without a rebuild.

---

## 3. Authentication (internal)

### `POST /auth/login`
`{ "email", "password" }` → `202 { "mfa_required": true, "mfa_token": "…" }`

### `POST /auth/mfa`
`{ "mfa_token", "code" }` → `200 { "access_token", "refresh_token", "expires_in": 900, "role" }`

MFA is **mandatory** for `admin`, `super_admin` and `compliance`. Access tokens 15 min; refresh
tokens 8 h, rotating, revocable. Refresh reuse detection → revoke the whole family.

### `POST /auth/logout` · `POST /auth/refresh`

---

## 4. Leads

### `GET /leads`
Query: `stage`, `score_min`, `assigned_to`, `source_id`, `campaign_id`, `search`, `due_before`,
`page`, `per_page`.

**Role scoping is enforced server-side, not by the client:** `SALES_EXECUTIVE` receives only their
own leads regardless of query parameters.

**200**
```json
{ "data": [ { "id": "…", "name": "R… S…", "phone_masked": "98••••3210",
              "stage": "TRUST_VERIFICATION", "score": 65, "band": "B",
              "assigned_agent": { "id": "…", "name": "…" },
              "next_followup_at": "…", "last_activity_at": "…",
              "signals": { "visited_verify": true, "visited_pricing": true,
                           "used_calculator": false, "whatsapp_status": "read" } } ],
  "meta": { "page": 1, "per_page": 50, "total": 1240 } }
```

Phone numbers are masked in list responses. Full numbers are returned only by
`GET /leads/{id}/dial-token`, which is audit-logged per call.

### `GET /leads/{id}` · `POST /leads` · `PATCH /leads/{id}`

`POST /leads` rejects with `DND_BLOCKED` if `phone_hash` matches a DND record. This check is at the
API layer so that every entry path — manual, import, webhook — is covered.

`PATCH` may not set `stage` beyond `WHATSAPP_SENT`; later stages are system-set only
(`FORBIDDEN: stage_is_system_managed`).

### `POST /leads/import`
CSV, ≤ 10,000 rows. Async → `202 { "job_id": "…" }`.
Pipeline: validate → dedupe on `phone_hash` → **DND scrub** → assign → score.
Returns counts for `imported`, `duplicates`, `dnd_blocked`, `invalid`.

### `POST /leads/{id}/dial-token`
Returns a short-lived token the dialler exchanges for the number. Audit-logged.
**The agent's browser never receives the plaintext phone number.**

### `POST /leads/{id}/dnd`
`{ "reason": "customer_request" }` → sets DND, halts all automation, cancels pending followups.
**Irreversible** except by `COMPLIANCE` via `DELETE /leads/{id}/dnd` with a mandatory reason.

---

## 5. Calls

### `POST /calls`
```json
{ "lead_id": "…", "direction": "outbound", "started_at": "…", "ended_at": "…",
  "outcome": "connected", "disposition": "interested",
  "objection": "trust_new_platform", "notes": "…", "next_action": "…",
  "next_followup_at": "…" }
```
**201** → returns the call plus the recomputed lead score and stage.

### `GET /calls` · `GET /calls/{id}` · `GET /calls/{id}/analysis`

`GET /calls/{id}/recording` returns a signed, short-expiry URL. **`COMPLIANCE` and `MANAGER` only**,
audit-logged, and refused entirely if `consent_captured = false`.

---

## 6. WhatsApp

### `POST /whatsapp/send`
```json
{ "lead_id": "…", "template_key": "m1_trust_pack", "params": { "1": "Rahul", "2": "Priya" } }
```

Refuses with:
- `CONSENT_MISSING` — no opt-in recorded
- `DND_BLOCKED` — lead is DND
- `COMPLIANCE_BLOCKED` — template not in `approved` status
- `RATE_LIMITED` — quiet hours, or per-lead frequency cap exceeded

**All four checks are server-side.** A bug in the automation scheduler must not be able to message a
DND lead.

### `POST /whatsapp/webhook`
Provider callbacks for delivery/read/reply/opt-out. Signature-verified.
An inbound reply **pauses automation** and creates an agent task. `STOP` sets DND.

---

## 7. Onboarding status (Zone 2 → Zone 3)

### `GET /kyc/{lead_id}/status`

**200** → `{ "status": "under_review", "external_ref": "KYC-…", "updated_at": "…" }`

**This endpoint returns a status enum and nothing else.** It must never return PAN, Aadhaar, bank
details, document URLs or images. Reviewers should treat any change that widens this response as a
security-critical change.

### `POST /kyc/webhook`
Signed callback from the onboarding system on status change. Updates `kyc_status`, advances the lead
stage, halts acquisition automation on activation, and triggers the post-activation sequence.

---

## 8. Content & configuration (admin)

| Endpoint | Notes |
|---|---|
| `GET/PUT /config/site` | Regulatory + contact config. `PUT` requires `COMPLIANCE` co-approval |
| `GET/PUT /config/charges` | Setting `ratesVerified: true` requires a `COMPLIANCE` actor |
| `GET/POST/PATCH /faq` | |
| `GET/POST/PATCH /scripts` | `status: approved` requires a `COMPLIANCE` actor in `approved_by` |
| `GET/POST/PATCH /templates` | WhatsApp templates; same approval gate |
| `GET/POST /documents` | Versioned upload; publishing is audit-logged |
| `GET/POST/PATCH /testimonials` | `published: true` rejected unless consent + verification + compliance approval all present |
| `GET/PUT /scoring-rules` | Audit-logged |

**Two-person rule.** Publishing a regulatory claim, approving a script, or marking rates verified
requires a second actor with the `COMPLIANCE` role. A single compromised admin account cannot put a
false registration number on the website.

---

## 9. Analytics & dashboards

### `GET /analytics/funnel`
`?from=&to=&campaign_id=&agent_id=&source_id=`

```json
{ "stages": [ { "stage": "NEW", "count": 5000 },
              { "stage": "CONTACTED", "count": 3800, "conv_pct": 76.0, "dropoff_pct": 24.0 } ],
  "totals": { "activated": 214, "funded": 168, "first_traded": 141 },
  "cost": { "spend": "450000.00", "cost_per_lead": "90.00",
            "cost_per_activated": "2102.80", "cost_per_funded": "2678.57" } }
```

### `GET /analytics/agents` · `GET /analytics/sources` · `GET /analytics/campaigns`
### `GET /analytics/acquisition-plan`
Returns the 1,000-client model: entered conversion rates, required volumes, actual-vs-required
variance. See `docs/12-acquisition-plan.md`.

---

## 10. Support & grievances

`POST /public/tickets` (§2) · `GET /tickets` · `PATCH /tickets/{id}` ·
`POST /tickets/{id}/escalate` → creates a `grievances` row, sets the SLA clock, notifies the officer
for that level.

`GET /grievances?sla_breached=true` — **must be on the Compliance dashboard by default.**

---

## 11. Webhooks we publish

| Event | Payload |
|---|---|
| `lead.stage_changed` | lead_id, from, to, at |
| `kyc.status_changed` | lead_id, status, at |
| `account.activated` | lead_id, client_code, at |
| `account.funded` | lead_id, at |
| `account.first_trade` | lead_id, at |
| `grievance.sla_breached` | grievance_id, level, due_at |
| `compliance.flag_raised` | call_id, flag, severity |

Signed with HMAC-SHA256, replay window 5 minutes.

**`compliance.flag_raised` should page a human.** It is the one webhook that indicates an agent may
have broken a §1 prohibition on a live call.
