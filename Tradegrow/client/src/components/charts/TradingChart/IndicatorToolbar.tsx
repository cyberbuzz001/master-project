import React, { useState } from 'react';
import { IndicatorConfig } from './TradingChart.types';
import { Sliders, Search, Check, Plus, Trash2, X } from 'lucide-react';

interface IndicatorToolbarProps {
  indicators: IndicatorConfig[];
  onToggleIndicator: (id: string) => void;
  onAddIndicator: (config: IndicatorConfig) => void;
  onRemoveIndicator: (id: string) => void;
}

export const IndicatorToolbar: React.FC<IndicatorToolbarProps> = ({
  indicators,
  onToggleIndicator,
  onAddIndicator,
  onRemoveIndicator,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const availableCatalog: Omit<IndicatorConfig, 'id' | 'enabled'>[] = [
    { name: 'Simple Moving Average', type: 'SMA', period: 20, color: '#3b82f6' },
    { name: 'Exponential Moving Average', type: 'EMA', period: 9, color: '#10b981' },
    { name: 'Weighted Moving Average', type: 'WMA', period: 14, color: '#f59e0b' },
    { name: 'Bollinger Bands', type: 'BOLLINGER', period: 20, stdDev: 2, color: '#8b5cf6' },
    { name: 'Relative Strength Index (RSI)', type: 'RSI', period: 14, color: '#ec4899' },
    { name: 'MACD (12, 26, 9)', type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#06b6d4' },
    { name: 'Volume Weighted Average Price (VWAP)', type: 'VWAP', color: '#eab308' },
  ];

  const filteredCatalog = availableCatalog.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = (item: Omit<IndicatorConfig, 'id' | 'enabled'>) => {
    const newIndicator: IndicatorConfig = {
      ...item,
      id: `${item.type}_${Date.now()}`,
      enabled: true,
    };
    onAddIndicator(newIndicator);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 transition"
      >
        <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Indicators ({indicators.filter(i => i.enabled).length})
      </button>

      {isOpen && (
        <div className="absolute left-0 top-10 z-50 w-80 bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-sm text-white">Technical Indicators</span>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search indicators..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Active Indicators List */}
          {indicators.length > 0 && (
            <div className="flex flex-col gap-1 pb-2 border-b border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Overlays</span>
              {indicators.map(ind => (
                <div key={ind.id} className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ind.color || '#10b981' }} />
                    <span className="font-semibold text-slate-200">{ind.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleIndicator(ind.id)}
                      className={`p-1 rounded ${ind.enabled ? 'text-emerald-400 bg-emerald-950' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onRemoveIndicator(ind.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Available Catalog */}
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Available Library</span>
            {filteredCatalog.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleAdd(item)}
                className="flex items-center justify-between p-2 rounded hover:bg-slate-900 border border-transparent hover:border-slate-800 cursor-pointer transition text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 font-medium">{item.name}</span>
                </div>
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
