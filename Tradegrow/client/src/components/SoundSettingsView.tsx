import React, { useState, useEffect } from 'react';
import {
  Volume2, VolumeX, Volume1, Bell, TrendingUp, ShieldAlert,
  Wallet, ShieldCheck, Play, RotateCcw, Sparkles, Check,
  Sliders, Smartphone, Music, CheckCircle2, AlertTriangle, XCircle, Info
} from 'lucide-react';
import { soundManager, SoundEvent, SoundPack, SoundSettings, SoundPriority } from '../utils/soundManager';
import { useToast } from '../context/ToastContext';

export const SoundSettingsView: React.FC = () => {
  const toast = useToast();
  const [settings, setSettings] = useState<SoundSettings>(soundManager.getSettings());
  const [playingEvent, setPlayingEvent] = useState<SoundEvent | null>(null);

  useEffect(() => {
    return soundManager.subscribe((newSettings) => {
      setSettings(newSettings);
    });
  }, []);

  const handleToggleMaster = () => {
    const next = !settings.masterEnabled;
    soundManager.setMasterEnabled(next);
    if (next) {
      soundManager.playSound('order_placed', true);
      toast.success('Sound Effects Enabled', 'Audio feedback is now active across the platform.');
    } else {
      toast.info('Sound Effects Muted', 'Platform audio is now muted.');
    }
  };

  const handleToggleCategory = (cat: keyof SoundSettings['categories']) => {
    soundManager.setCategoryEnabled(cat, !settings.categories[cat]);
    if (!settings.categories[cat]) {
      soundManager.playSound('ui_click', true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    soundManager.setVolume(val);
  };

  const handleSoundPackChange = (pack: SoundPack) => {
    soundManager.setSoundPack(pack);
    soundManager.playSound('order_executed', true);
    toast.success(`Sound Pack Selected: ${pack.toUpperCase()}`, `Now previewing with ${pack} sound synthesis.`);
  };

  const handleToggleHaptics = () => {
    const next = !settings.hapticsEnabled;
    soundManager.setHapticsEnabled(next);
    if (next) {
      soundManager.playSound('ui_click', true);
    }
  };

  const handleTestSound = (event: SoundEvent) => {
    setPlayingEvent(event);
    soundManager.playSound(event, true);
    setTimeout(() => {
      setPlayingEvent((curr) => (curr === event ? null : curr));
    }, 600);
  };

  const handleResetDefaults = () => {
    soundManager.resetToDefaults();
    soundManager.playSound('order_placed', true);
    toast.info('Sound Settings Reset', 'Audio configurations restored to factory defaults.');
  };

  const allMetadata = soundManager.getAllMetadata();

  const SOUND_GROUPS: {
    title: string;
    description: string;
    events: SoundEvent[];
  }[] = [
    {
      title: '📈 Trading Terminal Audio',
      description: 'Ultra-fast audio feedback for order placement, fills, and rejections',
      events: ['order_placed', 'order_executed', 'order_rejected'],
    },
    {
      title: '🎯 Market Price Alerts & Stops',
      description: 'Audio cues for target prices, stop losses, and condition triggers',
      events: ['price_alert', 'target_achieved', 'stop_loss'],
    },
    {
      title: '💼 Portfolio, Funds & Subscriptions',
      description: 'Confirmations for fund deposits, withdrawals, and ledger events',
      events: ['payment_success', 'payment_failed'],
    },
    {
      title: '🔐 Security, Auth & Identity',
      description: 'Audible cues for login, KYC verification, and risk warnings',
      events: ['login_success', 'kyc_completed', 'security_alert'],
    },
    {
      title: '🔔 Platform & System',
      description: 'General system announcements, broadcast updates, and micro-taps',
      events: ['notification', 'ui_click'],
    },
  ];

  const getPriorityBadge = (priority: SoundPriority) => {
    switch (priority) {
      case 1:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-500/10 text-slate-400">Silent (L1)</span>;
      case 2:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">Normal (L2)</span>;
      case 3:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Important (L3)</span>;
      case 4:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">Critical (L4)</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--bg-surface-elevated)] via-[var(--bg-surface)] to-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Studio-Grade Procedural Audio</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] tracking-tight">
              Notifications &amp; Sound Engine
            </h2>
            <p className="text-xs md:text-sm text-[var(--text-muted)] max-w-xl leading-relaxed">
              Tailored acoustic feedback designed for high-frequency trading terminals. Subtle, satisfying, and non-distracting.
            </p>
          </div>

          {/* Master Toggle Button */}
          <button
            onClick={handleToggleMaster}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 shadow-md ${
              settings.masterEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {settings.masterEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            <div className="text-left">
              <div className="text-[11px] opacity-80 uppercase tracking-wider font-mono">Master Audio</div>
              <div className="text-sm font-extrabold">{settings.masterEnabled ? 'Sound ON' : 'Muted'}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Primary Controls Grid: Volume & Sound Pack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Volume Card */}
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
              <Sliders className="w-4 h-4 text-[var(--primary)]" />
              <span>Master Sound Volume</span>
            </div>
            <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--primary)]">
              {Math.round(settings.volume * 100)}%
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={handleVolumeChange}
              disabled={!settings.masterEnabled}
              className="w-full h-2 bg-[var(--bg-surface-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)] disabled:opacity-40"
            />
            <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)]">
              <span>Low (0%)</span>
              <span>Balanced (50%)</span>
              <span>High (100%)</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => handleTestSound('order_executed')}
              disabled={!settings.masterEnabled}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--bg-surface-elevated)] hover:bg-[var(--primary)]/10 text-[var(--text-main)] hover:text-[var(--primary)] border border-[var(--border-color)] transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Test Audio Level</span>
            </button>

            {/* Mobile Haptic Toggle */}
            <button
              onClick={handleToggleHaptics}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                settings.hapticsEnabled
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)]'
              }`}
              title="Vibration on supported mobile browsers"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Haptics: {settings.hapticsEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Sound Pack Selector Card */}
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
              <Music className="w-4 h-4 text-[var(--primary)]" />
              <span>Sonic Character / Sound Pack</span>
            </div>
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Preset
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: 'premium', label: 'Premium (Default)', desc: 'Glass harmonics & smooth resonance' },
              { id: 'minimal', label: 'Minimal', desc: 'Ultra-crisp short pure tones' },
              { id: 'classic', label: 'Classic', desc: 'Familiar chime intervals' },
              { id: 'professional', label: 'Professional', desc: 'Warm low-pass executive tones' },
            ].map((p) => {
              const active = settings.soundPack === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSoundPackChange(p.id as SoundPack)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    active
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--text-main)] shadow-sm'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)]/40 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)]/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{p.label}</span>
                    {active && <Check className="w-3.5 h-3.5 text-[var(--primary)]" />}
                  </div>
                  <p className="text-[10px] leading-tight opacity-75">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Smart Notification Priority Guide Banner */}
      <div className="rounded-2xl bg-[var(--bg-surface-elevated)]/60 border border-[var(--border-color)] p-5">
        <h4 className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-400" />
          <span>Smart Queue &amp; Priority Debouncing</span>
        </h4>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
          To prevent audio fatigue, TradeGrow automatically suppresses low-priority sounds when multiple alerts arrive within 1.2 seconds:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
            <span className="font-bold text-slate-400 block mb-0.5">Level 1 — Silent</span>
            <span className="text-[11px] text-[var(--text-muted)]">Background sync &amp; tick polls</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
            <span className="font-bold text-sky-400 block mb-0.5">Level 2 — Normal</span>
            <span className="text-[11px] text-[var(--text-muted)]">Order placed, watchlist chime</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
            <span className="font-bold text-emerald-400 block mb-0.5">Level 3 — Important</span>
            <span className="text-[11px] text-[var(--text-muted)]">Order fill, target hit, deposits</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
            <span className="font-bold text-rose-400 block mb-0.5">Level 4 — Critical</span>
            <span className="text-[11px] text-[var(--text-muted)]">Stop-loss hit, security warning</span>
          </div>
        </div>
      </div>

      {/* Category Toggle Switches */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-[var(--text-main)] uppercase tracking-wider">
          Individual Notification Categories
        </h3>
        <div className="divide-y divide-[var(--border-color)]">
          {[
            {
              key: 'trading' as const,
              title: '📈 Trading Sounds',
              desc: 'Audio feedback for order submission, fills, partial executions, and cancellations',
              icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
            },
            {
              key: 'priceAlerts' as const,
              title: '🎯 Price Alerts & Targets',
              desc: 'Chimes when market prices reach configured triggers or stop loss levels',
              icon: <Bell className="w-5 h-5 text-amber-400" />,
            },
            {
              key: 'portfolio' as const,
              title: '💼 Portfolio & Fund Notifications',
              desc: 'Subtle sound when wallet deposits, withdrawals, or margin alerts occur',
              icon: <Wallet className="w-5 h-5 text-sky-400" />,
            },
            {
              key: 'security' as const,
              title: '🔐 Security & Authentication',
              desc: 'Sound on login, password modification, device authorization, and KYC updates',
              icon: <ShieldAlert className="w-5 h-5 text-purple-400" />,
            },
            {
              key: 'notifications' as const,
              title: '🔔 Platform & System Updates',
              desc: 'Broadcast notifications from administrators and scheduled announcements',
              icon: <Sparkles className="w-5 h-5 text-teal-400" />,
            },
          ].map((item) => {
            const isEnabled = settings.categories[item.key];
            return (
              <div key={item.key} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]/60">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-xs md:text-sm font-bold text-[var(--text-main)]">{item.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{item.desc}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleCategory(item.key)}
                  disabled={!settings.masterEnabled}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
                    isEnabled && settings.masterEnabled ? 'bg-[var(--primary)]' : 'bg-slate-700/40'
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isEnabled && settings.masterEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sound Audition Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[var(--text-main)] uppercase tracking-wider">
              Interactive Sound Audition
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Click ▶ Test to audition the synthesized waveform in real-time.
            </p>
          </div>
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="space-y-6">
          {SOUND_GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 space-y-3">
              <div className="border-b border-[var(--border-color)]/60 pb-2">
                <h4 className="text-xs font-black text-[var(--text-main)]">{group.title}</h4>
                <p className="text-[11px] text-[var(--text-muted)]">{group.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.events.map((evt) => {
                  const meta = allMetadata[evt];
                  const isPlaying = playingEvent === evt;
                  return (
                    <div
                      key={evt}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isPlaying
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10 shadow-md ring-1 ring-[var(--primary)]/40 scale-[1.01]'
                          : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)]/30 hover:bg-[var(--bg-surface-elevated)]/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-main)] truncate">
                            {meta.label}
                          </span>
                          {getPriorityBadge(meta.priority)}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                          {meta.description}
                        </p>
                        <span className="text-[9.5px] font-mono text-[var(--text-muted)] mt-1 block">
                          ~{meta.durationMs}ms
                        </span>
                      </div>

                      <button
                        onClick={() => handleTestSound(evt)}
                        className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                          isPlaying
                            ? 'bg-[var(--primary)] text-white animate-pulse'
                            : 'bg-[var(--bg-surface)] hover:bg-[var(--primary)] hover:text-white text-[var(--text-main)] border border-[var(--border-color)]'
                        }`}
                        title={`Preview ${meta.label}`}
                      >
                        <Play className={`w-3.5 h-3.5 fill-current ${isPlaying ? 'scale-110' : ''}`} />
                        <span className="text-[11px]">Test</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
