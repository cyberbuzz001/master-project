import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, TrendingUp, Layers, Activity, ChevronUp } from 'lucide-react';
import { PriceBadge } from './PriceBadge';
import { useTickFreshness } from '../hooks/useTickFreshness';
import { MarketTick } from '../types';

interface IndexActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  indexSymbol: string;
  token: string;
  exchange?: string;
  latestTick?: MarketTick;
  onOpenChart: (symbol: string, token: string, exchange: string) => void;
  onOpenOptionChain: (indexSymbol: string) => void;
}

// ── Reusable LivePrice component ──────────────────────────────────────
interface LivePriceProps {
  value: number;
  className?: string;
  prefix?: string;
  decimals?: number;
}

export const LivePrice: React.FC<LivePriceProps> = ({ value, className = '', prefix = '₹', decimals = 2 }) => {
  const prevRef = useRef<number>(value);
  const [flashClass, setFlashClass] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevRef.current !== value && prevRef.current !== 0) {
      const dir = value > prevRef.current ? 'price-flash-up' : 'price-flash-down';
      setFlashClass(dir);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setFlashClass(''), 400);
    }
    prevRef.current = value;
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value]);

  const formatted = value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <span className={`${flashClass} ${className} rounded-sm transition-colors`}>
      {prefix}{formatted}
    </span>
  );
};

