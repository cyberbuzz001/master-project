# Compliance-Risk Matrix

> This matrix is an engineering control map, not legal advice. Regulatory obligations must be confirmed by qualified counsel/compliance for the entity's actual registration status. Where the obligation is uncertain the platform makes it **configurable** and **fails closed**.

Likelihood/Impact: H/M/L. Residual = after controls.

| ID | Risk | Source / trigger | L | I | Platform controls | Owner | Residual |
|---|---|---|---|---|---|---|---|
| R01 | Misrepresenting regulatory status ("SEBI Registered" without verified registration) | Current site C1–C5; marketing copy; AI drafts | H | H | `regulatory_profile` versioned + two-person verify; public wording rendered only from verified profile; Guardian `BLOCK` on registration phrases not matching profile; seed data contains **no** registration claims | Compliance Admin | L |
| R02 | Holding out as Investment Adviser / Portfolio Manager without registration | C6, C7, C14 | M | H | Guardian rules for "investment advisor", "portfolio management", "PMS", "wealth manager"; entity-type-aware wording | Compliance Admin | L |
| R03 | Return/accuracy promises | C9–C13; sales scripts; WhatsApp | H | H | Guardian phrase + pattern rules (guaranteed/assured/fixed return, risk-free, sure profit, % accuracy, double money, no-loss); `BLOCK` for client-facing channels; templates require approval | Compliance Admin | L |
| R04 | Unverified testimonials / P&L screenshots | C15–C17 | H | H | Testimonials require consent record + evidence document + compliance approval; no screenshot uploads to public CMS; performance only from ledger with methodology | Marketing Mgr + Compliance | L |
| R05 | Research published without authorized approval | Automation, AI orchestrator, rushed staff | M | H | State machine; approver must be `is_authorized_research_person`, ≠ author, 2FA; no API/automation/AI path to `PUBLISHED`; tests R-PUB-* | Research Head | L |
| R06 | AI hallucinated prices/news/facts in research | LLM | M | H | Grounding validator (numbers & URLs must exist in tool results); stale-data guard; human review; AI audit log | Research Head | L |
| R07 | Personalized advice given without authorization (chatbot, sales staff) | SupportAgent, sales calls | M | H | `personalized_advice_allowed` flag in profile; SupportAgent escalation classifier; call-analysis compliance flags; sales roles lack research permissions | Compliance Admin | M |
| R08 | Recommendations distributed to unsuitable clients | Distribution engine | M | H | Suitability filter vs finalized risk profile; risk category change only via recorded override | Research Head | L |
| R09 | Service activated without verified payment / KYC / agreement | Manual status edits | M | H | Activation state machine with preconditions; payment SUCCESS only via signature-verified webhook, gateway fetch, or two-person manual verification; no direct status edit endpoint | Payment Mgr | L |
| R10 | Duplicate/replayed payment webhooks | Gateways | M | M | Signature validation, `UK(provider,event_id)`, idempotency keys, raw payload storage | Engineering | L |
| R11 | Communications without consent / spam | Email, WhatsApp, calls | H | M | Append-only `consent_records` per purpose; send-time consent check; DND status blocks outbound; WhatsApp approved templates only; unsubscribe links | Marketing Mgr | L |
| R12 | Unauthorized access to client PII/KYC | Staff, IDOR | M | H | Permission + policy + query scope; signed short-lived URLs; download audit; encryption at rest; 2FA for staff; tests for cross-client/team access | Engineering | L |
| R13 | Call recording without consent | Call analysis | M | M | `call_recording` consent required before upload is accepted; retention policy; restricted `call_recordings.listen` | Compliance Admin | L |
| R14 | Tampering with historical research, payments, audit | Insiders | L | H | Append-only models, restricted DB grants, content hashes, audit of all changes | Engineering | L |
| R15 | Stale legal documents / disclosures | Regulatory change | M | M | `review_due_at` on policies/profile; reminders; publication blocked when regulatory profile review is overdue | Compliance Admin | L |
| R16 | Refund-policy disputes | C24 | M | M | Versioned refund policy accepted at invoice/agreement step with consent record | Admin | M |
| R17 | Referral rewards conflicting with regulation | Referral module | L | M | Reward mechanism disabled by default; enabling requires Compliance approval | Compliance Admin | L |
| R18 | Tracking pixels before consent | Current site | H | L | Consent-gated script loader; AdSense removed | Marketing Mgr | L |
| R19 | Backtests presented as real performance | Marketing | M | H | Separate data model + mandatory "Hypothetical" label; Guardian rule for backtest numbers in client-facing copy | Research Head | L |
| R20 | Lead vendor data obtained without consent | Vendor feeds/imports | M | M | Import requires consent-source declaration per batch; vendor quality & complaint tracking | Sales Mgr | M |
| R21 | Data retention beyond purpose | Documents, recordings, AI logs | M | M | Retention policies per category; scheduled purge with audit; export/deletion requests workflow | Compliance Admin | L |
| R22 | Grievances not handled within SLA | Complaints | M | M | Complaint module with SLA timers, escalation, dashboard, exports | Compliance Admin | L |
| R23 | AI provider data exposure | Prompts containing PII | M | M | Input minimization (IDs/hashes, masked fields); provider configured with no-training terms where available; PII redaction before external calls | Engineering | M |
| R24 | Employee commission allocations manipulated | Split payments | L | M | Submit→approve by different user; allocations separate from payment amounts; audit | Admin | L |

