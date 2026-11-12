# Expert Stocks CRM: code audit and production completion plan

Date: 12 November 2026 (India). Original audit baseline: `b3035c0`. Implementation rebased by fast-forward onto verified production source `2022ea4deae0ebe23bb26be7bd945195ef150263`.

## Decision and scope

**Not ready for production automation.** This is a source audit of the local `expert-advisory` application, plus local HTTP/browser regression checks. It is not an audit of the deployed database, Vercel configuration, Meta account, or live permissions. The screenshot is contextual evidence, not an instruction source. Live `expertstocks.in` inspection was blocked by the environment's outbound policy. Follow-up authenticated Vercel inspection verified `master-project-frontend`, its Node 24 runtime, verified custom domains, and production commit `2022ea4deae0ebe23bb26be7bd945195ef150263` on `cyberbuzz001/master-project:main`. The implementation checkout now includes that verified production revision and preserves its newer TradeGrow changes. Vercel initially had no dashboard environment variables, and the user confirmed Laravel is undeployed. See `VERCEL_AGENT_SETUP.md` for applied frontend configuration and remaining backend work.

The repository README's “production ready” description conflicts with implementation findings below. Do not use that statement as release evidence.

## Changes prepared locally

- Login, `/me`, logout, CSRF bootstrap and client portal operations now proxy to Laravel. They preserve upstream failures, separate Set-Cookie headers, multipart bodies, and CSRF headers. Missing/unreachable backends return 503. No passwordless administrator fallback or browser-editable base64 identity is accepted by Next.js.
- `/office` and its nested routes now resolve to Laravel before the competing Next.js page. The latter no longer mounts the prototype CRM. This makes the existing audited staff-creation and lead-import tools reachable **when a working backend is configured**. The code change does not deploy or provision that backend.
- The prototype `/api/v1/office/*`, its `/api/leads` and `/api/subscriptions` aliases, and the local JSON TradeGrow ingress return 410. They can no longer read/write local CRM state or send messages. External consumers of these endpoints need migration; this is an intentional compatibility break.
- Public lead capture goes to one authoritative CRM endpoint. It no longer returns success after failed persistence, defaults a missing WhatsApp choice to consent, fans out to multiple welcome senders, or issues risk certificates from submitted scores.
- Anonymous certificate emailing is retired. A verified report resend needs an authenticated or expiring-token backend flow.
- The legacy Meta webhook verifies POST signatures over the original bytes, requires an explicit verify token for GET, waits for backend acceptance and returns backend failures so Meta can retry. The directly exposed Laravel webhook now verifies raw-byte HMAC, validates the WABA/phone, stores durable events and queues processing.
- Removed embedded WhatsApp and mail credential fallbacks. Remaining server-side WhatsApp helpers require configured credentials/version, have timeouts, and require a provider message ID before reporting success. Tokens already present in source/history must be revoked and rotated by the account owner; deleting them from this revision is insufficient.

These routing changes are supplemented by the backend implementation below; production activation remains incomplete. The custom dashboard components remain in the source but are no longer the staff entry point.

## Implementation status — 12 November 2026

**Implemented locally, not deployed.** PHP 8.4 and Composer now run in a local Docker runtime. Laravel Boost was installed as required by the original backend instructions; the prior runtime blocker is resolved. Automated backend tests use isolated SQLite databases, and Meta tests use HTTP fakes.

