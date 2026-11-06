# Trading, demat and advisory code audit

Date: 6 November 2026. Scope: targeted source review of Tradegrow/server, selected Tradegrow tests, expert-advisory/backend, integration references, and package/build configuration. This is not an exhaustive review of every file, a production penetration test, or a legal compliance certification. No application code was changed.

## Executive assessment

TradeGrow's README and package metadata describe a brokerage simulation and paper-trading platform. Its execution engine creates fills locally. A Dhan market-data feed is not evidence of exchange execution, clearing, or CDSL/NSDL custody. The reviewed paths do not establish an operational real-money demat service. Treat real brokerage readiness as unverified until partner integrations, certifications, reconciliation and operational evidence are demonstrated.

Product scope decision: TradeGrow is intended to remain a paper-trading product using virtual currency. Real demat, exchange-order routing, custody and client-funds movement are explicitly out of scope. The remaining work should preserve that boundary and prevent simulation data from being presented as live brokerage settlement.

The advisory application has useful foundations: publication compliance checks, role permissions, versioned disclosures, payment signatures, research distribution and suitability logic. However, newer CRM endpoints bypass existing authorization patterns, and billing, suitability and performance handling contain material defects. The README's production-ready claim is not sufficient evidence of readiness.

## Findings and remedies

Severity refers to impact if the affected endpoint or workflow is deployed and accessible. Findings below are supported by source inspection; runtime exploitation was not attempted.

### 1. High: disabled TradeGrow users retain authenticated access

Evidence: `Tradegrow/server/src/middleware/auth.ts:46-72`; login status check at `routes/api.ts:501`.

The middleware fetches identity and role but never status. Suspending an account blocks new logins while an existing access token continues to authenticate, including after its 60-second cache expires. Deleted identities can also be reassigned by email OR username through the fallback lookup, allowing an old token to attach to a recreated account.

Fix: bind tokens only to immutable user IDs; reject non-ACTIVE users; remove identity fallback; implement session/token version revocation and invalidate authorization caches when suspending, changing credentials or changing roles. Test suspension with an already issued token and deletion/recreation with a matching username.

Scope refinement from the second pass: normal order submission (`routes/api.ts:1240`) and `OMS.submitOrder` independently check ACTIVE status. This finding concerns continued session access and endpoints without their own status guard; it does not establish that suspended users can trade through those guarded paths.

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

## Second-pass findings

### 14. Critical: algorithmic order endpoint fails open on invalid credentials

Evidence: `Tradegrow/server/src/routes/api.ts:1596-1667`.

The unauthenticated `/algo/webhook` accepts a nonempty secret, first treats public identifiers (username, email, client code or ID) as credentials, then attempts JWT verification. If neither resolves a user, it selects the first ACTIVE user and submits an order for that account. Invalid credentials therefore lead to account selection rather than rejection. Actual acceptance still depends on simulation safety, market/risk controls and funds; those controls do not authenticate the caller.

Fix first: remove identifier-based authentication and the fallback account selection. Require a revocable, scoped, high-entropy per-account credential stored as a hash; enforce replay protection, strict schema validation and per-key rate limits. Tests must prove unknown secrets and public identifiers return 401 with no call to OMS, and valid credentials cannot select another account. This audit did not send orders to reproduce the issue.

### 15. High: internal advisory authentication always accepts hardcoded keys

Evidence: `Tradegrow/server/src/routes/internalAdvisoryRoutes.ts:40-46,125-134`; mounted at `server/src/index.ts:120`.

The accepted-key set includes two hardcoded values even when an environment secret is configured. Configuring or rotating the real key does not disable these alternatives. Protected routes can dispatch messages, submit inbound events and access bot metrics. External reachability depends on deployment/network rules; naming the URL internal does not supply isolation. The POST Meta webhook in this same router also lacks signature verification, independently of the Laravel webhook finding.

Fix: accept only configured secrets, fail closed when absent, remove fixed alternatives and rotate affected credentials. Prefer service identity plus network restrictions. Verify signatures on public webhooks before processing and avoid acknowledging events before durable storage.

### 16. High: order cancellation can overwrite a filled order

Evidence: `Tradegrow/server/src/trading/OMS.ts:252-278`; execution transition at `ExecutionEngine.ts:565` vicinity.

Cancellation reads and validates status outside the transaction, then updates by ID without a status condition. A fill can commit between that read and update: cancellation then changes FILLED to CANCELLED while execution/position/cash effects remain. Removing the in-memory order cannot stop a claim already in progress.

Fix: lock/read the order inside the transaction or conditionally transition cancellable states with RETURNING, release reservations only if cancellation wins, and return a conflict if execution won. Exercise actual concurrent execution/cancellation against PostgreSQL using controlled barriers.

### 17. High: order modification races with execution

Evidence: `Tradegrow/server/src/trading/OMS.ts:330-383`.

Modification likewise checks status before the transaction and updates price/quantity by ID without a state predicate. It can modify an already filled row while its execution retains the old quantity/price. An engine task holding an old order object can also execute stale values after modification.

Fix: introduce a transactional order version, lock and revalidate status and margin, and execute from a locked current order snapshot. Invalidate old matching tasks on version change. Test modify-versus-fill and cancel-versus-modify races with actual service calls.

### 18. High: submitted KYC is treated as sufficient for order entry

Evidence: `Tradegrow/server/src/routes/api.ts:1254-1266`; similar completion mapping at `api.ts:695,747`.

The gate accepts SUBMITTED in addition to APPROVED. Submitting documents can therefore satisfy the route's verification requirement before review. Simulation may intentionally allow relaxed onboarding, but the behavior conflicts with a verified-account requirement for a real brokerage and some UI completion fields are misleading.

Fix: centralize eligibility around authoritative verified status and any required segment activation. Keep any paper-trading exception explicit. Tests: SUBMITTED, UNDER_REVIEW, REJECTED and missing KYC fail the live eligibility policy; APPROVED alone must still satisfy segment/account controls.

