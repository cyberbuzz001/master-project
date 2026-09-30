import { OptionChainEngine } from './OptionChainEngine';
import { EventEmitter } from 'events';

export interface OptionChainSnapshot {
  underlying: string;
  exchange: string;
  spotPrice: number;
  futuresPrice: number;
  atmStrike: number;
  expiry: string;
  lotSize: number;
  spotSource?: string;
  pcrRatio?: number;
  maxPainStrike?: number;
  chain: any[];
  timestamp: number;
  /** Echoes the subscription parameters so clients can discard snapshots for a view they left. */
  subscriptionKey: string;
  strikeRange: string;
}

export interface ChainSubscription {
  symbol: string;
  expiry: string;   // '' means "server picks nearest expiry"
  strikeRange: string;
}

/**
 * Builds the canonical key identifying one distinct option-chain view.
 * Every client watching the same (symbol, expiry, strikeRange) shares a single
 * server-side computation — this is the fan-out point that keeps provider load
 * flat as user count grows.
 */
export function chainKey(sub: ChainSubscription): string {
  return `${sub.symbol.toUpperCase().trim()}|${(sub.expiry || '').trim()}|${sub.strikeRange || '10'}`;
}

export function parseChainKey(key: string): ChainSubscription {
  const [symbol, expiry, strikeRange] = key.split('|');
  return { symbol, expiry: expiry || '', strikeRange: strikeRange || '10' };
}

export class OptionChainBroadcasterService extends EventEmitter {
  private static instance: OptionChainBroadcasterService;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isBroadcasting: boolean = false;
  private intervalMs: number = 4000;

  /** Subscriber count per distinct view key. A view is computed only while watched. */
  private viewRefCount: Map<string, number> = new Map();
  /** Last emitted snapshot per view key, served immediately to new subscribers (Phase 14). */
  private lastSnapshot: Map<string, OptionChainSnapshot> = new Map();
  /** Consecutive failure count per view, used to back off hopeless views. */
  private failureCount: Map<string, number> = new Map();

