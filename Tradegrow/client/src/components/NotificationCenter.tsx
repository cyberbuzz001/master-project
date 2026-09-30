import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, Check, CheckCheck, Trash2, ArrowUpRight, ArrowDownRight,
  TrendingUp, XCircle, AlertTriangle, Info, Clock, Plus, SlidersHorizontal
} from 'lucide-react';
import { playAlertChime } from '../utils/notifications';
import { CreatePriceAlertModal } from './CreatePriceAlertModal';
import { useToast, ToastType } from '../context/ToastContext';
import { soundManager, SoundEvent } from '../utils/soundManager';

export interface UserNotification {
  id: string;
  user_id: string;
  type: 'ORDER_FILLED' | 'ORDER_REJECTED' | 'ALERT_TRIGGERED' | 'SYSTEM' | 'ADMIN_MESSAGE';
  title: string;
  body: string;
  metadata?: any;
  is_read: boolean;
  created_at: string;
}

export interface UserPriceAlert {
  id: string;
  user_id: string;
  instrument_token: string;
  symbol: string;
  condition: 'GREATER_THAN' | 'LESS_THAN';
  target_price: number;
  is_active: boolean;
  is_triggered: boolean;
  triggered_at: string | null;
  created_at: string;
}

interface NotificationCenterProps {
  token: string;
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

function getNotifIcon(type: UserNotification['type']) {
  switch (type) {
    case 'ORDER_FILLED': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    case 'ORDER_REJECTED': return <XCircle className="w-4 h-4 text-rose-500" />;
    case 'ALERT_TRIGGERED': return <Bell className="w-4 h-4 text-amber-500" />;
    case 'ADMIN_MESSAGE': return <AlertTriangle className="w-4 h-4 text-purple-400" />;
    default: return <Info className="w-4 h-4 text-blue-400" />;
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ token }) => {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'alerts'>('notifications');
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [alerts, setAlerts] = useState<UserPriceAlert[]>([]);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertModalProps, setAlertModalProps] = useState<{ symbol?: string; token?: string; price?: number }>({});
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  const prevUnread = useRef<number>(0);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const n = data.unreadCount || 0;
          if (n > prevUnread.current && prevUnread.current !== 0 && data.notifications?.length > 0) {
            const latest = data.notifications[0];
            let sound: SoundEvent = 'notification';
            let type: ToastType = 'info';
            if (latest.type === 'ORDER_FILLED') { sound = 'order_executed'; type = 'success'; }
            else if (latest.type === 'ORDER_REJECTED') { sound = 'order_rejected'; type = 'error'; }
            else if (latest.type === 'ALERT_TRIGGERED') { sound = 'price_alert'; type = 'alert'; }
            else if (latest.type === 'ADMIN_MESSAGE') { sound = 'security_alert'; type = 'security'; }

            toast.showToast({
              type,
              title: latest.title,
              message: latest.body,
              sound,
            });
          }
          prevUnread.current = n;
          setNotifications(data.notifications || []);
          setUnreadCount(n);
        }
      }
    } catch (_) {}
  }, [token, toast]);

  const fetchAlerts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/alerts', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setAlerts(data.alerts || []);
      }
    } catch (_) {}
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    fetchAlerts();
    const id = setInterval(() => {
      fetchNotifications();
      if (activeTab === 'alerts') fetchAlerts();
    }, 12000);
    return () => clearInterval(id);
  }, [fetchNotifications, fetchAlerts, activeTab]);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) setAlertModalProps({ symbol: e.detail.symbol, token: e.detail.token, price: e.detail.price });
      setIsAlertModalOpen(true);
    };
    window.addEventListener('open-price-alert-modal' as any, handler);
    return () => window.removeEventListener('open-price-alert-modal' as any, handler);
  }, []);

  // Compute panel position from bell button rect when opening
  useEffect(() => {
    if (!isOpen || !bellBtnRef.current) return;
    const rect = bellBtnRef.current.getBoundingClientRect();
    const w = Math.min(420, window.innerWidth - 16);
    const rightEdge = window.innerWidth - rect.right;
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      right: Math.max(8, rightEdge),
      width: w,
      maxHeight: '85vh',
      zIndex: 99999,
    });
  }, [isOpen]);

  // Click-outside: check both the bell button AND the portaled panel
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!bellBtnRef.current?.contains(t) && !drawerPanelRef.current?.contains(t)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  const markRead = async (id: string) => {
    setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(p => Math.max(0, p - 1));
    try { await fetch(`/api/v1/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }); } catch (_) {}
  };

  const markAllRead = async () => {
    setNotifications(p => p.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try { await fetch('/api/v1/notifications/read-all', { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }); } catch (_) {}
  };

  const deleteNotif = async (id: string) => {
    setNotifications(p => p.filter(n => n.id !== id));
    try { await fetch(`/api/v1/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch (_) {}
  };

  const deleteAlert = async (id: string) => {
    setAlerts(p => p.filter(a => a.id !== id));
    try { await fetch(`/api/v1/alerts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch (_) {}
  };

  const displayed = notifications.filter(n => filter === 'UNREAD' ? !n.is_read : true);

  const panel = isOpen ? createPortal(
    <div ref={drawerPanelRef} style={panelStyle} className="flex flex-col bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--primary)]" /> Notifications &amp; Alerts
          </h3>
          <p className="text-[11px] text-[var(--text-muted)]">Real-time trade fills &amp; price triggers</p>
        </div>
        <div className="flex items-center gap-1.5">
          {activeTab === 'notifications' && unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-lg transition-colors" title="Mark all as read">
              <CheckCheck className="w-3.5 h-3.5" /><span>Mark all read</span>
            </button>
          )}
          {activeTab === 'alerts' && (
            <button onClick={() => { setAlertModalProps({}); setIsAlertModalOpen(true); }} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[var(--primary)] text-white hover:brightness-110 rounded-lg transition-colors shadow-xs">
              <Plus className="w-3.5 h-3.5" /><span>New Alert</span>
            </button>
          )}
          <a
            href="/profile/notifications"
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] rounded-lg transition-colors"
            title="Audio & Sound Settings"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[var(--border-color)] px-4 bg-[var(--bg-surface)] flex-shrink-0">
        {(['notifications', 'alerts'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === tab ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
            <span>{tab === 'notifications' ? 'Activity' : 'Price Alerts'}</span>
            <span className={`px-1.5 rounded-full text-[10px] font-mono ${tab === 'notifications' && unreadCount > 0 ? 'bg-rose-500 text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'}`}>
              {tab === 'notifications' ? (unreadCount > 0 ? unreadCount : notifications.length) : alerts.length}
            </span>
          </button>
        ))}
      </div>

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--border-color)]/60 bg-[var(--bg-surface-elevated)]/40 text-[11px] flex-shrink-0">
            {(['ALL', 'UNREAD'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors ${filter === f ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                {f === 'ALL' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto divide-y divide-[var(--border-color)]/50 p-2">
            {displayed.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
                <Bell className="w-8 h-8 opacity-30" /><span>No notifications to show</span>
              </div>
            ) : displayed.map(n => (
              <div key={n.id} className={`p-3 rounded-xl transition-all flex items-start gap-3 ${!n.is_read ? 'bg-[var(--primary-light)]/40 hover:bg-[var(--primary-light)]/60' : 'hover:bg-[var(--bg-surface-elevated)]'}`}>
                <div className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex-shrink-0 mt-0.5">{getNotifIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-[var(--text-main)] truncate">{n.title}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono whitespace-nowrap flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />{timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5 break-words leading-relaxed">{n.body}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.is_read && (
                    <button onClick={() => markRead(n.id)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-emerald-500 hover:bg-[var(--bg-surface)] transition-colors" title="Mark read">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteNotif(n.id)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-surface)] transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="overflow-y-auto p-2 space-y-2">
          {alerts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
              <Bell className="w-8 h-8 opacity-30" /><span>No active price alerts</span>
              <button onClick={() => { setAlertModalProps({}); setIsAlertModalOpen(true); }} className="mt-2 px-3 py-1.5 bg-[var(--primary)] text-white font-bold rounded-lg text-xs">+ Create First Alert</button>
            </div>
          ) : alerts.map(alert => (
            <div key={alert.id} className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--text-main)] text-sm">{alert.symbol}</span>
                  <span className={`px-1.5 rounded text-[10px] font-bold ${alert.is_triggered ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'}`}>
                    {alert.is_triggered ? 'TRIGGERED' : 'ACTIVE'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-[var(--text-muted)]">
                  {alert.condition === 'GREATER_THAN'
                    ? <span className="flex items-center text-emerald-500 font-bold"><ArrowUpRight className="w-3.5 h-3.5" /> &ge; &#8377;{alert.target_price.toFixed(2)}</span>
                    : <span className="flex items-center text-rose-500 font-bold"><ArrowDownRight className="w-3.5 h-3.5" /> &le; &#8377;{alert.target_price.toFixed(2)}</span>
                  }
                  <span>&bull; {timeAgo(alert.created_at)}</span>
                </div>
              </div>
              <button onClick={() => deleteAlert(alert.id)} className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-surface)] rounded-lg transition-colors" title="Delete Alert">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={bellBtnRef}
        onClick={() => {
          setIsOpen(prev => !prev);
          if (!isOpen) { fetchNotifications(); fetchAlerts(); }
        }}
        className="relative p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors focus:outline-none"
        title="Notifications &amp; Alerts"
        aria-label="Notifications &amp; Alerts"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full animate-pulse border-2 border-[var(--bg-surface)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {panel}

      <CreatePriceAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        token={token}
        initialSymbol={alertModalProps.symbol}
        initialToken={alertModalProps.token}
        currentPrice={alertModalProps.price}
        onAlertCreated={() => { fetchAlerts(); fetchNotifications(); }}
      />
    </>
  );
};
