import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OptionChainItem, MarketTick } from '../types';
import { OrderPreviewModal, OrderPreviewDetails } from './OrderPreviewModal';
import { OptionStrategyBuilder } from './OptionStrategyBuilder';
import { Calendar, Search, Activity, Layers, ArrowUpRight, ArrowDownRight, X, SlidersHorizontal, ChevronDown, Plus, TrendingUp } from 'lucide-react';
import { useSubscribeTokens } from '../hooks/useMarketSocket';
import { useTickFreshness, useMultiTickFreshness } from '../hooks/useTickFreshness';
import { getSpotToken } from './SpotPriceTicker';
import { OptionChainRow } from './OptionChainRow';
import { OptionStrikeChartModal, SelectedOptionContract } from './OptionStrikeChartModal';
import { getLotSizeForSymbol } from '../utils/lotSize';
import { LivePriceCell } from './ui/LivePriceCell';

interface OptionChainProps {
  token?: string;
  ticks?: Map<string, MarketTick>;
  onRefreshWallet?: () => void;
  riskRestriction?: string | null;
}

export const OptionChainView: React.FC<OptionChainProps> = ({ token, onRefreshWallet, riskRestriction }) => {
  const [searchParams] = useSearchParams();
  // Optional deep-link (e.g. from the F&O hub's quick-access cards) — falls
  // back to the existing default when absent, so nothing changes for any
  // caller that doesn't pass it.
  const [symbol, setSymbol] = useState<string>(() => searchParams.get('symbol')?.toUpperCase() || 'SENSEX');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<string>('');
  const [expiryType, setExpiryType] = useState<'NEAREST' | 'NEXT' | 'MONTHLY' | 'ALL'>('NEAREST');
  const [strikeRange, setStrikeRange] = useState<'5' | '10' | '20' | 'ALL'>(() => {
    return (sessionStorage.getItem('tradegrow_oc_strikerange') as any) || '10';
  });
  const [viewMode, setViewMode] = useState<'LTP_OI' | 'GREEKS' | 'VOLUME'>(() => {
    return (sessionStorage.getItem('tradegrow_oc_viewmode') as any) || 'LTP_OI';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [basketMode, setBasketMode] = useState<boolean>(false);
  const [isStrategyBuilderOpen, setIsStrategyBuilderOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('tradegrow_oc_strikerange', strikeRange);
    } catch (_) {}
  }, [strikeRange]);

  useEffect(() => {
    try {
      sessionStorage.setItem('tradegrow_oc_viewmode', viewMode);
    } catch (_) {}
  }, [viewMode]);

  const [activeLtpKey, setActiveLtpKey] = useState<string | null>(null);

  const [chain, setChain] = useState<OptionChainItem[]>([]);
  const [spotPrice, setSpotPrice] = useState<number>(() => symbol.startsWith('SENSEX') ? 77350.00 : 24350.00);
  const [spotChange, setSpotChange] = useState<number>(() => symbol.startsWith('SENSEX') ? -392.36 : -64.15);
  const [spotChangePct, setSpotChangePct] = useState<number>(() => symbol.startsWith('SENSEX') ? -0.50 : -0.26);
  const [atmStrike, setAtmStrike] = useState<number>(() => symbol.startsWith('SENSEX') ? 77300 : 24350);
  const [lotSize, setLotSize] = useState<number>(() => getLotSizeForSymbol(symbol));
  const [pcrRatio, setPcrRatio] = useState<number>(1.0);
  const [maxPainStrike, setMaxPainStrike] = useState<number | null>(null);
  const [totalCallOI, setTotalCallOI] = useState<number>(0);
  const [totalPutOI, setTotalPutOI] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync default lot size on symbol switch
  useEffect(() => {
    setLotSize(getLotSizeForSymbol(symbol));
  }, [symbol]);

  // Strike Chart Modal State
  const [selectedChartContract, setSelectedChartContract] = useState<SelectedOptionContract | null>(null);
  const [isChartOpen, setIsChartOpen] = useState<boolean>(false);

  // Order Preview Modal State
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderPreviewDetails | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  // Close active LTP selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setActiveLtpKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Spot Token & Live Ticks
  const spotToken = getSpotToken(symbol);
  const spotFreshness = useTickFreshness(spotToken);
  const liveSpotLtp = spotFreshness.tick && spotFreshness.tick.ltp > 0 ? spotFreshness.tick.ltp : spotPrice;
  const liveSpotChange = spotFreshness.tick?.change !== undefined ? spotFreshness.tick.change : spotChange;
  const liveSpotChangePct = spotFreshness.tick?.changePercent !== undefined ? spotFreshness.tick.changePercent : spotChangePct;

  // Collect visible tokens from active option chain and keep major indices subscribed
  const visibleTokens = useMemo(() => {
    const tokens = new Set<string>(['NSE_NIFTY50', 'BSE_SENSEX', 'NSE_BANKNIFTY', 'NSE_FINNIFTY', spotToken]);
    chain.forEach(row => {
      if (row.ce?.instrumentToken) tokens.add(row.ce.instrumentToken);
      if (row.pe?.instrumentToken) tokens.add(row.pe.instrumentToken);
    });
    return Array.from(tokens);
  }, [spotToken, chain]);

  useSubscribeTokens(visibleTokens);
  const freshnessMap = useMultiTickFreshness(visibleTokens);

  // Dynamic ATM Strike Recalculation from WebSocket Ticks
  useEffect(() => {
    if (chain.length === 0) return;
    let closestStrike = chain[0].strikePrice;
    let minDiff = Math.abs(chain[0].strikePrice - liveSpotLtp);

    chain.forEach(item => {
      const diff = Math.abs(item.strikePrice - liveSpotLtp);
      if (diff < minDiff) {
        minDiff = diff;
        closestStrike = item.strikePrice;
      }
    });

    setAtmStrike(closestStrike);
  }, [liveSpotLtp, chain]);

  // Fetch Expiries
  const fetchExpiries = useCallback(() => {
    fetch(`/api/v1/market/option-expiries?symbol=${symbol}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.expiries) && data.expiries.length > 0) {
          setExpiries(data.expiries);
          if (expiryType === 'NEAREST' && data.nearestExpiry) {
            setExpiry(data.nearestExpiry);
          } else if (expiryType === 'NEXT' && data.nextExpiry) {
            setExpiry(data.nextExpiry);
          } else if (expiryType === 'MONTHLY' && data.monthlyExpiry) {
            setExpiry(data.monthlyExpiry);
          } else if (!data.expiries.includes(expiry)) {
            setExpiry(data.expiries[0]);
          }
        }
      })
      .catch(() => {});
  }, [symbol, expiryType, expiry]);

  useEffect(() => {
    fetchExpiries();
  }, [symbol, expiryType]);

  // Fetch Option Chain Data
  const fetchOptionChain = useCallback(() => {
    const queryParams = new URLSearchParams({ symbol, strikeRange });
    if (expiry) queryParams.append('expiry', expiry);

    fetch(`/api/v1/market/option-chain?${queryParams.toString()}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setChain(data.chain || []);
          setSpotPrice(data.spotPrice || 24331.70);
          setLotSize(data.lotSize || 65);
          if (typeof data.pcrRatio === 'number') setPcrRatio(data.pcrRatio);
          if (typeof data.maxPainStrike === 'number') setMaxPainStrike(data.maxPainStrike);
          if (typeof data.totalCallOI === 'number') setTotalCallOI(data.totalCallOI);
          if (typeof data.totalPutOI === 'number') setTotalPutOI(data.totalPutOI);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol, expiry, strikeRange]);

  const computedOI = useMemo(() => {
    let callOI = totalCallOI;
    let putOI = totalPutOI;
    if (callOI === 0 && putOI === 0 && chain.length > 0) {
      chain.forEach(row => {
        callOI += (row.ce?.openInterest || 0);
        putOI += (row.pe?.openInterest || 0);
      });
    }
    const total = callOI + putOI;
    const pcr = callOI > 0 ? Number((putOI / callOI).toFixed(2)) : pcrRatio || 1.0;
    const callPct = total > 0 ? Math.round((callOI / total) * 100) : 50;
    const putPct = total > 0 ? 100 - callPct : 50;
    const sentiment = pcr > 1.2 ? 'Bullish' : pcr < 0.8 ? 'Bearish' : 'Neutral';
    const sentimentColor = pcr > 1.2
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : pcr < 0.8
      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
      : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return { callOI, putOI, total, pcr, callPct, putPct, sentiment, sentimentColor };
  }, [chain, totalCallOI, totalPutOI, pcrRatio]);

  // Load option chain on symbol/expiry/strikeRange change and refresh structure periodically (12s)
  // Live LTP, Greeks, and ATM calculations stream continuously at zero latency via WebSocket ticks above.
  useEffect(() => {
    fetchOptionChain();
    const interval = setInterval(fetchOptionChain, 12000);
    return () => clearInterval(interval);
  }, [fetchOptionChain]);

  // Handle Order Placement Trigger
  const handleOpenOrder = (
    optionToken: string,
    strike: number,
    optionType: 'CE' | 'PE',
    ltp: number,
    side: 'BUY' | 'SELL'
  ) => {
    const formattedToken = optionToken || `${symbol}${expiry}${strike}${optionType}`;
    const displaySymbol = `${symbol} ${strike} ${optionType}`;

    setSelectedOrderDetails({
      token: formattedToken,
      symbol: displaySymbol,
      underlying: symbol,
      exchange: symbol.startsWith('SENSEX') || symbol.startsWith('BANKEX') ? 'BSE' : 'NSE',
      expiry: expiry || new Date().toISOString().slice(0, 10),
      strike,
      optionType,
      side,
      lots: 1,
      lotSize,
      quantity: lotSize,
      price: ltp,
      orderType: 'MARKET',
      productType: 'MIS'
    });
    setIsPreviewOpen(true);
  };

  const handleConfirmOrder = async (details: OrderPreviewDetails) => {
    setActionMessage({
      type: 'success',
      text: `Order Placed: ${details.side} ${details.lots} Lot(s) ${details.symbol} @ ₹${details.price.toFixed(2)}`
    });
    if (onRefreshWallet) onRefreshWallet();
    setIsPreviewOpen(false);
  };

  // Filter chain by search query
  const filteredChain = useMemo(() => {
    if (!searchQuery.trim()) return chain;
    return chain.filter(row => row.strikePrice.toString().includes(searchQuery.trim()));
  }, [chain, searchQuery]);

  return (
    <div className="flex flex-col gap-3 p-2 md:p-5 max-w-7xl mx-auto font-sans select-none text-[var(--text-main)] touch-action-manipulation">
      
      {/* ── TOP HEADER (Matching Reference Images 1 & 2) ──────────────── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-3.5 rounded-2xl shadow-xl flex flex-col gap-3 backdrop-blur-xl">
        
        {/* Row 1: Index Badges & Spot Price Cards */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Index Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'NIFTY', name: 'NIFTY 50', ex: 'NSE', token: 'NSE_NIFTY50', price: 24331.70, chg: -64.15, chgPct: -0.26 },
              { id: 'SENSEX', name: 'BSE SENSEX', ex: 'BSE', token: 'BSE_SENSEX', price: 73600.00, chg: -292.36, chgPct: -0.37 },
              { id: 'BANKNIFTY', name: 'BANK NIFTY', ex: 'NSE', token: 'NSE_BANKNIFTY', price: 57600.00, chg: +120.40, chgPct: +0.21 },
              { id: 'FINNIFTY', name: 'FIN NIFTY', ex: 'NSE', token: 'NSE_FINNIFTY', price: 25800.00, chg: +45.10, chgPct: +0.18 },
            ].map(item => {
              const isActive = symbol === item.id;
              const indexTick = spotFreshness.tick && isActive ? spotFreshness.tick : (freshnessMap.get(item.token)?.tick);
              const displayPrice = isActive ? liveSpotLtp : (indexTick?.ltp && indexTick.ltp > 0 ? indexTick.ltp : item.price);
              const displayChgPct = isActive ? liveSpotChangePct : (indexTick?.changePercent !== undefined ? indexTick.changePercent : item.chgPct);
              const isPos = displayChgPct >= 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigator.vibrate?.(20);
                    setSymbol(item.id);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer min-h-[44px] border ${
                    isActive
                      ? 'bg-[var(--bg-surface-inset)] text-[var(--text-main)] border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500'
                      : 'bg-[var(--bg-surface-inset)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--border-color)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1 font-extrabold tracking-tight">
                      <span>{item.name}</span>
                      <span className="text-[9px] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] px-1 rounded">{item.ex}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                      <LivePriceCell
                        value={displayPrice}
                        prefix="₹"
                        decimals={2}
                        className="!text-[11px] !font-bold !text-[var(--text-main)] !p-0 !bg-transparent"
                      />
                      <span className={`flex items-center text-[10px] font-semibold ${isPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                        {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {isPos ? '+' : ''}{displayChgPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Header Action Items */}
          <div className="flex items-center gap-3">
            
            {/* Basket Mode Toggle */}
            <div className="flex items-center gap-2 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-3 py-2 rounded-xl">
              <Layers className="w-4 h-4 text-[var(--call-accent)]" />
              <span className="text-xs font-semibold text-[var(--text-main)] hidden sm:inline">Basket mode</span>
              <button
                type="button"
                onClick={() => setBasketMode(!basketMode)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  basketMode ? 'bg-blue-600' : 'bg-[var(--bg-surface-elevated)]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${basketMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Strategy Builder Button */}
            <button
              type="button"
              onClick={() => setIsStrategyBuilderOpen(!isStrategyBuilderOpen)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md cursor-pointer active:scale-95 transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE STRATEGY</span>
            </button>

          </div>

        </div>

        {/* Row 2: Expiry, Search, Stat Badges, Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs border-t border-[var(--border-color)]">
          
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Expiry Selector */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[var(--call-accent)]" />
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="px-3 py-2 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-xl font-bold text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
              >
                {expiries.map(exp => (
                  <option key={exp} value={exp}>{exp} W</option>
                ))}
              </select>
            </div>

            {/* Search Strike Box */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Strike"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-xl text-xs font-semibold text-[var(--text-main)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500 min-h-[44px] w-32 sm:w-40"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* ATM IV Stat Badge */}
            <div className="hidden sm:flex items-center gap-1 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-3 py-2 rounded-xl text-[var(--text-muted)] font-mono">
              <span>ATM IV</span>
              <span className="text-[var(--text-main)] font-bold">9.71</span>
            </div>

            {/* Dynamic PCR & Sentiment Badge */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-2.5 py-1.5 rounded-xl font-mono text-xs">
              <span className="text-[var(--text-muted)]">PCR:</span>
              <span className="font-bold text-[var(--text-main)]">{computedOI.pcr.toFixed(2)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${computedOI.sentimentColor}`}>
                {computedOI.sentiment}
              </span>
            </div>

            {/* Max Pain Strike */}
            <div className="hidden md:flex items-center gap-1.5 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-2.5 py-1.5 rounded-xl font-mono text-xs">
              <span className="text-[var(--text-muted)]">Max Pain:</span>
              <span className="font-bold text-amber-400">
                ₹{(maxPainStrike || atmStrike).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Total Call OI vs Put OI Sentiment Bar */}
            <div className="hidden lg:flex items-center gap-2 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl text-[11px] font-mono">
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] gap-3">
                  <span className="text-emerald-400 font-semibold">CE {computedOI.callPct}%</span>
                  <span className="text-rose-400 font-semibold">PE {computedOI.putPct}%</span>
                </div>
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div style={{ width: `${computedOI.callPct}%` }} className="bg-emerald-500 h-full transition-all duration-300" />
                  <div style={{ width: `${computedOI.putPct}%` }} className="bg-rose-500 h-full transition-all duration-300" />
                </div>
              </div>
            </div>
          </div>

          {/* Controls Right Group: Strike Range & View Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Strike Range Selector */}
            <div className="flex items-center bg-[var(--bg-surface-inset)] border border-[var(--border-color)] p-1 rounded-xl">
              {[
                { key: '5', label: '±5 Strikes' },
                { key: '10', label: '±10' },
                { key: '20', label: '±20' },
                { key: 'ALL', label: 'All' }
              ].map(r => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setStrikeRange(r.key as any)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    strikeRange === r.key
                      ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-color)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                  title={`Show ${r.label}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Mode Switcher Tabs (LTP & OI / Greeks / Volume) */}
            <div className="flex items-center bg-[var(--bg-surface-inset)] border border-[var(--border-color)] p-1 rounded-xl">
              {[
                { key: 'LTP_OI', label: 'LTP & OI' },
                { key: 'GREEKS', label: 'Greeks' },
                { key: 'VOLUME', label: 'Volume' }
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setViewMode(m.key as any)}
                  className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
                    viewMode === m.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {actionMessage && (
        <div className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between ${
          actionMessage.type === 'success' ? 'bg-[var(--gain-light)] text-[var(--gain)] border-[var(--gain)]/30' : 'bg-[var(--loss-light)] text-[var(--loss)] border-[var(--loss)]/30'
        }`}>
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)} aria-label="Dismiss message" className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Strategy Builder Drawer (If Open) */}
      {isStrategyBuilderOpen && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-400" /> Option Strategy Builder
            </h3>
            <button type="button" onClick={() => setIsStrategyBuilderOpen(false)} aria-label="Close strategy builder" className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="pt-3">
            <OptionStrategyBuilder token={token || ''} onOrderExecuted={() => setIsStrategyBuilderOpen(false)} initialUnderlying={symbol} />
          </div>
        </div>
      )}

      {/* ── MAIN OPTION CHAIN TABLE ─────────────────────────────────── */}
      <div ref={tableRef} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          
          {/* DESKTOP TABLE VIEW */}
          <table className="w-full text-xs text-center border-collapse num-font tabular-nums hidden lg:table">
            <thead>
              {/* Category Header */}
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-inset)] font-extrabold text-[var(--text-main)]">
                <th colSpan={viewMode === 'GREEKS' ? 3 : 4} className="py-2.5 px-3 text-[var(--call-accent)] text-left border-r border-[var(--border-color)] tracking-wider">
                  CALLS
                </th>
                <th className="py-2.5 px-4 text-amber-600 dark:text-amber-400 border-r border-[var(--border-color)] bg-[var(--bg-surface)] tracking-wider">
                  STRIKE
                </th>
                <th colSpan={viewMode === 'GREEKS' ? 3 : 4} className="py-2.5 px-3 text-[var(--put-accent)] text-right tracking-wider">
                  PUTS
                </th>
              </tr>

              {/* Specific Columns Header */}
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-inset)] text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                {viewMode === 'GREEKS' ? (
                  <>
                    <th className="py-2.5 px-3 text-left">Delta</th>
                    <th className="py-2.5 px-3 text-left">IV</th>
                    <th className="py-2.5 px-3 text-right text-[var(--call-accent)] font-extrabold border-r border-[var(--border-color)]">LTP</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-left">Volume</th>
                    <th className="py-2.5 px-3 text-left">OI Change</th>
                    <th className="py-2.5 px-3 text-left">OI</th>
                    <th className="py-2.5 px-3 text-right text-[var(--call-accent)] font-extrabold border-r border-[var(--border-color)]">LTP</th>
                  </>
                )}

                <th className="py-2.5 px-4 bg-[var(--bg-surface)] text-[var(--text-main)] font-extrabold border-r border-[var(--border-color)]">Strike Price</th>

                {viewMode === 'GREEKS' ? (
                  <>
                    <th className="py-2.5 px-3 text-left text-[var(--put-accent)] font-extrabold">LTP</th>
                    <th className="py-2.5 px-3 text-right">IV</th>
                    <th className="py-2.5 px-3 text-right">Delta</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-left text-[var(--put-accent)] font-extrabold">LTP</th>
                    <th className="py-2.5 px-3 text-right">OI</th>
                    <th className="py-2.5 px-3 text-right">OI Change</th>
                    <th className="py-2.5 px-3 text-right">Volume</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredChain.map((row, idx) => {
                const isAtm = row.strikePrice === atmStrike;
                const ceTick = freshnessMap.get(row.ce?.instrumentToken || '');
                const peTick = freshnessMap.get(row.pe?.instrumentToken || '');

                const nextRow = filteredChain[idx + 1];
                const showSpotLine = spotPrice >= row.strikePrice && nextRow && spotPrice < nextRow.strikePrice;

                return (
                  <React.Fragment key={row.strikePrice}>
                    <OptionChainRow
                      row={row}
                      isAtm={isAtm}
                      spotPrice={liveSpotLtp}
                      viewMode={viewMode}
                      ceTick={ceTick?.tick}
                      peTick={peTick?.tick}
                      activeLtpKey={activeLtpKey}
                      onSelectLtp={setActiveLtpKey}
                      onOpenOrder={handleOpenOrder}
                      onOpenChart={(contract) => {
                        setSelectedChartContract(contract);
                        setIsChartOpen(true);
                      }}
                      underlying={symbol}
                      expiry={expiry}
                      lotSize={lotSize}
                      exchange={symbol.startsWith('SENSEX') || symbol.startsWith('BANKEX') ? 'BSE' : 'NSE'}
                      isMobile={false}
                    />

                    {/* Spot Price Line Indicator Row (Matching Image 1) */}
                    {showSpotLine && (
                      <tr className="bg-rose-500/10 border-y-2 border-rose-500 font-bold">
                        <td colSpan={viewMode === 'GREEKS' ? 7 : 9} className="py-1 px-2">
                          <div className="flex items-center justify-center gap-2 text-rose-400 font-mono text-xs">
                            <div className="h-px bg-rose-500/40 flex-1" />
                            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-black tracking-wider shadow-sm">
                              {liveSpotLtp.toFixed(2)}
                            </span>
                            <div className="h-px bg-rose-500/40 flex-1" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* MOBILE COMPACT TABLE VIEW (Matching Image 2) */}
          <table className="w-full text-xs text-center border-collapse num-font tabular-nums lg:hidden">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-inset)] text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                <th className="py-2 px-2 text-left">Volume</th>
                <th className="py-2 px-2 text-center text-[var(--call-accent)] font-black">Call LTP</th>
                <th className="py-2 px-2 text-center bg-[var(--bg-surface)] text-[var(--text-main)] font-black border-x border-[var(--border-color)]">Strike Price</th>
                <th className="py-2 px-2 text-center text-[var(--put-accent)] font-black">Put LTP</th>
                <th className="py-2 px-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredChain.map((row, idx) => {
                const isAtm = row.strikePrice === atmStrike;
                const ceTick = freshnessMap.get(row.ce?.instrumentToken || '');
                const peTick = freshnessMap.get(row.pe?.instrumentToken || '');

                const nextRow = filteredChain[idx + 1];
                const showSpotLine = spotPrice >= row.strikePrice && nextRow && spotPrice < nextRow.strikePrice;

                return (
                  <React.Fragment key={row.strikePrice}>
                    <OptionChainRow
                      row={row}
                      isAtm={isAtm}
                      spotPrice={liveSpotLtp}
                      viewMode={viewMode}
                      ceTick={ceTick?.tick}
                      peTick={peTick?.tick}
                      activeLtpKey={activeLtpKey}
                      onSelectLtp={setActiveLtpKey}
                      onOpenOrder={handleOpenOrder}
                      onOpenChart={(contract) => {
                        setSelectedChartContract(contract);
                        setIsChartOpen(true);
                      }}
                      underlying={symbol}
                      expiry={expiry}
                      lotSize={lotSize}
                      exchange={symbol.startsWith('SENSEX') || symbol.startsWith('BANKEX') ? 'BSE' : 'NSE'}
                      isMobile={true}
                    />

                    {/* Mobile Spot Price Indicator Row (Matching Image 2) */}
                    {showSpotLine && (
                      <tr className="bg-[var(--bg-surface-inset)] border-y-2 border-rose-500 font-bold">
                        <td colSpan={5} className="py-1.5 px-2">
                          <div className="flex items-center justify-center gap-2 text-rose-400 font-mono text-xs">
                            <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Long Buildup |</span>
                            <span className="text-rose-400 font-bold">{liveSpotLtp.toFixed(2)}</span>
                            <span className="text-[10px] text-rose-500">{liveSpotChangePct.toFixed(2)}%</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

        </div>
      </div>

      {/* Real-Time Option Strike Price Chart Modal */}
      <OptionStrikeChartModal
        isOpen={isChartOpen}
        onClose={() => setIsChartOpen(false)}
        contract={selectedChartContract}
        onSwitchContract={setSelectedChartContract}
        onOpenOrderModal={(side, price) => {
          if (!selectedChartContract) return;
          setIsChartOpen(false);
          handleOpenOrder(
            selectedChartContract.instrumentToken,
            selectedChartContract.strike,
            selectedChartContract.optionType,
            price,
            side
          );
        }}
      />

      {/* Order Preview & Execution Modal */}
      <OrderPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={handleConfirmOrder}
        details={selectedOrderDetails}
        userToken={token || localStorage.getItem('token') || ''}
        riskRestriction={riskRestriction}
      />

    </div>
  );
};
