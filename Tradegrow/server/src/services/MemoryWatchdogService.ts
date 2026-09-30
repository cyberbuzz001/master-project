import { sendTelegramAlert } from '../utils/telegramAlert';

export interface MemoryStats {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  timestamp: number;
}

export class MemoryWatchdogService {
  private static instance: MemoryWatchdogService;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private warningThresholdMB: number = 1536; // 1.5 GB
  private criticalThresholdMB: number = 2048; // 2.0 GB

  private lastStats: MemoryStats | null = null;

  private constructor() {}

  public static getInstance(): MemoryWatchdogService {
    if (!MemoryWatchdogService.instance) {
      MemoryWatchdogService.instance = new MemoryWatchdogService();
    }
    return MemoryWatchdogService.instance;
  }

  public getStats(): MemoryStats {
    const mem = process.memoryUsage();
    return {
      heapUsedMB: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      heapTotalMB: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
      rssMB: Number((mem.rss / (1024 * 1024)).toFixed(2)),
      externalMB: Number((mem.external / (1024 * 1024)).toFixed(2)),
      timestamp: Date.now()
    };
  }

  public start(intervalMs: number = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[MemoryWatchdog] 🛡️ Memory watchdog active (Interval: ${intervalMs / 1000}s, Warning: ${this.warningThresholdMB}MB, Critical: ${this.criticalThresholdMB}MB)`);

    this.intervalTimer = setInterval(() => {
      this.checkMemory();
    }, intervalMs);

    // Initial check after 5s
    setTimeout(() => this.checkMemory(), 5000);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('[MemoryWatchdog] Memory watchdog stopped.');
  }

  private checkMemory(): void {
    const stats = this.getStats();
    this.lastStats = stats;

    const formattedLog = `[MemoryWatchdog] 📊 Heap: ${stats.heapUsedMB} MB / ${stats.heapTotalMB} MB | RSS: ${stats.rssMB} MB | External: ${stats.externalMB} MB`;

    if (stats.heapUsedMB >= this.criticalThresholdMB) {
      console.error(`[MemoryWatchdog] 🚨 CRITICAL: High Memory Usage! ${stats.heapUsedMB} MB exceeds critical threshold (${this.criticalThresholdMB} MB)`);
      sendTelegramAlert(`🚨 *CRITICAL MEMORY ALERT*\nNode.js Process Heap: *${stats.heapUsedMB} MB*\nRSS: *${stats.rssMB} MB*\nImmediate audit required!`);
      // Trigger GC if exposed (node --expose-gc)
      if (global.gc) {
        try {
          console.warn('[MemoryWatchdog] 🧹 Invoking manual garbage collection...');
          global.gc();
        } catch (_) {}
      }
    } else if (stats.heapUsedMB >= this.warningThresholdMB) {
      console.warn(`[MemoryWatchdog] ⚠️ WARNING: Elevated Heap Usage! ${stats.heapUsedMB} MB exceeds warning threshold (${this.warningThresholdMB} MB)`);
    } else {
      // Normal structured log
      console.log(formattedLog);
    }
  }
}

export const memoryWatchdog = MemoryWatchdogService.getInstance();
