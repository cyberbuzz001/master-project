import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Activity, TrendingUp, DollarSign, Search, RefreshCw,
  ChevronDown, ChevronRight, X, AlertCircle, CheckCircle2,
  Power, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert, Sparkles
} from 'lucide-react';
import { Dialog, DataTable, DataTableColumn, Button, Card, Badge } from '../ui';
import { useMarketSocket, useAdminSubscribeAll } from '../../hooks/useMarketSocket';

interface OpenPositionItem {
  id: string;
  symbol: string;
  exchange?: string;
  productType: string;
  netQty: number;
  averagePrice: number;
  ltp: number;
  unrealizedPnl: number;
}

interface ClosedPositionItem {
  id: string;
  symbol: string;
  exchange?: string;
  productType?: string;
  quantity: number;
  entryPrice?: number;
  exitPrice?: number;
  netPnl: number;
  exitReason?: string;
  closedAt: string;
}

interface ClientOverviewItem {
  id: string;
  clientId: string;
  username: string;
  fullName: string;
  marginUtilized: number;
  availableFunds: number;
  openPositions: OpenPositionItem[];
  closedPositions: ClosedPositionItem[];
}

interface PositionsOverviewResponse {
  success: boolean;
  total: number;
  summary: {
    totalUnrealizedPnl: number;
    totalRealizedPnl: number;
  };
  clients: ClientOverviewItem[];
  pagination: {
    limit: number;
    offset: number;
  };
}

interface ActivePositionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const ActivePositionsModal: React.FC<ActivePositionsModalProps> = ({ isOpen, onClose, token }) => {
  const [tab, setTab] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PositionsOverviewResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [squaringOffId, setSquaringOffId] = useState<string | null>(null);

