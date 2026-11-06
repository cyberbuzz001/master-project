# Trading, demat and advisory code audit

Date: 6 November 2026. Scope: targeted source review of Tradegrow/server, selected Tradegrow tests, expert-advisory/backend, integration references, and package/build configuration. This is not an exhaustive review of every file, a production penetration test, or a legal compliance certification. No application code was changed.

## Executive assessment

TradeGrow's README and package metadata describe a brokerage simulation and paper-trading platform. Its execution engine creates fills locally. A Dhan market-data feed is not evidence of exchange execution, clearing, or CDSL/NSDL custody. The reviewed paths do not establish an operational real-money demat service. Treat real brokerage readiness as unverified until partner integrations, certifications, reconciliation and operational evidence are demonstrated.

The advisory application has useful foundations: publication compliance checks, role permissions, versioned disclosures, payment signatures, research distribution and suitability logic. However, newer CRM endpoints bypass existing authorization patterns, and billing, suitability and performance handling contain material defects. The README's production-ready claim is not sufficient evidence of readiness.

## Findings and remedies

Severity refers to impact if the affected endpoint or workflow is deployed and accessible. Findings below are supported by source inspection; runtime exploitation was not attempted.

### 1. High: disabled TradeGrow users retain authenticated access

Evidence: `Tradegrow/server/src/middleware/auth.ts:46-72`; login status check at `routes/api.ts:501`.

The middleware fetches identity and role but never status. Suspending an account blocks new logins while an existing access token continues to authenticate, including after its 60-second cache expires. Deleted identities can also be reassigned by email OR username through the fallback lookup, allowing an old token to attach to a recreated account.

Fix: bind tokens only to immutable user IDs; reject non-ACTIVE users; remove identity fallback; implement session/token version revocation and invalidate authorization caches when suspending, changing credentials or changing roles. Test suspension with an already issued token and deletion/recreation with a matching username.

### 2. High: advisory admin routes lack authorization

Evidence: `expert-advisory/backend/routes/api.php:106-159`; `app/Http/Controllers/Api/UniversalImportController.php`.

The admin URL prefix is not an authorization gate. Universal imports, batch inspection, AI pause, scoring, vendor analytics and workflow triggering inherit authentication/active/2FA middleware but lack the `can:` permissions used by neighboring admin routes. The import controller adds no permission checks. Eligible authenticated users can reach operations outside their role; client access depends on satisfying the shared middleware.

Fix: apply explicit permissions to every endpoint and enforce lead ownership/team scope. Test client, salesperson, manager, compliance and administrator access, including cross-team record IDs.

### 3. High: WhatsApp POST webhook accepts unauthenticated events

Evidence: `expert-advisory/backend/app/Http/Controllers/Api/WhatsAppWebhookController.php:45`; route at `routes/api.php:44`.

The handler parses and acts on events without verifying Meta's raw-body signature. GET verification does not authenticate POST deliveries. Forged payloads can create leads, change delivery states and invoke the AI assistant. Rate limiting does not verify the sender.

Fix: require X-Hub-Signature-256 validation against the configured app secret before any side effect, validate business/phone identity, and deduplicate provider message IDs. Queue validated events for processing.

### 4. High: generated execution prices are labeled as live

Evidence: `Tradegrow/server/src/trading/ExecutionEngine.ts:252-320,363-370`.

When an existing quote is stale, reconciliation can use an option-chain value without checking its expiry/freshness, a Black-Scholes price with fixed five-day expiry, or the MARKET order's supplied price. It creates a replacement tick with the current timestamp and source `live`. Provenance detects synthetic prices using bidQty/askQty equal to 500, while this fallback sets quantities to 100, so these fills are recorded as LIVE_FEED. Completely missing ticks take an earlier subscribe-and-continue path; the defect is reproducible on the stale-tick path.

Fix: fail closed on missing/stale execution quotes; match exact exchange/instrument/expiry; use explicit provenance fields. Keep optional simulated fills in a clearly labeled simulation mode. Test stale option ticks, expired chain entries and client-supplied order prices.

### 5. High: stop-limit orders fill without limit-price matching

Evidence: `Tradegrow/server/src/trading/ExecutionEngine.ts:164-168,337-339`.

A BUY SL order with trigger 100 and limit 101 executes at 101 when ask gaps to 110. Triggering a stop does not mean its limit is executable. The same defect occurs for SELL SL orders. Both event-driven and reconciliation paths implement it.

Fix: persist the triggered state, then apply ordinary limit matching. A triggered stop-limit order must remain pending while its limit is unavailable. Add gap, retracement, restart and both-side regression tests against the engine methods.

### 6. High: payment deduplication suppresses valid retries

Evidence: `expert-advisory/backend/app/Domain/Billing/WebhookProcessor.php:33-60,81`; `Gateways/RazorpayGateway.php:68`.

