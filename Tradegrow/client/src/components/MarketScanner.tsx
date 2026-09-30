import React, { useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Filter, Search, ArrowUpRight, ArrowDownRight, Layers, Target, Activity, Sparkles } from 'lucide-react';

interface MarketScannerProps {
  onSelectSymbol?: (symbol: string) => void;
}

export const MarketScanner: React.FC<MarketScannerProps> = ({ onSelectSymbol }) => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'BREAKOUTS' | 'VOLUME' | 'RSI' | 'EMA' | 'GAINERS' | 'LOSERS'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const screenerData = [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE', ltp: 3050.40, change: 2.15, volume: '4.8M', avgVolume: '2.1M', rsi: 68.4, macd: 'BULLISH', signal: 'Volume Breakout', rating: 'STRONG BUY', category: 'BREAKOUTS' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', exchange: 'NSE', ltp: 1015.75, change: 3.40, volume: '8.2M', avgVolume: '3.5M', rsi: 74.2, macd: 'BULLISH', signal: '52W New High', rating: 'STRONG BUY', category: 'BREAKOUTS' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', ltp: 4280.10, change: 1.12, volume: '1.9M', avgVolume: '1.4M', rsi: 58.6, macd: 'BULLISH', signal: 'EMA 20/50 Cross', rating: 'BUY', category: 'EMA' },
    { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', ltp: 1850.25, change: -2.35, volume: '6.4M', avgVolume: '2.8M', rsi: 28.4, macd: 'BEARISH', signal: 'RSI Oversold', rating: 'BUY', category: 'RSI' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE', ltp: 1640.80, change: -0.95, volume: '7.1M', avgVolume: '5.2M', rsi: 44.1, macd: 'NEUTRAL', signal: 'VWAP Support', rating: 'NEUTRAL', category: 'EMA' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'NSE', ltp: 1220.30, change: 1.85, volume: '5.3M', avgVolume: '3.1M', rsi: 62.9, macd: 'BULLISH', signal: 'Bullish Engulfing', rating: 'BUY', category: 'BREAKOUTS' },
    { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', ltp: 845.50, change: 2.90, volume: '9.4M', avgVolume: '4.2M', rsi: 71.5, macd: 'BULLISH', signal: 'Volume Spike 2.2x', rating: 'STRONG BUY', category: 'VOLUME' },
    { symbol: 'AXISBANK', name: 'Axis Bank Ltd', exchange: 'NSE', ltp: 1180.60, change: -1.80, volume: '3.8M', avgVolume: '3.9M', rsi: 34.2, macd: 'BEARISH', signal: 'Supertrend Sell', rating: 'SELL', category: 'LOSERS' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', exchange: 'NSE', ltp: 1490.15, change: 1.45, volume: '3.1M', avgVolume: '2.0M', rsi: 65.8, macd: 'BULLISH', signal: 'ATR Volatility Expansion', rating: 'BUY', category: 'BREAKOUTS' },
    { symbol: 'LT', name: 'Larsen & Toubro Ltd', exchange: 'NSE', ltp: 3620.00, change: -3.10, volume: '2.2M', avgVolume: '1.8M', rsi: 26.8, macd: 'BEARISH', signal: 'RSI Extreme Oversold', rating: 'STRONG BUY', category: 'RSI' },
    { symbol: 'WIPRO', name: 'Wipro Limited', exchange: 'NSE', ltp: 512.30, change: -2.85, volume: '4.5M', avgVolume: '2.9M', rsi: 31.0, macd: 'BEARISH', signal: 'Bearish Breakdown', rating: 'SELL', category: 'LOSERS' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki India', exchange: 'NSE', ltp: 12450.00, change: 0.85, volume: '850K', avgVolume: '620K', rsi: 54.3, macd: 'NEUTRAL', signal: 'Consolidation Squeeze', rating: 'NEUTRAL', category: 'EMA' },
  ];

  const filtered = screenerData.filter(item => {
    const matchesSearch = item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || item.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (activeCategory === 'ALL') return true;
    if (activeCategory === 'BREAKOUTS') return item.category === 'BREAKOUTS';
    if (activeCategory === 'VOLUME') return item.category === 'VOLUME' || parseFloat(item.volume) > parseFloat(item.avgVolume) * 1.5;
    if (activeCategory === 'RSI') return item.category === 'RSI' || item.rsi < 35 || item.rsi > 70;
    if (activeCategory === 'EMA') return item.category === 'EMA';
    if (activeCategory === 'GAINERS') return item.change > 0;
    if (activeCategory === 'LOSERS') return item.change < 0;
    return true;
  });

  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'STRONG BUY': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'BUY': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      case 'NEUTRAL': return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'SELL': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'STRONG SELL': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 h-full overflow-y-auto pr-1 shadow-md backdrop-blur-xl font-body text-slate-100">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400 animate-pulse" /> AI Technical Scanner & Algo Signals
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">Real-time breakout detection, EMA crossovers, RSI extremes, and institutional volume alerts</p>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search ticker or company..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
            />
          </div>

          <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl gap-1 text-xs font-bold">
            {[
              { key: 'ALL', label: 'All Signals' },
              { key: 'BREAKOUTS', label: 'Breakouts' },
              { key: 'VOLUME', label: 'Volume Surge' },
              { key: 'RSI', label: 'RSI Extremes' },
              { key: 'EMA', label: 'EMA Cross' },
              { key: 'GAINERS', label: 'Gainers' },
              { key: 'LOSERS', label: 'Losers' },
            ].map(c => (
              <button
                key={c.key}
                type="button"
                onClick={() => setActiveCategory(c.key as any)}
                className={`px-3 py-1.5 rounded-lg transition-all text-[11px] font-bold cursor-pointer ${
                  activeCategory === c.key ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* STRATEGY PRESETS SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Bullish Breakouts</span>
            <span className="text-base font-black text-white">4 Active Signals</span>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Volume Surges</span>
            <span className="text-base font-black text-white">3 High-Vol Tickers</span>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">RSI Oversold (&lt; 30)</span>
            <span className="text-base font-black text-emerald-400">2 Mean Reversion</span>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Golden Cross (20/50)</span>
            <span className="text-base font-black text-white">3 EMA Crosses</span>
          </div>
        </div>
      </div>

      {/* SCREENER RESULTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.symbol} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-md group">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">{s.symbol}</h3>
                  <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded-md font-mono font-bold border border-slate-800">{s.exchange}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px] font-medium">{s.name}</p>
              </div>

              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${getRatingBadge(s.rating)}`}>
                {s.rating}
              </span>
            </div>

            {/* SIGNAL BADGE */}
            <div className="my-3 flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> {s.signal}
              </span>
              <span className={`text-[10px] num-font font-bold ${s.macd === 'BULLISH' ? 'text-emerald-400' : s.macd === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'}`}>
                MACD {s.macd}
              </span>
            </div>

            {/* METRICS & PRICES */}
            <div className="flex justify-between items-end num-font border-t border-slate-800 pt-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans font-bold">LTP Price</span>
                <div className="text-base font-bold text-white">₹{s.ltp.toFixed(2)}</div>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-slate-400 uppercase block font-sans font-bold">RSI (14)</span>
                <div className={`text-xs font-bold ${s.rsi < 30 ? 'text-emerald-400' : s.rsi > 70 ? 'text-rose-400' : 'text-white'}`}>
                  {s.rsi}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-sans font-bold">24H Change</span>
                <div className={`text-xs font-bold flex items-center justify-end gap-0.5 ${s.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {s.change >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            {onSelectSymbol && (
              <button
                type="button"
                onClick={() => onSelectSymbol(s.symbol)}
                className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                Open Terminal ({s.symbol}) →
              </button>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs font-medium">
          No tickers match the selected technical screener filter.
        </div>
      )}
    </div>
  );
};
