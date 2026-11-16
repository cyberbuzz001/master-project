jest.mock('../db/redis', () => ({ redis: {} }));
jest.mock('../services/SafetyLock', () => ({ SafetyLock: { assertSimulationOnly: jest.fn() } }));
jest.mock('../marketData/InstrumentMasterService', () => ({ InstrumentMasterService: { getInstance: () => ({ getDhanScripByToken: () => undefined }) } }));
import { DhanAdapter } from '../marketData/DhanAdapter';

test('strict research history returns empty when mapping is missing without invoking fallback pricing', async () => {
  const adapter: any = Object.create(DhanAdapter.prototype);
  adapter.getQuote = jest.fn(() => { throw new Error('Fallback pricing must not run'); });
  const random = jest.spyOn(Math, 'random');
  try {
    expect(await adapter.getHistoricalCandles('UNMAPPED', '5m', 100, false)).toEqual([]);
    expect(adapter.getQuote).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  } finally { random.mockRestore(); }
});