### 19. High: withdrawal checks ignore floating losses

Evidence: request path `Tradegrow/server/src/routes/api.ts:2346-2358`; approval `routes/adminApi.ts:1484-1498`; wallet calculation `trading/VirtualWalletLedger.ts:91-93`.

The wallet exposes withdrawableBalance accounting for negative unrealized P&L, but request and approval use buying power equal to cash minus used margin. Example: cash 100,000, used margin 20,000 and floating loss 30,000 produces displayed withdrawable balance 50,000, while the approval calculation permits 80,000. Approval does lock the wallet and recheck funds, so the finding is specifically the wrong available-balance calculation, not absence of a funds recheck.

Fix: use one authoritative withdrawal calculation with conservative fresh marks, settlement obligations and pending payout reservations; define behavior when marks are unavailable. Test losses, stale prices and concurrent withdrawal approvals.

### 20. Medium: contract notes and execution ledger disagree on charges

Evidence: `Tradegrow/server/src/routes/api.ts:2248-2317`; `trading/ExecutionEngine.ts:539-545`.

Executions record zero statutory charges, while contract notes independently calculate transaction charges, STT, stamp duty and GST and deduct them from net obligation. The same transactions therefore have inconsistent accounting/reporting. The contract-note response also supplies hardcoded registration/member details and settlement identifiers instead of verified configuration and authoritative settlement records. This review has not verified who owns those registration numbers.

Fix: derive reports from immutable booked execution/fee entries, use effective-dated instrument/venue charge schedules, label simulation reports clearly, and obtain entity details from verified configuration. Reconcile statement totals exactly to the ledger and avoid generating unverifiable membership claims.

### 21. Medium: publication does not recheck market-data freshness

Evidence: `expert-advisory/backend/app/Domain/Research/ResearchWorkflowService.php:152,303-359`.

Snapshot freshness is checked at submission, but approval and publication can happen much later. Publication checks validity date and regulatory readiness but does not revalidate the attached snapshot. Research with no elapsed valid_until can thus publish using data too old to pass submission checks.

Fix: revalidate snapshot and recommendation timestamps at publication, and require a new review if refreshing data changes price levels or thesis. Test advancing time between submission, approval and publication.

### 22. Medium: KYC upload validation accepts spoofed content

Evidence: `Tradegrow/server/src/middleware/upload.ts:25-62`.

The filter accepts an allowed extension OR a client-supplied allowed MIME, including application/octet-stream, and preserves the original extension. This does not establish file content validity. Admin download subsequently uses stored MIME and inline disposition (`routes/adminApi.ts:1931-1950`). Protected storage is a positive control, but it does not make arbitrary uploaded content safe to process or render.

Fix: validate file signatures/content, enforce a strict extension/content pairing, normalize stored extensions, scan/quarantine documents, and serve risky originals as attachments from an isolated origin. Test disallowed extensions paired with allowed MIME, malformed documents and active content.

### 23. High: refresh tokens are bearer tokens with no rotation or revocation

Evidence: `Tradegrow/server/src/routes/api.ts:819-834`; logout at `api.ts:838-843`.

Refresh tokens are self-contained JWTs accepted until their 30-day expiry. Refresh does not rotate or persist a token family, checks user status, or consult a revocation/session version. Logout only writes an audit log. A stolen refresh token remains usable after logout, password change or account suspension.

Fix: store hashed refresh-token families (or a per-user session version), rotate on every refresh, detect reuse, revoke all sessions on password/status changes, and set a bounded idle/absolute lifetime. Add tests for logout, reuse, password reset and suspension.

### 24. High: browser stores access and refresh tokens in localStorage

Evidence: `Tradegrow/client/src/App.tsx:56-62,143`; `client/src/components/AuthModal.tsx:101,200`.

Long-lived bearer credentials are accessible to any JavaScript running in the origin. A single XSS or compromised third-party script can extract both tokens and call financial APIs. The server allows inline scripts and external script sources in its CSP (`server/src/index.ts:56-60`), increasing the impact of frontend injection or supply-chain compromise.

Fix: use Secure, HttpOnly, SameSite cookies for sessions/refresh, keep access tokens short-lived, add CSRF protection for cookie-authenticated mutations, remove unnecessary `unsafe-inline`/`unsafe-eval` and broad CDN sources, and add dependency/CSP monitoring.

### 25. High: Didit KYC webhook is unauthenticated

Evidence: `Tradegrow/server/src/routes/api.ts:2990-2997`; `server/src/services/diditService.ts:246-271`.

The endpoint accepts any JSON containing a known session ID, then calls the provider status API and updates the local KYC application. There is no signature, timestamp, replay or provider-event-ID validation visible in the route or service. An attacker who learns a session ID can cause repeated state synchronization attempts; more importantly, the integration has no authenticated event boundary to prove that the callback came from Didit.

Fix: verify the provider's signed raw body and timestamp, reject replayed event IDs, validate the expected webhook project/environment, and make state transitions monotonic and auditable. Keep provider polling as the authoritative fallback, not unauthenticated callbacks.

### 26. Medium: health endpoints expose operational detail publicly

Evidence: `Tradegrow/server/src/routes/api.ts:96-183`.

Health, readiness and dependency endpoints are registered before authentication and return provider names, database latency/pool information, Redis mode, WebSocket metrics, process memory and sometimes dependency errors. These are useful to operators but provide reconnaissance and can expose sensitive deployment state. Readiness also reports `IN_MEMORY_FALLBACK` as healthy enough for dependency status, which can mask loss of Redis durability.

Fix: keep a minimal unauthenticated liveness response, protect readiness/dependency diagnostics with service authentication or network policy, redact errors and pool details, and fail readiness when a required durable dependency has fallen back to memory.

### 27. High: WebSocket authentication is optional and uses bearer tokens in the URL

