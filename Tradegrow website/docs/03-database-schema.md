# Trade Grow — Database Schema

**Target:** PostgreSQL 15+ (MySQL 8 equivalent noted where syntax differs)
**Status:** Specification

---

## 1. Design rules

1. **KYC data never lands here.** PAN, Aadhaar, bank account numbers and document images live only
   in the regulated onboarding system. This database stores a KYC *status* and a reference id.
2. **PII is encrypted at rest** — `phone`, `email`, `name` use application-level encryption
   (envelope encryption with a KMS-held key), not just disk encryption.
3. **Nothing is hard-deleted** except on a lawful erasure request. Use `deleted_at`.
4. **Audit logs are append-only.** No role holds DELETE on `audit_logs`.
5. **No secrets, no OTPs, no passwords stored in plaintext, ever.** OTPs are not stored at all —
   only a hash with a short TTL, in Redis, never in Postgres.

---

## 2. Entity relationship overview

```
                    ┌───────────────┐
                    │ lead_sources  │
                    └───────┬───────┘
                            │
        ┌───────────────┐   │   ┌───────────┐
        │  campaigns    │   │   │ employees │
        └───────┬───────┘   │   └─────┬─────┘
                │           │         │
                └────────┐  │  ┌──────┘
                         ▼  ▼  ▼
                     ┌─────────────┐
           ┌─────────│    leads    │─────────┐
           │         └──────┬──────┘         │
           │                │                │
     ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼──────────┐
     │   calls   │   │  followups  │  │website_events   │
     └─────┬─────┘   └─────────────┘  └─────────────────┘
           │
    ┌──────▼──────────┐    ┌──────────────────┐
    │ call_recordings │    │whatsapp_messages │
    └──────┬──────────┘    └──────────────────┘
           │
    ┌──────▼────────┐
    │ call_analysis │
    └───────────────┘

     leads ──1:1──▶ kyc_status ──1:1──▶ accounts ──1:n──▶ referrals
     leads ──1:n──▶ support_tickets ──1:n──▶ grievances
```

---

## 3. Core tables

### `employees`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| emp_code | varchar(20) UNIQUE | Quoted to customers for verification |
| name | varchar(120) | |
| email | varchar(180) UNIQUE | |
| phone_enc | bytea | Encrypted |
| role | enum | super_admin, admin, manager, team_leader, sales_executive, support, compliance |
| team_id | uuid FK → teams | |
| reporting_to | uuid FK → employees | |
| status | enum | active, suspended, exited |
| password_hash | varchar(255) | Argon2id |
| mfa_secret_enc | bytea | MFA mandatory for admin/compliance |
| last_login_at | timestamptz | |
| created_at, updated_at, deleted_at | timestamptz | |

`INDEX (role, status)` · `INDEX (team_id)`

### `lead_sources`

| Column | Type |
|---|---|
| id | uuid PK |
| name | varchar(120) |
| channel | enum: cold_list, website, referral, campaign, walk_in, partner |
| cost_model | enum: cpl, cpc, fixed, none |
| is_active | bool |

### `campaigns`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | varchar(160) | |
| source_id | uuid FK | |
| start_date, end_date | date | |
| budget | numeric(12,2) | For cost-per-activation |
| followup_config | jsonb | Overrides the default sequence |
| is_active | bool | |

### `leads`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| phone_enc | bytea NOT NULL | |
| phone_hash | char(64) UNIQUE | SHA-256 + pepper. **Dedupe and lookup happen on the hash, never the plaintext** |
| name_enc | bytea | |
| email_enc | bytea | |
| email_hash | char(64) | Nullable, indexed |
| city, state | varchar(80) | |
| source_id | uuid FK | |
| campaign_id | uuid FK | |
| assigned_agent_id | uuid FK → employees | |
| stage | enum | See CRM doc §1 |
| score | smallint DEFAULT 0 | CHECK 0–100 |
| existing_broker | varchar(120) | |
| trading_frequency | enum | daily, weekly, monthly, rare, none |
| segments_traded | varchar[] | |
| primary_concern | text | Customer's own words |
| last_objection | varchar(60) | FK-ish → scripts.linked_objection |
| whatsapp_consent | bool DEFAULT false | |
| whatsapp_consent_at | timestamptz | |
| whatsapp_status | enum | not_sent, sent, delivered, read, replied, opted_out |
| dnd | bool DEFAULT false | |
| dnd_reason | text | |
| dnd_set_by | uuid FK → employees | |
| dnd_set_at | timestamptz | |
| next_followup_at | timestamptz | |
| first_contacted_at, last_activity_at | timestamptz | |
| created_at, updated_at, deleted_at | timestamptz | |

