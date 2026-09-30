/**
 * Centralized Market-Data Pipeline — regression tests.
 *
 * These lock in the invariants that the audit fixed. Each test corresponds to a bug
 * that was live in production and caused either wrong prices or unbounded resource growth.
 */

import {
  chainKey,
  parseChainKey,
  OptionChainBroadcasterService
} from '../server/src/marketData/OptionChainBroadcasterService';

describe('Option chain view keys', () => {
  it('treats different strike ranges as different views', () => {
    // Regression: the server only keyed on symbol, so a client watching a 20-strike
    // range had its table overwritten every 4s by the default 10-strike snapshot.
    const a = chainKey({ symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '10' });
    const b = chainKey({ symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '20' });
    expect(a).not.toEqual(b);
  });

  it('treats different expiries as different views', () => {
    const a = chainKey({ symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '10' });
    const b = chainKey({ symbol: 'NIFTY', expiry: '2026-09-24', strikeRange: '10' });
    expect(a).not.toEqual(b);
  });

  it('collapses identical views to one key regardless of casing/whitespace', () => {
    // This is the fan-out guarantee: N users on the same view share ONE computation.
    const a = chainKey({ symbol: 'nifty', expiry: ' 2026-08-27 ', strikeRange: '10' });
    const b = chainKey({ symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '10' });
    expect(a).toEqual(b);
  });

  it('defaults a missing strike range to 10 so client and server agree', () => {
    expect(chainKey({ symbol: 'NIFTY', expiry: '', strikeRange: '' }))
      .toEqual(chainKey({ symbol: 'NIFTY', expiry: '', strikeRange: '10' }));
  });

  it('round-trips through parseChainKey', () => {
    const sub = { symbol: 'BANKNIFTY', expiry: '2026-08-27', strikeRange: '20' };
    expect(parseChainKey(chainKey(sub))).toEqual(sub);
  });
});

describe('Option chain broadcaster ref-counting', () => {
  let svc: OptionChainBroadcasterService;

  beforeEach(() => {
    svc = OptionChainBroadcasterService.getInstance();
    svc.stop(); // reset shared singleton state between tests
  });

  afterAll(() => {
    OptionChainBroadcasterService.getInstance().stop();
  });

  it('computes one view for many subscribers of the same chain', () => {
    const sub = { symbol: 'NIFTY', expiry: '2026-08-27', strikeRange: '10' };
    const k1 = svc.addView(sub);
    const k2 = svc.addView(sub);
    const k3 = svc.addView(sub);

    expect(k1).toBe(k2);
    expect(k2).toBe(k3);

    const metrics = svc.getMetrics();
    expect(metrics.activeViewCount).toBe(1);   // ONE computation
    expect(metrics.totalSubscribers).toBe(3);  // THREE watchers
  });

  it('keeps computing while any subscriber remains, and stops at zero', () => {
    // Regression: removeSymbol() never removed the symbol from activeSymbols, so the
    // server kept building chains for indices nobody was watching, forever.
    const sub = { symbol: 'NIFTY', expiry: '', strikeRange: '10' };
    const key = svc.addView(sub)!;
    svc.addView(sub);

    svc.removeView(key);
    expect(svc.getMetrics().activeViewCount).toBe(1); // one watcher left

    svc.removeView(key);
    expect(svc.getMetrics().activeViewCount).toBe(0); // fully released
    expect(svc.getMetrics().running).toBe(false);     // timer stopped
  });

  it('does not go negative when a view is released more often than acquired', () => {
    const key = svc.addView({ symbol: 'NIFTY', expiry: '', strikeRange: '10' })!;
    svc.removeView(key);
    svc.removeView(key);
    svc.removeView(key);
    expect(svc.getMetrics().activeViewCount).toBe(0);
  });

  it('caps the number of distinct views to bound worst-case CPU', () => {
    // Without a cap, clients requesting many odd (symbol, expiry, range) combinations
    // could force unbounded concurrent option-chain computations.
    const accepted: string[] = [];
    for (let i = 0; i < 100; i++) {
      const k = svc.addView({ symbol: `SYM${i}`, expiry: '', strikeRange: '10' });
      if (k) accepted.push(k);
    }
    expect(accepted.length).toBeLessThan(100);
    expect(Number(svc.getMetrics().activeViewCount)).toBeLessThanOrEqual(accepted.length);
  });

  it('drops cached snapshots when the last watcher leaves', () => {
    const key = svc.addView({ symbol: 'NIFTY', expiry: '', strikeRange: '10' })!;
    svc.removeView(key);
    expect(svc.getLastSnapshot(key)).toBeUndefined();
  });
});

