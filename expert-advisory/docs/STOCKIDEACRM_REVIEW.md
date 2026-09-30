# Review: cyberbuzz001/stockideacrm

Reviewed 2026-09-17 (default branch, last push 2026-09-08). Scope: `crm-core` (Laravel app), `chat-server`, `odoo_custom_addons`, `deployment`, `backup`.

## What it is

A working sales-floor CRM for an advisory firm: **Laravel 12**, Blade + Alpine + Tailwind, ~10,200 lines of PHP in `app/`, 26 models, 64 migrations, 86 Blade views, a Node webhook relay, and a separate Odoo 17 add-on.

## Verdict

**Port its business features and content onto the new platform; do not adopt its codebase as the foundation.** It encodes real operating knowledge (status playbook, call dispositions, distribution, targets, attendance, training gates, WhatsApp flows) that we should keep. But its security and data model do not meet the compliance requirements in the master brief, and fixing that would mean rewriting most of it anyway.

## Strengths worth keeping

| Feature | Where | Plan |
|---|---|---|
| Status playbook: definition, qualification, required actions, checklist, next step per status | `app/Services/LeadStatusService.php` | **Ported now** into `config/crm_playbook.php` (wording adjusted, see below) and shown on each lead |
| "Expected Payment" pipeline stage | same | **Added now** as `EXPECTED_PAYMENT` (manual); `PAID` still only via verified payment |
| NPC attempt tracking (move on after ~7 attempts over 3 days) | playbook + `add_npc_tracking` migration | **Ported now**: attempt count from call logs shown on the lead |
| Objection scripts library | `ObjectionScript` model | **Ported now** as a Filament resource (content subject to compliance review) |
| Sales tips widget | `resources/data/sales_mastery.json` | **Ported now** as a dashboard widget (wording adjusted) |
| Auto-distribution & reallocation with trail | `LeadController::autoDistribute`, `LeadReallocationController` | Already covered by `LeadAssignmentService` (workload-based, logged) |
| Stale-lead escalation (24 h inactivity) | `Console/Commands/EscalateLeads.php` | Phase 2b: escalation rule in the follow-up engine |
| Leaderboards (today / MTD), user targets, incentives/commission | `DashboardController`, `UserTarget`, incentives | Targets Phase 2b; revenue leaderboards need verified payments (Phase 4) |
| Attendance, office-hours and session-IP middleware, mandatory training gate | `Attendance`, `CheckOfficeHours`, `CheckSessionIP`, `CheckMandatoryTraining` | Phase 2b "Workforce" module |
| Internal mail, announcements | `InternalMail`, `SystemAnnouncement` | Phase 7 (notification centre) |
| WhatsApp Cloud API templates, chat tab, AI draft, sentiment/urgency | `WhatsAppService`, `LeadMessage`, `GeminiService` | Phase 7 / 6, rebuilt behind provider interfaces with consent checks and webhook signature validation |
| Watermarked documents with expiring access tokens, data-access log | `LeadDocumentController`, `DocumentWatermarkService`, `DataAccessLog` | Phase 3 documents (pattern reused) |
| Lead-scoring training command | `TrainLeadScoring` (php-ml) | Phase 6, with stored score explanations |
| PWA offline page | `offline.blade.php` | Phase 10 PWA |

## Issues that rule it out as the foundation

| # | Issue | Evidence | Why it matters here |
|---|---|---|---|
| 1 | Single `role` string on users, checks inline in controllers; no permissions or policies | `RoleMiddleware` compares `$user->role`; `LeadController` checks `in_array($user->role, [...])` | Brief requires 19 roles, granular permissions, team scope, separation of duties |
| 2 | Payment approval by one person; payments entered manually | `PaymentController::verify` (Admin/Manager approves) | Brief: payment state only from verified gateway events or two-person manual verification |
| 3 | WhatsApp webhook has no signature check | `WhatsAppWebhookController` — no `X-Hub-Signature-256` validation | Anyone can post fake inbound messages/status updates |
| 4 | Aadhaar and PAN numbers stored as plain lead columns | `add_enriched_contact_and_kyc_to_leads_table` migration | Aadhaar number storage is legally restricted; KYC data needs encryption and access logging |
| 5 | Year-sharded lead tables (`leads_2025`, `leads_2026`) | `create_leads_shards` migration | Complicates reporting, duplicate detection and audit with no benefit at this scale |
| 6 | Migration trigger over HTTP GET outside production | `routes/web.php` `/setup-db-force` | A mis-set `APP_ENV` on a server exposes it |
| 7 | `LeadController` is 1,661 lines; tests are Breeze defaults only | `tests/Feature/Auth/*` | High regression risk when extending |
| 8 | Unofficial WhatsApp gateway config (Evolution API) | `deployment/.env.evolution` | WhatsApp-Web-based gateways breach WhatsApp terms and risk number bans; the official Cloud API is already integrated |
| 9 | Laravel 12, Breeze auth without 2FA | `composer.json` | Staff 2FA required; new platform is Laravel 13 |

## Action items for you (not code)

1. **The repository is public.** It tracks `deployment/.env.evolution`, `backup/odoo_backup/config/odoo.conf`, `backup/backup_db.php`, SQL schema dumps and `composer.phar`. I did not print their contents. Check whether they contain real API keys, database URIs or passwords; if so, **rotate those credentials** and make the repo private or remove the files from history.
2. Remove `/setup-db-force` from any deployed copy.
3. Do not store full Aadhaar numbers; keep only what KYC regulations require, encrypted.

## Wording adjusted when porting (compliance)

| Original | Ported as | Reason |
|---|---|---|
| "begin receiving premium market calls" | "receive research according to their plan and risk profile" | Research is delivered through the approval workflow, not ad-hoc calls |
| "Gather feedback on call accuracy" | "Collect service feedback" | Avoids accuracy framing (brief §112) |
| "Re-state the ROI" | "Re-state how the research process and risk management work" | No return promises |
| "Discuss the result" (free trial) | "Discuss the research format and risk disclosures" | Trial results must not be presented as performance |
| "Trading" status | Not a lead status; client lifecycle (Phase 4) | Trading activity belongs to client servicing |

## Status mapping (for migrating existing data)

| stockideacrm | New platform |
|---|---|
| Cold Lead, Interested, Fresh | `NEW` |
| NPC, Switch Off, Not Reachable | `NPC` (call outcome retained) |
| Call Back | `CALL_BACK` |
| Follow Up | `FOLLOW_UP` |
| Free Trial | `FREE_TRIAL` |
| Expected Payment, Make Payment | `EXPECTED_PAYMENT` |
| Paid Client, Trading | `CONVERTED` only when a matching verified payment is migrated; otherwise `EXPECTED_PAYMENT` flagged for review |
| Not Interested | `NOT_INTERESTED` |
| Dead Lead | `LOST` (or `DND` where the lead asked not to be contacted) |

A migration command (`crm:import-stockideacrm`) will be written against an export of the live database once available; it will import leads, activities, call dispositions, consents and verified payments, and flag anything it cannot map.

## Odoo add-on

`odoo_custom_addons/stockidea_crm` (Odoo `crm`, `sale_management`, `hr`) duplicates the same domain in a third stack. Not reused.