An event row is inserted before signature rejection and before transactional business processing. Every later callback with the same ID returns duplicate regardless of status. Thus an invalid event can reserve an ID, and a processing exception can leave an event permanently unprocessed despite valid provider retries. The Razorpay parser also falls back to payment ID as event ID, collapsing distinct event types for the same payment when a top-level ID is absent.

Fix: authenticate before authoritative deduplication; retain rejected payloads separately; model received/processing/processed/retryable-failure states with locking; use the actual provider event identifier, including header IDs where applicable. Test invalid-then-valid, failure-then-capture and transaction-exception retries.

### 7. High: terminal payment state can regress

Evidence: `expert-advisory/backend/app/Domain/Billing/WebhookProcessor.php:115-123`.

The failed-event branch runs before the already-verified guard, so a later distinct failure event can change a succeeded payment to FAILED without reversing its receipt, invoice state or subscription consistently. Exposure depends on event ordering and provider ID shape.

Fix: define permitted payment transitions, lock payment/invoice records and process refunds/reversals through separate auditable transitions. Reconcile against provider settlement records.

### 8. High: suitability defaults unknown clients to MODERATE

Evidence: `expert-advisory/backend/app/Domain/Research/ResearchDistributionService.php:56-58`.

Clients without a finalized risk profile receive a MODERATE rank and can receive low/moderate recommendations. Unknown categories also default to rank 2. The method does not enforce risk-profile expiry/acknowledgment or scope the subscription to the report's service/product.

Fix: block personalized distribution until a valid, acknowledged assessment exists; reject unknown categories and check product entitlements, agreement and applicable onboarding prerequisites. Keep general research access policy explicit and distinct from personalized suitability rules.

### 9. High: research performance can overstate success

Evidence: `expert-advisory/backend/app/Domain/Research/PerformanceLedgerService.php:73-105`.

The tracker uses quote high/low values without restricting their interval to after publication/entry. Daily extrema can therefore include prices before a recommendation existed. If both target and stop are crossed, target always wins because it is checked first. No entry-touch qualification establishes that the entry range was executable. A fetch succeeding is also not proof that the quote is fresh.

Fix: use timestamped post-publication candles/ticks, model entry activation, track market-data freshness, and record ambiguous target/stop ordering explicitly when granularity cannot resolve it. Publish methodology including fees/slippage, all calls and corrections, rather than only a win rate.

### 10. Medium: research detail access differs from feed entitlement

Evidence: `expert-advisory/backend/app/Http/Controllers/Api/V1/Client/ResearchController.php:27-43,112-144`.

The feed requires an active subscription, but the detail endpoint only requires historical delivery. An expired subscriber can still access delivered reports by UUID. If historical access is intended, document it; otherwise this is an entitlement bypass. The feed lists distributed versions while detail resolves the report's current version, so a later draft/version can also make an older feed entry unavailable.

Fix: centralize the access policy and resolve exact entitled published versions. Test expiry, renewal, withdrawal and new draft scenarios.

### 11. Medium: import execution trusts client-side validation results

Evidence: `expert-advisory/backend/app/Http/Controllers/Api/UniversalImportController.php:62`; `app/Domain/Crm/UniversalLeadImporter.php:407-443`.

The client supplies preview rows, validation_status and existing_lead_id. Execution trusts those values, including using Lead::find(existing_lead_id) for updates. The request validates container shapes rather than recomputing row validity and target scope.

Fix: store validated previews server-side with an owner-bound token or revalidate at execution. Recompute normalized phones, duplicates, permissions and allowed assignments in the transaction. Treat preview data as untrusted input.

### 12. Medium: SSO tickets are insufficiently separated from ordinary tokens

Evidence: `Tradegrow/server/src/routes/ssoRoutes.ts:158-215`.

Tickets share the access-token signing secret and lack enforced issuer/audience/type checks. Exchange accepts a staff role even without isStaff. Replay protection uses a process-local Set, which does not prevent reuse across replicas or restart. The current database role is not revalidated as staff after ticket decoding.

Fix: use distinct ticket typing/signing context, issuer/audience/target validation, mandatory nonce/subject claims, atomic shared nonce consumption with expiry, and current active staff-role checks.

### 13. Medium: generated advisory previews invent registration details

Evidence: `Tradegrow/server/src/routes/ssoRoutes.ts:251-260`.

Missing analyst data defaults to “SEBI Registered Research Analyst” and INH000000000. This generates an unsupported registration claim. Caller-supplied analyst identity is also not verified against a published report.

Fix: resolve an approved report and verified regulatory profile server-side; block unverifiable recommendations and display no fabricated registration data.

## Demat and real-money readiness gaps

