# TradeGrowX automated research

This private service combines Day Trader Skill scanner/exit math with an optional
TradingAgents company research graph. It is separate from the execution engine.
Reports remain DRAFT and are never sent to clients or converted into orders.

## Included upstream repositories

Git submodules retain the complete upstream repositories and their licenses:

* `upstream/day-trader-skill`: MIT, Jake Schincariol,
  pinned at `3d0f4ef6986f4984b7c6bd46f7ff4f87744c3abd`.
  The service directly imports `scanner.find_setups` and `exit.compute`.
* `upstream/tradingagents`: Apache 2.0, Tauric Research,
  pinned at `9fa1196fffbcfd9de5146d2dd2869df84ab99838`.
  Optional runner calls `TradingAgentsGraph.propagate` with market, news, and
  fundamentals analysts and bounded debate/tool rounds.

Run `git submodule update --init --recursive` after checkout. Retain upstream
licenses and any NOTICE files when distributing images. These repositories are
application dependencies, not agent instructions installed into this workspace.

## Local execution

Create a Python 3.11 virtual environment and install `requirements.txt` (or
`requirements-dev.txt` for tests). For AI,
also install `./upstream/tradingagents` in that environment and configure its
provider credentials and models through `TRADINGAGENTS_*` variables. The upstream
dependency tree is pinned by source revision but transitive packages still need
a resolved lockfile before a reproducible AI production release.

Set `RESEARCH_API_KEY` to a random secret of at least 32 characters and
`RESEARCH_DB` to a writable SQLite file. Run:

```
uvicorn main:app --host 127.0.0.1 --port 8010 --workers 1
python -m unittest test_research -v
```

On Node replicas set the same `RESEARCH_API_KEY` and
`RESEARCH_SERVICE_URL=http://research-engine:8010`. Authenticated ADMIN,
SUPER_ADMIN, and ANALYST users can access:

* `POST /api/v1/admin/research/jobs`, with `Idempotency-Key` header.
* `GET /api/v1/admin/research/jobs/:id`.
* `GET /api/v1/admin/research/health`.

No secret is sent to the browser. Queue admission is transactional and capped at
20 jobs; identical retries return the original ID and changed payloads return
409. One worker processes jobs sequentially. AI runs in a separate subprocess
with a 600-second timeout. Interrupted AI requests fail after 660 seconds rather
than automatically repeating potentially billable calls.

## Snapshot contract

The input schema is in `models.py` and a complete fixture is in
`test_research.py`. Prices are decimal strings. Required fields:
`symbol`, exact canonical `token`, `source: dhan`, `asset_type: stock|option`,
timezone-aware `as_of`, `last_price`, exchange `tick_size`, current `lot_size`,
INR `risk_budget`, and at least 30 completed OHLCV bars in ascending order.
Options additionally require exact `expires_at` and `underlying`.

Use premium bars and premium quotes for an option request. The service does not
derive option entry prices from underlying spot or invent option premiums.
The trusted snapshot producer must resolve instrument metadata from the master,
verify bars/quotes belong to the exact token and interval, enforce exchange
holiday/session rules, and validate current spreads/circuits. A `source` string
alone cannot establish provenance; direct submissions are restricted to staff.

For `include_ai: true`, explicitly set a provider-compatible `research_ticker`,
such as `RELIANCE.NS`. AI output concerns the underlying company and uses the
upstream configured vendors (Yahoo by default), not the Dhan premium feed.
US SEC and Congress tools are included upstream but are not wired into Indian
research. Upstream broker execution tools are not invoked.

## Scheduled generation

`scheduled_batch.py` fetches a server-configured `RESEARCH_SNAPSHOT_URL` with
`RESEARCH_SNAPSHOT_TOKEN`. The producer must respond with
`{"market_open": true, "snapshots": [...]}` using fresh Dhan data and authoritative
exchange holidays. It is not an existing TradeGrow endpoint yet.
Run this command from an external cron every five minutes, in the same container
environment and volume as the service:

```
docker compose -f /opt/tradegrow/docker-compose.production.yml exec -T research-engine python scheduled_batch.py
```

The script gates weekdays and 09:15–15:25 IST; `market_open` supplies actual
holiday/session authority. It uses stable token/timestamp idempotency keys.
Snapshot freshness is checked again by the worker, so queued stale jobs fail.

## Production work still required

The admin panel now includes a Research Desk under Daily Operations with snapshot
import, risk settings, optional AI research, persistent job history, report viewing,
expiry warnings and JSON export. It uses the private service through the Node API;
ADMIN, SUPER_ADMIN and ANALYST roles can access the backend. The service must be
deployed/configured for this dashboard to generate reports.

Before enabling scheduled production use:

1. Implement the trusted Dhan snapshot producer and its instrument allowlist,
   exchange calendar, feed freshness, bid/ask/circuit checks and rate budget.
2. Add reviewer approval/history and distribution into the advisory CRM. The
   dashboard displays drafts; no automatic WhatsApp publishing is configured.
3. Configure provider credentials, validate Indian ticker/news coverage and
   benchmark research against historical sessions without lookahead bias.
4. Install the compose service on the actual VPS, add monitoring/backups and
   report retention, and resolve/lock optional AI dependencies.
5. Validate costs, AI timeout/crash behavior and feed end-to-end tests in staging.

The first strategy supports conditional long breakout entries with 2R targets;
short options, spreads, OI analytics, portfolio exposure, and probability claims
are not implemented. Price levels expire after five minutes (or contract expiry),
and AI may finish after that validity window. Consumers must honor `valid_until`.
No predictive accuracy or complete production readiness has been established.
