# Entity Relationship Design

Conventions applied to every table unless stated:

- `id BIGINT UNSIGNED` primary key; public-facing identifiers use a separate `uuid CHAR(36)` or formatted number (`INV-2026-000123`).
- `created_at`, `updated_at` timestamps (UTC). Display timezone `Asia/Kolkata`.
- Business tables carry `is_demo BOOLEAN DEFAULT 0` and, where deletion is allowed, `deleted_at` (soft delete).
- Money: `DECIMAL(15,2)`; quantities/prices of instruments: `DECIMAL(18,4)`; percentages: `DECIMAL(9,4)`.
- **Append-only** tables (marked 🔒) have no `updated_at`/`deleted_at` semantics; the model throws on update/delete.
- **Versioned** tables (marked 🗂) follow the entity + `_versions` pattern.
- Phase in which a table is created is shown as `P1…P10`.

---

## 1. Identity, RBAC, organisation (P1)

```mermaid
erDiagram
  users ||--o{ model_has_roles : has
  roles ||--o{ model_has_roles : grants
  roles ||--o{ role_has_permissions : includes
  permissions ||--o{ role_has_permissions : in
  users ||--o| employees : "is staff"
  users ||--o| clients : "is client"
  teams ||--o{ employees : contains
  employees ||--o{ teams : "leads (leader_employee_id)"
  users ||--o{ login_histories : logs
  users ||--o{ sessions : owns
  users ||--o{ personal_access_tokens : owns
  users ||--o{ two_factor_recovery_codes : has

  users {
    bigint id PK
    char uuid UK
    string name
    string email UK
    string mobile UK "nullable, E.164"
    string password "argon2id"
    enum user_type "staff|client"
    enum status "active|suspended|locked|deactivated"
    text two_factor_secret "encrypted, nullable"
    timestamp two_factor_confirmed_at
    int failed_login_count
    timestamp locked_until
    timestamp password_changed_at
    timestamp last_login_at
    string last_login_ip
    bool is_demo
  }
  roles { bigint id PK string name UK string guard_name string label bool requires_2fa bool is_staff }
  permissions { bigint id PK string name UK string guard_name string module string label }
  teams { bigint id PK string name UK bigint leader_employee_id FK bool is_demo }
  employees {
    bigint id PK
    bigint user_id FK "UK"
    string employee_code UK
    string designation
    bigint team_id FK
    bigint reports_to_employee_id FK
    date joined_on
    bool is_authorized_research_person "set only by Compliance Admin"
    enum status "active|inactive"
    bool is_demo
  }
  clients {
    bigint id PK
    bigint user_id FK "UK nullable until portal access"
    string client_code UK
    bigint lead_id FK "origin"
    string full_name
    string email
    string mobile
    string city
    string state
    string country
    enum onboarding_status
    bigint relationship_manager_employee_id FK
    bool is_demo
  }
  login_histories {
    bigint id PK
    bigint user_id FK "nullable for unknown email"
    string email_attempted
    enum outcome "success|failed|locked|2fa_required|2fa_failed"
    string ip
    string user_agent
    char device_hash
    timestamp created_at
  }
```

## 2. Audit, platform, compliance core (P1) 🔒🗂

