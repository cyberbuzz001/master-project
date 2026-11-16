jest.mock('../db/redis', () => ({ redis: {} }));
jest.mock('../services/SafetyLock', () => ({ SafetyLock: { assertSimulationOnly: jest.fn() } }));
jest.mock('../marketData/InstrumentMasterService', () => ({ InstrumentMasterService: { getInstance: jest.fn(() => ({ getDhanScripByToken: () => undefined })) } }));
import { DhanAdapter } from '../marketData/DhanAdapter';
import { InstrumentMasterService } from '../marketData/InstrumentMasterService';

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

test('research REST quote preserves provider depth and circuit values without inferred prices', async () => {
  const adapter: any = Object.create(DhanAdapter.prototype);
  adapter.baseUrl = 'https://example.invalid';
  (InstrumentMasterService.getInstance as jest.Mock).mockReturnValue({ getDhanScripByToken: () => ({
    segment:'NSE_EQ', securityId:'2885', exchange:'NSE', symbolName:'RELIANCE' }) });
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok:true, json:async () => ({ status:'success',
    data:{ NSE_EQ:{ '2885':{ last_price:100, lower_circuit_limit:80, upper_circuit_limit:120,
      depth:{ buy:[{ price:99, quantity:25 }], sell:[{ price:101, quantity:50 }] } } } } }) } as any);
  try {
    const quote = await adapter.getResearchQuote('NSE_RELIANCE');
    expect(quote).toMatchObject({ bid:99, ask:101, lowerCircuit:80, upperCircuit:120, depthVerified:true });
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ NSE_EQ:[2885] });
  } finally { fetch.mockRestore(); }
});