Evidence: `Tradegrow/server/src/websocket/server.ts:128-140`.

The `/ws` handshake continues as an anonymous connection when the query-string token is absent or invalid. Public market ticks are intentionally available, but the same socket later carries user chat and admin event capabilities. Tokens in URLs are exposed to browser history, reverse-proxy access logs and monitoring systems. The WebSocket layer also does not recheck user status or token revocation after connection establishment.

Fix: use an authenticated upgrade flow (short-lived one-time ticket or secure cookie), avoid bearer tokens in URLs, reject invalid tokens for private channels, check the current account/session version, and separate public market-data sockets from private account/event sockets. Add tests for invalid token, suspended user and expired session while connected.

### 28. High: WebSocket admin access is role-only, not permission-based

Evidence: `Tradegrow/server/src/websocket/server.ts:20-30,183-207,311-323`.

Every role in the hardcoded `ADMIN_ROLES` list can subscribe to an individual client's events or all platform events. This bypasses the granular permission catalog used by HTTP routes. A read-only auditor, analyst or support role may receive fund, order, ledger or other customer events regardless of task-specific permission. Role changes after connection are not reflected.

Fix: authorize each subscription against the permission catalog and customer/team scope, use the same policy service as HTTP, and revoke channel access when role/session state changes. Test each staff role against order, fund, KYC and support event types.

### 29. Medium: global idempotency keys allow cross-user collision and denial of service

Evidence: unique index `Tradegrow/server/src/db/migrations/018_production_scalability_indexes.sql:15-17`; lookup in `server/src/trading/OMS.ts:104-116`.

The database makes `orders.idempotency_key` unique across the entire platform, while application lookup is scoped by user. A key chosen by one account can cause a different account's request to fail on the unique constraint, and key reuse behavior is not a documented per-account contract.

Fix: use a composite unique key `(user_id, idempotency_key)` with a bounded length and expiry/cleanup policy, or explicitly return the original order only for the owning account. Add cross-user collision and retry tests.

### 30. Medium: any authenticated user can reset the virtual balance

Evidence: `Tradegrow/server/src/routes/api.ts:2517-2566`.

`/funds/reset-margin` is protected only by authentication and open-exposure checks. It resets cash and P&L to default capital and writes a ledger row for the user. This may be intended for demos, but there is no explicit demo-mode gate, entitlement, confirmation token or audit role requirement. It undermines performance history and can be dangerous if a deployment accidentally exposes virtual-wallet operations alongside real account workflows.

Fix: remove the endpoint from customer routes; gate it behind an explicit simulation environment and admin/test permission, require a one-time confirmation, and mark reset periods in reporting. Never map this operation to a real cash or securities ledger.

### 31. Critical: password-reset OTPs are weak, retained in plaintext, and reusable

Evidence: `Tradegrow/server/src/routes/api.ts:543-686`.

OTP generation uses `Math.random()` rather than a cryptographic random source. The OTP is written into notification text and metadata in the database. If Redis is unavailable, reset falls back to that database record, and successful verification does not delete or mark the notification as consumed, so the same OTP can be reused during the ten-minute window. The reset endpoint also does not maintain a per-account attempt counter. The response includes `userId` for existing accounts and a development-only OTP response must never be enabled on an internet-accessible non-production environment.

Fix: generate with `crypto.randomInt`, store only a hash plus expiry/attempt counter, consume atomically, rate-limit by account and IP, never persist the raw code in notifications, and revoke all sessions after reset. Use an indistinguishable response and do not return user IDs.

### 32. Critical: broker OAuth configuration contains fallback credentials and accepts caller-controlled redirect/state

Evidence: `Tradegrow/server/src/routes/api.ts:195-217`; Fyers exchange path at `api.ts:207-301`.

The source includes fallback app credentials, including a secret-like value, when environment variables are absent. The login endpoint accepts `appId`, `redirectUri` and `state` from the request rather than binding them to server configuration and a server-created session. There is no visible state storage/comparison in the callback. This creates OAuth CSRF/mix-up risk and can send users to an unapproved redirect or exchange a code outside the initiating browser session.

Fix: require broker credentials from a secret manager/environment and fail startup when missing; use a fixed allowlisted redirect URI; generate and store a one-time state bound to the initiating user/session; verify it on callback; and remove disabled-provider paths from production builds.

### 33. High: password changes do not revoke existing sessions

Evidence: `Tradegrow/server/src/routes/api.ts:789-817`; refresh behavior at `api.ts:819-834`.

Changing a password updates the hash and writes an audit event, but does not invalidate access or refresh tokens. Existing bearer tokens remain valid until expiry, and the refresh endpoint does not check a password/session version. This defeats the common expectation that a password change terminates stolen sessions.

Fix: increment a per-user session version or revoke token families in the same transaction as the password update, then require that version in access and refresh validation. Test password change and reset from a second active device.

### 34. Medium: production CORS trusts every GitHub Pages and localhost origin

Evidence: `Tradegrow/server/src/index.ts:70-88`.

The CORS policy accepts any `*.github.io` origin and any localhost/127.0.0.1 port while enabling credentials. This is broader than the known application origins and can authorize browser requests from unrelated hosted pages. The practical impact depends on whether credentials are cookies or a script can obtain bearer tokens, but the trust boundary is unnecessarily wide for financial endpoints.

Fix: allow exact production origins, keep localhost allowances behind an explicit development flag, and never use wildcard hosted-domain patterns with credentials. Add automated tests for approved and unapproved origins.

### 35. High: registration OTPs have the same weak-OTP and brute-force pattern

Evidence: `Tradegrow/server/src/routes/api.ts:304-369,370-471`.

Registration codes also use `Math.random()` and are stored as plaintext in Redis. Verification compares the raw value and has no per-email attempt counter or lockout. The endpoint performs duplicate checks and returns different duplicate errors, allowing account enumeration. Non-production `devOtp` output is controlled only by `NODE_ENV`; a misconfigured internet-facing deployment can disclose codes directly in the API response.

