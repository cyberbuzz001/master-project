import React, { useState, useEffect, useRef } from 'react';
import { User, ShieldCheck, AlertTriangle, ExternalLink, Wallet, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface CustomerHoverCardProps {
  userId: string;
  username?: string;
  token: string;
  onOpenCustomer360?: (userId: string) => void;
  children: React.ReactNode;
}

export const CustomerHoverCard: React.FC<CustomerHoverCardProps> = ({
  userId,
  username,
  token,
  onOpenCustomer360,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<any | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSummary = async () => {
    if (customer || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCustomer(data.user);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
      fetchSummary();
    }, 250);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        onClick={() => onOpenCustomer360?.(userId)}
        className="cursor-pointer hover:underline text-[var(--primary)] font-mono font-bold"
      >
        {children}
      </div>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-72 p-3.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {loading && !customer ? (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-2">
              <div className="w-3.5 h-3.5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span>Loading customer snapshot...</span>
            </div>
          ) : customer ? (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2 border-b border-[var(--border-color)] pb-2">
                <div>
                  <div className="font-bold text-xs text-[var(--text-main)] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>{customer.full_name || customer.username || username || 'Customer'}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono block">
                    ID: {userId.slice(0, 12)}...
                  </span>
                </div>
                <Badge variant={customer.kyc_status === 'APPROVED' ? 'gain' : 'warning'}>
                  {customer.kyc_status || 'PENDING'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-1.5 rounded-lg bg-[var(--bg-surface-inset)]">
                  <span className="text-[9px] text-[var(--text-muted)] block">Available Margin</span>
                  <span className="font-bold text-[var(--gain)]">
                    ₹{parseFloat(customer.cash_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-[var(--bg-surface-inset)]">
                  <span className="text-[9px] text-[var(--text-muted)] block">Used Margin</span>
                  <span className="font-bold text-[var(--warning)]">
                    ₹{parseFloat(customer.used_margin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {customer.risk_restriction === 'REDUCE_ONLY' && (
                <div className="p-1.5 rounded-lg bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]/30 text-[10px] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>Account Restricted: Reduce-Only</span>
                </div>
              )}

              {onOpenCustomer360 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenCustomer360(userId);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open Full Customer 360</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