  private static readonly MAX_ACTIVE_VIEWS = 40;
  private static readonly MAX_CONSECUTIVE_FAILURES = 10;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): OptionChainBroadcasterService {
    if (!OptionChainBroadcasterService.instance) {
      OptionChainBroadcasterService.instance = new OptionChainBroadcasterService();
    }
    return OptionChainBroadcasterService.instance;
  }

  public getLastSnapshot(key: string): OptionChainSnapshot | undefined {
    return this.lastSnapshot.get(key);
  }

  /**
   * Registers one subscriber for a view. Returns the view key.
   * Returns null when the server is already computing its maximum number of distinct
   * views — this caps worst-case CPU regardless of how many odd parameter
   * combinations clients request.
   */
  public addView(sub: ChainSubscription): string | null {
    const key = chainKey(sub);
    const existing = this.viewRefCount.get(key);

    if (existing === undefined && this.viewRefCount.size >= OptionChainBroadcasterService.MAX_ACTIVE_VIEWS) {
      console.warn(`[OptionChainBroadcaster] Refusing new view ${key} — at capacity (${OptionChainBroadcasterService.MAX_ACTIVE_VIEWS}).`);
      return null;
    }

    this.viewRefCount.set(key, (existing ?? 0) + 1);
    this.startTimer();
    return key;
  }

  /**
   * Releases one subscriber's hold. When the last watcher of a view leaves, that view
   * stops being recomputed entirely and its cached snapshot is dropped.
   */
  public removeView(key: string): void {
    if (!key) return;
    const refs = (this.viewRefCount.get(key) ?? 1) - 1;
    if (refs <= 0) {
      this.viewRefCount.delete(key);
      this.lastSnapshot.delete(key);
      this.failureCount.delete(key);
    } else {
      this.viewRefCount.set(key, refs);
    }

    if (this.viewRefCount.size === 0) {
      this.stopTimer();
    }
  }

  public getMetrics(): {
    totalSubscribers: number;
    activeViewCount: number;
    activeViews: string[];
    cachedSnapshots: number;
    running: boolean;
    intervalMs: number;
  } {
    let totalSubscribers = 0;
    this.viewRefCount.forEach(c => { totalSubscribers += c; });
    return {
      totalSubscribers,
      activeViewCount: this.viewRefCount.size,
      activeViews: Array.from(this.viewRefCount.keys()),
      cachedSnapshots: this.lastSnapshot.size,
      running: this.isRunning,
      intervalMs: this.intervalMs
    };
  }

  public start(intervalMs: number = 4000): void {
    this.intervalMs = intervalMs;
    console.log(`[OptionChainBroadcaster] 🚀 Ready (interval ${intervalMs}ms, lazy-start, per-view fan-out).`);
  }

  private startTimer(): void {
    if (this.isRunning || this.intervalTimer) return;
    this.isRunning = true;
    console.log('[OptionChainBroadcaster] Starting broadcast timer (first subscriber connected).');
    this.intervalTimer = setInterval(() => {
      void this.broadcastActiveChains();
    }, this.intervalMs);
    this.intervalTimer.unref?.();
    // Prime the first snapshot quickly so the initial view is not blank for 4s.
    setTimeout(() => void this.broadcastActiveChains(), 300);
  }

  private stopTimer(): void {
    if (!this.isRunning) return;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('[OptionChainBroadcaster] Broadcast timer stopped (no active subscribers).');
  }

  public stop(): void {
    this.viewRefCount.clear();
    this.lastSnapshot.clear();
    this.failureCount.clear();
    this.stopTimer();
    console.log('[OptionChainBroadcaster] Stopped option chain broadcaster.');
  }

  /**
   * Computes every actively-watched view once per cycle and emits a snapshot per view.
   * Views are computed sequentially on purpose: option chain generation is CPU-heavy and
   * running them concurrently starved the event loop, which is what produced the 504s.
   */
  private async broadcastActiveChains(): Promise<void> {
    if (this.isBroadcasting) return; // Prevent overlapping runs
    this.isBroadcasting = true;

    try {
      for (const key of Array.from(this.viewRefCount.keys())) {
        const sub = parseChainKey(key);
        try {
          const chainData = await OptionChainEngine.generateOptionChain({
            symbol: sub.symbol,
            expiry: sub.expiry || undefined,
            strikeRange: sub.strikeRange
          } as any);

          const snapshot: OptionChainSnapshot = {
            ...chainData,
            subscriptionKey: key,
            strikeRange: sub.strikeRange,
            timestamp: Date.now()
          };

          this.failureCount.delete(key);
          this.lastSnapshot.set(key, snapshot);
          this.emit('snapshot', snapshot);
        } catch (err: any) {
          // A single bad symbol/expiry must never stop the other views (Phase 15).
          const fails = (this.failureCount.get(key) ?? 0) + 1;
          this.failureCount.set(key, fails);
          if (fails === 1 || fails % 20 === 0) {
            console.warn(`[OptionChainBroadcaster] View ${key} failed (${fails}x): ${err?.message}`);
          }
          if (fails >= OptionChainBroadcasterService.MAX_CONSECUTIVE_FAILURES) {
            // Stop burning CPU on a view that consistently cannot be built.
            console.warn(`[OptionChainBroadcaster] Dropping view ${key} after ${fails} consecutive failures.`);
            this.viewRefCount.delete(key);
            this.failureCount.delete(key);
            this.lastSnapshot.delete(key);
            this.emit('view_failed', { key, error: err?.message ?? 'unknown' });
          }
        }

        // Yield to the event loop between views so API requests stay responsive.
        await new Promise(resolve => setImmediate(resolve));
      }

      if (this.viewRefCount.size === 0) this.stopTimer();
    } finally {
      this.isBroadcasting = false;
    }
  }
}

export const optionChainBroadcaster = OptionChainBroadcasterService.getInstance();
