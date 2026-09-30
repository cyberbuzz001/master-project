import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight, ArrowUpRight, ArrowDownRight, Layers, Award, Landmark, TrendingUp,
  Activity, Sparkles, Shield, Cpu, Zap, Search as SearchIcon, AlertTriangle,
  AlertCircle, CheckCircle2, Clock, ArrowRight, ShieldAlert, CreditCard
} from 'lucide-react';
import { MarketTick, Wallet, Position } from '../types';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';
import { IndexActionModal, LivePrice } from './IndexActionModal';
import { MobileChartModal } from './mobile/MobileChartModal';
import { FoHubView } from './FoHubView';
import { Card, CardTitle, Badge, Tabs, DataTable, DataTableColumn, LivePriceCell, Skeleton } from './ui';
import { pnlColorClass, formatPnl, formatPnlPct } from '../utils/pnl';

type Category = 'STOCKS' | 'FO';

interface GrowwExploreViewProps {
  ticks?: Map<string, MarketTick>;
  token?: string | null;
  wallet?: Wallet | null;
  onRefreshWallet?: () => void;
  /** Desktop: navigates to the Terminal chart view. Mobile: opens the quick-order sheet. Which action happens is decided by the caller (App.tsx), matching each platform's existing behavior — this component just renders and calls back. */
  onSelectSymbol?: (symbol: string, price?: number) => void;
  onOpenProfile?: (tab?: 'PROFILE' | 'KYC' | 'FUNDS' | 'PERMISSIONS' | 'SECURITY' | 'SUPPORT') => void;
  onOpenOptionChain?: (symbol?: string) => void;
  onOpenSearch?: () => void;
  theme?: 'light' | 'dark';
}

interface MoverRow {
  symbol: string;
  name: string;
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number | string;
  logo?: string;
  internalToken?: string;
}

const INDEX_META = [
  { label: 'NIFTY 50', token: 'NSE_NIFTY50', exchange: 'NSE', fallback: 24856.15, fbPct: 0.42 },
  { label: 'SENSEX', token: 'BSE_SENSEX', exchange: 'BSE', fallback: 73600.00, fbPct: 0.38 },
  { label: 'BANK NIFTY', token: 'NSE_BANKNIFTY', exchange: 'NSE', fallback: 52150.75, fbPct: -0.15 },
  { label: 'FIN NIFTY', token: 'NSE_FINNIFTY', exchange: 'NSE', fallback: 23890.40, fbPct: 0.22 },
];

