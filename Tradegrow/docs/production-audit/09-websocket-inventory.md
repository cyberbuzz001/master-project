# 09 — WebSocket Inventory

## WebSocket Server

| Setting | Value |
|---------|-------|
| Library | ws 8.18.0 |
| Endpoint | /ws |
| Transport | HTTP Upgrade (ws:// or wss://) |
| Auth | Optional JWT via ?token= query param |
| Heartbeat | 30s ping/pong, terminates dead connections |
| Max subscriptions | 1000 tokens per client |

## Connection Lifecycle

```
1. Client connects: ws://host:5000/ws?token=<JWT>
2. Server: ws.isAlive = true, ws.subscriptions = Set(defaultTokens)
3. Server sends: TICK_SNAPSHOT (all cached ticks immediately)
4. Client subscribes: {action: "SUBSCRIBE", tokens: ["NSE_NIFTY50", ...]}
5. Server adds tokens to ws.subscriptions
6. Server forwards tokens to MarketDataEngine.subscribe()
7. Ticks arrive → server filters by subscription → client.send()
8. Every 30s: server sends ping → client responds pong → ws.isAlive reset
9. If no pong: ws.terminate() (zombie cleanup)
10. Client disconnects: ws.subscriptions.clear()
```

## Message Formats

### Server to Client
```json
// Snapshot on connect
{ "type": "TICK_SNAPSHOT", "data": [MarketTick, ...] }

// Real-time tick
{
  "type": "MARKET_TICK",
  "data": {
    "instrumentToken": "NSE_NIFTY50",
    "symbol": "NIFTY 50",
    "exchange": "NSE",
    "ltp": 24563.50,
    "open": 24572.70,
    "high": 24677.60,
    "low": 24533.55,
    "close": 24614.90,
    "change": -51.40,
    "changePercent": -0.21,
    "volume": 1548000,
    "oi": 0,
    "bid": 24563.45,
    "ask": 24563.55,
    "timestamp": 1754812800000
  }
}

// Heartbeat response
{ "type": "PONG", "timestamp": 1754812800000 }
```

### Client to Server
```json
// Subscribe
{ "action": "SUBSCRIBE", "tokens": ["NSE_NIFTY50", "NSE_BANKNIFTY"] }

// Unsubscribe
{ "action": "UNSUBSCRIBE", "tokens": ["NSE_BANKNIFTY"] }

// Keepalive
{ "action": "PING" }
```

## Default Subscriptions

On connect, every client automatically subscribes to:
- NSE_NIFTY50
- NSE_BANKNIFTY
- NSE_RELIANCE
- NSE_TCS
- NSE_INFY
- NSE_HDFCBANK

## Frontend WebSocket Client (useMarketSocket.ts)

| Feature | Implementation |
|---------|---------------|
| Auto-reconnect | Yes — exponential backoff (1s → 30s, max 5 attempts) |
| Batch updates | Yes — requestAnimationFrame batching |
| Subscription tracking | Ref-counted Map (subscribe/unsubscribe) |
| Token aliases | NSE_X, BSE_X, NFO_X variations handled server-side |
| Ping/Pong | Every 30s via server heartbeat |
| Stale tick detection | useTickFreshness.ts (>10s threshold) |
| Reconnect on focus | On window focus regain |

## Token Alias Resolution (server-side)

The WebSocket server resolves token aliases so clients can subscribe with simple symbols:
```typescript
if (!token.startsWith('NSE_') && !token.startsWith('BSE_') ...) {
  ws.subscriptions.add(`NSE_${token}`);
  ws.subscriptions.add(`BSE_${token}`);
}
```

Also via SymbologyNormalizer:
- "NIFTY" → "NSE_NIFTY50", "NIFTY50"
- "SENSEX" → "BSE_SENSEX"
- "BANKNIFTY" → "NSE_BANKNIFTY"

## Python Engine WebSocket (/ws on port 8000)

Status: **STUB / UNUSED IN PRODUCTION**

The python_engine/main.py exposes a `/ws` WebSocket that only echoes messages back.
It is NOT integrated with the Node.js backend's WebSocket pipeline.

The Angel One WebSocket feed in python_engine uses angel_service.py which runs separately.
This is NOT called by the Node.js server — the Node.js AngelOneAdapter.ts handles its own WS connection.

## Production WebSocket Considerations

1. **SSL/TLS:** In production with HTTPS, use `wss://` (requires TLS termination at NGINX)
2. **Load Balancer:** WebSocket sessions are stateful — use sticky sessions if multi-instance
3. **Rate Limiting:** No WebSocket-level rate limiting (only HTTP REST has rate limits)
4. **Max Connections:** No hard limit set — defaults to OS socket limits
5. **Compression:** ws perMessageDeflate not explicitly configured