```mermaid
erDiagram
  regulatory_profiles ||--o{ regulatory_profile_versions : versions
  policy_documents ||--o{ policy_document_versions : versions
  policy_document_versions ||--o{ consent_records : "consented text"
  users ||--o{ audit_logs : acts

  audit_logs {
    bigint id PK
    char request_id
    bigint actor_user_id FK "nullable (system)"
    string actor_type "user|system|webhook|ai"
    string action "e.g. auth.login, user.role_changed"
    string subject_type
    bigint subject_id
    json old_values "masked"
    json new_values "masked"
    string reason
    string ip
    string user_agent
    char device_hash
    timestamp created_at
  }
  system_settings {
    bigint id PK
    string group
    string key UK "group.key"
    text value "encrypted when is_secret"
    bool is_secret
    bool is_public
    bigint updated_by FK
  }
  regulatory_profile_versions {
    bigint id PK
    int version
    enum status "draft|pending_verification|verified|superseded"
    enum entity_type "sebi_registered_ra|research_entity|partner_associated_ra|technology_platform|marketing_distribution|other"
    string legal_entity_name
    string research_status
    string registration_number "nullable; never defaulted"
    date registration_date
    date registration_valid_until
    string ra_name
    string ra_contact_email
    string ra_contact_phone
    json raasb_details
    json partner_ra "name, reg no, agreement doc id"
    json authorized_persons
    json applicable_disclosures
    json advertising_rules
    bool research_approval_required
    bool personalized_advice_allowed
    string performance_claim_policy "none|ledger_only"
    json whatsapp_policy
    json email_policy
    date review_due_at
    bigint verified_by FK
    timestamp verified_at
    string verification_evidence "document reference"
    bigint created_by FK
  }
  policy_documents { bigint id PK string slug UK "privacy|terms|disclaimer|refund|risk-disclosure|investor-charter|grievance|research-methodology|ai-policy" string title bool requires_consent }
  policy_document_versions {
    bigint id PK
    bigint policy_document_id FK
    int version
    enum status "draft|in_review|approved|published|superseded"
    longtext body_markdown
    char content_hash
    date effective_from
    date review_due_at
    string source_url "for regulations/circulars"
    bigint created_by FK
    bigint approved_by FK
    timestamp published_at
  }
  consent_records {
    bigint id PK
    string subject_type "lead|client|user"
    bigint subject_id
    enum purpose "marketing_email|transactional_email|whatsapp|research_communication|educational_content|calls|call_recording|data_processing|terms|privacy|client_agreement"
    bool granted
    string channel "web_form|portal|whatsapp|call|import"
    bigint policy_document_version_id FK
    char consent_text_hash
    string ip
    string user_agent
    timestamp captured_at
    bool is_demo
  }
```

## 3. CRM & marketing (P1 subset, completed P2)

```mermaid
erDiagram
  lead_sources ||--o{ leads : source
  campaigns ||--o{ leads : campaign
  vendors ||--o{ leads : supplied
  vendors ||--o{ campaigns : runs
  leads ||--o{ lead_attributions : touches
  leads ||--o{ lead_assignments : assigned
  employees ||--o{ lead_assignments : owns
  leads ||--o{ lead_activities : timeline
  leads ||--o{ lead_status_histories : status
  leads ||--o{ call_logs : calls
  call_logs ||--o| call_recordings : recording
  call_recordings ||--o| call_analysis : analysis
  leads ||--o{ followups : schedules
  leads ||--o{ notes : notes
  tasks }o--|| employees : assignee
  referrals ||--o{ leads : referred
  imports ||--o{ import_rows : rows

  leads {
    bigint id PK
    char uuid UK
    string full_name
    string mobile "E.164, indexed"
    string email "indexed"
    string city
    string state
    string country
    enum trading_experience
    enum demat_status
    string broker
    enum capital_range
    json preferred_segments
    enum investment_horizon
    enum risk_level_declared
    bigint lead_source_id FK
    bigint campaign_id FK
    bigint vendor_id FK
    bigint referral_id FK
    enum status "NEW|NPC|CALL_BACK|FOLLOW_UP|FREE_TRIAL|PAID|NOT_INTERESTED|DND|INVALID|CONVERTED|LOST"
    bigint assigned_employee_id FK
    bigint team_leader_employee_id FK
    timestamp last_contacted_at
    timestamp next_followup_at
    string call_outcome
    tinyint ai_score "0-100 nullable"
    enum ai_grade "HOT|WARM|COLD|NOT_QUALIFIED"
    text lead_score_explanation
    string ai_intent
    string ai_sentiment
    decimal conversion_probability
    bigint duplicate_of_lead_id FK
    text message
    bool is_demo
  }
  lead_attributions {
    bigint id PK
    bigint lead_id FK
    bool is_first_touch
    string utm_source
    string utm_medium
    string utm_campaign
    string utm_term
    string utm_content
    string landing_page
    string referrer
    string referral_code
    string vendor_code
    string gclid
    string fbclid
    string ip
    timestamp captured_at
  }
  campaigns { bigint id PK string code UK string name enum channel decimal budget date starts_on date ends_on bigint landing_page_id FK }
  vendors { bigint id PK string code UK string name decimal cost_per_lead enum status }
```

## 4. Onboarding, risk profile, documents (P3)

