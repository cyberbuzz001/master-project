# Expert Stocks CRM — Employee & Telecaller Master Operating Manual

**Platform:** Expert Stocks Consultancy (`expertstocks.in`)  
**CRM URL:** `/office`  
**Target Roles:** Business Associates (BA), Senior Business Associates (SBA), Team Leaders (TL), Relationship Managers (RM), Finance Managers (FM), and Administrators.

---

## Table of Contents
1. [Introduction & Purpose](#1-introduction--purpose)
2. [Why Leads "Disappear" & How CRM Filtering Works](#2-why-leads-disappear--how-crm-filtering-works)
3. [Lead Sourcing, Intake & Round-Robin Assignment](#3-lead-sourcing-intake--round-robin-assignment)
4. [The 5-Minute Inbound Calling & Telecaller Routine](#4-the-5-minute-inbound-calling--telecaller-routine)
5. [Objection Handling Library (18 Battle-Tested Scripts)](#5-objection-handling-library-18-battle-tested-scripts)
6. [The 48-Hour Free Trial Playbook](#6-the-48-hour-free-trial-playbook)
7. [Sales Proposals, Negotiations & Milestone Closures](#7-sales-proposals-negotiations--milestone-closures)
8. [Client 360 Onboarding, KYC & Risk Suitability (RPM)](#8-client-360-onboarding-kyc--risk-suitability-rpm)
9. [Installment Recovery & Financial Controls (Separation of Duties)](#9-installment-recovery--financial-controls-separation-of-duties)
10. [Daily Productivity & Telecalling KPIs](#10-daily-productivity--telecalling-kpis)
11. [Meta WhatsApp Cloud API Lead Cadence & Pre-Approved SEBI Templates](#11-meta-whatsapp-cloud-api-lead-cadence--pre-approved-sebi-templates)

---

## 1. Introduction & Purpose
Expert Stocks Consultancy is a professional equity and derivatives research advisory firm. This guide equips all employees to work efficiently inside the Filament-powered CRM (`/office`), convert prospects systematically, and adhere strictly to SEBI compliance standards.

---

## 2. Why Leads "Disappear" & How CRM Filtering Works

A frequent issue raised by new telecallers is:  
> *"I just added a new lead, but when I clicked refresh, it disappeared from my table!"*

### Why This Happens:
1. **Persistent Table Filters in Session:**
   - Filament saves your active table filters in your browser session.
   - If the filter **"Follow-up due by today"** or an ownership filter is active, a newly added lead (which has no due date yet or is unassigned) will not match the active filter criteria.
   - **Fix:** Click the filter button in the top right of the table and click **"Reset Filters"**.
2. **Role-Based Ownership Scoping:**
   - BAs only see leads assigned to their own employee ID (`leads.view_own`).
   - If a lead was entered by an admin or assigned via round-robin to a colleague, it will not appear in other BAs' queues.
   - Team Leaders and Admins have permission to view all leads (`leads.view_all`).
3. **Status Filtering:**
   - Leads marked as `CONVERTED`, `DND`, or `LOST` are automatically removed from active calling views.

---

## 3. Lead Sourcing, Intake & Round-Robin Assignment
Leads enter the system through four primary channels:
- **Website Inbound:** Forms on `expertstocks.in` auto-ingested via `/api/v1/public/leads`.
- **Meta / Google Ads Campaigns:** Hooked directly into lead intake queues.
- **WhatsApp Inquiries:** Inbound chats captured with explicit consent.
- **Manual Addition:** Added by BAs using the **New Lead** button.

### Assignment Logic:
- If unassigned, leads are allocated across active telecallers using weighted round-robin distribution.
- Leads flagged as duplicate (same mobile or PAN) are linked to existing records to prevent dual calling.

---

## 4. The 5-Minute Inbound Calling & Telecaller Routine

Speed is critical. Prospects called within 5 minutes convert at 8x the rate of delayed calls.

### Telecalling Action Steps:
1. **Review Context:** Check preferred market segments (`Index F&O`, `Equity Intraday`, `Commodity`).
2. **Tap-to-Call:** Click the green **Call** button to initiate dialer.
3. **WhatsApp Greeting:** Click **WhatsApp** for an instant pre-approved intro message.
4. **Log the Call Immediately:**
   - Outcome: `connected`, `callback_requested`, `busy`, `not_reachable`, `not_interested`, `dnd`.
   - Notes: Specific questions or trading capital mentioned.
   - Follow-up: If callback requested, pick the exact date and time. This ensures the lead alerts you on your daily dashboard.

---

## 5. Objection Handling Library (18 Battle-Tested Scripts)
Access the library at **CRM -> Objection Library**. Click **View Script Details** for live guidance.

| Objection Category | Core Hypothesis | Recommended Response Summary |
|---|---|---|
| **1. Past Losses** | Loss aversion, past bad tips | Emphasize quantitative research, strict SL, and risk-reward ratio over random tips. |
| **2. High Pricing** | Value perception gap | Frame quarterly fee against the cost of 1 bad undisciplined trade. |
| **3. Guaranteed Return Ask** | Unrealistic expectation | Explain SEBI compliance prohibits guaranteed profits; guarantee discipline and research rigor. |
| **4. Think & Decide Later** | Procrastination / hidden doubt | Identify the specific doubt right now; offer a 48h live demo trial. |
| **5. SEBI Registration Doubt** | Authenticity / trust fear | Share SEBI registration number, official website, and compliance disclosures. |
| **6. Capital Shortage** | Capital hesitation | Recommend Cash Equity delivery alpha with 2% maximum single-trade risk limit. |
| **7. Options / F&O Fear** | High drawdown anxiety | Affirm SEBI 9/10 F&O loss study; propose hedged structures or pure cash alternative. |
| **8. Lack of Screen Time** | Execution friction | Pitch Positional/BTST plans using pre-market GTT orders requiring < 5 mins/day. |
| **9. Free Telegram Channels** | Free alternative lure | Explain zero statutory accountability, front-running risk, and lack of verified audit logs. |
| **10. Algo Bot Comparison** | Automation hype | Clarify bots fail on black-swan events; institutional models require senior human risk controls. |
| **11. Family / Spouse Delay** | Decision postponement | Provide official institutional PDF summary for transparent evening family review. |
| **12. Trial Extension Ask** | Free-riding tendency | Reiterate compliance rule: trial is strictly 48h demo; paid enrollment required for live calls. |
| **13. Demat Transfer Fear** | Custody anxiety | Clarify client retains 100% custody of existing broker; Expert Stocks never touches funds. |
| **14. Past Fraud Trauma** | Scammer comparison | Provide audited SCORES portal verification; prove GST invoicing and corporate bank accounts. |
| **15. Mutual Funds vs Alpha** | Passive benchmark doubt | Validate MF for core savings; position advisory for tactical alpha and cyclical momentum. |
| **16. Taxation on F&O** | Tax confusion | Explain F&O non-speculative business income status, expense write-offs, and GST tax credit. |
| **17. Market Crash / Volatility** | Regime shift fear | Explain sector rotation and hedging strategies that protect capital during index pullbacks. |
| **18. Suitability Override** | High risk demand | SEBI Mandatory: Enforce conservative boundaries; never override low suitability score for F&O. |

---

## 6. The 48-Hour Free Trial Playbook

1. **Enroll Prospect:** On any lead profile, click the orange **Start Free Trial** button.
2. **Parameters:** Set 2 trading sessions; max 1 recommendation per session; strict stop-loss adherence.
3. **Touchpoint 1 (Morning):** Confirm Telegram/WhatsApp signal delivery and margin readiness.
4. **Touchpoint 2 (Post-Market):** Review Day-1 trade execution and validate risk protection.
5. **Touchpoint 3 (Closing Review):** Conduct the formal closing interview and present the paid package.
6. **One-Click Conversion:** Click **Convert to Paid** to update lead status to `EXPECTED_PAYMENT`.

---

## 7. Sales Proposals, Negotiations & Milestone Closures
Located at **CRM -> Proposals & Closures**.

- Draft formal proposals with transparent standard fees, approved discounts, and duration.
- Split fees into 2 or 3 structured installments (e.g., 50% upfront, 50% after 15 trading days).
- Once accepted by client, click **Mark Accepted** and click **Create Installments** to auto-generate the installment ledger.

---

## 8. Client 360 Onboarding, KYC & Risk Suitability (RPM)
To comply with SEBI Research Analyst guidelines:
1. **Convert Lead:** Click **Convert to Client** to generate unique client code (`EXP-XXXX`).
2. **KYC Verification & Audit Toggles:**
   - Under **Customer 360° -> Documents**, inspect the DigiLocker PAN and Aadhaar e-KYC records.
   - Click **Verify NSDL** or **Verify UIDAI** to update verification state with statutory audit timestamp.
3. **20-Factor Risk Profile Assessment (RPM) Viewer:**
   - Click **20-Point RPM Audit** to view the client's evaluated score across the 4 key dimensions: *Financial Surplus, Drawdown Tolerance, Market Knowledge,* and *Leverage Safety Gate*.
   - Inspect individual responses to all 20 questions (e.g. net worth, stop-loss adherence, borrowing gate).
   - Enforce statutory boundary: If risk tier is Conservative, F&O derivatives advisory is strictly prohibited.
   - Click **Send Survey on WA** to dispatch an automated re-assessment link via Meta WhatsApp Cloud API.
4. **Digital Advisory Agreement & Legal Consent Vault:**
   - Click **Agreement Vault** to review the binding research mandate and immutable SHA-256 evidence record.
   - Valid under Section 65B of the Information Technology Act, 2000 & SEBI RA Regulations.
   - Click **Send Agreement on WA** to dispatch the official consent link directly to the client's verified mobile number.

---

## 9. Installment Recovery & Financial Controls (Separation of Duties)

### Separation of Duties Principle:
- **Sales & RMs:** Enter client payment entries with UTR numbers $\to$ Assigned status `PENDING_VERIFICATION`.
- **Finance Managers:** Verify actual bank credit against statements $\to$ Approve payment.
- **Why this matters:** Prevents disputed collections, guarantees accurate commission reports, and ensures invoices match audited bank ledgers.

### Balance Recovery:
- Open **Billing -> Installments & Recovery**.
- Monitor due dates and click **Nudge** to queue automated payment reminders.

---

## 10. Daily Productivity & Telecalling KPIs (Cockpit Guide)
Telecallers can monitor their performance live in the **Calling Desk Cockpit**:

### Key Metric Meters:
- **Daily Call Goal:** 50 - 70 connected calls (visual progress meter with pacing alerts).
- **Talk Time Benchmark:** Minimum 120 minutes daily (statutory adherence indicator).
- **Active Trials Pipeline:** Maintain 5 - 8 concurrent live 48-hour free trials.
- **Proposal Conversion Rate:** Target 35%+ conversion benchmark.

### Priority Queue Quick Filters:
- `All Queue`: Full active calling queue.
- `⚡ Speed-to-Lead (< 5m)`: Urgent inbound prospects requiring immediate dial.
- `📞 Callbacks Due Today`: Scheduled touchpoints alert.
- `🔥 Active 48h Trials`: Prospects currently evaluating live recommendations.
- `🔄 NPC Cadence (1–4)`: Unanswered calls in early recycling.
- `⚠️ Critical NPC (5–6)`: High-urgency drop-off warning before final auto-close.

### In-Call 18 Objection Playbooks:
- Click **18 Objection Scripts** (top right) or **In-Call Objection Playbook** on any lead card.
- Live keyword search across all 18 scripts.
- Click **Copy Script** for phone talking points or **Send on WhatsApp** for instant 1-click cloud dispatch.

### Daily Team Leaderboard:
- Click **Daily Leaderboard** to view rankings across Connected Calls, Talk Time, Active Trials, and Conversion Rate.

---

## 11. Meta WhatsApp Cloud API Lead Cadence & Pre-Approved SEBI Templates

All official WhatsApp communication with leads and clients is routed strictly through our verified Meta Cloud API number: **`+91 92018 00995`**.

### Operational Rules for Telecallers & RMs:
1. **Never use personal phone WhatsApp:** Communicating via personal WhatsApp numbers breaches SEBI Research Analyst regulations and risks immediate disciplinary review.
2. **1-Click WhatsApp Trigger in Calling Desk:** When working high-priority leads in the Calling Desk (`/office`), use the green **WA** button to immediately dispatch the official Welcome message if the prospect does not pick up or requests text info.
3. **2-Way Synchronization:** When a client replies on WhatsApp, the message is automatically captured by our Meta Webhook, logged into the lead's timeline, and visible in real time inside the **WhatsApp Cockpit**.
4. **NPC (Not Picked Call) Recycling:**
   - Log each unanswered call using **+1 NPC**.
   - On Attempt #1 and #4, pair the call with an automated **`adv_lead_welcome`** or **`adv_kyc_nudge`** template.
   - At 7 failed attempts, the system automatically transitions the lead to `LOST` to protect agent productivity.

### Approved SEBI WhatsApp Template Library:

| Template Identifier | Category | Trigger Scenario | Dynamic Variables |
|---|---|---|---|
| **`adv_lead_welcome`** | Marketing / Utility | Inbound lead submission or 1-click dialer follow-up | `{{1}}`: Full Name, `{{2}}`: Lead Ref Code |
| **`adv_risk_assessment_cert`** | Utility / Compliance | Immediate client submission of Risk Profile (RPM) | `{{1}}`: Full Name, `{{2}}`: Risk Tier, `{{3}}`: Assessment Ref |
| **`adv_kyc_nudge`** | Utility / Onboarding | Prospect registered but RPM/KYC documents pending | `{{1}}`: Full Name, `{{2}}`: Lead Ref Code |
| **`adv_plan_activation`** | Utility / Operations | Payment verified and advisory subscription active | `{{1}}`: Full Name, `{{2}}`: Plan Name, `{{3}}`: Client ID |
| **`adv_research_report`** | Marketing / Research | Research team publishes a formal market report | `{{1}}`: Full Name, `{{2}}`: Report Title, `{{3}}`: Report Ref |

### Compliance Mandate:
- Inbound inquiries grant a 24-hour customer service window for free-form replies.
- Outside the 24-hour window, only pre-approved Meta templates may be sent.
- Never guarantee returns or share unauthorized tips in free-form messages.

---

## 12. Attribution, CAC Analytics & Creator Revenue Share Engine (Phase 3 & 4)

Located at **CRM -> Campaigns & CAC** (`/office`).

### Multi-Touch UTM Attribution:
- **First-Touch Attribution:** Identifies top-of-funnel awareness (Google Search Ads, YouTube podcasts, educational blogs) that first attracted the prospect.
- **Last-Touch Attribution:** Identifies the immediate converting campaign (e.g. Free Trial retargeting, WhatsApp broadcast).
- **Linear Attribution:** Distributes credit equally across touchpoints.
- **Key Metrics:** Blended CAC (target &lt; ₹5,000), Paid-Only CAC (&lt; ₹7,500), ROAS multiplier (target &gt; 4.0x), and LTV/CAC ratio (&gt; 5.0x).

### Creator, Influencer & Partner RevShare Tiers:
Commissions are calculated automatically upon client payment verification:
- **Bronze Partner (0–10 Clients):** 10% on Advisory + ₹5/traded Demat order.
- **Silver Partner (11–25 Clients):** 15% on Advisory + ₹8/traded Demat order.
- **Gold Creator (26–50 Clients):** 20% on Advisory + ₹12/traded Demat order.
- **Institutional Master (&gt;50 Clients):** 25% on Advisory + ₹15/traded Demat order.

### Statutory TDS (Section 194H) & Bank Payout Protocol:
1. **Automated 5% TDS Withholding:** Under Section 194H of the Income Tax Act, 1961, 5% TDS is deducted from all partner commissions exceeding ₹15,000 per financial year.
2. **Bank Payout Action:** Click **Process Bank NEFT** to open the payout modal.
3. **UTR Reconciliation:** Enter the actual bank UTR reference number (e.g., `NEFT-20261022-984210`).
4. **Audit Immutability:** Once confirmed, the ledger item locks to `PAID` with verified timestamp.
