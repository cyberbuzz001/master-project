# Prompt — Market-Data Load & Integration Test Suite (Phases 19–20)

> Paste into a fresh Claude Code session opened at `D:\2026 C downloads\Stocksharp`.
> Branch: `fix/centralized-market-data-pipeline`

---

## ROLE

Act as a Performance Engineer and SDET for a production brokerage platform. Build a load and integration test suite that proves — or disproves — that the centralized market-data pipeline holds up as user count grows.

Your job is to **find the breaking point**, not to produce a green report. A suite that passes everything on the first run has almost certainly failed to exercise the system. Report real numbers, including bad ones.

---

## HARD CONSTRAINTS — READ FIRST

1. **Never run load tests against production.** `200.234.34.4` / `tradegrowx.in` is a live trading platform that is already OOM-crashing. All tests run against a locally started server or in-process.
2. **Never drive load through the real Dhan API or a real Dhan WebSocket.** Hammering the provider risks rate-limiting or banning the broker account. Inject ticks synthetically (see "Tick injection" below).
3. **Synthetic ticks are for the test harness only.** Do not add fabricated-data fallbacks back into `server/src/marketData/*`. A previous audit removed random-walk price generators from `DhanAdapter`, `FyersAdapter`, and `AngelOneAdapter` — reintroducing that pattern into production code is a regression, not a fixture.
4. **Do not weaken assertions to make tests pass.** If an invariant fails, that is the finding. Report it with the measurement.
5. **Do not report numbers you did not measure.** No estimated, extrapolated, or illustrative figures. If a metric could not be captured, say so explicitly.

---

## SYSTEM UNDER TEST

### Architecture
```
Dhan WebSocket ──► DhanAdapter (1 connection, 1 registered callback)
                        │
                   MarketDataEngine ──► ref-counted tokens, timestamp-ordered cache
                        │
                   Redis pub/sub (exactly-once delivery)
                        │
                   App WebSocket ──► O(1) token index ──► User 1..N
```

### Key files
| Path | Role |
|---|---|
| `server/src/marketData/MarketDataEngine.ts` | Singleton. `subscribe()`, `unsubscribe()`, `setCachedTick()`, `getCachedTick()`, `getFeedHealth()`, `getPipelineMetrics()` |
| `server/src/marketData/DhanAdapter.ts` | `registerCallback()`, `subscribeToTokens()`, `unsubscribeFromTokens()`, `isConnected()` |
| `server/src/marketData/OptionChainBroadcasterService.ts` | `addView()`, `removeView()`, `getMetrics()`, `getLastSnapshot()`, exported `chainKey()` |
| `server/src/websocket/server.ts` | `setupWebSocketServer()`, `getWebSocketMetrics()`, `getConnectedClientCount()` |
| `server/src/db/redis.ts` | `publish()`, `subscribe()`, `isAvailable()`, in-memory fallback |
| `server/src/marketData/MockMarketDataProvider.ts` | Existing mock provider — reuse for simulation |

### WebSocket protocol (path `/ws`, optional `?token=<jwt>`)

Client → server:
```json
{"action":"SUBSCRIBE","tokens":["NSE_NIFTY50"]}
{"action":"UNSUBSCRIBE","tokens":["NSE_NIFTY50"]}
{"action":"SUBSCRIBE_OPTION_CHAIN","symbol":"NIFTY","expiry":"2026-08-27","strikeRange":"10"}
{"action":"UNSUBSCRIBE_OPTION_CHAIN","symbol":"NIFTY","expiry":"2026-08-27","strikeRange":"10"}
{"action":"PING"}
```

Server → client:
`TICK_SNAPSHOT` · `MARKET_TICK` · `MARKET_STATUS` · `OPTION_CHAIN_SNAPSHOT` · `OPTION_CHAIN_SUBSCRIBED` · `OPTION_CHAIN_ERROR` · `PONG` · `ERROR`