| Area | Implemented behavior |
|---|---|
| Staff entry and roles | `/office` resolves to the existing Laravel panel and audited staff account/role service. Staff sessions require 2FA; forged frontend identities no longer authorize actions. Existing staff lifecycle and role tests remain part of the full suite. |
| Universal lead import | A real two-step staff wizard and API use private, owner-bound 30-minute previews. Commit reloads server data, revalidates duplicates/suppression/assignment, and replays the same batch without another import. CSV first-column headers, XLSX bounds, explicit opt-in, uncertain OCR exclusion, scoped reports and CSV formula escaping are covered. Universal import is limited to 500 rows and 4 MiB; use the existing queued CSV importer for larger batches. |
| Meta delivery | One real Cloud API gateway; no simulated success or embedded credentials. Requires current internal and Meta template approval, variable mapping, channel/purpose consent, suppression checks and configured outreach hours. Supports approved DOCUMENT/IMAGE header media IDs. “Accepted” requires a provider message ID; delivery/read status comes from signed callbacks. |
| Templates | Communications → Message templates provides draft/edit, separate-person approval and live Meta verification. Body/language/variable mapping must match Meta. Approved drafts cannot be edited. A concurrent edit invalidates an in-flight verification result. |
| Webhooks | Raw-byte signatures, configured verification token, WABA and phone checks; durable per-message/status deduplication; queued atomic processing; monotonic delivery status. Stale inbound messages do not create a new 24-hour service window. STOP remains effective while automation is disabled. |
| Automation outbox | Atomic claims, persisted attempts/provider IDs, stable intent keys, bounded processing, delayed 429 retry with jitter, cancellation and reasoned operator retry. Ambiguous sends and interrupted workers require reconciliation; they are not blindly resent. Global automation defaults off and also disables automatic inbound replies. |
| Trial lifecycle | Scoped requests, explicit authorized approval, activation during configured trading sessions, holiday/weekend calendar, exactly one activation intent and first-session review intent, review tasks, feedback/handoff tasks, cancellation and conversion checks. Inbound demo/appointment requests no longer claim immediate activation or confirmed availability. |
| WhatsApp inbox | Scoped contact history/search, human takeover/resume with audit reason, staff replies within the verified 24-hour window, delivery status and duplicate-submission protection. Human replies pause the automated assistant. |
| Research and education | Explicit paid-service/trial audiences, shared checks at distribution/list/detail/send, current subscription start/end, approved active trial dates, publication/expiry and finalized acknowledged risk profile. Recommendations also require verified active onboarding. Publication can queue an approved WhatsApp template, including a reviewed PDF media ID; consent/entitlement are checked again at send time. |
| Client portal | Dashboard uses the signed-in client's backend profile, subscriptions, trials, notices and research. Removed invented profit/calls/advisor/account figures and simulated broker order receipts. Missing disclosures display “Not provided.” |
| Broker administration | Administrative role and verified 2FA, fixed callback origin, single-use OAuth state, no client-supplied redirect, no embedded broker credentials or token responses. Missing broker authorization cannot produce a successful simulated order. |

### Operating the implemented flows

- **Staff:** Administration → Users → Add staff user. Use least-privilege roles; a client account is not a staff account.
- **Import:** CRM → AI Lead Importer → Bulk Upload & Paste Numbers → Source → Review & confirm. Consent is unchecked until supporting evidence is supplied. Old universal API consumers must send `preview_id` from the server; `preview_result` is rejected.
- **Trials:** request a trial against an accessible lead, then an authorized manager approves it. Scheduler command `crm:activate-trials` activates approved sessions; `crm:process-automation-workflows` processes due sends.
- **Messaging:** draft the exact Meta body and ordered variables, obtain another reviewer's approval, then Verify with Meta. Trial keys: `esc_trial_activation_v1` (name, type, start, end, portal) and `esc_trial_day1_review_v1` (name, trial reference). Actual Meta approval is still required.
- **Research/education:** choose eligible services/trial types and an optional approved publication template. Publication variables are `name`, `report_title`, `portal_link`; template purpose must be `research_communication` or `educational_content` as appropriate. An education template with a DOCUMENT header uses its reviewed Meta media ID. Existing reports have no default audience after migration: configure a draft's audience through Set draft audience, then complete the normal approval/publication flow.
- **Inbox/outbox:** Communications → WhatsApp inbox for replies and takeover; Automation outbox for failures/cancellations. Reconcile unknown outcomes with Meta before creating any replacement send.

### Remaining release and product work

