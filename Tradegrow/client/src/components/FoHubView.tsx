import React from 'react';
import { Layers, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { MarketTick } from '../types';
import { Card, CardTitle, Badge, Button, LivePriceCell } from './ui';

interface FoHubViewProps {
  ticks?: Map<string, MarketTick>;
  onOpenOptionChain?: (symbol?: string) => void;
}

const QUICK_ACCESS = [
  { label: 'NIFTY', underlying: 'NIFTY', token: 'NSE_NIFTY50', fallback: 24856.15, fbPct: 0.42 },
  { label: 'BANK NIFTY', underlying: 'BANKNIFTY', token: 'NSE_BANKNIFTY', fallback: 52150.75, fbPct: -0.15 },
  { label: 'FIN NIFTY', underlying: 'FINNIFTY', token: 'NSE_FINNIFTY', fallback: 23890.40, fbPct: 0.22 },
  { label: 'SENSEX', underlying: 'SENSEX', token: 'BSE_SENSEX', fallback: 73600.00, fbPct: 0.38 },
];

const POPULAR_CONTRACTS = [
  { symbol: 'NIFTY 24850 CE', underlying: 'NIFTY', price: 142.30, change: 12.4, changePct: 9.5, logo: 'CE' },
  { symbol: 'NIFTY 24800 PE', underlying: 'NIFTY', price: 98.10, change: -8.2, changePct: -7.7, logo: 'PE' },
  { symbol: 'BANKNIFTY 52000 CE', underlying: 'BANKNIFTY', price: 310.50, change: 22.1, changePct: 7.6, logo: 'CE' },
  { symbol: 'NIFTY FUT', underlying: 'NIFTY', price: 24862.0, change: 21.6, changePct: 0.09, logo: 'FUT' },
];

/**
 * The dedicated F&O experience (Task 8) — replaces Task 6's lightweight
 * interim "Popular F&O Contracts" grid. A curated entry point into Option
 * Chain rather than a second implementation of it: quick access to each
 * major underlying's chain, a popular-contracts glance, and a clear primary
 * CTA. The actual chain/strike/order logic all still lives in
 * OptionChainView — this page deliberately does not duplicate it.
 */
export function FoHubView({ ticks, onOpenOptionChain }: FoHubViewProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-lg font-black tracking-tight">F&O Trading Hub</h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">Live index quotes, popular contracts, and one tap into the full option chain.</p>
        </div>
        <Button variant="primary" onClick={() => onOpenOptionChain?.()}>Open Full Option Chain</Button>
      </Card>

      <div>
        <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">Quick Access</span>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_ACCESS.map((idx) => {
            const tick = ticks?.get(idx.token);
            const price = tick?.ltp ?? idx.fallback;
            const pct = tick?.changePercent ?? idx.fbPct;
            const isGain = pct >= 0;
            return (
              <Card key={idx.underlying} interactive onClick={() => onOpenOptionChain?.(idx.underlying)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold">{idx.label}</span>
                  <Badge variant={isGain ? 'gain' : 'loss'}>{isGain ? '+' : ''}{pct.toFixed(2)}%</Badge>
                </div>
                <div className="font-mono text-base font-black tabular-nums mb-2">
                  <LivePriceCell value={price} prefix="₹" decimals={2} className="!p-0 !bg-transparent" />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--primary)]">
                  <Layers className="w-3 h-3" /> View Option Chain
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardTitle className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-[var(--primary)]" />Popular F&O Contracts</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {POPULAR_CONTRACTS.map((c) => {
            const isGain = c.change >= 0;
            return (
              <div
                key={c.symbol}
                onClick={() => onOpenOptionChain?.(c.underlying)}
                className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-3.5 rounded-xl hover:border-[var(--primary)]/40 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20 font-black flex items-center justify-center text-xs mb-2 group-hover:scale-105 transition-transform">
                  {c.logo}
                </div>
                <h4 className="font-bold text-xs truncate mb-1">{c.symbol}</h4>
                <div className="num-font font-bold text-xs">₹{c.price.toFixed(2)}</div>
                <div className={`num-font font-bold text-[11px] flex items-center gap-0.5 mt-0.5 ${isGain ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                  {isGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{Math.abs(c.change).toFixed(2)} ({Math.abs(c.changePct).toFixed(2)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
