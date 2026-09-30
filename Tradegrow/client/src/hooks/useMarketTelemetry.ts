export type TelemetryEventType =
  | 'RECONNECT_ATTEMPT'
  | 'RECONNECT_FAILED_MAX'
  | 'STALENESS_CHANGED'
  | 'TOKEN_NO_TICKS_TIMEOUT'
  | 'SOCKET_CONNECTED';

export interface TelemetryEvent {
  type: TelemetryEventType;
  token?: string;
  details?: Record<string, any>;
  timestamp: number;
}

type TelemetryListener = (event: TelemetryEvent) => void;

class MarketTelemetryService {
  private static instance: MarketTelemetryService;
  private listeners: Set<TelemetryListener> = new Set();

  private constructor() {}

  public static getInstance(): MarketTelemetryService {
    if (!MarketTelemetryService.instance) {
      MarketTelemetryService.instance = new MarketTelemetryService();
    }
    return MarketTelemetryService.instance;
  }

  public logEvent(type: TelemetryEventType, details?: Record<string, any>, token?: string): void {
    const event: TelemetryEvent = {
      type,
      token,
      details,
      timestamp: Date.now(),
    };

    // Client-side non-blocking log
    console.info(`[MarketTelemetry] ${type}`, token ? `Token: ${token}` : '', details || '');

    // Notify listeners (e.g. analytics bridge or dev tools)
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[MarketTelemetry] Error in telemetry listener:', err);
      }
    });
  }

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const marketTelemetry = MarketTelemetryService.getInstance();

export function logMarketTelemetry(type: TelemetryEventType, details?: Record<string, any>, token?: string) {
  marketTelemetry.logEvent(type, details, token);
}
