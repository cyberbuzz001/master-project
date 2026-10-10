<?php

namespace Database\Seeders;

use App\Models\TrainingModule;
use App\Models\User;
use Illuminate\Database\Seeder;

class TrainingModulesSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::first();
        $adminId = $admin?->id ?? 1;

        $modules = [
            [
                'title' => 'Module 1: Employee CRM Master Tutorial — Lead Lifecycle, Sourcing & Telecalling Workflow',
                'summary' => 'Comprehensive guide for BAs, SBAs, and Telecallers on navigating the CRM, finding leads, resolving missing lead filters, logging calls, and managing follow-ups.',
                'is_mandatory' => true,
                'due_within_days' => 3,
                'status' => TrainingModule::PUBLISHED,
                'published_at' => now(),
                'version' => 1,
                'body_markdown' => <<<MARKDOWN
# Employee CRM Master Tutorial — Telecaller & Sales Operations

Welcome to the Expert Stocks advisory CRM workspace (`/office`). This tutorial is your step-by-step operating guide to maximizing your daily telecalling productivity, closing more advisory subscriptions, and maintaining compliance.

---

## 1. Navigating Your CRM Workspace

### Left Navigation Overview:
- **CRM -> Leads:** Your central prospecting hub. All inbound prospects, marketing campaign leads, and manual entries appear here.
- **CRM -> Demo / Free Trials:** Manage active 48-hour client trials, check-ins, and trial closing reviews.
- **CRM -> Proposals & Closures:** Draft formal advisory proposals, negotiate package fees, and schedule installments.
- **CRM -> Objection Library:** Instant access to 18 proven script responses for fee, trust, market loss, and compliance objections.
- **Clients -> All Clients:** Client 360 profiles, active subscriptions, KYC verification, and agreement acceptances.
- **Billing -> Installments & Recovery:** Monitor outstanding balances, promised dates, and send payment reminders.

---

## 2. Why Did My Newly Added Lead Disappear? (Common Troubleshooting)

If you recently created a lead and clicked refresh, but cannot see it on your table, here is why:

1. **Table Filters Retained in Session:**
   - Filament saves your active filters in your session.
   - If the filter **"Follow-up due by today"** or a specific **Status filter** (e.g., `NEW` vs `CALL_BACK`) is active, a freshly created lead without an immediate due date will be filtered out.
   - **Solution:** Click the filter icon at the top right of the Leads table and click **"Reset Filters"**.

2. **Role Scoping (Own vs Team vs All):**
   - Business Associates (BAs) can only see leads assigned to their own employee ID (`leads.view_own`).
   - If a lead was created by an admin or assigned via round-robin to a different telecaller, it will not appear in another BA's queue.
   - Team Leaders and Admins have `leads.view_team` or `leads.view_all` and can view all leads across all desks.

3. **Status Transitions:**
   - If a lead is marked `DND` or converted to a client, it is moved out of active calling queues.

---

## 3. The 5-Minute Lead Intake & Calling Routine

Speed-to-lead is the single highest predictor of advisory sales conversion.

1. **Step 1: Check Inbound Leads**
   - When a fresh lead arrives from `expertstocks.in` or digital campaigns, check the **Markets** badge (`Index F&O`, `Equity`, `Commodity`).
2. **Step 2: Tap-to-Call or WhatsApp**
   - Click the green **Call** button (launches direct dialer on your mobile/softphone).
   - Click the **WhatsApp** button for consent-verified pre-formatted introductory greeting.
3. **Step 3: Always Log the Call (Mandatory)**
   - Click the blue **Log Call** action.
   - Select the outcome:
     - `connected` -> Enter duration and discussion notes.
     - `callback_requested` -> **Mandatory:** Select the exact callback date and time. This automatically sets `next_followup_at`.
     - `busy` / `not_reachable` -> Automatically flags for automated re-dial.
     - `not_interested` -> State the specific reason.
     - `dnd` -> Marks lead as Do-Not-Disturb (locks calling).

---

## 4. Daily Productivity Checklist for BAs & Telecallers

- **09:00 AM - 09:30 AM:** Filter leads by `Follow-up due by today`. Review your top 10 scheduled callbacks before market open.
- **09:30 AM - 01:30 PM (Morning Trading Session):** Connect with prospects while market action is live. Offer active free trials or review trial performance.
- **01:30 PM - 02:30 PM:** Midday lead sync & log any pending call notes.
- **02:30 PM - 05:00 PM (Closing & Review Calls):** Conduct trial review meetings. Present proposals for the next trading day.
- **05:00 PM - 06:00 PM:** Review outstanding installments with committed payment dates for tomorrow.
MARKDOWN,
            ],
            [
                'title' => 'Module 2: 48-Hour Free Trial Playbook — Demonstration & Conversion Engine',
                'summary' => 'How to enroll prospects into free research trials, conduct the Day-1 check-in, host the Day-2 review meeting, and convert them to paid clients.',
                'is_mandatory' => true,
                'due_within_days' => 5,
                'status' => TrainingModule::PUBLISHED,
                'published_at' => now(),
                'version' => 1,
                'body_markdown' => <<<MARKDOWN
# 48-Hour Free Trial Playbook — Demonstration & Conversion Engine

A research demonstration is the most effective way to eliminate prospect skepticism regarding trade accuracy and discipline.

---

## 1. Ground Rules for Free Trials

1. **Strict 48-Hour Limit:** Never give open-ended or week-long trials without manager approval. Scarcity drives commitment.
2. **Defined Trading Segment:** Match the trial to the prospect's capital:
   - ₹25,000 to ₹1,00,000 -> **Index Options (Nifty / BankNifty)**
   - ₹1,00,000 to ₹5,00,000 -> **Equity Cash Intraday / Swing**
   - ₹5,00,000+ -> **Hedged Derivatives / Commodity**
3. **Strict Risk Discipline:** Emphasize that free trial recommendations carry strict Stop-Loss (SL) and Target levels. The prospect must follow capital allocation rules.

---

## 2. Enrolling a Lead in 1 Click

1. Navigate to the prospect's lead record.
2. Click the orange **Start Free Trial** action button.
3. Select the segment (`Index Options`, `Equity`, `Commodity`, or `Combo`).
4. Set duration (default: 2 days).
5. Enter scope description: e.g., *"2 trading sessions; 1 high-probability recommendation per session; strict SL adherence."*
6. Click Submit. A unique trial code (e.g. `TR-X9A21K`) is generated, trial dates are booked, and the lead status automatically updates.

---

## 3. The 3-Touchpoint Trial Communication Flow

### Touchpoint 1: Welcome & Setup Call (Day 1 - Morning)
- Confirm receipt of the trial setup on WhatsApp/Telegram.
- Confirm they have sufficient trading margin ready.
- Remind them: *"Sir, execute with 1 lot or paper-trade to verify our entry timing and risk management."*

### Touchpoint 2: Mid-Trial Check-in Call (Day 1 - Post Market)
- Review the trade result of Day 1:
  - If Target achieved: Validate execution. *"Were you able to capture the 40-point move?"*
  - If Stop-Loss hit or neutral: Validate risk control. *"Notice how our stop-loss protected 95% of your capital. That is professional risk management."*

### Touchpoint 3: The Closing Review Meeting (Day 2 - 03:45 PM)
- Host the scheduled review call.
- Ask: *"On a scale of 1 to 10, how did our discipline and communication compare to your past experience?"*
- Present the formal proposal and transition to **Converted to Paid**.
MARKDOWN,
            ],
            [
                'title' => 'Module 3: Sales Proposals, Negotiation & Objection Handling Matrix',
                'summary' => 'Master the 18 objection handling scripts, create customized package proposals, structure milestone installments, and close commitments.',
                'is_mandatory' => true,
                'due_within_days' => 7,
                'status' => TrainingModule::PUBLISHED,
                'published_at' => now(),
                'version' => 1,
                'body_markdown' => <<<MARKDOWN
# Sales Proposals, Negotiation & Objection Handling Matrix

Closing advisory sales requires empathy, clear pricing structure, and decisive objection handling.

---

## 1. Drafting Formal Sales Proposals

Never quote ad-hoc pricing over WhatsApp messages without a structured proposal.

1. Go to **CRM -> Proposals & Closures** -> Click **New Proposal** (or click **Draft Proposal** directly from the Lead view).
2. Select the base package from our published catalog.
3. Fill in:
   - **Service Duration:** 30 days, 90 days (recommended), 180 days, or 365 days.
   - **Standard Fee:** Base price.
   - **Approved Discount:** Any manager-approved promotional concession.
   - **Final Payable Fee:** The net agreed amount.
   - **Installments:** 1 (Full payment), 2 (50-50 split), or 3 (milestones).
4. Save & send to prospect. Once agreed, click **Mark Accepted**.

---

## 2. Using the In-App Objection Library

Our CRM has 18 pre-seeded objection categories under **CRM -> Objection Library**. Click **View Script Details** during any difficult call.

### Key Scripts Summary:
1. **"Past Loss in Market" Objection:**
   - *Script:* "Sir, 90% of retail traders lose because they trade on tips without stop-loss or capital allocation. We are SEBI-registered research analysts. Our first priority is capital preservation."
2. **"Fee is Too High" Objection:**
   - *Script:* "Consider this: a single undisciplined trade without research can cost ₹10,000 in minutes. Our fee of ₹15,000 covers 3 full months of curated setups, disciplined exits, and dedicated advisory desk support."
3. **"Send Me Details on WhatsApp, I Will Think" Objection:**
   - *Script:* "I will definitely send the summary on WhatsApp, Sir. But what specific question do you need answered to make a decision today? Let us resolve that right now."
4. **"Can You Guarantee Profits?" Objection:**
   - *Script:* "Sir, as a compliant SEBI research advisory, offering guaranteed returns is illegal. What we guarantee is rigorous quantitative research, strict 1:2 risk-reward ratios, and disciplined stop-loss tracking."
MARKDOWN,
            ],
            [
                'title' => 'Module 4: Client 360 Onboarding, KYC, Risk Profiling & Legal Agreements',
                'summary' => 'Step-by-step workflow for converting leads to clients, collecting KYC documents, conducting SEBI risk suitability assessments, and capturing agreement consents.',
                'is_mandatory' => true,
                'due_within_days' => 10,
                'status' => TrainingModule::PUBLISHED,
                'published_at' => now(),
                'version' => 1,
                'body_markdown' => <<<MARKDOWN
# Client 360 Onboarding, KYC & Regulatory Compliance

Once a prospect commits to a paid subscription, strict SEBI regulations govern how they are onboarded before any research recommendations can be sent.

---

## 1. Converting Lead to Client

1. On the lead profile, click **Convert to Client**.
2. Verify full legal name (matching PAN card), mobile number, and email.
3. Submit. A unique **Client Code** (e.g., `EXP-2609-0012`) is automatically assigned.

---

## 2. The Mandatory Compliance Checklist

Before research delivery can be activated, the following 4 stages must be completed:

### A. KYC Verification
- Collect PAN Card and Aadhaar/Proof of Address.
- Upload documents under **Client Profile -> Documents**.
- Complete Pan verification under **KYC Checks**.

### B. Risk Profile & Suitability Assessment
- Navigate to **Client Profile -> Risk Profiles**.
- Record client's age, annual income, investment capital, and market experience.
- The system computes the Risk Score:
  - **Conservative:** Equity Large-Cap only.
  - **Moderate:** Equity Cash & Swing.
  - **Aggressive:** Derivative Options & Futures.
- **Golden Rule:** An aggressive service (like Index Options) CANNOT be sold to a client assessed as Conservative.

### C. Digital Service Agreement Acceptance
- A customized Advisory Agreement is dispatched via digital link or SMS/OTP.
- The client digitally accepts terms and SEBI risk disclaimers.
- The immutable SHA-256 evidence hash is stored in the **Agreements** relation manager.
MARKDOWN,
            ],
            [
                'title' => 'Module 5: Installments, Collections & Financial Separation of Duties',
                'summary' => 'Understanding how payment installments work, why sales entries stay PENDING_VERIFICATION until Finance approval, and how to recover outstanding balances.',
                'is_mandatory' => true,
                'due_within_days' => 12,
                'status' => TrainingModule::PUBLISHED,
                'published_at' => now(),
                'version' => 1,
                'body_markdown' => <<<MARKDOWN
# Installments, Collections & Financial Separation of Duties

Financial integrity is paramount. In Expert Stocks, sales team recording and finance team verification are strictly separated.

---

## 1. Separation of Duties: Sales vs Finance

- **Telecallers / Relationship Managers (RMs):**
  - Negotiate installment schedules (e.g. 50% upfront, 50% in 15 days).
  - Collect payment transaction references (UTR / Bank IMPS / Cheque number).
  - Record the installment under **Record Payment** or the **Installments & Balance Recovery** relation manager.
  - All entries are assigned status: `PENDING_VERIFICATION`.
- **Finance Managers / Admins:**
  - Verify actual credit into company bank accounts against bank statements.
  - Click **Verify Payment** to confirm the payment.
  - This marks the installment as `confirmed`, generates the official GST Tax Invoice, and unlocks the client's service subscription.

> **Why this rule exists:** It prevents unverified revenue from being claimed, avoids client disputes over claimed payments, and ensures accurate accounts.

---

## 2. Installment Recovery & Balance Nudges

1. Open **Billing -> Installments & recovery**.
2. Filter by `Payment Due` or `Overdue`.
3. Review promised dates.
4. Click the **Nudge** action button:
   - Increments reminder count.
   - Queues automated payment reminder SMS/WhatsApp to the client.
   - Logs timestamp for manager audit.
MARKDOWN,
            ],
            [
                'title' => 'Module 6: TradeGrow Platform Architecture — Demat Accounts, API Execution & Data Protection',
                'summary' => 'Comprehensive architecture overview of TradeGrow Demat platform, DhanHQ API order routing, wallet ledgers, and data isolation from advisory CRM.',
                'is_mandatory' => true,
                'due_within_days' => 14,
                'status' => TrainingModule::PUBLISHED,
                'published_at' => now(),
                'version' => 1,
                'body_markdown' => <<<MARKDOWN
# TradeGrow Platform Architecture & User Demat Journey

TradeGrow (`tradegrow.in`) is the next-generation Demat account and smart execution platform that powers our financial ecosystem.

---

## 1. Ecosystem Separation & Data Protection

- **Expert Stocks (`expertstocks.in`):**
  - SEBI Research Analyst advisory service.
  - Provides market research, swing trade recommendations, F&O setups, and client advisory consultations.
  - Powered by the Laravel/Filament CRM workspace (`expert-advisory/`).
- **TradeGrow Platform (`Tradegrow/`):**
  - Core Demat trading engine, PostgreSQL transaction ledger, DhanHQ API integration, wallet ledger, and order routing.
  - **Absolute Isolation:** Demat account credentials, client funds, holdings, and portfolio ledgers reside in a dedicated, cryptographically secured environment.
  - No advisory CRM maintenance or cleanup operation can alter, delete, or interfere with TradeGrow Demat accounts or balances.

---

## 2. The Client Journey on TradeGrow

1. **Demat Onboarding:**
   - User signs up on TradeGrow web/mobile app.
   - Completes instant Aadhaar e-KYC and Demat depository linking (CDSL/NSDL).
2. **Wallet & Fund Management:**
   - Client adds funds via UPI / NetBanking into segregated client fund accounts.
3. **Execution Integration:**
   - TradeGrow allows 1-click execution of Expert Stocks recommendations directly into the client's Demat account via authorized broker APIs (DhanHQ).
   - Real-time order execution, stop-loss triggers, and trailing target automation.
4. **Transparency & Security:**
   - 100% compliant with SEBI regulations governing algorithmic trading and execution.
   - Client funds remain in their primary Demat broker account at all times.
MARKDOWN,
            ],
        ];

        foreach ($modules as $data) {
            TrainingModule::updateOrCreate(
                ['title' => $data['title']],
                array_merge($data, [
                    'created_by' => $adminId,
                    'published_by' => $adminId,
                ])
            );
        }
    }
}
