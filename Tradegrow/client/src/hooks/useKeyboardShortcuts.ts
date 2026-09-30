import { useEffect } from 'react';
import { playAlertChime, sendLocalNotification } from '../utils/notifications';

interface KeyboardShortcutOptions {
  token: string | null;
  onOpenSearch: () => void;
  onQuickBuy?: () => void;
  onQuickSell?: () => void;
  onRefreshWallet?: () => void;
}

export function useKeyboardShortcuts({
  token,
  onOpenSearch,
  onQuickBuy,
  onQuickSell,
  onRefreshWallet,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      // Do not trigger single-letter shortcuts when user is typing in a field
      if (isInput) return;

      // ── Key: '/' -> Open Search ──
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // ── Key: 'b' or 'B' -> Quick Buy ──
      if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        if (onQuickBuy) {
          onQuickBuy();
        } else {
          window.dispatchEvent(new CustomEvent('open-quick-order-shortcut', { detail: { side: 'BUY' } }));
        }
        return;
      }

      // ── Key: 's' or 'S' -> Quick Sell ──
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        if (onQuickSell) {
          onQuickSell();
        } else {
          window.dispatchEvent(new CustomEvent('open-quick-order-shortcut', { detail: { side: 'SELL' } }));
        }
        return;
      }

      // ── Key: Shift + C -> Cancel All Pending Orders ──
      if (e.shiftKey && (e.key === 'C' || e.key === 'c') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!token) return;
        const confirmCancel = window.confirm('Cancel all open and pending orders?');
        if (!confirmCancel) return;

        try {
          const res = await fetch('/api/v1/orders/cancel-all', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (res.ok && data.success) {
            playAlertChime('alert');
            sendLocalNotification('Pending Orders Cancelled', {
              body: `Successfully cancelled ${data.count} pending order(s).`,
              type: 'alert',
            });
            onRefreshWallet?.();
          }
        } catch (_) {}
        return;
      }

      // ── Key: Shift + X -> Panic Square-Off All Positions ──
      if (e.shiftKey && (e.key === 'X' || e.key === 'x') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!token) return;
        const confirmSquareOff = window.confirm(
          '🚨 EMERGENCY PANIC SQUARE-OFF: Close ALL active positions at MARKET price and cancel pending orders?'
        );
        if (!confirmSquareOff) return;

        try {
          const res = await fetch('/api/v1/portfolio/panic-square-off', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (res.ok && data.success) {
            playAlertChime('fill');
            sendLocalNotification('Panic Square-Off Complete', {
              body: `Closed ${data.count} position(s) at market price.`,
              type: 'fill',
            });
            onRefreshWallet?.();
          }
        } catch (_) {}
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [token, onOpenSearch, onQuickBuy, onQuickSell, onRefreshWallet]);
}
