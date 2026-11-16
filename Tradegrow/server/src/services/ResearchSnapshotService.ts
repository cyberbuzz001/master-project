import { queryOne } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { InstrumentMasterService } from '../marketData/InstrumentMasterService';
import { checkSessionWindow, istDateString } from '../utils/marketHours';
import { Candle, MarketTick } from '../marketData/types';

/** Pure checks kept separate to test feed integrity without broker credentials. */
export function validateResearchData(token: string, tick: MarketTick | null, candles: Candle[], now = Date.now()) {
  if (!tick || tick.instrumentToken !== token || tick.source !== 'dhan' || tick.isSynthetic ||
      !Number.isFinite(tick.ltp) || tick.ltp <= 0 || !Number.isFinite(tick.timestamp) ||
      now - tick.timestamp < 0 || now - tick.timestamp > 60_000) {
    throw new Error('A fresh Dhan quote for the exact instrument is unavailable');
  }
  if (!tick.depthVerified || !(tick.bid > 0 && tick.ask >= tick.bid) || !Number.isFinite(tick.bid) || !Number.isFinite(tick.ask) ||
      (tick.ask - tick.bid) / tick.ltp > .05) throw new Error('Bid/ask is missing, crossed, or wider than 5%');
  if (!Number.isFinite(tick.lowerCircuit) || !Number.isFinite(tick.upperCircuit) ||
      !(tick.lowerCircuit! > 0 && tick.upperCircuit! > tick.lowerCircuit!) ||
      tick.ltp < tick.lowerCircuit! || tick.ltp > tick.upperCircuit! ||
      tick.bid < tick.lowerCircuit! || tick.ask > tick.upperCircuit!) throw new Error('Authoritative circuit limits are missing or quote is outside limits');
  const bars = candles.filter(c => c.time * 1000 + 300_000 <= tick.timestamp);
  if (bars.length < 30) throw new Error('At least 30 completed five-minute Dhan bars are required');
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (![b.time, b.open, b.high, b.low, b.close, b.volume].every(Number.isFinite) ||
        b.low <= 0 || b.volume < 0 || b.low > Math.min(b.open, b.close) ||
        b.high < Math.max(b.open, b.close) || (i > 0 && b.time <= bars[i-1].time)) {
      throw new Error('Dhan history contains invalid or unordered bars');
    }
  }
  if (tick.timestamp - bars[bars.length-1].time * 1000 > 900_000) throw new Error('Completed Dhan history is stale');
  return bars;
}

export async function buildResearchSnapshot(token: string) {
  // Exact lookup: symbol aliases must never select another expiry/contract.
  const instrument = await queryOne<any>('SELECT * FROM instruments WHERE instrument_token=$1 AND active=true', [token]);
  if (!instrument || !['NSE', 'BSE', 'NFO', 'BFO'].includes(instrument.exchange)) throw new Error('Select an active Indian stock or option contract');
  const option = ['CE', 'PE'].includes(instrument.option_type);
  if (!option && !['EQ', 'EQUITY'].includes(instrument.instrument_type)) throw new Error('Only stocks and options are supported');
  const session = checkSessionWindow(instrument.exchange);
  if (!session.open) throw new Error('Live research is available during the regular equity trading session');
  // Unlike the order gate, research fails closed if the calendar cannot be read.
  const holiday = await queryOne<any>(`SELECT count(*) AS configured,
    count(*) FILTER (WHERE holiday_date=$1::date AND segment IN ('ALL','EQUITY')) AS today
    FROM trading_holidays WHERE segment IN ('ALL','EQUITY') AND EXTRACT(YEAR FROM holiday_date)=EXTRACT(YEAR FROM $1::date)`, [istDateString()]);
  if (!holiday || Number(holiday.configured) === 0 || Number(holiday.today) > 0) throw new Error('Exchange holiday or holiday calendar unavailable');
  const mapping = InstrumentMasterService.getInstance().getDhanScripByToken(token);
  if (!mapping) throw new Error('Exact Dhan instrument mapping is unavailable');
  let expiresAt: string | undefined;
  if (option) {
    const expiry = typeof instrument.expiry === 'string' ? instrument.expiry.slice(0,10) : instrument.expiry?.toISOString().slice(0,10);
    if (!expiry || expiry !== mapping.expiryDate || mapping.optionType !== instrument.option_type || Number(mapping.strikePrice) !== Number(instrument.strike)) {
      throw new Error('Option expiry/strike does not match the Dhan instrument master');
    }
    expiresAt = new Date(`${expiry}T15:30:00+05:30`).toISOString();
    if (Date.parse(expiresAt) <= Date.now()) throw new Error('Option contract has expired');
  }
  const lot = Number(instrument.lot_size), tickSize = Number(instrument.tick_size);
  if (!Number.isInteger(lot) || lot < 1 || !(tickSize > 0) || Number(mapping.lotSize) !== lot) throw new Error('Instrument lot/tick metadata is invalid or out of sync');
  const engine = MarketDataEngine.getInstance();
  if (engine.getActiveProviderName().toUpperCase() !== 'DHAN') throw new Error('Dhan is not the active data provider');
  const candles = await engine.getResearchCandles(token);
  const quote = await engine.getResearchQuote(token);
  const bars = validateResearchData(token, quote, candles);
  return { symbol: instrument.trading_symbol, token, asset_type: option ? 'option' : 'stock', source: 'dhan',
    as_of: new Date(quote!.timestamp).toISOString(), last_price: String(quote!.ltp), tick_size: String(tickSize),
    lot_size: lot, risk_budget: '1000', lower_circuit: String(quote!.lowerCircuit), upper_circuit: String(quote!.upperCircuit),
    ...(option ? { underlying: mapping.symbolName, expires_at: expiresAt } : {}),
    bars: bars.map(b => ({ timestamp: new Date(b.time*1000).toISOString(), open: String(b.open), high: String(b.high),
      low: String(b.low), close: String(b.close), volume: String(b.volume) })) };
}
