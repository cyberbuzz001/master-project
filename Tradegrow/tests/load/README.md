# Trade Grow Market Data Load & Integration Test Suite (Phases 19–20)

This directory contains the automated performance benchmarking and stress testing harness for the **Trade Grow Centralized Market Data Pipeline**.

---

## 🎯 Purpose & Scope

The load suite validates that the market data architecture scales with user concurrency without degrading tick ingestion latency, accumulating memory leaks, or spawning redundant upstream provider connections.

### Invariants Enforced Under Load
1. **Single Provider Connection**: `providerConnections === 1` at all concurrency levels (including 500+ clients).
2. **Upstream Token Subscription Isolation**: Upstream subscriptions scale with distinct market instruments, never per connected user.
3. **Option Chain View Deduping & Fan-Out**: N clients watching the same `(symbol, expiry, strikeRange)` view trigger exactly **one** server computation cycle.
4. **Zero Dangling Callbacks**: Callback registry size remains bounded across connect/disconnect churn.
5. **Clean Teardown**: Sockets disconnecting gracefully reset active views and ref-counts to zero.
6. **Bounded Memory**: Process RSS and JavaScript Heap remain flat under sustained 1,000+ ticks/s throughput.
7. **Sub-15ms p99 WebSocket Delivery**: Fan-out dispatch using the $O(1)$ inverted token index delivers ticks in $\le 12\text{ms}$ at 99th percentile for 500 clients.

---

## 🚀 Running the Tests

### 1. Correctness Integration Suite (Jest)
Runs end-to-end unit and integration assertions against ingestion, normalization, symbology resolution, stale tick rejection, and option chain matrix generation:
```bash
npx jest tests/market_data_integration.test.ts --runInBand --forceExit
```

### 2. Jest Load & Stress Scenarios
Executes automated scenario assertions for Scenarios A, B, and C with pass/fail gates:
```bash
npx jest tests/load/market_data_load.test.ts --runInBand --forceExit
```

### 3. Full Standalone High-Concurrency Benchmark (500 Clients)
Runs the standalone harness with high-resolution timing, CPU profiling, RSS memory sampling, and outputs an empirical ASCII summary table:
```bash
npx ts-node --transpile-only tests/load/run_load_suite.ts
```

---

## 📋 Scenarios Breakdown

| Scenario | Clients | Target Tick Rate | Distinct Instruments | Option Chain Views | Focus Area |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario A** | 10 | 100 ticks/sec | 50 tokens | 1 shared view | Baseline latency & subscription sanity |
| **Scenario B** | 50 | 300 ticks/sec | 150 tokens | 3 shared views | Multi-view fan-out & cache isolation |
| **Scenario C** | 100 | 1,000 ticks/sec | 300 tokens | 3 shared views | Sustained high throughput + 10% connection churn |
| **Scenario D** | 500 | 1,000 ticks/sec | 500+ tokens | 10 distinct views | Concurrency ceiling, libuv thread pool & memory bounds |

---

## 📊 How to Interpret Metrics Output

* **`p50 / p95 / p99 Latency (ms)`**: Milliseconds elapsed between tick synthetic creation and client socket `onmessage` delivery. Sub-15ms p99 indicates excellent real-time responsiveness.
* **`RSS Growth %`**: Percentage change in Resident Set Size across the duration of the load test. Must remain below 25% under heavy stress.
* **`Active Views`**: Number of active option chain computations running. Must strictly equal the number of distinct view tuples requested.
* **`Provider Conns`**: Must strictly equal `1` for Dhan.
* **`Clean Teardown`**: Verified as `PASS` when `activeViewCount === 0`, `totalSubscribers === 0`, and `connectedClients === 0` after all sockets close.
