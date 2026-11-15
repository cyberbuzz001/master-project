jest.mock('../db/redis', () => ({ redis: { set: jest.fn(), rpushTrim: jest.fn() } }));
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { redis } from '../db/redis';

test('older tick cannot escape to subscribers or Redis after cache rejection', () => {
  const engine: any = Object.create(MarketDataEngine.prototype);
  engine.tickCache = new Map();
  engine.globalCallbacks = new Set([jest.fn()]);
  engine.lastRedisWriteByToken = new Map();
  const current = { instrumentToken: 'NSE_NIFTY50', ltp: 24000, timestamp: Date.now(), volume: 1 };
  engine.setCachedTick(current);
  engine.broadcastTick({ ...current, ltp: 23000, timestamp: current.timestamp - 1000 });
  expect(engine.getCachedTick(current.instrumentToken)).toEqual(current);
  expect([...engine.globalCallbacks][0]).not.toHaveBeenCalled();
  expect(redis.set).not.toHaveBeenCalled();
  expect(redis.rpushTrim).not.toHaveBeenCalled();
});