```mermaid
erDiagram
  clients ||--o{ onboarding_steps : progresses
  risk_questionnaires ||--o{ risk_questionnaire_versions : versions
  risk_questionnaire_versions ||--o{ risk_questions : contains
  risk_questions ||--o{ risk_question_options : options
  clients ||--o{ risk_profiles : assessed
  risk_profiles ||--o{ risk_answers : answers
  risk_profiles ||--o| risk_reports : pdf
  risk_profiles ||--o{ risk_overrides : "human override w/ reason"
  clients ||--o{ kyc_documents : uploads
  documents ||--o{ document_versions : versions
  document_versions ||--o{ document_access_logs : accessed
  agreements ||--o{ agreement_versions : versions
  clients ||--o{ agreement_acceptances : accepts

  risk_profiles {
    bigint id PK
    bigint client_id FK
    bigint questionnaire_version_id FK
    int raw_score
    string methodology_version
    enum risk_category "configurable labels"
    enum experience_level
    enum loss_tolerance
    json suitability_flags
    enum status "submitted|finalized|superseded"
    bigint finalized_by FK
    timestamp acknowledged_at
  }
  risk_reports { bigint id PK bigint risk_profile_id FK string report_number UK char pdf_sha256 string verification_token UK bigint document_id FK }
  documents { bigint id PK string owner_type bigint owner_id enum category string retention_policy timestamp retain_until }
  document_versions { bigint id PK bigint document_id FK int version string disk string path_encrypted string mime char sha256 bigint size enum scan_status bigint uploaded_by FK }
```

## 5. Billing & payments (P4) 🔒

```mermaid
erDiagram
  services ||--o{ plans : priced
  plans ||--o{ plan_versions : versions
  clients ||--o{ subscriptions : holds
  plan_versions ||--o{ subscriptions : "priced at"
  clients ||--o{ invoices : billed
  invoices ||--o{ invoice_items : lines
  invoices ||--o{ payments : settles
  payments ||--o{ payment_events : "immutable log"
  payments ||--o{ payment_allocations : "employee credit"
  payment_allocations ||--o{ allocation_approvals : approved
  payments ||--o| receipts : receipt
  webhooks ||--o{ webhook_events : receives

  invoices {
    bigint id PK
    string invoice_number UK
    bigint client_id FK
    date invoice_date
    date due_date
    json legal_entity_snapshot
    json client_snapshot
    decimal subtotal
    decimal discount_total
    decimal tax_total
    decimal grand_total
    decimal amount_paid
    decimal balance
    enum status "draft|issued|partially_paid|paid|overdue|void"
    char pdf_sha256
    string verification_token UK
  }
  payments {
    bigint id PK
    char uuid UK
    bigint invoice_id FK
    string provider "cashfree|razorpay|stripe|bank_transfer|upi_manual"
    string provider_order_id
    string provider_payment_id UK
    decimal amount
    char currency
    enum status "INITIATED|PENDING|SUCCESS|FAILED|CANCELLED|REFUNDED|PARTIAL|UNDER_REVIEW"
    enum verification_method "webhook_signature|gateway_api_fetch|manual_two_person"
    bigint verified_by FK
    bigint second_verifier_id FK
    timestamp verified_at
  }
  payment_allocations { bigint id PK bigint payment_id FK bigint employee_id FK decimal amount enum status "submitted|approved|rejected" bigint submitted_by FK }
  webhook_events { bigint id PK string provider string event_id "UK with provider" string idempotency_key json raw_payload bool signature_valid enum status "received|processed|failed|ignored_duplicate" text error int attempts }
```

## 6. Research, market data, performance (P5) 🔒🗂

```mermaid
erDiagram
  market_data_snapshots ||--o{ research_reports : "data used"
  research_reports ||--o{ research_versions : versions
  research_versions ||--o{ research_sources : cites
  research_versions ||--o{ research_approvals : approvals
  research_versions ||--o{ research_recommendations : contains
  research_recommendations ||--o{ research_performance : tracked
  research_versions ||--o{ research_distributions : distributed
  research_versions ||--o{ disclosure_bindings : disclosures
  watchlists ||--o{ watchlist_items : items
  backtests ||--o{ backtest_trades : trades

  research_reports { bigint id PK string report_code UK enum report_type bigint current_version_id FK enum archive_status }
  research_versions {
    bigint id PK
    bigint research_report_id FK
    int version
    enum status "DRAFT|AI_REVIEW|COMPLIANCE_REVIEW|ANALYST_REVIEW|APPROVED|PUBLISHED|REJECTED|EXPIRED|ARCHIVED"
    string title
    longtext body
    json sections
    bigint author_employee_id FK
    bigint ai_run_id FK
    string prompt_version
    bigint data_snapshot_id FK
    bigint regulatory_profile_version_id FK
    char content_hash
    timestamp published_at
    timestamp valid_until
  }
  research_recommendations {
    bigint id PK
    bigint research_version_id FK
    string instrument
    string exchange
    enum segment
    enum direction
    decimal entry_low
    decimal entry_high
    decimal stop_loss
    json targets
    string time_horizon
    enum risk_classification
    decimal risk_reward
    text invalidation_condition
    timestamp data_as_of
    enum status
  }
  research_performance { bigint id PK bigint recommendation_id FK timestamp published_at decimal entry_ref decimal high_after decimal low_after decimal close_ref decimal mfe decimal mae enum outcome string methodology_version timestamp computed_at }
  market_data_snapshots { bigint id PK string provider string dataset char payload_sha256 json payload timestamp as_of timestamp retrieved_at bool is_stale }
```

