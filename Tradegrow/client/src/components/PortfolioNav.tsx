import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock, History, Wallet, PieChart, BookOpen } from 'lucide-react';
import { Tabs } from './ui';

export type PortfolioSection = 'POSITIONS' | 'ORDERS' | 'TRADE_HISTORY' | 'HOLDINGS' | 'ANALYTICS' | 'JOURNAL';

const SECTION_PATHS: Record<PortfolioSection, string> = {
  POSITIONS: '/portfolio/positions',
  ORDERS: '/portfolio/orders',
  TRADE_HISTORY: '/portfolio/history',
  HOLDINGS: '/portfolio/holdings',
  ANALYTICS: '/portfolio/analytics',
  JOURNAL: '/portfolio/journal',
};

interface PortfolioNavProps {
  active: PortfolioSection;
  counts?: Partial<Record<PortfolioSection, number>>;
}

/**
 * The one control that makes all Portfolio tabs (Positions/Orders/History/Holdings/Analytics/Journal)
 * reachable from one another. Route-driven (onChange navigates), not local state.
 */
export function PortfolioNav({ active, counts }: PortfolioNavProps) {
  const navigate = useNavigate();
  return (
    <Tabs
      ariaLabel="Portfolio section"
      value={active}
      onChange={(v) => navigate(SECTION_PATHS[v as PortfolioSection])}
      items={[
        { value: 'POSITIONS', label: counts?.POSITIONS !== undefined ? `Positions (${counts.POSITIONS})` : 'Positions', icon: <Zap className="w-3.5 h-3.5" /> },
        { value: 'ORDERS', label: counts?.ORDERS !== undefined ? `Orders (${counts.ORDERS})` : 'Orders', icon: <Clock className="w-3.5 h-3.5" /> },
        { value: 'TRADE_HISTORY', label: counts?.TRADE_HISTORY !== undefined ? `History (${counts.TRADE_HISTORY})` : 'History', icon: <History className="w-3.5 h-3.5" /> },
        { value: 'HOLDINGS', label: counts?.HOLDINGS !== undefined ? `Holdings (${counts.HOLDINGS})` : 'Holdings', icon: <Wallet className="w-3.5 h-3.5" /> },
        { value: 'ANALYTICS', label: 'Analytics', icon: <PieChart className="w-3.5 h-3.5" /> },
        { value: 'JOURNAL', label: 'Journal & Insights', icon: <BookOpen className="w-3.5 h-3.5" /> },
      ]}
    />
  );
}