```sql
CREATE UNIQUE INDEX idx_leads_phone_hash ON leads (phone_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_queue    ON leads (assigned_agent_id, next_followup_at)
                                 WHERE dnd = false AND deleted_at IS NULL;
CREATE INDEX idx_leads_stage    ON leads (stage, created_at DESC);
CREATE INDEX idx_leads_score    ON leads (score DESC) WHERE dnd = false;
CREATE INDEX idx_leads_campaign ON leads (campaign_id, stage);
```

> `idx_leads_queue` is the hot path — every agent hits it on every page load of the call queue.
> The partial predicate keeps DND rows out of the index entirely.

### `calls`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid FK | |
| agent_id | uuid FK | |
| direction | enum: outbound, inbound | |
| started_at, ended_at | timestamptz | |
| duration_sec | int | |
| outcome | enum | connected, no_answer, busy, invalid, switched_off, callback, refused |
| disposition | enum | interested, not_interested, callback, dnd, wrong_person, language_barrier |
| objection | varchar(60) | |
| notes | text | |
| next_action | varchar(120) | |
| created_at | timestamptz | |

`INDEX (lead_id, started_at DESC)` · `INDEX (agent_id, started_at DESC)` · `INDEX (outcome, started_at)`

### `call_recordings`

| Column | Type | Notes |
|---|---|---|
| id, call_id | uuid | |
| storage_key | varchar(255) | Object storage, **not** the DB |
| consent_captured | bool NOT NULL | No consent → no recording retained |
| duration_sec | int | |
| retention_until | date | Enforced by a scheduled purge job |
| created_at | timestamptz | |

### `call_analysis`

| Column | Type |
|---|---|
| id, call_id | uuid |
| opening_score, intent_score, response_score | smallint |
| talk_ratio | numeric(4,3) |
| objection_detected | varchar(60) |
| compliance_flags | jsonb |
| missed_opportunity | text |
| recommended_action | text |
| model_version | varchar(40) |
| reviewed_by | uuid FK → employees |
| created_at | timestamptz |

`INDEX (call_id)` · `INDEX ((compliance_flags IS NOT NULL))` — compliance review queue

### `followups`

| Column | Type |
|---|---|
| id, lead_id | uuid |
| assigned_to | uuid FK → employees |
| due_at | timestamptz |
| channel | enum: call, whatsapp, email |
| status | enum: pending, done, skipped, cancelled |
| auto_generated | bool |
| sequence_day | smallint |
| completed_at | timestamptz |
| notes | text |

`INDEX (assigned_to, due_at) WHERE status = 'pending'`

### `whatsapp_messages`

| Column | Type | Notes |
|---|---|---|
| id, lead_id | uuid | |
| template_key | varchar(60) | |
| direction | enum: outbound, inbound | |
| body | text | Rendered copy, for audit |
| status | enum | queued, sent, delivered, read, failed, opted_out |
| provider_message_id | varchar(120) | |
| error_code | varchar(40) | |
| sent_at, delivered_at, read_at | timestamptz | |

`INDEX (lead_id, sent_at DESC)` · `INDEX (status, sent_at)`

### `website_events`

| Column | Type | Notes |
|---|---|---|
| id | bigserial PK | High volume |
| lead_id | uuid NULL FK | Null for unattributed traffic |
| session_id | varchar(40) | Anonymous |
| event | varchar(60) | See analytics doc |
| path | varchar(255) | **Path only. Never query strings.** |
| referrer_host | varchar(120) | Host only, not full URL |
| props | jsonb | Never PII |
| created_at | timestamptz | |

`INDEX (lead_id, created_at DESC)` · `INDEX (event, created_at DESC)` · partition by month.

> Partitioning matters here: this is the only table that grows with traffic rather than with
> customers, and funnel queries are almost always time-bounded.

### `kyc_status`

**Status only. No KYC data.**

| Column | Type | Notes |
|---|---|---|
| id, lead_id | uuid | |
| external_ref | varchar(80) | Reference into the regulated onboarding system |
| status | enum | not_started, started, submitted, under_review, rejected, completed |
| rejection_reason | varchar(200) | Category only, never document content |
| started_at, submitted_at, completed_at | timestamptz | |

### `accounts`

| Column | Type |
|---|---|
| id, lead_id | uuid |
| client_code | varchar(30) UNIQUE |
| activated_at | timestamptz |
| first_funded_at | timestamptz |
| first_traded_at | timestamptz |
| last_traded_at | timestamptz |
| status | enum: active, dormant, closed, suspended |
| segments_enabled | varchar[] |

`INDEX (activated_at)` · `INDEX (status, last_traded_at)`

---

## 4. Content & configuration tables

