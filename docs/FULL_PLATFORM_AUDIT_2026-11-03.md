# Full Platform Audit — TradeGrow and Expert Stocks

Audit date: 2026-11-03 (Asia/Kolkata)

Scope:

- `Tradegrow/`: demat/trading terminal, Node/TypeScript server, React client, market data, OMS/RMS, KYC, admin APIs, WhatsApp and SSO integrations.
- `expert-advisory/backend/`: advisory/research CRM, Laravel API, Filament office, lead ingestion, consent/DND, WhatsApp AI, research workflow, billing, KYC, documents and compliance controls.
- `Tradegrow website/`: trust, pricing, acquisition and compliance portal.

This is a repository/static audit. Production credentials, deployed domains, broker feeds, Meta webhooks, cron hosts and live payment gateways were not exercised. Findings are therefore code-evidence findings, not a production certification.

## Executive verdict

Overall status: **DO NOT SHIP AS A LIVE FINANCIAL/ADVISORY SYSTEM**.

The codebase contains meaningful architecture for market data, OMS/RMS, research approvals, consent recording, audit logs, KYC and automated workflows. However, critical authorization and webhook controls are incomplete, the trading webhook contains an unsafe account fallback, regulatory portal data is presented as verified while containing placeholders, and several operational claims are not backed by executable tests or telemetry.

Most urgent fixes:

1. Remove the TradingView webhook fallback to the first active user.
2. Remove all hard-coded fallback secrets and require environment configuration.
3. Verify Meta/Evolution webhook authenticity and deduplicate provider message IDs.
4. Reconcile instrument lot sizes from one authoritative source before accepting orders.
5. Keep the trust portal in a visibly pending/unverified state until legal and intermediary evidence is present.

## Severity-ranked findings

### Critical

#### C-01 — TradingView webhook can place an order for the wrong user

`Tradegrow/server/src/routes/api.ts` resolves the webhook secret through user identifiers and JWT, but if no user is found it queries the first active account and proceeds. An invalid secret can therefore be associated with an unrelated customer. This is a direct order-routing and account-isolation failure.

Evidence: `Tradegrow/server/src/routes/api.ts:1619-1630`.

Required fix: reject unknown secrets with 401/403; use a dedicated per-user hashed webhook credential, constant-time comparison, expiry/revocation, rate limits, idempotency and an explicit user binding. Never select a fallback user.

#### C-02 — Hard-coded fallback secrets protect internal and Meta webhook routes

`internalAdvisoryRoutes.ts` accepts `advisory_internal_2026_key` and `advisory_internal_key` even when configuration is absent. It also falls back to `expert_stocks_meta_webhook`. Similar fallback verification tokens exist in other WhatsApp routes.

Evidence: `Tradegrow/server/src/routes/internalAdvisoryRoutes.ts:35-40`; `Tradegrow/server/src/routes/warRoomRoutes.ts:1018`; `expert-advisory/backend/app/Http/Controllers/Api/WhatsAppWebhookController.php:31`.

Required fix: fail startup when production secrets are absent; remove literals from source; rotate any values that may have been deployed; use a secret manager.

#### C-03 — Meta WhatsApp POST webhooks do not verify request signatures

The Expert Stocks Laravel handler and TradeGrow WhatsApp handlers validate payload shape but do not verify Meta's signed request header against the raw request body. The advisory Meta route immediately returns 200 and processes any payload with the expected object shape.

Evidence: `expert-advisory/backend/app/Http/Controllers/Api/WhatsAppWebhookController.php:42-67`; `Tradegrow/server/src/routes/internalAdvisoryRoutes.ts:64-98`; `Tradegrow/server/src/routes/warRoomRoutes.ts:1034-1077`.

Required fix: capture the raw body, verify `X-Hub-Signature-256` with HMAC-SHA256 using the app secret, reject invalid signatures, then enqueue processing. Add provider message ID uniqueness and replay protection.

#### C-04 — Safety lock means TradeGrow is not a live brokerage execution system

`SafetyLock.REAL_MONEY_TRADING_ALLOWED` is hard-coded false and OMS calls `assertSimulationOnly`. This is a valid safety posture for paper trading, but it contradicts any production demat/brokerage claim and means live execution is not implemented.

Evidence: `Tradegrow/server/src/services/SafetyLock.ts:1-17`; `Tradegrow/server/src/trading/OMS.ts:60-67`.

Required fix: either explicitly position TradeGrow as simulation-only everywhere, or design a separately reviewed live-execution boundary with broker credentials, kill switches, two-person enablement, audit trails and staged certification. Do not silently present simulation as brokerage execution.

### High