Fix: use cryptographic codes, hash them, consume atomically, cap attempts, rate-limit by identifier and IP, return uniform duplicate responses, and make development OTP behavior impossible unless an explicit local-only flag is enabled.

### 36. High: administrators can approve their own wallet adjustment

Evidence: `Tradegrow/server/src/routes/api.ts:2836-2848`; wallet mutation `trading/VirtualWalletLedger.ts:439-493`.

ADMIN and SUPER_ADMIN can adjust any wallet, including their own, and the same actor is recorded as both operator and ledger creator. There is no maker/checker requirement, approval threshold or prohibition on self-targeting. The route is currently virtual-wallet scope, but its financial-control pattern is unsafe to carry into a real-money ledger.

Fix: prohibit self-targeted adjustments, require a second authorized approver above a threshold, separate request and approval identities, and emit immutable before/after evidence. Apply the same policy to direct admin top-ups.

### 37. Medium: customer payment settings expose merchant bank account data broadly

Evidence: `Tradegrow/server/src/routes/api.ts:3268-3320`.

Any authenticated user can retrieve merchant bank account name, account number, IFSC, QR image and payment links. Some values also have hardcoded fallback account details in source. Bank details may be intentionally displayed for deposits, but this endpoint has no KYC, region, fraud or tenant policy and returns more financial information than a payment initiation flow needs.

Fix: move payment instructions to verified configuration, remove source-code fallback account data, return masked details where possible, and use provider-hosted payment intents/webhooks for settlement. Audit changes to payment settings and test that staff-only settings never appear in customer responses.

### 38. Critical: War Room router exposes internal customer and operations APIs without authentication

Evidence: `Tradegrow/server/src/index.ts:115`; routes in `server/src/routes/warRoomRoutes.ts:1470-1745`.

The router is mounted directly under `/api/v1` with no router-level authentication. The internal client 360 endpoint accepts a phone number and returns account identity, KYC state, margin and realized P&L. WhatsApp message history, status, QR/pairing operations, lead lists, stage updates and operational dashboards are also defined without an auth middleware in the shown routes. These are internal tools exposed on the public API surface.

Fix immediately: separate public webhook routes from internal operations, add authentication and granular permissions at the router boundary, enforce manager/customer scope, and restrict internal endpoints by network or service identity. Treat phone-number lookup as sensitive even after authentication. Add unauthenticated and cross-role endpoint tests.

### 39. Critical: unauthenticated WhatsApp operations can send messages and change suppression state

Evidence: `Tradegrow/server/src/routes/warRoomRoutes.ts:1342-1465`.

Pairing-code generation, instance restart, automated sequence triggers, custom sends, manual opt-out and test-send endpoints have no visible authentication or internal-key middleware. An external caller can potentially trigger outbound messages, restart the WhatsApp instance, or suppress arbitrary phone numbers. The exact downstream provider may reject some calls, but authorization is missing before the side effect.

Fix: require service authentication, signed webhook verification for provider callbacks, staff permission checks for broadcasts/restarts, consent checks for every send, and idempotent queued execution. Do not expose QR or pairing endpoints on the public API host.

### 40. High: War Room SSO verification accepts fallback shared secrets and exposes identity claims

Evidence: `Tradegrow/server/src/routes/warRoomRoutes.ts:1552-1640`.

SSO ticket creation and verification use fallback hardcoded secrets when environment configuration is absent. Verification returns user ID, client code, phone, email, role and KYC status to any caller presenting a signed token, without visible audience/issuer/target checks or durable nonce consumption. This duplicates the separate SSO implementation and creates inconsistent trust rules.

Fix: use one SSO implementation with mandatory configured keys, typed issuer/audience claims, short-lived one-time tickets stored in shared state, current user/status/role validation and minimal claim disclosure. Remove duplicate routes and source fallbacks.

### 41. High: public support-ticket lookup is enumerable and accepts customer IDs as references

Evidence: `Tradegrow/server/src/routes/warRoomRoutes.ts:521-560`.

The public lookup searches by either ticket ID or `customer_id`, then returns status, category, timestamps and admin notes. A caller who knows or guesses a phone/client identifier can retrieve the latest ticket without proving ownership. Ticket numbers are only four random digits in the creation path, making guessing practical at scale without strong throttling.

Fix: use high-entropy, non-sequential tracking tokens; never search by customer ID on a public endpoint; require a second factor such as verified email/phone OTP; return only minimal status; and rate-limit failed lookups with monitoring.

### 42. High: public onboarding status accepts phone numbers and exposes applicant state

Evidence: `Tradegrow/server/src/routes/warRoomRoutes.ts:665-750`.

The status endpoint accepts either a reference or raw phone number and returns applicant name, onboarding stage and operational notes. Phone numbers are not authentication. This allows status enumeration and confirms whether a person has initiated KYC or reached account activation milestones.

Fix: require a random application token delivered through the verified channel, avoid phone lookup, minimize response fields, expire tokens and log repeated failures.

### 43. Medium: referral statistics endpoint permits cross-user reads and creates records by arbitrary user ID

Evidence: `Tradegrow/server/src/routes/warRoomRoutes.ts:930-970`.

The route has no visible authentication and accepts any `userId`. It returns referral activity and earned rewards, and creates a referral code for the supplied ID when absent. This is both an IDOR/data-disclosure issue and an unauthorized write into another user's referral state.

Fix: bind the user ID to the authenticated principal, or issue an opaque referral token for public sharing; never create referral records from an unauthenticated lookup; and add ownership tests.

### 44. Critical: unauthenticated War Room mutations can alter activation, creator, and lead records

Evidence: `Tradegrow/server/src/routes/warRoomRoutes.ts:824-925,1727-1785`.

