import React, { useEffect, useRef, useState } from 'react';
import { useSubscribeTokens } from '../hooks/useMarketSocket';
import { useTickFreshness } from '../hooks/useTickFreshness';
import { PriceBadge } from './PriceBadge';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export interface SpotPriceTickerProps {
  symbol?: string;
  fallbackPrice?: number;
  className?: string;
  onClick?: () => void;
}

export function getSpotToken(symbol: string): string {
  switch (symbol.toUpperCase()) {
    case 'SENSEX':
    case 'BSE_SENSEX':
      return 'BSE_SENSEX';
    case 'BANKNIFTY':
    case 'NSE_BANKNIFTY':
      return 'NSE_BANKNIFTY';
    case 'FINNIFTY':
    case 'NSE_FINNIFTY':
      return 'NSE_FINNIFTY';
    case 'MIDCPNIFTY':
    case 'NSE_MIDCPNIFTY':
      return 'NSE_MIDCPNIFTY';
    case 'NIFTY':
    case 'NIFTY50':
    case 'NSE_NIFTY50':
    default:
      return 'NSE_NIFTY50';
  }
}

export const SpotPriceTicker: React.FC<SpotPriceTickerProps> = ({
  symbol = 'NIFTY',
  fallbackPrice = 24500,
  className = '',
  onClick,
}) => {
  const spotToken = getSpotToken(symbol);
  
  // Auto-subscribe spot token on WebSocket
  useSubscribeTokens([spotToken]);

  const { state, tick, timeSinceLastTick } = useTickFreshness(spotToken);
  const ltp = tick ? tick.ltp : fallbackPrice;
  const change = tick ? tick.change : 0;
  const changePercent = tick ? tick.changePercent : 0;

  const prevLtpRef = useRef<number>(ltp);
  const [flashClass, setFlashClass] = useState<'flash-up' | 'flash-down' | ''>('');

  useEffect(() => {
    if (!tick || tick.ltp === prevLtpRef.current) return;

    if (tick.ltp > prevLtpRef.current) {
      setFlashClass('flash-up');
    } else if (tick.ltp < prevLtpRef.current) {
      setFlashClass('flash-down');
    }

    prevLtpRef.current = tick.ltp;

    const timer = setTimeout(() => {
      setFlashClass('');
    }, 600);

    return () => clearTimeout(timer);
  }, [tick?.ltp]);

  const isPositive = change >= 0;

  return (
    <div
      onClick={onClick}
      className={`bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-3 rounded-2xl shadow-sm flex items-center gap-3 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:border-emerald-500/50 active:scale-98' : ''
      } ${
        flashClass === 'flash-up'
          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-emerald-500/10'
          : flashClass === 'flash-down'
          ? 'bg-rose-500/10 border-rose-500/50 shadow-rose-500/10'
          : ''
      } ${className}`}
    >
      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
        <Activity size={18} className={state === 'LIVE' ? 'animate-pulse' : ''} />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-wider">
            {symbol} SPOT
          </span>
          <PriceBadge state={state} timeSinceLastTick={timeSinceLastTick} size="sm" />
        </div>

        <div className="flex items-baseline gap-2 num-font">
          <span className="text-base font-black text-[var(--text-main)] transition-colors">
            ₹{ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>

          <span
            className={`text-xs font-extrabold flex items-center gap-0.5 ${
              isPositive ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {isPositive ? '+' : ''}
            {change.toFixed(2)} ({isPositive ? '+' : ''}
            {changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
};