#### H-01 — Instrument lot sizes are inconsistent across runtime and seed data

The option engine and helper use Bank Nifty 30, while the original DB seed used Bank Nifty 15 and stale Nifty/Sensex values. This can corrupt quantity, margin, P&L and square-off behavior. The current working tree contains an uncommitted reconciliation toward 65/30/20/60, but it is not committed or backed by a migration for existing databases.

Evidence: `Tradegrow/server/src/marketData/OptionChainEngine.ts:87`; `Tradegrow/server/src/utils/lotSize.ts:4-15`; `Tradegrow/server/src/db/init.ts:68-78`; `Tradegrow/server/src/db/migrations/006_options_derivatives_engine.sql:57-73`.

Required fix: use the instrument master/lot-size history as the only runtime source, add an effective-date migration, validate order quantities against the instrument row, and add invariance tests.

#### H-02 — Option-chain SSE regenerates per client instead of using the broadcaster

`/market/option-chain/stream` calls `OptionChainEngine.generateOptionChain` independently every 1.5 seconds for every connection. This bypasses the shared `OptionChainBroadcasterService` and creates a concurrency-dependent database/provider load.

Evidence: `Tradegrow/server/src/routes/api.ts:1053-1074`; `Tradegrow/server/src/marketData/OptionChainBroadcasterService.ts:43-218`.

Required fix: register subscriptions with the broadcaster, fan out cached snapshots, cap per-connection buffers, and add load tests at expected concurrent-user counts.

#### H-03 — Bearer tokens are accepted in query strings

HTTP authentication accepts `req.query.token`, and the browser WebSocket constructs `/ws?token=...`. Tokens in URLs are exposed to access logs, reverse proxies, browser history and referrers.

Evidence: `Tradegrow/server/src/middleware/auth.ts:26-31`; `Tradegrow/client/src/hooks/useMarketSocket.ts:327-330`.

Required fix: use the Authorization header for HTTP and a short-lived, single-use WebSocket ticket or secure cookie for WebSockets. Redact token query strings in all logs during migration.

#### H-04 — Unsigned Evolution/internal webhook routes can be replayed or forged

The Evolution and internal advisory routes rely on a static header key or no authentication for several webhook paths. There is no timestamp/signature/replay window for inbound status and message events.

Evidence: `Tradegrow/server/src/routes/internalAdvisoryRoutes.ts:111-126`; `Tradegrow/server/src/routes/warRoomRoutes.ts:1079-1160`.

Required fix: authenticate each provider separately, verify signatures, enforce timestamps/nonces, and persist processed event IDs with a unique constraint.

#### H-05 — KYC upload validation trusts extension or MIME type

The upload filter accepts a file when either the extension or MIME type matches and explicitly allows `application/octet-stream`. This permits content-type spoofing and potentially dangerous files with allowed extensions. There is no evidence of antivirus/content scanning before storage or document availability.

Evidence: `Tradegrow/server/src/middleware/upload.ts:30-50`.

Required fix: inspect magic bytes, reject ambiguous MIME types, scan asynchronously, store outside the web root, encrypt at rest, apply retention rules, and only mark documents usable after a clean scan.

#### H-06 — CRM deduplication does not implement a rolling 90-day policy

The importer queries every lead with the same normalized mobile number. Older historical records are treated as duplicates indefinitely. The current working tree adds a 90-day filter, but this is uncommitted and requires an index plus regression tests.

Evidence: `expert-advisory/backend/app/Domain/Crm/UniversalLeadImporter.php:256-262`.

Required fix: use `created_at >= now()-90 days`, define behavior for older records, add a composite index and test ownership/activity preservation.

#### H-07 — CRM route authorization is inconsistent

The CRM automation routes are inside authenticated/2FA middleware, but the route closures originally lacked explicit policy checks. The current working tree adds policy checks, but the change is uncommitted. Other routes such as analytics and webhook-adjacent operations require a complete permission inventory.

Evidence: `expert-advisory/backend/routes/api.php:105-155`.

Required fix: move closures to controllers, attach named abilities, enforce `LeadPolicy` visibility, audit every state-changing route and add forbidden/ownership tests.

#### H-08 — AI tool results are not returned to the model

`AiService` calls the provider once, executes returned tools afterward, then screens the original response. The model never receives tool results, so tool calling cannot ground or correct the response. Additionally, `ToolGateway::getLeadSummary()` reads `$lead->name` while the Lead model uses `full_name`.

Evidence: `expert-advisory/backend/app/Domain/Ai/AiService.php:62-128`; `expert-advisory/backend/app/Domain/Ai/ToolGateway.php:108-124`; `expert-advisory/backend/app/Models/Lead.php:14-21`.

