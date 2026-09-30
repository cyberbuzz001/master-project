/**
 * TradeGrow Premium Sound & Notification Audio Engine
 * 
 * Centralized, studio-grade procedural Web Audio API synthesis engine.
 * Delivers zero-latency, zero-dependency, ultra-crisp audio cues tailored
 * specifically for high-end fintech & trading terminals.
 * 
 * Fully compliant with Web Audio standards, autoplay policy unlocking,
 * smart priority debouncing, sound packs, volume control, and category filtering.
 */

export type SoundEvent =
  | 'order_placed'
  | 'order_executed'
  | 'order_rejected'
  | 'price_alert'
  | 'target_achieved'
  | 'stop_loss'
  | 'notification'
  | 'payment_success'
  | 'payment_failed'
  | 'kyc_completed'
  | 'login_success'
  | 'security_alert'
  | 'ui_click';

export type SoundPriority = 1 | 2 | 3 | 4; // 1: Silent, 2: Normal, 3: Important, 4: Critical

export type SoundPack = 'premium' | 'minimal' | 'classic' | 'professional';

export type SoundCategory = 'trading' | 'notifications' | 'priceAlerts' | 'portfolio' | 'security';

export interface SoundSettings {
  masterEnabled: boolean;
  volume: number; // 0.0 - 1.0
  soundPack: SoundPack;
  hapticsEnabled: boolean;
  categories: {
    trading: boolean;       // Orders (placed, executed, rejected, modified, canceled)
    notifications: boolean; // Platform announcements, system notifications
    priceAlerts: boolean;   // Price thresholds, target hit, stop loss
    portfolio: boolean;     // Margin calls, square-offs, portfolio milestones
    security: boolean;      // Logins, password changes, KYC, device alerts
  };
  customUrls?: Partial<Record<SoundEvent, string>>;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterEnabled: true,
  volume: 0.7,
  soundPack: 'premium',
  hapticsEnabled: true,
  categories: {
    trading: true,
    notifications: true,
    priceAlerts: true,
    portfolio: true,
    security: true,
  },
};

const SOUND_EVENT_METADATA: Record<
  SoundEvent,
  {
    category: SoundCategory;
    priority: SoundPriority;
    label: string;
    description: string;
    durationMs: number;
  }
> = {
  order_placed: {
    category: 'trading',
    priority: 2,
    label: 'Order Placed',
    description: 'Subtle 2-step ascending tone confirming order submission',
    durationMs: 320,
  },
  order_executed: {
    category: 'trading',
    priority: 3,
    label: 'Order Executed',
    description: 'Satisfying harmonic chime for confirmed trade fills',
    durationMs: 500,
  },
  order_rejected: {
    category: 'trading',
    priority: 4,
    label: 'Order Rejected',
    description: 'Soft descending tone indicating validation or risk rejection',
    durationMs: 380,
  },
  price_alert: {
    category: 'priceAlerts',
    priority: 3,
    label: 'Price Alert',
    description: 'Crystal chime triggered when market reaches alert threshold',
    durationMs: 650,
  },
  target_achieved: {
    category: 'priceAlerts',
    priority: 3,
    label: 'Target Achieved',
    description: 'Positive double-chime for reached profit targets',
    durationMs: 550,
  },
  stop_loss: {
    category: 'priceAlerts',
    priority: 4,
    label: 'Stop Loss Triggered',
    description: 'Polite yet distinct warning tone for risk protection',
    durationMs: 480,
  },
  notification: {
    category: 'notifications',
    priority: 2,
    label: 'General Notification',
    description: 'Clean single tone for regular platform updates',
    durationMs: 280,
  },
  payment_success: {
    category: 'portfolio',
    priority: 3,
    label: 'Payment Successful',
    description: 'Elegant harmonic flourish for completed deposits/withdrawals',
    durationMs: 600,
  },
  payment_failed: {
    category: 'portfolio',
    priority: 4,
    label: 'Payment Failed',
    description: 'Soft warm low error tone for failed fund operations',
    durationMs: 420,
  },
  kyc_completed: {
    category: 'security',
    priority: 3,
    label: 'KYC Verified',
    description: 'Reassuring professional confirmation cue',
    durationMs: 420,
  },
  login_success: {
    category: 'security',
    priority: 2,
    label: 'Login Success',
    description: 'Fast subtle digital blip on authentication',
    durationMs: 180,
  },
  security_alert: {
    category: 'security',
    priority: 4,
    label: 'Security Alert',
    description: 'Authoritative two-tone warning for high-risk security actions',
    durationMs: 520,
  },
  ui_click: {
    category: 'trading',
    priority: 1,
    label: 'UI Tap',
    description: 'Micro tactile click for rapid button engagement',
    durationMs: 35,
  },
};

