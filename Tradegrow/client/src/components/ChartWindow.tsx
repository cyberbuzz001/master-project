import React from 'react';
import { TradingChart } from './charts/TradingChart/TradingChart';
import { MarketTick, Order, Position } from '../types';

interface ChartWindowProps {
  symbol: string;
  token: string;
  latestTick?: MarketTick;
  orders?: Order[];
  positions?: Position[];
  theme?: 'dark' | 'light';
  onBuyClick?: (symbol: string, price: number) => void;
  onSellClick?: (symbol: string, price: number) => void;
}

export const ChartWindow: React.FC<ChartWindowProps> = ({
  symbol,
  token,
  latestTick,
  orders = [],
  positions = [],
  theme,
  onBuyClick,
  onSellClick,
}) => {
  const currentTheme = theme || ((typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') ? 'dark' : 'light');

  const orderMarkers = orders
    .filter(o => o.symbol === symbol && o.status === 'FILLED')
    .map(o => ({
      id: o.id,
      time: Math.floor(new Date(o.created_at).getTime() / 1000),
      side: o.side,
      price: o.average_price || o.price,
      quantity: o.quantity,
      status: o.status,
    }));

  const positionMarkers = positions
    .filter(p => p.symbol === symbol && p.netQty !== 0)
    .map(p => ({
      symbol: p.symbol,
      side: (p.netQty > 0 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
      averagePrice: p.averagePrice,
      quantity: Math.abs(p.netQty),
      unrealizedPnl: p.unrealizedPnl,
    }));

  return (
    <TradingChart
      exchange="NSE"
      symbol={symbol}
      token={token}
      latestTick={latestTick}
      orderMarkers={orderMarkers}
      positionMarkers={positionMarkers}
      theme={currentTheme}
      onBuyClick={onBuyClick}
      onSellClick={onSellClick}
    />
  );
};