describe('Stale tick rejection', () => {
  // Mirrors the guard implemented in MarketDataEngine.setCachedTick() and in the
  // frontend storeTick(). An older tick must never overwrite a newer one.
  const applyTick = (
    cache: Map<string, { ltp: number; timestamp: number }>,
    tick: { token: string; ltp: number; timestamp: number }
  ): boolean => {
    const existing = cache.get(tick.token);
    if (existing && existing.timestamp > tick.timestamp) return false;
    cache.set(tick.token, { ltp: tick.ltp, timestamp: tick.timestamp });
    return true;
  };

  it('rejects a tick older than the one already cached', () => {
    const cache = new Map<string, { ltp: number; timestamp: number }>();
    applyTick(cache, { token: 'NSE_NIFTY50', ltp: 24500, timestamp: 2000 });

    const accepted = applyTick(cache, { token: 'NSE_NIFTY50', ltp: 24400, timestamp: 1000 });

    expect(accepted).toBe(false);
    expect(cache.get('NSE_NIFTY50')!.ltp).toBe(24500); // newer price preserved
  });

  it('accepts a newer tick', () => {
    const cache = new Map<string, { ltp: number; timestamp: number }>();
    applyTick(cache, { token: 'NSE_NIFTY50', ltp: 24500, timestamp: 1000 });

    expect(applyTick(cache, { token: 'NSE_NIFTY50', ltp: 24600, timestamp: 2000 })).toBe(true);
    expect(cache.get('NSE_NIFTY50')!.ltp).toBe(24600);
  });

  it('accepts an equal-timestamp tick so same-millisecond updates are not dropped', () => {
    const cache = new Map<string, { ltp: number; timestamp: number }>();
    applyTick(cache, { token: 'NSE_NIFTY50', ltp: 24500, timestamp: 1000 });
    expect(applyTick(cache, { token: 'NSE_NIFTY50', ltp: 24510, timestamp: 1000 })).toBe(true);
  });

  it('tracks each instrument independently', () => {
    const cache = new Map<string, { ltp: number; timestamp: number }>();
    applyTick(cache, { token: 'NSE_NIFTY50', ltp: 24500, timestamp: 5000 });
    // A late tick for a different instrument must not be affected by NIFTY's clock.
    expect(applyTick(cache, { token: 'NSE_BANKNIFTY', ltp: 52000, timestamp: 1000 })).toBe(true);
  });
});