Activation events, creator registration, lead stage changes, lead assignment and related operational writes are exposed as router endpoints without a visible authentication or internal-signature check. A caller can manufacture activation events, create creator partners, reassign leads or move leads through KYC/activation stages. These changes can affect rewards, reporting, customer communications and operational decisions.

Fix: require authenticated staff/service principals, validate allowed state transitions server-side, bind actor identity from the verified principal rather than request fields, and record tamper-evident audit events. Add tests proving public callers cannot mutate any War Room state.

### 45. High: user-controlled support content is interpolated into HTML emails without escaping

Evidence: `Tradegrow/server/src/routes/warRoomRoutes.ts:437-463`; `buildAlertEmailHtml` usage throughout the same file.

Public ticket fields such as name, category and message are inserted directly into HTML strings. A crafted message can inject markup or links into internal and customer emails. This is an email-content injection issue and may become stored XSS if mail is viewed in an unsafe HTML context. The same pattern appears in onboarding alert data.

Fix: HTML-escape every user-controlled value, use a templating engine with auto-escaping, sanitize allowed rich text separately, and test payloads containing tags, attributes and URLs. Keep raw user text in plain-text alternative bodies.

### 46. Critical: broker credentials are committed in source and fallback configuration

Evidence: `Tradegrow/server/src/marketData/angel_ticker.py:25-28`; `server/src/routes/api.ts:210`; `server/src/routes/warRoomRoutes.ts:1509,1560`; `server/src/routes/internalAdvisoryRoutes.ts:40`.

The repository contains concrete-looking API/password/TOTP fallback values and multiple hardcoded shared-secret defaults. Even if some are test credentials, they are treated as live fallbacks by runtime code. Anyone with repository or image access can attempt broker/API authentication, and changing environment configuration does not remove the fallback path.

Fix immediately: revoke and rotate every exposed credential; remove all secret literals and fallback secrets; fail closed at startup; use a secret manager with scoped identities; scan Git history and container layers; and add CI secret scanning that blocks new credentials.

### 47. High: Dhan access tokens are persisted in application configuration storage

Evidence: `Tradegrow/server/src/utils/dhanTokenRefresh.ts:181-272`.

The refresh path writes the broker access token into `system_config` and reloads it at startup. Unless the database column, backups, logs and admin access are separately protected, a database read grants a live market-provider credential. Configuration storage also creates a larger retention and rotation surface than an external secret manager.

Fix: store broker credentials only in a dedicated secret manager or encrypted secret store with key rotation and least-privilege access; persist only expiry/metadata; scrub tokens from logs and admin responses; and rotate all historically stored values.

### 48. High: deployment examples encourage insecure production defaults

Evidence: `Tradegrow/.env.example:4-5,59`; `expert-advisory/backend/.env.example:2-4,59`.

Example configurations enable debug/local mode, use `SESSION_SECURE_COOKIE=false`, include fallback secrets and localhost origins, and leave database credentials blank or defaulted. Examples are frequently copied into deployments; the application should refuse production startup when these unsafe values remain.

Fix: provide separate safe local and production templates, validate `APP_ENV`, debug, secure cookies, origins, keys and database credentials at startup, and add a deployment preflight that fails rather than silently running with defaults.

### 49. High: production compose publishes application replicas directly

Evidence: `Tradegrow/docker-compose.production.yml` (`app-1`, `app-2` ports `5001:5001` and `5002:5002`).

Both application replicas are host-published instead of being reachable only through the TLS reverse proxy. This creates alternate public origins that may bypass proxy security headers, rate limits, canonical-host rules and network controls. The replicas also share the KYC upload volume and mount build/source paths, increasing the blast radius of a compromised app container.

Fix: expose only the reverse proxy, keep application ports on the private Docker network, enforce canonical host/TLS routing, remove source/migration mounts from production images, and use separate least-privilege volumes for sensitive documents.

### 50. Medium: container images and dependencies are not pinned immutably

Evidence: `Tradegrow/docker-compose.yml` and `docker-compose.production.yml` use tags such as `timescale/timescaledb:latest-pg16`, `redis:7-alpine`, `edoburu/pgbouncer:latest`, and `tradegrow-app:latest`.

A redeploy can silently pull a different image, dependency or OS package. For a trading and KYC system, this undermines reproducibility, incident investigation and supply-chain assurance.

Fix: pin image digests, lock package versions, generate SBOMs, scan images, verify signatures, and promote tested immutable images through environments.

### 51. High: database backups are written as unencrypted local files without a stated retention or restore control

Evidence: `Tradegrow/deploy/scripts/backup_db.sh` and `deploy/scripts/deploy.sh` pipe `pg_dump` directly to gzip files.

The backups contain customer identity, KYC, wallet and trading data. The scripts do not show encryption, integrity signing, offsite replication, access restrictions, retention enforcement or restore verification. A host compromise or backup-directory exposure becomes a full data breach, and an untested backup may be unusable during an incident.

Fix: encrypt before leaving the host with managed keys, upload to immutable restricted storage, sign and checksum artifacts, enforce retention/deletion policy, and run scheduled restore drills with measured RPO/RTO.

### 52. Medium: local fallback modes can silently weaken durability and controls

Evidence: `Tradegrow/server/src/db/redis.ts` and health logic in `server/src/routes/api.ts:123-183`; Docker Redis is configured with `--save ""` in the non-production compose file.

The application permits in-memory Redis fallback and reports dependency health while operating in that mode. The development compose disables Redis snapshots entirely. If a production configuration accidentally inherits this behavior, rate limits, nonce/replay protection, pub/sub delivery and idempotency state can disappear on restart.

Fix: fail closed for production when Redis is unavailable or fallback is active for security-critical keys, separate cache from durable state, require persistence/replication in production, and expose readiness only when required guarantees are met.

### Second-pass priorities and validation

