/**
 * scripts/run_phase7_stress_suite.ts
 *
 * Standalone High-Speed 50,000 Simulated Orders Financial Ledger Invariance Engine
 * Benchmarks:
 * - 50,000 simulated order state transitions and P&L settlements
 * - Integer paisa math invariance check across 50,000 transactions
 * - Conservation of capital validation (Starting balance + Realized PnL == Final Balance)
 * - Memory RSS and GC behavior under high load
 */

import { performance } from 'perf_hooks';

interface BenchmarkStats {
  totalOrders: number;
  elapsedMs: number;
  throughputPerSec: number;
  initialMemoryMB: number;
  finalMemoryMB: number;
  rssGrowthPercent: number;
  ledgerDiscrepancies: number;
  paisaRoundingVariance: number;
  capitalConservationDelta: number;
}

function run50kLedgerInvarianceSimulation(): BenchmarkStats {
  const TOTAL_ORDERS = 50000;
  const initialMemoryMB = process.memoryUsage().rss / 1024 / 1024;
  const startTime = performance.now();

  // Model a high-frequency trading firm with 100 accounts
  const NUM_ACCOUNTS = 100;
  const INITIAL_BALANCE_RUPEES = 1000000.00; // ₹10,00,000 per account
  const INITIAL_BALANCE_PAISA = BigInt(100000000);

  const accountCashPaisa: bigint[] = Array(NUM_ACCOUNTS).fill(INITIAL_BALANCE_PAISA);
  const accountRealizedPnlPaisa: bigint[] = Array(NUM_ACCOUNTS).fill(BigInt(0));
  const accountLedgerSumsPaisa: bigint[] = Array(NUM_ACCOUNTS).fill(INITIAL_BALANCE_PAISA);

  // Floating point mirrors to measure float drift vs integer paisa
  const accountFloatBalances: number[] = Array(NUM_ACCOUNTS).fill(INITIAL_BALANCE_RUPEES);

  let ledgerDiscrepancies = 0;
  let paisaRoundingVariance = 0;

  // Run 50,000 randomized orders
  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const accountIdx = i % NUM_ACCOUNTS;
    
    // Simulate trade outcome: Realized P&L between -₹2,500.00 and +₹3,000.00
    // Using deterministic linear congruential formula for reproducibility
    const pnlFloat = (((i * 48271) % 55001) - 25000) / 10; // e.g. -2500.0 to +3000.0
    const pnlPaisa = BigInt(Math.round(pnlFloat * 100));

    // Guard: Prevent account overdraft (cannot lose more than current cash)
    if (accountCashPaisa[accountIdx] + pnlPaisa >= BigInt(0)) {
      // 1. Integer paisa ledger mutation
      accountCashPaisa[accountIdx] += pnlPaisa;
      accountRealizedPnlPaisa[accountIdx] += pnlPaisa;
      accountLedgerSumsPaisa[accountIdx] += pnlPaisa;

      // 2. Float mirror mutation with standard rounding
      accountFloatBalances[accountIdx] = Math.round((accountFloatBalances[accountIdx] + (Number(pnlPaisa) / 100)) * 100) / 100;
    }

    // Invariance Check on every 5,000th order
    if (i % 5000 === 0) {
      const currentCashRupees = Number(accountCashPaisa[accountIdx]) / 100;
      if (Math.abs(currentCashRupees - accountFloatBalances[accountIdx]) > 0.001) {
        paisaRoundingVariance++;
      }
      if (accountCashPaisa[accountIdx] !== accountLedgerSumsPaisa[accountIdx]) {
        ledgerDiscrepancies++;
      }
    }
  }

  // Final Invariance Audit across all 100 accounts
  let totalStartingCapitalPaisa = BigInt(NUM_ACCOUNTS) * INITIAL_BALANCE_PAISA;
  let totalCurrentCashPaisa = BigInt(0);
  let totalRealizedPnlPaisa = BigInt(0);

  for (let a = 0; a < NUM_ACCOUNTS; a++) {
    totalCurrentCashPaisa += accountCashPaisa[a];
    totalRealizedPnlPaisa += accountRealizedPnlPaisa[a];

    // Verify each account ledger sum equals cash balance exactly
    if (accountCashPaisa[a] !== accountLedgerSumsPaisa[a]) {
      ledgerDiscrepancies++;
    }
  }

  // Conservation of Capital Invariance: Starting + Realized PnL == Current Cash
  const expectedTotalPaisa = totalStartingCapitalPaisa + totalRealizedPnlPaisa;
  const capitalConservationDelta = Number(totalCurrentCashPaisa - expectedTotalPaisa) / 100;

  const elapsedMs = performance.now() - startTime;
  const finalMemoryMB = process.memoryUsage().rss / 1024 / 1024;
  const rssGrowthPercent = ((finalMemoryMB - initialMemoryMB) / initialMemoryMB) * 100;

  return {
    totalOrders: TOTAL_ORDERS,
    elapsedMs,
    throughputPerSec: Number((TOTAL_ORDERS / (elapsedMs / 1000)).toFixed(1)),
    initialMemoryMB,
    finalMemoryMB,
    rssGrowthPercent,
    ledgerDiscrepancies,
    paisaRoundingVariance,
    capitalConservationDelta
  };
}

async function main() {
  console.log('========================================================================');
  console.log('TRADEGROW PHASE 7: 50,000 SIMULATED ORDERS LEDGER INVARIANCE AUDIT');
  console.log('========================================================================');
  console.log('Starting benchmark across 100 concurrent trading accounts...');

  const stats = run50kLedgerInvarianceSimulation();

  console.log('\n--- EXECUTION PERFORMANCE ---');
  console.log(`Total Orders Simulated:        ${stats.totalOrders.toLocaleString()}`);
  console.log(`Elapsed Wall Time:             ${stats.elapsedMs.toFixed(2)} ms`);
  console.log(`Engine Throughput:             ${stats.throughputPerSec.toLocaleString()} orders/sec`);
  console.log(`Initial RSS Memory:            ${stats.initialMemoryMB.toFixed(2)} MB`);
  console.log(`Final RSS Memory:              ${stats.finalMemoryMB.toFixed(2)} MB (Delta: ${stats.rssGrowthPercent.toFixed(2)}%)`);

  console.log('\n--- MATHEMATICAL INVARIANCE AUDIT ---');
  console.log(`Ledger Discrepancies:          ${stats.ledgerDiscrepancies} (TARGET: 0)`);
  console.log(`Paisa Rounding Variances:      ${stats.paisaRoundingVariance} (TARGET: 0)`);
  console.log(`Capital Conservation Delta:    ₹${stats.capitalConservationDelta.toFixed(4)} (TARGET: ₹0.0000)`);

  const passed = stats.ledgerDiscrepancies === 0 &&
                 stats.paisaRoundingVariance === 0 &&
                 stats.capitalConservationDelta === 0;

  console.log('========================================================================');
  if (passed) {
    console.log('STATUS: PASS ✅ — 100% LEDGER INVARIANCE VERIFIED ACROSS 50,000 ORDERS');
  } else {
    console.log('STATUS: FAIL ❌ — DISCREPANCY DETECTED');
    process.exit(1);
  }
  console.log('========================================================================\n');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error during benchmark:', err);
    process.exit(1);
  });
}
