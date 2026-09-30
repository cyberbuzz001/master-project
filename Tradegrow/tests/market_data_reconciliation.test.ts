import { MarketDataEngine } from '../server/src/marketData/MarketDataEngine';
import { InstrumentMasterService } from '../server/src/marketData/InstrumentMasterService';
import { OptionChainEngine } from '../server/src/marketData/OptionChainEngine';
import { ReconciliationMonitorService } from '../server/src/services/ReconciliationMonitorService';
import { MarketTick } from '../server/src/marketData/types';

describe('Market Data Price Feed & Reconciliation Audits', () => {

  test('1. Instrument Token Resolution & Normalization', async () => {
    const masterService = InstrumentMasterService.getInstance();
    
    // Seed test master data
    await masterService.syncMasterData([
      { token: "49231", symbol: "NIFTY28AUG2624500CE", name: "NIFTY", expiry: "28AUG2026", strike: "24500.0", lotsize: "25", instrumenttype: "OPTIDX", exch_seg: "NFO", tick_size: "0.05" },
      { token: "49232", symbol: "NIFTY28AUG2624500PE", name: "NIFTY", expiry: "28AUG2026", strike: "24500.0", lotsize: "25", instrumenttype: "OPTIDX", exch_seg: "NFO", tick_size: "0.05" }
    ]);

    const ceInst = await masterService.getInstrumentByToken('NFO_49231');
    expect(ceInst).not.toBeNull();
    expect(ceInst?.trading_symbol).toBe('NIFTY28AUG2624500CE');
    expect(ceInst?.strike).toBe(24500);
  });

  test('2. Option Chain Engine Resolves Live Cache Ticks Across Formats', async () => {
    const engine = MarketDataEngine.getInstance();
    
    const sampleTick: MarketTick = {
      instrumentToken: 'NFO_49231',
      exchange: 'NFO',
      symbol: 'NIFTY28AUG2624500CE',
      ltp: 185.50,
      open: 180.00,
      high: 190.00,
      low: 175.00,
      close: 182.00,
      volume: 15000,
      change: 3.50,
      changePercent: 1.92,
      bid: 185.00,
      ask: 186.00,
      bidQty: 100,
      askQty: 100,
      timestamp: Date.now()
    };

    // Inject tick under canonical, raw, and fallback string formats
    (engine as any).tickCache.set('NFO_49231', sampleTick);
    (engine as any).tickCache.set('49231', sampleTick);
    (engine as any).tickCache.set('NFO_NIFTY_24500_CE', sampleTick);

    // Verify lookup succeeds via getCachedTick
    expect(engine.getCachedTick('NFO_49231')?.ltp).toBe(185.50);
    expect(engine.getCachedTick('49231')?.ltp).toBe(185.50);
    expect(engine.getCachedTick('NFO_NIFTY_24500_CE')?.ltp).toBe(185.50);

    // Generate option chain matrix
    const chainResult = await OptionChainEngine.generateOptionChain({
      symbol: 'NIFTY',
      spotPrice: 24500,
      expiry: '2026-08-28',
      strikeRange: '5'
    });

    const atmRow = chainResult.chain.find(r => r.strikePrice === 24500);
    expect(atmRow).toBeDefined();
    expect(atmRow?.ce.ltp).toBe(185.50);
  });

  test('3. Reconciliation Monitor Verification Check', async () => {
    const monitor = ReconciliationMonitorService.getInstance();
    const report = await monitor.runReconciliationCheck();

    expect(report).toBeDefined();
    expect(report.tokensChecked).toBeGreaterThan(0);
    expect(Array.isArray(report.results)).toBe(true);
  });
});
