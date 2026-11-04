import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OptionChainItem, MarketTick } from '../types';
import { OrderPreviewModal, OrderPreviewDetails } from './OrderPreviewModal';
import { OptionStrategyBuilder } from './OptionStrategyBuilder';
import { Calendar, Search, Activity, Layers, ArrowUpRight, ArrowDownRight, X, SlidersHorizontal, ChevronDown, Plus, TrendingUp, LayoutGrid, Table2 } from 'lucide-react';
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
  const [mobileDisplayMode, setMobileDisplayMode] = useState<'CARDS' | 'TABLE'>(() => {
    return (sessionStorage.getItem('tradegrow_oc_mobile_mode') as any) || 'CARDS';
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

  useEffect(() => {
    try {
      sessionStorage.setItem('tradegrow_oc_mobile_mode', mobileDisplayMode);
    } catch (_) {}
  }, [mobileDisplayMode]);

  const [activeLtpKey, setActiveLtpKey] = useState<string | null>(null);

  const INDEX_FALLBACKS: Record<string, { price: number; change: number; pct: number; atm: number }> = useMemo(() => ({
    SENSEX: { price: 72200.00, change: -440.00, pct: -0.61, atm: 72200 },
    NIFTY: { price: 24600.00, change: -64.15, pct: -0.26, atm: 24600 },
    BANKNIFTY: { price: 52150.00, change: 120.00, pct: 0.23, atm: 52100 },
    FINNIFTY: { price: 23900.00, change: 15.00, pct: 0.06, atm: 23900 },
    MIDCPNIFTY: { price: 12800.00, change: 30.00, pct: 0.23, atm: 12800 },
  }), []);

  const cleanSym = symbol.toUpperCase().replace(/^(NSE_|BSE_)/, '');
  const initialFallback = INDEX_FALLBACKS[cleanSym] || INDEX_FALLBACKS.SENSEX;

  const [chain, setChain] = useState<OptionChainItem[]>([]);
  const [spotPrice, setSpotPrice] = useState<number>(() => initialFallback.price);
  const [spotChange, setSpotChange] = useState<number>(() => initialFallback.change);
  const [spotChangePct, setSpotChangePct] = useState<number>(() => initialFallback.pct);
  const [atmStrike, setAtmStrike] = useState<number>(() => initialFallback.atm);
  const [lotSize, setLotSize] = useState<number>(() => getLotSizeForSymbol(symbol));
  const [pcrRatio, setPcrRatio] = useState<number>(1.0);
  const [maxPainStrike, setMaxPainStrike] = useState<number | null>(null);
  const [totalCallOI, setTotalCallOI] = useState<number>(0);
  const [totalPutOI, setTotalPutOI] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync state on symbol switch
  useEffect(() => {
    const sym = symbol.toUpperCase().replace(/^(NSE_|BSE_)/, '');
    const fallback = INDEX_FALLBACKS[sym] || INDEX_FALLBACKS.NIFTY;
    setLotSize(getLotSizeForSymbol(symbol));
    setSpotPrice(fallback.price);
    setSpotChange(fallback.change);
    setSpotChangePct(fallback.pct);
    setAtmStrike(fallback.atm);
    setChain([]);
    setLoading(true);
  }, [symbol, INDEX_FALLBACKS]);

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
    if (chain.length === 0 || !liveSpotLtp || liveSpotLtp <= 0) return;

    // Guard against cross-symbol race conditions
    const minStrike = chain[0].strikePrice;
    const maxStrike = chain[chain.length - 1].strikePrice;
    if (liveSpotLtp < minStrike * 0.7 || liveSpotLtp > maxStrike * 1.3) return;

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

  // Apply option chain data payload
  const applyOptionChainData = useCallback((data: any) => {
    if (data.success) {
      setChain(data.chain || []);
      if (data.spotPrice && data.spotPrice > 0) {
        setSpotPrice(data.spotPrice);
      }
      if (typeof data.spotChange === 'number') {
        setSpotChange(data.spotChange);
      }
      if (typeof data.spotChangePercent === 'number') {
        setSpotChangePct(data.spotChangePercent);
      }
      if (data.atmStrike && data.atmStrike > 0) {
        setAtmStrike(data.atmStrike);
      }
      setLotSize(data.lotSize || getLotSizeForSymbol(symbol));
      if (typeof data.pcrRatio === 'number') setPcrRatio(data.pcrRatio);
      if (typeof data.maxPainStrike === 'number') setMaxPainStrike(data.maxPainStrike);
      if (typeof data.totalCallOI === 'number') setTotalCallOI(data.totalCallOI);
      if (typeof data.totalPutOI === 'number') setTotalPutOI(data.totalPutOI);
    }
    setLoading(false);
  }, [symbol]);

  // Fetch Option Chain Data
  const fetchOptionChain = useCallback(() => {
    const queryParams = new URLSearchParams({ symbol, strikeRange });
    if (expiry) queryParams.append('expiry', expiry);

    fetch(`/api/v1/market/option-chain?${queryParams.toString()}`)
      .then(r => r.json())
      .then(data => applyOptionChainData(data))
      .catch(() => setLoading(false));
  }, [symbol, expiry, strikeRange, applyOptionChainData]);

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

  // Load option chain and stream real-time updates via SSE (1.5s push) with 2s polling fallback
  useEffect(() => {
    fetchOptionChain();

    // 1. Server-Sent Events (SSE) Stream for real-time live streaming (~1500ms server push)
    let eventSource: EventSource | null = null;
    let sseActive = false;

    try {
      const queryParams = new URLSearchParams({ symbol, strikeRange });
      if (expiry) queryParams.append('expiry', expiry);
      const streamUrl = `/api/v1/market/option-chain/stream?${queryParams.toString()}`;

      eventSource = new EventSource(streamUrl);
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.success) {
            sseActive = true;
            applyOptionChainData(parsed);
          }
        } catch (_) {}
      };

      eventSource.onerror = () => {
        sseActive = false;
        try { eventSource?.close(); } catch (_) {}
      };
    } catch (_) {
      sseActive = false;
    }

    // 2. High-speed fallback polling (2000ms) ensuring continuous updates even if SSE is interrupted
    const interval = setInterval(() => {
      if (!sseActive) {
        fetchOptionChain();
      }
    }, 2000);

    // 3. Instant refresh on tab focus / document visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchOptionChain();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (eventSource) {
        eventSource.onmessage = null;
        eventSource.onerror = null;
        eventSource.close();
      }
    };
  }, [symbol, expiry, strikeRange, fetchOptionChain, applyOptionChainData]);

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
          
          {/* Index Tabs — Horizontal scroll strip on mobile for zero vertical waste */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5 w-full md:w-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            {[
              { id: 'NIFTY', name: 'NIFTY 50', ex: 'NSE', token: 'NSE_NIFTY50' },
              { id: 'SENSEX', name: 'BSE SENSEX', ex: 'BSE', token: 'BSE_SENSEX' },
              { id: 'BANKNIFTY', name: 'BANK NIFTY', ex: 'NSE', token: 'NSE_BANKNIFTY' },
              { id: 'FINNIFTY', name: 'FIN NIFTY', ex: 'NSE', token: 'NSE_FINNIFTY' },
            ].map(item => {
              const isActive = symbol === item.id;
              const indexTick = spotFreshness.tick && isActive ? spotFreshness.tick : (freshnessMap.get(item.token)?.tick);
              const displayPrice = isActive ? liveSpotLtp : (indexTick?.ltp && indexTick.ltp > 0 ? indexTick.ltp : 0);
              const displayChgPct = isActive ? liveSpotChangePct : (indexTick?.changePercent !== undefined ? indexTick.changePercent : 0);
              const isPos = displayChgPct >= 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigator.vibrate?.(20);
                    setSymbol(item.id);
                  }}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-xs transition-all cursor-pointer min-h-[34px] sm:min-h-[44px] flex-shrink-0 border ${
                    isActive
                      ? 'bg-[var(--bg-surface-inset)] text-[var(--text-main)] border-blue-500 shadow-xs ring-1 ring-blue-500/50'
                      : 'bg-[var(--bg-surface-inset)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--border-color)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <div className="flex flex-col items-start leading-tight">
                    <div className="flex items-center gap-1 font-bold tracking-tight text-[11px] sm:text-xs">
                      <span>{item.name}</span>
                      <span className="text-[8px] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] px-1 rounded">{item.ex}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px] tabular-nums mt-0.5">
                      {displayPrice > 0 ? (
                        <>
                          <LivePriceCell
                            value={displayPrice}
                            prefix="₹"
                            decimals={2}
                            className="!text-[10px] sm:!text-[11px] !font-bold !text-[var(--text-main)] !p-0 !bg-transparent"
                          />
                          <span className={`flex items-center text-[9px] sm:text-[10px] font-semibold ${isPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                            {isPos ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                            {isPos ? '+' : ''}{displayChgPct.toFixed(2)}%
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono animate-pulse">--</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Header Action Items */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full md:w-auto">
            
            {/* Basket Mode Toggle */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-2.5 py-1 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl min-h-[34px] sm:min-h-[44px]">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--call-accent)]" />
              <span className="text-[11px] sm:text-xs font-semibold text-[var(--text-main)] hidden sm:inline">Basket</span>
              <button
                type="button"
                onClick={() => setBasketMode(!basketMode)}
                className={`w-8 h-4.5 sm:w-9 sm:h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  basketMode ? 'bg-blue-600' : 'bg-[var(--bg-surface-elevated)]'
                }`}
              >
                <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-white transition-transform ${basketMode ? 'translate-x-3.5 sm:translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Strategy Builder Button */}
            <button
              type="button"
              onClick={() => setIsStrategyBuilderOpen(!isStrategyBuilderOpen)}
              className="flex items-center gap-1 sm:gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] sm:text-xs px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 rounded-lg sm:rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all min-h-[34px] sm:min-h-[44px]"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>CREATE STRATEGY</span>
            </button>

          </div>

        </div>

        {/* Row 2: Expiry, Search, Stat Badges, Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs border-t border-[var(--border-color)]">
          
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Expiry Selector */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--call-accent)] flex-shrink-0" />
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="px-2 sm:px-3 py-1 sm:py-2 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-lg sm:rounded-xl font-bold text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 cursor-pointer min-h-[34px] sm:min-h-[44px]"
              >
                {expiries.map(exp => (
                  <option key={exp} value={exp}>{exp} W</option>
                ))}
              </select>
            </div>

            {/* Search Strike Box */}
            <div className="relative flex items-center">
              <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--text-muted)] absolute left-2.5 sm:left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Strike"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 sm:pl-8 pr-2.5 sm:pr-3 py-1 sm:py-2 bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-lg sm:rounded-xl text-xs font-semibold text-[var(--text-main)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500 min-h-[34px] sm:min-h-[44px] w-28 sm:w-40"
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
                const effectiveSpot = liveSpotLtp > 0 ? liveSpotLtp : spotPrice;
                const showSpotLine = effectiveSpot >= row.strikePrice && nextRow && effectiveSpot < nextRow.strikePrice;

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

          {/* MOBILE 5-COLUMN TABLE VIEW (Matching Image 1: media_1793704866714_dcd9f00d.jpg) */}
          <table className="w-full text-xs text-center border-collapse num-font tabular-nums lg:hidden">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-inset)] text-[11px] text-[var(--text-muted)] font-black uppercase tracking-wider">
                <th className="py-2.5 px-2 text-left">Volume</th>
                <th className="py-2.5 px-2 text-center text-emerald-600 dark:text-emerald-400 font-black">Call LTP</th>
                <th className="py-2.5 px-2 text-center bg-[var(--bg-surface)] text-[var(--text-main)] font-black border-x border-[var(--border-color)]">Strike Price</th>
                <th className="py-2.5 px-2 text-center text-rose-600 dark:text-rose-400 font-black">Put LTP</th>
                <th className="py-2.5 px-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredChain.map((row, idx) => {
                const isAtm = row.strikePrice === atmStrike;
                const ceTick = freshnessMap.get(row.ce?.instrumentToken || '');
                const peTick = freshnessMap.get(row.pe?.instrumentToken || '');

                const nextRow = filteredChain[idx + 1];
                const effectiveSpot = liveSpotLtp > 0 ? liveSpotLtp : spotPrice;
                const showSpotLine = effectiveSpot >= row.strikePrice && nextRow && effectiveSpot < nextRow.strikePrice;

                return (
                  <React.Fragment key={row.strikePrice}>
                    <OptionChainRow
                      row={row}
                      isAtm={isAtm}
                      spotPrice={effectiveSpot}
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

                    {/* Mobile Spot Price Indicator Row (Matching Image 1) */}
                    {showSpotLine && (
                      <tr className="bg-[var(--bg-surface-inset)] border-y border-emerald-500/40 font-bold">
                        <td colSpan={5} className="py-2 px-2">
                          <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                            <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Short Covering |</span>
                            <span className="font-extrabold">{effectiveSpot.toFixed(2)}</span>
                            <span className={`text-[10px] font-bold ${liveSpotChangePct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {liveSpotChangePct >= 0 ? '▲ +' : '▼ '}{Math.abs(liveSpotChange).toFixed(2)} ({liveSpotChangePct.toFixed(2)}%)
                            </span>
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
