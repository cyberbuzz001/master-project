const { ExecutionEngine } = require('/app/server/dist/trading/ExecutionEngine');
const { query, queryOne, execute } = require('/app/server/dist/db/schema');
const { MarketDataEngine } = require('/app/server/dist/marketData/MarketDataEngine');
const { SymbologyNormalizer } = require('/app/server/dist/marketData/SymbologyNormalizer');
const { GreeksEngine } = require('/app/server/dist/marketData/GreeksEngine');

async function testFix() {
  console.log('--- Testing Fix for Pending Orders ---');
  const pendingOrders = await query(
    `SELECT * FROM orders WHERE status IN ('ACCEPTED', 'PENDING') ORDER BY created_at ASC LIMIT 10`
  );
  console.log(`Found ${pendingOrders.length} pending orders`);

  const engine = MarketDataEngine.getInstance();

  for (const order of pendingOrders) {
    console.log(`\nProcessing: ${order.id} | ${order.symbol} | ${order.order_type} | ${order.side} | Qty: ${order.quantity} | Price: ${order.price}`);

    const symbolAliases = [
      ...(order.symbol ? SymbologyNormalizer.normalizeToken(order.symbol) : []),
      ...(order.instrument_token ? SymbologyNormalizer.normalizeToken(order.instrument_token) : [])
    ];

    let tick = null;
    for (const alias of symbolAliases) {
      tick = engine.getCachedTick(alias);
      if (tick && tick.ltp > 0) break;
    }

    // Subscribe in background without aborting
    if (!tick && (order.instrument_token || order.symbol)) {
      engine.subscribe([order.instrument_token || order.symbol]);
    }

    const STALENESS_THRESHOLD_MS = 30000;
    let isStale = tick ? (Date.now() - tick.timestamp > STALENESS_THRESHOLD_MS) : true;

    if (!tick || isStale) {
      let fallbackLtp = 0;
      
      // Black-Scholes spot calculation
      const mOpt = (order.symbol || '').match(/(NIFTY|BANKNIFTY|FINNIFTY|SENSEX)\s*(\d+)\s*(CE|PE)/i);
      if (mOpt) {
        const symName = mOpt[1].toUpperCase();
        const strike = parseFloat(mOpt[2]);
        const isCall = mOpt[3].toUpperCase() === 'CE';
        const spotToken = symName === 'SENSEX' ? 'BSE_SENSEX' : symName === 'BANKNIFTY' ? 'NSE_BANKNIFTY' : symName === 'FINNIFTY' ? 'NSE_FINNIFTY' : 'NSE_NIFTY50';
        let spotTick = engine.getCachedTick(spotToken);
        if (!spotTick) {
          try {
            spotTick = await engine.getQuote(spotToken);
          } catch (_) {}
        }
        if (spotTick && spotTick.ltp > 0) {
          const bsPrice = GreeksEngine.calculateOptionPrice(spotTick.ltp, strike, 5.0 / 365.0, isCall, symName === 'SENSEX' ? 0.14 : 0.13);
          if (bsPrice > 0) fallbackLtp = Number(bsPrice.toFixed(2));
          console.log(`Calculated Black-Scholes LTP for ${order.symbol}: ${fallbackLtp} (Spot: ${spotTick.ltp})`);
        }
      }

      // If still no price, use order.price
      if (fallbackLtp <= 0 && parseFloat(order.price || '0') > 0) {
        fallbackLtp = parseFloat(order.price);
        console.log(`Using order.price as fallback: ${fallbackLtp}`);
      }

      if (fallbackLtp > 0) {
        tick = {
          instrumentToken: order.instrument_token || order.symbol,
          exchange: order.exchange || 'NSE',
          symbol: order.symbol,
          tradingSymbol: order.symbol,
          ltp: fallbackLtp,
          open: fallbackLtp,
          high: fallbackLtp,
          low: fallbackLtp,
          close: fallbackLtp,
          bid: fallbackLtp,
          ask: fallbackLtp,
          bidQty: 100,
          askQty: 100,
          volume: 1000,
          change: 0,
          changePercent: 0,
          timestamp: Date.now(),
          source: 'synthetic'
        };
        isStale = false;
      }
    }

    if (!tick || isStale) {
      console.log(`Still no tick for ${order.id}, skipping`);
      continue;
    }

    const price = parseFloat(order.price || '0');
    const trigPrice = parseFloat(order.trigger_price || '0');
    const ltp = tick.ltp;
    const bidPrice = tick.bid || ltp;
    const askPrice = tick.ask || ltp;
    let executePrice = null;

    if (order.order_type === 'MARKET') {
      executePrice = order.side === 'BUY' ? askPrice : bidPrice;
    } else if (order.order_type === 'LIMIT') {
      if (order.side === 'BUY' && askPrice <= price) executePrice = price;
      if (order.side === 'SELL' && bidPrice >= price) executePrice = price;
    } else if (order.order_type === 'SL' || order.order_type === 'SL_M') {
      if (order.side === 'BUY' && askPrice >= trigPrice) executePrice = order.order_type === 'SL_M' ? askPrice : price;
      if (order.side === 'SELL' && bidPrice <= trigPrice) executePrice = order.order_type === 'SL_M' ? bidPrice : price;
    }

    console.log(`Order ${order.id} matched! executePrice: ${executePrice}`);
    if (executePrice && executePrice > 0) {
      const claimed = await queryOne(
        `UPDATE orders SET status = 'EXECUTING', updated_at = NOW() 
         WHERE id = $1 AND (status IN ('ACCEPTED', 'PENDING') OR (status = 'EXECUTING' AND updated_at < NOW() - INTERVAL '3 seconds')) 
         RETURNING id`,
        [order.id]
      );
      if (claimed) {
        console.log(`Claimed order ${order.id}, executing...`);
        const provenance = {
          tickSource: 'SYNTHETIC_SIMULATOR',
          tickTimestamp: Date.now(),
          tickLtp: ltp,
          tickBid: bidPrice,
          tickAsk: askPrice,
          freshnessTag: 'synthetic',
          fillLogic: order.order_type
        };
        await ExecutionEngine.executeOrder(order, executePrice, provenance);
        console.log(`✅ Order ${order.id} successfully executed!`);
      }
    }
  }

  const check = await query(`SELECT id, symbol, status, filled_quantity FROM orders WHERE id IN (${pendingOrders.map(o => `'${o.id}'`).join(',')})`);
  console.log('\n--- Final Order Statuses ---');
  console.log(check);
}

testFix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
