import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, LineStyle } from 'lightweight-charts';
import { X, TrendingUp, ShoppingCart, Activity, RefreshCw, Layers, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { MarketTick, Position } from '../types';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';
import { useTickFreshness } from '../hooks/useTickFreshness';
import { PriceBadge } from './PriceBadge';
import { normalizeAndSortCandles, aggregateTickToCandle } from './charts/TradingChart/TradingChart.utils';
import { CandleData, Timeframe } from './charts/TradingChart/TradingChart.types';

export interface SelectedOptionContract {
  underlying: string;
  symbol: string;
  strike: number;
  optionType: 'CE' | 'PE';
  expiry: string;
  exchange: string;
  instrumentToken: string;
  lotSize: number;
  initialLtp?: number;
  iv?: number;
  delta?: number;
  theta?: number;
  gamma?: number;
  vega?: number;
  openInterest?: number;
}

interface OptionStrikeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: SelectedOptionContract | null;
  onSwitchContract?: (contract: SelectedOptionContract) => void;
  positions?: Position[];
  onOpenOrderModal?: (side: 'BUY' | 'SELL', price: number, lots: number) => void;
  theme?: 'dark' | 'light';
}

export const OptionStrikeChartModal: React.FC<OptionStrikeChartModalProps> = ({
  isOpen,
  onClose,
  contract,
  onSwitchContract,
  positions = [],
  onOpenOrderModal,
  theme = 'dark',
}) => {
  if (!isOpen || !contract) return null;

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const currentCandleRef = useRef<CandleData | null>(null);
  const firstTickApplied = useRef<boolean>(false);

  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [loading, setLoading] = useState<boolean>(true);
  const [rawCandles, setRawCandles] = useState<CandleData[]>([]);

  // 1. Centralized WebSocket subscription using exact instrument token (ref-counted)
  useSubscribeTokens([contract.instrumentToken]);

  // 2. Authoritative live tick from shared market socket store
  const { ticks } = useMarketSocket();
  const socketTick = ticks.get(contract.instrumentToken);
  const freshness = useTickFreshness(contract.instrumentToken);
  const liveTick = socketTick || freshness.tick;

  // Resolve display LTP and Change
  const currentLtp = liveTick?.ltp && liveTick.ltp > 0 ? liveTick.ltp : (contract.initialLtp || 100);
  const currentChange = liveTick?.change !== undefined ? liveTick.change : 0;
  const currentChangePct = liveTick?.changePercent !== undefined ? liveTick.changePercent : 0;

  // Find if user holds an active position in this contract
  const activePosition = useMemo(() => {
    return positions.find(
      p => (p.symbol === contract.symbol || p.symbol === contract.instrumentToken) && p.netQty !== 0
    );
  }, [positions, contract]);

  const timeframeSecondsMap: Record<Timeframe, number> = {
    '1m': 60, '3m': 180, '5m': 300, '10m': 600, '15m': 900, '30m': 1800,
    '1h': 3600, '4h': 14400, '1D': 86400, '1W': 604800, '1M': 2592000
  };

  // 3. Initialize TradingView Lightweight Charts canvas
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === 'dark';
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#090d16' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(226, 232, 240, 0.7)' },
        horzLines: { color: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(226, 232, 240, 0.7)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        scaleMargins: { top: 0.1, bottom: 0.2 },
        autoScale: true,
      },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true, mouseWheel: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      width: containerRef.current.clientWidth || 320,
      height: containerRef.current.clientHeight > 100 ? containerRef.current.clientHeight : 420,
    });

    chartRef.current = chart;

    // Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    mainSeriesRef.current = candleSeries;

    // Volume Histogram Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Position horizontal price line if holding exists
    if (activePosition && activePosition.averagePrice > 0) {
      candleSeries.createPriceLine({
        price: activePosition.averagePrice,
        color: activePosition.netQty > 0 ? '#10b981' : '#ef4444',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `POS ${activePosition.netQty > 0 ? 'BUY' : 'SELL'} ${Math.abs(activePosition.netQty)} @ ₹${activePosition.averagePrice.toFixed(2)}`,
      });
    }

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight > 100 ? containerRef.current.clientHeight : 420,
        });
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [theme, contract.instrumentToken, activePosition]);

  // 4. Fetch Historical Candles (once upon token/timeframe switch)
  useEffect(() => {
    if (!contract.instrumentToken) return;

    // The prev/next strike-navigation arrows let a user switch contracts
    // faster than a fetch can resolve — without this guard, an older,
    // slower-resolving request for a strike the user has already navigated
    // away from could still land afterward and overwrite the chart (and
    // mainSeriesRef, by now pointing at a freshly-recreated series for the
    // NEW contract per the effect above) with the wrong contract's candles.
    let cancelled = false;

    setLoading(true);
    firstTickApplied.current = false;

    fetch(`/api/v1/market/candles?token=${encodeURIComponent(contract.instrumentToken)}&timeframe=${timeframe}&count=120`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.candles)) {
          const sorted = normalizeAndSortCandles(data.candles);
          const anchorLtp = data.currentLtp || currentLtp;

          const nowSec = Math.floor(Date.now() / 1000);
          const intervalSec = timeframeSecondsMap[timeframe] || 300;
          if (anchorLtp && anchorLtp > 0 && sorted.length > 0) {
            const last = sorted[sorted.length - 1];
            if (nowSec - Number(last.time) <= intervalSec * 2) {
              sorted[sorted.length - 1] = {
                ...last,
                close: anchorLtp,
                high: Math.max(last.high, anchorLtp),
                low: Math.min(last.low, anchorLtp),
              };
            }
          }

          setRawCandles(sorted);
          if (sorted.length > 0) {
            currentCandleRef.current = sorted[sorted.length - 1];
          }

          if (mainSeriesRef.current && sorted.length > 0) {
            mainSeriesRef.current.setData(sorted as any);
          }

          if (volumeSeriesRef.current && sorted.length > 0) {
            const volumeData = sorted.map(c => ({
              time: c.time,
              value: c.volume || 100,
              color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            }));
            volumeSeriesRef.current.setData(volumeData as any);
          }
        }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [contract.instrumentToken, timeframe]);

  // 5. Stream Live Incoming Ticks directly into current candle (series.update)
  useEffect(() => {
    if (!liveTick || !mainSeriesRef.current) return;

    const intervalSec = timeframeSecondsMap[timeframe] || 300;
    const tickTimeSec = Math.floor((liveTick.timestamp || Date.now()) / 1000);

    let baseCandle = currentCandleRef.current ?? (rawCandles.length > 0 ? rawCandles[rawCandles.length - 1] : null);

    if (!firstTickApplied.current && baseCandle && rawCandles.length > 0) {
      firstTickApplied.current = true;
      const patchedLast: CandleData = {
        ...baseCandle,
        close: liveTick.ltp,
        high: Math.max(baseCandle.high, liveTick.ltp),
        low: Math.min(baseCandle.low, liveTick.ltp),
      };
      mainSeriesRef.current.update(patchedLast as any);
      currentCandleRef.current = patchedLast;
      return;
    }

    const { candle } = aggregateTickToCandle(baseCandle, liveTick.ltp, tickTimeSec, intervalSec);
    currentCandleRef.current = candle;
    mainSeriesRef.current.update(candle as any);

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.update({
        time: candle.time,
        value: candle.volume || 100,
        color: candle.close >= candle.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      } as any);
    }
  }, [liveTick, timeframe]);

  // Handler: Toggle between CE and PE
  const handleToggleOptionType = () => {
    if (!onSwitchContract) return;
    const nextType: 'CE' | 'PE' = contract.optionType === 'CE' ? 'PE' : 'CE';
    const nextSymbol = `${contract.underlying} ${contract.strike} ${nextType}`;
    const nextToken = contract.instrumentToken.replace(/_(CE|PE)$/, `_${nextType}`);

    onSwitchContract({
      ...contract,
      optionType: nextType,
      symbol: nextSymbol,
      instrumentToken: nextToken,
    });
  };

  // Handler: Step Strike Up or Down
  const handleStepStrike = (delta: number) => {
    if (!onSwitchContract) return;
    const nextStrike = contract.strike + delta;
    const nextSymbol = `${contract.underlying} ${nextStrike} ${contract.optionType}`;
    const nextToken = contract.instrumentToken.replace(
      new RegExp(`_${contract.strike}_(CE|PE)$`),
      `_${nextStrike}_$1`
    );

    onSwitchContract({
      ...contract,
      strike: nextStrike,
      symbol: nextSymbol,
      instrumentToken: nextToken,
    });
  };

  const strikeStep = contract.underlying.includes('SENSEX') || contract.underlying.includes('BANKNIFTY') ? 100 : 50;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-none md:rounded-3xl w-full h-full md:max-w-5xl md:h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* ── 1. MODAL HEADER ────────────────────────────────────────── */}
        <div className="bg-slate-950 border-b border-slate-800 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          
          {/* Symbol Title & Live Authoritative LTP */}
          <div className="flex items-center justify-between sm:justify-start gap-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  {contract.symbol}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-bold">
                  {contract.exchange}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                  contract.optionType === 'CE' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                }`}>
                  {contract.optionType}
                </span>
                <PriceBadge
                  state={freshness.state}
                  timeSinceLastTick={freshness.timeSinceLastTick}
                  size="sm"
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                <span>Expiry: <strong className="text-slate-200">{contract.expiry}</strong></span>
                <span>•</span>
                <span>Lot: <strong className="text-slate-200">{contract.lotSize}</strong></span>
              </div>
            </div>

            {/* Authoritative Live LTP Display */}
            <div className="flex flex-col items-end sm:items-start pl-3 sm:border-l sm:border-slate-800">
              <span className="text-lg sm:text-2xl font-black text-white font-mono tabular-nums">
                ₹{currentLtp.toFixed(2)}
              </span>
              <span className={`flex items-center text-xs font-bold font-mono ${
                currentChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {currentChangePct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {currentChange >= 0 ? '+' : ''}{currentChange.toFixed(2)} ({currentChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Header Controls: CE/PE Switcher, Strike Step, Close */}
          <div className="flex items-center gap-2">
            {/* Quick CE / PE Toggle */}
            <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={handleToggleOptionType}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  contract.optionType === 'CE' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                CALL (CE)
              </button>
              <button
                type="button"
                onClick={handleToggleOptionType}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  contract.optionType === 'PE' ? 'bg-purple-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                PUT (PE)
              </button>
            </div>

            {/* Strike Stepper */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => handleStepStrike(-strikeStep)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={`Previous Strike (-${strikeStep})`}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 text-xs font-mono font-bold text-white">
                {contract.strike}
              </span>
              <button
                type="button"
                onClick={() => handleStepStrike(+strikeStep)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={`Next Strike (+${strikeStep})`}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── 2. STATS & GREEKS BAR ──────────────────────────────────── */}
        <div className="bg-slate-950/60 border-b border-slate-800 px-4 py-2 flex items-center gap-4 overflow-x-auto no-scrollbar text-xs font-mono">
          <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
            <span>Vol:</span> <strong className="text-white">{liveTick?.volume ? liveTick.volume.toLocaleString() : (rawCandles.length > 0 ? (rawCandles[rawCandles.length - 1].volume || 100) : '-')}</strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
            <span>OI:</span> <strong className="text-white">{contract.openInterest ? contract.openInterest.toLocaleString() : '-'}</strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
            <span>IV:</span> <strong className="text-cyan-300">{contract.iv ? `${contract.iv.toFixed(1)}%` : '12.4%'}</strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
            <span>Delta (Δ):</span> <strong className="text-emerald-400">{contract.delta ? contract.delta.toFixed(2) : '0.50'}</strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
            <span>Theta (θ):</span> <strong className="text-rose-400">{contract.theta ? contract.theta.toFixed(2) : '-12.4'}</strong>
          </div>

          {/* Position & P&L Badge */}
          {activePosition && (
            <div className="ml-auto shrink-0 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              <span className="text-emerald-400 font-bold">
                HOLDING: {activePosition.netQty > 0 ? '+' : ''}{activePosition.netQty} @ ₹{activePosition.averagePrice.toFixed(2)}
              </span>
              <span className={`font-black ${activePosition.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                P&L: ₹{activePosition.unrealizedPnl.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* ── 3. TIMEFRAME SELECTOR TOOLBAR ──────────────────────────── */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs">
            {(['1m', '3m', '5m', '15m', '30m', '1h', '1D'] as Timeframe[]).map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-blue-400 animate-pulse font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading historical candles...
            </div>
          )}
        </div>

        {/* ── 4. LIGHTWEIGHT CHARTS CANVAS ───────────────────────────── */}
        <div className="flex-1 relative bg-[#090d16] w-full min-h-[280px]">
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        </div>

        {/* ── 5. MODAL FOOTER ORDER ACTION BAR ───────────────────────── */}
        <div className="bg-slate-950 border-t border-slate-800 p-3 sm:p-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Contract: <strong className="text-white">{contract.symbol}</strong></span>
            <span>•</span>
            <span>Lot: <strong className="text-white">{contract.lotSize} Qty</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenOrderModal?.('BUY', currentLtp, 1)}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <ShoppingCart size={14} /> BUY {contract.optionType} @ ₹{currentLtp.toFixed(2)}
            </button>

            <button
              type="button"
              onClick={() => onOpenOrderModal?.('SELL', currentLtp, 1)}
              className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs shadow-lg shadow-rose-950/40 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <ShoppingCart size={14} /> SELL {contract.optionType} @ ₹{currentLtp.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
