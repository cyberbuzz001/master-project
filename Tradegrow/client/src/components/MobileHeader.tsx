import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ChevronDown, Radio } from 'lucide-react';
import { MarketTick } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface IndexItem { label: string; token: string; exchange: string; tick?: MarketTick }
export function MobileHeader({ name, token, connected, indices, onSearch, onIndex }: {
  name: string; token: string; connected: boolean; indices: IndexItem[];
  onSearch: () => void; onIndex: (index: IndexItem) => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => setExpanded(false), [pathname]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const categories = ['Home', 'Options', 'Indices', 'Positions', 'Orders'];
  const active = expanded ? 2 : pathname.startsWith('/option-chain') ? 1 : pathname.startsWith('/portfolio/orders') ? 4 : pathname.startsWith('/portfolio/positions') ? 3 : pathname === '/' ? 0 : -1;
  const firstName = name.trim().split(/\s+/)[0] || 'Trader';
  const tick = indices[0]?.tick;
  const ist = new Date(now + 330 * 60000);
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const session = ist.getUTCDay() > 0 && ist.getUTCDay() < 6 && minutes >= 555 && minutes < 930;
  const live = session && connected && Boolean(tick && now - tick.timestamp >= 0 && now - tick.timestamp < 30000);
  const change = (t?: MarketTick) => t ? `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)} (${t.changePercent >= 0 ? '+' : ''}${t.changePercent.toFixed(2)}%)` : '—';
  return <header className="tg-mobile-header md:hidden">
    <div className="flex h-16 items-center justify-between gap-2 px-4">
      <Link to="/profile/account" className="flex min-w-0 items-center gap-2.5" aria-label="Open account">
        <span className="tg-avatar">{firstName.charAt(0).toUpperCase()}</span>
        <span className="text-xs text-slate-400">Hello, <span className="tg-greeting-name block truncate text-sm font-semibold text-slate-100">{firstName}</span></span>
      </Link>
      <div className="flex items-center gap-1">
        <span role="status" aria-label={connected ? 'Market feed connected' : 'Market feed reconnecting'} className={`flex h-11 w-8 items-center justify-center ${connected ? 'text-emerald-400' : 'text-amber-400'}`}><Radio size={17} className={connected ? 'tg-connection-pulse' : ''} /></span>
        <NotificationCenter token={token} />
        <button type="button" onClick={onSearch} aria-label="Search contracts (Control or Command K)" className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 active:bg-white/10"><Search size={20} /></button>
      </div>
    </div>
    <div className="tg-category-scroll" aria-label="Trading sections">
      <div className="relative grid min-w-[360px] grid-cols-5">
        {active >= 0 && <span className="tg-category-indicator" aria-hidden="true" style={{ transform: `translate3d(${active * 100}%,0,0)` }} />}
        {categories.map((label, i) => <button key={label} type="button" aria-pressed={active === i} onClick={() => {
          if (i === 2) { setExpanded(value => !value); return; }
          setExpanded(false); navigate(['/', '/option-chain', '/', '/portfolio/positions', '/portfolio/orders'][i]);
        }} className={`relative z-10 min-h-11 text-xs font-semibold transition-colors ${active === i ? 'text-emerald-400' : 'text-slate-400'}`}>{label}</button>)}
      </div>
    </div>
    <button type="button" className="flex min-h-11 w-full items-center gap-2 border-t border-white/5 px-4 text-left text-[10px] tabular-nums" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="tg-mobile-indices">
      <span className="shrink-0 font-semibold text-slate-300">NIFTY 50</span>
      <span className="font-semibold text-slate-100">{tick?.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</span>
      <span className={(tick?.change ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{change(tick)}</span>
      <span className={`ml-auto shrink-0 rounded-full px-1.5 py-1 text-[8px] ${live ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-400/10 text-slate-400'}`}>● {live ? 'LIVE' : session ? 'SYNCING' : 'CLOSED'}</span>
      <ChevronDown size={14} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
    <div id="tg-mobile-indices" hidden={!expanded} className="grid grid-cols-2 gap-2 px-4 pb-3">
      {indices.map(index => <button key={index.token} type="button" onClick={() => onIndex(index)} className="rounded-xl border border-white/5 bg-[#111622] p-3 text-left tabular-nums">
        <span className="block text-[10px] font-medium text-slate-400">{index.label}</span>
        <span className="my-1 block text-sm font-semibold text-slate-100">{index.tick?.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</span>
        <span className={`text-[10px] ${(index.tick?.change ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{change(index.tick)}</span>
      </button>)}
    </div>
  </header>;
}
