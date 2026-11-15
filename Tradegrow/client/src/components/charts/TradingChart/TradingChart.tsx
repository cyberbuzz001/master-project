import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, IPriceLine, ColorType, LineStyle } from 'lightweight-charts';
import { ChartType, Timeframe, CandleData, IndicatorConfig, OrderMarker, PositionMarker } from './TradingChart.types';
import { normalizeAndSortCandles, aggregateTickToCandle } from './TradingChart.utils';
import { IndicatorEngine } from './IndicatorEngine';
import { IndicatorToolbar } from './IndicatorToolbar';
import { MarketTick } from '../../../types';
import { useSubscribeTokens, useTokenTick } from '../../../hooks/useMarketSocket';
import { useTickFreshness } from '../../../hooks/useTickFreshness';
import { PriceBadge } from '../../PriceBadge';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';

interface TradingChartProps {
  exchange: string;
  symbol: string;
  token: string;
  latestTick?: MarketTick;
  orderMarkers?: OrderMarker[];
  positionMarkers?: PositionMarker[];
  theme?: 'dark' | 'light';
  onBuyClick?: (symbol: string, price: number) => void;
  onSellClick?: (symbol: string, price: number) => void;
  showInstrumentHeader?: boolean;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  exchange,
  symbol,
  token,
  latestTick,
  orderMarkers = [],
  positionMarkers = [],
  theme = 'dark',
  onBuyClick,
  onSellClick,
  showInstrumentHeader = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLevels = useRef<IPriceLine[]>([]);

  const activeIndicatorSeriesMap = useRef<Map<string, ISeriesApi<any>[]>>(new Map());

