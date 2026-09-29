# TradeGrow Unified Platform — Entity Relationship Diagrams (ERD)

**Document Reference**: `docs/database/02_ENTITY_RELATIONSHIP_DIAGRAM.md`  
**Status**: APPROVED BASELINE (Phase 0)  

---

## 1. Master Cross-Domain Entity Relationship Diagram

The unified data model links the **Public Acquisition Funnel**, **Trading Brokerage OMS**, and **SEBI Research Advisory** around a central `core.users` authority:

```mermaid
erDiagram
    %% Core Domain
    users ||--o{ user_profiles : "has"
    users ||--o{ audit_logs : "triggers"
    users ||--o{ user_sessions : "maintains"
    
    %% Broker Domain
    users ||--|| virtual_wallets : "owns balance"
    users ||--o{ orders : "places"
    users ||--o{ positions : "holds"
    virtual_wallets ||--o{ wallet_ledger : "audits via double-entry"
    orders ||--o{ executions : "filled by"
    orders ||--o{ order_events : "transitions through"
    instruments ||--o{ orders : "references"
    instruments ||--o{ positions : "references"
    
    %% Advisory Domain
    users ||--o{ subscriptions : "subscribes"
    users ||--o{ risk_profiles : "assessed by"
    users ||--o{ grievances : "files"
    plans ||--o{ subscriptions : "defines terms"
    users ||--o{ recommendations : "authors/approves"
    recommendations ||--o{ recommendation_performance : "tracked by"
    recommendations ||--o{ orders : "triggers (1-click execution)"
    
    %% CRM & Funnel Domain
    crm_leads ||--o| users : "converts into"
    crm_leads ||--o{ lead_activities : "logs"
    crm_leads ||--o{ call_logs : "records calls"
    campaigns ||--o{ crm_leads : "acquires"
    referral_codes ||--o{ crm_leads : "refers"
    users ||--o{ referral_codes : "owns"

    users {
        uuid id PK
        string client_code UK
        string email UK
        string phone UK
        string password_hash
        string status
        string kyc_status
        string role
        boolean is_two_factor_enabled
        timestamp created_at
    }

    user_profiles {
        uuid user_id PK,FK
        string pan_number UK
        boolean pan_verified
        string full_name
        jsonb bank_accounts
        string risk_category
    }

    virtual_wallets {
        uuid user_id PK,FK
        string currency
        bigint balance_paisa
        bigint used_margin_paisa
        bigint realized_pnl_paisa
        bigint version
    }

    wallet_ledger {
        bigserial id PK
        uuid user_id FK
        string entry_type
        bigint amount_paisa
        bigint balance_after_paisa
        string reference_type
        string reference_id
        timestamp created_at
    }

    orders {
        uuid id PK
        string order_id UK
        uuid user_id FK
        string symbol
        string side
        string order_type
        string product_type
        int quantity
        bigint price_paisa
        string status
        string idempotency_key UK
        uuid advisory_recommendation_id FK
        timestamp created_at
    }

    executions {
        bigserial id PK
        string execution_id UK
        uuid order_id FK
        uuid user_id FK
        int quantity
        bigint price_paisa
        int brokerage_paisa
        timestamp executed_at
    }

    recommendations {
        uuid id PK
        string reference_no UK
        string symbol
        string action
        string horizon
        bigint entry_range_min_paisa
        bigint entry_range_max_paisa
        bigint target_1_paisa
        bigint stop_loss_paisa
        string status
        uuid analyst_id FK
        uuid approver_id FK
        timestamp published_at
    }

    crm_leads {
        uuid id PK
        string lead_code UK
        string phone
        string email
        string stage
        string source
        string utm_source
        string utm_campaign
        uuid assigned_to_id FK
        timestamp created_at
    }
```

---

## 2. Brokerage Order Execution & Ledger Sub-ERD

This subsystem governs financial integrity:

```mermaid
erDiagram
    virtual_wallets ||--|{ wallet_ledger : "records state changes"
    orders ||--o{ executions : "zero or more fills"
    orders ||--|| positions : "updates net quantity"
    executions ||--|| wallet_ledger : "settles cash & fees"

    virtual_wallets {
        uuid user_id PK
        bigint balance_paisa "Liquid funds available"
        bigint used_margin_paisa "Collateral / blocked margin"
        bigint realized_pnl_paisa "Cumulative realized P&L"
    }

    wallet_ledger {
        bigserial id PK
        uuid user_id FK
        string entry_type "MARGIN_BLOCK | MARGIN_RELEASE | TRADE_SETTLE"
        bigint amount_paisa
        bigint balance_after_paisa
        string reference_id "Links to order_id or execution_id"
    }

    orders {
        uuid id PK
        string order_id UK
        string symbol
        string status "ACCEPTED -> EXECUTING -> FILLED"
        int quantity
        bigint price_paisa
    }

    executions {
        bigserial id PK
        string execution_id UK
        uuid order_id FK
        int quantity
        bigint price_paisa
        int brokerage_paisa
        int stt_paisa
        int gst_paisa
    }
```

---

## 3. SEBI Advisory Governance & Client Journey Sub-ERD

Enforces the regulatory Chinese Wall and client risk suitability requirements:

```mermaid
erDiagram
    users ||--o{ risk_profiles : "submits"
    risk_questionnaires ||--|{ risk_questions : "contains"
    risk_profiles ||--o{ risk_answers : "stores client answers"
    users ||--o{ subscriptions : "purchases"
    plans ||--o{ subscriptions : "configures"
    subscriptions ||--o{ invoices : "generates billing"
    invoices ||--o{ payments : "settled by"
    recommendations ||--o{ research_approvals : "dual-signed by RA Head"
    recommendations ||--o{ orders : "advisory 1-click execution"

    risk_profiles {
        uuid id PK
        uuid user_id FK
        int score
        string category "CONSERVATIVE | MODERATE | AGGRESSIVE"
        boolean acknowledged_by_client
        date valid_until
    }

    plans {
        uuid id PK
        string code UK
        string name
        bigint price_paisa
        int duration_days
        string min_risk_level "Suitability requirement"
    }

    recommendations {
        uuid id PK
        string reference_no UK
        string symbol
        string action "BUY | SELL"
        uuid analyst_id FK
        uuid approver_id FK "Required dual-signature"
        string status "ACTIVE | TARGET_MET | STOP_LOSS_HIT"
    }
```

---

## 4. CRM, Funnel & Multi-Touch Attribution Sub-ERD

Supports Phase 2 (CRM + Funnel), Phase 3 (Attribution), Phase 4 (Referrals), and Phase 5 (WhatsApp):

```mermaid
erDiagram
    campaigns ||--o{ crm_leads : "acquires"
    referral_codes ||--o{ crm_leads : "tracks partner referrals"
    crm_leads ||--o{ lead_activities : "audit timeline"
    crm_leads ||--o{ call_logs : "telecaller recordings & disposition"
    crm_leads ||--o{ message_logs : "WhatsApp & SMS notifications"
    crm_leads ||--o| users : "converts on account opening"

    crm_leads {
        uuid id PK
        string lead_code UK
        string phone
        string email
        string stage "NEW -> CONTACTED -> DEMAT_OPENED -> ACTIVE"
        string utm_source
        string utm_medium
        string utm_campaign
        int score
    }

    call_logs {
        bigserial id PK
        uuid lead_id FK
        uuid agent_id FK
        int call_duration_seconds
        string disposition "INTERESTED | CALLBACK | NOT_INTERESTED"
        text notes
        timestamp follow_up_at
    }

    message_logs {
        bigserial id PK
        uuid lead_id FK
        string channel "WHATSAPP | SMS"
        string template_code
        string status "SENT | DELIVERED | READ | FAILED"
    }
```

---
*Entity relationship diagrams certified and saved to [02_ENTITY_RELATIONSHIP_DIAGRAM.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/database/02_ENTITY_RELATIONSHIP_DIAGRAM.md).*
