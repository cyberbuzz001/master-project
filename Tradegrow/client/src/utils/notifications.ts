/**
 * TradeGrow Web Push & Notification Helper
 * Provides native push notifications, permission requesting, and in-browser notification dispatch.
 * Integrated with TradeGrow SoundManager.
 */

import { soundManager, SoundEvent } from './soundManager';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('[PWA] Service Worker registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (_) {
    return 'denied';
  }
}

/**
 * Backward-compatible chime player mapped directly to our studio-grade SoundManager.
 */
export function playAlertChime(type: 'fill' | 'alert' | 'error' | SoundEvent = 'fill') {
  try {
    let soundEvent: SoundEvent = 'notification';
    if (type === 'fill') soundEvent = 'order_executed';
    else if (type === 'alert') soundEvent = 'price_alert';
    else if (type === 'error') soundEvent = 'order_rejected';
    else soundEvent = type as SoundEvent;

    soundManager.playSound(soundEvent);
  } catch (_) {
    // Web audio guarded
  }
}

export function sendLocalNotification(title: string, options?: {
  body?: string;
  icon?: string;
  tag?: string;
  url?: string;
  type?: 'fill' | 'alert' | 'error';
  soundEvent?: SoundEvent;
}) {
  if (typeof window === 'undefined') return;

  // Play audio chime via SoundManager
  if (options?.soundEvent) {
    soundManager.playSound(options.soundEvent);
  } else {
    playAlertChime(options?.type || 'fill');
  }

  // System notification if permission granted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body: options?.body,
        icon: options?.icon || '/favicon.svg',
        tag: options?.tag,
      });

      if (options?.url) {
        notif.onclick = () => {
          window.focus();
          window.location.href = options.url!;
          notif.close();
        };
      }
    } catch (_) {
      // Fallback or permission blocked
    }
  }
}