### Existing limits (verify these are enforced under load)
| Limit | Value | Location |
|---|---|---|
| Message size | 64 KB | `MAX_WS_MESSAGE_BYTES` |
| Message rate | 40/s per connection | `MAX_WS_MESSAGES_PER_SEC` |
| Token subs | 1000 per connection | `MAX_SUBS` |
| Chain views | 8 per connection | `MAX_CHAIN_VIEWS_PER_SOCKET` |
| Chain views | 40 server-wide | `MAX_ACTIVE_VIEWS` |
| Backpressure | drop frame above 512 KB `bufferedAmount` | `totalDroppedFrames` |

### Metrics source
`GET /api/v1/health/pipeline` returns `.feed`, `.pipeline`, `.optionChain`, `.websocket`, `.process`.

Fields that matter: `providerConnections`, `upstreamSubscribedTokens`, `refCountedTokens`, `tickCacheEntries`, `globalCallbacks`, `ticksPerSecond`, `staleTicksRejected`, `activeViewCount`, `totalSubscribers`, `totalDroppedFrames`, `heapUsedMB`, `memoryRssMB`.

### Tick injection
Drive ticks via `MarketDataEngine.getInstance().setCachedTick(tick)` plus the registered callback path, or by registering a fake provider callback — **not** by calling the real Dhan adapter. Every synthetic tick must carry a realistic monotonic `timestamp` so stale-tick logic is genuinely exercised.

---

## TASK 1 — Correctness suite

Create `tests/market_data_integration.test.ts`.

**Market data**
- tick received end-to-end (injected → engine → cache)
- tick normalized (all `MarketTick` fields present and correctly typed)
- token mapped (symbology aliases resolve; `getCachedTick()` hits by token, symbol, and alias)
- cache updated (`getCachedTick` reflects the newest write)
- **stale tick rejected** — older `timestamp` must not overwrite; assert `staleTicksRejected` increments
- **duplicate tick handled** — identical timestamp+payload twice must not corrupt state or double-count
- provider reconnect — after a simulated drop, subscriptions are re-sent upstream and ticks resume
- subscription recovery — after client reconnect, both token and option-chain subscriptions are restored

**Option chain**
- NIFTY and SENSEX chains build
- expiry selection changes the view key and the returned rows
- strike selection / `strikeRange` of `5`, `10`, `20`, `ALL` produce different row counts
- CE and PE legs both present with distinct `instrumentToken`s
- LTP, bid/ask, OI, volume each update independently when the underlying tick changes
- timestamp handling — a snapshot never regresses in time
- **negative case:** a snapshot for view key A must never be applied to a client watching view key B

**WebSocket**
- connect, disconnect, reconnect
- multiple users receive the same tick from one injection
- duplicate subscriptions from one socket do not inflate ref-counts
- subscription cleanup — after all clients disconnect, `refCountedTokens` and `activeViewCount` return to 0

---

## TASK 2 — Load suite

Create `tests/load/market_data_load.test.ts` (or a standalone harness under `tests/load/` if Jest timeouts get in the way — your call, justify it).

Start a real HTTP + WebSocket server on an ephemeral port. Connect **real `ws` clients**.

### Scenarios
| # | Clients | Behaviour |
|---|---|---|
| A | 10 | each subscribes to 5 index tokens + 1 chain view |
| B | 50 | mixed tokens, 3 distinct chain views shared across clients |
| C | 100 | sustained ticks for ≥ 60s |
| D | 500 | simultaneous option-chain subscriptions across ≤ 10 distinct views |

For each: ramp up, hold under load, disconnect all, then assert teardown is clean.