Required fix: implement an explicit bounded tool loop: provider response → validate tool call → authorize → execute → append tool result → provider continuation → compliance screen. Cap iterations, cost and latency; fix DTO/model field names.

#### H-09 — Research/advisory regulatory portal contains placeholders marked verified

The Trust portal config marks regulatory fields as `verified` while using values such as “Facilitated through Registered Intermediary,” null official verification URLs and placeholder entity data. This does not satisfy independent verification requirements.

Evidence: `Tradegrow website/site/config/site.config.json:39-99`; `Tradegrow website/site/config/checklist.json:17-35`.

Required fix: publish the actual legal entity, intermediary, registration and exchange identifiers only after documentary verification; otherwise render `pending` and block “verified” badges.

#### H-10 — Scoring contract does not match the stated business rules

The implementation introduces an `ENGAGED` grade and uses WARM at 50+, while the specified contract says COLD <40, WARM 40–74 and HOT ≥75. Import-time scoring also uses different weights from the scoring engine.

Evidence: `expert-advisory/backend/app/Domain/Crm/LeadScoringEngine.php:77-119`; `expert-advisory/backend/app/Domain/Crm/UniversalLeadImporter.php:455-478`.

Required fix: version the scoring methodology, centralize factors/weights/thresholds, recalculate deterministically and migrate existing scores with an explanation.

#### H-11 — RMS schedule has no effective execution-window gate

The RMS engine computes `marketOpen` but does not use it to block or defer execution. Scheduling is timer-based and there is no demonstrated holiday-aware 15:15–15:20 window test. Mode also defaults to simulation.

Evidence: `Tradegrow/server/src/trading/RmsAutoSquareOffEngine.ts:51-128`; `Tradegrow/server/src/utils/cronJobs.ts:181-208`.

Required fix: use an exchange-calendar service, enforce an explicit cutoff window, persist run status, retry failed positions, and test duplicate runs, restart recovery and partial failures.

#### H-12 — Synthetic/Black-Scholes provenance can reach the order fill path

Execution records `BLACK_SCHOLES_SYNTHETIC` when tick shape matches the synthetic marker. The repository’s own agent guidelines prohibit synthetic ticks on live WebSocket streams. The runtime must enforce that synthetic/cached data cannot authorize a live or production-labelled fill.

Evidence: `Tradegrow/server/src/trading/ExecutionEngine.ts:177-188`; `Tradegrow/AGENTS.md` market-data rules.

Required fix: make tick provenance a hard execution precondition, reject synthetic ticks for any non-test order, and separate mock/simulation providers at process boundaries.

### Medium

#### M-01 — Webhook handlers process duplicates without a universal event-id constraint

Inbound WhatsApp handlers pass provider IDs through but do not consistently reject already-processed messages before side effects. Retries can duplicate conversations, opt-out records, tasks or outbound replies.

#### M-02 — Several endpoints use `SELECT *` and unbounded or weakly bounded collections

This increases data exposure and memory/latency risk. Examples include instruments, support tickets, positions and several admin/customer views.

#### M-03 — Public API response/error contracts are inconsistent

The Node routes mix flat strings, `{success,error}`, HTML responses and raw internal error messages. This complicates client handling, monitoring and security review.

#### M-04 — Production latency claims are not measured

The code has health endpoints and client freshness telemetry, but there is no verified p50/p95/p99 tick-to-client latency, SSE latency, fill latency, webhook processing latency or workflow delivery error rate.

#### M-05 — Test execution is not a reliable release gate in this workspace

React client TypeScript compilation passed. PHP syntax checks passed. The targeted Laravel test commands stalled and were stopped; previous Jest/Laravel runs also stalled. A production release must fail closed when tests cannot complete.

#### M-06 — Local working tree contains uncommitted functional changes

Current uncommitted files include the prior `Customer360.tsx` edit and the lot-size/CRM remediation edits. The Customer360 diff previously showed repeated KYC button insertions in unrelated UI sections and must be reviewed before commit.

## Component scorecard

