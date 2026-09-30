import React, { useState, useEffect } from 'react';
import { Bell, X, ArrowUpRight, ArrowDownRight, Check, AlertCircle } from 'lucide-react';
import { playAlertChime } from '../utils/notifications';
import { useToast } from '../context/ToastContext';

interface CreatePriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  initialSymbol?: string;
  initialToken?: string;
  currentPrice?: number;
  onAlertCreated?: () => void;
}

export const CreatePriceAlertModal: React.FC<CreatePriceAlertModalProps> = ({
  isOpen,
  onClose,
  token,
  initialSymbol = 'NIFTY 50',
  initialToken = 'NSE_NIFTY50',
  currentPrice = 0,
  onAlertCreated,
}) => {
  const toast = useToast();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [instrumentToken, setInstrumentToken] = useState(initialToken);
  const [condition, setCondition] = useState<'GREATER_THAN' | 'LESS_THAN'>('GREATER_THAN');
  const [targetPrice, setTargetPrice] = useState<string>(currentPrice > 0 ? currentPrice.toString() : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSymbol(initialSymbol);
      setInstrumentToken(initialToken);
      setTargetPrice(currentPrice > 0 ? (currentPrice * (condition === 'GREATER_THAN' ? 1.005 : 0.995)).toFixed(2) : '');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, initialSymbol, initialToken, currentPrice]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(targetPrice);
    if (!numPrice || numPrice <= 0) {
      setError('Please enter a valid target price greater than 0');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          instrumentToken,
          symbol,
          condition,
          targetPrice: numPrice,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        toast.priceAlert({
          symbol,
          targetPrice: numPrice,
          condition: condition === 'GREATER_THAN' ? '≥' : '≤',
        });
        if (onAlertCreated) onAlertCreated();
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setError(data.error || 'Failed to create price alert');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while creating alert');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-main)]">Set Price Alert</h2>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">{symbol}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Price alert active! You will be notified when triggered.</span>
            </div>
          )}

          {/* Current Reference Price */}
          {currentPrice > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs">
              <span className="text-[var(--text-muted)]">Current Market Price (LTP)</span>
              <span className="font-mono font-bold text-[var(--text-main)]">
                ₹{currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Condition Selector */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">
              Trigger Condition
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCondition('GREATER_THAN')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  condition === 'GREATER_THAN'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500 shadow-xs'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Price rises above (≥)</span>
              </button>

              <button
                type="button"
                onClick={() => setCondition('LESS_THAN')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  condition === 'LESS_THAN'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-500 shadow-xs'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Price drops below (≤)</span>
              </button>
            </div>
          </div>

          {/* Target Price Input */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">
              Target Price (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-muted)]">
                ₹
              </span>
              <input
                type="number"
                step="any"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Enter target price"
                className="w-full pl-8 pr-4 py-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl text-sm font-mono font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || success}
              className="w-full py-2.5 px-4 bg-[var(--primary)] text-white rounded-xl text-xs font-extrabold shadow-sm hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? 'Setting Alert...' : success ? 'Alert Set!' : 'Create Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
