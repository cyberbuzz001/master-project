import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Target, ShieldAlert, AlertTriangle, X, Search, Send, Zap, Clock,
  History, SlidersHorizontal, CheckCircle2, ChevronUp, ChevronDown, Layers, Timer,
  FileText
} from 'lucide-react';
import { useMarketSocket, useSubscribeTokens } from '../hooks/useMarketSocket';
import { Card, Badge, DataTable, DataTableColumn, Button, Dialog, LivePriceCell } from './ui';
import { PortfolioNav } from './PortfolioNav';
import { pnlColorClass, formatPnl, formatPnlPct } from '../utils/pnl';
import { getLotSizeForSymbol } from '../utils/lotSize';
import { normalizeToken } from '../utils/symbology';
import { ContractNoteModal } from './ContractNoteModal';
import { useToast } from '../context/ToastContext';

type PortfolioTab = 'POSITIONS' | 'ORDERS' | 'TRADE_HISTORY';

interface OrdersPositionsViewProps {
  token: string;
  initialTab?: PortfolioTab;
  onRefreshWallet?: () => void;
  onOpenOptionChain?: (symbol?: string) => void;
  riskRestriction?: string | null;
}

function getNetQty(p: any): number {
  return p.netQty !== undefined
    ? p.netQty
    : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
}

