import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, AlertTriangle, DollarSign, ShieldAlert, UserX, WifiOff } from 'lucide-react';
import { useMarketSocket, useAdminSubscribeAll } from '../../hooks/useMarketSocket';

interface AdminNotificationBellProps { token: string; }

interface AdminNotification {
  id: string;
  event_type: string;
  user_id: string | null;
  username?: string;
  email?: string;
  payload: Record<string, any>;
  created_at: string;
  read_at: string | null;
}

function describeNotification(n: AdminNotification): { icon: React.ReactNode; text: string; severityColor: string } {
  const who = n.username ? n.username : (n.user_id || 'a customer');
  const p = n.payload || {};
  if (n.event_type === 'FUND_REQUEST_CREATED') {
    return {
      icon: <DollarSign className="w-3.5 h-3.5" />,
      text: `${who} submitted a ${p.requestType?.toLowerCase() || 'fund'} request for ₹${Number(p.amount || 0).toLocaleString('en-IN')}`,
      severityColor: 'text-[var(--gogrow-blue)]',
    };
  }
  if (n.event_type === 'FUND_REQUEST_UPDATED') {
    return {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      text: `Withdrawal for ${who} (₹${Number(p.amount || 0).toLocaleString('en-IN')}) escalated to Tier-2 — needs a senior approver`,
      severityColor: 'text-[var(--loss)]',
    };
  }
  if (n.event_type === 'RMS_HARD_BREACH_SUSPEND') {
    return {
      icon: <UserX className="w-3.5 h-3.5" />,
      text: `${who} was auto-suspended by RMS: ${p.reasonDetail || 'hard loss breach'}`,
      severityColor: 'text-[var(--loss)]',
    };
  }
  if (n.event_type === 'RMS_LOSS_MONITOR_DEGRADED') {
    return {
      icon: <WifiOff className="w-3.5 h-3.5" />,
      text: `RMS loss monitor is running blind — ${p.unpricedThisCycle}/${p.scopedCount} in-scope positions have no usable price`,
      severityColor: 'text-[var(--loss)]',
    };
  }
  if (n.event_type.startsWith('RMS_')) {
    return {
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      text: `${who}: ${n.event_type.replace(/_/g, ' ').toLowerCase()} (${p.severity || 'risk event'})`,
      severityColor: p.severity === 'CRITICAL' ? 'text-[var(--loss)]' : 'text-[var(--warning)]',
    };
  }
  return {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    text: `${who}: ${n.event_type.replace(/_/g, ' ').toLowerCase()}`,
    severityColor: 'text-[var(--text-muted)]',
  };
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const AdminNotificationBell: React.FC<AdminNotificationBellProps> = ({ token }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { onAdminEvent } = useMarketSocket();
  useAdminSubscribeAll();

  const fetchNotifications = useCallback(() => {
    fetch('/api/v1/admin/notifications?limit=20', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setNotifications(d.notifications);
          setUnreadCount(d.unreadCount);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Live push: a new alert-worthy event lands immediately, no need to reopen the dropdown.
  useEffect(() => {
    const unsub = onAdminEvent(() => fetchNotifications(), 'ADMIN_NOTIFICATION_CREATED');
    return unsub;
  }, [onAdminEvent, fetchNotifications]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    fetch(`/api/v1/admin/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
    fetch('/api/v1/admin/notifications/mark-all-read', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
        title="Admin alerts"
        aria-label={`Admin alerts${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[var(--loss)] text-[var(--text-on-accent)] text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-surface)]">
            <span className="text-xs font-bold text-[var(--text-main)]">Alerts</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline cursor-pointer">
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-[10px] text-[var(--text-tertiary)]">No alerts yet.</div>
          ) : (
            notifications.map(n => {
              const { icon, text, severityColor } = describeNotification(n);
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`text-left px-3 py-2.5 border-b border-[var(--border-color)] last:border-0 flex items-start gap-2 hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer ${!n.read_at ? 'bg-[var(--primary-light)]/30' : ''}`}
                >
                  <span className={`shrink-0 mt-0.5 ${severityColor}`}>{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[var(--text-main)] leading-snug">{text}</p>
                    <span className="text-[9px] text-[var(--text-tertiary)]">{timeAgo(n.created_at)}</span>
                  </div>
                  {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-[var(--gogrow-blue)] shrink-0 mt-1.5" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