  // Set of expanded user IDs for inline drawer
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());

  // WebSocket for real-time push updates
  const { onAdminEvent } = useMarketSocket();
  useAdminSubscribeAll();

  // Search debounce (~300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setOffset(0); // Reset page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when tab changes
  useEffect(() => {
    setOffset(0);
  }, [tab]);

  // Fetch overview data
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isOpen) return;
    if (!isBackground) setLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams({
        tab,
        limit: String(limit),
        offset: String(offset)
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/v1/admin/positions/overview?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resJson = await res.json();
      if (resJson.success) {
        setData(resJson);
      } else {
        setErrorMsg(resJson.error?.message || 'Failed to fetch active positions overview');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error fetching positions');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [isOpen, token, tab, limit, offset, debouncedSearch]);

  // Initial & Dependency Fetch
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Live updates throttled refetch via WebSocket
  const throttleTimeoutRef = useRef<number | null>(null);
  const triggerThrottledRefetch = useCallback(() => {
    if (throttleTimeoutRef.current) return;
    throttleTimeoutRef.current = window.setTimeout(() => {
      throttleTimeoutRef.current = null;
      fetchData(true);
    }, 600);
  }, [fetchData]);

  useEffect(() => {
    if (!isOpen) return;

    const unsubs = [
      onAdminEvent(() => triggerThrottledRefetch(), 'POSITION_UPDATED'),
      onAdminEvent(() => triggerThrottledRefetch(), 'TRADE_EXECUTED'),
      onAdminEvent(() => triggerThrottledRefetch(), 'ORDER_UPDATED')
    ];

    return () => {
      unsubs.forEach(u => u());
      if (throttleTimeoutRef.current) {
        window.clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
    };
  }, [isOpen, onAdminEvent, triggerThrottledRefetch]);

  // Toggle user row expansion
  const toggleExpand = (userId: string) => {
    setExpandedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Square-off position handler
  const handleSquareOff = async (pos: OpenPositionItem, clientName: string) => {
    const sideText = pos.netQty > 0 ? 'BUY' : 'SELL';
    const confirmPrompt = window.confirm(
      `Force Square-off Confirmation:\n\nClient: ${clientName}\nPosition: ${pos.symbol} (${pos.productType})\nQty: ${Math.abs(pos.netQty)} ${sideText}\nEstimated LTP: ₹${pos.ltp.toFixed(2)}\n\nAre you sure you want to market square off this position immediately?`
    );

    if (!confirmPrompt) return;

    setSquaringOffId(pos.id);
    setActionMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/positions/${pos.id}/square-off`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ price: pos.ltp })
      });

      const resJson = await res.json();
      if (resJson.success) {
        setActionMsg({
          type: 'success',
          text: `✅ ${resJson.message || `Position ${pos.symbol} squared off successfully.`}`
        });
        fetchData(true);
      } else {
        setActionMsg({
          type: 'error',
          text: resJson.error?.message || 'Square-off failed'
        });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Error executing square-off' });
    } finally {
      setSquaringOffId(null);
    }
  };

  const totalClients = data?.total ?? 0;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalClients / limit));

  // DataTable columns for clients
  const columns: DataTableColumn<ClientOverviewItem>[] = [
    {
      key: 'expand',
      header: '',
      align: 'center',
      className: 'w-10',
      render: (client) => {
        const isExpanded = expandedUserIds.has(client.id);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(client.id);
            }}
            className="p-1 rounded-lg hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
            title={isExpanded ? 'Collapse' : 'Expand positions'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--primary)]" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        );
      }
    },
    {
      key: 'client',
      header: 'Client / Account',
      mobilePrimary: true,
      render: (client) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-[var(--text-main)] text-xs flex items-center gap-1.5">
            {client.fullName || client.username}
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            ID: {client.clientId || client.id.slice(0, 8)} • @{client.username}
          </span>
        </div>
      )
    },
    {
      key: 'availableFunds',
      header: 'Available Cash',
      align: 'right',
      render: (client) => (
        <span className="font-mono text-xs font-bold text-[var(--text-main)]">
          ₹{client.availableFunds.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'marginUtilized',
      header: 'Margin Blocked',
      align: 'right',
      render: (client) => (
        <span className="font-mono text-xs font-bold text-[var(--warning)]">
          ₹{client.marginUtilized.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'openCount',
      header: 'Open Live',
      align: 'center',
      render: (client) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
          client.openPositions.length > 0
            ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30'
            : 'bg-[var(--bg-surface-inset)] text-[var(--text-muted)] border border-[var(--border-color)]'
        }`}>
          {client.openPositions.length} Open
        </span>
      )
    },
    {
      key: 'closedCount',
      header: 'Closed Today',
      align: 'center',
      render: (client) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
          client.closedPositions.length > 0
            ? 'bg-[var(--info)]/15 text-[var(--info)] border border-[var(--info)]/30'
            : 'bg-[var(--bg-surface-inset)] text-[var(--text-muted)] border border-[var(--border-color)]'
        }`}>
          {client.closedPositions.length} Closed
        </span>
      )
    }
  ];

  // Render expanded row showing that client's open and closed-today positions
  const renderExpandedRow = (client: ClientOverviewItem) => (
    <div className="space-y-4 rounded-xl bg-[var(--bg-surface)] p-4 border border-[var(--border-color)] shadow-inner">
      {/* 1. Open Positions Sub-table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[var(--gain)] animate-pulse"></span>
            <span>Live Open Positions ({client.openPositions.length})</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">IST Real-time Ticks</span>
        </div>

        {client.openPositions.length === 0 ? (
          <div className="p-3 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-body)]/60 rounded-lg border border-[var(--border-light)]">
            No live open positions currently active for this client.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-body)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)]/60 text-[10px] uppercase font-bold text-[var(--text-muted)]">
                  <th className="p-2.5">Symbol</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5 text-right">Net Qty</th>
                  <th className="p-2.5 text-right">Buy Avg</th>
                  <th className="p-2.5 text-right">Live LTP</th>
                  <th className="p-2.5 text-right">Unrealized P&L</th>
                  <th className="p-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {client.openPositions.map((pos) => {
                  const isLong = pos.netQty > 0;
                  const pnl = pos.unrealizedPnl;
                  const isGain = pnl >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-[var(--bg-surface-elevated)]/40 transition">
                      <td className="p-2.5 font-bold font-mono text-[var(--text-main)]">
                        {pos.symbol}
                      </td>
                      <td className="p-2.5 font-semibold text-[10px] text-[var(--text-muted)]">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-color)]">
                          {pos.productType}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          isLong ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {isLong ? 'BUY' : 'SELL'} {Math.abs(pos.netQty)}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono text-[var(--text-muted)]">
                        ₹{pos.averagePrice.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-extrabold text-[var(--primary)]">
                        ₹{pos.ltp.toFixed(2)}
                      </td>
                      <td className={`p-2.5 text-right font-mono font-black ${isGain ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                        {isGain ? '+' : ''}₹{pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={squaringOffId === pos.id}
                          onClick={() => handleSquareOff(pos, client.fullName || client.username)}
                          className="h-7 text-[10px] px-2 py-0 gap-1 font-bold"
                          title="Force admin market square-off"
                        >
                          <Power className="w-3 h-3" />
                          <span>{squaringOffId === pos.id ? 'Closing...' : 'Square Off'}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Closed Positions Sub-table (Closed Today) */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-[var(--info)]" />
            <span>Trades Closed Today ({client.closedPositions.length})</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">IST Today Since 00:00</span>
        </div>

        {client.closedPositions.length === 0 ? (
          <div className="p-3 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-body)]/60 rounded-lg border border-[var(--border-light)]">
            No positions squared off or trades closed today for this client.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-body)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)]/60 text-[10px] uppercase font-bold text-[var(--text-muted)]">
                  <th className="p-2.5">Symbol</th>
                  <th className="p-2.5 text-right">Qty</th>
                  <th className="p-2.5 text-right">Entry Px</th>
                  <th className="p-2.5 text-right">Exit Px</th>
                  <th className="p-2.5 text-right">Realized Net P&L</th>
                  <th className="p-2.5">Exit Reason</th>
                  <th className="p-2.5 text-right">Closed Time (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {client.closedPositions.map((ct) => {
                  const isGain = ct.netPnl >= 0;
                  const timeFormatted = new Date(ct.closedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                  });

                  return (
                    <tr key={ct.id} className="hover:bg-[var(--bg-surface-elevated)]/40 transition">
                      <td className="p-2.5 font-bold font-mono text-[var(--text-main)]">
                        {ct.symbol}
                      </td>
                      <td className="p-2.5 text-right font-mono text-[var(--text-muted)]">
                        {ct.quantity}
                      </td>
                      <td className="p-2.5 text-right font-mono text-[var(--text-muted)]">
                        {ct.entryPrice ? `₹${ct.entryPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-[var(--text-main)]">
                        {ct.exitPrice ? `₹${ct.exitPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className={`p-2.5 text-right font-mono font-black ${isGain ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                        {isGain ? '+' : ''}₹{ct.netPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-[10px] text-[var(--text-muted)]">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-color)]">
                          {ct.exitReason || 'MANUAL_EXIT'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono text-[10px] text-[var(--text-tertiary)]">
                        {timeFormatted}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline font-black text-sm text-[var(--text-main)] tracking-tight">
                Today's Active Clients & Positions
              </span>
              <span className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase tracking-wider">
                IST Today
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] block font-normal">
              Real-time drill-down of all clients with open live positions or trades executed today
            </span>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        
        {/* Action Message Banner */}
        {actionMsg && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
            actionMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{actionMsg.text}</span>
            </div>
            <button onClick={() => setActionMsg(null)} className="p-1 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl text-xs font-bold bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/30 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Global Summary KPI Bar (Covering ALL filtered clients) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Active Clients Today
              </span>
              <span className="text-xl font-mono font-black text-[var(--text-main)] block mt-0.5">
                {totalClients.toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Total Unrealized P&L
              </span>
              <span className={`text-xl font-mono font-black block mt-0.5 ${
                (data?.summary?.totalUnrealizedPnl ?? 0) >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
              }`}>
                {(data?.summary?.totalUnrealizedPnl ?? 0) >= 0 ? '+' : ''}
                ₹{(data?.summary?.totalUnrealizedPnl ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--gain)]/10 text-[var(--gain)]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Total Realized P&L (Today)
              </span>
              <span className={`text-xl font-mono font-black block mt-0.5 ${
                (data?.summary?.totalRealizedPnl ?? 0) >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
              }`}>
                {(data?.summary?.totalRealizedPnl ?? 0) >= 0 ? '+' : ''}
                ₹{(data?.summary?.totalRealizedPnl ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--info)]/10 text-[var(--info)]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 2. Filter Bar: Search + Segmented Tabs + Refresh */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--bg-surface-inset)] p-2.5 rounded-xl border border-[var(--border-color)]">
          {/* Segmented Tab Switch */}
          <div className="inline-flex rounded-lg bg-[var(--bg-surface)] p-1 border border-[var(--border-color)] shrink-0">
            {(['ALL', 'OPEN', 'CLOSED'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs font-extrabold rounded-md transition cursor-pointer ${
                  tab === t
                    ? 'bg-[var(--primary)] text-[var(--text-on-accent)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {t === 'ALL' ? 'All Active' : t === 'OPEN' ? 'Open Only' : 'Closed Today'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search username, client ID, full name..."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <Button
              variant="secondary"
              size="icon"
              onClick={() => fetchData()}
              disabled={loading}
              title="Refresh positions overview"
              className="h-8 w-8 min-h-[32px] min-w-[32px] shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--primary)]' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 3. DataTable of Active Clients */}
        <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
          <DataTable<ClientOverviewItem>
            columns={columns}
            rows={data?.clients || []}
            rowKey={(c) => c.id}
            isLoading={loading}
            emptyTitle="No Active Clients Today"
            emptyMessage={
              debouncedSearch
                ? `No clients found matching "${debouncedSearch}" for today's active filter.`
                : 'No clients with open positions or closed trades today.'
            }
            onRowClick={(client) => toggleExpand(client.id)}
            isRowExpanded={(client) => expandedUserIds.has(client.id)}
            renderExpandedRow={renderExpandedRow}
          />
        </div>

        {/* 4. Pagination Footer */}
        {totalClients > 0 && (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
            <span className="font-mono">
              Showing {Math.min(totalClients, offset + 1)}–{Math.min(totalClients, offset + limit)} of {totalClients} clients
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <span className="font-mono font-bold px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + limit >= totalClients || loading}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

      </div>
    </Dialog>
  );
};
