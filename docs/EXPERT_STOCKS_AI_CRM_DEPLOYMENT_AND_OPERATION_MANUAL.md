# Expert Stocks CRM — AI Lead Automation & WhatsApp Nurturing Master Operating Manual

## 1. Executive Summary

This manual documents the production architecture, automated workflows, statutory compliance gates, and operational procedures for the **Expert Stocks CRM** AI-powered lead acquisition, qualification, appointment booking, WhatsApp nurturing, and conversion platform.

The system incorporates institutional standards for SEBI Research Analyst (RA) compliance, TRAI National DND regulations, and Meta WhatsApp Business Platform policies.

---

## 2. Technical Architecture & File Directory

### Core Components Implemented

| Subsystem | File Path | Description |
| :--- | :--- | :--- |
| **Universal Lead Importer** | `app/Domain/Crm/UniversalLeadImporter.php` | Parses single-column phones, `Name \| Mobile`, tabular spreadsheets, alternating vertical key-values, and Vision OCR extractions. Non-destructive deduplication. |
| **Import API Controller** | `app/Http/Controllers/Api/UniversalImportController.php` | Preview, validation report generation (CSV), and batch execution endpoints. |
| **Import Filament Resource** | `app/Filament/Resources/LeadImportBatches/` | Admin cockpit for uploading files, pasting text, previewing rows, and auditing batch history. |
| **WhatsApp Service Adapter** | `app/Domain/Communications/WhatsAppService.php` | Official Meta Cloud Graph API v17.0+ integration, 24-hour customer service window gate, quiet hours, and mock sandbox fallback. |
| **Meta Webhook Controller** | `app/Http/Controllers/Api/WhatsAppWebhookController.php` | GET handshake verification challenge + POST inbound message delivery receipts and prospect chat ingestion. |
| **AI Sales Assistant** | `app/Domain/Ai/AiWhatsAppSalesAssistant.php` | Bilingual (EN/HI) AI assistant transparently representing Expert Stocks Consultancy. Guides leads through Demo, Appointment, Pricing, Human Agent, FAQs, and Opt-Out. |
| **Interactive Chat Stream** | `resources/views/filament/leads/whatsapp_chat.blade.php` | Two-way bubble UI embedded in Lead Details showing lead messages, AI replies, and human agent takeover status. |
| **AI Qualification Card** | `resources/views/filament/leads/ai_handoff_card.blade.php` | Live AI Score (0-100), Grade badge (`HOT`/`WARM`/`ENGAGED`/`COLD`), conversion probability, and explainable scoring factor breakdown. |
| **Explainable Lead Scoring** | `app/Domain/Crm/LeadScoringEngine.php` | Quantitative lead scoring based on observable milestones: profile completeness (+25), consent (+15), WA replies (+15), high-intent demo/appointments (+25/30), converted (100). |
| **Automated Workflows Engine**| `app/Domain/Crm/AutomationWorkflowEngine.php` | Executes Workflows A to G with TRAI/Meta Quiet Hours (9 AM – 8 PM IST) deferrals. |
| **Workflows Filament Resource**| `app/Filament/Resources/AutomationWorkflows/` | Admin manager for automated nurturing workflows, triggers, and quiet hour parameters. |
| **Workflow CLI Command** | `app/Console/Commands/ProcessAutomationWorkflows.php` | Cron runner: `php artisan crm:process-automation-workflows --limit=50`. |
| **DND & Suppression Resource**| `app/Filament/Resources/Suppressions/` | Statutory opt-out registry blocking all promotional contact upon `STOP`, `UNSUBSCRIBE`, or `बंद करो`. |
| **Appointments & Demos** | `app/Filament/Resources/Appointments/` | Calendaring for intro advisory calls, demo walkthroughs, and portfolio reviews with employee attribution. |
| **Vendor Performance Service**| `app/Domain/Crm/VendorPerformanceService.php` | Computes valid number rates, consent rates, response rates, demo conversions, paid conversions, and vendor ROI. |
| **Settlement Bridge** | `app/Domain/Billing/WebhookProcessor.php` | Verifies gateway payment webhooks (Razorpay/Cashfree) and transitions leads to `PAID` / `CONVERTED`. |

---

## 3. Database Schema Extensions

Migration: `database/migrations/2026_09_25_100000_create_ai_lead_import_and_automation_tables.php`

1. **`lead_import_batches`**: Tracks batch codes, file name, detected format, total detected rows, valid count, duplicates (in-file & in-CRM), accepted/rejected counts, consent basis, and uploader user.
2. **`leads` (extensions)**:
   - `communication_state`: (`CONSENT_UNKNOWN`, `CONSENT_PENDING`, `CONSENT_VERIFIED`, `ELIGIBLE_WHATSAPP`, `ELIGIBLE_PHONE`, `CHANNEL_RESTRICTED`, `OPTED_OUT`, `DO_NOT_CONTACT`, `INVALID_NUMBER`).
   - `is_ai_paused`: Boolean flag for mutual-exclusion human takeover.
   - `ai_conversation_state`: (`INTRO_PENDING`, `WAITING_FOR_REPLY`, `INTERESTED_IN_SERVICE`, `ASKING_QUESTIONS`, `DEMO_REQUESTED`, `DEMO_BOOKED`, `APPOINTMENT_REQUESTED`, `APPOINTMENT_BOOKED`, `PAYMENT_INFO_REQUESTED`, `PAYMENT_LINK_SENT`, `PAYMENT_PENDING`, `PAYMENT_VERIFIED`, `HUMAN_AGENT_REQUESTED`, `NOT_INTERESTED`).
   - `preferred_language`: (`en`, `hi`).
   - `last_whatsapp_received_at`, `demo_requested_at`, `appointment_requested_at`, `payment_link_generated_at`.