| Component | Status | Reason |
|---|---|---|
| TradeGrow market data | Partial | WebSocket, Redis and reconnect paths exist; production latency and provider isolation are not proven. |
| TradeGrow option chain | High risk | Functional engine exists, but per-client SSE regeneration and lot-size inconsistency threaten correctness/scaling. |
| TradeGrow OMS | Partial | Validation, idempotency and transactions exist; live-money path is intentionally disabled. |
| TradeGrow RMS | Partial/high risk | Loss monitor and square-off code exist; schedule/window and live operational proof are incomplete. |
| TradeGrow KYC | Partial/high risk | Authenticated routes and uploads exist; file trust/scanning/retention require hardening. |
| TradeGrow admin/RBAC | Partial | Granular permission middleware exists, but route coverage and resource scoping need a complete matrix test. |
| Trust portal | Fail for verification readiness | Placeholders are labelled verified and official identifiers/URLs are incomplete. |
| Expert Stocks CRM | Partial/high risk | Import, consent, suppression and workflow architecture exist; scoring and dedup policy were inconsistent. |
| Expert Stocks WhatsApp | Fail until webhook authentication is fixed | Payloads are processed without Meta signature verification and replay protection. |
| Expert Stocks AI | High risk | Tool authorization exists, but tool results are not fed back and field mismatches can corrupt grounding. |
| Expert Stocks research | Partial | Approval/disclosure/snapshot workflow is substantial; live regulatory and distribution behavior needs integration tests. |
| Testing/operations | Fail as a release gate | Compilation/syntax pass, but test commands stall and production SLO evidence is absent. |

## Architecture diagnosis

### TradeGrow

The Node server combines HTTP routes, market data, execution, cron timers, Redis, database access and admin controls in one process. This is productive for a simulation platform but creates coupling between request latency, provider reconnects, background jobs and order execution. The strongest architectural controls are parameterized SQL, OMS transactions, Redis locks, JWT startup validation and permission middleware. The weakest boundaries are public webhook authentication, WebSocket token transport, synthetic data provenance, and the TradingView account-binding flow.

### Expert Stocks

The Laravel application has a stronger domain-service and policy structure: append-only audit/consent records, `visibleTo()` scopes, compliance gates, immutable document/hash patterns and research approval stages. The main weaknesses are inconsistent route-level policy coverage, webhook authenticity gaps, AI tool-loop design, and business-rule duplication between importer-time scoring and the scoring engine.

### AI/agent layers

The system has prompt/version/model records, tool definitions, tool call logs and a compliance guardian. However, the control loop is incomplete: tools execute after the only model response, so the model cannot use verified tool output. Context is injected as a raw JSON string without a typed trust boundary, and outbound WhatsApp side effects are not universally idempotent. The system should be treated as a bounded workflow engine with explicit tools and policy gates, not as an unconstrained conversational agent.

## Verification performed

- TradeGrow server TypeScript compilation: passed on the current working tree.
- TradeGrow client TypeScript compilation: passed on the current working tree.
- Expert Stocks PHP syntax checks: passed for audited CRM files and routes.
- `git diff --check`: passed.
- Laravel targeted tests: stalled in this environment and were stopped; no pass result is claimed.
- Production traffic, live broker feed, Meta signatures, payment gateways, cron host and deployed domains: not exercised.

## Ordered remediation plan

1. **Contain external side effects.** Remove TradingView fallback user, require all webhook secrets, verify Meta/Evolution signatures, add event-id uniqueness and replay windows.
2. **Establish data authority.** Make instrument master/lot-size history authoritative; migrate existing rows; reject stale or synthetic ticks at execution boundaries.
3. **Harden identity and authorization.** Remove URL bearer tokens, use short-lived WebSocket tickets, complete route-to-policy mapping and add negative authorization tests.
4. **Make AI execution grounded and bounded.** Implement a typed tool loop with authorization, result continuation, iteration/cost/time limits, structured outputs and outbound idempotency.
5. **Correct CRM business rules.** Centralize score methodology, implement 90-day deduplication with indexes, preserve ownership/activity and test DND/opt-out races.
6. **Fix RMS operations.** Add holiday-aware execution windows, persistent run state, retries, restart recovery and failure escalation.
7. **Correct regulatory presentation.** Replace verified placeholders with approved evidence or pending states; reconcile pricing/competitor sources and dates.
8. **Reduce load and data exposure.** Route option SSE through shared fan-out, replace `SELECT *`, bound collections, add cursor pagination where required and standardize errors.
9. **Build a real release gate.** Add deterministic test commands, database-independent unit tests for critical invariants, integration tests for webhooks/permissions/RMS, load tests and CI failure timeouts.
10. **Measure production readiness.** Capture p50/p95/p99 tick-to-client, order acceptance/fill, RMS action, webhook, queue and WhatsApp delivery metrics with alert thresholds.

## Release recommendation

Do not advertise or enable live demat/brokerage/advisory automation until all Critical and High findings are closed, the targeted Laravel/Jest suites complete deterministically, and a staging environment proves webhook authenticity, authorization isolation, lot-size correctness, RMS recovery and outbound-message suppression under retries.