1. Deploy the Laravel backend, SQL database, shared cache, durable queue workers and scheduler; connect Vercel `BACKEND_URL` and verify the complete browser → Laravel → database path on the actual domains. Apply the new migration in staging before rollout; no production migration has run.
2. Rotate every previously exposed Meta/mail/broker secret. Supply actual Meta configuration, approved WABA templates and reviewed media IDs in secret storage. Set `WHATSAPP_GRAPH_VERSION` to a supported version. Keep `WHATSAPP_AUTOMATION_ENABLED=false` until staging acceptance and owner-approved test delivery succeed. Maintain `CRM_TRADING_HOLIDAYS` and business session settings against the actual exchange calendar.
3. Complete the managed educational media library: private upload, malware/MIME/size checks, document review/versioning, authenticated downloads and retention. The implemented document flow accepts a reviewed Meta media ID; it does not upload/scan files or host a PDF library. Clients without a linked CRM lead currently receive portal delivery only.
4. Add expiring staff invitations/initial password change, richer campaign audience previews/test sends/frequency limits, template selection outside the service window in the shared inbox, queue heartbeat alerts and a reconciliation screen for failed webhook events. These are not represented as completed.
5. Resolve remaining full-frontend lint failures, validate MySQL/Redis concurrency and load limits, verify backups/restore, and exercise production-like sessions, assets/Livewire uploads, current onboarding, payment activation and access expiry. Local SQLite/controlled-browser tests do not establish these deployment properties.
6. Review market-data/AI production provider settings and source-data reconciliation. No historical JSON CRM state has been migrated, and no broad trading/portfolio execution feature has been enabled.

## Original findings and remediation requirements

These findings describe the audit baseline. The implementation status above supersedes them where a repair is marked implemented; unlisted operational/product work remains outstanding.

| Priority | Evidence | Effect | Required fix |
|---|---|---|---|
| Critical | `backend/app/Http/Controllers/Api/WhatsAppWebhookController.php::handle` | Direct API accepts inbound/status payloads without verifying Meta's signature; it can create leads and invoke AI. | Verify `X-Hub-Signature-256` against raw bytes with the app secret before processing, validate WABA/phone ID, persist unique event/message IDs and enqueue processing. No default verification secret. |
| High | `backend/routes/api.php`, universal import and workflow/AI-control routes | Authentication and 2FA exist, but several routes have no operation-specific permission middleware; universal import controller/service does not supply the missing checks. | Require `leads.import`, authorized batch access, lead ownership/team scope, assignment authority and workflow privileges in backend policies/services. Test direct HTTP requests for each role. |
| High | `backend/app/Http/Controllers/Api/UniversalImportController.php::execute`, `UniversalLeadImporter::executeImport` | Execute trusts client-supplied summary, row validity, existing IDs and suppression decisions. A crafted request can bypass preview validation or target another existing lead. | Keep immutable preview server-side with actor, expiry and content hash; execute by preview ID; recompute phone validation, suppression, duplicates and permissions inside the write transaction. Add unique/idempotent commit protection. |
| High | `UniversalLeadImporter::parseXlsxFile`, `detectHeaderColumns` | Index zero is tested with `empty()` when detecting an XLSX header. A single recognized header in column A can be treated as data. Legacy `.xls` is also sent to an XLSX reader. | Use `isset`/key existence; test phone-only column A, quoted CSV, BOM, multiline cells, international numbers and leading zeroes. Explicitly reject unsupported XLS or add its reader. Verify OpenSpout is available rather than relying implicitly on transitive packages. |
| High | `UniversalLeadImporter::previewAndValidate` | Low-confidence OCR increments a counter but may still be marked `valid_new` and imported. | Require explicit human correction/approval for uncertain digits; preview must never imply OCR is verified. Prefer ordinary CSV for operational uploads. |
| High | `backend/app/Domain/Crm/AutomationWorkflowEngine.php::executeAction` | Calls `WhatsAppService::sendMessage`, which does not exist; payload is read from `action_payload` while the model stores `action_payload_json`. | Dispatch an approved template with validated parameters through one gateway; read the correct payload field and inspect provider results. |
| High | `AutomationWorkflowEngine::processPendingActions` | No atomic claim per action; competing workers can send the same action twice. Unknown actions log then become executed. Disabled workflows and current consent are not consistently rechecked. | Atomic claim/lease, unique send key, explicit allowed actions, workflow-active and entitlement checks, bounded retry/backoff and failure queue. Treat ambiguous provider timeouts separately from definite rejection. |
| High | `backend/app/Domain/Communications/WhatsAppService.php` | Missing credentials produce mock “sent”; Graph version is hardcoded; text with no lead bypasses the session check; template consent checks reject only a few negative states. | Production must fail closed. Require recipient/channel permission, latest consent and suppression checks, positive active consent for initiation, a verified inbound session for freeform text, configured supported API version and real provider acknowledgement. |
| High | `backend/app/Domain/Communications/NotificationService.php::send` | WhatsApp branch fabricates `wa-*` IDs without contacting Meta; consent uses any historical grant instead of latest state. | Route all sends through the real gateway and evaluate the latest purpose/channel consent. “Accepted”, “sent”, “delivered”, “read”, and “failed” must be separate states. |
| High | `backend/app/Filament/Resources/FreeTrials/FreeTrialResource.php` | Trial creation records the current user as approver; lead choices/query lack demonstrated owner/team scope. No activation/day-one messaging is wired here. | Apply policy and scoped lead queries, validate trial dates/eligibility, record a genuine approval transition and emit lifecycle events only after transaction commit. |
| High | `backend/app/Domain/Research/ResearchDistributionService.php` | Distribution is portal-only; missing profiles default to MODERATE; subscription query does not test starts_on or matching service/segment. | Eligibility must include current trial or paid entitlement, dates, required onboarding, explicit suitability and research publication approval. Add WhatsApp as a distinct delivery channel with per-recipient results. |
| High | `backend/app/Http/Controllers/Api/V1/Client/ResearchController.php::show` | Detail checks historical distribution but does not repeat index's current subscription check. | Apply one entitlement policy to list, detail, PDF links and every message send; test expired, cancelled, future and wrong-segment subscriptions. |
| High | `frontend/src/lib/leads-store.ts` | Writes `scratch_leads_store.json` under `process.cwd()`. This is not durable/shared Vercel storage. | Migrate any real data with source reconciliation and backups into the backend database; never use process-local JSON as production CRM storage. |
| High | `frontend/src/app/api/v1/auth/fyers/*`, `frontend/src/lib/fyers.ts` | Broker integration remains outside this patch's security boundary and needs a separate review of global token storage, anonymous actions, OAuth state and secret handling. | Restrict administrative integration operations, verify OAuth state and redirect allowlists, isolate credentials and prevent cross-client account access before enabling broker features. |

