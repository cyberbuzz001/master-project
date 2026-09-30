import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Layers, DollarSign, Activity, Zap, RefreshCw } from 'lucide-react';
import { MarketTick } from '../types';

export interface McxContract {
  instrument: string;       // e.g. 'OPTFUT'
  commodity: string;        // e.g. 'CRUDEOIL', 'GOLD', 'SILVERM', 'NATURALGAS', 'COPPER'
  expiryDate: string;       // e.g. '17AUG2026'
  optionType: 'CE' | 'PE';
  strikePrice: number;
  ltp: number;
  volumeLots: number;
  notionalToLakhs: number;
  premiumToLakh: number;
  oiLots: number;
  ulProductLtp: number;
  token: string;
  ulToken?: string;
}

interface McxCommodityViewProps {
  ticks?: Map<string, MarketTick>;
  onRefreshWallet?: () => void;
}

export const McxCommodityView: React.FC<McxCommodityViewProps> = ({ ticks, onRefreshWallet }) => {
  const [selectedCommodity, setSelectedCommodity] = useState<string>('ALL');
  const [selectedOptionType, setSelectedOptionType] = useState<'ALL' | 'CE' | 'PE'>('ALL');
  const [contracts, setContracts] = useState<McxContract[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [orderModal, setOrderModal] = useState<{ open: boolean; contract?: McxContract; side: 'BUY' | 'SELL' }>({ open: false, side: 'BUY' });
  const [quantity, setQuantity] = useState<number | string>(1);
  const [orderStatus, setOrderStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getMcxLotSize = (commodity: string): number => {
    if (!commodity) return 100;
    const comm = commodity.toUpperCase();
    if (comm.startsWith('CRUDEOIL')) return 100;
    if (comm === 'GOLD') return 100;
    if (comm === 'GOLDM') return 10;
    if (comm === 'SILVER') return 30;
    if (comm === 'SILVERM') return 5;
    if (comm === 'NATURALGAS') return 1250;
    if (comm === 'COPPER') return 2500;
    return 100;
  };

  // Fetch active MCX contracts sorted by Turnover (Value)
  const fetchMcxContracts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/market/mcx-active-contracts');
      const data = await res.json();
      if (data.success && data.contracts) {
        setContracts(data.contracts);
      }
    } catch (err) {
      console.warn('[McxCommodityView] Error fetching MCX active contracts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMcxContracts();
    const interval = setInterval(fetchMcxContracts, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredContracts = contracts.filter(c => {
    const matchComm = selectedCommodity === 'ALL' || c.commodity.startsWith(selectedCommodity);
    const matchType = selectedOptionType === 'ALL' || c.optionType === selectedOptionType;
    return matchComm && matchType;
  });

  const totalNotionalTo = filteredContracts.reduce((sum, c) => sum + c.notionalToLakhs, 0);
  const totalPremiumTo = filteredContracts.reduce((sum, c) => sum + c.premiumToLakh, 0);

  const handlePlaceOrder = async () => {
    if (!orderModal.contract) return;
    setOrderStatus(null);
    try {
      const token = localStorage.getItem('token');
      const lotSize = getMcxLotSize(orderModal.contract.commodity);
      const numLots = Math.max(1, Number(quantity) || 1);
      const totalQty = numLots * lotSize;

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          instrumentToken: orderModal.contract.token,
          exchange: 'MCX',
          symbol: `${orderModal.contract.commodity}${orderModal.contract.expiryDate}${orderModal.contract.strikePrice}${orderModal.contract.optionType}`,
          side: orderModal.side,
          quantity: totalQty,
          price: orderModal.contract.ltp,
          orderType: 'MARKET',
          productType: 'MIS'
        })
      });
      const data = await res.json();
      if (data.success) {
        setOrderStatus({ type: 'success', text: `MCX Order Executed: ${orderModal.side} ${numLots} Lot(s) (${totalQty} Qty) ${orderModal.contract.commodity} @ ₹${orderModal.contract.ltp}` });
        if (onRefreshWallet) onRefreshWallet();
        setTimeout(() => setOrderModal({ open: false, side: 'BUY' }), 1500);
      } else {
        setOrderStatus({ type: 'error', text: data.error?.message || 'Order execution failed' });
      }
    } catch (err: any) {
      setOrderStatus({ type: 'error', text: err.message || 'Order failed' });
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-8 max-w-7xl mx-auto">
      
      {/* 1. HEADER BANNER & KPI CARDS */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 rounded-3xl border border-amber-500/20 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-black uppercase tracking-wider">
              MCX Derivatives
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-black">
              🟢 MCX Live (09:00 AM – 11:30 PM IST)
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Active Options by Value (Turnover)</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
            Commodities Options & Futures (MCX)
          </h1>
        </div>

        <button
          onClick={fetchMcxContracts}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-black hover:border-amber-500 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Quotes</span>
        </button>
      </div>

      {/* KPI STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)] shadow-xs">
          <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notional Turnover</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1 num-font">
            ₹{totalNotionalTo.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Lakhs
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)] shadow-xs">
          <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Premium Turnover</span>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 num-font">
            ₹{totalPremiumTo.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Lakhs
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)] shadow-xs">
          <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Expiry</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {filteredContracts[0] ? `${filteredContracts[0].commodity} (${filteredContracts[0].expiryDate})` : 'MCX ACTIVE'}
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)] shadow-xs">
          <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Strike Count</span>
          <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 num-font">
            {filteredContracts.length} Contracts
          </div>
        </div>
      </div>

      {/* 2. FILTERS & CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-color)] shadow-xs">
        
        {/* Commodity Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER'].map(comm => (
            <button
              key={comm}
              onClick={() => setSelectedCommodity(comm)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border ${
                selectedCommodity === comm
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-slate-600 dark:text-slate-300 hover:border-amber-400'
              }`}
            >
              {comm}
            </button>
          ))}
        </div>

        {/* Option Type Filter */}
        <div className="flex items-center gap-2 bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-color)]">
          {(['ALL', 'CE', 'PE'] as const).map(type => (
            <button
              key={type}
              onClick={() => setSelectedOptionType(type)}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                selectedOptionType === type
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {type === 'ALL' ? 'All Types' : type === 'CE' ? 'Calls (CE)' : 'Puts (PE)'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. ACTIVE MCX OPTIONS TABLE (MATCHING USER SCREENSHOT EXACTLY) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface-elevated)] border-b border-[var(--border-color)] text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-extrabold">
                <th className="py-3.5 px-4">Instrument</th>
                <th className="py-3.5 px-4">Commodity</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4">Option Type</th>
                <th className="py-3.5 px-4 text-right">Strike Price</th>
                <th className="py-3.5 px-4 text-right">LTP</th>
                <th className="py-3.5 px-4 text-right">Volume (Lots)</th>
                <th className="py-3.5 px-4 text-right">Notional TO (Lakhs)</th>
                <th className="py-3.5 px-4 text-right">Premium TO (Lakh)</th>
                <th className="py-3.5 px-4 text-right">OI (Lots)</th>
                <th className="py-3.5 px-4 text-right">UL Product LTP</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] num-font">
              {filteredContracts.map((c, idx) => {
                const liveTick = ticks?.get(c.token);
                const ulTick = (c.ulToken ? ticks?.get(c.ulToken) : undefined) || (c.commodity ? ticks?.get(`MCX_${c.commodity}`) : undefined);
                const currentLtp = liveTick && liveTick.ltp > 0 ? liveTick.ltp : c.ltp;
                const currentSpot = ulTick && ulTick.ltp > 0 ? ulTick.ltp : c.ulProductLtp;

                return (
                  <tr key={idx} className="hover:bg-amber-500/5 transition-colors">
                    <td className="py-3 px-4 font-black text-slate-700 dark:text-slate-300">{c.instrument}</td>
                    <td className="py-3 px-4 font-black text-amber-600 dark:text-amber-400">{c.commodity}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{c.expiryDate}</td>
                    <td className="py-3 px-4 font-black">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        c.optionType === 'CE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {c.optionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-block font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg text-xs font-mono border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
                        ₹{(c.strikePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-block font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg text-xs font-mono border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                        ₹{(currentLtp || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-800 dark:text-slate-200 font-bold">
                      {c.volumeLots.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-slate-100">
                      ₹{c.notionalToLakhs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-amber-700 dark:text-amber-400">
                      ₹{c.premiumToLakh.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-800 dark:text-slate-200 font-bold">
                      {c.oiLots.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-300">
                      ₹{currentSpot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setOrderModal({ open: true, contract: { ...c, ltp: currentLtp, ulProductLtp: currentSpot }, side: 'BUY' })}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white font-black text-[11px] hover:bg-emerald-700 shadow-xs"
                        >
                          B
                        </button>
                        <button
                          onClick={() => setOrderModal({ open: true, contract: { ...c, ltp: currentLtp, ulProductLtp: currentSpot }, side: 'SELL' })}
                          className="px-2.5 py-1 rounded bg-rose-600 text-white font-black text-[11px] hover:bg-rose-700 shadow-xs"
                        >
                          S
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. QUICK ORDER MODAL FOR MCX DERIVATIVES */}
      {orderModal.open && orderModal.contract && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-md p-6 rounded-3xl shadow-xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md text-xs font-black ${
                  orderModal.side === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}>
                  {orderModal.side}
                </span>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  {orderModal.contract.commodity} {orderModal.contract.strikePrice} {orderModal.contract.optionType}
                </span>
              </div>
              <button
                onClick={() => setOrderModal({ open: false, side: 'BUY' })}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs font-bold">
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                <span className="text-slate-500">Expiry Date</span>
                <span className="text-slate-900 dark:text-white font-black">{orderModal.contract.expiryDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                <span className="text-slate-500">LTP</span>
                <span className="text-slate-900 dark:text-white font-black">₹{orderModal.contract.ltp.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                <span className="text-slate-500">Underlying Spot LTP</span>
                <span className="text-slate-900 dark:text-white font-black">₹{orderModal.contract.ulProductLtp}</span>
              </div>

              <div className="flex flex-col gap-1.5 mt-2 bg-[var(--bg-surface-elevated)] p-3.5 rounded-2xl border border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <label className="text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px]">EDIT LOTS</label>
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                    {getMcxLotSize(orderModal.contract.commodity)} Qty/Lot
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(prev => Math.max(1, (Number(prev) || 1) - 1))}
                    className="w-10 h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-slate-900 dark:text-white font-black text-lg flex items-center justify-center hover:border-amber-500 hover:text-amber-500 transition-all active:scale-95 shadow-xs"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setQuantity('' as any);
                      } else {
                        const num = parseInt(val, 10);
                        if (!isNaN(num)) setQuantity(Math.max(1, num));
                      }
                    }}
                    onBlur={() => {
                      if (!quantity || isNaN(Number(quantity))) setQuantity(1);
                    }}
                    className="flex-1 text-center py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] font-black text-base text-slate-900 dark:text-white outline-none focus:border-amber-500 transition-all shadow-xs"
                  />

                  <button
                    type="button"
                    onClick={() => setQuantity(prev => (Number(prev) || 1) + 1)}
                    className="w-10 h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-slate-900 dark:text-white font-black text-lg flex items-center justify-center hover:border-amber-500 hover:text-amber-500 transition-all active:scale-95 shadow-xs"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 px-1">
                  <span>= {(Number(quantity) || 1) * getMcxLotSize(orderModal.contract.commodity)} Total Qty</span>
                  <span>Required: ₹{((Number(quantity) || 1) * getMcxLotSize(orderModal.contract.commodity) * orderModal.contract.ltp).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {orderStatus && (
              <div className={`p-3 rounded-xl text-xs font-black ${
                orderStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
              }`}>
                {orderStatus.text}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setOrderModal({ open: false, side: 'BUY' })}
                className="flex-1 py-3 rounded-2xl border border-[var(--border-color)] text-xs font-extrabold hover:bg-[var(--bg-surface-elevated)]"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceOrder}
                className={`flex-1 py-3 rounded-2xl text-xs font-black text-white shadow-md ${
                  orderModal.side === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                }`}
              >
                Confirm {orderModal.side} Order
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