## 7. AI layer (P6) 🔒🗂

```mermaid
erDiagram
  ai_models ||--o{ ai_runs : used
  ai_prompts ||--o{ ai_prompt_versions : versions
  ai_prompt_versions ||--o{ ai_runs : rendered
  ai_agents ||--o{ ai_runs : executes
  ai_runs ||--o{ ai_tool_calls : calls
  ai_runs ||--o| ai_outputs : produces
  ai_outputs ||--o{ ai_reviews : reviewed
  ai_budgets }o--|| ai_agents : limits

  ai_runs {
    bigint id PK
    char uuid UK
    bigint ai_agent_id FK
    bigint ai_model_id FK
    bigint prompt_version_id FK
    bigint requested_by FK
    json input_refs "IDs + hashes, not raw PII"
    json source_list
    int input_tokens
    int output_tokens
    decimal cost_usd
    enum status "queued|running|succeeded|failed|blocked"
    string error_code
    timestamp started_at
    timestamp finished_at
  }
  ai_outputs { bigint id PK bigint ai_run_id FK json output char output_hash decimal confidence bool schema_valid }
  ai_reviews { bigint id PK bigint ai_output_id FK bigint reviewer_id FK enum decision "accepted|edited|rejected" json corrections text reason }
```

## 8. Messaging, automation, support, CMS, analytics (P7–P8)

```mermaid
erDiagram
  email_templates ||--o{ email_template_versions : versions
  email_template_versions ||--o{ email_logs : sent
  whatsapp_templates ||--o{ whatsapp_logs : sent
  automation_rules ||--o{ automation_rule_versions : versions
  automation_rule_versions ||--o{ automation_runs : runs
  clients ||--o{ support_tickets : raises
  clients ||--o{ complaints : files
  complaints ||--o{ complaint_events : history
  pages ||--o{ page_versions : versions
  landing_pages ||--o{ landing_page_variants : ab
  testimonials }o--|| documents : evidence
  users ||--o{ notifications : receives

  email_logs { bigint id PK string provider_message_id string to_hash string recipient_type bigint recipient_id bigint template_version_id FK enum status timestamp opened_at bigint consent_record_id FK }
  whatsapp_logs { bigint id PK string provider string provider_message_id string template string recipient_hash enum delivery_status timestamp read_at bigint consent_record_id FK }
  automation_runs { bigint id PK bigint rule_version_id FK string trigger_event json context enum status json actions_result int attempt text error }
  complaints { bigint id PK string complaint_number UK bigint client_id FK enum category enum severity enum status timestamp response_due_at timestamp closed_at }
  testimonials { bigint id PK string display_name text body bigint consent_record_id FK bigint evidence_document_id FK enum status "pending|verified|approved|published|withdrawn" bigint approved_by FK }
```

## 9. Operations (P9–P10)

`error_logs`, `job_failures` (dead-letter), `health_checks`, `backup_runs` (with `verified_restore_at`), `api_credentials` (encrypted, rotation dates), `approval_matrix` (object type → required permission(s) and count), `exports`, `data_subject_requests` (export/deletion workflow), `retention_policies`.

## 10. Index strategy (highlights)

| Table | Index | Purpose |
|---|---|---|
| `leads` | `(mobile)`, `(email)`, `(status, next_followup_at)`, `(assigned_employee_id, status)`, `(campaign_id)`, `(vendor_id)`, `(created_at)` | Dedupe, work queues, attribution reports |
| `audit_logs` | `(subject_type, subject_id, created_at)`, `(actor_user_id, created_at)`, `(action, created_at)` | Timelines and investigations |
| `consent_records` | `(subject_type, subject_id, purpose, captured_at)` | Latest consent lookup |
| `login_histories` | `(user_id, created_at)`, `(ip, created_at)` | Security review |
| `payments` | `UK(provider, provider_payment_id)` | Duplicate-webhook protection |
| `webhook_events` | `UK(provider, event_id)` | Replay protection |
| `research_versions` | `UK(research_report_id, version)`, `(status, published_at)` | Immutability + feeds |