export const OrdersPositionsView: React.FC<OrdersPositionsViewProps> = ({
  token,
  initialTab = 'POSITIONS',
  onRefreshWallet,
  onOpenOptionChain,
  riskRestriction,
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const activeTab = initialTab;
  const [mobileTab, setMobileTab] = useState<PortfolioTab>(initialTab);

  useEffect(() => {
    setMobileTab(initialTab);
  }, [initialTab]);
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'ACCEPTED' | 'FILLED' | 'CANCELLED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTotalExpanded, setIsTotalExpanded] = useState(false);
  const [selectedMobilePos, setSelectedMobilePos] = useState<any | null>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isContractNoteOpen, setIsContractNoteOpen] = useState(false);

  const [squareOffModalPos, setSquareOffModalPos] = useState<any | null>(null);
  const [targetModalPos, setTargetModalPos] = useState<any | null>(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [targetPriceError, setTargetPriceError] = useState<string | null>(null);
  const [isTargetConfirmStep, setIsTargetConfirmStep] = useState(false);
  const [editingTargetOrder, setEditingTargetOrder] = useState<any | null>(null);
  const [cancelTargetModalOrder, setCancelTargetModalOrder] = useState<any | null>(null);
  const [isSubmittingExit, setIsSubmittingExit] = useState(false);
  const [isExitAllModalOpen, setIsExitAllModalOpen] = useState(false);
  const [misTimeRemaining, setMisTimeRemaining] = useState<string | null>(null);

  // Position Averaging State
  const [averageModalPos, setAverageModalPos] = useState<any | null>(null);
  const [averageLots, setAverageLots] = useState<number>(1);
  const [averageOrderType, setAverageOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [averageLimitPrice, setAverageLimitPrice] = useState<string>('');
  const [isSubmittingAverage, setIsSubmittingAverage] = useState<boolean>(false);
  const [averageError, setAverageError] = useState<string | null>(null);

  // Stop-Loss & Trailing Stop-Loss State
  const [slModalPos, setSlModalPos] = useState<any | null>(null);
  const [slPrice, setSlPrice] = useState<string>('');
  const [trailingSlStep, setTrailingSlStep] = useState<string>('');
  const [trailingSlJump, setTrailingSlJump] = useState<string>('');
  const [slError, setSlError] = useState<string | null>(null);
  const [isSubmittingSl, setIsSubmittingSl] = useState<boolean>(false);

  useEffect(() => {
    const updateMisTimer = () => {
      const now = new Date();
      // Calculate IST time (UTC + 5:30)
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const istTime = new Date(utc + 5.5 * 3600000);
      
      const target = new Date(istTime);
      target.setHours(15, 20, 0, 0); // 3:20 PM IST auto square-off
      
      const diff = target.getTime() - istTime.getTime();
      if (diff > 0 && istTime.getHours() >= 9) {
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        setMisTimeRemaining(`${hours}h ${mins}m`);
      } else {
        setMisTimeRemaining(null);
      }
    };

    updateMisTimer();
    const timer = setInterval(updateMisTimer, 30000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to indices tokens + open position tokens for live price feeds
  const INDEX_TOKENS = ['NSE_NIFTY50', 'BSE_SENSEX', 'NSE_BANKNIFTY', 'NSE_FINNIFTY'];

  const subscribedTokens = useMemo(() => {
    const set = new Set<string>(INDEX_TOKENS);
    positions.forEach((p) => {
      const sym = p.symbol || '';
      const instToken = p.instrumentToken || p.instrument_token || '';
      if (instToken) {
        normalizeToken(instToken).forEach(t => set.add(t));
      }
      if (sym) {
        normalizeToken(sym).forEach(t => set.add(t));
      }
    });
    return Array.from(set);
  }, [positions]);

  const { ticks } = useMarketSocket();
  useSubscribeTokens(subscribedTokens);

  const getLiveLtp = (item: any): number => {
    const sym = item.symbol || '';
    const instToken = item.instrumentToken || item.instrument_token || '';
    const avgPrice = parseFloat(item.averagePrice || item.average_price || item.currentPrice || 0);

    const candidates = [
      instToken,
      sym,
      ...(instToken ? normalizeToken(instToken) : []),
      ...(sym ? normalizeToken(sym) : [])
    ];

    for (const c of candidates) {
      if (!c) continue;
      const tick = ticks.get(c);
      if (tick && tick.ltp > 0) return tick.ltp;
    }

    if (item.ltp && parseFloat(item.ltp) > 0) return parseFloat(item.ltp);
    return avgPrice;
  };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    await Promise.allSettled([
      fetch('/api/v1/orders?todayOnly=true', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.orders)) setOrders(data.orders);
        }),
      fetch('/api/v1/portfolio/positions?todayOnly=true', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.positions)) setPositions(data.positions);
        }),
      fetch('/api/v1/portfolio/closed-trades?todayOnly=true', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.closedTrades)) setClosedTrades(data.closedTrades);
        }),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 7500);
    return () => clearInterval(interval);
  }, [token]);

  const getActiveTargetOrder = (pos: any) => {
    const netQty = getNetQty(pos);
    if (netQty === 0) return null;
    const targetSide = netQty > 0 ? 'SELL' : 'BUY';
    return orders.find(
      (o) =>
        (o.status === 'ACCEPTED' || o.status === 'PENDING') &&
        o.symbol === pos.symbol &&
        o.side === targetSide &&
        (o.orderType === 'LIMIT' || o.order_type === 'LIMIT')
    );
  };

  const submitOrder = (body: Record<string, any>) =>
    fetch('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const confirmSquareOff = async () => {
    if (!squareOffModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);
    try {
      const pos = squareOffModalPos;
      const netQty = getNetQty(pos);
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const livePrice = getLiveLtp(pos);
      const data = await submitOrder({
        instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
        exchange: pos.exchange || (pos.symbol.includes('SENSEX') ? 'BSE' : 'NSE'),
        symbol: pos.symbol,
        side,
        quantity,
        price: livePrice,
        orderType: 'MARKET',
        productType: pos.productType || pos.product_type || 'MIS',
      });
      if (data.success) {
        navigator.vibrate?.([30, 50, 30]);
        setActionMessage({
          type: 'success',
          text: `Square-off MARKET order executed for ${pos.symbol} (${quantity} qty) @ ₹${livePrice.toFixed(2)}`,
        });
        fetchData();
        onRefreshWallet?.();
      } else {
        setActionMessage({ type: 'error', text: `Square-off rejected: ${data.error?.message || 'Unknown error'}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Square-off network error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setSquareOffModalPos(null);
      setSelectedMobilePos(null);
    }
  };

  const handleOpenSetTargetModal = (pos: any, existingOrder?: any) => {
    navigator.vibrate?.(20);
    setTargetModalPos(pos);
    setEditingTargetOrder(existingOrder || null);
    setTargetPrice(existingOrder ? (existingOrder.price || '').toString() : '');
    setTargetPriceError(null);
    setIsTargetConfirmStep(false);
    setSelectedMobilePos(null);
  };

  const handleProceedToTargetConfirm = () => {
    if (!targetModalPos) return;
    const priceNum = parseFloat(targetPrice);
    if (!priceNum || priceNum <= 0) {
      setTargetPriceError('Enter a valid target price greater than ₹0.00');
      return;
    }
    const liveLtp = getLiveLtp(targetModalPos);
    const netQty = getNetQty(targetModalPos);
    if (netQty > 0 && priceNum <= liveLtp) {
      setTargetPriceError(`Target exit price for LONG position must be higher than current LTP (₹${liveLtp.toFixed(2)})`);
      return;
    }
    if (netQty < 0 && priceNum >= liveLtp) {
      setTargetPriceError(`Target exit price for SHORT position must be lower than current LTP (₹${liveLtp.toFixed(2)})`);
      return;
    }
    setTargetPriceError(null);
    setIsTargetConfirmStep(true);
  };

  const confirmPlaceTargetOrder = async () => {
    if (!targetModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);
    try {
      const pos = targetModalPos;
      const netQty = getNetQty(pos);
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const priceNum = parseFloat(targetPrice);

      if (editingTargetOrder) {
        await fetch(`/api/v1/orders/${editingTargetOrder.id || editingTargetOrder.orderId || editingTargetOrder.order_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const data = await submitOrder({
        instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
        exchange: pos.exchange || (pos.symbol.includes('SENSEX') ? 'BSE' : 'NSE'),
        symbol: pos.symbol,
        side,
        quantity,
        price: priceNum,
        orderType: 'LIMIT',
        productType: pos.productType || pos.product_type || 'MIS',
      });

      if (data.success) {
        toast.trade({
          status: 'PLACED',
          side,
          symbol: pos.symbol,
          quantity,
          price: priceNum,
          orderType: 'LIMIT',
        });
        setActionMessage({
          type: 'success',
          text: `Target LIMIT order placed for ${pos.symbol} @ ₹${priceNum.toFixed(2)} (${quantity} qty)`,
        });
        fetchData();
      } else {
        toast.trade({
          status: 'REJECTED',
          side,
          symbol: pos.symbol,
          quantity,
          reason: data.error?.message || 'Unknown error',
        });
        setActionMessage({ type: 'error', text: `Target order failed: ${data.error?.message || 'Unknown error'}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Target order error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setTargetModalPos(null);
      setIsTargetConfirmStep(false);
    }
  };

  const confirmCancelTargetOrder = async () => {
    if (!cancelTargetModalOrder) return;
    try {
      const res = await fetch(`/api/v1/orders/${cancelTargetModalOrder.id || cancelTargetModalOrder.orderId || cancelTargetModalOrder.order_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.trade({
          status: 'CANCELLED',
          side: 'SELL',
          symbol: cancelTargetModalOrder.symbol,
          quantity: '',
        });
        setActionMessage({ type: 'success', text: 'Target LIMIT order cancelled.' });
        fetchData();
      }
    } catch (_) {
    } finally {
      setCancelTargetModalOrder(null);
    }
  };

  const handleOpenAverageModal = (pos: any) => {
    navigator.vibrate?.(20);
    setAverageModalPos(pos);
    setAverageLots(1);
    setAverageOrderType('MARKET');
    const livePrice = getLiveLtp(pos);
    setAverageLimitPrice(livePrice > 0 ? livePrice.toFixed(2) : '');
    setAverageError(null);
    setSelectedMobilePos(null);
  };

  const confirmPlaceAverageOrder = async () => {
    if (!averageModalPos || isSubmittingAverage) return;
    setIsSubmittingAverage(true);
    setAverageError(null);
    try {
      const pos = averageModalPos;
      const netQty = getNetQty(pos);
      const side = netQty > 0 ? 'BUY' : 'SELL';
      const lotSize = getLotSizeForSymbol(pos.symbol);
      const totalAddQty = averageLots * lotSize;
      const livePrice = getLiveLtp(pos);
      const priceNum = averageOrderType === 'LIMIT' ? (parseFloat(averageLimitPrice) || livePrice) : livePrice;

      const data = await submitOrder({
        instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
        exchange: pos.exchange || (pos.symbol.includes('SENSEX') ? 'BSE' : 'NSE'),
        symbol: pos.symbol,
        side,
        quantity: totalAddQty,
        price: priceNum,
        orderType: averageOrderType,
        productType: pos.productType || pos.product_type || 'MIS',
      });

      if (data.success) {
        navigator.vibrate?.([30, 50, 30]);
        setActionMessage({
          type: 'success',
          text: `Averaging ${side} order placed for ${pos.symbol} (${totalAddQty} qty) @ ₹${priceNum.toFixed(2)}`,
        });
        fetchData();
        onRefreshWallet?.();
        setAverageModalPos(null);
      } else {
        setAverageError(data.error?.message || 'Averaging order failed');
      }
    } catch (err: any) {
      setAverageError(`Network error: ${err.message}`);
    } finally {
      setIsSubmittingAverage(false);
    }
  };

  const handleOpenSlModal = (pos: any) => {
    navigator.vibrate?.(20);
    setSlModalPos(pos);
    setSlPrice(pos.stopLossPrice ? pos.stopLossPrice.toString() : '');
    setTrailingSlStep(pos.trailingSlStep ? pos.trailingSlStep.toString() : '');
    setTrailingSlJump(pos.trailingSlJump ? pos.trailingSlJump.toString() : '');
    setSlError(null);
    setSelectedMobilePos(null);
  };

  const confirmSetSl = async () => {
    if (!slModalPos || isSubmittingSl) return;
    setIsSubmittingSl(true);
    setSlError(null);
    try {
      const pos = slModalPos;
      const netQty = getNetQty(pos);
      const priceNum = slPrice.trim() ? parseFloat(slPrice) : null;
      const stepNum = trailingSlStep.trim() ? parseFloat(trailingSlStep) : null;
      const jumpNum = trailingSlJump.trim() ? parseFloat(trailingSlJump) : null;
      const liveLtp = getLiveLtp(pos);

      if (priceNum !== null) {
        if (priceNum <= 0) {
          setSlError('Stop-Loss price must be greater than ₹0.00');
          setIsSubmittingSl(false);
          return;
        }
        if (netQty > 0 && priceNum >= liveLtp) {
          setSlError(`Stop-loss for LONG position must be below current LTP (₹${liveLtp.toFixed(2)})`);
          setIsSubmittingSl(false);
          return;
        }
        if (netQty < 0 && priceNum <= liveLtp) {
          setSlError(`Stop-loss for SHORT position must be above current LTP (₹${liveLtp.toFixed(2)})`);
          setIsSubmittingSl(false);
          return;
        }
      }

      const res = await fetch('/api/v1/portfolio/positions/set-sl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          positionId: pos.id,
          stopLossPrice: priceNum,
          trailingSlStep: stepNum,
          trailingSlJump: jumpNum,
        }),
      });

      const data = await res.json();
      if (data.success) {
        navigator.vibrate?.([30, 50, 30]);
        setActionMessage({
          type: 'success',
          text: priceNum
            ? `Stop-Loss set for ${pos.symbol} @ ₹${priceNum.toFixed(2)}${stepNum ? ` (Trailing +₹${stepNum})` : ''}`
            : `Stop-Loss removed for ${pos.symbol}`,
        });
        fetchData();
        setSlModalPos(null);
      } else {
        setSlError(data.error?.message || 'Failed to update Stop-Loss');
      }
    } catch (err: any) {
      setSlError(`Network error: ${err.message}`);
    } finally {
      setIsSubmittingSl(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.trade({
          status: 'CANCELLED',
          side: 'BUY',
          symbol: `Order #${orderId.slice(-6)}`,
          quantity: '',
        });
        setActionMessage({ type: 'success', text: `Order ${orderId} cancelled successfully.` });
        fetchData();
      } else {
        toast.error('Cancel Failed', data.error?.message || 'Unknown error');
        setActionMessage({ type: 'error', text: `Failed to cancel order: ${data.error?.message || 'Unknown error'}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Error cancelling order: ${err.message}` });
    }
  };

  const confirmExitAllPositions = async () => {
    if (isSubmittingExit || openPositions.length === 0) return;
    setIsSubmittingExit(true);
    try {
      for (const pos of openPositions) {
        const netQty = getNetQty(pos);
        const side = netQty > 0 ? 'SELL' : 'BUY';
        const quantity = Math.abs(netQty);
        const livePrice = getLiveLtp(pos);
        await submitOrder({
          instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
          exchange: pos.exchange || (pos.symbol.includes('SENSEX') ? 'BSE' : 'NSE'),
          symbol: pos.symbol,
          side,
          quantity,
          price: livePrice,
          orderType: 'MARKET',
          productType: pos.productType || pos.product_type || 'MIS',
        });
      }
      navigator.vibrate?.([40, 60, 40]);
      setActionMessage({ type: 'success', text: `Square off MARKET orders sent for all ${openPositions.length} positions.` });
      fetchData();
      onRefreshWallet?.();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Bulk exit error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setIsExitAllModalOpen(false);
    }
  };

  const openPositions = useMemo(() => positions.filter((p) => getNetQty(p) !== 0), [positions]);

  const totalUnrealizedPnl = useMemo(() => {
    return openPositions.reduce((acc, pos) => {
      const netQty = getNetQty(pos);
      const absQty = Math.abs(netQty);
      const avgPrice = parseFloat(pos.averagePrice || pos.average_price || pos.entryPrice || 0);
      const ltp = getLiveLtp(pos);
      const uPnl = netQty > 0 ? (ltp - avgPrice) * netQty : absQty * (avgPrice - ltp);
      return acc + uPnl;
    }, 0);
  }, [openPositions, ticks]);

  const totalRealizedPnl = useMemo(() => {
    return positions.length > 0
      ? positions.reduce((acc, p) => acc + parseFloat(p.realizedPnl || p.realized_pnl || 0), 0)
      : closedTrades.reduce((acc, ct) => acc + parseFloat(ct.netPnl || ct.realizedPnl || 0), 0);
  }, [positions, closedTrades]);

  const totalPositionPnl = totalUnrealizedPnl + totalRealizedPnl;

  const isTodayOrder = (o: any) => {
    if (!o.createdAt && !o.created_at) return true;
    const orderDate = new Date(o.createdAt || o.created_at);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  };

  const filteredOrders = useMemo(() => {
    let list = orders.filter(isTodayOrder);
    if (orderFilter !== 'ALL') {
      list = list.filter((o) => (o.status || '').toUpperCase() === orderFilter);
    }
    if (searchQuery.trim()) {
      list = list.filter((o) => (o.symbol || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [orders, orderFilter, searchQuery]);

  const filteredPositions = useMemo(() => {
    let list = openPositions;
    if (searchQuery.trim()) {
      list = list.filter((p) => (p.symbol || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [openPositions, searchQuery]);

  const filteredClosedTrades = useMemo(() => {
    let list = closedTrades;
    if (searchQuery.trim()) {
      list = list.filter((ct) => (ct.symbol || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [closedTrades, searchQuery]);

  // Mobile position list filtering
  const filteredMobilePositions = useMemo(() => {
    let list: any[] = [];
    if (positionFilter === 'OPEN') {
      list = openPositions;
    } else if (positionFilter === 'CLOSED') {
      list = closedTrades;
    } else {
      list = [...openPositions, ...closedTrades];
    }
    if (searchQuery.trim()) {
      list = list.filter((p) => (p.symbol || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [positionFilter, openPositions, closedTrades, searchQuery]);

  // Mobile indices ticks
  const niftyTick = ticks.get('NSE_NIFTY50') || ticks.get('NIFTY50');
  const sensexTick = ticks.get('BSE_SENSEX') || ticks.get('SENSEX') || ticks.get('BSE SENSEX');
  const bankNiftyTick = ticks.get('NSE_BANKNIFTY') || ticks.get('BANKNIFTY');

  // Desktop DataTable column definitions
  const positionColumns: DataTableColumn<any>[] = [
    {
      key: 'symbol',
      header: 'Instrument',
      mobilePrimary: true,
      render: (p) => {
        const netQty = getNetQty(p);
        const lotSize = getLotSizeForSymbol(p.symbol || '');
        const absQty = Math.abs(netQty);
        const lots = lotSize > 0 ? Math.round(absQty / lotSize) : 0;
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{p.symbol}</span>
            <Badge variant="neutral">{p.productType || p.product_type || 'MIS'}</Badge>
            {lots > 0 && <span className="text-[10px] text-[var(--text-muted)] font-mono font-bold">({lots}L)</span>}
          </div>
        );
      },
    },
    {
      key: 'netQty',
      header: 'Net Qty',
      align: 'right',
      render: (p) => {
        const netQty = getNetQty(p);
        return (
          <span className={`font-mono font-bold ${netQty > 0 ? 'text-[var(--gain)]' : netQty < 0 ? 'text-[var(--loss)]' : 'text-[var(--text-muted)]'}`}>
            {netQty > 0 ? `+${netQty}` : netQty}
          </span>
        );
      },
    },
    {
      key: 'avgPrice',
      header: 'Avg Price',
      align: 'right',
      mobileHidden: true,
      render: (p) => (
        <span className="font-mono tabular-nums text-[var(--text-main)]">
          ₹{parseFloat(p.averagePrice || p.average_price || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'ltp',
      header: 'LTP',
      align: 'right',
      render: (p) => {
        const ltp = getLiveLtp(p);
        const avg = parseFloat(p.averagePrice || p.average_price || 0);
        const diff = ltp - avg;
        return (
          <div className="font-mono tabular-nums flex items-center justify-end gap-1">
            <LivePriceCell value={ltp} prefix="₹" decimals={2} className="!text-xs font-bold" />
            <span className={`text-[10px] ${pnlColorClass(diff)}`}>
              ({diff >= 0 ? '+' : ''}{diff.toFixed(2)})
            </span>
          </div>
        );
      },
    },
    {
      key: 'pnl',
      header: 'Unrealized P&L',
      align: 'right',
      render: (p) => {
        const netQty = getNetQty(p);
        const absQty = Math.abs(netQty);
        const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
        const ltp = getLiveLtp(p);
        const upnl = netQty > 0 ? (ltp - avgPrice) * netQty : absQty * (avgPrice - ltp);
        return (
          <LivePriceCell
            value={upnl}
            prefix="₹"
            showSign
            colorBySign
            className="!text-xs font-black"
          />
        );
      },
    },
    {
      key: 'target_sl',
      header: 'Target / SL',
      align: 'center',
      mobileHidden: true,
      render: (p) => {
        const target = getActiveTargetOrder(p);
        const hasSl = p.stopLossPrice !== null && p.stopLossPrice !== undefined && p.stopLossPrice > 0;
        return (
          <div className="flex flex-col items-center gap-1">
            {target && <Badge variant="info">TGT ₹{parseFloat(target.price).toFixed(2)}</Badge>}
            {hasSl && (
              <Badge variant="warning">
                SL ₹{parseFloat(p.stopLossPrice).toFixed(2)}{p.trailingSlStep ? ` (TSL +₹${p.trailingSlStep})` : ''}
              </Badge>
            )}
            {!target && !hasSl && <span className="text-[var(--text-muted)] text-xs">—</span>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      mobileHidden: true,
      render: (p) => (
        <PositionRowActions
          pos={p}
          activeTarget={getActiveTargetOrder(p)}
          onSetTarget={handleOpenSetTargetModal}
          onSetSl={handleOpenSlModal}
          onAverage={handleOpenAverageModal}
          onSquareOff={setSquareOffModalPos}
          onCancelTarget={setCancelTargetModalOrder}
        />
      ),
    },
  ];

  const orderColumns: DataTableColumn<any>[] = [
    {
      key: 'time',
      header: 'Time',
      render: (o) => (
        <span className="font-mono text-[11px] text-[var(--text-muted)]">
          {o.createdAt || o.created_at ? new Date(o.createdAt || o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Today'}
        </span>
      ),
    },
    {
      key: 'symbol',
      header: 'Symbol',
      mobilePrimary: true,
      render: (o) => (
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs text-[var(--text-main)]">{o.symbol}</span>{' '}
          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${o.side === 'BUY' ? 'bg-[var(--gain-light)] text-[var(--gain)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'}`}>
            {o.side}
          </span>
        </div>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', render: (o) => <span className="font-mono font-bold">{o.quantity}</span> },
    { key: 'price', header: 'Price', align: 'right', render: (o) => <span className="font-mono font-bold">₹{parseFloat(o.price || 0).toFixed(2)}</span> },
    {
      key: 'type',
      header: 'Type',
      mobileHidden: true,
      render: (o) => <Badge variant="neutral">{o.orderType || o.order_type || 'MARKET'}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (o) => {
        const statusUpper = (o.status || '').toUpperCase();
        const variant =
          statusUpper === 'FILLED' || statusUpper === 'COMPLETED' ? 'gain' : statusUpper === 'REJECTED' ? 'loss' : statusUpper === 'CANCELLED' ? 'neutral' : 'warning';
        const isMarginRejection = statusUpper === 'REJECTED' && (o.rejectionReason?.toLowerCase().includes('margin') || o.rejectionReason?.toLowerCase().includes('fund'));
        return (
          <div className="flex flex-col items-center gap-0.5">
            <Badge variant={variant}>{o.status}</Badge>
            {o.rejectionReason && (
              <span className="text-[10px] text-[var(--loss)] max-w-[140px] truncate" title={o.rejectionReason}>
                {o.rejectionReason}
              </span>
            )}
            {isMarginRejection && (
              <a
                href="/profile?tab=FUNDS"
                className="text-[10px] font-black text-[var(--primary)] underline hover:text-[var(--primary)]/80"
              >
                + Add Funds
              </a>
            )}
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      mobileHidden: true,
      render: (o) =>
        ['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(o.status) ? (
          <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(o.id || o.order_id || o.orderId)}>
            Cancel
          </Button>
        ) : null,
    },
  ];

  const historyColumns: DataTableColumn<any>[] = [
    {
      key: 'time',
      header: 'Closed',
      mobileHidden: true,
      render: (ct) => (ct.closedAt ? new Date(ct.closedAt).toLocaleTimeString() : 'Today'),
    },
    {
      key: 'symbol',
      header: 'Instrument',
      mobilePrimary: true,
      render: (ct) => <span className="font-bold text-sm">{ct.symbol}</span>,
    },
    {
      key: 'direction',
      header: 'Direction',
      mobileHidden: true,
      render: (ct) => (
        <span>
          <span className={ct.entrySide === 'BUY' ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>{ct.entrySide}</span> →{' '}
          <span className={ct.exitSide === 'SELL' ? 'text-[var(--loss)]' : 'text-[var(--gain)]'}>{ct.exitSide}</span>
        </span>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', mobileHidden: true, render: (ct) => ct.quantity },
    { key: 'entry', header: 'Entry', align: 'right', mobileHidden: true, render: (ct) => `₹${parseFloat(ct.entryPrice || 0).toFixed(2)}` },
    { key: 'exit', header: 'Exit', align: 'right', render: (ct) => `₹${parseFloat(ct.exitPrice || 0).toFixed(2)}` },
    {
      key: 'pnl',
      header: 'Realized P&L',
      align: 'right',
      render: (ct) => {
        const isProfit = (ct.netPnl || 0) >= 0;
        return (
          <span className={`font-black ${isProfit ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
            {isProfit ? '+' : ''}₹{parseFloat(ct.netPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'reason',
      header: 'Exit Reason',
      align: 'center',
      render: (ct) => {
        const variant =
          ct.exitReason === 'TARGET_LIMIT' ? 'info' : (ct.exitReason || '').includes('SQUARE_OFF') ? 'warning' : 'neutral';
        return <Badge variant={variant}>{ct.exitReason ? ct.exitReason.replace(/_/g, ' ') : 'SQUARE OFF'}</Badge>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-0 font-body text-[var(--text-main)]">

      {/* ════════════════════════════════════════════════════════════════════════
          1. MOBILE INTERFACE (MATCHING EXACT BROKER SCREENSHOT)
         ════════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden space-y-2.5">
        {/* ── Top Header Navigation Bar (Positions, Orders, History, Holdings, Analytics, Journal) ── */}
        <div className="flex items-center justify-between pb-1 pt-1 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 max-w-[calc(100vw-85px)]">
            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(15);
                setMobileTab('POSITIONS');
                navigate('/portfolio/positions');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                mobileTab === 'POSITIONS'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
              }`}
            >
              Positions {openPositions.length > 0 && `(${openPositions.length})`}
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(15);
                setMobileTab('ORDERS');
                navigate('/portfolio/orders');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                mobileTab === 'ORDERS'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
              }`}
            >
              Orders {orders.filter(isTodayOrder).length > 0 && `(${orders.filter(isTodayOrder).length})`}
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(15);
                setMobileTab('TRADE_HISTORY');
                navigate('/portfolio/history');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                mobileTab === 'TRADE_HISTORY'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
              }`}
            >
              History {closedTrades.length > 0 && `(${closedTrades.length})`}
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(15);
                navigate('/portfolio/holdings');
              }}
              className="px-3 py-1 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-all whitespace-nowrap cursor-pointer"
            >
              Holdings
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(15);
                navigate('/portfolio/analytics');
              }}
              className="px-3 py-1 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-all whitespace-nowrap cursor-pointer"
            >
              Analytics
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(15);
                navigate('/portfolio/journal');
              }}
              className="px-3 py-1 rounded-xl text-xs font-bold text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 transition-all whitespace-nowrap cursor-pointer"
            >
              ⚡ Journal &amp; Savings
            </button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={fetchData}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Search Input (When Search Icon is Clicked) ── */}
        {isSearchOpen && (
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol (e.g. NIFTY, SENSEX)..."
              className="w-full pl-9 pr-9 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-emerald-500 shadow-2xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 text-[var(--text-muted)]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ── Sub-Ticker Strip (NIFTY / SENSEX / BANK NIFTY with Expiry Pills) ── */}
        <div className="flex gap-2.5 overflow-x-auto scrollbar-none py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {/* NIFTY Card */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-2.5 min-w-[145px] flex-shrink-0 shadow-2xs">
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <span className="text-[11px] font-black text-[var(--text-main)]">NIFTY</span>
              <span className="text-[9px] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-md font-mono font-bold">Expiry Tue</span>
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <LivePriceCell
                value={niftyTick ? niftyTick.ltp : 24265.20}
                prefix=""
                decimals={2}
                className="!text-xs !font-bold !text-[var(--text-main)] !p-0 !bg-transparent"
              />
              <span className={`text-[10px] font-bold ${niftyTick && niftyTick.change < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {niftyTick ? `${niftyTick.change > 0 ? '+' : ''}${niftyTick.change.toFixed(2)} (${niftyTick.changePercent.toFixed(2)}%)` : '+33.35 (0.14%)'}
              </span>
            </div>
          </div>

          {/* SENSEX Card */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-2.5 min-w-[145px] flex-shrink-0 shadow-2xs">
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <span className="text-[11px] font-black text-[var(--text-main)]">SENSEX</span>
              <span className="text-[9px] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-md font-mono font-bold">Expiry Thu</span>
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <LivePriceCell
                value={sensexTick ? sensexTick.ltp : 73600.00}
                prefix=""
                decimals={2}
                className="!text-xs !font-bold !text-[var(--text-main)] !p-0 !bg-transparent"
              />
              <span className={`text-[10px] font-bold ${sensexTick && sensexTick.change < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {sensexTick ? `${sensexTick.change > 0 ? '+' : ''}${sensexTick.change.toFixed(2)} (${sensexTick.changePercent.toFixed(2)}%)` : '+121.45 (0.16%)'}
              </span>
            </div>
          </div>

          {/* BANK NIFTY Card */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-2.5 min-w-[145px] flex-shrink-0 shadow-2xs">
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <span className="text-[11px] font-black text-[var(--text-main)]">BANK NIFTY</span>
              <span className="text-[9px] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-md font-mono font-bold">Expiry Wed</span>
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <LivePriceCell
                value={bankNiftyTick ? bankNiftyTick.ltp : 57720.10}
                prefix=""
                decimals={2}
                className="!text-xs !font-bold !text-[var(--text-main)] !p-0 !bg-transparent"
              />
              <span className={`text-[10px] font-bold ${bankNiftyTick && bankNiftyTick.change < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {bankNiftyTick ? `${bankNiftyTick.change > 0 ? '+' : ''}${bankNiftyTick.change.toFixed(2)} (${bankNiftyTick.changePercent.toFixed(2)}%)` : '+145.20 (0.25%)'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Sub-Action & Filter Row (ALL / OPEN / CLOSED + SECURE EXIT) ── */}
        <div className="flex items-center justify-between py-1">
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(15);
              setPositionFilter((prev) => (prev === 'ALL' ? 'OPEN' : prev === 'OPEN' ? 'CLOSED' : 'ALL'));
            }}
            className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            title="Toggle Position Filter"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-black uppercase tracking-wider">{positionFilter} ({filteredMobilePositions.length})</span>
          </button>

          {openPositions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(25);
                setIsExitAllModalOpen(true);
              }}
              className="flex items-center gap-1 text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>SECURE EXIT</span>
            </button>
          )}
        </div>

        {/* ── Action Notification Banner ── */}
        {actionMessage && (
          <div
            className={`p-2.5 rounded-xl text-xs font-bold border flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button type="button" onClick={() => setActionMessage(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── POSITIONS LIST (Mobile Cards) ── */}
        {mobileTab === 'POSITIONS' && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl divide-y divide-[var(--border-color)] shadow-xs overflow-hidden">
            {filteredMobilePositions.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Zap className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
                <h3 className="text-xs font-bold text-[var(--text-main)]">{searchQuery ? 'No matching positions' : 'No open positions'}</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Your open intraday & F&O trading positions will appear here.</p>
                {onOpenOptionChain && (
                  <Button size="sm" className="mt-2" onClick={() => onOpenOptionChain()}>Browse Option Chain</Button>
                )}
              </div>
            ) : (
              filteredMobilePositions.map((pos: any) => {
                const netQty = getNetQty(pos);
                const absQty = Math.abs(netQty);
                const isClosed = netQty === 0;
                const avgPrice = parseFloat(pos.averagePrice || pos.average_price || pos.entryPrice || 0);
                const ltp = isClosed ? parseFloat(pos.exitPrice || 0) : getLiveLtp(pos);
                const uPnl = isClosed
                  ? parseFloat(pos.netPnl || pos.realizedPnl || 0)
                  : (netQty > 0 ? (ltp - avgPrice) * netQty : absQty * (avgPrice - ltp));
                const isGain = uPnl >= 0;
                const investedValue = avgPrice * absQty;
                const pnlPct = investedValue > 0 ? (uPnl / investedValue) * 100 : (avgPrice > 0 ? ((ltp - avgPrice) / avgPrice) * 100 : 0);
                const lotSize = getLotSizeForSymbol(pos.symbol || '');
                const lots = lotSize > 0 ? Math.round(absQty / lotSize) : 0;
                const activeTarget = getActiveTargetOrder(pos);

                return (
                  <div
                    key={pos.id || pos.symbol || pos.executionId}
                    onClick={() => {
                      navigator.vibrate?.(15);
                      setSelectedMobilePos(pos);
                    }}
                    className="p-3.5 hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer active:scale-[0.99] space-y-1.5"
                  >
                    {/* Row 1: Symbol & P&L */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-extrabold text-[14px] text-[var(--text-main)] tracking-tight">
                          {pos.symbol}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div
                          className={`font-mono text-[14px] font-black tabular-nums ${
                            isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isGain ? '+' : ''}₹{uPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Lots & Product Tag + LTP & % Change */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--text-muted)] font-semibold">{lots > 0 ? `${lots} Lot` : `${absQty} Qty`}</span>
                        <span className="px-1.5 py-0.2 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] text-[10px] font-bold uppercase border border-[var(--border-color)]">
                          {pos.productType || pos.product_type || 'NRML'}
                        </span>
                        {activeTarget && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold font-mono border border-emerald-500/20">
                            TGT ₹{parseFloat(activeTarget.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[var(--text-muted)]">LTP </span>
                        <span className="font-bold text-[var(--text-main)]">₹{ltp.toFixed(2)} </span>
                        <span className={`font-bold ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Buy Price and Sell Price */}
                    <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                      <div>
                        <span>Buy </span>
                        <span className="font-bold text-[var(--text-main)]">₹{avgPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span>Sell </span>
                        <span className="font-bold text-[var(--text-main)]">
                          ₹{isClosed ? ltp.toFixed(2) : (activeTarget ? parseFloat(activeTarget.price).toFixed(2) : ltp.toFixed(2))}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── ORDERS LIST (Mobile View) ── */}
        {mobileTab === 'ORDERS' && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl divide-y divide-[var(--border-color)] shadow-xs overflow-hidden">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Clock className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
                <h3 className="text-xs font-bold text-[var(--text-main)]">No Orders Today</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Orders placed during the current trading session will appear here.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isBuy = (order.side || '').toUpperCase() === 'BUY';
                const isFilled =
                  (order.status || '').toUpperCase() === 'FILLED' || (order.status || '').toUpperCase() === 'COMPLETED';
                const isPending = ['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(
                  (order.status || '').toUpperCase()
                );

                return (
                  <div key={order.orderId || order.id || order.order_id} className="p-3.5 space-y-2 font-mono">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded font-black text-[9px] ${
                            isBuy ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {order.side}
                        </span>
                        <h4 className="font-extrabold text-xs text-[var(--text-main)]">{order.symbol}</h4>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          isFilled
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : isPending
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <div>
                        <span>{order.quantity} Qty • </span>
                        <span className="font-bold text-[var(--text-main)]">{order.orderType || 'MARKET'}</span>
                      </div>
                      <div>
                        <span>Price: </span>
                        <span className="font-black text-[var(--text-main)]">
                          ₹{parseFloat(order.price || order.averagePrice || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {isPending && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelOrder(order.id || order.orderId || order.order_id);
                        }}
                        className="w-full py-1.5 px-3 rounded-lg bg-rose-600/15 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/30 text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel Order</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TRADE HISTORY LIST (Mobile View) ── */}
        {mobileTab === 'TRADE_HISTORY' && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl divide-y divide-[var(--border-color)] shadow-xs overflow-hidden">
            {closedTrades.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <History className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
                <h3 className="text-xs font-bold text-[var(--text-main)]">No Closed Trades Yet</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Completed round-trip trades will appear here with realized P&amp;L.</p>
              </div>
            ) : (
              closedTrades.map((ct: any) => {
                const isProfit = (ct.netPnl || 0) >= 0;
                return (
                  <div key={ct.id || ct.executionId || Math.random()} className="p-3.5 space-y-1.5 font-mono text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-[14px] text-[var(--text-main)]">{ct.symbol}</span>
                        <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                          <span className={ct.entrySide === 'BUY' ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>{ct.entrySide}</span>
                          <span>→</span>
                          <span className={ct.exitSide === 'SELL' ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>{ct.exitSide}</span>
                          <span>•</span>
                          <span>{ct.quantity} Qty</span>
                          <span>•</span>
                          <span className="px-1 py-0.2 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[9px] font-bold">
                            {ct.exitReason ? ct.exitReason.replace(/_/g, ' ') : 'SQUARE OFF'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[14px] font-black ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isProfit ? '+' : ''}₹{parseFloat(ct.netPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-0.5 border-t border-[var(--border-color)]/40">
                      <span>Entry: ₹{parseFloat(ct.entryPrice || 0).toFixed(2)}</span>
                      <span>Exit: ₹{parseFloat(ct.exitPrice || 0).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Sticky Total P&L Bar on Mobile (Floating right above Bottom Nav) ── */}
        {mobileTab === 'POSITIONS' && (
          <div className="fixed bottom-15 left-0 right-0 z-30 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-color)] px-4 py-2.5 flex items-center justify-between shadow-lg">
            <button
              type="button"
              onClick={() => setIsTotalExpanded(!isTotalExpanded)}
              className="flex items-center gap-1.5 cursor-pointer text-left"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
              <span className="text-xs font-black text-[var(--text-main)]">Total P&L</span>
              {isTotalExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              )}
            </button>

            <div
              className={`font-mono text-sm font-black tabular-nums ${
                totalPositionPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {totalPositionPnl >= 0 ? '+' : ''}₹{totalPositionPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        )}

        {/* ── Total P&L Expanded Drawer on Mobile ── */}
        {isTotalExpanded && mobileTab === 'POSITIONS' && (
          <div className="fixed bottom-26 left-0 right-0 z-30 bg-[var(--bg-surface)] border-t border-[var(--border-color)] p-4 shadow-2xl animate-fadeIn space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)] font-semibold">Unrealized P&L:</span>
              <span className={`font-mono font-bold ${pnlColorClass(totalUnrealizedPnl)}`}>
                {formatPnl(totalUnrealizedPnl)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)] font-semibold">Realized P&L:</span>
              <span className={`font-mono font-bold ${pnlColorClass(totalRealizedPnl)}`}>
                {formatPnl(totalRealizedPnl)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
              <span className="text-[var(--text-muted)] font-semibold">Open Positions:</span>
              <span className="font-mono font-bold text-[var(--text-main)]">{openPositions.length} active</span>
            </div>
          </div>
        )}

        {/* ── Mobile Position Detail & Quick Action Drawer ── */}
        {selectedMobilePos && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="w-full sm:max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl text-left">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <div>
                  <h3 className="font-extrabold text-sm text-[var(--text-main)]">{selectedMobilePos.symbol}</h3>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {selectedMobilePos.productType || 'MIS'} • {getNetQty(selectedMobilePos) > 0 ? 'LONG' : 'SHORT'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMobilePos(null)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-full hover:bg-[var(--bg-surface-elevated)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-[var(--bg-surface-elevated)] p-2.5 rounded-xl">
                  <span className="text-[10px] text-[var(--text-muted)] block">Current LTP</span>
                  <span className="font-black text-sm text-[var(--text-main)]">₹{getLiveLtp(selectedMobilePos).toFixed(2)}</span>
                </div>
                <div className="bg-[var(--bg-surface-elevated)] p-2.5 rounded-xl">
                  <span className="text-[10px] text-[var(--text-muted)] block">Avg Entry</span>
                  <span className="font-black text-sm text-[var(--text-main)]">
                    ₹{parseFloat(selectedMobilePos.averagePrice || selectedMobilePos.average_price || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {getNetQty(selectedMobilePos) !== 0 && (
                <div className="space-y-2 pt-2">
                  <Button
                    variant="destructive"
                    className="w-full justify-center font-bold"
                    onClick={() => {
                      setSquareOffModalPos(selectedMobilePos);
                    }}
                  >
                    Square Off Position
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-center font-bold"
                    onClick={() => {
                      handleOpenAverageModal(selectedMobilePos);
                    }}
                  >
                    <Layers className="w-4 h-4 mr-1.5 text-emerald-500" />
                    Average Position (+ Lots)
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-center font-bold"
                    onClick={() => {
                      handleOpenSlModal(selectedMobilePos);
                    }}
                  >
                    <ShieldAlert className="w-4 h-4 mr-1.5 text-amber-500" />
                    {selectedMobilePos.stopLossPrice ? 'Modify Stop-Loss / TSL' : 'Set Stop-Loss / Trailing SL'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-center font-bold"
                    onClick={() => {
                      handleOpenSetTargetModal(selectedMobilePos, getActiveTargetOrder(selectedMobilePos));
                    }}
                  >
                    <Target className="w-4 h-4 mr-1.5 text-blue-400" />
                    {getActiveTargetOrder(selectedMobilePos) ? 'Modify Target Limit' : 'Set Target Limit'}
                  </Button>
                  {onOpenOptionChain && (
                    <Button
                      variant="ghost"
                      className="w-full justify-center text-xs"
                      onClick={() => {
                        setSelectedMobilePos(null);
                        onOpenOptionChain(selectedMobilePos.symbol);
                      }}
                    >
                      <Layers className="w-4 h-4 mr-1.5" />
                      View Option Chain
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          2. DESKTOP INTERFACE (FULL WORKSPACE VIEW)
         ════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col gap-5">
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Portfolio P&L Today</span>
              <span className="w-2 h-2 rounded-full bg-[var(--gain)] animate-pulse" />
              {misTimeRemaining && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Timer className="w-3 h-3" />
                  <span>MIS Auto Square-Off in {misTimeRemaining}</span>
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3 mt-1 font-mono">
              <div className={`text-2xl sm:text-3xl font-black ${pnlColorClass(totalPositionPnl)}`}>
                <LivePriceCell
                  value={totalPositionPnl}
                  prefix="₹"
                  showSign
                  colorBySign
                  className="!text-2xl sm:!text-3xl font-black"
                />
              </div>
              <span className="text-xs text-[var(--text-muted)] font-bold">
                (Unrealized: ₹{totalUnrealizedPnl.toFixed(2)} | Realized: ₹{totalRealizedPnl.toFixed(2)})
              </span>
            </div>
          </div>
          {openPositions.length > 0 && (
            <Button variant="destructive" leftIcon={<ShieldAlert size={15} />} onClick={() => setIsExitAllModalOpen(true)}>
              EXIT ALL POSITIONS ({openPositions.length})
            </Button>
          )}
        </Card>

        {riskRestriction === 'REDUCE_ONLY' && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-light)]">
            <ShieldAlert className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-[var(--warning)]">Account Restricted — Reduce-Only</div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Your account is currently <strong>restricted to reduce-only trading pending risk review</strong>. You can still
                close or reduce existing positions, but new orders will be rejected until cleared.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <PortfolioNav
            active={activeTab}
            counts={{
              POSITIONS: openPositions.length,
              ORDERS: orders.filter(isTodayOrder).length,
              TRADE_HISTORY: closedTrades.length,
            }}
          />
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol..."
                className="pl-8 pr-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-bold w-40"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileText className="w-3.5 h-3.5 text-amber-400" />}
              onClick={() => setIsContractNoteOpen(true)}
            >
              Contract Note (ECN)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              onClick={fetchData}
            >
              Refresh
            </Button>
          </div>
        </div>

        <Card padding="none" className="overflow-hidden">
          <div className="p-3">
            {activeTab === 'POSITIONS' && (
              <DataTable
                columns={positionColumns}
                rows={filteredPositions}
                rowKey={(p) => p.id || p.symbol}
                isLoading={loading && positions.length === 0}
                emptyIcon={<Zap className="w-5 h-5" />}
                emptyTitle={searchQuery ? 'No matching positions' : 'No open positions'}
                emptyMessage={
                  searchQuery
                    ? `Nothing open matches “${searchQuery}”. Clear the search to see all positions.`
                    : 'Intraday and F&O positions you open will show up here with live P&L.'
                }
                emptyAction={
                  searchQuery ? (
                    <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                      Clear search
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => onOpenOptionChain?.()}>
                      Browse Option Chain
                    </Button>
                  )
                }
              />
            )}
            {activeTab === 'ORDERS' && (
              <DataTable
                columns={orderColumns}
                rows={filteredOrders}
                rowKey={(o) => o.id || o.order_id}
                isLoading={loading && orders.length === 0}
                emptyIcon={<Clock className="w-5 h-5" />}
                emptyTitle="No orders today"
                emptyMessage="Every order you place today — filled, pending or rejected — appears here."
                emptyAction={<Button size="sm" onClick={() => onOpenOptionChain?.()}>Place an order</Button>}
              />
            )}
            {activeTab === 'TRADE_HISTORY' && (
              <DataTable
                columns={historyColumns}
                rows={filteredClosedTrades}
                rowKey={(ct) => ct.id || ct.executionId}
                isLoading={loading && closedTrades.length === 0}
                emptyIcon={<History className="w-5 h-5" />}
                emptyTitle="No closed trades today"
                emptyMessage="Once a position is squared off, the settled trade and its realised P&L land here."
              />
            )}
          </div>
        </Card>
      </div>

      {/* ── SHARED ACTION MODALS ── */}
      <Dialog
        isOpen={!!squareOffModalPos}
        onClose={() => setSquareOffModalPos(null)}
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500 w-4 h-4" />Square Off Position?
          </span>
        }
        footer={
          <>
            <Button variant="secondary" disabled={isSubmittingExit} onClick={() => setSquareOffModalPos(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isSubmittingExit} onClick={confirmSquareOff}>
              {isSubmittingExit ? 'Submitting...' : 'Confirm Square Off'}
            </Button>
          </>
        }
      >
        {squareOffModalPos && (() => {
          const pos = squareOffModalPos;
          const netQty = getNetQty(pos);
          const absQty = Math.abs(netQty);
          const liveLtp = getLiveLtp(pos);
          const exitSide = netQty > 0 ? 'SELL' : 'BUY';
          return (
            <div className="space-y-3 text-xs">
              <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-3 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Instrument:</span>
                  <span className="font-bold">{pos.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Quantity:</span>
                  <span className="font-bold text-[var(--gain)]">{absQty} Units ({exitSide})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Current LTP:</span>
                  <span className="font-bold">₹{liveLtp.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
                  <span className="text-[var(--text-muted)]">Estimated Exit Value:</span>
                  <span className="font-bold">₹{(liveLtp * absQty).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="bg-[var(--warning-light)] border border-[var(--warning)]/30 p-3 rounded-xl text-[11px] text-[var(--warning)] leading-relaxed">
                You are about to exit this position using a MARKET order. The actual execution price will come from the exchange fill.
              </div>
            </div>
          );
        })()}
      </Dialog>

      <Dialog
        isOpen={!!targetModalPos}
        onClose={() => {
          setTargetModalPos(null);
          setIsTargetConfirmStep(false);
        }}
        title={
          <span className="flex items-center gap-2">
            <Target className="text-[var(--info)] w-4 h-4" />
            {isTargetConfirmStep ? 'Confirm Target Exit Order' : `Set Target — ${targetModalPos?.symbol || ''}`}
          </span>
        }
        footer={
          isTargetConfirmStep ? (
            <>
              <Button variant="secondary" disabled={isSubmittingExit} onClick={() => setIsTargetConfirmStep(false)}>
                Back
              </Button>
              <Button variant="primary" leftIcon={<Send size={14} />} disabled={isSubmittingExit} onClick={confirmPlaceTargetOrder}>
                {isSubmittingExit ? 'Placing...' : 'Place Target Order'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setTargetModalPos(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleProceedToTargetConfirm}>
                Proceed to Confirmation
              </Button>
            </>
          )
        }
      >
        {targetModalPos && (() => {
          const pos = targetModalPos;
          const netQty = getNetQty(pos);
          const absQty = Math.abs(netQty);
          const liveLtp = getLiveLtp(pos);
          const avgPrice = parseFloat(pos.averagePrice || pos.average_price || liveLtp);
          const exitSide = netQty > 0 ? 'SELL' : 'BUY';
          const targetPriceNum = parseFloat(targetPrice || '0');
          const estTargetPnl = netQty > 0 ? (targetPriceNum - avgPrice) * absQty : (avgPrice - targetPriceNum) * absQty;
          if (!isTargetConfirmStep) {
            return (
              <div className="space-y-3 text-xs">
                <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Current LTP:</span>
                    <span className="font-bold">₹{liveLtp.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Average Entry Price:</span>
                    <span className="font-bold">₹{avgPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Target Exit Side:</span>
                    <span className="font-black">{exitSide} LIMIT</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Target Exit Price (₹) <span className="text-[var(--text-muted)] font-normal">(0.05 tick size)</span>
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={targetPrice}
                    onChange={(e) => {
                      setTargetPrice(e.target.value);
                      setTargetPriceError(null);
                    }}
                    placeholder={netQty > 0 ? `Above ₹${liveLtp.toFixed(2)}` : `Below ₹${liveLtp.toFixed(2)}`}
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--primary)]"
                  />
                  {targetPriceError && <p className="text-xs text-[var(--loss)] font-bold mt-1.5">{targetPriceError}</p>}
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-3 text-xs">
              <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Instrument:</span>
                  <span className="font-bold">{pos.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Action & Type:</span>
                  <span className="font-black text-[var(--gain)]">{exitSide} LIMIT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Target Price:</span>
                  <span className="font-black">₹{targetPriceNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
                  <span className="text-[var(--text-muted)]">Estimated Target P&L:</span>
                  <span className={estTargetPnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>
                    {estTargetPnl >= 0 ? '+' : ''}₹{estTargetPnl.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="bg-[var(--info-light)] border border-[var(--info)]/30 p-3 rounded-xl text-[11px] text-[var(--info)] leading-relaxed">
                Placing a target order will submit a real LIMIT exit order. Your position will automatically close when the target limit price is hit.
              </div>
            </div>
          );
        })()}
      </Dialog>

      <Dialog
        isOpen={!!cancelTargetModalOrder}
        onClose={() => setCancelTargetModalOrder(null)}
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="text-[var(--loss)] w-4 h-4" />Cancel Target Order?
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTargetModalOrder(null)}>
              Keep Order
            </Button>
            <Button variant="destructive" onClick={confirmCancelTargetOrder}>
              Cancel Target Order
            </Button>
          </>
        }
      >
        {cancelTargetModalOrder && (
          <div className="space-y-3 text-xs">
            <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Instrument:</span>
                <span className="font-bold">{cancelTargetModalOrder.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Target Price:</span>
                <span className="font-bold">₹{parseFloat(cancelTargetModalOrder.price).toFixed(2)}</span>
              </div>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed">
              Cancelling the target order will remove the exit limit order from the order book. Your underlying position will remain OPEN.
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={isExitAllModalOpen}
        onClose={() => setIsExitAllModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert className="text-[var(--loss)] w-4 h-4" />Exit All Open Positions?
          </span>
        }
        footer={
          <>
            <Button variant="secondary" disabled={isSubmittingExit} onClick={() => setIsExitAllModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isSubmittingExit} onClick={confirmExitAllPositions}>
              {isSubmittingExit ? 'Exiting All...' : 'Confirm Exit All'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Total Open Positions:</span>
              <span className="font-bold">{openPositions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Current Unrealized P&L:</span>
              <span className={totalUnrealizedPnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>
                {totalUnrealizedPnl >= 0 ? '+' : ''}₹{totalUnrealizedPnl.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="bg-[var(--loss-light)] border border-[var(--loss)]/30 p-3 rounded-xl text-[11px] text-[var(--loss)] leading-relaxed">
            This will send immediate MARKET square-off orders for all {openPositions.length} open positions. This action cannot be reversed.
          </div>
        </div>
      </Dialog>
      {/* ── Position Averaging / Add Lots Modal ── */}
      <Dialog
        isOpen={!!averageModalPos}
        onClose={() => setAverageModalPos(null)}
        title={
          <span className="flex items-center gap-2">
            <Layers className="text-emerald-500 w-4 h-4" />
            Average Position — {averageModalPos?.symbol || ''}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" disabled={isSubmittingAverage} onClick={() => setAverageModalPos(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={isSubmittingAverage || averageLots <= 0}
              onClick={confirmPlaceAverageOrder}
            >
              {isSubmittingAverage ? 'Executing...' : `Execute Averaging ${averageModalPos && getNetQty(averageModalPos) > 0 ? 'BUY' : 'SELL'}`}
            </Button>
          </>
        }
      >
        {averageModalPos && (() => {
          const pos = averageModalPos;
          const netQty = getNetQty(pos);
          const absQty = Math.abs(netQty);
          const currentAvg = parseFloat(pos.averagePrice || pos.average_price || 0);
          const liveLtp = getLiveLtp(pos);
          const side = netQty > 0 ? 'BUY' : 'SELL';
          const lotSize = getLotSizeForSymbol(pos.symbol);
          const addQty = Math.max(1, averageLots) * lotSize;
          const priceNum = averageOrderType === 'LIMIT' ? (parseFloat(averageLimitPrice) || liveLtp) : liveLtp;

          const currentCost = absQty * currentAvg;
          const newAddedCost = addQty * priceNum;
          const totalNewQty = absQty + addQty;
          const projectedNewAvg = totalNewQty > 0 ? (currentCost + newAddedCost) / totalNewQty : currentAvg;

          return (
            <div className="space-y-3.5 text-xs">
              <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Current Position:</span>
                  <span className="font-bold text-[var(--text-main)]">
                    {absQty} Qty ({side}) @ ₹{currentAvg.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Current LTP:</span>
                  <span className="font-bold font-mono text-emerald-500">₹{liveLtp.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Lot Size:</span>
                  <span className="font-mono">{lotSize} units / lot</span>
                </div>
              </div>

              {/* Lot Multiplier Selector */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[var(--text-main)]">
                  Select Lots to Add:
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[1, 2, 5, 10].map((multiplier) => (
                    <button
                      key={multiplier}
                      type="button"
                      onClick={() => setAverageLots(multiplier)}
                      className={`py-1.5 px-2 rounded-xl border font-bold text-xs transition-all ${
                        averageLots === multiplier
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                          : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      +{multiplier} {multiplier === 1 ? 'Lot' : 'Lots'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text-muted)]">Custom Lots:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={averageLots}
                    onChange={(e) => setAverageLots(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-2.5 py-1 text-xs font-bold"
                  />
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">(= {addQty} total shares)</span>
                </div>
              </div>

              {/* Order Type & Limit Price */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-[var(--text-main)]">Order Type:</label>
                  <div className="flex gap-2">
                    {(['MARKET', 'LIMIT'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAverageOrderType(t)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                          averageOrderType === t
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {averageOrderType === 'LIMIT' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Limit Price (₹):
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={averageLimitPrice}
                      onChange={(e) => setAverageLimitPrice(e.target.value)}
                      placeholder={liveLtp.toFixed(2)}
                      className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Live Projected Average Summary */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl space-y-1.5 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400 font-sans font-bold">Projected New Average:</span>
                  <span className="font-black text-emerald-400 text-sm">₹{projectedNewAvg.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Additional Capital Required:</span>
                  <span className="font-bold text-[var(--text-main)]">₹{newAddedCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                  <span>New Total Position:</span>
                  <span className="font-bold text-[var(--text-main)]">{totalNewQty} Qty</span>
                </div>
              </div>

              {averageError && <p className="text-xs text-[var(--loss)] font-bold">{averageError}</p>}
            </div>
          );
        })()}
      </Dialog>

      {/* ── Stop-Loss & Trailing Stop-Loss Modal ── */}
      <Dialog
        isOpen={!!slModalPos}
        onClose={() => setSlModalPos(null)}
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert className="text-amber-500 w-4 h-4" />
            Stop-Loss & Trailing SL — {slModalPos?.symbol || ''}
          </span>
        }
        footer={
          <>
            {slModalPos?.stopLossPrice && (
              <Button
                variant="destructive"
                disabled={isSubmittingSl}
                onClick={() => {
                  setSlPrice('');
                  setTrailingSlStep('');
                  setTrailingSlJump('');
                  confirmSetSl();
                }}
              >
                Remove SL
              </Button>
            )}
            <Button variant="secondary" disabled={isSubmittingSl} onClick={() => setSlModalPos(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={isSubmittingSl} onClick={confirmSetSl}>
              {isSubmittingSl ? 'Saving...' : 'Save SL / TSL'}
            </Button>
          </>
        }
      >
        {slModalPos && (() => {
          const pos = slModalPos;
          const netQty = getNetQty(pos);
          const liveLtp = getLiveLtp(pos);
          const isLong = netQty > 0;

          return (
            <div className="space-y-3.5 text-xs">
              <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Side & Qty:</span>
                  <span className="font-bold text-[var(--text-main)]">
                    {isLong ? 'LONG' : 'SHORT'} • {Math.abs(netQty)} Qty
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Current LTP:</span>
                  <span className="font-black font-mono text-emerald-500">₹{liveLtp.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Entry Price:</span>
                  <span className="font-bold font-mono">
                    ₹{parseFloat(pos.averagePrice || pos.average_price || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[var(--text-main)]">
                  Stop-Loss Trigger Price (₹):
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={slPrice}
                  onChange={(e) => {
                    setSlPrice(e.target.value);
                    setSlError(null);
                  }}
                  placeholder={isLong ? `Must be < ₹${liveLtp.toFixed(2)}` : `Must be > ₹${liveLtp.toFixed(2)}`}
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-bold font-mono focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {isLong ? 'Executes MARKET sell if LTP falls to or below this price.' : 'Executes MARKET buy if LTP rises to or above this price.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1 text-[var(--text-muted)]">
                    Trailing Step (₹):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={trailingSlStep}
                    onChange={(e) => setTrailingSlStep(e.target.value)}
                    placeholder="e.g. 2.00 (Optional)"
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold font-mono"
                  />
                  <span className="text-[9px] text-[var(--text-muted)] block mt-0.5">Price favorable move</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1 text-[var(--text-muted)]">
                    Trailing Jump (₹):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={trailingSlJump}
                    onChange={(e) => setTrailingSlJump(e.target.value)}
                    placeholder="e.g. 2.00 (Optional)"
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold font-mono"
                  />
                  <span className="text-[9px] text-[var(--text-muted)] block mt-0.5">SL adjustment amount</span>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-[11px] text-amber-500 leading-relaxed">
                When enabled, the server-side Execution Engine continuously tracks tick prices every 500ms and trails your stop-loss upward as the market moves favorably.
              </div>

              {slError && <p className="text-xs text-[var(--loss)] font-bold">{slError}</p>}
            </div>
          );
        })()}
      </Dialog>

      {/* Electronic Contract Note (ECN) Modal */}
      <ContractNoteModal
        isOpen={isContractNoteOpen}
        onClose={() => setIsContractNoteOpen(false)}
        token={token}
      />
    </div>
  );
};

function PositionRowActions({
  pos,
  activeTarget,
  onSetTarget,
  onSetSl,
  onAverage,
  onSquareOff,
  onCancelTarget,
  compact,
}: {
  pos: any;
  activeTarget: any;
  onSetTarget: (pos: any, target?: any) => void;
  onSetSl?: (pos: any) => void;
  onAverage?: (pos: any) => void;
  onSquareOff: (pos: any) => void;
  onCancelTarget: (order: any) => void;
  compact?: boolean;
}) {
  const netQty = getNetQty(pos);
  if (netQty === 0) return null;
  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'w-full' : 'justify-end'}`}>
      {onAverage && (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAverage(pos);
          }}
          title="Average Position / Add Lots"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-500" />
          Avg
        </Button>
      )}
      {onSetSl && (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSetSl(pos);
          }}
          title="Set Stop-Loss / Trailing SL"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          {pos.stopLossPrice ? 'SL/TSL' : 'SL'}
        </Button>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onSetTarget(pos, activeTarget);
        }}
      >
        <Target className="w-3.5 h-3.5 text-blue-400" />
        {activeTarget ? 'Modify' : 'Target'}
      </Button>
      {activeTarget && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onCancelTarget(activeTarget);
          }}
          aria-label="Cancel target order"
        >
          <X className="w-3.5 h-3.5 text-[var(--loss)]" />
        </Button>
      )}
      <Button
        variant="destructive"
        size="sm"
        className={compact ? 'flex-1' : ''}
        onClick={(e) => {
          e.stopPropagation();
          onSquareOff(pos);
        }}
      >
        Square Off
      </Button>
    </div>
  );
}