### `pricing`

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| segment | varchar(40) | |
| charge_key | varchar(40) | brokerage, stt, gst, stamp_duty, exchange_txn, sebi_fees, dp_charges |
| charge_type | enum | percent, flat, flat_per_lot |
| value | numeric(10,6) NULL | **Null = not yet verified. Renders as pending.** |
| applies_side | enum | buy, sell, both |
| basis | varchar(30) | turnover, premium, per_scrip |
| min_value, max_value | numeric(10,2) | |
| effective_from, effective_to | date | |
| is_statutory | bool NOT NULL | Drives the Trade Grow / Statutory split on the website |
| verified_by | uuid FK | |
| verified_at | timestamptz | |

`UNIQUE (segment, charge_key, effective_from)`

> Keeping `effective_from` in the key gives full rate history. When a statutory rate changes, insert
> a new row — never update the old one. Historical cost estimates must remain reproducible.

### `documents`

| Column | Type |
|---|---|
| id | uuid |
| doc_key | varchar(40) |
| title | varchar(160) |
| version | varchar(20) |
| storage_key | varchar(255) |
| effective_date | date |
| status | enum: draft, published, hidden, superseded |
| uploaded_by | uuid FK |
| published_at | timestamptz |

`UNIQUE (doc_key, version)`

### `faq`, `scripts`, `testimonials`

**`faq`:** id, category, question, answer_html, sort_order, status, updated_by, updated_at

**`scripts`:** id, category, title, body, version, status (draft/approved/retired),
`approved_by` (**must be a compliance-role employee**), approved_on, linked_objection, usage_count

**`testimonials`:** id, customer_name, location, date_given, product_used, text,
photo_key, video_key, `consent_obtained` bool, consent_obtained_at, consent_channel,
consent_record_ref, media_consent bool, `verification_status` enum, verified_by, verified_at,
client_ref, compliance_approved_by, compliance_approved_on, published bool

```sql
-- A testimonial cannot be published without consent AND verification AND compliance approval.
ALTER TABLE testimonials ADD CONSTRAINT chk_testimonial_publish_gate CHECK (
  published = false OR (
    consent_obtained = true
    AND verification_status = 'verified'
    AND compliance_approved_by IS NOT NULL
  )
);
```

> This constraint is deliberate. The publish gate belongs in the database, not only in the admin UI,
> because UIs get bypassed by scripts and migrations.

### `support_tickets` / `grievances`

**`support_tickets`:** id, lead_id, client_code, reference UNIQUE, category, subject, message,
status (open/in_progress/resolved/closed), priority, assigned_to, sla_due_at, first_response_at,
resolved_at, created_at

**`grievances`:** id, ticket_id, escalation_level (1–4), officer_id, regulator_ref (SCORES id),
status, sla_due_at, resolved_at, resolution_summary, reported_to_exchange_on

`INDEX (status, sla_due_at)` on both — SLA breach monitoring.

### `audit_logs`

| Column | Type |
|---|---|
| id | bigserial PK |
| actor_id | uuid FK → employees |
| actor_role | varchar(30) |
| action | varchar(80) |
| entity_type | varchar(60) |
| entity_id | varchar(80) |
| before | jsonb |
| after | jsonb |
| ip | inet |
| user_agent | varchar(255) |
| created_at | timestamptz |

```sql
REVOKE DELETE, UPDATE ON audit_logs FROM ALL;
CREATE INDEX idx_audit_actor  ON audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC);
```

### `scoring_rules`

id, signal_key, points (can be negative), is_active, updated_by, updated_at.
Every change audit-logged. Never hardcode scores in application code.

### `notifications`, `referrals`, `admins`, `users`

- **`notifications`:** id, recipient_id, type, title, body, read_at, created_at
- **`referrals`:** id, referrer_account_id, referred_lead_id, status, kyc_completed_at,
  activated_at, eligible bool, `reward_status` enum (**default `blocked`**), reward_amount,
  legal_approved bool DEFAULT false
- **`admins`** is not a separate table — administration is a `role` on `employees`. Two user tables
  is a standard source of privilege-escalation bugs.
- **`users`** = website account holders where distinct from `leads`; for the CRM, `accounts` covers it.

---

## 5. Retention

| Data | Retention |
|---|---|
| Leads not converted | 24 months from last activity, then anonymised |
| Call recordings | Minimum period required; purge job enforces `retention_until` |
| Website events | 13 months, then aggregate and drop raw rows |
| Audit logs | 8 years (regulatory record-keeping) |
| Support tickets / grievances | As required by SEBI record-keeping rules |
| DND records | **Indefinite.** Deleting a DND record risks re-contacting someone who opted out. |

---

## 6. Migration ordering

```
teams → employees → lead_sources → campaigns → leads
      → calls → call_recordings → call_analysis
      → followups → whatsapp_messages → website_events
      → kyc_status → accounts → referrals
      → pricing → documents → faq → scripts → testimonials
      → support_tickets → grievances
      → scoring_rules → notifications → audit_logs
```
