# TradeGrow Unified Platform — Integration Architecture Specification

**Document Reference**: `docs/architecture/02_INTEGRATION_ARCHITECTURE.md`  
**Status**: APPROVED BASELINE (Phase 0)  

---

## 1. Cross-Domain Integration Overview

The TradeGrow ecosystem unites three decoupled application layers into an end-to-end customer journey:

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│  Tradegrow website  │         │   Trading Terminal  │         │   Expert Advisory   │
│ (Trust/Acquisition) │         │  (Demat Execution)  │         │   (Research Desk)   │
└──────────┬──────────┘         └──────────┬──────────┘         └──────────┬──────────┘
           │                               │                               │
           │ 1. Lead Capture               │ 3. 1-Click Advisory Order     │ 2. Research Pub
           │    & Attribution              │    Execution & Fill           │    & Suitability
           ▼                               ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            UNIFIED EVENT BUS (Redis Streams)                        │
│   Topics: lead.captured • kyc.verified • rec.published • order.filled • pnl.settled  │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
┌──────────────────────────────────┐               ┌──────────────────────────────────┐
│       CRM & TELEPHONY ENGINE     │               │   MULTI-CHANNEL NOTIFICATION HUB │
│ • Auto-assign leads to agents    │               │ • Meta WhatsApp Cloud API        │
│ • Objection scripting prompt     │               │ • High-priority SMTP alerts      │
│ • Conversion funnel analytics    │               │ • In-App WebSocket notifications │
└──────────────────────────────────┘               └──────────────────────────────────┘
```

---

## 2. Core Integration Workflows

### 2.1 Workflow 1: Trust Website to Demat Onboarding & CRM Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as Prospective Trader
    participant Web as Tradegrow website (SSG)
    participant Gateway as Unified API Gateway
    participant EventBus as Redis Streams
    participant CRM as CRM Pipeline Service
    participant Notif as Notification Hub (WhatsApp)

    Visitor->>Web: Interacts with Fee Calculator & Submits Phone / Name
    Web->>Gateway: POST /api/v1/public/leads (with UTM tags, referrer, platform)
    Gateway->>Gateway: Validates E.164 phone & checks deduplication
    Gateway->>EventBus: Publishes event: 'lead.captured'
    Gateway-->>Web: Returns HTTP 201 + Lead Reference Code
    Web-->>Visitor: Displays confirmation & onboarding redirect

    EventBus->>CRM: Consumes 'lead.captured'
    CRM->>CRM: Computes initial Lead Score & assigns to Telecaller (Round-Robin)
    EventBus->>Notif: Consumes 'lead.captured'
    Notif->>Visitor: Sends WhatsApp Welcome Template with Verified KYC Link
```

### 2.2 Workflow 2: Advisory Recommendation to Terminal 1-Click Execution

```mermaid
sequenceDiagram
    autonumber
    actor Analyst as Research Analyst
    actor Head as Research Head
    participant Advisory as Advisory Desk
    participant Gateway as Unified API Gateway
    participant Terminal as Trading Terminal
    actor Trader as Retail Trader

    Analyst->>Advisory: Submits Recommendation Draft (e.g. BUY NIFTY 25000 CE @ 120, SL: 95, TGT: 160)
    Head->>Advisory: Reviews technical rationale, signs & approves
    Advisory->>Gateway: POST /api/v1/advisory/recommendations/{id}/publish
    Gateway->>Gateway: Validates SEBI Chinese Wall & Blackout Constraints
    Gateway->>Terminal: Broadcasts WebSocket notification to active subscribers

    Terminal-->>Trader: Pops Notification: "New Verified Trade Recommendation"
    Trader->>Terminal: Clicks "Execute Trade on TradeGrow"
    Terminal->>Terminal: Parses recommendation payload & checks available margin
    Terminal->>Trader: Displays Pre-Filled Order Confirmation Modal
    Trader->>Terminal: Clicks "Confirm Order" (One-Click)
    Terminal->>Gateway: POST /api/v1/trading/orders (with recId link)
    Gateway-->>Trader: Order Accepted & Filled at Market
```

---

## 3. Event Bus Specification (Redis Streams)

All asynchronous cross-service communications leverage **Redis Streams** with consumer groups for guaranteed at-least-once delivery:

| Stream Key | Event Type | Producer | Consumers |
| :--- | :--- | :--- | :--- |
| `stream:leads` | `lead.captured` | Public API Gateway | CRM Service, WhatsApp Dispatcher |
| `stream:kyc` | `kyc.verified` | Didit KYC Webhook | User Account Provisioner, CRM Service |
| `stream:advisory` | `rec.published` | Advisory Service | Terminal Broadcaster, WhatsApp Service |
| `stream:trading` | `order.filled` | OMS Execution Engine | Portfolio Service, Ledger, Trade Alerts |
| `stream:rms` | `margin.breached` | RMS Loss Monitor | Auto-Square-Off Engine, Push Notifications |
| `stream:billing` | `sub.activated` | Payment Gateway | Advisory Access Controller, Invoicing |

---

## 4. Multi-Channel Notification Hub Architecture

The unified notification hub abstracts downstream providers behind a unified messaging interface:
* **WhatsApp Cloud API (Meta)**: Used for high-priority transaction confirmations, advisory alerts, and CRM onboarding messages.
* **Hostinger / Dedicated SMTP**: Used for contract notes, tax invoices, password resets, and compliance grievance updates.
* **In-App WebSockets**: Low-latency (`<20ms`) trading fills, order status changes, and live market price alerts.

---
*Integration architecture certified and saved to [02_INTEGRATION_ARCHITECTURE.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/architecture/02_INTEGRATION_ARCHITECTURE.md).*