Address findings 14 and 15 before the earlier feature roadmap. Next fix order concurrency, withdrawal calculation and verified KYC gating alongside payment and authorization defects. Reconcile contract notes before exposing them as authoritative financial records.

The second pass was source inspection; no production webhooks, notifications, fund operations or orders were submitted. Database-backed race tests and PHP runtime validation remain outstanding. The previously passing 32 tests do not cover these concurrent service paths. No extra test run is claimed for this pass. Only this audit document was edited.

## Demat and real-money readiness gaps (out of scope for this product)

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

## Remediation completed in this session

- Removed the TradingView algorithmic webhook's fallback to the first active user and stopped treating public identifiers as credentials. It now requires a valid HS256-signed session token resolving to an active account (`Tradegrow/server/src/routes/api.ts`).
- Removed hardcoded internal advisory keys and the fallback Meta webhook verification token. Internal routes now accept only `INTERNAL_API_KEY` when configured, and Meta verification fails closed when its secret is absent (`Tradegrow/server/src/routes/internalAdvisoryRoutes.ts`).
- Hardened registration and password-reset OTPs: codes now use `crypto.randomInt`, only SHA-256 digests are stored in Redis, development OTP disclosure requires explicit `ALLOW_DEV_OTP=true`, and password-reset verification no longer falls back to replayable notification metadata (`Tradegrow/server/src/routes/api.ts`). OTP issuance/reset now fail closed when Redis is unavailable.
- Tightened centralized JWT authentication to reject suspended/disabled accounts on both cache hits and database lookups, with a short-lived status-aware auth cache (`Tradegrow/server/src/middleware/auth.ts`).
- Removed query-string bearer-token fallback from the shared HTTP authentication middleware; protected API calls now require an `Authorization: Bearer` header (`Tradegrow/server/src/middleware/auth.ts`).
- Aligned authenticated password changes with the reset flow's eight-character minimum (`Tradegrow/server/src/routes/api.ts`).
- Restricted `/funds/reset-margin` to the `FUNDS_MANAGE` permission so customers cannot invoke a wallet/P&L reset on their own account (`Tradegrow/server/src/routes/api.ts`).
- Removed the committed Didit API-key fallback; KYC integrations now fail explicitly when `DIDIT_API_KEY` is absent (`Tradegrow/server/src/services/diditService.ts`).
- Redacted database pool and raw error details from the public `/health` and `/health/ready` responses while retaining health status and latency (`Tradegrow/server/src/routes/api.ts`).
- Removed the hardcoded lead-webhook shared secret and made the War Room SSO ticket flow use centralized active-account authentication. SSO and webhook delivery now fail closed when their dedicated secrets/configuration are missing (`Tradegrow/server/src/routes/warRoomRoutes.ts`).
- Added HTML escaping for user-controlled lead, questionnaire and support-ticket values before they are rendered into notification emails (`Tradegrow/server/src/routes/warRoomRoutes.ts`).
- Hardened public status lookups: support references are now high-entropy and resolve only exact ticket IDs without internal admin notes; onboarding status requires the application reference and no longer returns applicant names (`Tradegrow/server/src/routes/warRoomRoutes.ts`).
- Added centralized `ADMIN_BROAD_VIEW` authentication to War Room dashboards, CRM, creator, WhatsApp and control routes, protected Client 360 explicitly, and enforced ownership for referral statistics (`Tradegrow/server/src/routes/warRoomRoutes.ts`).
- Protected the activation integration with `INTERNAL_API_KEY`, removed the WhatsApp verification-token fallback, and added webhook authentication using the configured shared secret or Meta HMAC signature (`Tradegrow/server/src/routes/warRoomRoutes.ts`).
- Removed committed broker and messaging credential fallbacks from Dhan, Angel One, Fyers, TradeGrow WhatsApp and advisory WhatsApp integrations. These adapters now require environment/configured credentials instead of silently using source-controlled secrets (`Tradegrow/server/src/marketData/DhanAdapter.ts`, `server/src/marketData/angel_ticker.py`, `server/src/routes/api.ts`, `server/src/services/WhatsAppAutomationService.ts`, `server/src/services/AdvisoryWhatsAppService.ts`).
- Removed the advisory order-preview shared-secret fallback and additional Dhan/Fyers defaults from the admin broker-configuration and OAuth entry points (`Tradegrow/server/src/routes/warRoomRoutes.ts`, `Tradegrow/server/src/routes/adminApi.ts`, `Tradegrow/server/src/routes/api.ts`).
- Removed hardcoded UPI, bank-account and quick-pay defaults from customer/admin payment settings. Missing payment configuration now returns empty/null values instead of fabricated merchant details (`Tradegrow/server/src/routes/api.ts`, `Tradegrow/server/src/routes/adminApi.ts`).
- Removed remaining Angel One/AlphaVantage seeded credentials from the migration and added a cleanup migration for databases that already applied the old seed (`Tradegrow/server/src/db/migrations/005_market_data_config_storage.sql`, `Tradegrow/server/src/db/migrations/041_remove_committed_broker_credentials.sql`).
- Aligned registration and administrative password resets with the eight-character password policy used by password reset and self-service password change flows (`Tradegrow/server/src/middleware/schemas.ts`, `Tradegrow/server/src/routes/adminApi.ts`).
- Added fail-closed Didit webhook verification using `DIDIT_WEBHOOK_SECRET` with constant-time comparison and optional HMAC signature support before processing KYC decisions (`Tradegrow/server/src/routes/api.ts`).
- Hardened Fyers OAuth by removing caller-controlled redirect/state values and adding single-use, ten-minute server-generated OAuth state validation (`Tradegrow/server/src/routes/api.ts`).
- Masked broker secrets in the admin market-data configuration response and prevented masked values from overwriting stored credentials or runtime provider state (`Tradegrow/server/src/routes/adminApi.ts`).
- Restricted detailed dependency and market-data pipeline telemetry to authenticated users with `ADMIN_BROAD_VIEW`; only liveness/basic readiness remain public (`Tradegrow/server/src/routes/api.ts`).
- Tightened order eligibility to require approved KYC (or the explicit completed flag/admin role) for single and basket orders; `SUBMITTED` KYC is no longer treated as trading authorization (`Tradegrow/server/src/routes/api.ts`).
- Updated both customer fund-request paths to compare withdrawals against `withdrawableBalance`, which includes open-position margin and floating losses, instead of buying power alone (`Tradegrow/server/src/routes/api.ts`).
- Scoped order idempotency locks and database uniqueness to the submitting user, preventing cross-account collisions when customers reuse the same idempotency key (`Tradegrow/server/src/trading/OMS.ts`, `Tradegrow/server/src/db/migrations/042_scope_order_idempotency_per_user.sql`).
- Made cancel and modify transitions conditional on the order still being in an eligible state, and only update the execution index after a successful cancellation. Concurrent fills now cause a safe conflict instead of being overwritten (`Tradegrow/server/src/trading/OMS.ts`).
- Blocked administrator self-credit/debit operations across direct balance adjustment and capital-top-up endpoints (`Tradegrow/server/src/routes/api.ts`, `Tradegrow/server/src/routes/adminApi.ts`).
- Order submissions carrying an idempotency key now fail closed when Redis is unavailable instead of relying on a process-local lock that is unsafe across nodes (`Tradegrow/server/src/trading/OMS.ts`).
- Refresh-token exchange now rechecks the account status in the database and refuses to mint access tokens for suspended or disabled users (`Tradegrow/server/src/routes/api.ts`).
- Added password-session revocation: password reset/change/admin reset writes `password_changed_at`, and access/refresh tokens issued before that timestamp are rejected (`Tradegrow/server/src/db/migrations/043_password_session_revocation.sql`, `Tradegrow/server/src/middleware/auth.ts`, `Tradegrow/server/src/routes/api.ts`, `Tradegrow/server/src/routes/adminApi.ts`).
- Corrected customer-facing KYC completion flags to report completion only for approved KYC (or explicit completed/admin exceptions); submitted and under-review applications remain visibly pending (`Tradegrow/server/src/routes/api.ts`).
- Moved browser access and refresh tokens from `localStorage` to tab-scoped `sessionStorage`, reducing persistence and cross-tab exposure (`Tradegrow/client/src/App.tsx`, `client/src/components/AuthModal.tsx`, `client/src/components/RegisterPage.tsx`, related authenticated views). Frontend and backend production builds pass.
- Tightened production browser policy: removed production `unsafe-eval`/`unsafe-inline` scripts, disabled localhost CORS exceptions in production, and removed broad `github.io` credentialed-origin allowance (`Tradegrow/server/src/index.ts`). Backend and frontend builds pass.
- Removed WebSocket query-string bearer authentication. The client now sends the token through the WebSocket subprotocol and the server authenticates that protocol value (`Tradegrow/server/src/websocket/server.ts`, `Tradegrow/client/src/hooks/useMarketSocket.ts`). Backend and frontend builds pass.
- WebSocket authentication now rechecks the account status and current role in the database before enabling authenticated or staff event subscriptions (`Tradegrow/server/src/websocket/server.ts`).
- Removed hardcoded webhook and internal forwarding secrets from the Expert Advisory Next.js routes; lead and Meta webhook handlers now fail closed when their environment secrets are absent (`expert-advisory/frontend/src/app/api/v1/webhooks/tradegrow-leads/route.ts`, `expert-advisory/frontend/src/app/internal/advisory/meta-webhook/route.ts`). Expert Advisory production build passes.
- Fixed a payment webhook state regression: a late provider failure event can no longer downgrade a payment already marked verified (`expert-advisory/backend/app/Domain/Billing/WebhookProcessor.php`). PHP runtime tests remain unavailable in this environment.
- Added invoice-row locking and amount validation to payment webhook settlement, rejecting non-positive or over-balance callbacks and serializing concurrent provider events (`expert-advisory/backend/app/Domain/Billing/WebhookProcessor.php`).
- Restricted advisory research feeds and detail views to delivered, published, non-expired research versions (`expert-advisory/backend/app/Http/Controllers/Api/V1/Client/ResearchController.php`).
- Hardened public grievance tracking: tracking numbers are now high-entropy, and public lookups return status/timestamp only without subject, SLA, resolution notes, or escalation details (`expert-advisory/backend/app/Models/Grievance.php`, `SupportController.php`, `backend/routes/api.php`).
- Added Meta `X-Hub-Signature-256` HMAC verification to the Expert Advisory Next.js WhatsApp webhook before parsing, storing, or forwarding events (`expert-advisory/frontend/src/app/internal/advisory/meta-webhook/route.ts`). Expert Advisory build passes.
- Restricted admin market-data configuration writes to the known Dhan, Fyers and Angel One credential keys; arbitrary system-config keys are ignored (`Tradegrow/server/src/routes/adminApi.ts`).
- Removed the Laravel WhatsApp verify-token fallback and added Meta HMAC verification to the inbound WhatsApp webhook before processing messages or delivery updates (`expert-advisory/backend/app/Http/Controllers/Api/WhatsAppWebhookController.php`).
- Removed fabricated analyst names and registration numbers from advisory previews; signed recommendations now require a report ID and explicit analyst identity before they can be displayed (`Tradegrow/server/src/routes/ssoRoutes.ts`, `Tradegrow/server/src/routes/warRoomRoutes.ts`).
- Added post-upload KYC file-signature validation for PDF, JPEG, PNG, WEBP and HEIC/HEIF files, removed `application/octet-stream` acceptance, and delete rejected files before persistence (`Tradegrow/server/src/middleware/upload.ts`, `Tradegrow/server/src/routes/api.ts`).
- Corrected execution-price provenance so option-chain cache values, Black–Scholes estimates and order-price fallbacks are persisted as cached/synthetic sources rather than live exchange ticks; both event-driven and reconciliation fills now derive source and freshness from explicit tick metadata (`Tradegrow/server/src/trading/ExecutionEngine.ts`).
- Corrected stop-limit matching in both event-driven and reconciliation execution paths: `SL` orders now require the post-trigger quote to satisfy the limit, while `SL_M` retains stop-market behavior (`Tradegrow/server/src/trading/ExecutionEngine.ts`).
- Added explicit RBAC to advisory universal-import, AI lead controls, vendor analytics and workflow-trigger routes. Lead AI actions now also pass the bound lead through `LeadPolicy`, and import-batch listings/details are restricted to the uploader unless the caller has `leads.view_all` (`expert-advisory/backend/routes/api.php`, `app/Http/Controllers/Api/UniversalImportController.php`).
- Made advisory research distribution fail closed when a client has no valid finalized, unexpired and acknowledged risk profile; unknown client or recommendation risk no longer defaults to MODERATE (`expert-advisory/backend/app/Domain/Research/ResearchDistributionService.php`, `tests/Feature/ResearchDistributionTest.php`).
- Hardened the research performance ledger against pre-publication daily extrema and stale quotes: it now requires a post-publication observation, ignores unorderable provider high/low fields, uses the observed post-publication price, and records methodology `v1.1-post-publication-spot` (`expert-advisory/backend/app/Domain/Research/PerformanceLedgerService.php`).
- Hardened payment webhook retries: invalid signatures are quarantined without reserving the provider event ID, interrupted `received` events can resume, terminal events remain idempotent, and Razorpay no longer uses a payment ID as a substitute for distinct webhook event IDs (`expert-advisory/backend/app/Domain/Billing/WebhookProcessor.php`, `app/Domain/Billing/Gateways/RazorpayGateway.php`).
- Made universal lead-import execution recompute canonical phone normalization, suppression, duplicate detection and validation on the server. Client-supplied validation statuses and existing lead IDs are no longer trusted to create or enrich records (`expert-advisory/backend/app/Domain/Crm/UniversalLeadImporter.php`).
- Hardened TradeGrow SSO tickets with a dedicated signing secret, issuer/audience/type validation, strict target validation, Redis-backed atomic nonce consumption, fail-closed replay protection, and current database staff-role verification (`Tradegrow/server/src/routes/ssoRoutes.ts`).
- Implemented persisted refresh-session rotation: refresh tokens are hashed in `refresh_tokens`, rotated after each use, revoked on logout, and reuse of a revoked/unknown token revokes the remaining family (`Tradegrow/server/src/routes/api.ts`).
- Added permission-aware WebSocket administration: staff subscriptions load catalog/default-role and per-user override permissions, platform-wide streams require order/funds access, chat replies require `SUPPORT_CHAT_RESPOND`, and event fan-out filters order, funds, KYC and support events by permission (`Tradegrow/server/src/websocket/server.ts`).
- Reconciled TradeGrow contract notes with immutable execution charge fields instead of independently recomputing taxes, and removed fabricated broker membership/settlement identifiers; unconfigured notes are explicitly labeled simulation ledger output (`Tradegrow/server/src/routes/api.ts`).
- Added a final market-data freshness gate at advisory publication, so a snapshot that became stale during compliance or analyst review cannot be distributed without a new current snapshot (`expert-advisory/backend/app/Domain/Research/ResearchWorkflowService.php`).
- Removed live Dhan access-token persistence from `.env` and `system_config`, removed the admin configuration key, and added a cleanup migration for previously stored tokens (`Tradegrow/server/src/utils/dhanTokenRefresh.ts`, `server/src/routes/adminApi.ts`, `server/src/db/migrations/044_remove_persisted_dhan_access_tokens.sql`).
- Hardened the production compose topology: application replicas are private-network `expose` services rather than host-published ports, source/build/migration bind mounts were removed, base images use fixed versions, and deployment now requires an explicitly supplied approved `TRADEGROW_IMAGE` reference instead of silently using `latest` (`Tradegrow/docker-compose.production.yml`).
- Hardened durability defaults: Redis now uses AOF plus snapshots with `noeviction`, and the deployment backup is encrypted with a required key file, checksummed, permission-restricted and retention-pruned instead of leaving plaintext gzip dumps (`Tradegrow/docker-compose.yml`, `Tradegrow/scripts/deploy.sh`).
- Added production startup preflight checks for explicit simulation safety, non-localhost CORS origins and disabled development OTP disclosure; replaced reusable JWT examples and removed the Dhan token placeholder from the environment template (`Tradegrow/server/src/middleware/auth.ts`, `Tradegrow/.env.example`).
- Made Redis mandatory for production startup and readiness; in-memory fallback is no longer reported as healthy for dependency diagnostics or load-balancer readiness (`Tradegrow/server/src/middleware/auth.ts`, `server/src/routes/api.ts`).
- TradeGrow TypeScript build passed after the changes.
- Focused SSO and order-execution suites passed: 9 tests total.

- TradeGrow backend TypeScript build passed.
- Four focused Jest suites passed: marginMath, tradePnLAccounting, limitExecutionAndTradeHistory and sso_advisory: 32 tests total. These do not disprove the findings; several test cases exercise copied logic or data contracts rather than production behavior.
- TradeGrow frontend TypeScript/Vite production build passed.
- PHP and Composer were unavailable, and backend vendor dependencies were absent. Advisory findings are static-review findings; Laravel tests were not executed. Runtime installation or framework bootstrap was unnecessary for this read-only audit.
- No production accounts, live orders, payments, external messages or customer data were manipulated. Full database-backed integration, security, performance and deployment reviews remain separate validation work. The OTP changes were validated by the server TypeScript build and the two focused suites above; dedicated OTP endpoint tests are still recommended.
