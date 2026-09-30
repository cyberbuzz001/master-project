/**
 * SAFETY LOCK MODULE — HARDCODED SYSTEM GUARD
 * Ensures that real-money trading functionality can NEVER be activated or called.
 */
export class SafetyLock {
  public static readonly REAL_MONEY_TRADING_ALLOWED: boolean = false;

  public static assertSimulationOnly(callingMethodName: string): void {
    if (this.REAL_MONEY_TRADING_ALLOWED || process.env.REAL_MONEY_TRADING === 'true') {
      const errorMsg = `CRITICAL SAFETY VIOLATION: Attempted real-money operation in method '${callingMethodName}'. Platform is HARD-LOCKED to Virtual Paper Trading only.`;
      console.error(`[SAFETY LOCK ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
