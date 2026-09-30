import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, AlertTriangle, ShieldCheck, ShieldAlert, Plus, Minus, CheckCircle2, XCircle, Loader2, Wallet, Calculator } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useToast } from '../context/ToastContext';
import { soundManager } from '../utils/soundManager';

export interface OrderPreviewDetails {
  token: string;
  symbol: string;
  underlying: string;
  exchange: string;
  expiry: string;
  strike: number;
  optionType: 'CE' | 'PE';
  side: 'BUY' | 'SELL';
  lots: number;
  lotSize: number;
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL';
  productType: 'MIS' | 'CNC' | 'NRML';
}

interface OrderPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (details: OrderPreviewDetails) => void;
  details: OrderPreviewDetails | null;
  userToken: string;
  /**
   * Lets the user pick BUY/SELL inside the sheet instead of it being fixed by
   * the caller — for quick-order entry points (search result, chart) that
   * haven't already committed to a side, unlike a Watchlist/Option Chain row
   * where clicking a BUY or SELL button already decided it.
   */
  sideEditable?: boolean;
  /** From `user.riskRestriction` — 'REDUCE_ONLY' blocks placing new/exposure-increasing orders here (this modal is only ever used to open new exposure, never to square off an existing position — that's a separate action elsewhere). */
  riskRestriction?: string | null;
}