## Make adding users reliable

The custom `TeamManagementView` was a static `CRM_USERS` directory without a create-user action. The existing real flow is Administration → Users → **Add staff user**, backed by `StaffUserService` and `RoleAssignmentService`.

Required release checks:

1. An authorized administrator creates a staff member with name, unique normalized email, role, optional team/manager, temporary password and audit reason.
2. A role without both `users.create` and `roles.assign` cannot create staff via UI or API. Privileged assignment follows its additional gate.
3. The new user signs in through Laravel, enrolls 2FA, and sees only permitted work. Add an expiring invitation/reset-password flow and force initial password change rather than routinely sharing temporary passwords.
4. Deactivation invalidates sessions and queue ownership; reassignment preserves history. Prevent self-escalation and removal of the last active administrator.

Recommended responsibility boundaries (these are desired behavior, not a claim all policies already enforce them):

| Role | Operational access |
|---|---|
| Super Admin | Identity, integrations, configuration and recovery; privileged changes audited |
| Management | Verified reports and operational oversight within explicit permissions |
| Sales manager | Team leads, routing, imports, campaign review; no research approval |
| Sales agent | Assigned leads, trial requests, calls and follow-ups; no global exports or role changes |
| Research analyst | Draft research and education; cannot independently approve own publication |
| Compliance reviewer | Approval, communications templates and audit; separation of duties |
| Relationship manager | Assigned clients, renewals, service and education distribution |
| Support | Assigned tickets and service context; no unrestricted finance/research mutation |
| Finance | Verified payments, invoices, refunds and entitlement events |
| Client | Own dashboard, entitled research/materials, own invoices and support only |

Enforce these in backend policies and queries. Hiding navigation is not authorization. Avoid an interactive persona selector on a real staff session.

## Make bulk uploading reliable

Start with **CRM → Leads → standard CSV import** after verifying the backend and queue worker. `docs/templates/lead-import.csv` supplies headers for that existing importer; it intentionally contains no real contacts. Required fields are `full_name` and `mobile`. Allowed segments: `equity,options,futures,commodity`; capital: `under_1l,1l_5l,5l_25l,25l_1cr,over_1cr,prefer_not`; experience: `none,under_1y,1_3y,3_5y,over_5y`.