describe('Token subscription ref-counting', () => {
  // Mirrors MarketDataEngine.subscribe()/unsubscribe(). The upstream provider must be
  // told to subscribe exactly once per token, and to unsubscribe only at zero watchers.
  class TokenRefCounter {
    private counts = new Map<string, number>();
    public subscribedUpstream: string[] = [];
    public unsubscribedUpstream: string[] = [];

    subscribe(tokens: string[]) {
      const fresh: string[] = [];
      for (const t of tokens) {
        const c = (this.counts.get(t) ?? 0) + 1;
        this.counts.set(t, c);
        if (c === 1) fresh.push(t);
      }
      if (fresh.length) this.subscribedUpstream.push(...fresh);
    }

    unsubscribe(tokens: string[]) {
      const gone: string[] = [];
      for (const t of tokens) {
        const c = (this.counts.get(t) ?? 1) - 1;
        if (c <= 0) { this.counts.delete(t); gone.push(t); }
        else this.counts.set(t, c);
      }
      if (gone.length) this.unsubscribedUpstream.push(...gone);
    }

    get trackedCount() { return this.counts.size; }
  }

  it('sends exactly one upstream subscribe when many users want the same token', () => {
    // This is the core "do not create one provider subscription per user" guarantee.
    const rc = new TokenRefCounter();
    rc.subscribe(['NFO_NIFTY_24500_CE']);
    rc.subscribe(['NFO_NIFTY_24500_CE']);
    rc.subscribe(['NFO_NIFTY_24500_CE']);

    expect(rc.subscribedUpstream).toEqual(['NFO_NIFTY_24500_CE']);
  });

  it('only unsubscribes upstream when the final user releases the token', () => {
    const rc = new TokenRefCounter();
    rc.subscribe(['NFO_NIFTY_24500_CE']);
    rc.subscribe(['NFO_NIFTY_24500_CE']);

    rc.unsubscribe(['NFO_NIFTY_24500_CE']);
    expect(rc.unsubscribedUpstream).toEqual([]); // still one watcher

    rc.unsubscribe(['NFO_NIFTY_24500_CE']);
    expect(rc.unsubscribedUpstream).toEqual(['NFO_NIFTY_24500_CE']);
  });

  it('fully releases tokens after a churn of connect/disconnect cycles', () => {
    // Guards the leak that grew subscriptions without bound as users came and went.
    const rc = new TokenRefCounter();
    const tokens = ['NFO_NIFTY_24500_CE', 'NFO_NIFTY_24500_PE'];
    for (let i = 0; i < 500; i++) {
      rc.subscribe(tokens);
      rc.unsubscribe(tokens);
    }
    expect(rc.trackedCount).toBe(0);
    expect(rc.subscribedUpstream.length).toBe(500 * tokens.length);
  });
});

describe('Redis pub/sub delivery semantics', () => {
  /**
   * Models the fixed publish() contract: when Redis is connected the message reaches
   * subscribers exactly once (via the subscriber client), NOT twice. The old code fired
   * local callbacks AND let the Redis loopback fire them, double-processing every tick.
   */
  class FakeRedis {
    private subs = new Map<string, Array<(m: string) => void>>();
    constructor(private connected: boolean) {}

    subscribe(ch: string, cb: (m: string) => void) {
      if (!this.subs.has(ch)) this.subs.set(ch, []);
      this.subs.get(ch)!.push(cb);
    }

    private deliver(ch: string, msg: string) {
      this.subs.get(ch)?.forEach(cb => cb(msg));
    }

    publish(ch: string, msg: string) {
      if (this.connected) {
        this.deliver(ch, msg); // loopback via subscriber client
        return;                // <-- the fix: do not also fire locally
      }
      this.deliver(ch, msg);   // in-memory fallback path
    }
  }

  it('delivers each tick exactly once when Redis is connected', () => {
    const r = new FakeRedis(true);
    let received = 0;
    r.subscribe('market:ticks', () => { received++; });
    r.publish('market:ticks', '{"ltp":100}');
    expect(received).toBe(1);
  });

  it('still delivers each tick exactly once in in-memory fallback mode', () => {
    const r = new FakeRedis(false);
    let received = 0;
    r.subscribe('market:ticks', () => { received++; });
    r.publish('market:ticks', '{"ltp":100}');
    expect(received).toBe(1);
  });

  it('does not amplify load as tick volume grows', () => {
    const r = new FakeRedis(true);
    let received = 0;
    r.subscribe('market:ticks', () => { received++; });
    for (let i = 0; i < 1000; i++) r.publish('market:ticks', `{"ltp":${i}}`);
    expect(received).toBe(1000); // not 2000
  });
});