export const GrowwExploreView: React.FC<GrowwExploreViewProps> = ({
  ticks: propsTicks,
  token,
  wallet,
  onRefreshWallet,
  onSelectSymbol,
  onOpenProfile,
  onOpenOptionChain,
  onOpenSearch,
  theme = 'light',
}) => {
  const navigate = useNavigate();
  const { ticks: socketTicks } = useMarketSocket();
  const ticks = socketTicks.size > 0 ? socketTicks : (propsTicks ?? new Map<string, MarketTick>());
  const [searchParams, setSearchParams] = useSearchParams();
  const category = (searchParams.get('category')?.toUpperCase() as Category) || 'STOCKS';

  const [moverTab, setMoverTab] = useState<'GAINERS' | 'LOSERS' | 'VOLUME'>('GAINERS');
  const [serverMovers, setServerMovers] = useState<{ gainers: MoverRow[]; losers: MoverRow[]; volumeShockers: MoverRow[] }>({
    gainers: [], losers: [], volumeShockers: [],
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(true);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [selectedIndexModal, setSelectedIndexModal] = useState<{ symbol: string; token: string; exchange: string } | null>(null);
  const [mobileChartState, setMobileChartState] = useState<{ symbol: string; token: string; exchange: string } | null>(null);

  const exploreTokens = [
    'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK',
    'NSE_SBIN', 'NSE_BHARTIARTL', 'NSE_TATAMOTORS', 'NSE_TATASTEEL', 'NSE_HAL',
    'NSE_NIFTY50', 'BSE_SENSEX', 'NSE_BANKNIFTY', 'NSE_FINNIFTY',
  ];
  useSubscribeTokens(exploreTokens);

  useEffect(() => {
    fetch('/api/v1/market/top-movers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setServerMovers({ gainers: data.gainers || [], losers: data.losers || [], volumeShockers: data.volumeShockers || [] });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    fetch('/api/v1/portfolio/positions?todayOnly=true', { headers: { Authorization: `Bearer ${userToken}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.positions)) setPositions(data.positions);
      })
      .catch(() => {});

    fetch('/api/v1/portfolio/orders?limit=6', { headers: { Authorization: `Bearer ${userToken}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.orders)) setRecentOrders(data.orders);
      })
      .catch(() => {})
      .finally(() => setOrdersLoading(false));

    fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${userToken}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) setUserInfo(data.user);
      })
      .catch(() => {});
  }, [token]);

  const mostTraded: MoverRow[] = [
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', price: 3014.20, change: 68.40, changePercent: 2.32, logo: 'RE' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', price: 4210.50, change: 92.10, changePercent: 2.24, logo: 'TC' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', price: 1890.30, change: -12.40, changePercent: -0.65, logo: 'IN' },
    { symbol: 'NSE_HDFCBANK', name: 'HDFC Bank', price: 1642.80, change: 14.30, changePercent: 0.88, logo: 'HD' },
  ];

  const defaultMovers: MoverRow[] = [
    { symbol: 'NSE_HAL', name: 'Hindustan Aeronaut.', price: 4886.70, change: 241.70, changePercent: 5.20, volume: 2818585, logo: 'HA' },
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', price: 3014.20, change: 68.40, changePercent: 2.32, volume: 4521102, logo: 'RE' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', price: 4210.50, change: 92.10, changePercent: 2.24, volume: 1840920, logo: 'TC' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', price: 1890.30, change: -12.40, changePercent: -0.65, volume: 3210400, logo: 'IN' },
  ];

  const activeMoversList: MoverRow[] = moverTab === 'GAINERS'
    ? (serverMovers.gainers.length > 0 ? serverMovers.gainers : defaultMovers)
    : moverTab === 'LOSERS'
    ? (serverMovers.losers.length > 0 ? serverMovers.losers : defaultMovers)
    : (serverMovers.volumeShockers.length > 0 ? serverMovers.volumeShockers : defaultMovers);

  const activePositions = positions.filter((p) => p.netQty !== 0);
  const openPositionsCount = activePositions.length;
  const longCount = activePositions.filter((p) => p.netQty > 0).length;
  const shortCount = activePositions.filter((p) => p.netQty < 0).length;
  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  const totalRealizedPnl = positions.reduce((acc, p) => acc + (p.realizedPnl || 0), 0);
  const todaysPnl = totalUnrealizedPnl + totalRealizedPnl;
  const availableMargin = wallet ? wallet.cashBalance : 0;
  const usedMargin = wallet ? wallet.usedMargin : 0;
  const totalBalance = availableMargin + usedMargin;
  const portfolioValue = availableMargin + todaysPnl;
  const pnlPct = portfolioValue > 0 ? (todaysPnl / portfolioValue) * 100 : 0;
  const marginUtilization = totalBalance > 0 ? (usedMargin / totalBalance) * 100 : 0;

  const actionItem = useMemo(() => {
    if (userInfo?.risk_restriction === 'REDUCE_ONLY') {
      return {
        type: 'RISK',
        title: 'Account Restricted (Reduce-Only)',
        desc: 'Risk thresholds reached. You can only square off or reduce open positions.',
        cta: 'View Positions',
        icon: <ShieldAlert className="w-4 h-4 text-[var(--loss)]" />,
        cls: 'bg-[var(--loss-light)] border-[var(--loss)]/30 text-[var(--loss)]',
        btnCls: 'bg-[var(--loss)] text-white hover:bg-[var(--loss)]/90',
        action: () => navigate('/portfolio/positions'),
      };
    }
    if (marginUtilization > 85 && openPositionsCount > 0) {
      return {
        type: 'MARGIN',
        title: `High Margin Utilization (${marginUtilization.toFixed(0)}%)`,
        desc: 'Used margin is above 85%. Add funds to protect positions from auto liquidation.',
        cta: 'Deposit Funds',
        icon: <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />,
        cls: 'bg-[var(--warning-light)] border-[var(--warning)]/30 text-[var(--warning)]',
        btnCls: 'bg-[var(--warning)] text-white hover:bg-[var(--warning)]/90',
        action: () => onOpenProfile?.('FUNDS'),
      };
    }
    const kycDone = userInfo?.isKycCompleted || ['APPROVED', 'SUBMITTED', 'UNDER_REVIEW'].includes(userInfo?.kycStatus) || ['APPROVED', 'SUBMITTED', 'UNDER_REVIEW'].includes(userInfo?.kyc_status);
    if (userInfo && !kycDone) {
      return {
        type: 'KYC',
        title: 'Complete KYC Verification',
        desc: 'Verify identity documents to unlock unmetered F&O limits and instant withdrawals.',
        cta: 'Complete Verification',
        icon: <CheckCircle2 className="w-4 h-4 text-[var(--gogrow-blue)]" />,
        cls: 'bg-[var(--gogrow-blue-light)] border-[var(--gogrow-blue)]/30 text-[var(--gogrow-blue)]',
        btnCls: 'bg-[var(--gogrow-blue)] text-white hover:bg-[var(--gogrow-blue-hover)]',
        action: () => onOpenProfile?.('KYC'),
      };
    }
    return null;
  }, [userInfo, marginUtilization, openPositionsCount, navigate, onOpenProfile]);

  const handleSelectRow = (symbolOrName: string, price?: number) => onSelectSymbol?.(symbolOrName, price);

  const openIndexChart = (symbol: string, tok: string, exchange: string) => {
    // Small, deliberate JS branch (viewport width, not device type) rather
    // than a prop from the parent — a full desktop Terminal view and a
    // mobile chart sheet are genuinely different features, not one
    // component at two sizes, unlike everything else on this page.
    setSelectedIndexModal(null);
    if (window.innerWidth < 768) {
      setMobileChartState({ symbol, token: tok, exchange });
    } else {
      handleSelectSymbolForTerminal(symbol, tok);
    }
  };

  const handleSelectSymbolForTerminal = (symbol: string, tok?: string) => {
    onSelectSymbol?.(symbol);
  };

  const moverColumns: DataTableColumn<MoverRow>[] = [
    {
      key: 'name', header: 'Company', mobilePrimary: true,
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] font-black flex items-center justify-center text-xs border border-[var(--primary)]/20 flex-shrink-0">
            {m.logo || m.name.charAt(0)}
          </div>
          <span className="font-bold text-xs text-[var(--text-main)]">{m.name}</span>
        </div>
      ),
    },
    {
      key: 'price', header: 'LTP', align: 'right',
      render: (m) => {
        const liveTick = ticks?.get(m.internalToken || m.symbol);
        const price = liveTick ? liveTick.ltp : m.price;
        const change = liveTick ? liveTick.change : (m.change || 0);
        const changePct = liveTick ? liveTick.changePercent : (m.changePercent || 0);
        const isGain = change >= 0;
        return (
          <div>
            <div className="text-xs font-bold text-[var(--text-main)] num-font">₹{price.toFixed(2)}</div>
            <div className={`text-[11px] font-bold num-font ${isGain ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
              {isGain ? '+' : ''}{change.toFixed(2)} ({isGain ? '+' : ''}{changePct.toFixed(2)}%)
            </div>
          </div>
        );
      },
    },
    {
      key: 'volume', header: 'Volume', align: 'right',
      render: (m) => {
        const liveTick = ticks?.get(m.internalToken || m.symbol);
        const volume = liveTick ? liveTick.volume : m.volume;
        return <span className="text-[var(--text-muted)] font-bold num-font">{typeof volume === 'number' ? volume.toLocaleString('en-IN') : (volume ?? '—')}</span>;
      },
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-12 font-body text-[var(--text-main)]">
      {/* CATEGORY FILTER — belongs on this page per the IA, not the shell.
          Always rendered regardless of category, so switching back from
          Commodities is always possible (a real dead-end bug in an early
          draft: McxCommodityView used to replace this control entirely). */}
      <Tabs
        ariaLabel="Instrument category"
        value={category}
        onChange={(v) => {
          if (v === 'STOCKS') {
            searchParams.delete('category');
          } else {
            searchParams.set('category', v);
          }
          setSearchParams(searchParams, { replace: true });
        }}
        items={[
          { value: 'STOCKS', label: 'Stocks' },
          { value: 'FO', label: 'F&O' },
        ]}
      />

      {category === 'FO' ? (
        <FoHubView ticks={ticks} onOpenOptionChain={onOpenOptionChain} />
      ) : (
      <>
      {/* ACTION NEEDED STRIP / BANNER (Highest Priority Pending Item) */}
      {actionItem && (
        <div
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border shadow-sm transition-all duration-[var(--duration-normal)] ${actionItem.cls}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-current/20 flex items-center justify-center flex-shrink-0 shadow-xs">
              {actionItem.icon}
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold flex items-center gap-2">
                <span>{actionItem.title}</span>
              </h4>
              <p className="text-[11px] sm:text-xs opacity-90 leading-snug mt-0.5">{actionItem.desc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={actionItem.action}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${actionItem.btnCls}`}
          >
            <span>{actionItem.cta}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 1. HERO FINANCIAL PULSE (Today's P&L, Active Positions, Available Margin) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Today's P&L Card */}
        <Card
          padding="md"
          className="relative overflow-hidden border border-[var(--border-color)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-surface-elevated)]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  todaysPnl >= 0 ? 'bg-[var(--gain-light)] text-[var(--gain)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Today's P&amp;L</span>
            </div>
            <Badge variant={todaysPnl >= 0 ? 'gain' : 'loss'} dot>
              LIVE
            </Badge>
          </div>
          <div className="mt-1">
            <div className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${pnlColorClass(todaysPnl)}`}>
              <LivePriceCell
                value={todaysPnl}
                prefix="₹"
                showSign
                colorBySign
                className="!text-2xl sm:!text-3xl font-black"
              />
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-[var(--text-muted)]">
              <span>Unrealized: <span className={`font-mono font-bold ${pnlColorClass(totalUnrealizedPnl)}`}>{formatPnl(totalUnrealizedPnl)}</span></span>
              <span>&bull;</span>
              <span>Realized: <span className={`font-mono font-bold ${pnlColorClass(totalRealizedPnl)}`}>{formatPnl(totalRealizedPnl)}</span></span>
            </div>
          </div>
        </Card>

        {/* Active Open Positions Card */}
        <Card
          padding="md"
          interactive
          onClick={() => navigate('/portfolio/positions')}
          className="border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--primary)]/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Open Positions</span>
            </div>
            <span className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              View <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1">
            <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-[var(--text-main)]">
              {openPositionsCount}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-[var(--text-muted)]">
              <span className="text-[var(--gain)] font-bold">{longCount} Long</span>
              <span>&bull;</span>
              <span className="text-[var(--loss)] font-bold">{shortCount} Short</span>
              <span>&bull;</span>
              <span>{positions.length - openPositionsCount} Closed</span>
            </div>
          </div>
        </Card>

        {/* Available Trading Margin Card */}
        <Card
          padding="md"
          interactive
          onClick={() => onOpenProfile?.('FUNDS')}
          className="border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--primary)]/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Available Margin</span>
            </div>
            <span className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              + Funds <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1">
            <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-[var(--text-main)]">
              ₹{availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] font-semibold text-[var(--text-muted)]">
              <span>Used: ₹{usedMargin.toLocaleString('en-IN')}</span>
              <span>{marginUtilization.toFixed(0)}% utilized</span>
            </div>
          </div>
        </Card>
      </div>

      {/* MARKET INDICES — the only place index quotes are visible on mobile, since AppShell's ticker is desktop-only. Shown at every width for one consistent page (not device-conditional). */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Market Indices</span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--gain)] font-bold">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-[var(--gain)] inline-block" /> REAL-TIME
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {INDEX_META.map((idx) => {
            const tick = ticks?.get(idx.token) || (idx.token === 'BSE_SENSEX' ? ticks?.get('SENSEX') || ticks?.get('BSE SENSEX') : undefined);
            const price = tick?.ltp ?? idx.fallback;
            const pct = tick?.changePercent ?? idx.fbPct;
            const isGain = pct >= 0;
            return (
              <Card
                key={idx.token}
                padding="sm"
                interactive
                onClick={() => setSelectedIndexModal({ symbol: idx.label, token: idx.token, exchange: idx.exchange })}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-extrabold truncate">{idx.label}</span>
                  <Badge variant={isGain ? 'gain' : 'loss'}>{isGain ? '+' : ''}{pct.toFixed(2)}%</Badge>
                </div>
                <div className="font-mono text-xs font-black tabular-nums">
                  <LivePrice value={price} prefix="" decimals={2} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[var(--bg-surface)] border border-[var(--border-color)] px-3.5 py-2.5 rounded-2xl">
        <div className="flex items-center gap-2 mr-1">
          <Zap className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
          <span className="text-xs font-bold">Quick Actions</span>
        </div>
        {[
          { label: '+ Buy Equity', onClick: () => handleSelectRow('RELIANCE'), cls: 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary)] hover:text-white' },
          { label: 'Option Chain Matrix', onClick: () => onOpenOptionChain?.(), cls: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500 hover:text-white' },
          { label: 'Market Scanner', onClick: onOpenSearch, icon: <SearchIcon className="w-3.5 h-3.5" aria-hidden="true" />, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-white' },
        ].map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`min-h-[44px] md:min-h-0 px-3.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all duration-[var(--duration-fast)] ease-[var(--easing-default)] ${a.cls}`}
          >
            {a.icon}{a.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-8 space-y-5 sm:space-y-6">
          <Card>
            <CardTitle className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-[var(--primary)]" />Most Traded Contracts & Stocks</CardTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mostTraded.map((stock) => {
                const liveTick = ticks?.get(stock.symbol);
                const price = liveTick ? liveTick.ltp : stock.price;
                const change = liveTick ? liveTick.change : (stock as any).change ?? (stock as any).changePct ?? 0;
                const changePct = liveTick ? liveTick.changePercent : (stock as any).changePercent ?? (stock as any).changePct ?? 0;
                const isGain = change >= 0;
                return (
                  <div
                    key={stock.symbol}
                    onClick={() => handleSelectRow(stock.name, price)}
                    className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-3.5 rounded-xl hover:border-[var(--primary)]/40 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20 font-black flex items-center justify-center text-xs mb-2 group-hover:scale-105 transition-transform">
                      {stock.logo}
                    </div>
                    <h4 className="font-bold text-xs truncate mb-1">{stock.name}</h4>
                    <div className="num-font font-bold text-xs">₹{price.toFixed(2)}</div>
                    <div className={`num-font font-bold text-[11px] flex items-center gap-0.5 mt-0.5 ${isGain ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                      {isGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>{Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" />Market Movers (1D)</CardTitle>
              <Tabs
                ariaLabel="Movers filter"
                value={moverTab}
                onChange={(v) => setMoverTab(v as typeof moverTab)}
                items={[
                  { value: 'GAINERS', label: 'Gainers' },
                  { value: 'LOSERS', label: 'Losers' },
                  { value: 'VOLUME', label: 'Volume Shockers' },
                ]}
              />
            </div>
            <DataTable
              columns={moverColumns}
              rows={activeMoversList}
              rowKey={(m) => m.symbol}
              onRowClick={(m) => handleSelectRow(m.name, m.price)}
            />
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-5 sm:space-y-6">
          {/* ── RECENT ACTIVITY & ORDERS FEED ── */}
          <Card>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border-color)]">
              <h4 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 text-[var(--text-main)]">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                <span>Recent Activity</span>
              </h4>
              <button
                type="button"
                onClick={() => navigate('/portfolio/orders')}
                className="text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {ordersLoading ? (
              <div className="space-y-2 py-2">
                <Skeleton height={36} className="w-full" />
                <Skeleton height={36} className="w-full" />
                <Skeleton height={36} className="w-full" />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--text-muted)] space-y-1">
                <p className="font-semibold">No recent trades or orders today</p>
                <p className="text-[10px]">Your executed orders will appear here automatically.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-light)] -mx-1">
                {recentOrders.slice(0, 5).map((order) => {
                  const isBuy = order.side === 'BUY';
                  const isFilled = order.status === 'FILLED';
                  const isRejected = order.status === 'REJECTED';
                  const statusVariant = isFilled ? 'gain' : isRejected ? 'loss' : 'warning';
                  const formattedTime = order.createdAt || order.created_at
                    ? new Date(order.createdAt || order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Today';

                  return (
                    <div
                      key={order.id}
                      onClick={() => navigate('/portfolio/orders')}
                      className="py-2.5 px-1 flex items-center justify-between hover:bg-[var(--bg-surface-elevated)] rounded-lg transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs truncate">{order.symbol}</span>
                          <span className={`text-[10px] font-black px-1.5 py-0.2 rounded font-mono ${isBuy ? 'bg-[var(--gain-light)] text-[var(--gain)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'}`}>
                            {order.side}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                          Qty: {order.quantity} &bull; ₹{parseFloat(order.price || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <Badge variant={statusVariant}>{order.status}</Badge>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono mt-1">{formattedTime}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* PRODUCTS & TRADING TOOLS */}
          <Card>
            <h4 className="font-bold text-sm mb-4 flex items-center gap-2"><Cpu className="w-4 h-4 text-[var(--primary)]" />Products & Trading Tools</h4>
            <div className="space-y-3">
              {[
                { icon: <Layers className="w-4 h-4" />, iconClass: 'bg-emerald-500/15 text-emerald-500', label: 'Option Chain Matrix', sub: 'Live Call & Put OI Skew', onClick: () => onOpenOptionChain?.() },
                { icon: <Activity className="w-4 h-4" />, iconClass: 'bg-indigo-500/15 text-indigo-500', label: 'AI Market Scanner', sub: 'Volume Breakouts & RSI', onClick: onOpenSearch },
                { icon: <Award className="w-4 h-4" />, iconClass: 'bg-amber-500/15 text-amber-500', label: 'Option Strategy Builder', sub: 'Multi-leg spreads & payoff', onClick: () => onOpenOptionChain?.() },
              ].map((tool) => (
                <div key={tool.label} onClick={tool.onClick} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-[var(--primary)]/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tool.iconClass}`}>{tool.icon}</div>
                    <div>
                      <span className="font-bold text-xs block">{tool.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{tool.sub}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {selectedIndexModal && (
        <IndexActionModal
          isOpen={Boolean(selectedIndexModal)}
          onClose={() => setSelectedIndexModal(null)}
          indexSymbol={selectedIndexModal.symbol}
          token={selectedIndexModal.token}
          exchange={selectedIndexModal.exchange}
          latestTick={ticks.get(selectedIndexModal.token)}
          onOpenChart={openIndexChart}
          onOpenOptionChain={() => { setSelectedIndexModal(null); onOpenOptionChain?.(); }}
        />
      )}

      {mobileChartState && (
        <MobileChartModal
          isOpen={Boolean(mobileChartState)}
          onClose={() => setMobileChartState(null)}
          symbol={mobileChartState.symbol}
          token={mobileChartState.token}
          exchange={mobileChartState.exchange}
          latestTick={ticks.get(mobileChartState.token)}
          theme={theme}
          onOpenOptionChain={() => onOpenOptionChain?.()}
          onOpenOrderModal={(side, price) => handleSelectRow(mobileChartState.symbol, price)}
        />
      )}
      </>
      )}
    </div>
  );
};