A final upload flow should provide: downloadable template → upload/field mapping → dry-run counts and row errors → consent evidence and permitted assignment → explicit commit → queued progress → reconciliation report. Include duplicates within the file and CRM, suppressed contacts, invalid numbers, accepted rows and failed rows. Do not infer WhatsApp permission from list ownership or file upload. Re-uploading the same committed batch must not create more leads or repeat outreach. Imports should succeed independently of Meta outages.

The universal importer needs the fixes above before exposure beyond administrators. Its current transaction processes the entire batch synchronously, so enforce tested row/file limits and move large imports to chunked jobs. Scan spreadsheet exports for formula injection and keep uploads/reports private with retention limits.

## Requested Meta WhatsApp workflows

Template names below are **proposals**, not approved Meta templates. Actual category, language, variables and media header must match approval in the connected WABA. Use an approved template outside the 24-hour customer-service window; only verified inbound messages open that window. Obtain opt-in for applicable proactive messaging and honor STOP immediately. Verify the firm's actual ability to distribute advisory content and required disclosures; do not claim registration or guaranteed returns from template text.

| Event | Proposed template | Recipient and behavior |
|---|---|---|
| Trial becomes active | `esc_trial_activation_v1` | Eligible, opted-in trial user; name, service, actual start/end, portal link. One send per trial activation version. |
| First trial trading session completes | `esc_trial_day1_review_v1` | Still-active trial; request feedback with useful buttons: Good / Need help / Call me. Use trading-session completion in Asia/Kolkata, not blindly 24 hours after creation. |
| Trial nearing expiry | `esc_trial_completion_v1` | Eligible opted-in trial; factual expiry, review appointment and optional service details. Cancel after opt-out, cancellation or conversion. |
| Education published | `esc_education_document_v1` | Selected trial/paid audience; approved document-header template where needed. Use private media storage, malware checks, MIME/size validation, versioned PDF and authenticated or expiring access. |
| Approved call/level published or revised | `esc_research_update_v1` | Entitled clients only, matching segment and suitability. Persist entry/stop/targets, author, approval, version and validity; corrections are new versions with an explicit superseded reference. No AI-invented levels. |
| Payment verified/subscription activated | `esc_subscription_activation_v1` | Verified backend payment event enables access and confirms plan dates. An unverified webhook or client button must not mark payment as collected. |
| Renewal/service follow-up due | `esc_service_reminder_v1` | Current client status and consent rechecked; avoid repetitive messages across workflows. |

Build a shared inbox with assigned staff, human takeover/pause, template picker, approved media library, incoming replies, delivery status, search and internal notes. Add segment previews and recipient counts before broadcast, a test-send facility, scheduled publishing, frequency caps and a campaign kill switch. Do not let marketing campaigns bypass research entitlement checks.

### Delivery and automation architecture

Use one durable chain: backend event → transaction outbox → scheduled job → eligibility recheck → Meta request → provider acceptance → signed status webhook → client/staff timeline.

Suggested unique intent key: `(event_id, recipient_id, channel, template_version)`. Persist attempts, redacted failure details, provider message ID and timestamps. Schedule workers need atomic claims, recoverable leases, retry delays with jitter, rate-limit handling and a dead-letter/operator retry screen. Webhook ingestion must be idempotent and delivery state must not regress on older events. A provider timeout is ambiguous: do not blindly duplicate sends. Meta does not make an application-level database key into guaranteed exactly-once delivery.

Record automation cancellations for opt-out, expired entitlement, unsuitable content, trial cancellation, human pause and disabled workflow. Use configurable contact hours and trading calendars; these are business settings, not hardcoded claims about universally mandated hours.

Daily operations should produce actual queues: new/unassigned leads, overdue follow-ups, trial activation/review, KYC/agreement exceptions, failed messages, payment verification, expiring subscriptions and unresolved support. Alert an owner when a queue stalls. Any AI assistant may draft, summarize and suggest next actions; it must not assign permissions, approve payments or publish trading calls.

## Client dashboard requirements

