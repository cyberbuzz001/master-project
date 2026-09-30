import { InstrumentMasterService } from '../server/src/marketData/InstrumentMasterService';
import { GreeksEngine } from '../server/src/marketData/GreeksEngine';
import { OptionChainEngine } from '../server/src/marketData/OptionChainEngine';
import { runMigrations } from '../server/src/db/schema';

describe('Angel One Instrument Master & Greeks Engine Tests', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  test('1. Ingests and normalizes instrument master data', async () => {
    const sample = [
      { token: "9988", symbol: "TATASTEEL-EQ", name: "TATASTEEL", expiry: "", strike: "-1.000000", lotsize: "1", instrumenttype: "", exch_seg: "NSE", tick_size: "0.050000" }
    ];
    const res = await InstrumentMasterService.getInstance().syncMasterData(sample);
    expect(res.totalParsed).toBe(1);

    const inst = await InstrumentMasterService.getInstance().getInstrumentByToken("9988");
    expect(inst).not.toBeNull();
    expect(inst?.trading_symbol).toBe("TATASTEEL-EQ");
  });

  test('2. Calculates Black-Scholes Option Greeks accurately', () => {
    const spot = 24500;
    const strike = 24500;
    const greeksCall = GreeksEngine.calculateGreeks(spot, strike, 0.08, true, 0.15);

    expect(greeksCall.delta).toBeGreaterThan(0.4);
    expect(greeksCall.delta).toBeLessThan(0.6);
    expect(greeksCall.gamma).toBeGreaterThan(0);
    expect(greeksCall.theta).toBeLessThan(0);
    expect(greeksCall.vega).toBeGreaterThan(0);

    const greeksPut = GreeksEngine.calculateGreeks(spot, strike, 0.08, false, 0.15);
    expect(greeksPut.delta).toBeLessThan(0);
    expect(greeksPut.delta).toBeGreaterThan(-0.6);
  });

  test('3. Generates dynamic Option Chain Matrix with Greeks', async () => {
    const res = await OptionChainEngine.generateOptionChain({ symbol: 'NIFTY', spotPrice: 24500, expiry: '2026-08-28' });
    expect(res.chain.length).toBeGreaterThan(0);
    const atmItem = res.chain.find(c => c.isAtm);
    expect(atmItem).toBeDefined();
    expect(atmItem!.ce.delta).toBeGreaterThan(0.4);
    expect(atmItem!.pe.delta).toBeLessThan(0);
  });
});
