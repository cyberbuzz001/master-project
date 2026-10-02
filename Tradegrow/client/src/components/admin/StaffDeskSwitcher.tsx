import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, ArrowRight, Sparkles, Building2, ChevronDown } from 'lucide-react';

interface StaffDeskSwitcherProps {
  token: string;
}

export const StaffDeskSwitcher: React.FC<StaffDeskSwitcherProps> = ({ token }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwitchToExpertStocks = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/v1/auth/sso/ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to generate staff SSO ticket');
      }

      const ticket = data.ticket;
      // Open Expert Stocks Advisory & CRM Portal with single-use SSO Ticket
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const targetBase = isLocal ? 'http://localhost:3000' : 'https://expertstocks.in';
      const targetUrl = `${targetBase}/sso?ticket=${encodeURIComponent(ticket)}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      setIsOpen(false);
    } catch (err: any) {
      console.error('[Staff SSO] Failed to switch desk:', err);
      setError(err.message || 'SSO Handshake failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-[var(--primary)] text-[11px] font-bold text-[var(--text-main)] transition-colors cursor-pointer"
        title="Switch Management Desk (Unified Staff SSO)"
      >
        <Building2 className="w-3.5 h-3.5 text-[var(--primary)]" />
        <span className="hidden md:inline">Staff Desks</span>
        <ChevronDown className={`w-3 h-3 text-[var(--text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 shadow-2xl z-50 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <div>
                <span className="text-[9px] font-extrabold text-[var(--primary)] uppercase tracking-wider block">Unified Staff Identity</span>
                <h4 className="text-xs font-bold text-[var(--text-main)]">Operational Desks</h4>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" /> Staff SSO
              </span>
            </div>

            <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
              SEBI Chinese Wall: Client accounts remain strictly separated. Employees and analysts can switch desks using encrypted single-use tokens.
            </p>

            <div className="space-y-2">
              {/* Current: TradeGrow Desk */}
              <div className="p-2.5 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-light)]/20 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                    <span className="text-xs font-bold text-[var(--text-main)]">TradeGrow Brokerage</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">tradegrowx.in (RMS, OMS, War Room)</span>
                </div>
                <span className="text-[9px] font-bold text-[var(--primary)] uppercase bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                  Active
                </span>
              </div>

              {/* Target: Expert Stocks Advisory Desk */}
              <button
                onClick={handleSwitchToExpertStocks}
                disabled={loading}
                className="w-full text-left p-2.5 rounded-lg border border-[var(--border-color)] hover:border-emerald-500/50 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)]/80 transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs font-bold text-[var(--text-main)] group-hover:text-emerald-400 transition-colors">
                        Expert Stocks Desk
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                      expertstocks.in/office (CRM, Telecaller, Research)
                    </span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" />
                </div>
                <div className="mt-2 pt-1.5 border-t border-[var(--border-light)] flex items-center justify-between text-[10px]">
                  <span className="text-[var(--text-tertiary)]">{loading ? 'Generating 60s ticket...' : '1-Click Staff Handoff'}</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    Launch Desk <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            </div>

            {error && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-400">
                {error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
