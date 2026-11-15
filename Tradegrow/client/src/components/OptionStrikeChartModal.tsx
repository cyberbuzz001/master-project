import React, { useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { TradingChart } from './charts/TradingChart/TradingChart';
import { Position } from '../types';
export interface SelectedOptionContract {
  underlying: string;
  symbol: string;
  strike: number;
  optionType: 'CE' | 'PE';
  expiry: string;
  exchange: string;
  instrumentToken: string;
  lotSize: number;
  initialLtp?: number;
  iv?: number;
  delta?: number;
  theta?: number;
  gamma?: number;
  vega?: number;
  openInterest?: number;
}

interface OptionStrikeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: SelectedOptionContract | null;
  onSwitchContract?: (contract: SelectedOptionContract) => void;
  positions?: Position[];
  onOpenOrderModal?: (side: 'BUY' | 'SELL', price: number, lots: number) => void;
  theme?: 'dark' | 'light';
}


export const OptionStrikeChartModal: React.FC<OptionStrikeChartModalProps> = props => {
  if (!props.isOpen || !props.contract) return null;
  return <OptionChartDialog {...props} contract={props.contract} />;
};

function OptionChartDialog({ contract, onClose, onSwitchContract, positions = [], onOpenOrderModal, theme = 'dark' }: OptionStrikeChartModalProps & { contract: SelectedOptionContract }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHandler.current();
      if (event.key === 'Tab') {
        const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') || []).filter(node => node.getClientRects().length > 0);
        const target = event.shiftKey ? nodes[nodes.length - 1] : nodes[0];
        if (target && (event.shiftKey ? document.activeElement === nodes[0] : document.activeElement === nodes[nodes.length - 1])) { event.preventDefault(); target.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const step = contract.underlying.includes('SENSEX') || contract.underlying.includes('BANKNIFTY') ? 100 : 50;
  const switchTo = (strike: number, optionType: 'CE' | 'PE') => {
    if (!onSwitchContract || strike <= 0) return;
    const token = contract.instrumentToken.replace(new RegExp('_' + contract.strike + '_(CE|PE)$'), '_' + strike + '_' + optionType);
    // Tokens not using the canonical strike suffix must be resolved by the chain.
    if (token === contract.instrumentToken && (strike !== contract.strike || optionType !== contract.optionType)) return;
    onSwitchContract({ ...contract, strike, optionType, symbol: contract.underlying + ' ' + strike + ' ' + optionType, instrumentToken: token, initialLtp: undefined, iv: undefined, delta: undefined, theta: undefined, gamma: undefined, vega: undefined, openInterest: undefined });
  };
  const position = positions.find(p => p.symbol === contract.symbol && p.netQty !== 0);
  return <div role="dialog" aria-modal="true" aria-label={'Option chart: ' + contract.symbol} className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 md:p-4">
    <section ref={dialogRef} className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-[var(--bg-body)] text-[var(--text-main)] md:h-[92dvh] md:max-w-6xl md:rounded-2xl">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2 pt-[max(8px,env(safe-area-inset-top))]">
        <div className="min-w-0"><h2 className="truncate text-sm font-bold">{contract.symbol}</h2><p className="text-[10px] text-[var(--text-muted)]">{contract.expiry} · Lot {contract.lotSize} · {contract.exchange}</p></div>
        <button ref={closeRef} type="button" aria-label="Close option chart" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)]"><X size={20} /></button>
      </div>
      {onSwitchContract && <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] px-3">
        <button type="button" aria-label="Previous strike" onClick={() => switchTo(contract.strike - step, contract.optionType)} className="flex h-11 w-11 items-center justify-center"><ChevronLeft size={18} /></button>
        <span className="text-xs font-semibold tabular-nums">{contract.strike}</span>
        <div className="flex gap-1">{(['CE', 'PE'] as const).map(type => <button key={type} type="button" aria-pressed={type === contract.optionType} onClick={() => switchTo(contract.strike, type)} className={'min-h-11 px-4 text-xs font-bold ' + (type === contract.optionType ? 'text-emerald-400' : 'text-[var(--text-muted)]')}>{type}</button>)}</div>
        <button type="button" aria-label="Next strike" onClick={() => switchTo(contract.strike + step, contract.optionType)} className="flex h-11 w-11 items-center justify-center"><ChevronRight size={18} /></button>
      </div>}
      <div className="flex shrink-0 gap-3 overflow-x-auto px-3 py-1.5 text-[10px] text-[var(--text-muted)] tabular-nums" aria-label="Contract Greeks">
        {([['IV', contract.iv], ['Delta', contract.delta], ['Theta', contract.theta], ['Gamma', contract.gamma], ['Vega', contract.vega], ['OI', contract.openInterest]] as const).filter(([, value]) => value !== undefined).map(([label, value]) => <span key={label} className="shrink-0">{label} <strong className="text-[var(--text-main)]">{Number(value).toLocaleString('en-IN', { maximumFractionDigits: label === 'Gamma' ? 4 : 2 })}</strong></span>)}
      </div>
      <div className="min-h-0 flex-1 overflow-auto pb-[env(safe-area-inset-bottom)]">
        <TradingChart key={contract.instrumentToken} exchange={contract.exchange} symbol={contract.symbol} token={contract.instrumentToken} theme={theme}
          positionMarkers={position ? [{ symbol: position.symbol, side: position.netQty > 0 ? 'LONG' : 'SHORT', averagePrice: position.averagePrice, quantity: Math.abs(position.netQty), unrealizedPnl: position.unrealizedPnl }] : []}
          onBuyClick={onOpenOrderModal ? (_, price) => onOpenOrderModal('BUY', price, 1) : undefined}
          onSellClick={onOpenOrderModal ? (_, price) => onOpenOrderModal('SELL', price, 1) : undefined} />
      </div>
    </section>
  </div>;
}