const STORAGE_KEY = 'tradegrow_sound_settings_v1';

class SoundManager {
  private static instance: SoundManager;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private settings: SoundSettings;
  private isUnlocked: boolean = false;
  private lastPlayedTime: number = 0;
  private lastPlayedPriority: SoundPriority = 1;
  private lastPlayedEvent: SoundEvent | null = null;
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private subscribers: Set<(settings: SoundSettings) => void> = new Set();

  private constructor() {
    this.settings = this.loadSettings();
    if (typeof window !== 'undefined') {
      this.bindUnlockListeners();
    }
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private loadSettings(): SoundSettings {
    if (typeof window === 'undefined') return DEFAULT_SOUND_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SOUND_SETTINGS,
          ...parsed,
          categories: {
            ...DEFAULT_SOUND_SETTINGS.categories,
            ...(parsed.categories || {}),
          },
        };
      }
    } catch (_) {}
    return DEFAULT_SOUND_SETTINGS;
  }

  private persistSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.subscribers.forEach((cb) => cb({ ...this.settings }));
    } catch (_) {}
  }

  public subscribe(cb: (settings: SoundSettings) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  public getSettings(): SoundSettings {
    return { ...this.settings };
  }

  public getMetadata(event: SoundEvent) {
    return SOUND_EVENT_METADATA[event];
  }

  public getAllMetadata() {
    return SOUND_EVENT_METADATA;
  }

  public setMasterEnabled(enabled: boolean): void {
    this.settings.masterEnabled = enabled;
    this.persistSettings();
  }

  public setCategoryEnabled(cat: SoundCategory, enabled: boolean): void {
    this.settings.categories[cat] = enabled;
    this.persistSettings();
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.settings.volume = clamped;
    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
      } catch (_) {}
    }
    this.persistSettings();
  }

  public setSoundPack(pack: SoundPack): void {
    this.settings.soundPack = pack;
    this.persistSettings();
  }

  public setHapticsEnabled(enabled: boolean): void {
    this.settings.hapticsEnabled = enabled;
    this.persistSettings();
  }

  public resetToDefaults(): void {
    this.settings = { ...DEFAULT_SOUND_SETTINGS };
    this.persistSettings();
    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.setValueAtTime(this.settings.volume, this.audioCtx.currentTime);
      } catch (_) {}
    }
  }

  /**
   * Unlock AudioContext safely upon first user interaction to comply with browser autoplay policies.
   */
  private bindUnlockListeners(): void {
    const unlock = () => {
      this.ensureAudioContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().then(() => {
          this.isUnlocked = true;
        }).catch(() => {});
      } else {
        this.isUnlocked = true;
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.settings.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
    return this.audioCtx;
  }

  /**
   * Trigger haptic feedback if enabled and supported on mobile.
   */
  private triggerHaptic(event: SoundEvent): void {
    if (!this.settings.hapticsEnabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
      return;
    }
    try {
      switch (event) {
        case 'order_executed':
        case 'target_achieved':
        case 'payment_success':
          navigator.vibrate([30, 40, 50]);
          break;
        case 'order_rejected':
        case 'stop_loss':
        case 'security_alert':
        case 'payment_failed':
          navigator.vibrate([60, 40, 80]);
          break;
        case 'order_placed':
        case 'price_alert':
        case 'notification':
        case 'kyc_completed':
          navigator.vibrate(35);
          break;
        case 'ui_click':
          navigator.vibrate(12);
          break;
      }
    } catch (_) {}
  }

  /**
   * Main entry point to play sound cues with smart priority debouncing.
   */
  public playSound(event: SoundEvent, force: boolean = false): void {
    if (typeof window === 'undefined') return;

    const meta = SOUND_EVENT_METADATA[event];
    if (!meta) return;

    // Trigger subtle haptics
    this.triggerHaptic(event);

    // If master is disabled and not forced preview
    if (!force && !this.settings.masterEnabled) return;

    // Check individual category setting
    if (!force && !this.settings.categories[meta.category]) return;

    const now = performance.now();
    const timeSinceLast = now - this.lastPlayedTime;

    // Smart priority debouncing:
    // If sounds trigger within 1.2s, play only if new priority is >= previous priority
    // Debounce exact duplicates within 600ms
    if (!force && timeSinceLast < 1200) {
      if (this.lastPlayedEvent === event && timeSinceLast < 600) {
        return; // drop duplicate rapid sound
      }
      if (meta.priority < this.lastPlayedPriority) {
        return; // drop lower priority sound in favor of higher ongoing sound
      }
    }

    this.lastPlayedTime = now;
    this.lastPlayedPriority = meta.priority;
    this.lastPlayedEvent = event;

    // 1. Check for custom audio file override
    const customUrl = this.settings.customUrls?.[event];
    if (customUrl) {
      this.playAudioFile(customUrl);
      return;
    }

    // 2. Synthesize using Web Audio API
    this.synthesizeSound(event, this.settings.soundPack);
  }

  /**
   * Fallback / custom audio file player
   */
  private playAudioFile(url: string): void {
    try {
      let audio = this.audioCache.get(url);
      if (!audio) {
        audio = new Audio(url);
        this.audioCache.set(url, audio);
      }
      audio.volume = this.settings.volume;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (_) {}
  }

  /**
   * Studio-grade procedural sound synthesizer.
   * Generates tailored tones based on chosen SoundPack (Premium, Minimal, Classic, Professional).
   */
  private synthesizeSound(event: SoundEvent, pack: SoundPack): void {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;
    const dest = this.masterGain || ctx.destination;

    // Pack modifier coefficients
    // Premium: multi-harmonic, rich glass chime
    // Minimal: pure sine, shorter duration
    // Classic: bell-like overtone
    // Professional: warm low-pass filtered analog tone
    const packIsMinimal = pack === 'minimal';
    const packIsClassic = pack === 'classic';
    const packIsProfessional = pack === 'professional';

    switch (event) {
      case 'order_placed': {
        // 2-step ascending tonal cue (~300ms, subtle fintech blip)
        // C5 (523.25Hz) -> E5 (659.25Hz)
        const dur = packIsMinimal ? 0.22 : 0.32;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = packIsProfessional ? 'triangle' : 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(packIsProfessional ? 1800 : 3200, t);

        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.12);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }

      case 'order_executed': {
        // Satisfying harmonic chime with pristine glass decay (~450-550ms)
        // Root: E5 (659.25Hz) + Octave / Third shimmer: C6 (1046.50Hz) & E6 (1318.51Hz)
        const dur = packIsMinimal ? 0.35 : 0.52;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = packIsProfessional ? 'triangle' : 'sine';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(659.25, t);
        osc1.frequency.exponentialRampToValueAtTime(1046.50, t + 0.06);

        osc2.frequency.setValueAtTime(1318.51, t + 0.06);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(packIsProfessional ? 2400 : 4500, t);

        gain1.gain.setValueAtTime(0.001, t);
        gain1.gain.linearRampToValueAtTime(0.22, t + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        gain2.gain.setValueAtTime(0.0001, t);
        gain2.gain.setValueAtTime(0.001, t + 0.06);
        gain2.gain.linearRampToValueAtTime(0.12, t + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc1.connect(filter);
        filter.connect(gain1);
        gain1.connect(dest);

        if (!packIsMinimal) {
          osc2.connect(gain2);
          gain2.connect(dest);
          osc2.start(t + 0.06);
          osc2.stop(t + dur);
        }

        osc1.start(t);
        osc1.stop(t + dur);
        break;
      }

      case 'order_rejected': {
        // Soft descending tone (~350ms, gentle two-tone fall, no annoying buzzer)
        // B4 (493.88Hz) -> F#4 (369.99Hz) -> D4 (293.66Hz)
        const dur = 0.38;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = packIsClassic ? 'triangle' : 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, t);

        osc.frequency.setValueAtTime(493.88, t);
        osc.frequency.linearRampToValueAtTime(369.99, t + 0.12);
        osc.frequency.exponentialRampToValueAtTime(293.66, t + dur);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }

      case 'price_alert': {
        // Shimmering attention-grabbing harmonic chime (~650ms)
        // A5 (880Hz) -> E6 (1318.51Hz) with soft chorus-like overtone
        const dur = 0.65;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = packIsClassic ? 'triangle' : 'sine';

        osc1.frequency.setValueAtTime(880, t);
        osc1.frequency.exponentialRampToValueAtTime(1318.51, t + 0.08);

        osc2.frequency.setValueAtTime(1324, t + 0.08); // +6Hz subtle chorus detune

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc1.connect(gain);
        if (!packIsMinimal) osc2.connect(gain);
        gain.connect(dest);

        osc1.start(t);
        osc1.stop(t + dur);
        if (!packIsMinimal) {
          osc2.start(t + 0.08);
          osc2.stop(t + dur);
        }
        break;
      }

      case 'target_achieved': {
        // Positive premium double-chime (~550ms)
        // C6 (1046.5Hz) followed at +90ms by G6 (1567.98Hz)
        const dur = 0.55;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(1046.50, t);
        osc2.frequency.setValueAtTime(1567.98, t + 0.09);

        gain1.gain.setValueAtTime(0.001, t);
        gain1.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        gain2.gain.setValueAtTime(0.0001, t);
        gain2.gain.setValueAtTime(0.001, t + 0.09);
        gain2.gain.linearRampToValueAtTime(0.20, t + 0.11);
        gain2.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc1.connect(gain1);
        gain1.connect(dest);
        osc2.connect(gain2);
        gain2.connect(dest);

        osc1.start(t);
        osc1.stop(t + dur);
        osc2.start(t + 0.09);
        osc2.stop(t + dur);
        break;
      }

      case 'stop_loss': {
        // Professional warning tone (~480ms), 2 gentle pulses, alert without panic
        // A4 (440Hz) -> G4 (392Hz)
        const dur = 0.48;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t);

        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(392, t + 0.16);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.20, t + 0.02);
        gain.gain.setValueAtTime(0.05, t + 0.15);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }

      case 'notification': {
        // Minimal single premium chime (~260ms)
        // Clean A5 (880Hz) ping
        const dur = packIsMinimal ? 0.18 : 0.26;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }

      case 'payment_success': {
        // Ascending major triad flourish (~600ms)
        // F5 (698.46Hz) -> A5 (880Hz) -> C6 (1046.5Hz)
        const dur = 0.60;
        const notes = [698.46, 880.00, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = t + idx * 0.08;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

          osc.connect(gain);
          gain.connect(dest);

          osc.start(start);
          osc.stop(t + dur);
        });
        break;
      }

      case 'payment_failed': {
        // Soft warm minor descent (~420ms)
        // E4 (329.63Hz) -> D#4 (311.13Hz)
        const dur = 0.42;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, t);

        osc.frequency.setValueAtTime(329.63, t);
        osc.frequency.exponentialRampToValueAtTime(311.13, t + 0.15);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }

      case 'kyc_completed': {
        // Reassuring confirmation chime (~400ms)
        // D5 (587.33Hz) -> A5 (880Hz)
        const dur = 0.42;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, t);
        osc.frequency.exponentialRampToValueAtTime(880.00, t + 0.10);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }

      case 'login_success': {
        // Fast subtle digital blip (~180ms)
        // G5 (783.99Hz) -> C6 (1046.5Hz)
        const dur = 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(783.99, t);
        osc.frequency.exponentialRampToValueAtTime(1046.50, t + 0.06);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }

      case 'security_alert': {
        // Two-tone firm warning (~520ms)
        // C#5 (554.37Hz) -> A4 (440Hz)
        const dur = 0.52;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, t);

        osc.frequency.setValueAtTime(554.37, t);
        osc.frequency.setValueAtTime(440.00, t + 0.18);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
        gain.gain.setValueAtTime(0.05, t + 0.17);
        gain.gain.linearRampToValueAtTime(0.20, t + 0.19);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }

      case 'ui_click': {
        // Subtle micro-tap (~30ms)
        const dur = 0.035;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + dur);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.06, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
        break;
      }
    }
  }
}

export const soundManager = SoundManager.getInstance();

/**
 * Convenient standalone export matching the prompt signature:
 * playSound("order_placed")
 */
export function playSound(event: SoundEvent, force: boolean = false): void {
  soundManager.playSound(event, force);
}
