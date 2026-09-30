import React, { useState, useEffect } from 'react';
import { MarketTick } from '../types';
import { Zap, ShieldCheck, TrendingUp, TrendingDown, Layers, BarChart2 } from 'lucide-react';

interface DepthLevel {
  orders: number;
  qty: number;
  price: number;
}

interface MarketDepthViewProps {
  ticks: Map<string, MarketTick>;
  token: string;
  onOrderClick?: (symbol: string, side: 'BUY' | 'SELL', price: number) => void;
}

export const MarketDepthView: React.FC<MarketDepthViewProps> = ({ ticks, token, onOrderClick }) => {
  const [selectedToken, setSelectedToken] = useState<string>('NSE_RELIANCE');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');

  const instruments = [
    { token: 'NSE_RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', basePrice: 1310.04 },
    { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', name: 'Nifty 50 Index', basePrice: 24603.94 },
    { token: 'NSE_BANKNIFTY', symbol: 'BANKNIFTY', name: 'Nifty Bank Index', basePrice: 57794.08 },
    { token: 'NSE_TCS', symbol: 'TCS', name: 'Tata Consultancy Services', basePrice: 2428.48 },
    { token: 'NSE_HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', basePrice: 754.02 },
    { token: 'NSE_INFY', symbol: 'INFY', name: 'Infosys Limited', basePrice: 1158.73 },
    { token: 'NSE_TATAMOTORS', symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', basePrice: 348.22 }
  ];

  const activeTick = ticks.get(selectedToken);
  const currentPrice = activeTick?.ltp || instruments.find(i => i.token === selectedToken)?.basePrice || 1300.0;

  // Generate 5-level Bid/Ask depth based on current LTP
  const generateDepth = (ltp: number) => {
    const step = ltp > 10000 ? 5 : ltp > 1000 ? 0.5 : 0.05;
    const bids: DepthLevel[] = [];
    const asks: DepthLevel[] = [];

    for (let i = 1; i <= 5; i++) {
      const bidPrice = Number((ltp - (i * step)).toFixed(2));
      const askPrice = Number((ltp + (i * step)).toFixed(2));

      bids.push({
        orders: Math.floor(Math.random() * 15) + 3,
        qty: Math.floor(Math.random() * 2500) + 200,
        price: bidPrice
      });

      asks.push({
        orders: Math.floor(Math.random() * 15) + 3,
        qty: Math.floor(Math.random() * 2500) + 200,
        price: askPrice
      });
    }

    return { bids, asks };
  };

  const [depthData, setDepthData] = useState(() => generateDepth(currentPrice));

  useEffect(() => {
    setDepthData(generateDepth(currentPrice));
  }, [currentPrice, selectedToken]);

  const totalBidQty = depthData.bids.reduce((acc, b) => acc + b.qty, 0);
  const totalAskQty = depthData.asks.reduce((acc, a) => acc + a.qty, 0);
  const totalVolume = totalBidQty + totalAskQty;
  const bidRatio = totalVolume > 0 ? ((totalBidQty / totalVolume) * 100).toFixed(1) : '50.0';
  const askRatio = totalVolume > 0 ? ((totalAskQty / totalVolume) * 100).toFixed(1) : '50.0';

  const maxQty = Math.max(...depthData.bids.map(b => b.qty), ...depthData.asks.map(a => a.qty), 1);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white flex items-center gap-2">
              Level-2 Market Depth & Order Flow Analysis
            </h2>
            <span className="text-xs text-slate-400">Real-time top 5 Bids and Asks order book representation</span>
          </div>
        </div>

        {/* Symbol Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">SELECT SYMBOL:</span>
          <select
            value={selectedToken}
            onChange={(e) => {
              const inst = instruments.find(i => i.token === e.target.value);
              if (inst) {
                setSelectedToken(inst.token);
                setSelectedSymbol(inst.symbol);
              }
            }}
            className="bg-slate-950 border border-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
          >
            {instruments.map(inst => (
              <option key={inst.token} value={inst.token}>{inst.symbol} — ₹{inst.basePrice}</option>
            ))}
          </select>
        </div>
      </div>

      {/* MAIN DEPTH GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* LEFT 8 COLS: BID / ASK DEPTH TABLES */}
        <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">{selectedSymbol}</span>
                <span className="text-2xl font-bold font-mono text-white">₹{currentPrice.toFixed(2)}</span>
                {activeTick && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${activeTick.change >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                    {activeTick.change >= 0 ? '+' : ''}{activeTick.change.toFixed(2)} ({activeTick.changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>

              {/* Order Placement Triggers */}
              {onOrderClick && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOrderClick(selectedSymbol, 'BUY', depthData.asks[0].price)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    BUY @ Best Ask (₹{depthData.asks[0].price})
                  </button>
                  <button
                    onClick={() => onOrderClick(selectedSymbol, 'SELL', depthData.bids[0].price)}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    SELL @ Best Bid (₹{depthData.bids[0].price})
                  </button>
                </div>
              )}
            </div>

            {/* BID / ASK TWO COLUMN TABLES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BIDS SIDE (BUYERS) */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex justify-between text-xs font-bold text-emerald-400 border-b border-slate-800 pb-2 mb-2">
                  <span>BUY ORDERS</span>
                  <span>QTY</span>
                  <span>BID PRICE</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {depthData.bids.map((b, idx) => {
                    const widthPct = ((b.qty / maxQty) * 100).toFixed(0);
                    return (
                      <div key={idx} className="relative flex items-center justify-between text-xs font-mono py-1.5 px-2 rounded overflow-hidden">
                        {/* Background volume bar */}
                        <div
                          className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 transition-all duration-300"
                          style={{ width: `${widthPct}%` }}
                        ></div>

                        <span className="text-slate-400 z-10">{b.orders}</span>
                        <span className="font-bold text-slate-200 z-10">{b.qty.toLocaleString()}</span>
                        <span className="font-bold text-emerald-400 z-10">₹{b.price.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-xs font-bold text-slate-300 pt-3 mt-2 border-t border-slate-800">
                  <span>TOTAL BID QTY:</span>
                  <span className="text-emerald-400 font-mono">{totalBidQty.toLocaleString()}</span>
                </div>
              </div>

              {/* ASKS SIDE (SELLERS) */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div className="flex justify-between text-xs font-bold text-rose-400 border-b border-slate-800 pb-2 mb-2">
                  <span>ASK PRICE</span>
                  <span>QTY</span>
                  <span>SELL ORDERS</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {depthData.asks.map((a, idx) => {
                    const widthPct = ((a.qty / maxQty) * 100).toFixed(0);
                    return (
                      <div key={idx} className="relative flex items-center justify-between text-xs font-mono py-1.5 px-2 rounded overflow-hidden">
                        {/* Background volume bar */}
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-rose-500/15 transition-all duration-300"
                          style={{ width: `${widthPct}%` }}
                        ></div>

                        <span className="font-bold text-rose-400 z-10">₹{a.price.toFixed(2)}</span>
                        <span className="font-bold text-slate-200 z-10">{a.qty.toLocaleString()}</span>
                        <span className="text-slate-400 z-10">{a.orders}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-xs font-bold text-slate-300 pt-3 mt-2 border-t border-slate-800">
                  <span>TOTAL ASK QTY:</span>
                  <span className="text-rose-400 font-mono">{totalAskQty.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* BUYER / SELLER PRESSURE METER */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-emerald-400">BUYING PRESSURE: {bidRatio}%</span>
              <span className="text-rose-400">SELLING PRESSURE: {askRatio}%</span>
            </div>
            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${bidRatio}%` }}></div>
              <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${askRatio}%` }}></div>
            </div>
          </div>
        </div>

        {/* RIGHT 4 COLS: ORDER BOOK SUMMARY & INSIGHTS */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" /> Microstructure Summary
            </h3>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">BID-ASK SPREAD:</span>
                <span className="font-mono font-bold text-amber-400">
                  ₹{(depthData.asks[0].price - depthData.bids[0].price).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">BEST BID (TOP):</span>
                <span className="font-mono font-bold text-emerald-400">₹{depthData.bids[0].price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">BEST ASK (TOP):</span>
                <span className="font-mono font-bold text-rose-400">₹{depthData.asks[0].price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">IMBALANCE RATIO:</span>
                <span className="font-mono font-bold text-slate-200">
                  {(totalBidQty / Math.max(totalAskQty, 1)).toFixed(2)}x
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