  const [chartType, setChartType] = useState<ChartType>('Candlestick');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showTradeMarkers, setShowTradeMarkers] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [rawCandles, setRawCandles] = useState<CandleData[]>([]);
  const currentCandleRef = useRef<CandleData | null>(null);

  const [indicators, setIndicators] = useState<IndicatorConfig[]>([
    { id: 'ind_ema9', name: 'EMA 9', type: 'EMA', period: 9, color: '#10b981', enabled: true },
    { id: 'ind_sma20', name: 'SMA 20', type: 'SMA', period: 20, color: '#3b82f6', enabled: true },
  ]);

  // 1. Reference-counted WebSocket token subscription via shared socket manager
  useSubscribeTokens([token]);

  // 2. Data freshness and fine-grained reactive tick evaluation (zero context thrashing)
  const freshness = useTickFreshness(token);
  const socketTick = useTokenTick(token);
  const activeTick = latestTick || socketTick || freshness.tick;

  const timeframeSecondsMap: Record<Timeframe, number> = {
    '1m': 60, '3m': 180, '5m': 300, '10m': 600, '15m': 900, '30m': 1800,
    '1h': 3600, '4h': 14400, '1D': 86400, '1W': 604800, '1M': 2592000
  };

  // Initialize Lightweight Charts Canvas
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === 'dark';
    const initialWidth = containerRef.current.clientWidth || 300;
    const initialHeight = containerRef.current.clientHeight > 100 
      ? containerRef.current.clientHeight 
      : (isFullScreen ? window.innerHeight - 100 : 400);

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#0f172a' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)' },
        horzLines: { color: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { 
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: any, type: number) => typeof time === 'number' ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...(type >= 3 ? { hour: '2-digit', minute: '2-digit', hour12: false } : { day: '2-digit', month: 'short' }) }).format(new Date(time * 1000)) : String(time),
      },
      localization: { timeFormatter: (time: any) => typeof time === 'number' ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time * 1000)) : String(time) },
      handleScroll: {
        vertTouchDrag: false,
        horzTouchDrag: true,
        mouseWheel: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      width: initialWidth,
      height: initialHeight,
    });

    chartRef.current = chart;

    // Create Main Price Series based on ChartType
    createMainSeries(chart, chartType);

    // Create Volume Histogram Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Handle Smooth Auto-Resizing via ResizeObserver
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight > 100 
          ? containerRef.current.clientHeight 
          : (isFullScreen ? window.innerHeight - 100 : 400);
        chartRef.current.applyOptions({ width: w, height: h });
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      activeIndicatorSeriesMap.current.clear();
      priceLevels.current = [];
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [theme]);

  // Helper to switch main series
  const createMainSeries = (chart: IChartApi, type: ChartType) => {
    if (mainSeriesRef.current) {
      try {
        chart.removeSeries(mainSeriesRef.current);
      } catch {
        // Ignore if series belonged to a destroyed chart instance
      }
      mainSeriesRef.current = null;
    }

    if (type === 'Candlestick') {
      mainSeriesRef.current = chart.addCandlestickSeries({
        upColor: '#0BA860', downColor: '#E5484D',
        borderVisible: false, wickUpColor: '#0BA860', wickDownColor: '#E5484D',
      });
    } else if (type === 'Bar') {
      mainSeriesRef.current = chart.addBarSeries({
        upColor: '#0BA860', downColor: '#E5484D',
      });
    } else if (type === 'Line') {
      mainSeriesRef.current = chart.addLineSeries({
        color: '#00439D', lineWidth: 2,
      });
    } else if (type === 'Area') {
      mainSeriesRef.current = chart.addAreaSeries({
        topColor: 'rgba(0, 67, 157, 0.4)',
        bottomColor: 'rgba(0, 67, 157, 0.0)',
        lineColor: '#00439D',
        lineWidth: 2,
      });
    }
  };

  // Switch Chart Type dynamically
  useEffect(() => {
    if (chartRef.current && rawCandles.length > 0) {
      createMainSeries(chartRef.current, chartType);
      updateChartData(rawCandles);
    }
  }, [chartType]);

  // Fetch Historical Candles from Backend API. Takes a cancellation checker
  // so a slow, superseded request (switching symbol/timeframe again before
  // this one resolves) can't overwrite the chart with the wrong instrument's
  // candles after the fact.
  const fetchHistoricalData = (isCancelled: () => boolean) => {
    setLoading(true);
    setHistoryError(false);
    setRawCandles([]);
    currentCandleRef.current = null;
    mainSeriesRef.current?.setData([]);
    volumeSeriesRef.current?.setData([]);
    firstTickApplied.current = false;
    fetch(`/api/v1/market/candles?token=${encodeURIComponent(token)}&timeframe=${timeframe}&count=240`)
      .then(res => { if (!res.ok) throw new Error('History unavailable'); return res.json(); })
      .then(data => {
        if (isCancelled()) return;
        if (data.success && Array.isArray(data.candles)) {
          let sorted = normalizeAndSortCandles(data.candles);


          setRawCandles(sorted);
          if (sorted.length > 0) {
            currentCandleRef.current = sorted[sorted.length - 1];
          }
          updateChartData(sorted);
          chartRef.current?.timeScale().fitContent();
        } else {
          setHistoryError(true);
        }
        setLoading(false);
      })
      .catch(() => { if (!isCancelled()) { setLoading(false); setHistoryError(true); } });
  };

  const firstTickApplied = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchHistoricalData(() => cancelled);
    return () => { cancelled = true; };
  }, [token, timeframe, reloadKey, theme]);

  // Update chart data & indicators
  const updateChartData = (candles: CandleData[]) => {
    if (!mainSeriesRef.current) return;

    if (chartType === 'Candlestick' || chartType === 'Bar') {
      mainSeriesRef.current.setData(candles as any);
    } else {
      const lineData = candles.map(c => ({ time: c.time, value: c.close }));
      mainSeriesRef.current.setData(lineData as any);
    }

    if (volumeSeriesRef.current && showVolume) {
      const volumeData = candles.map(c => ({
        time: c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      }));
      volumeSeriesRef.current.setData(volumeData as any);
    }

    // Render Technical Indicators
    renderIndicators(candles);
    renderMarkers();
  };

  // Render Technical Indicators Overlay & Sub-Panes
  const renderIndicators = (candles: CandleData[]) => {
    if (!chartRef.current) return;

    // Clear previous indicator series
    activeIndicatorSeriesMap.current.forEach((seriesList) => {
      seriesList.forEach(s => {
        try {
          chartRef.current?.removeSeries(s);
        } catch {
          // Ignore stale series
        }
      });
    });
    activeIndicatorSeriesMap.current.clear();

    indicators.filter(ind => ind.enabled).forEach(ind => {
      const seriesList: ISeriesApi<any>[] = [];

      if (ind.type === 'SMA') {
        const points = IndicatorEngine.calculateSMA(candles, ind.period || 20);
        const series = chartRef.current!.addLineSeries({ color: ind.color || '#3b82f6', lineWidth: 1 });
        series.setData(points as any);
        seriesList.push(series);
      } else if (ind.type === 'EMA') {
        const points = IndicatorEngine.calculateEMA(candles, ind.period || 9);
        const series = chartRef.current!.addLineSeries({ color: ind.color || '#10b981', lineWidth: 1 });
        series.setData(points as any);
        seriesList.push(series);
      } else if (ind.type === 'WMA') {
        const points = IndicatorEngine.calculateWMA(candles, ind.period || 14);
        const series = chartRef.current!.addLineSeries({ color: ind.color || '#f59e0b', lineWidth: 1 });
        series.setData(points as any);
        seriesList.push(series);
      } else if (ind.type === 'VWAP') {
        const points = IndicatorEngine.calculateVWAP(candles);
        const series = chartRef.current!.addLineSeries({ color: ind.color || '#eab308', lineWidth: 2, lineStyle: LineStyle.Dotted });
        series.setData(points as any);
        seriesList.push(series);
      } else if (ind.type === 'BOLLINGER') {
        const points = IndicatorEngine.calculateBollingerBands(candles, ind.period || 20, ind.stdDev || 2);
        const upperSeries = chartRef.current!.addLineSeries({ color: ind.color || '#8b5cf6', lineWidth: 1 });
        const lowerSeries = chartRef.current!.addLineSeries({ color: ind.color || '#8b5cf6', lineWidth: 1 });
        upperSeries.setData(points.map(p => ({ time: p.time, value: p.upper })) as any);
        lowerSeries.setData(points.map(p => ({ time: p.time, value: p.lower })) as any);
        seriesList.push(upperSeries, lowerSeries);
      }

      activeIndicatorSeriesMap.current.set(ind.id, seriesList);
    });
  };

  // Render Executed Order Markers & Open Position Lines
  const renderMarkers = () => {
    if (!mainSeriesRef.current) return;

    if (showTradeMarkers && orderMarkers.length > 0) {
      const markers = orderMarkers.map(m => ({
        time: m.time as any,
        position: m.side === 'BUY' ? 'belowBar' : 'aboveBar',
        color: m.side === 'BUY' ? '#10b981' : '#ef4444',
        shape: m.side === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: `${m.side === 'BUY' ? 'B' : 'S'} ${m.quantity}`,
      }));
      (mainSeriesRef.current as any).setMarkers(markers);
    } else {
      (mainSeriesRef.current as any).setMarkers([]);
    }

    if (positionMarkers.length > 0 && mainSeriesRef.current) {
      positionMarkers.forEach(p => {
        mainSeriesRef.current?.createPriceLine({
          price: p.averagePrice,
          color: p.side === 'LONG' ? '#10b981' : '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `POS ${p.side} ${p.quantity} @ ₹${p.averagePrice}`,
        });
      });
    }
  };

  useEffect(() => {
    renderMarkers();
  }, [showTradeMarkers, orderMarkers, positionMarkers]);
  useEffect(() => { renderIndicators(rawCandles); }, [indicators]);
  useEffect(() => { volumeSeriesRef.current?.applyOptions({ visible: showVolume }); }, [showVolume]);

  // Imperative Real-Time Tick Update via WebSocket (Bypasses React Re-renders per Tick)
  useEffect(() => {
    if (loading || !activeTick || !mainSeriesRef.current || !Number.isFinite(activeTick.ltp) || activeTick.ltp <= 0 || !Number.isFinite(activeTick.timestamp)) return;

    const intervalSec = timeframeSecondsMap[timeframe] || 300;
    const tickTimeSec = Math.floor((activeTick.timestamp || Date.now()) / 1000);

    let baseCandle = currentCandleRef.current ?? (rawCandles.length > 0 ? rawCandles[rawCandles.length - 1] : null);
    if (baseCandle && tickTimeSec < baseCandle.time) return;


    const { candle } = aggregateTickToCandle(baseCandle, activeTick.ltp, tickTimeSec, intervalSec);
    currentCandleRef.current = candle;

    if (chartType === 'Candlestick' || chartType === 'Bar') {
      mainSeriesRef.current.update(candle as any);
    } else {
      mainSeriesRef.current.update({ time: candle.time, value: candle.close } as any);
    }

    if (volumeSeriesRef.current && showVolume) {
      volumeSeriesRef.current.update({
        time: candle.time,
        value: candle.volume || 0,
        color: candle.close >= candle.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      } as any);
    }
  }, [activeTick, timeframe, loading]);

  return (
    <div className={`flex min-h-0 flex-col bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-2 sm:p-4 h-full shadow-sm ${isFullScreen ? 'fixed inset-0 z-[1100] rounded-none p-3' : ''}`}>
      {/* 1. CHART HEADER CONTROL TOOLBAR */}
      <div className="flex flex-col gap-1 pb-2 mb-1 border-b border-[var(--border-light)] overflow-hidden">
        {/* Symbol, Source Badge & Price Summary */}
        {showInstrumentHeader && <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-extrabold text-base sm:text-lg text-[var(--text-main)]">{symbol}</span>
            <span className="text-[10px] sm:text-xs bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)] px-1.5 py-0.5 rounded font-mono font-bold">{exchange}</span>
            <PriceBadge
              state={freshness.state}
              source={freshness.source}
              timeSinceLastTick={freshness.timeSinceLastTick}
              size="sm"
            />
          </div>

          {activeTick && (
            <div className="flex items-center gap-1.5 num-font">
              <span className="text-base sm:text-xl font-extrabold text-[var(--text-main)]">₹{activeTick.ltp.toFixed(2)}</span>
              <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${activeTick.change >= 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                {activeTick.change >= 0 ? '+' : ''}{activeTick.change.toFixed(2)} ({activeTick.changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>}

        <div aria-label="Chart timeframe" className="flex gap-1 overflow-x-auto scrollbar-none shrink-0">{(['1m', '3m', '5m', '15m', '30m', '1h', '1D'] as Timeframe[]).map(tf => <button type="button" key={tf} onClick={() => setTimeframe(tf)} aria-pressed={timeframe === tf} className={`min-h-11 min-w-11 shrink-0 rounded-lg px-2 text-xs font-semibold ${timeframe === tf ? 'bg-emerald-500/15 text-emerald-400' : 'text-[var(--text-muted)]'}`}>{tf}</button>)}</div>
        {/* Chart Controls & Indicator Selector (Scrollable Strip on Mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full [&_button]:min-h-11 [&_button]:shrink-0">
          <button type="button" onClick={() => chartRef.current?.timeScale().scrollToRealTime()} aria-label="Go to latest candle" className="px-3 text-xs font-semibold text-emerald-400">Latest</button>
          <button type="button" onClick={() => chartRef.current?.timeScale().fitContent()} aria-label="Fit chart to data" className="px-3 text-xs font-semibold">Fit</button>
          <button type="button" onClick={() => setReloadKey(key => key + 1)} aria-label="Reload chart history" className="px-3 text-xs"><RefreshCw size={16} /></button>
          <button type="button" aria-pressed={showVolume} onClick={() => setShowVolume(value => !value)} className="px-3 text-xs">Volume</button>
          <button type="button" onClick={() => {
            const input = window.prompt('Horizontal price level (₹)', activeTick?.ltp ? String(activeTick.ltp) : '');
            if (input === null) return;
            const price = Number(input);
            if (Number.isFinite(price) && price > 0 && mainSeriesRef.current) priceLevels.current.push(mainSeriesRef.current.createPriceLine({ price, color: '#f59e0b', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Level' }));
          }} className="px-3 text-xs whitespace-nowrap">Add level</button>
          <button type="button" onClick={() => { priceLevels.current.forEach(line => { try { mainSeriesRef.current?.removePriceLine(line); } catch {} }); priceLevels.current = []; }} className="px-3 text-xs whitespace-nowrap">Clear levels</button>
          {/* Indicator Toolbar */}
          <IndicatorToolbar
            indicators={indicators}
            onToggleIndicator={id => setIndicators(prev => prev.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i))}
            onAddIndicator={config => setIndicators(prev => [...prev, config])}
            onRemoveIndicator={id => setIndicators(prev => prev.filter(i => i.id !== id))}
          />

          {/* Trades Toggle Button */}
          <button
            onClick={() => setShowTradeMarkers(!showTradeMarkers)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
              showTradeMarkers
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
            }`}
            title="Toggle Executed Trade Markers on Chart"
          >
            Trades {showTradeMarkers && `(${orderMarkers.length})`}
          </button>

          {/* Chart Type Selector */}
          <div className="flex bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-1 rounded-xl gap-0.5 text-xs shrink-0">
            {(['Candlestick', 'Line', 'Area'] as ChartType[]).map(t => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all whitespace-nowrap ${chartType === t ? 'bg-[#00439D] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              >
                {t === 'Candlestick' ? 'Candles' : t}
              </button>
            ))}
          </div>


          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl transition-all shrink-0"
            title="Toggle Fullscreen Chart"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. CHART CANVAS CONTAINER */}
      <div className="relative flex-1 min-h-[240px] sm:min-h-[380px]" ref={containerRef}>
        {!loading && (historyError || rawCandles.length === 0) && <div role="status" className="pointer-events-none absolute inset-x-0 top-12 z-10 px-4 text-center text-xs text-[var(--text-muted)]">{historyError ? 'Chart history unavailable. Use Reload to retry.' : 'No historical candles available for this instrument.'}</div>}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-surface)]/80 z-10 text-[var(--text-muted)] text-sm font-semibold">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading Chart data...
          </div>
        )}
      </div>

      {(onBuyClick || onSellClick) && <div className="grid grid-cols-2 gap-2 py-2 shrink-0">{onBuyClick && <button type="button" disabled={!activeTick || activeTick.ltp <= 0} onClick={() => { if (activeTick && activeTick.ltp > 0) onBuyClick(symbol, activeTick.ltp); }} className="min-h-11 rounded-xl bg-emerald-500 text-xs font-bold text-white disabled:opacity-40">BUY</button>}{onSellClick && <button type="button" disabled={!activeTick || activeTick.ltp <= 0} onClick={() => { if (activeTick && activeTick.ltp > 0) onSellClick(symbol, activeTick.ltp); }} className="min-h-11 rounded-xl bg-rose-500 text-xs font-bold text-white disabled:opacity-40">SELL</button>}</div>}
      {/* 3. TRADINGVIEW ATTRIBUTION NOTICE */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-light)] font-semibold">
        <span>Powered by <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">TradingView Lightweight Charts™</a></span>
        <span className="num-font">TIMEZONE: Asia/Kolkata (IST)</span>
      </div>
    </div>
  );
};