## Compliance Guardian — seed rule set

| Rule key | Pattern (case-insensitive) | Channels | Decision |
|---|---|---|---|
| `NO_GUARANTEE` | guarantee(d)? (return\|profit\|income\|result) | all client-facing | BLOCK |
| `NO_ASSURED` | assured\|fixed return\|confirmed profit\|sure (profit\|shot)\|no[- ]loss\|risk[- ]free\|double (your )?money | all | BLOCK |
| `NO_ACCURACY_CLAIM` | \d{2,3}(\.\d+)?\s*%\s*(\+\s*)?(accura\|success\|hit) | all | BLOCK |
| `NO_CONSISTENT_RETURNS` | consistent (profits?\|returns?\|results?) | all | REVIEW_REQUIRED |
| `REG_STATUS_CLAIM` | sebi[- ]regist\|registered research analyst\|registration no | all | BLOCK unless matches verified profile wording |
| `IA_PMS_LANGUAGE` | investment advis(e\|o)r\|portfolio manage\|pms\b\|wealth manag | all | REVIEW_REQUIRED |
| `TESTIMONIAL_PERFORMANCE` | (profit\|pnl\|p&l) (screenshot\|proof) | marketing | BLOCK |
| `BACKTEST_UNLABELLED` | backtest numbers without "hypothetical" label | research/marketing | REVIEW_REQUIRED |

Rule decisions are advisory at `REVIEW_REQUIRED` and enforced at `BLOCK`. The Guardian never marks content "compliant"; it only records the checks performed.

## Regulatory profile — publication preconditions

`ComplianceGate::assertCanPublish(category)` fails with `COMPLIANCE_CONFIGURATION_INCOMPLETE` unless:

1. An active regulatory profile version exists with `status = verified`.
2. `verified_by` ≠ `created_by`.
3. `review_due_at` is today or later.
4. `legal_entity_name` and `entity_type` are set.
5. If `entity_type = sebi_registered_ra`: `registration_number`, `registration_date`, `ra_name` are set.
6. If `entity_type = partner_associated_ra`: `partner_ra.name`, `partner_ra.registration_number`, `partner_ra.agreement_document_id` are set.
7. If `entity_type ∈ {technology_platform, marketing_distribution, other}`: publication of recommendations is refused outright; only educational categories permitted by the profile may be published.
8. Required disclosures for the category exist in a published policy/disclosure version.
