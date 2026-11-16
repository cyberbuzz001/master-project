# Research Desk release and deployment handoff

## Implemented

* Full upstream repositories pinned as Git submodules with original licenses.
* Admin Research Desk: exact instrument search, Dhan snapshot loading, risk inputs,
  optional AI reports, persistent job history, expiring level cards and JSON export.
* Persistent automated watchlist with a ten-instrument maximum, 5–1440 minute
  service interval bounds, per-schedule risk/AI settings, removal and latest-job/error visibility.
* Single scheduler claims one due instrument every 30 seconds. It fetches fresh
  snapshots from the internal Node endpoint; it does not replay uploaded snapshots.
* Research-specific REST quotes read actual depth and circuit fields. Research does
  not use the streaming parser's inferred bid/ask. Missing/non-finite circuit/depth
  fields, invalid spreads, expired metadata or missing holiday calendars block runs.
* Conditional plans outside supplied circuit limits are rejected. Imported diagnostic
  snapshots may omit circuit fields; they are staff-provided and are not used by schedules.
* Durable bounded job queue, idempotency keys, authenticated private endpoints,
  subprocess AI timeout and no automatic order execution/client distribution.

## VPS status

SSH to `root@200.234.34.4:22` returned **connection refused** during this release.
No server files, containers, DNS, secrets or production database were changed.
Authenticated live Dhan/model-provider tests and deployment have not been performed.

## Operator deployment sequence

The running stack is `/opt/tradegrow/docker-compose.production.yml`, with four
app replicas, PgBouncer and shared server/client dist mounts. Preserve its actual
configuration: the repository compose is not a verified replacement. The legacy
`scripts/deploy.sh` targets a single `tradegrow_app` and must not be used for this stack.

1. Confirm SSH/network access, checkout root/branch, clean or preserve local changes,
   compose service names, internal port, bind mounts, free disk and image IDs.
2. Back up the live compose/environment, PostgreSQL and any existing research volume.
   Record all four running app image IDs and release directories for rollback.
3. Fetch the approved revision and initialize its submodules:
   `git submodule update --init --recursive`.
4. Build and test in a separate release directory. Do not overwrite the shared
   live dist mount while replicas are serving it. Use a maintenance window or
   a separately reviewed release switch/drain procedure for those mounts.
5. Merge `compose.example.yml` into the live configuration after checking service
   names/network. Do not expose research port 8010 on the public host.
6. Set the same random `RESEARCH_API_KEY` (32+ characters) on research and all Node
   replicas. Set Node `RESEARCH_SERVICE_URL=http://research-engine:8010` and research
   `RESEARCH_NODE_URL` to a verified internal Node address/port.
7. For AI, build with `ENABLE_TRADINGAGENTS=true`, resolve and pin the upstream
   transitive dependencies for the production image, and pass the chosen provider's
   credentials and `TRADINGAGENTS_*` model settings through the deployment environment.
   No provider credentials are needed for deterministic levels. Set provider spending
   limits before enabling automatic AI schedules.
8. Recreate affected services using the actual deployment procedure, preserve the
   research volume and verify API health, logs and all four app replicas.
9. During an open market session, test a liquid stock and one exact-expiry option.
   Inspect raw authenticated Dhan response fields, real depth and price bands,
   snapshot metadata, generated level limits and rejection behavior. Missing or
   differently shaped provider data must stay blocked until mapping is verified.
10. In Admin → Daily Operations → Research Desk, submit a report, add a watchlist
    schedule, confirm a new job appears automatically, then remove the schedule.
    Removal stops future runs; already queued/running jobs are not cancelled.
11. Test model credentials and a paid AI report separately. Review factual/source
    quality and underlying ticker coverage; generated text never changes numeric levels.

## Monitoring and rollback

Monitor research `/health` through the private network with authorization, job
failure counts/age, schedule errors, worker logs, DB disk use and provider costs.
Back up SQLite through its backup API (include schedules), not by copying only
the live main file while WAL writes are active. Set retention operationally;
automatic data deletion is not enabled in this release.

Rollback uses the previously recorded app release/image and compose configuration.
Stop the research service to stop new scheduling and preserve its named volume.
Research uses its own SQLite schema; this release adds no PostgreSQL migration.
Do not prune volumes or delete the production database during rollback.

## Verification limits

Local fixture tests cover quote mapping, invalid data, circuit rejection, scheduler
submission/idempotent claiming, API access and browser interactions. They do not
prove feed entitlement, provider payload freshness, live model quality, or VPS health.
Full application build passing does not establish production readiness for the
entire trading platform. Research review/approval and WhatsApp publishing remain
outside this draft-only research release.
