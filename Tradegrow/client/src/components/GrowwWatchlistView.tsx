import React, { useState, useEffect, useMemo } from 'react';
import { MarketTick } from '../types';
import {
  Search, Plus, Trash2, ArrowUp, ArrowDown, Bookmark, X,
  GripVertical, Eye, Bell, TrendingUp, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import { useMultiTickFreshness } from '../hooks/useTickFreshness';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';
import { Card, Badge, Button, MiniSparkline, LivePriceCell } from './ui';
import { getLotSizeForSymbol } from '../utils/lotSize';

interface WatchlistItem {
  token: string;
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE' | 'MCX' | 'NFO';
  category: 'STOCKS' | 'INDICES' | 'COMMODITIES' | 'FO';
  lotSize: number;
}

const PRESET_WATCHLISTS: Record<string, WatchlistItem[]> = {
  WL_1: [
    { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', name: 'NIFTY 50 Index', exchange: 'NSE', category: 'INDICES', lotSize: 65 },
    { token: 'BSE_SENSEX', symbol: 'SENSEX', name: 'BSE SENSEX Index', exchange: 'BSE', category: 'INDICES', lotSize: 20 },
    { token: 'NSE_RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', exchange: 'NSE', category: 'STOCKS', lotSize: 250 },
    { token: 'NSE_TCS', symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', category: 'STOCKS', lotSize: 175 },
    { token: 'NSE_INFY', symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 400 },
    { token: 'NSE_HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 550 },
    { token: 'NSE_ICICIBANK', symbol: 'ICICIBANK', name: 'ICICI Bank Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 700 },
    { token: 'NSE_TATAMOTORS', symbol: 'TATAMOTORS', name: 'Tata Motors Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 1000 },
  ],
  WL_2: [
    { token: 'NSE_NIFTY24850CE', symbol: 'NIFTY 24850 CE', name: 'NIFTY Weekly Call Option', exchange: 'NFO', category: 'FO', lotSize: 65 },
    { token: 'NSE_NIFTY24800PE', symbol: 'NIFTY 24800 PE', name: 'NIFTY Weekly Put Option', exchange: 'NFO', category: 'FO', lotSize: 65 },
    { token: 'NSE_BANKNIFTY52000CE', symbol: 'BANKNIFTY 52000 CE', name: 'BANKNIFTY Weekly Call Option', exchange: 'NFO', category: 'FO', lotSize: 30 },
    { token: 'BSE_SENSEX', symbol: 'SENSEX', name: 'BSE SENSEX Index', exchange: 'BSE', category: 'INDICES', lotSize: 20 },
  ],
  WL_3: [
    { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', name: 'NIFTY 50 Index', exchange: 'NSE', category: 'INDICES', lotSize: 65 },
    { token: 'BSE_SENSEX', symbol: 'SENSEX', name: 'BSE SENSEX Index', exchange: 'BSE', category: 'INDICES', lotSize: 20 },
    { token: 'NSE_BANKNIFTY', symbol: 'BANK NIFTY', name: 'NIFTY Bank Index', exchange: 'NSE', category: 'INDICES', lotSize: 30 },
    { token: 'NSE_FINNIFTY', symbol: 'FIN NIFTY', name: 'NIFTY Financial Services', exchange: 'NSE', category: 'INDICES', lotSize: 60 },
  ],
  WL_4: [
    { token: 'NSE_RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', category: 'STOCKS', lotSize: 250 },
    { token: 'NSE_TCS', symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', category: 'STOCKS', lotSize: 175 },
    { token: 'NSE_INFY', symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 400 },
    { token: 'NSE_HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE', category: 'STOCKS', lotSize: 550 },
  ],
};

const SEARCH_CATALOG: WatchlistItem[] = [
  ...PRESET_WATCHLISTS.WL_1,
  ...PRESET_WATCHLISTS.WL_2,
  ...PRESET_WATCHLISTS.WL_3,
  ...PRESET_WATCHLISTS.WL_4,
  { token: 'NSE_SBIN', symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', category: 'STOCKS', lotSize: 750 },
  { token: 'NSE_BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', exchange: 'NSE', category: 'STOCKS', lotSize: 475 },
  { token: 'NSE_ITC', symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 1600 },
  { token: 'NSE_LTIM', symbol: 'LTIM', name: 'LTIMindtree Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 150 },
  { token: 'NSE_TATASTEEL', symbol: 'TATASTEEL', name: 'Tata Steel Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 5500 },
  { token: 'NSE_HAL', symbol: 'HAL', name: 'Hindustan Aeronautics Ltd.', exchange: 'NSE', category: 'STOCKS', lotSize: 300 },
];

const WATCHLIST_TABS = [
  { id: 'WL_1', label: 'Watchlist 1' },
  { id: 'WL_2', label: 'F&O Active' },
  { id: 'WL_3', label: 'Indices' },
  { id: 'WL_4', label: 'Commodities' },
];

interface GrowwWatchlistViewProps {
  token: string;
  ticks?: Map<string, MarketTick>;
  onRefreshWallet?: () => void;
  onSelectSymbolForTerminal?: (symbol: string, token: string, exchange: string) => void;
  riskRestriction?: string | null;
}

export const GrowwWatchlistView: React.FC<GrowwWatchlistViewProps> = ({
  token,
  ticks: propsTicks,
  onSelectSymbolForTerminal,
}) => {
  const { ticks: socketTicks } = useMarketSocket();
  const ticks = socketTicks.size > 0 ? socketTicks : (propsTicks ?? new Map<string, MarketTick>());

  const [activeTab, setActiveTab] = useState<string>('WL_1');
  const [dbWatchlistIds, setDbWatchlistIds] = useState<Record<string, string>>({});
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [watchlistStore, setWatchlistStore] = useState<Record<string, WatchlistItem[]>>(() => {
    try {
      const saved = localStorage.getItem('tradegrow_multi_watchlists');
      if (saved) return JSON.parse(saved);
      const legacy = localStorage.getItem('user_custom_watchlist');
      if (legacy) {
        return { ...PRESET_WATCHLISTS, WL_1: JSON.parse(legacy) };
      }
      return PRESET_WATCHLISTS;
    } catch (_) {
      return PRESET_WATCHLISTS;
    }
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'STOCKS' | 'FO' | 'INDICES' | 'COMMODITIES'>('ALL');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [selectedActionItem, setSelectedActionItem] = useState<WatchlistItem | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // ── Cloud Database Synchronization ──────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    let isCancelled = false;

    fetch('/api/v1/watchlists', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (isCancelled) return;
        if (data.success && Array.isArray(data.watchlists) && data.watchlists.length > 0) {
          const newStore: Record<string, WatchlistItem[]> = {};
          const newIds: Record<string, string> = {};

          data.watchlists.forEach((wl: any, idx: number) => {
            const tabId = idx < WATCHLIST_TABS.length ? WATCHLIST_TABS[idx].id : `WL_${idx + 1}`;
            newIds[tabId] = wl.id;
            newStore[tabId] = (wl.items || []).map((it: any) => ({
              token: it.instrument_token,
              symbol: it.symbol,
              name: it.symbol,
              exchange: it.exchange as any,
              category: it.exchange === 'MCX'
                ? 'COMMODITIES'
                : (it.instrument_token.includes('_CE') || it.instrument_token.includes('_PE'))
                  ? 'FO'
                  : (it.symbol.includes('NIFTY') || it.symbol.includes('SENSEX'))
                    ? 'INDICES'
                    : 'STOCKS',
              lotSize: getLotSizeForSymbol(it.symbol),
            }));
          });

          setDbWatchlistIds(newIds);
          setWatchlistStore(prev => ({ ...prev, ...newStore }));
          setIsCloudSynced(true);
        }
      })
      .catch(() => { });

    return () => { isCancelled = true; };
  }, [token]);

  const currentList = useMemo(() => watchlistStore[activeTab] || [], [watchlistStore, activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('tradegrow_multi_watchlists', JSON.stringify(watchlistStore));
    } catch (_) { }
  }, [watchlistStore]);

  const activeTokens = useMemo(() => currentList.map((item) => item.token), [currentList]);
  useSubscribeTokens(activeTokens);
  const freshnessMap = useMultiTickFreshness(activeTokens);

  const filteredWatchlist = useMemo(() => {
    return currentList.filter((item) => {
      const matchesCategory = activeFilter === 'ALL' || item.category === activeFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.token.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [currentList, activeFilter, searchQuery]);

  const [remoteSuggestions, setRemoteSuggestions] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      setRemoteSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const q = encodeURIComponent(searchQuery.trim());
        const res = await fetch(`/api/v1/instruments/search?q=${q}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.instruments)) {
            const mapped: WatchlistItem[] = data.instruments.map((inst: any) => ({
              token: inst.token,
              symbol: inst.symbol,
              name: inst.name,
              exchange: (inst.exchange || 'NSE') as any,
              category: inst.optionType === 'CE' || inst.optionType === 'PE'
                ? 'FO'
                : inst.segment?.includes('INDEX')
                  ? 'INDICES'
                  : 'STOCKS',
              lotSize: inst.lotSize || 1,
            }));
            setRemoteSuggestions(mapped);
          }
        }
      } catch (_) { }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const catalogSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const existingTokens = new Set(currentList.map((w) => w.token));
    const seen = new Set<string>();
    const results: WatchlistItem[] = [];

    // 1. Add remote live scrip search results
    for (const item of remoteSuggestions) {
      if (!existingTokens.has(item.token) && !seen.has(item.token)) {
        seen.add(item.token);
        results.push(item);
      }
    }

    // 2. Add local fallback catalog matches
    const q = searchQuery.toLowerCase();
    for (const item of SEARCH_CATALOG) {
      if (!existingTokens.has(item.token) && !seen.has(item.token) && (item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))) {
        seen.add(item.token);
        results.push(item);
      }
    }

    return results;
  }, [searchQuery, currentList, remoteSuggestions]);

  const handleAddSymbol = (item: WatchlistItem) => {
    if (!currentList.some((w) => w.token === item.token)) {
      setWatchlistStore((prev) => ({
        ...prev,
        [activeTab]: [item, ...(prev[activeTab] || [])],
      }));
      setSearchQuery('');

      // Cloud sync mutation
      const targetDbId = dbWatchlistIds[activeTab];
      if (token && targetDbId) {
        fetch('/api/v1/watchlists/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            watchlistId: targetDbId,
            instrumentToken: item.token,
            symbol: item.symbol,
            exchange: item.exchange
          })
        }).catch(() => { });
      }
    }
  };

  const handleRemoveSymbol = (tokenToRemove: string) => {
    setWatchlistStore((prev) => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter((w) => w.token !== tokenToRemove),
    }));

    // Cloud sync deletion
    const targetDbId = dbWatchlistIds[activeTab];
    if (token && targetDbId) {
      fetch('/api/v1/watchlists/items/by-token', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          watchlistId: targetDbId,
          instrumentToken: tokenToRemove
        })
      }).catch(() => { });
    }
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (dropIdx: number) => {
    if (draggedIdx === null || draggedIdx === dropIdx) return;
    const updated = [...currentList];
    const [removed] = updated.splice(draggedIdx, 1);
    updated.splice(dropIdx, 0, removed);
    setWatchlistStore((prev) => ({
      ...prev,
      [activeTab]: updated,
    }));
    setDraggedIdx(null);

    // Cloud sync reorder
    const targetDbId = dbWatchlistIds[activeTab];
    if (token && targetDbId) {
      fetch('/api/v1/watchlists/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          watchlistId: targetDbId,
          tokens: updated.map(x => x.token)
        })
      }).catch(() => { });
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-6 w-full font-body text-[var(--text-main)] pb-20 sm:pb-0">
      {/* Top Header & Search Card */}
      <Card padding="none" className="p-3 sm:p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 sm:gap-4">
        <div className="w-full md:w-auto flex items-center justify-between md:block">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)] flex-shrink-0" />
            <h1 className="text-sm sm:text-base md:text-xl font-bold tracking-tight">Multi-Watchlist</h1>
            <Badge variant="primary" className="text-[10px] sm:text-xs py-0.5 px-2">{currentList.length} Tracked</Badge>
          </div>
          <p className="hidden sm:block text-xs text-[var(--text-muted)] font-medium mt-1">
            Real-time streaming market prices. Drag to reorder, tap any instrument to trade.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scrip or option to add..."
              className="w-full pl-9 pr-8 py-1.5 sm:py-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl text-xs font-bold placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {catalogSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-11 z-30 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[var(--shadow-xl)] p-2 max-h-60 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] px-3 py-1">
                Add to {WATCHLIST_TABS.find((t) => t.id === activeTab)?.label}
              </div>
              {catalogSuggestions.map((item) => (
                <button
                  key={item.token}
                  onClick={() => handleAddSymbol(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--primary-light)] text-left transition-colors cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{item.symbol}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{item.name}</span>
                  </div>
                  <Badge variant="primary">
                    <Plus size={11} className="inline" /> Add
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ── MULTI-WATCHLIST QUICK TABS & CATEGORY FILTER ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 bg-[var(--bg-surface)] p-2 rounded-xl sm:rounded-2xl border border-[var(--border-color)]">
        {/* Watchlist Quick Switch Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none w-full sm:w-auto pb-0.5 sm:pb-0">
          {WATCHLIST_TABS.map((t) => {
            const count = (watchlistStore[t.id] || []).length;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-all whitespace-nowrap ${isActive
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                  }`}
              >
                <span>{t.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none w-full sm:w-auto">
          {(['ALL', 'STOCKS', 'FO', 'INDICES', 'COMMODITIES'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap ${activeFilter === filter
                ? 'bg-[var(--bg-surface-elevated)] text-[var(--primary)] border border-[var(--primary)]/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Watchlist Items Container */}
      <Card padding="none" className="overflow-hidden">
        {filteredWatchlist.length === 0 ? (
          <div className="p-6 sm:p-12 text-center flex flex-col items-center justify-center gap-3">
            <Eye size={32} className="text-[var(--text-muted)] opacity-50" />
            <span className="text-sm font-bold text-[var(--text-muted)]">No symbols in this watchlist yet</span>
            <p className="text-xs text-[var(--text-muted)] max-w-sm">
              Use the search bar above to track stocks, indices, or options in this tab.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {SEARCH_CATALOG.slice(0, 3).map((item) => (
                <button
                  key={item.token}
                  onClick={() => handleAddSymbol(item)}
                  className="px-3 py-1.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-[var(--primary)] hover:text-white transition-colors"
                >
                  <Plus size={12} /> Add {item.symbol}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {filteredWatchlist.map((item, idx) => {
              const freshness = freshnessMap.get(item.token);
              const tick = freshness?.tick || ticks?.get(item.token);
              const ltp = tick ? tick.ltp : 0;
              const change = tick ? tick.change : 0;
              const changePercent = tick ? tick.changePercent : 0;
              const isPositive = change >= 0;
              const hasTick = ltp > 0;
              const subtitle =
                item.category === 'FO' || item.category === 'STOCKS'
                  ? `${item.name} • ${item.exchange}`
                  : item.exchange;
              const clickable = Boolean(onSelectSymbolForTerminal);

              return (
                <div
                  key={item.token}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(idx)}
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      setSelectedActionItem(item);
                      setShowDetails(false);
                    } else if (clickable) {
                      onSelectSymbolForTerminal!(item.symbol, item.token, item.exchange);
                    }
                  }}
                  className={`flex items-center justify-between gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-3 min-h-[46px] sm:min-h-[52px] select-none transition-colors border-l-[3.5px] ${
                    item.category === 'FO'
                      ? 'border-indigo-500'
                      : item.category === 'INDICES'
                      ? 'border-amber-500'
                      : isPositive
                        ? 'border-emerald-500'
                        : 'border-rose-500'
                    } ${clickable ? 'cursor-pointer hover:bg-[var(--bg-surface-elevated)]' : ''
                    } ${draggedIdx === idx ? 'opacity-40 bg-[var(--primary-light)]' : ''}`}
                >
                  {/* Left: Drag Handle & Scrip Title */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className="cursor-grab active:cursor-grabbing text-[var(--text-muted)] opacity-40 hover:opacity-100 hidden sm:inline-block"
                      title="Drag to reorder"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={14} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-[var(--text-main)] leading-tight truncate">
                        {item.symbol}
                      </div>
                      <div className="text-[11.5px] text-[var(--text-muted)] leading-tight truncate mt-0.5">
                        {subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Center: Inline Mini-Sparkline */}
                  <div className="hidden sm:flex items-center justify-center px-4">
                    <MiniSparkline
                      changePercent={changePercent}
                      isPositive={isPositive}
                      width={64}
                      height={20}
                    />
                  </div>

                  {/* Right: Live Price Cell & Action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasTick ? (
                      <div className="text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          {isPositive ? (
                            <ArrowUp size={11} strokeWidth={3} className="text-[var(--gain)]" />
                          ) : (
                            <ArrowDown size={11} strokeWidth={3} className="text-[var(--loss)]" />
                          )}
                          <LivePriceCell
                            value={ltp}
                            prefix=""
                            decimals={2}
                            className="!text-[15px] font-bold leading-tight"
                          />
                        </div>
                        <div
                          className={`text-[12px] font-semibold leading-tight ${isPositive ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                            }`}
                        >
                          {isPositive ? '+' : ''}
                          {change.toFixed(2)} ({isPositive ? '+' : ''}
                          {changePercent.toFixed(2)}%)
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm font-mono text-[var(--text-muted)] px-1">—</span>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(
                          new CustomEvent('open-price-alert-modal', {
                            detail: { symbol: item.symbol, token: item.token, price: ltp },
                          })
                        );
                      }}
                      aria-label={`Set price alert for ${item.symbol}`}
                      title="Set Price Alert"
                      className="text-[var(--text-muted)] hover:text-amber-400"
                    >
                      <Bell size={14} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSymbol(item.token);
                      }}
                      aria-label={`Remove ${item.symbol} from watchlist`}
                      title="Remove from this watchlist"
                      className="text-[var(--text-muted)] hover:text-[var(--loss)]"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── MOBILE QUICK ACTION SHEET ── */}
      {selectedActionItem && (
        <div
          className="md:hidden mobile-bottom-sheet-backdrop"
          role="presentation"
          onClick={() => setSelectedActionItem(null)}
        >
          <section
            className="mobile-bottom-sheet-content px-4 pt-3 pb-6 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="watchlist-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-10 h-1 bg-[var(--border-color)] rounded-full mx-auto -mt-1 mb-2" />

            {/* Header: Instrument, Name, LTP */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="watchlist-sheet-title" className="text-base font-black text-[var(--text-main)]">
                    {selectedActionItem.symbol}
                  </h3>
                  <Badge variant={selectedActionItem.category === 'FO' ? 'primary' : 'neutral'}>
                    {selectedActionItem.exchange}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedActionItem.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedActionItem(null)}
                aria-label="Close"
                className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Price Row */}
            {(() => {
              const tick = ticks?.get(selectedActionItem.token);
              const price = tick?.ltp || 0;
              const chg = tick?.change || 0;
              const pct = tick?.changePercent || 0;
              const isGain = chg >= 0;
              return (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Current Price (LTP)</span>
                    <span className="text-xl font-black font-mono text-[var(--text-main)]">
                      ₹{price > 0 ? price.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="text-right">
                    <Badge variant={isGain ? 'gain' : 'loss'}>
                      {isGain ? '+' : ''}{chg.toFixed(2)} ({isGain ? '+' : ''}{pct.toFixed(2)}%)
                    </Badge>
                  </div>
                </div>
              );
            })()}

            {/* Primary Action Buttons: BUY (Green) and SELL (Red) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const tick = ticks?.get(selectedActionItem.token);
                  const price = tick?.ltp || 0;
                  window.dispatchEvent(
                    new CustomEvent('open-quick-order-modal', {
                      detail: { symbol: selectedActionItem.symbol, token: selectedActionItem.token, exchange: selectedActionItem.exchange, side: 'BUY', price },
                    })
                  );
                  setSelectedActionItem(null);
                }}
                className="py-3 px-4 rounded-xl text-sm font-black bg-[var(--gain)] text-white shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>BUY</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const tick = ticks?.get(selectedActionItem.token);
                  const price = tick?.ltp || 0;
                  window.dispatchEvent(
                    new CustomEvent('open-quick-order-modal', {
                      detail: { symbol: selectedActionItem.symbol, token: selectedActionItem.token, exchange: selectedActionItem.exchange, side: 'SELL', price },
                    })
                  );
                  setSelectedActionItem(null);
                }}
                className="py-3 px-4 rounded-xl text-sm font-black bg-[var(--loss)] text-white shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>SELL</span>
              </button>
            </div>

            {/* Secondary Action Links: View Chart, Option Chain, Details, Remove */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const item = selectedActionItem;
                  setSelectedActionItem(null);
                  if (onSelectSymbolForTerminal) {
                    onSelectSymbolForTerminal(item.symbol, item.token, item.exchange);
                  }
                }}
                className="w-full p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--primary)] text-xs font-bold text-[var(--text-main)] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
                  <span>View Chart &amp; Depth</span>
                </div>
                <span className="text-[11px] text-[var(--primary)]">Open &rarr;</span>
              </button>

              {(selectedActionItem.category === 'FO' || selectedActionItem.category === 'INDICES' || ['NIFTY 50', 'SENSEX', 'BANK NIFTY', 'FIN NIFTY'].includes(selectedActionItem.symbol)) && (
                <button
                  type="button"
                  onClick={() => {
                    const sym = selectedActionItem.symbol.replace(/ .*/, '');
                    setSelectedActionItem(null);
                    window.location.href = `/option-chain?symbol=${encodeURIComponent(sym)}`;
                  }}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-indigo-500 text-xs font-bold text-[var(--text-main)] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span>Open Option Chain</span>
                  </div>
                  <span className="text-[11px] text-indigo-400">View Strikes &rarr;</span>
                </button>
              )}

              {/* Expandable Technical Data (Progressive Disclosure) */}
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full p-2.5 rounded-xl bg-[var(--bg-surface-inset)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>View Details &amp; Stats</span>
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDetails && (
                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Lot Size</span>
                    <span className="font-mono font-bold text-[var(--text-main)]">{selectedActionItem.lotSize || 1}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Category</span>
                    <span className="font-mono font-bold text-[var(--text-main)]">{selectedActionItem.category}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Day Volume</span>
                    <span className="font-mono font-bold text-[var(--text-main)]">
                      {ticks?.get(selectedActionItem.token)?.volume?.toLocaleString('en-IN') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Exchange</span>
                    <span className="font-mono font-bold text-[var(--text-main)]">{selectedActionItem.exchange}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  handleRemoveSymbol(selectedActionItem.token);
                  setSelectedActionItem(null);
                }}
                className="w-full p-2.5 rounded-xl text-xs font-bold text-[var(--loss)] hover:bg-[var(--loss-light)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove from {WATCHLIST_TABS.find((t) => t.id === activeTab)?.label}</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