Show the signed-in client's own trial/paid plan, real expiry and remaining trading sessions, onboarding checklist, assigned contact, entitled calls with timestamps/versions, educational library, invoices/receipts and support history. Clear pending/unavailable states are preferable to invented figures. Keep risk acknowledgement and notification preferences accessible. Distinguish trading calls from educational material. A client cannot open another client's document by changing a URL; authorization must run when downloading, not only when listing.

## Vercel and backend release prerequisites

Vercel can host the Next.js frontend. The existing PHP application needs a compatible Laravel hosting service, durable SQL database, Redis/queue workers, a scheduler and private document storage. A Vercel frontend project alone does not run this application's PHP panel or long-running workers.

- Frontend project identified by the user: `master-project-frontend`. Verify its Git repository, root directory `expert-advisory/frontend`, branch and deployed commit. Confirm the local code corresponds to production before merging changes.
- Provision/identify the Laravel host and set `BACKEND_URL` to its HTTPS origin **at build and runtime**, since Next.js rewrites are computed at build time. Rebuild after changing it. Never point it back to the same frontend and create a proxy loop.
- Test the same-origin reverse proxy for office pages, Livewire, Filament JS/CSS/fonts, SSO, APIs, CSRF and private document links. Configure Laravel APP_URL, session cookie domain, Sanctum domains and trusted proxies for each environment; production and preview domains must not share inappropriate cookies.
- Match upload size/time limits across Vercel and the backend. For larger imports use private direct uploads and a server-side import token rather than a giant synchronous request.
- Rotate exposed Meta/mail credentials and any affected integration secrets. Store replacements only in environment/secret settings. Configure the actual WABA, phone ID, app secret, webhook verification token and approved template versions.
- Back up and reconcile existing local data before migrating. Verify a restore in staging. Deploy schema compatibly before enabling new jobs and maintain a rollback path.
- Verify worker/scheduler heartbeat, failed-job alerts, signature failures, import progress, message failure rate, backups and access logs without logging message bodies or secrets unnecessarily.

## Validation and remaining access

Local checks cover the Next.js trust boundary using a controlled mock backend, plus Chromium navigation with a forged session. They do not establish that Laravel's own policies or Meta delivery work. Run `npm run test:security` in `frontend` with Chromium installed (`CHROMIUM_EXECUTABLE_PATH` overrides `/usr/bin/chromium`). Run TypeScript/build/lint and the complete PHP suite before release.

Backend changes and tests are now implemented in a PHP 8.4 Docker runtime, with the required Boost bootstrap complete. No live deployment, credential rotation, customer message, production migration or real data import was performed.

Release acceptance must demonstrate: staff creation/2FA and least-privilege checks; authorized import and duplicate-safe replay; trial activation/day-one review; approved educational PDF delivery; entitled/versioned research distribution; STOP cancellation; duplicate webhook replay; provider outages/retries; cross-client denial; expired access; backup restore; and queue recovery. Production automation stays disabled until these pass.

### Results for this implementation

- Backend full regression suite: **237 passed, 1,718 assertions** (PHP 8.4, isolated SQLite). The initial unmodified baseline had 189 passing and 2 failing tests; both baseline defects have been addressed. The additional concurrent Meta-verification regression also passed in the five-test template suite.
- Targeted tests cover import tampering/replay, staff wizard, template separation and concurrent verification edits, Meta acceptance/outages, webhook signatures/replay/order, trial calendar/approval, human inbox ownership/window, research entitlement and approved PDF notification.
- Frontend `npm run test:security`: 19 passing checks, including Chromium navigation and a backend-controlled client dashboard. This validates frontend boundaries with fixtures, not a deployed Laravel instance.
- `npx tsc --noEmit` and `npm run build`: passed.
- Targeted ESLint for the changed portal pages, broker library/admin guard and broker auth routes: passed.
- Full frontend ESLint: **73 errors and 385 warnings** remain in existing application code. This remains a release blocker; the successful build and targeted check do not waive it.
- `vendor/bin/pint --dirty --format agent`, `composer validate --strict` and `git diff --check`: passed.
- Actual Meta delivery, production migration, live role sessions, database concurrency/load and backup restore: not performed; remain release prerequisites.