### Also simulate
- **high tick frequency** — sweep 100 / 1,000 / 5,000 ticks per second
- **multiple instruments** — ≥ 500 distinct tokens including NFO/BFO option contracts
- **multiple expiries** — ≥ 3 concurrent
- **rapid price changes** — LTP moving every tick
- **WebSocket reconnects** — randomly kill and reconnect 10% of clients mid-run
- **provider disconnect** — drop the upstream feed, assert `MARKET_STATUS` flips to `STALE`/`DISCONNECTED`, then recovers to `LIVE`
- **Redis latency** — wrap the client to inject 5 ms / 50 ms / 250 ms delays; also run with Redis fully unavailable to exercise the in-memory fallback
- **database latency** — inject delay into the query path; assert tick delivery is unaffected (ticks must never block on the DB)

---

## TASK 3 — Measure

Report per scenario, with **p50 / p95 / p99 and max** where it is a latency:

- tick ingestion latency (injection → engine receipt)
- tick processing latency (engine receipt → cache updated)
- cache update latency
- WebSocket delivery latency (broadcast → client `onmessage`)
- CPU (sample `process.cpuUsage()` deltas)
- RAM (`heapUsed` and `rss`, sampled every 5s for the whole run)
- network (bytes sent; derive bytes-per-tick-per-client)
- dropped frames (`totalDroppedFrames`)

**Frontend rendering latency** cannot be measured from a Node harness. Either measure it properly in a browser (Playwright + `performance.mark`, using the in-app browser tools) or state clearly that it was not measured. Do not estimate it.

---

## TASK 4 — Acceptance criteria

These are the invariants the architecture claims. Test each explicitly and report pass/fail.

| # | Invariant | Assertion |
|---|---|---|
| 1 | One provider connection | `providerConnections === 1` at every user count, including 500 |
| 2 | Upstream subs scale with instruments, not users | `upstreamSubscribedTokens` ≈ distinct instruments; must **not** scale with client count |
| 3 | Chain computations scale with views, not users | `activeViewCount` ≤ distinct `(symbol,expiry,range)` combos; 500 clients on 10 views ⇒ `activeViewCount === 10` |
| 4 | No callback accumulation | `globalCallbacks` constant across connect/disconnect churn |
| 5 | Clean teardown | after all disconnect: `refCountedTokens === 0`, `activeViewCount === 0`, `connectedClients === 0` |
| 6 | No unbounded memory | after warm-up, `rss` growth < 10% over a sustained 10-minute run at 1,000 ticks/s |
| 7 | Exactly-once delivery | N injected ticks ⇒ each subscribed client receives exactly N (allowing for documented backpressure drops — report those separately) |
| 8 | Stale rejection under load | out-of-order ticks never produce a backwards LTP at any client |
| 9 | Limits enforced | rate limit, message size, per-socket and server-wide view caps all reject correctly under load |

**Invariant 1 is the headline.** If `providerConnections` exceeds 1 at any user count, stop and report immediately — the core architectural claim is false.

---

## TASK 5 — Bottlenecks

For each bottleneck found:

```
Symptom (with the measurement)
↓
Root cause (with file:line)
↓
Fix
↓
Re-measured result (before → after)
↓
Regression risk
```

Fix what you find, but keep changes targeted. Do not refactor working modules to make benchmarking more convenient.

---

## DELIVERABLES

1. `tests/market_data_integration.test.ts` — correctness suite
2. `tests/load/` — load harness + scenarios
3. `tests/load/README.md` — how to run it, what each scenario does, how to read the output
4. A results report containing:
   - measured table per scenario (10 / 50 / 100 / 500)
   - the 9 acceptance criteria with pass/fail and the number behind each
   - bottlenecks found and fixed, before → after
   - **what you could not measure and why**
   - a scaling estimate: at what user count does this architecture stop holding, and which resource runs out first

## VERIFY BEFORE REPORTING

```bash
npx jest --runInBand --forceExit
```

```bash
npx tsc -p server/tsconfig.json --noEmit
```

Existing baseline is **14 suites / 101 tests passing** — do not regress it.

Finally: state plainly whether the system is ready for production traffic, and at what concurrent-user ceiling. If the honest answer is "not yet" or "unknown beyond N users", say that.
