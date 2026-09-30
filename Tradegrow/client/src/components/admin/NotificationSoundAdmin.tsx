import React, { useState, useEffect } from 'react';
import {
  Volume2, VolumeX, Sliders, Music, Shield, Play, Save,
  RotateCcw, Sparkles, Check, AlertCircle, FileAudio, Upload,
  Bell, CheckCircle2, MessageSquare, ExternalLink, HelpCircle
} from 'lucide-react';
import { soundManager, SoundEvent, SoundPack, SoundPriority, SoundCategory } from '../../utils/soundManager';
import { useToast } from '../../context/ToastContext';

interface AdminSoundConfig {
  globalMasterEnabled: boolean;
  defaultVolume: number;
  defaultSoundPack: SoundPack;
  allowUserOverrides: boolean;
  eventConfigs: Record<
    SoundEvent,
    {
      enabled: boolean;
      priority: SoundPriority;
      customUrl?: string;
    }
  >;
  templates: {
    orderFilled: string;
    orderRejected: string;
    priceAlert: string;
    stopLoss: string;
    depositApproved: string;
    kycCompleted: string;
  };
}

const DEFAULT_ADMIN_CONFIG: AdminSoundConfig = {
  globalMasterEnabled: true,
  defaultVolume: 0.7,
  defaultSoundPack: 'premium',
  allowUserOverrides: true,
  eventConfigs: {
    order_placed: { enabled: true, priority: 2 },
    order_executed: { enabled: true, priority: 3 },
    order_rejected: { enabled: true, priority: 4 },
    price_alert: { enabled: true, priority: 3 },
    target_achieved: { enabled: true, priority: 3 },
    stop_loss: { enabled: true, priority: 4 },
    notification: { enabled: true, priority: 2 },
    payment_success: { enabled: true, priority: 3 },
    payment_failed: { enabled: true, priority: 4 },
    kyc_completed: { enabled: true, priority: 3 },
    login_success: { enabled: true, priority: 2 },
    security_alert: { enabled: true, priority: 4 },
    ui_click: { enabled: true, priority: 1 },
  },
  templates: {
    orderFilled: 'Order Executed: {side} {qty} {symbol} @ ₹{price}',
    orderRejected: 'Order Rejected: {side} {symbol} - {reason}',
    priceAlert: 'Price Alert: {symbol} hit ₹{price} (target: ₹{target})',
    stopLoss: 'Risk Warning: Stop loss executed for {symbol} @ ₹{price}',
    depositApproved: 'Funds Credited: ₹{amount} added to your trading wallet',
    kycCompleted: 'KYC Document Verification Successful - Full F&O trading activated',
  },
};

const ADMIN_STORAGE_KEY = 'tradegrow_admin_sound_config_v1';