These are readiness requirements, not claims that no implementation exists anywhere in the repository or connected infrastructure.

- Establish actual exchange/broker routing, exchange order IDs, acknowledgement/rejection/cancel/modify handling, partial fills and recovery from ambiguous network outcomes. Local simulated FILLED is insufficient.
- Establish DP/CDSL/NSDL partner workflows, authoritative BO IDs, nominee management, holdings/pledge reconciliation, corporate actions, settlement state and applicable eDIS/DDPI authorization.
- Replace onboarding progress text derived from CRM stage with verified provider events. `Tradegrow/server/src/routes/warRoomRoutes.ts:690-742` maps stages directly to claims such as UCC generated and demat active; stage alone is not external evidence.
- Build authoritative cash/securities ledgers, daily broker/bank/depository reconciliation, break handling and customer statements.
- Replace simulation's zero-tax assumptions for real-money reporting. `ExecutionEngine.ts:539-545` hardcodes brokerage, STT, exchange charges, GST and stamp duty to zero. Even zero brokerage does not imply zero statutory charges.
- Verify deployment isolation, backup restoration, secrets management, incident response, exchange/partner certification and applicable regulatory obligations with accountable operators and counsel.

## Recommended engineering improvements

1. Centralize order matching/state transitions so tick and periodic paths cannot drift. Use decimal/fixed-point arithmetic for money and quantities with instrument-specific tick/lot rules.
2. Make market-data identity explicit: exchange, segment, instrument ID, expiry, source timestamp and receive timestamp. Reject stale and out-of-order execution data.
3. Add transactional outbox processing for research delivery, payments and integration events; use idempotent consumers and observable retry/dead-letter queues.
4. Centralize authorization and entitlements; add a route coverage check to flag admin mutations without permissions.
5. Replace optimistic test copies with tests invoking actual engine/controllers/services. Some current limit tests compute a local condition without calling ExecutionEngine, and SSO tests sign/verify fixture JWTs rather than exercise exchange authorization.
6. Track operational metrics: stale quotes, order latency, rejected orders, stuck states, reconciliation differences, payment retry backlog and failed publication/distribution.
7. Preserve audit evidence in an append-only external archive with access controls and retention policy. ORM update protection alone does not establish tamper resistance against database administrators.

## Feature roadmap

### First: trust and correctness

- Client-visible order lifecycle with rejection reason, data freshness and clear simulation/live mode.
- Central reconciliation workbench for cash, securities, provider payments and failed settlement events.
- Research lifecycle showing publication time, versions, withdrawals, disclosures and suitability explanation.
- Session/device management and rapid access revocation.

### Next: investing and advisory value

- Portfolio concentration, sector exposure, allocation drift and drawdown analysis using reconciled holdings.
- Realized/unrealized P&L, tax-lot reporting and downloadable ledger/transaction statements with actual charges.
- Goal-based investment plans, SIP reminders and rebalancing proposals, subject to the service's authorization and suitability model.
- Research evidence packs: thesis, valuation assumptions, catalysts, downside scenarios, conflicts and time horizon.
- Honest recommendation analytics: all calls, entry activation, drawdown, benchmark comparison, costs and ambiguous outcomes.
- Advisory renewals, suitability reassessment, consent expiry and scheduled review tasks.
- Research alerts for thesis changes, target revisions, stop changes and withdrawals, with delivery acknowledgement.

### Later: operational scale

- Maker/checker approval for sensitive fund, permission and publication actions.
- Advisor workbench with client context, permitted services and review history.
- Disaster-recovery drills, integration replay tooling and fraud/anomaly investigation views.

## Suggested delivery order

- First sprint: account suspension/revocation, missing route permissions, WhatsApp signatures and payment retry/state fixes. Add regression tests covering actual endpoints/services.
- Second sprint: stop-limit semantics, quote provenance/freshness, suitability, entitlement policy and research performance methodology.
- Following milestone: integration/reconciliation evidence and a documented simulation-versus-live product boundary before considering real-money rollout.
- Then prioritize portfolio/reporting and research transparency features using customer feedback. Scope and staffing determine calendar duration.

## Validation and limitations

- TradeGrow backend TypeScript build passed.
- Four focused Jest suites passed: marginMath, tradePnLAccounting, limitExecutionAndTradeHistory and sso_advisory: 32 tests total. These do not disprove the findings; several test cases exercise copied logic or data contracts rather than production behavior.
- TradeGrow frontend TypeScript/Vite production build passed.
- PHP and Composer were unavailable, and backend vendor dependencies were absent. Advisory findings are static-review findings; Laravel tests were not executed. Runtime installation or framework bootstrap was unnecessary for this read-only audit.
- No production accounts, live orders, payments, external messages or customer data were manipulated. Full database-backed integration, security, performance and deployment reviews remain separate validation work.