3. **`ai_conversations` & `ai_conversation_messages`**: Append-only log of customer queries, AI assistant replies, human agent notes, message statuses, and token usage.
4. **`appointments`**: Bookings for research walkthroughs and consultations.
5. **`automation_workflows`**, **`workflow_runs`**, **`scheduled_actions`**: Event-driven automation pipeline with quiet hour scheduling.
6. **`suppression_records`**: Centralized, permanent DND registry.

---

## 4. Environment Variables Configuration

Add the following keys to `expert-advisory/backend/.env`:

```env
# ---- WhatsApp Meta Business Cloud API & Webhooks --------------------------
WHATSAPP_PROVIDER=meta # Set to 'meta' for live Meta Cloud API, 'mock' for sandbox
WHATSAPP_META_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_META_ACCESS_TOKEN=your_system_user_permanent_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=esc_wa_verify_token_2026

# ---- AI Vision OCR & Conversational LLM Engine ----------------------------
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
VISION_OCR_PROVIDER=gemini # 'gemini' for high-accuracy multimodal OCR, 'mock' for test

# ---- Payment Gateways -----------------------------------------------------
RAZORPAY_ENABLED=true
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_signing_secret
```

---

## 5. Staff Operational Procedures

### A. How to Upload Cold Leads

1. Log in to the CRM Admin Panel (`/office`).
2. Navigate to **CRM → AI Lead Importer**.
3. Click the top-right button: **Bulk Lead Import Center**.
4. Choose one of two ingress methods:
   - **Upload File / Screenshot**: Select an Excel (`.xlsx`), CSV, text file, or image screenshot.
   - **Paste Raw Text**: Paste raw numbers or names directly into the textarea.
5. Select the **Lead Vendor / Source** and **Campaign** (optional).
6. Enter the **Statutory Consent Basis** (e.g. `Website Ingress Form V2`).
7. Click **Confirm Import**:
   - The engine automatically detects the layout format.
   - Normalizes all numbers to E.164 (`+91`).
   - Cross-references existing CRM records and in-file duplicates without overwriting historical notes.
   - Download the generated **Validation Report (CSV)** for a row-by-row breakdown.

### B. Human Agent Takeover (Mutual Exclusion Gate)

When a customer raises complex queries or an agent wishes to converse directly:
1. Open the Lead's detail page in the CRM.
2. In the table or detail view, click **Take Over Chat (Pause AI)**.
3. The AI assistant immediately stops sending automated responses.
4. When the manual call or conversation concludes, the agent can click **Resume AI Assistant** to return the lead to automated nurturing.

### C. Processing Scheduled Workflows

Configure a cron job on the production server to process queued nurturing actions every minute:

```bash
* * * * * cd /var/www/expert-advisory/backend && php artisan crm:process-automation-workflows >> /dev/null 2>&1
```

Actions falling between 8:00 PM and 9:00 AM IST are automatically deferred to 9:15 AM IST next morning in compliance with TRAI and Meta policies.

---

## 6. Financial Services Compliance Guarantees

The AI assistant adheres to strict SEBI Research Analyst guidelines:
1. **Zero Profit Guarantees**: Any mention of "guaranteed returns", "sure-shot calls", "risk-free", or "loss recovery" is prohibited and scrubbed by the `AiWhatsAppSalesAssistant` compliance filter.
2. **Real Pricing Only**: Package fees are queried in real time from published `PlanVersion` database records. No discounts or arbitrary prices can be hallucinated.
3. **Transparent Identification**: The AI introduces itself as an AI Assistant representing Expert Stocks Consultancy and offers immediate transfer to a human advisor upon request.
4. **Immediate Opt-Out Honor**: Keywords `STOP`, `UNSUBSCRIBE`, `बंद करो`, or `मैसेज मत भेजना` instantly suppress the lead across all outreach channels and record an immutable entry in `suppression_records`.

---

## 7. Testing & Verification

Run the full automated test suite anytime using:

```bash
php vendor/phpunit/phpunit/phpunit tests/Feature/UniversalLeadImporterTest.php \
                                  tests/Feature/WhatsAppAiSalesAssistantTest.php \
                                  tests/Feature/LeadScoringEngineTest.php \
                                  tests/Feature/AutomationWorkflowEngineTest.php \
                                  tests/Feature/VendorPerformanceTest.php
```

**Results:** `21 tests, 21 passed, 124 assertions (100% success rate)`.