export const OrderPreviewModal: React.FC<OrderPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  details: detailsProp,
  userToken,
  sideEditable = false,
  riskRestriction,
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [lots, setLots] = useState<number>(1);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL'>('MARKET');
  const [price, setPrice] = useState<number>(0);
  const [productType, setProductType] = useState<'MIS' | 'NRML'>('MIS');

  const [marginQuote, setMarginQuote] = useState<any>(null);
  const [userWalletBalance, setUserWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Order submission state — shown INSIDE the modal
  const [orderStep, setOrderStep] = useState<'FORM' | 'PLACING' | 'SUCCESS' | 'REJECTED'>('FORM');
  const [rejectionMessage, setRejectionMessage] = useState('');

  // Dialog manages its own close-animation timing (~250ms) independently of
  // when the caller nulls out `details` — keep rendering the last known
  // details while it animates out, instead of going blank/crashing.
  const previousDetailsRef = useRef<OrderPreviewDetails | null>(null);
  if (detailsProp) previousDetailsRef.current = detailsProp;
  const details = detailsProp || previousDetailsRef.current;

  // Fetch live wallet balance when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const authToken = userToken || localStorage.getItem('token') || '';
    if (!authToken) return;
    fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.wallet) {
          setUserWalletBalance(data.wallet.buyingPower ?? data.wallet.cashBalance ?? 0);
        }
      })
      .catch(() => {});
  }, [isOpen, userToken]);

  // Auto-redirect to Positions page on successful execution
  useEffect(() => {
    if (orderStep === 'SUCCESS') {
      const timer = setTimeout(() => {
        handleClose();
        navigate('/portfolio/positions');
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [orderStep]);

  // Initialize editable state when modal opens or details change
  useEffect(() => {
    if (detailsProp) {
      setLots(detailsProp.lots || 1);
      setSide(detailsProp.side || 'BUY');
      setOrderType(detailsProp.orderType || 'MARKET');
      setPrice(detailsProp.price || 0);
      setProductType(detailsProp.productType === 'NRML' ? 'NRML' : 'MIS');
      setOrderStep('FORM');
      setRejectionMessage('');
    }
  }, [isOpen, detailsProp]);

  // Recalculate required capital & margin whenever client edits lots, side, order type, price, or product type
  useEffect(() => {
    if (!isOpen || !detailsProp) return;
    setLoading(true);

    const lotSize = detailsProp.lotSize || 65;
    const currentQty = Math.max(1, lots) * lotSize;
    const currentPrice = price > 0 ? price : detailsProp.price;

    const queryParams = new URLSearchParams({
      exchange: detailsProp.exchange,
      underlying: detailsProp.underlying,
      expiry: detailsProp.expiry,
      strike: String(detailsProp.strike),
      optionType: detailsProp.optionType,
      side,
      quantity: String(currentQty),
      price: String(currentPrice),
      productType,
      instrumentToken: detailsProp.token,
    });

    const authToken = userToken || localStorage.getItem('token') || '';

    fetch(`/api/v1/margin/quote?${queryParams.toString()}`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMarginQuote(data);
        } else {
          setMarginQuote({
            canPlaceOrder: true,
            requiredMargin: currentPrice * currentQty / (productType === 'MIS' ? 5 : 1),
            availableFunds: userWalletBalance ?? 1000000,
            statutoryCharges: { total: 12.50 },
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setMarginQuote({
          canPlaceOrder: true,
          requiredMargin: currentPrice * currentQty / (productType === 'MIS' ? 5 : 1),
          availableFunds: userWalletBalance ?? 1000000,
          statutoryCharges: { total: 12.50 },
        });
        setLoading(false);
      });
  }, [isOpen, detailsProp, userToken, lots, side, orderType, price, productType, userWalletBalance]);

  if (!details) return null;

  const isBuy = side === 'BUY';
  const currentLotSize = details.lotSize || 65;
  const totalQty = Math.max(1, lots) * currentLotSize;
  const currentPrice = price > 0 ? price : details.price;
  const orderValue = currentPrice * totalQty;

  const availableFunds = marginQuote?.availableFunds ?? userWalletBalance ?? 0;
  const requiredMargin = marginQuote?.requiredMargin ?? (orderValue / (productType === 'MIS' ? 5 : 1));
  const isMarginSufficient = availableFunds >= requiredMargin;
  const marginShortfall = Math.abs(availableFunds - requiredMargin);
  const isRestricted = riskRestriction === 'REDUCE_ONLY';
  const canSubmit = isMarginSufficient && !isRestricted;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    const finalDetails: OrderPreviewDetails = {
      ...details,
      side,
      lots: Math.max(1, lots),
      lotSize: currentLotSize,
      quantity: totalQty,
      price: currentPrice,
      orderType,
      productType,
    };

    setOrderStep('PLACING');
    setRejectionMessage('');
    soundManager.playSound('order_placed');

    try {
      const authToken = userToken || localStorage.getItem('token') || '';
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          instrumentToken: finalDetails.token,
          exchange: finalDetails.exchange,
          symbol: finalDetails.symbol,
          side: finalDetails.side,
          quantity: finalDetails.quantity,
          price: finalDetails.price,
          orderType: finalDetails.orderType,
          productType: finalDetails.productType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOrderStep('SUCCESS');
        toast.trade({
          status: 'EXECUTED',
          side: finalDetails.side,
          symbol: finalDetails.symbol,
          quantity: finalDetails.quantity,
          price: finalDetails.price,
          orderType: finalDetails.orderType,
        });
        onConfirm(finalDetails);
      } else {
        const errMsg = data.error?.message || data.message || 'Order rejected by exchange validation.';
        setRejectionMessage(errMsg);
        setOrderStep('REJECTED');
        toast.trade({
          status: 'REJECTED',
          side: finalDetails.side,
          symbol: finalDetails.symbol,
          quantity: finalDetails.quantity,
          reason: errMsg,
        });
      }
    } catch (err: any) {
      const errMsg = err.message || 'Network error while routing order to engine.';
      setRejectionMessage(errMsg);
      setOrderStep('REJECTED');
      toast.trade({
        status: 'REJECTED',
        side: finalDetails.side,
        symbol: finalDetails.symbol,
        quantity: finalDetails.quantity,
        reason: errMsg,
      });
    }
  };

  const handleClose = () => {
    setOrderStep('FORM');
    setRejectionMessage('');
    onClose();
  };

  const goToFunds = () => {
    handleClose();
    navigate('/profile/funds');
  };

  let title: React.ReactNode = null;
  let footer: React.ReactNode = null;
  let dismissible = true;
  let body: React.ReactNode = null;

  if (orderStep === 'PLACING') {
    dismissible = false;
    title = <span className="text-[10px] text-[var(--text-muted)] font-bold">PROCESSING ORDER</span>;
    body = (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-[var(--info-light)] text-[var(--info)] flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
        <h3 className="text-base font-black text-[var(--text-main)] font-headline">Placing Order...</h3>
        <p className="text-[11px] text-[var(--text-muted)] font-bold text-center">
          Processing your {side} order for {details.symbol}
        </p>
      </div>
    );
  } else if (orderStep === 'SUCCESS') {
    title = <Badge variant="gain">ORDER PLACED</Badge>;
    body = (
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[var(--gain-light)] text-[var(--gain)] flex items-center justify-center animate-in zoom-in duration-300">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-black text-[var(--text-main)] font-headline">Order Executed!</h3>
        <p className="text-[11px] text-[var(--text-muted)] font-bold text-center max-w-xs">
          {side} {lots} Lot(s) of {details.symbol} @ ₹{currentPrice.toFixed(2)} placed successfully.
        </p>
        <div className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl p-3 space-y-1.5 text-[11px] tabular-nums">
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Symbol</span><span className="font-bold text-[var(--text-main)]">{details.symbol}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Quantity</span><span className="font-bold text-[var(--text-main)]">{totalQty} ({lots} Lot{lots > 1 ? 's' : ''})</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Price</span><span className="font-bold text-[var(--text-main)]">₹{currentPrice.toFixed(2)}</span></div>
          <div className="flex justify-between border-t border-[var(--border-color)] pt-1.5"><span className="text-[var(--text-muted)]">Order Value</span><span className="font-bold text-[var(--gain)]">₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>
    );
    footer = (
      <Button
        variant="primary"
        className="w-full justify-center"
        onClick={() => {
          handleClose();
          navigate('/portfolio/positions');
        }}
      >
        VIEW POSITIONS (→)
      </Button>
    );
  } else if (orderStep === 'REJECTED') {
    title = <Badge variant="loss">ORDER REJECTED</Badge>;
    body = (
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[var(--loss-light)] text-[var(--loss)] flex items-center justify-center animate-in zoom-in duration-300">
          <XCircle className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-black text-[var(--loss)] font-headline">Order Rejected</h3>
        <p className="text-[11px] text-[var(--text-muted)] font-bold text-center">Your {side} order for {details.symbol} could not be placed.</p>
        <div className="w-full bg-[var(--loss-light)] border border-[var(--loss)]/30 rounded-xl p-3.5 text-left">
          <div className="text-[9px] font-bold text-[var(--loss)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={12} /> REJECTION REASON
          </div>
          <p className="text-[12px] font-bold text-[var(--loss)] leading-relaxed">{rejectionMessage}</p>
        </div>
        <div className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl p-3 space-y-1.5 text-[11px] tabular-nums">
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Symbol</span><span className="font-bold text-[var(--text-main)]">{details.symbol}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Side</span><span className={`font-bold ${isBuy ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>{side}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Qty × Price</span><span className="font-bold text-[var(--text-main)]">{totalQty} × ₹{currentPrice.toFixed(2)}</span></div>
          <div className="flex justify-between border-t border-[var(--border-color)] pt-1.5"><span className="text-[var(--text-muted)]">Required Capital</span><span className="font-bold text-[var(--loss)]">₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>
    );
    footer = (
      <div className="w-full space-y-2">
        <Button variant="primary" className="w-full justify-center" leftIcon={<Send size={14} />} onClick={() => { setOrderStep('FORM'); setRejectionMessage(''); }}>RETRY ORDER</Button>
        <Button variant="secondary" className="w-full justify-center" onClick={handleClose}>CLOSE</Button>
      </div>
    );
  } else {
    // FORM
    title = (
      <div className="flex items-center gap-2">
        <Badge variant={isBuy ? 'gain' : 'loss'}>ORDER PREVIEW ({side})</Badge>
        <span className="text-[10px] text-[var(--text-muted)] font-bold">{details.exchange}</span>
      </div>
    );
    body = (
      <div className="space-y-2.5 font-label text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline font-extrabold text-base text-[var(--text-main)] tracking-tight">{details.symbol}</h2>
            {details.expiry && <p className="text-[10px] text-[var(--text-muted)] font-semibold">Expiry: {details.expiry}</p>}
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">SPOT / LTP</span>
            <span className="text-xs font-bold text-[var(--gain)] tabular-nums">₹{currentPrice.toFixed(2)}</span>
          </div>
        </div>

        {sideEditable && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-color)]">
            <button type="button" onClick={() => setSide('BUY')} className={`py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[40px] ${side === 'BUY' ? 'bg-[var(--gain)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>BUY</button>
            <button type="button" onClick={() => setSide('SELL')} className={`py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[40px] ${side === 'SELL' ? 'bg-[var(--loss)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>SELL</button>
          </div>
        )}

        {isRestricted && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-light)]">
            <ShieldAlert className="w-4 h-4 text-[var(--warning)] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-[var(--warning)]">
              Account restricted to reduce-only trading pending risk review. New or exposure-increasing orders are blocked until a risk review clears this restriction.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[var(--bg-surface-elevated)] p-2.5 rounded-xl border border-[var(--border-color)]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-tight">EDIT LOTS</span>
              <span className="text-[9px] text-[var(--gain)] font-bold">{currentLotSize} Qty/Lot</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setLots((prev) => Math.max(1, prev - 1))} aria-label="Decrease lots" className="w-7 h-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] font-bold text-xs text-[var(--text-main)] hover:bg-[var(--primary)] hover:text-white flex items-center justify-center transition-colors">
                  <Minus size={12} />
                </button>
                <input type="number" min="1" value={lots} onChange={(e) => setLots(Math.max(1, parseInt(e.target.value, 10) || 1))} aria-label="Number of lots" className="w-10 text-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg py-0.5 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] tabular-nums" />
                <button type="button" onClick={() => setLots((prev) => prev + 1)} aria-label="Increase lots" className="w-7 h-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] font-bold text-xs text-[var(--text-main)] hover:bg-[var(--primary)] hover:text-white flex items-center justify-center transition-colors">
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] mt-1 block tabular-nums">= {totalQty} Qty Total</span>
          </div>

          <div className="bg-[var(--bg-surface-elevated)] p-2.5 rounded-xl border border-[var(--border-color)] flex flex-col justify-between">
            <span className="text-[9px] text-[var(--text-muted)] font-bold block mb-1 uppercase tracking-tight">ORDER TYPE & PRICE</span>
            <div className="grid grid-cols-3 gap-0.5 bg-[var(--bg-surface)] p-0.5 rounded-lg border border-[var(--border-color)] mb-1 font-headline">
              {(['MARKET', 'LIMIT', 'SL'] as const).map((type) => (
                <button key={type} type="button" onClick={() => setOrderType(type)} className={`py-0.5 rounded text-[9px] font-black transition-all ${orderType === type ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{type}</button>
              ))}
            </div>
            {orderType === 'MARKET' ? (
              <span className="text-[11px] font-bold text-[var(--text-main)] tabular-nums">₹{details.price.toFixed(2)} (MARKET)</span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">₹</span>
                <input type="number" step="0.05" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded px-1.5 py-0.5 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] tabular-nums" placeholder="Limit Price" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between bg-[var(--bg-surface-elevated)] p-2.5 rounded-xl border border-[var(--border-color)]">
          <span className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase font-headline">PRODUCT TYPE:</span>
          <div className="flex gap-1.5 font-headline">
            <button type="button" onClick={() => setProductType('MIS')} className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${productType === 'MIS' ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs' : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>MIS (Intraday)</button>
            <button type="button" onClick={() => setProductType('NRML')} className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${productType === 'NRML' ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs' : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>NRML (Overnight)</button>
          </div>
        </div>

        {loading ? (
          <div className="p-3 text-center text-[10px] text-[var(--text-muted)] flex items-center justify-center gap-1.5">
            <div className="w-3.5 h-3.5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            Recalculating Margin...
          </div>
        ) : marginQuote ? (
          <div className="space-y-2">
            <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2 text-[11px] tabular-nums">
              <div className="flex justify-between items-center text-[var(--text-muted)]">
                <span>Gross Order Premium ({totalQty} Qty):</span>
                <span className="font-bold text-[var(--text-main)]">₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1 px-2 rounded-lg bg-[var(--gain-light)] border border-[var(--gain)]/20 text-[var(--gain)] font-bold text-[10px]">
                <span className="flex items-center gap-1"><ShieldCheck size={12} /> Platform Brokerage:</span>
                <span className="text-xs font-black">₹0.00 (FREE)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border-color)]">
                <div className="bg-[var(--bg-surface)] p-2 rounded-xl border border-[var(--info)]/30 flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] text-[var(--info)] font-bold uppercase tracking-tight flex items-center gap-1"><Wallet size={12} /> Available Margin</span>
                  <span className="text-xs font-extrabold text-[var(--info)] mt-1">₹{availableFunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className={`bg-[var(--bg-surface)] p-2 rounded-xl border flex flex-col justify-between shadow-sm ${isMarginSufficient ? 'border-[var(--gain)]/30' : 'border-[var(--loss)]/40'}`}>
                  <span className={`text-[9px] font-bold uppercase tracking-tight flex items-center gap-1 ${isMarginSufficient ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}><Calculator size={12} /> Required Margin</span>
                  <span className={`text-xs font-extrabold mt-1 ${isMarginSufficient ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>₹{requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className={`py-1.5 px-2 rounded-lg flex items-center justify-between text-[10px] font-bold border ${isMarginSufficient ? 'bg-[var(--gain-light)] border-[var(--gain)]/20 text-[var(--gain)]' : 'bg-[var(--loss-light)] border-[var(--loss)]/30 text-[var(--loss)]'}`}>
                <span className="flex items-center gap-1">
                  {isMarginSufficient ? (<><CheckCircle2 size={12} /><span>Margin Status:</span></>) : (<><AlertTriangle size={12} /><span>Shortfall Alert:</span></>)}
                </span>
                <span className="font-mono">
                  {isMarginSufficient ? `✓ Sufficient (₹${marginShortfall.toLocaleString('en-IN', { minimumFractionDigits: 2 })} left)` : `⚠️ Need ₹${marginShortfall.toLocaleString('en-IN', { minimumFractionDigits: 2 })} more`}
                </span>
              </div>
              {!isMarginSufficient && (
                <button type="button" onClick={goToFunds} className="w-full text-center py-1.5 text-[10px] font-bold text-[var(--primary)] hover:underline">
                  Add funds in Profile → Funds
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
    footer = (
      <div className="flex items-center justify-between gap-2 w-full">
        <Button variant="secondary" onClick={handleClose}>CANCEL</Button>
        <Button variant={isBuy ? 'primary' : 'destructive'} className="flex-1 justify-center" leftIcon={<Send size={14} />} disabled={!canSubmit} onClick={handleConfirm}>
          {isRestricted ? 'RESTRICTED' : `CONFIRM ${side} ORDER`}
        </Button>
      </div>
    );
  }

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title={title} footer={footer} dismissible={dismissible}>
      {body}
    </Dialog>
  );
};
