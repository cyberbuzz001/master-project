import React, { useState, useEffect } from 'react';
import { AlertTriangle, Power, PowerOff, ShieldAlert } from 'lucide-react';

interface KillSwitchProps { token: string; }

export const KillSwitch: React.FC<KillSwitchProps> = ({ token }) => {
  const [states, setStates] = useState<any[]>([]);
  const [confirmScope, setConfirmScope] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const fetchStates = () => {
    fetch('/api/v1/admin/risk/kill-switch', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setStates(d.states));
  };

  useEffect(() => { fetchStates(); }, [token]);

  const handleToggle = async (scope: string, currentlyActive: boolean) => {
    if (!reason.trim()) return;
    await fetch('/api/v1/admin/risk/kill-switch', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ scope, action: currentlyActive ? 'DEACTIVATE' : 'ACTIVATE', reason })
    });
    setConfirmScope(null);
    setReason('');
    fetchStates();
  };

  const scopeLabels: Record<string, { label: string; desc: string }> = {
    GLOBAL: { label: 'Global Trading', desc: 'Halt ALL trading across ALL exchanges and segments' },
    NSE: { label: 'NSE', desc: 'National Stock Exchange' },
    BSE: { label: 'BSE', desc: 'Bombay Stock Exchange' },
    MCX: { label: 'MCX', desc: 'Multi Commodity Exchange' },
    EQUITY: { label: 'Equity Segment', desc: 'Cash equity market segment' },
    FUTURES: { label: 'Futures Segment', desc: 'Futures & forwards segment' },
    OPTIONS: { label: 'Options Segment', desc: 'Options derivatives segment' },
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-[var(--loss-light)]/40 border border-[var(--loss)] rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-[var(--loss)] flex-shrink-0" />
        <div className="text-xs text-[var(--loss)]">
          <strong>RESTRICTED ACCESS</strong> — Kill switch controls require SUPER_ADMIN privileges and produce immutable audit records. Each action requires a reason and confirmation.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {states.map(s => {
          const meta = scopeLabels[s.scope] || { label: s.scope, desc: '' };
          const isGlobal = s.scope === 'GLOBAL';
          return (
            <div key={s.scope} className={`border rounded-xl p-4 flex items-center justify-between transition ${
              s.is_active ? 'bg-[var(--loss-light)]/30 border-[var(--loss)]' : 'bg-[var(--bg-surface)]/60 border-[var(--border-color)]'
            } ${isGlobal ? 'border-2' : ''}`}>
              <div className="flex items-center gap-4">
                {s.is_active ? <PowerOff className="w-6 h-6 text-[var(--loss)]" /> : <Power className="w-6 h-6 text-[var(--primary)]" />}
                <div>
                  <span className={`font-bold text-sm ${isGlobal ? 'text-lg' : ''} ${s.is_active ? 'text-[var(--loss)]' : 'text-[var(--text-main)]'}`}>{meta.label}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">{meta.desc}</span>
                  {s.reason && <span className="text-[10px] text-[var(--warning)] block mt-0.5">Reason: {s.reason}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.is_active ? 'bg-[var(--loss-light)] text-[var(--loss)]' : 'bg-[var(--primary-light)] text-[var(--primary)]'}`}>
                  {s.is_active ? '⛔ HALTED' : '✅ ACTIVE'}
                </span>
                {confirmScope === s.scope ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)..."
                      className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-main)] w-48" />
                    <button onClick={() => handleToggle(s.scope, s.is_active)} disabled={!reason.trim()}
                      className="bg-[var(--loss)] hover:bg-[var(--loss)] disabled:bg-[var(--bg-surface-elevated)] text-[var(--text-on-accent)] disabled:text-[var(--text-muted)] text-xs font-bold px-3 py-1 rounded transition">
                      CONFIRM
                    </button>
                    <button onClick={() => { setConfirmScope(null); setReason(''); }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs px-2 py-1">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmScope(s.scope)}
                    className={`text-xs font-bold px-3 py-1 rounded transition ${
                      s.is_active ? 'bg-[var(--primary-hover)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)]' : 'bg-[var(--loss)] hover:bg-[var(--loss)] text-[var(--text-on-accent)]'
                    }`}>
                    {s.is_active ? 'Resume' : 'Halt'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
