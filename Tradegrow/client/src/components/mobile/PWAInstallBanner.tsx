import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, Sparkles, Bell, CheckCircle2, MoreVertical, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { requestNotificationPermission } from '../../utils/notifications';

export function PWAInstallBanner() {
  const { canInstall, isInstalled, isIOS, isAndroid, isMobile, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState<boolean>(true);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [notificationStatus, setNotificationStatus] = useState<string>('default');

  useEffect(() => {
    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
    }

    // Check dismissed status
    try {
      const dismissedAt = localStorage.getItem('tradegrow_pwa_banner_dismissed');
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        // Reshow after 3 days on mobile if user hasn't installed
        if (timeDiff < 3 * 24 * 60 * 60 * 1000) {
          setIsDismissed(true);
          return;
        }
      }
      // Proactively show on mobile or when installable
      setIsDismissed(false);
    } catch (_) {
      setIsDismissed(false);
    }

    // Listen for custom trigger to open install modal from anywhere in the app
    const handleOpenModal = () => {
      setShowGuideModal(true);
    };
    window.addEventListener('open-pwa-install-modal', handleOpenModal);

    return () => {
      window.removeEventListener('open-pwa-install-modal', handleOpenModal);
    };
  }, []);

  // Do not show banner if already running as standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('tradegrow_pwa_banner_dismissed', Date.now().toString());
    } catch (_) {}
  };

  const handlePrimaryAction = async () => {
    if (canInstall) {
      const success = await promptInstall();
      if (!success && !isIOS) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationStatus(perm);
  };

  return (
    <>
      {/* Floating Installation Banner (Mobile & Desktop) */}
      {!isDismissed && (
        <div className="fixed bottom-20 md:bottom-6 right-3 left-3 md:left-auto md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="relative overflow-hidden rounded-2xl bg-[#131722]/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl shadow-emerald-950/50 p-3.5 flex items-center justify-between gap-3 text-left">
            
            {/* Ambient Glow */}
            <div className="absolute -left-10 -top-10 w-28 h-28 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* App Icon */}
            <div className="relative flex-shrink-0">
              <img 
                src="/icon-192x192.png" 
                alt="TradeGrow Logo" 
                className="w-11 h-11 rounded-xl shadow-lg border border-emerald-500/30 object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center justify-center shadow">
                <Sparkles className="w-2.5 h-2.5" />
              </div>
            </div>

            {/* Text Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-tight truncate">
                  Install TradeGrow App
                </span>
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {canInstall ? '1-Tap' : 'Shortcut'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {isIOS 
                  ? 'Add to iPhone Home Screen' 
                  : (canInstall ? 'Instant 1-tap install for full-screen' : 'Add home screen shortcut & live ticks')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {canInstall ? (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Install</span>
                  </>
                ) : isIOS ? (
                  <>
                    <Share className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Shortcut</span>
                  </>
                )}
              </button>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss installation prompt"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Install & Home Screen Guide Modal */}
      {showGuideModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowGuideModal(false)}
        >
          <div 
            className="w-full max-w-sm rounded-3xl bg-[#131722] border border-emerald-500/30 p-5 shadow-2xl relative text-left text-white"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <img 
                  src="/apple-touch-icon.png" 
                  alt="TradeGrow" 
                  className="w-9 h-9 rounded-xl shadow border border-emerald-500/40"
                />
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Install TradeGrow App
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">PWA</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">Zero lag • Full-screen • Instant ticks</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)} 
                className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If 1-Tap Direct Install is available on Android/Chrome */}
            {canInstall && (
              <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> 1-Tap Quick Install Available
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  Click below to install TradeGrow directly onto your home screen like a native app.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await promptInstall();
                    setShowGuideModal(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App Now</span>
                </button>
              </div>
            )}

            {/* iOS Safari Guided Steps */}
            {isIOS && (
              <div className="mt-4 space-y-2.5">
                <div className="text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                  <span>How to add to iPhone Home Screen:</span>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                    1
                  </div>
                  <div className="text-xs text-slate-200">
                    Tap the <strong className="text-emerald-400 font-semibold inline-flex items-center gap-1">Share <Share className="w-3.5 h-3.5 inline text-blue-400" /></strong> button in Safari toolbar.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                    2
                  </div>
                  <div className="text-xs text-slate-200">
                    Scroll down and select <strong className="text-emerald-400 font-semibold inline-flex items-center gap-1">Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400" /></strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                    3
                  </div>
                  <div className="text-xs text-slate-200">
                    Tap <strong className="text-emerald-400 font-semibold">Add</strong> in the top-right corner to finish.
                  </div>
                </div>
              </div>
            )}

            {/* Android / Browser Menu Guided Steps (when canInstall is false or other mobile browsers) */}
            {!isIOS && !canInstall && (
              <div className="mt-4 space-y-2.5">
                <div className="text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                  <span>How to create Home Screen Shortcut:</span>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                    1
                  </div>
                  <div className="text-xs text-slate-200">
                    Tap the browser menu <strong className="text-emerald-400 font-semibold inline-flex items-center gap-1"><MoreVertical className="w-3.5 h-3.5 inline" /> (3 dots)</strong> at the top or bottom right.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                    2
                  </div>
                  <div className="text-xs text-slate-200">
                    Select <strong className="text-emerald-400 font-semibold">"Install App"</strong> or <strong className="text-emerald-400 font-semibold">"Add to Home screen"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                    3
                  </div>
                  <div className="text-xs text-slate-200">
                    Tap <strong className="text-emerald-400 font-semibold">Add / Install</strong> to confirm.
                  </div>
                </div>
              </div>
            )}

            {/* Optional Push Notification Permission */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">Instant Trade Alerts</span>
                </div>
                {notificationStatus === 'granted' ? (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Enabled
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold border border-slate-700 transition-colors"
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Close / Got it */}
            <button
              type="button"
              onClick={() => {
                setShowGuideModal(false);
                handleDismiss();
              }}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
