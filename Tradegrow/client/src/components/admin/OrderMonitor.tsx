import React, { useState, useEffect } from 'react';
import { Activity, XCircle, Edit2, Play, AlertTriangle, PlusCircle, CheckCircle, RefreshCw, ShieldCheck, Clock, FileText, X, Check, Eye, ListOrdered, Fingerprint, Download, Zap, Flame } from 'lucide-react';
import { DataTable, DataTableColumn } from '../ui/DataTable';
import { Badge } from '../ui/Badge';
import { CustomerHoverCard } from './CustomerHoverCard';
import { useMarketSocket, useAdminSubscribeAll } from '../../hooks/useMarketSocket';
import { exportToCsv } from '../../utils/csvExport';

interface OrderMonitorProps {
  token: string;
  onOpenCustomer360?: (userId: string) => void;
}

export const OrderMonitor: React.FC<OrderMonitorProps> = ({ token, onOpenCustomer360 }) => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'PROVENANCE'>('ORDERS');
  const [orders, setOrders] = useState<any[]>([]);
  const [provenanceFills, setProvenanceFills] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState('');
  const [freshnessFilter, setFreshnessFilter] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Provenance Dossier Modal
  const [selectedFill, setSelectedFill] = useState<any | null>(null);

  // Admin Order Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [symbol, setSymbol] = useState('NIFTY 24500 CE');
  const [exchange, setExchange] = useState('NFO');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [quantity, setQuantity] = useState(50);
  const [price, setPrice] = useState(150);
  const [productType, setProductType] = useState('MIS');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const { onAdminEvent, status: socketStatus } = useMarketSocket();
  useAdminSubscribeAll();

  const fetchOrders = () => {
    const params = new URLSearchParams({ limit: '100' });
    if (statusFilter) params.set('status', statusFilter);
    if (exchangeFilter) params.set('exchange', exchangeFilter);

    Promise.all([
      fetch(`/api/v1/admin/orders/monitor?${params}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/customers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([ordersData, customersData]) => {
      if (ordersData.success && Array.isArray(ordersData.orders)) setOrders(ordersData.orders);
      if (customersData.success && Array.isArray(customersData.customers)) {
        setClients(customersData.customers);
        if (customersData.customers.length > 0 && !selectedUserId) {
          setSelectedUserId(customersData.customers[0].id);
        }
      }
    }).catch(() => {});
  };

  const fetchProvenance = () => {
    const params = new URLSearchParams({ limit: '100' });
    if (freshnessFilter) params.set('freshness', freshnessFilter);
    fetch(`/api/v1/admin/executions/provenance?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.executions)) setProvenanceFills(d.executions);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (activeTab === 'ORDERS') {
      fetchOrders();
      const interval = setInterval(fetchOrders, 4000);
      // Live push on top of the poll — a new/updated order refreshes the list
      // immediately instead of waiting up to 4s for the next tick.
      const unsub = onAdminEvent((event) => fetchOrders(), 'ORDER_CREATED');
      const unsub2 = onAdminEvent((event) => fetchOrders(), 'ORDER_UPDATED');
      return () => { clearInterval(interval); unsub(); unsub2(); };
    } else {
      fetchProvenance();
      const interval = setInterval(fetchProvenance, 5000);
      const unsub = onAdminEvent((event) => fetchProvenance(), 'ORDER_UPDATED');
      const unsub2 = onAdminEvent((event) => fetchProvenance(), 'TRADE_EXECUTED');
      return () => { clearInterval(interval); unsub(); unsub2(); };
    }
  }, [token, activeTab, statusFilter, exchangeFilter, freshnessFilter, onAdminEvent]);

  const handleEditPrice = async (orderId: string, currentPrice: number) => {
    const newPriceStr = window.prompt(`Enter new limit price for Order ${orderId}:`, String(currentPrice));
    if (!newPriceStr) return;
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice <= 0) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: newPrice })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to update order price' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleForceExecute = async (orderId: string, currentPrice: number) => {
    const fillPriceStr = window.prompt(`Execute Order ${orderId} immediately at price (₹):`, String(currentPrice));
    if (!fillPriceStr) return;
    const fillPrice = parseFloat(fillPriceStr);
    if (isNaN(fillPrice) || fillPrice <= 0) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/force-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: fillPrice })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to force execute order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt(`Reason for cancelling order ${orderId}:`, 'Cancelled by Admin');
    if (reason === null) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to cancel order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !symbol || !quantity || !price) return;
    setSubmittingOrder(true);
    setActionMsg(null);

    try {
      const res = await fetch('/api/v1/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: selectedUserId,
          symbol,
          exchange,
          side,
          orderType,
          quantity,
          price,
          productType
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        setShowCreateModal(false);
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to place admin order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full select-none">
      {/* Top Filter & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-color)] text-xs font-bold">
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${activeTab === 'ORDERS' ? 'bg-[var(--primary)] text-[var(--text-on-accent)] shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              Live Order Book ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('PROVENANCE')}
              className={`px-4 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'PROVENANCE' ? 'bg-[var(--warning)] text-[var(--text-on-accent)] shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Fill Provenance Inspector ({provenanceFills.length})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'ORDERS' ? (
            <>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                aria-label="Filter by order status"
                className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-semibold"
              >
                <option value="">All Status</option>
                <option value="ACCEPTED">ACCEPTED (Pending Fill)</option>
                <option value="PENDING">PENDING</option>
                <option value="FILLED">FILLED (Executed)</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="REJECTED">REJECTED</option>
              </select>

              <select
                value={exchangeFilter}
                onChange={e => setExchangeFilter(e.target.value)}
                aria-label="Filter by exchange"
                className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-semibold"
              >
                <option value="">All Exchanges</option>
                <option value="NSE">NSE</option>
                <option value="NFO">NFO</option>
                <option value="BSE">BSE</option>
                <option value="MCX">MCX</option>
              </select>

              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Place Admin Order</span>
              </button>
            </>
          ) : (
            <select
              value={freshnessFilter}
              onChange={e => setFreshnessFilter(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-semibold"
            >
              <option value="">All Provenance Tags</option>
              <option value="live">🟢 LIVE Feed (&lt;= 15s)</option>
              <option value="synthetic_skew">🟡 SYNTHETIC SKEW (Option BS)</option>
              <option value="cached_stale">🔴 CACHED STALE</option>
            </select>
          )}

          <button
            onClick={activeTab === 'ORDERS' ? fetchOrders : fetchProvenance}
            className="p-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {activeTab === 'ORDERS' && (
            <button
              onClick={() => exportToCsv('order-monitor', orders, [
                { header: 'Order ID', value: (o: any) => o.order_id },
                { header: 'Client', value: (o: any) => o.username || o.user_id },
                { header: 'Symbol', value: (o: any) => o.symbol },
                { header: 'Exchange', value: (o: any) => o.exchange },
                { header: 'Side', value: (o: any) => o.side },
                { header: 'Type', value: (o: any) => o.order_type },
                { header: 'Quantity', value: (o: any) => o.quantity },
                { header: 'Price', value: (o: any) => o.price },
                { header: 'Status', value: (o: any) => o.status },
                { header: 'Time', value: (o: any) => new Date(o.created_at).toLocaleString() },
              ])}
              disabled={orders.length === 0}
              className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-40 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-lg text-xs font-semibold ${actionMsg.type === 'success' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' : 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* ── 1. ORDERS TABLE ──────────────────────────────────────────────── */}
      {activeTab === 'ORDERS' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden flex-1 overflow-y-auto p-3 shadow-xs">
          <DataTable
            columns={[
              { key: 'orderId', header: 'Order ID', render: (o: any) => <span className="font-mono text-[11px] text-[var(--warning)] font-bold">{o.order_id}</span> },
              {
                key: 'client', header: 'Client', mobilePrimary: true,
                render: (o: any) => (
                  <div>
                    <CustomerHoverCard userId={o.user_id || o.id} token={token} onOpenCustomer360={onOpenCustomer360}>
                      <span className="font-bold text-[var(--text-main)]">{o.username || o.user_id}</span>
                    </CustomerHoverCard>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono">TG-{o.user_id?.slice(0, 8).toUpperCase()}</div>
                  </div>
                ),
              },
              {
                key: 'symbol', header: 'Symbol & Flags',
                render: (o: any) => {
                  const notional = (parseFloat(o.price || '0') || 0) * (o.quantity || 0);
                  const isLargeOrder = notional >= 100000 || o.quantity >= 500;
                  const isMarket = o.order_type === 'MARKET';

                  return (
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-bold text-xs text-[var(--text-main)]">{o.symbol}</span>
                      <div className="flex items-center gap-1">
                        {isLargeOrder && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]/30 flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> High Size
                          </span>
                        )}
                        {isMarket && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[var(--info-light)] text-[var(--info)] border border-[var(--info)]/30 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> Market
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
              },
              { key: 'exchange', header: 'Exchange', mobileHidden: true, render: (o: any) => <span className="bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded text-[10px] font-bold border border-[var(--border-color)]">{o.exchange}</span> },
              {
                key: 'side', header: 'Side',
                render: (o: any) => (
                  <span className={`font-black text-[11px] ${o.side === 'BUY' ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                    {o.side}
                  </span>
                )
              },
              { key: 'type', header: 'Type', mobileHidden: true, render: (o: any) => <span className="font-semibold text-[var(--text-muted)]">{o.order_type}</span> },
              { key: 'qty', header: 'Qty', align: 'right', render: (o: any) => <span className="font-mono tabular-nums font-bold text-[var(--text-main)]">{o.quantity}</span> },
              { key: 'price', header: 'Limit Price', align: 'right', render: (o: any) => <span className="font-mono tabular-nums text-[var(--gain)] font-bold">₹{parseFloat(o.price || '0').toFixed(2)}</span> },
              {
                key: 'status', header: 'Status', align: 'center',
                render: (o: any) => (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    o.status === 'FILLED' ? 'bg-[var(--gain-light)] text-[var(--gain)] border-[var(--gain)]/30' :
                    o.status === 'CANCELLED' ? 'bg-[var(--loss-light)] text-[var(--loss)] border-[var(--loss)]/30' :
                    'bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]/30'
                  }`}>{o.status}</span>
                ),
              },
              { key: 'time', header: 'Time', mobileHidden: true, render: (o: any) => <span className="text-[10px] text-[var(--text-muted)] font-mono">{new Date(o.created_at).toLocaleTimeString()}</span> },
              {
                key: 'actions', header: 'Admin Controls', align: 'center', mobileHidden: true,
                render: (o: any) => {
                  const isPending = ['ACCEPTED', 'PENDING'].includes(o.status);
                  return isPending ? (
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEditPrice(o.order_id, parseFloat(o.price || '0'))} className="p-1 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--warning)] rounded transition cursor-pointer" title="Edit Price"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleForceExecute(o.order_id, parseFloat(o.price || '0'))} className="p-1 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--gain)] rounded transition cursor-pointer" title="Force Execute"><Play className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleCancelOrder(o.order_id)} className="p-1 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--loss)] rounded transition cursor-pointer" title="Cancel Order"><XCircle className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">Finalized</span>
                  );
                },
              },
            ]}
            rows={orders}
            rowKey={(o: any) => o.order_id || o.id}
            renderMobileActions={(o: any) => {
              const isPending = ['ACCEPTED', 'PENDING'].includes(o.status);
              return isPending ? (
                <>
                  <button onClick={() => handleEditPrice(o.order_id, parseFloat(o.price || '0'))} className="p-1.5 bg-[var(--bg-surface-elevated)] text-[var(--warning)] rounded transition cursor-pointer" title="Edit Price"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleForceExecute(o.order_id, parseFloat(o.price || '0'))} className="p-1.5 bg-[var(--bg-surface-elevated)] text-[var(--primary)] rounded transition cursor-pointer" title="Force Execute"><Play className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleCancelOrder(o.order_id)} className="p-1.5 bg-[var(--bg-surface-elevated)] text-[var(--loss)] rounded transition cursor-pointer" title="Cancel Order"><XCircle className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <span className="text-[10px] text-[var(--text-tertiary)] font-mono">Finalized</span>
              );
            }}
            emptyIcon={<ListOrdered className="w-6 h-6" />}
            emptyTitle="No orders"
            emptyMessage="No orders match the current filters."
          />
        </div>
      )}

      {/* ── 2. FILL PROVENANCE INSPECTOR TABLE ───────────────────────────── */}
      {activeTab === 'PROVENANCE' && (
        <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl overflow-hidden flex-1 overflow-y-auto p-3">
          <DataTable
            columns={[
              { key: 'execId', header: 'Execution ID', mobileHidden: true, render: (f: any) => <span className="font-mono text-[10px] text-[var(--warning)]">{f.id}</span> },
              {
                key: 'client', header: 'Client', mobilePrimary: true,
                render: (f: any) => (
                  <div>
                    <div className="font-semibold text-[var(--text-main)]">{f.username}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] font-mono">{f.email}</div>
                  </div>
                ),
              },
              { key: 'symbol', header: 'Symbol', render: (f: any) => <span className="font-bold text-[var(--text-main)]">{f.symbol}</span> },
              { key: 'side', header: 'Side', render: (f: any) => <span className={`font-bold ${f.side === 'BUY' ? 'text-[var(--primary)]' : 'text-[var(--loss)]'}`}>{f.side}</span> },
              { key: 'qty', header: 'Qty', align: 'right', render: (f: any) => <span className="font-mono font-bold text-[var(--text-main)]">{f.quantity}</span> },
              { key: 'price', header: 'Fill Price (₹)', align: 'right', render: (f: any) => <span className="font-mono text-[var(--primary)] font-bold">₹{parseFloat(f.price).toFixed(2)}</span> },
              { key: 'marketLtp', header: 'Market LTP @ Fill', align: 'right', mobileHidden: true, render: (f: any) => <span className="font-mono text-[var(--text-muted)]">₹{parseFloat(f.tick_ltp || f.price).toFixed(2)}</span> },
              {
                key: 'freshness', header: 'Freshness', align: 'center',
                render: (f: any) => (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    f.freshness_tag === 'live' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' :
                    f.freshness_tag === 'synthetic_skew' ? 'bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]' :
                    'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]'
                  }`}>
                    {f.freshness_tag === 'live' ? '🟢 LIVE' : f.freshness_tag === 'synthetic_skew' ? '🟡 SYNTHETIC' : '🔴 STALE'}
                  </span>
                ),
              },
              { key: 'tickSource', header: 'Tick Source', mobileHidden: true, render: (f: any) => <span className="text-[10px] text-[var(--text-muted)] font-mono">{f.tick_source || 'LIVE_FEED'}</span> },
              { key: 'fillLogic', header: 'Fill Logic', mobileHidden: true, render: (f: any) => <span className="font-mono text-[10px] text-[var(--text-muted)]">{f.fill_logic || 'MARKET'}</span> },
              {
                key: 'dossier', header: 'Dossier', align: 'center', mobileHidden: true,
                render: (f: any) => (
                  <button onClick={() => setSelectedFill(f)} className="p-1 text-[var(--text-muted)] hover:text-[var(--warning)] rounded hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer" title="Inspect Fill Provenance Dossier">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                ),
              },
            ]}
            rows={provenanceFills}
            rowKey={(f: any) => f.id}
            renderMobileActions={(f: any) => (
              <button onClick={() => setSelectedFill(f)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--warning)] rounded hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer flex items-center gap-1.5 text-xs font-bold">
                <Eye className="w-3.5 h-3.5" /> Inspect Dossier
              </button>
            )}
            emptyIcon={<Fingerprint className="w-6 h-6" />}
            emptyTitle="No fill records"
            emptyMessage="No execution fills match the current filters."
          />
        </div>
      )}

      {/* ── PROVENANCE DOSSIER MODAL ─────────────────────────────────────── */}
      {selectedFill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Simulated Fill Provenance Evidence</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Cryptographic audit trail of market price at fill time</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFill(null)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="bg-[var(--bg-body)] p-3 rounded-xl border border-[var(--border-color)] space-y-1.5">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Execution ID:</span><span className="text-[var(--warning)] font-bold">{selectedFill.id}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Order ID:</span><span className="text-[var(--text-muted)]">{selectedFill.order_id}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Client:</span><span className="text-[var(--text-main)]">{selectedFill.username} ({selectedFill.email})</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Instrument:</span><span className="text-[var(--primary)] font-bold">{selectedFill.symbol} ({selectedFill.side})</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Quantity:</span><span className="text-[var(--text-main)]">{selectedFill.quantity}</span></div>
              </div>

              <div className="bg-[var(--bg-body)] p-3 rounded-xl border border-[var(--border-color)] space-y-1.5">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Simulated Fill Price:</span><span className="text-[var(--primary)] font-bold">₹{parseFloat(selectedFill.price).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Live Market LTP:</span><span className="text-[var(--text-main)]">₹{parseFloat(selectedFill.tick_ltp || selectedFill.price).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Bid / Ask Spread:</span><span className="text-[var(--text-muted)]">₹{parseFloat(selectedFill.tick_bid || selectedFill.price).toFixed(2)} / ₹{parseFloat(selectedFill.tick_ask || selectedFill.price).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Freshness Tag:</span><span className="text-[var(--warning)] font-bold uppercase">{selectedFill.freshness_tag || 'live'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Tick Source:</span><span className="text-[var(--text-muted)]">{selectedFill.tick_source || 'LIVE_FEED'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Fill Logic:</span><span className="text-[var(--text-muted)]">{selectedFill.fill_logic || 'MARKET'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Execution Time:</span><span className="text-[var(--text-muted)]">{new Date(selectedFill.executed_at).toISOString()}</span></div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedFill(null)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ORDER MODAL ───────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[var(--primary)]" />
                <span>Place Order on Behalf of Client</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] font-semibold mb-1">Target Client *</label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)]"
                  required
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.username} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-muted)] font-semibold mb-1">Trading Symbol *</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)] font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--text-muted)] font-semibold mb-1">Side *</label>
                  <select
                    value={side}
                    onChange={e => setSide(e.target.value as any)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)] font-bold"
                  >
                    <option value="BUY" className="text-[var(--primary)]">BUY</option>
                    <option value="SELL" className="text-[var(--loss)]">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--text-muted)] font-semibold mb-1">Order Type *</label>
                  <select
                    value={orderType}
                    onChange={e => setOrderType(e.target.value as any)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)]"
                  >
                    <option value="LIMIT">LIMIT</option>
                    <option value="MARKET">MARKET</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--text-muted)] font-semibold mb-1">Quantity *</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)] font-mono"
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-muted)] font-semibold mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.05"
                    value={price}
                    onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)] font-mono"
                    min={0.05}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="w-1/2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--text-on-accent)] font-bold py-2 rounded-lg cursor-pointer"
                >
                  {submittingOrder ? 'Submitting...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