// ── IndexActionModal ───────────────────────────────────────────────────
export const IndexActionModal: React.FC<IndexActionModalProps> = ({
  isOpen,
  onClose,
  indexSymbol,
  token,
  exchange = 'NSE',
  latestTick,
  onOpenChart,
  onOpenOptionChain,
}) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const freshness = useTickFreshness(token);
  const activeTick = latestTick || freshness.tick;

  const cleanIndex = indexSymbol.includes('SENSEX')
    ? 'SENSEX'
    : indexSymbol.includes('BANK')
    ? 'BANKNIFTY'
    : indexSymbol.includes('FIN')
    ? 'FINNIFTY'
    : 'NIFTY';

  const isGain = (activeTick?.change ?? 0) >= 0;
  const canOpenChain = cleanIndex === 'SENSEX' || cleanIndex === 'NIFTY';

  // Mount → animate in
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // RAF to allow DOM paint before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    navigator.vibrate?.(15);
    setVisible(false);
    setTimeout(() => {
      setMounted(false);
      onClose();
    }, 300);
  }, [onClose]);

  const handleOpenChart = useCallback(() => {
    setChartLoading(true);
    navigator.vibrate?.(20);
    setTimeout(() => {
      setChartLoading(false);
      handleClose();
      onOpenChart(indexSymbol, token, exchange);
    }, 180);
  }, [indexSymbol, token, exchange, handleClose, onOpenChart]);

  const handleOpenOptionChain = useCallback(() => {
    if (!canOpenChain) return;
    setChainLoading(true);
    navigator.vibrate?.(20);
    setTimeout(() => {
      setChainLoading(false);
      handleClose();
      onOpenOptionChain(cleanIndex);
    }, 180);
  }, [canOpenChain, cleanIndex, handleClose, onOpenOptionChain]);

  // Dismiss on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // Dismiss on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  if (!mounted) return null;

  return (
    <>
      {/* ── BACKDROP: subtle blur + gentle dark/light overlay ── */}
      <div
        onClick={handleBackdropClick}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          /* Preserve content readability: 70-85% background visibility */
          backgroundColor: 'rgba(2,6,23,0.18)',
          backdropFilter: visible ? 'blur(10px)' : 'blur(0px)',
          WebkitBackdropFilter: visible ? 'blur(10px)' : 'blur(0px)',
          /* Fallback for devices without backdrop-filter: */
          background: visible
            ? 'rgba(2,6,23,0.22)'
            : 'transparent',
          transition: 'background-color 0.28s ease, backdrop-filter 0.28s ease',
          opacity: visible ? 1 : 0,
        }}
      />

      {/* ── BOTTOM SHEET ── */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${indexSymbol} action panel`}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 70,
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.30s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease-out',
          willChange: 'transform, opacity',
        }}
        className="px-0"
      >
        {/* Glass surface */}
        <div
          style={{
            /* Light theme: near-opaque white glass */
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.75)',
            borderLeft: '1px solid rgba(255,255,255,0.6)',
            borderRight: '1px solid rgba(255,255,255,0.6)',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            boxShadow: '0 -8px 40px rgba(15,23,42,0.10), 0 -2px 8px rgba(15,23,42,0.06)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 8px)',
          }}
          className="dark:!bg-slate-900/97 dark:!border-slate-700/60 font-body"
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div
              style={{ width: 44, height: 5, borderRadius: 3 }}
              className="bg-slate-200 dark:bg-slate-700"
            />
          </div>

          <div className="px-5 pb-5 space-y-4">
            {/* ── Header: icon + symbol + price ── */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                {/* Animated icon */}
                <div
                  className="p-2.5 rounded-2xl border"
                  style={{
                    background: isGain ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)',
                    borderColor: isGain ? 'rgba(22,163,74,0.20)' : 'rgba(220,38,38,0.20)',
                  }}
                >
                  <Activity
                    size={20}
                    className={isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-extrabold text-lg text-[var(--text-main)] font-headline leading-tight">
                      {indexSymbol}
                    </h3>
                    <span className="text-[10px] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)] px-2 py-0.5 rounded font-mono font-bold">
                      {exchange}
                    </span>
                    {/* Live pulse indicator */}
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      <span className="live-dot w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      LIVE
                    </span>
                  </div>

                  {activeTick ? (
                    <div className="flex items-baseline gap-2 font-mono">
                      <LivePrice
                        value={activeTick.ltp}
                        className="font-extrabold text-base text-[var(--text-main)]"
                      />
                      <span className={`text-xs font-bold ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {activeTick.change >= 0 ? '+' : ''}{activeTick.change.toFixed(2)} ({activeTick.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  ) : (
                    /* Skeleton loader while waiting for first tick */
                    <div className="flex items-center gap-2 mt-1">
                      <div className="skeleton-shimmer h-4 w-24 rounded" />
                      <div className="skeleton-shimmer h-3 w-16 rounded" />
                    </div>
                  )}
                </div>
              </div>

              {/* Close button with scale feedback */}
              <button
                ref={closeButtonRef}
                onClick={handleClose}
                aria-label="Close panel"
                className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-color)] transition-all duration-150 cursor-pointer active:scale-90 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* Select action label */}
            <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
              Select an action for <strong className="text-[var(--text-main)]">{indexSymbol}</strong> spot index:
            </p>

            {/* ── Action Buttons ── */}
            <div className="space-y-2.5">

              {/* Primary: Live Chart */}
              <button
                onClick={handleOpenChart}
                disabled={chartLoading}
                aria-label="View Interactive Live Chart"
                className="w-full p-4 rounded-2xl text-white font-black text-sm flex items-center justify-between transition-all duration-200 cursor-pointer active:scale-[0.98] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 min-h-[64px] group"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                  boxShadow: '0 4px 16px rgba(5,150,105,0.30), 0 1px 4px rgba(5,150,105,0.20)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(5,150,105,0.38), 0 2px 8px rgba(5,150,105,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(5,150,105,0.30), 0 1px 4px rgba(5,150,105,0.20)'; }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/15 group-hover:bg-white/20 transition-colors">
                    <TrendingUp size={18} />
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-sm">View Interactive Live Chart</span>
                    <span className="block text-[11px] text-white/80 font-normal mt-0.5">
                      Real-time candlesticks, indicators & timeframes
                    </span>
                  </div>
                </div>
                <div className="shrink-0 pl-2">
                  {chartLoading ? (
                    <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="text-xs font-mono bg-white/20 px-2.5 py-1 rounded-lg whitespace-nowrap">
                      📈 Open
                    </span>
                  )}
                </div>
              </button>

              {/* Secondary: Option Chain */}
              {canOpenChain ? (
                <button
                  onClick={handleOpenOptionChain}
                  disabled={chainLoading}
                  aria-label="View Full Option Chain"
                  className="w-full p-4 rounded-2xl font-black text-sm flex items-center justify-between transition-all duration-200 cursor-pointer active:scale-[0.98] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 min-h-[64px] group border border-[var(--border-color)] text-[var(--text-main)]"
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.15), 0 1px 4px rgba(99,102,241,0.10)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(15,23,42,0.06)'; }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                      <Layers size={18} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-sm text-[var(--text-main)]">View Full Option Chain</span>
                      <span className="block text-[11px] text-[var(--text-muted)] font-normal mt-0.5">
                        All strikes, Greeks, IV, PCR & Open Interest
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 pl-2">
                    {chainLoading ? (
                      <div className="w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
                    ) : (
                      <span className="text-xs font-mono bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg whitespace-nowrap">
                        ⛓ Open
                      </span>
                    )}
                  </div>
                </button>
              ) : (
                /* Disabled state for BANKNIFTY / FINNIFTY */
                <div
                  className="w-full p-4 rounded-2xl border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-sm flex items-center justify-between opacity-50 cursor-not-allowed select-none min-h-[64px]"
                  style={{ background: 'var(--bg-surface-elevated)' }}
                  title="Option Chain is disabled for this index to conserve API limits"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                      <Layers size={18} className="text-[var(--text-tertiary)]" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text-muted)]">Option Chain</span>
                        <span className="text-[9px] bg-rose-500/15 text-rose-500 font-bold px-1.5 py-0.5 rounded border border-rose-500/25">
                          DISABLED
                        </span>
                      </div>
                      <span className="block text-[11px] text-[var(--text-tertiary)] font-normal mt-0.5">
                        Temporarily disabled to save API quota
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono bg-[var(--bg-surface)] text-[var(--text-tertiary)] px-2.5 py-1 rounded-lg">
                    🔒 Off
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
