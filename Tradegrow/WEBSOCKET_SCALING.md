# WEBSOCKET_SCALING.md — Real-Time WebSocket Gateway Clustering & Fan-Out

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Distributed Systems Architect  
**Status**: Production Specification (Version 1.0)

---

## 1. WebSocket Gateway Architecture

In high-frequency trading platforms, WebSocket delivery is latency-critical. Trade Grow decouples WebSocket connection handling from REST APIs using dedicated **WebSocket Gateway Instances** synchronized via Redis Pub/Sub:

```
                            CONNECTED TRADING CLIENTS
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │         NGINX LOAD BALANCER       │
                     │  - Path: /ws                      │
                     │  - Least-Connection Distribution  │
                     │  - Upgrade: WebSocket             │
                     └─────────────────┬─────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
[ WS GATEWAY NODE 1 ]                                         [ WS GATEWAY NODE 2 ]
  ├── 1,000 Client Connections                                  ├── 1,000 Client Connections
  ├── Token Routing Table (`Map<token, Set<ws>>`)               ├── Token Routing Table (`Map<token, Set<ws>>`)
  └── Slow-Client Buffer Guard (<512KB)                         └── Slow-Client Buffer Guard (<512KB)
        ▲                                                             ▲
        └──────────────────────────────┬──────────────────────────────┘
                                       │ Redis Pub/Sub Channel (`market:ticks`)
                                       ▼
                            [ CENTRAL MARKET DATA ENGINE ]
                              ├── Dhan API v2 WebSocket
                              └── Angel One SmartAPI Feed
```

---

## 2. Token-Indexed Routing Table ($O(1)$ Fan-Out)

Instead of looping through all connected clients on every market tick ($O(N)$), each WebSocket Gateway maintains an inverted index of token subscriptions:

```typescript
// Fast O(1) subscriber lookup structure
class TokenSubscriptionIndex {
  private tokenSubscribers = new Map<string, Set<ExtendedWebSocket>>();

  public subscribe(token: string, ws: ExtendedWebSocket): void {
    if (!this.tokenSubscribers.has(token)) {
      this.tokenSubscribers.set(token, new Set());
    }
    this.tokenSubscribers.get(token)!.add(ws);
  }

  public unsubscribe(token: string, ws: ExtendedWebSocket): void {
    const subs = this.tokenSubscribers.get(token);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) this.tokenSubscribers.delete(token);
    }
  }

  public getSubscribers(token: string): Set<ExtendedWebSocket> | undefined {
    return this.tokenSubscribers.get(token);
  }
}
```

---

## 3. Backpressure Management & Slow-Client Protection

During high-volatility market events (e.g., 500 ticks/sec on NIFTY), slow clients on high-latency mobile networks can experience client buffer accumulation.

### 3.1 Watermark Drop Strategy (Latest-Value Guarantee)
* **Threshold**: If `client.bufferedAmount > 512 * 1024` (512 KB), intermediate ticks for that client are dropped.
* **Latest-Value Delivery**: As soon as the buffer drains below 128 KB, the latest tick snapshot is delivered immediately.
* **Invariant**: Financial notifications (e.g. Order Filled, Margin Blocked) are **NEVER** dropped regardless of buffer state.

---

## 4. Connection Lifecycle & Health Monitoring

* **Heartbeat Interval**: 30 seconds.
* **Pong Timeout**: 10 seconds. Unresponsive sockets are forcefully closed (`ws.terminate()`).
* **Max Subscriptions**: 1,000 active tokens per user (protects server memory against unbounded subscription payload attacks).
* **Metrics Tracked**:
  - `ws_active_connections`
  - `ws_messages_sent_per_sec`
  - `ws_dropped_frames_slow_client`
  - `ws_broadcast_latency_ms`
