import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2, AlertCircle, XCircle, Bell, ShieldAlert,
  ArrowUpRight, ArrowDownRight, X, Sparkles, ExternalLink
} from 'lucide-react';
import { soundManager, SoundEvent } from '../utils/soundManager';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'trade' | 'security' | 'alert';

export interface ToastOptions {
  id?: string;
  type?: ToastType;
  title: string;
  message?: string;
  details?: string;
  meta?: string;
  duration?: number; // ms, default 4200
  sound?: SoundEvent | false;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastItem extends ToastOptions {
  id: string;
  createdAt: number;
  progress: number;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => string;
  success: (title: string, message?: string, sound?: SoundEvent) => string;
  error: (title: string, message?: string, sound?: SoundEvent) => string;
  warning: (title: string, message?: string, sound?: SoundEvent) => string;
  info: (title: string, message?: string, sound?: SoundEvent) => string;
  trade: (tradeInfo: {
    status: 'PLACED' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
    side: 'BUY' | 'SELL';
    symbol: string;
    quantity: number | string;
    price?: number | string;
    orderType?: string;
    reason?: string;
  }) => string;
  priceAlert: (alertInfo: {
    symbol: string;
    targetPrice: number;
    currentPrice?: number;
    condition?: string;
  }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timeoutsRef.current.has(id)) {
      clearTimeout(timeoutsRef.current.get(id)!);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (opts: ToastOptions): string => {
      const id = opts.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const duration = opts.duration !== undefined ? opts.duration : 4200;

      // Determine sound to play
      let soundToPlay: SoundEvent | false | undefined = opts.sound;
      if (soundToPlay === undefined) {
        switch (opts.type) {
          case 'trade':
            soundToPlay = 'order_executed';
            break;
          case 'alert':
            soundToPlay = 'price_alert';
            break;
          case 'security':
            soundToPlay = 'security_alert';
            break;
          case 'error':
            soundToPlay = 'order_rejected';
            break;
          case 'warning':
            soundToPlay = 'stop_loss';
            break;
          case 'success':
            soundToPlay = 'notification';
            break;
          default:
            soundToPlay = 'notification';
            break;
        }
      }

      if (soundToPlay) {
        soundManager.playSound(soundToPlay);
      }

      const newToast: ToastItem = {
        ...opts,
        id,
        duration,
        createdAt: Date.now(),
        progress: 100,
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 4)]); // max 5 simultaneous

      if (duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, duration);
        timeoutsRef.current.set(id, timeout);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, message?: string, sound: SoundEvent = 'notification') =>
      showToast({ type: 'success', title, message, sound }),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string, sound: SoundEvent = 'order_rejected') =>
      showToast({ type: 'error', title, message, sound }),
    [showToast]
  );

  const warning = useCallback(
    (title: string, message?: string, sound: SoundEvent = 'stop_loss') =>
      showToast({ type: 'warning', title, message, sound }),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string, sound: SoundEvent = 'notification') =>
      showToast({ type: 'info', title, message, sound }),
    [showToast]
  );

  const trade = useCallback(
    (t: {
      status: 'PLACED' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
      side: 'BUY' | 'SELL';
      symbol: string;
      quantity: number | string;
      price?: number | string;
      orderType?: string;
      reason?: string;
    }) => {
      let title = 'Order Update';
      let type: ToastType = 'trade';
      let sound: SoundEvent = 'order_placed';
      const sideText = t.side.toUpperCase();

      if (t.status === 'PLACED') {
        title = `Order Placed: ${sideText} ${t.symbol}`;
        sound = 'order_placed';
      } else if (t.status === 'EXECUTED') {
        title = `✓ Order Executed`;
        sound = 'order_executed';
        type = 'success';
      } else if (t.status === 'REJECTED') {
        title = `✕ Order Rejected: ${sideText} ${t.symbol}`;
        sound = 'order_rejected';
        type = 'error';
      } else if (t.status === 'CANCELLED') {
        title = `Order Cancelled: ${sideText} ${t.symbol}`;
        sound = 'order_rejected';
        type = 'warning';
      }

      const pVal = t.price ? Number(t.price) : 0;
      const meta = pVal > 0 ? `₹${pVal.toFixed(2)}` : (t.orderType ? `${t.orderType} Market` : '');
      const details = `${t.symbol} • ${sideText} • ${t.quantity} shares`;

      return showToast({
        type,
        title,
        message: t.reason,
        details,
        meta,
        sound,
        duration: 4800,
      });
    },
    [showToast]
  );

  const priceAlert = useCallback(
    (a: {
      symbol: string;
      targetPrice: number;
      currentPrice?: number;
      condition?: string;
    }) => {
      const cond = a.condition === 'GREATER_THAN' || a.condition === '>=' ? '≥' : '≤';
      return showToast({
        type: 'alert',
        title: `🎯 Price Alert Triggered`,
        details: `${a.symbol} ${cond} ₹${a.targetPrice.toFixed(2)}`,
        meta: a.currentPrice ? `Current: ₹${a.currentPrice.toFixed(2)}` : undefined,
        sound: 'price_alert',
        duration: 5200,
      });
    },
    [showToast]
  );

  // Clean up timeouts on unmount and listen for real-time WebSocket market-notifications
  useEffect(() => {
    const handleMarketNotification = (e: any) => {
      const d = e.detail;
      if (!d) return;
      let sound: SoundEvent = 'notification';
      let type: ToastType = 'info';
      if (d.type === 'ORDER_FILLED') { sound = 'order_executed'; type = 'success'; }
      else if (d.type === 'ORDER_REJECTED') { sound = 'order_rejected'; type = 'error'; }
      else if (d.type === 'ALERT_TRIGGERED') { sound = 'price_alert'; type = 'alert'; }
      else if (d.type === 'ADMIN_MESSAGE') { sound = 'security_alert'; type = 'security'; }
      else if (d.sound) { sound = d.sound; }

      showToast({
        type,
        title: d.title || 'Platform Notification',
        message: d.body || d.message,
        details: d.details,
        meta: d.meta,
        sound,
      });
    };

    window.addEventListener('market-notification' as any, handleMarketNotification);

    return () => {
      window.removeEventListener('market-notification' as any, handleMarketNotification);
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, [showToast]);

  const getToastIcon = (t: ToastItem) => {
    switch (t.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'alert':
        return <Bell className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />;
      case 'security':
        return <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />;
      case 'trade':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      default:
        return <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />;
    }
  };

  const getAccentBorder = (t: ToastItem) => {
    switch (t.type) {
      case 'success':
      case 'trade':
        return 'border-l-4 border-l-emerald-500';
      case 'error':
        return 'border-l-4 border-l-rose-500';
      case 'warning':
        return 'border-l-4 border-l-amber-500';
      case 'alert':
        return 'border-l-4 border-l-amber-400';
      case 'security':
        return 'border-l-4 border-l-purple-500';
      default:
        return 'border-l-4 border-l-[var(--primary)]';
    }
  };

  const portalContent = typeof document !== 'undefined' ? (
    <div
      className="fixed top-4 right-4 z-[999999] flex flex-col gap-2.5 max-w-[92vw] w-[380px] pointer-events-none select-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-[var(--bg-surface)]/95 border border-[var(--border-color)] ${getAccentBorder(toast)} shadow-2xl backdrop-blur-xl p-3.5 transition-all duration-300 ease-out transform translate-y-0 opacity-100 animate-in slide-in-from-top-3 fade-in`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]/60">
              {getToastIcon(toast)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black tracking-wide text-[var(--text-main)] truncate">
                  {toast.title}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap">
                  just now
                </span>
              </div>

              {toast.details && (
                <div className="text-[11.5px] font-semibold text-[var(--text-muted)] mt-0.5 truncate">
                  {toast.details}
                </div>
              )}

              {toast.meta && (
                <div className="text-[12px] font-mono font-extrabold text-[var(--text-main)] mt-0.5">
                  {toast.meta}
                </div>
              )}

              {toast.message && (
                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug break-words">
                  {toast.message}
                </p>
              )}

              {toast.action && (
                <button
                  onClick={() => {
                    toast.action!.onClick();
                    dismiss(toast.id);
                  }}
                  className="mt-2 text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                >
                  <span>{toast.action.label}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => dismiss(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-lg hover:bg-[var(--bg-surface-elevated)] transition-colors"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress bar countdown indicator */}
          {toast.duration && toast.duration > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[var(--border-color)]/40 overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-[4200ms] ease-linear"
                style={{
                  width: '100%',
                  animation: `toastCountdown ${toast.duration}ms linear forwards`,
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <ToastContext.Provider
      value={{
        showToast,
        success,
        error,
        warning,
        info,
        trade,
        priceAlert,
        dismiss,
      }}
    >
      {children}
      {portalContent && createPortal(portalContent, document.body)}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