export const NotificationSoundAdmin: React.FC<{ token: string }> = ({ token }) => {
  const toast = useToast();
  const [config, setConfig] = useState<AdminSoundConfig>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) return { ...DEFAULT_ADMIN_CONFIG, ...JSON.parse(saved) };
    } catch (_) {}
    return DEFAULT_ADMIN_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<'sounds' | 'templates'>('sounds');
  const [playingEvent, setPlayingEvent] = useState<SoundEvent | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const metadata = soundManager.getAllMetadata();

  const handleSave = () => {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(config));
      // Apply defaults to soundManager if needed
      soundManager.setSoundPack(config.defaultSoundPack);
      setSaveStatus('Configuration saved successfully!');
      toast.success('Admin Sound Policies Updated', 'Changes applied across platform audio defaults.');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (_) {
      toast.error('Save Failed', 'Could not persist admin configuration.');
    }
  };

  const handleTest = (event: SoundEvent) => {
    setPlayingEvent(event);
    soundManager.playSound(event, true);
    setTimeout(() => {
      setPlayingEvent((c) => (c === event ? null : c));
    }, 600);
  };

  const handleFileUpload = (event: SoundEvent, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setConfig((prev) => ({
        ...prev,
        eventConfigs: {
          ...prev.eventConfigs,
          [event]: {
            ...prev.eventConfigs[event],
            customUrl: dataUrl,
          },
        },
      }));
      toast.success(`Custom Audio Attached`, `Attached ${file.name} for ${metadata[event].label}.`);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomAudio = (event: SoundEvent) => {
    setConfig((prev) => ({
      ...prev,
      eventConfigs: {
        ...prev.eventConfigs,
        [event]: {
          ...prev.eventConfigs[event],
          customUrl: undefined,
        },
      },
    }));
    toast.info('Audio Reset', `Reverted ${metadata[event].label} to procedural synthesis.`);
  };

  const previewTemplateToast = (type: keyof AdminSoundConfig['templates']) => {
    const t = config.templates[type];
    let sample = t;
    if (type === 'orderFilled') {
      sample = sample.replace('{side}', 'BUY').replace('{qty}', '50').replace('{symbol}', 'RELIANCE').replace('{price}', '2,845.50');
      toast.trade({ status: 'EXECUTED', side: 'BUY', symbol: 'RELIANCE', quantity: 50, price: 2845.50 });
    } else if (type === 'orderRejected') {
      sample = sample.replace('{side}', 'SELL').replace('{symbol}', 'NIFTY24OCT').replace('{reason}', 'Margin limit exceeded');
      toast.trade({ status: 'REJECTED', side: 'SELL', symbol: 'NIFTY24OCT', quantity: 75, reason: 'Margin limit exceeded' });
    } else if (type === 'priceAlert') {
      sample = sample.replace('{symbol}', 'TCS').replace('{price}', '4,150.00').replace('{target}', '4,150.00');
      toast.priceAlert({ symbol: 'TCS', targetPrice: 4150, currentPrice: 4150 });
    } else if (type === 'stopLoss') {
      sample = sample.replace('{symbol}', 'BANKNIFTY').replace('{price}', '51,800.00');
      toast.warning('Stop Loss Triggered', sample, 'stop_loss');
    } else if (type === 'depositApproved') {
      sample = sample.replace('{amount}', '1,00,000');
      toast.success('Deposit Confirmed', sample, 'payment_success');
    } else if (type === 'kycCompleted') {
      toast.success('KYC Approved', sample, 'kyc_completed');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-[var(--text-main)]">
              Notification &amp; Sound Administration
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Platform Master
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Configure system audio policies, synthesis defaults, uploaded sound files, and notification copy.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setConfig(DEFAULT_ADMIN_CONFIG)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[var(--primary)] hover:brightness-110 text-white shadow-md shadow-[var(--primary)]/20 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Policies</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-color)] gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('sounds')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'sounds'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>Sound Cues &amp; Audio Policies</span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Notification Copy &amp; Templates</span>
        </button>
      </div>

      {/* SOUNDS TAB */}
      {activeTab === 'sounds' && (
        <div className="space-y-6">
          {/* Global Defaults Card */}
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold text-[var(--text-main)] uppercase tracking-wider">
              Platform-Wide Audio Defaults
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Global Master Killswitch */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--text-main)]">Global Audio Engine</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Enable audio across platform</div>
                </div>
                <button
                  onClick={() => setConfig((p) => ({ ...p, globalMasterEnabled: !p.globalMasterEnabled }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    config.globalMasterEnabled ? 'bg-[var(--primary)]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      config.globalMasterEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Default Volume */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]/60 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-[var(--text-main)]">Default Volume</span>
                  <span className="font-mono text-[var(--primary)]">{Math.round(config.defaultVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.defaultVolume}
                  onChange={(e) => setConfig((p) => ({ ...p, defaultVolume: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
              </div>

              {/* Default Sound Pack */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]/60 space-y-1.5">
                <div className="text-xs font-bold text-[var(--text-main)]">Default Sound Pack</div>
                <select
                  value={config.defaultSoundPack}
                  onChange={(e) => setConfig((p) => ({ ...p, defaultSoundPack: e.target.value as SoundPack }))}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-main)] font-semibold rounded-lg px-2.5 py-1.5 outline-none"
                >
                  <option value="premium">Premium (Multi-harmonic glass)</option>
                  <option value="minimal">Minimal (Crisp digital blips)</option>
                  <option value="classic">Classic (Terminal chime)</option>
                  <option value="professional">Professional (Warm analog lowpass)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Individual Sound Events Admin Table */}
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                  Event Audio Roster &amp; File Overrides
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Adjust priorities, toggle system events, or upload custom audio cues (MP3/WAV/OGG).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] uppercase tracking-wider font-mono text-[10px]">
                    <th className="py-3 px-4">Event &amp; Category</th>
                    <th className="py-3 px-4">Priority Level</th>
                    <th className="py-3 px-4">Audio Source</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Audition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]/60">
                  {(Object.keys(metadata) as SoundEvent[]).map((evt) => {
                    const meta = metadata[evt];
                    const eventCfg = config.eventConfigs[evt] || { enabled: true, priority: meta.priority };
                    const isPlaying = playingEvent === evt;

                    return (
                      <tr key={evt} className="hover:bg-[var(--bg-surface-elevated)]/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[var(--text-main)]">{meta.label}</div>
                          <div className="text-[11px] text-[var(--text-muted)]">{meta.description}</div>
                          <span className="text-[9.5px] font-mono opacity-50 block mt-0.5">ID: {evt}</span>
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={eventCfg.priority}
                            onChange={(e) => {
                              const p = parseInt(e.target.value, 10) as SoundPriority;
                              setConfig((prev) => ({
                                ...prev,
                                eventConfigs: {
                                  ...prev.eventConfigs,
                                  [evt]: { ...eventCfg, priority: p },
                                },
                              }));
                            }}
                            className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-2 py-1 text-xs text-[var(--text-main)] font-mono outline-none"
                          >
                            <option value={1}>L1 — Silent</option>
                            <option value={2}>L2 — Normal</option>
                            <option value={3}>L3 — Important</option>
                            <option value={4}>L4 — Critical</option>
                          </select>
                        </td>

                        <td className="py-3 px-4">
                          {eventCfg.customUrl ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <FileAudio className="w-3 h-3" /> Custom MP3/WAV
                              </span>
                              <button
                                onClick={() => handleRemoveCustomAudio(evt)}
                                className="text-[10px] text-rose-400 hover:underline"
                              >
                                Revert
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                Procedural Synthesis
                              </span>
                              <label className="cursor-pointer text-[10px] text-[var(--primary)] hover:underline flex items-center gap-1">
                                <Upload className="w-3 h-3" />
                                <span>Upload</span>
                                <input
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) handleFileUpload(evt, e.target.files[0]);
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setConfig((prev) => ({
                                ...prev,
                                eventConfigs: {
                                  ...prev.eventConfigs,
                                  [evt]: { ...eventCfg, enabled: !eventCfg.enabled },
                                },
                              }));
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              eventCfg.enabled
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-700/30 text-slate-400'
                            }`}
                          >
                            {eventCfg.enabled ? 'ACTIVE' : 'MUTED'}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleTest(evt)}
                            className={`p-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all ${
                              isPlaying
                                ? 'bg-[var(--primary)] text-white animate-pulse'
                                : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--primary)] hover:text-white text-[var(--text-main)] border border-[var(--border-color)]'
                            }`}
                            title={`Audition ${meta.label}`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span className="text-[11px]">Test</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATES TAB */}
      {activeTab === 'templates' && (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 space-y-6">
          <div>
            <h3 className="text-sm font-extrabold text-[var(--text-main)] uppercase tracking-wider">
              Notification Copy &amp; Micro-Copy Templates
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Customize the text templates rendered inside toasts and push notifications across the broker.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                key: 'orderFilled' as const,
                label: 'Order Executed Notification',
                vars: '{side}, {qty}, {symbol}, {price}',
              },
              {
                key: 'orderRejected' as const,
                label: 'Order Rejected Notification',
                vars: '{side}, {symbol}, {reason}',
              },
              {
                key: 'priceAlert' as const,
                label: 'Price Alert Trigger Notification',
                vars: '{symbol}, {price}, {target}',
              },
              {
                key: 'stopLoss' as const,
                label: 'Stop-Loss Execution Warning',
                vars: '{symbol}, {price}',
              },
              {
                key: 'depositApproved' as const,
                label: 'Deposit Approval Notification',
                vars: '{amount}',
              },
              {
                key: 'kycCompleted' as const,
                label: 'KYC Verification Notification',
                vars: '(no dynamic variables)',
              },
            ].map((tmpl) => (
              <div key={tmpl.key} className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-main)]">{tmpl.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">Variables: {tmpl.vars}</span>
                    <button
                      onClick={() => previewTemplateToast(tmpl.key)}
                      className="px-2 py-0.5 rounded text-[11px] font-bold text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors flex items-center gap-1"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Preview Toast</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={config.templates[tmpl.key]}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      templates: { ...p.templates, [tmpl.key]: e.target.value },
                    }))
                  }
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] font-mono outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
