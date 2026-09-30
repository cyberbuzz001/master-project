import Redis from 'ioredis';

/**
 * Redis Client Infrastructure for Caching, Pub/Sub & WebSocket Fan-out
 * P3-1/3-2 FIX: Scalable distributed caching & pub/sub with graceful fallback.
 */

class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;
  private inMemoryCache = new Map<string, { value: string; expiresAt: number }>();
  private localSubscribers = new Map<string, Set<(message: string) => void>>();

  private constructor() {
    const redisUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      const options = {
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        retryStrategy: (times: number) => {
          return Math.min(times * 200, 3000);
        }
      };

      if (redisUrl) {
        this.client = new Redis(redisUrl, options);
      } else {
        this.client = new Redis({ host, port, ...options });
      }

      this.client.on('ready', () => {
        console.log('[Redis] ✅ Connected and ready on Redis server.');
        this.isConnected = true;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.warn('[Redis] ⚠️ Redis error:', err.message);
        }
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn('[Redis] Failed to initialize Redis client. Degraded in-memory mode active.', err.message);
      this.isConnected = false;
    }

    // Sweep expired keys from the in-memory fallback cache every 60s.
    // Without this, the fallback Map grows without bound in degraded mode because
    // get() only evicts keys that happen to be read again.
    this.sweepTimer = setInterval(() => this.sweepExpired(), 60_000);
    this.sweepTimer.unref?.();
  }

  private sweepTimer: NodeJS.Timeout | null = null;
  private static readonly MAX_IN_MEMORY_KEYS = 50_000;

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.inMemoryCache) {
      if (now > entry.expiresAt) this.inMemoryCache.delete(key);
    }
    // Hard ceiling: if still oversized, evict oldest-inserted entries (Map preserves insertion order)
    if (this.inMemoryCache.size > RedisService.MAX_IN_MEMORY_KEYS) {
      const excess = this.inMemoryCache.size - RedisService.MAX_IN_MEMORY_KEYS;
      let removed = 0;
      for (const key of this.inMemoryCache.keys()) {
        this.inMemoryCache.delete(key);
        if (++removed >= excess) break;
      }
      console.warn(`[Redis] In-memory cache exceeded ${RedisService.MAX_IN_MEMORY_KEYS} keys; evicted ${removed} oldest entries.`);
    }
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public isAvailable(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  /**
   * Set cache with TTL in seconds
   */
  public async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    if (this.isAvailable()) {
      try {
        await this.client!.set(key, value, 'EX', ttlSeconds);
        return;
      } catch (err: any) {
        console.warn(`[Redis] Set failed for key ${key}, falling back to memory:`, err.message);
      }
    }
    // In-memory fallback
    this.inMemoryCache.set(key, { value, expiresAt: Date.now() + (ttlSeconds * 1000) });
  }

  /**
   * Get cache value by key
   */
  public async get(key: string): Promise<string | null> {
    if (this.isAvailable()) {
      try {
        return await this.client!.get(key);
      } catch (err: any) {
        console.warn(`[Redis] Get failed for key ${key}, falling back to memory:`, err.message);
      }
    }
    // In-memory fallback
    const cached = this.inMemoryCache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.inMemoryCache.delete(key);
      return null;
    }
    return cached.value;
  }

  private inMemoryLists = new Map<string, string[]>();

  /**
   * Push value to a Redis list and trim to max length (circular buffer)
   */
  public async rpushTrim(key: string, value: string, maxLen = 1000): Promise<void> {
    if (this.isAvailable()) {
      try {
        const pipeline = this.client!.pipeline();
        pipeline.rpush(key, value);
        pipeline.ltrim(key, -maxLen, -1);
        pipeline.expire(key, 86400); // 24h retention
        await pipeline.exec();
        return;
      } catch (err: any) {
        console.warn(`[Redis] rpushTrim failed for key ${key}, falling back to memory:`, err.message);
      }
    }
    // In-memory fallback
    if (!this.inMemoryLists.has(key)) {
      this.inMemoryLists.set(key, []);
    }
    const list = this.inMemoryLists.get(key)!;
    list.push(value);
    if (list.length > maxLen) {
      list.splice(0, list.length - maxLen);
    }
  }

  /**
   * Get elements from a Redis list by range
   */
  public async lrange(key: string, start = 0, stop = -1): Promise<string[]> {
    if (this.isAvailable()) {
      try {
        return await this.client!.lrange(key, start, stop);
      } catch (err: any) {
        console.warn(`[Redis] lrange failed for key ${key}, falling back to memory:`, err.message);
      }
    }
    // In-memory fallback
    const list = this.inMemoryLists.get(key) || [];
    if (start === 0 && stop === -1) return [...list];
    const normalizedStart = start < 0 ? Math.max(list.length + start, 0) : start;
    const normalizedStop = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(normalizedStart, normalizedStop);
  }

  /**
   * Delete key from cache
   */
  public async del(key: string): Promise<void> {
    if (this.isAvailable()) {
      try {
        await this.client!.del(key);
      } catch (_) {}
    }
    this.inMemoryCache.delete(key);
    this.inMemoryLists.delete(key);
  }

  /**
   * Pub/Sub: Publish message to Redis channel with in-memory fallback.
   *
   * CRITICAL: local subscribers are fired here ONLY when Redis is unavailable.
   * When Redis IS connected, the message loops back through subClient's 'message'
   * handler which fires the same callback set — firing here too would double-process
   * every single market tick (a major source of CPU burn and duplicate fan-out).
   */
  public async publish(channel: string, message: string): Promise<void> {
    if (this.isAvailable()) {
      try {
        await this.client!.publish(channel, message);
        return; // subClient will deliver to local subscribers — do not double-fire
      } catch (err: any) {
        console.warn(`[Redis] Publish failed for channel ${channel}:`, err.message);
        // fall through to local delivery so the message is not lost
      }
    }
    // In-memory fallback delivery (Redis down or publish failed)
    const subs = this.localSubscribers.get(channel);
    if (subs) {
      subs.forEach(cb => {
        try { cb(message); } catch (_) {}
      });
    }
  }

  /**
   * Pub/Sub: Subscribe to channel.
   * Subscriptions are tracked so they can be restored if Redis reconnects after
   * having been unavailable at subscribe() time.
   */
  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.localSubscribers.has(channel)) {
      this.localSubscribers.set(channel, new Set());
    }
    this.localSubscribers.get(channel)!.add(callback);
    this.pendingChannels.add(channel);

    await this.ensureRedisSubscription(channel);
  }

  private pendingChannels = new Set<string>();

  private async ensureRedisSubscription(channel: string): Promise<void> {
    if (!this.client) return;

    if (!this.subClient) {
      this.subClient = this.client.duplicate({
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        retryStrategy: (times: number) => Math.min(times * 200, 3000)
      });
      this.subClient.on('message', (ch, msg) => {
        const callbacks = this.localSubscribers.get(ch);
        if (callbacks) {
          callbacks.forEach(cb => {
            try { cb(msg); } catch (_) {}
          });
        }
      });
      this.subClient.on('error', (err) => {
        console.warn('[Redis] Subscriber client error:', err.message);
      });
      // Restore all channel subscriptions after a reconnect
      this.subClient.on('ready', () => {
        this.pendingChannels.forEach(ch => {
          this.subClient!.subscribe(ch).catch(() => {});
        });
      });
    }

    try {
      await this.subClient.subscribe(channel);
    } catch (err: any) {
      console.warn(`[Redis] Subscribe queued or failed for channel ${channel}:`, err.message);
    }
  }

  /**
   * Set key with TTL only if key does NOT already exist (Atomic SET ... NX EX).
   * Returns true if key was set, false if key already exists.
   */
  public async setNx(key: string, value: string, ttlSeconds = 10): Promise<boolean> {
    if (this.isAvailable()) {
      try {
        const res = await this.client!.set(key, value, 'EX', ttlSeconds, 'NX');
        return res === 'OK';
      } catch (err: any) {
        console.warn(`[Redis] setNx failed for ${key}, falling back to memory:`, err.message);
      }
    }
    // In-memory fallback
    const now = Date.now();
    const existing = this.inMemoryCache.get(key);
    if (existing && now < existing.expiresAt) {
      return false; // Already locked
    }
    this.inMemoryCache.set(key, { value, expiresAt: now + (ttlSeconds * 1000) });
    return true;
  }

  /**
   * Acquire a distributed lock.
   */
  public async acquireLock(lockKey: string, ttlSeconds = 10, identifier = '1'): Promise<boolean> {
    return this.setNx(lockKey, identifier, ttlSeconds);
  }

  /**
   * Release a distributed lock.
   */
  public async releaseLock(lockKey: string): Promise<void> {
    await this.del(lockKey);
  }

  /**
   * Get raw ioredis client instance for external integrations (e.g. rate-limit-redis).
   */
  public getRawClient(): Redis | null {
    return this.client;
  }

  /**
   * Get Redis operational health & metrics.
   */
  public async getHealthMetrics(): Promise<{
    connected: boolean;
    mode: 'REDIS_SERVER' | 'IN_MEMORY_FALLBACK';
    inMemoryKeysCount: number;
    redisInfo?: Record<string, string>;
  }> {
    const connected = this.isAvailable();
    if (!connected) {
      return {
        connected: false,
        mode: 'IN_MEMORY_FALLBACK',
        inMemoryKeysCount: this.inMemoryCache.size
      };
    }

    try {
      const info = await this.client!.info('memory');
      const memoryUsedMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const peakMemoryMatch = info.match(/used_memory_peak_human:([^\r\n]+)/);

      return {
        connected: true,
        mode: 'REDIS_SERVER',
        inMemoryKeysCount: this.inMemoryCache.size,
        redisInfo: {
          usedMemory: memoryUsedMatch ? memoryUsedMatch[1] : 'unknown',
          peakMemory: peakMemoryMatch ? peakMemoryMatch[1] : 'unknown'
        }
      };
    } catch (_) {
      return {
        connected: true,
        mode: 'REDIS_SERVER',
        inMemoryKeysCount: this.inMemoryCache.size
      };
    }
  }
}

export const redis = RedisService.getInstance();
