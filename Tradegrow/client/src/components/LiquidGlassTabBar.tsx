import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Bookmark, SlidersHorizontal, Briefcase, User } from 'lucide-react';
import { useAutoHideNavigation } from '../hooks/useAutoHideNavigation';

const tabs = [
  { path: '/', prefix: '/', label: 'Home', icon: Home },
  { path: '/watchlist', prefix: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { path: '/option-chain', prefix: '/option-chain', label: 'Trade', icon: SlidersHorizontal },
  { path: '/portfolio/positions', prefix: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { path: '/profile/account', prefix: '/profile', label: 'Account', icon: User },
];
export function LiquidGlassTabBar({ onTrade, pinned = false, tradeOpen = false }: { onTrade: () => void; pinned?: boolean; tradeOpen?: boolean }) {
  const { pathname } = useLocation();
  const { visible, setInteracting } = useAutoHideNavigation({ timeout: 5000, pinned });
  const index = pathname === '/' ? 0 : pathname.startsWith('/terminal') ? 2 : tabs.findIndex(tab => tab.prefix !== '/' && pathname.startsWith(tab.prefix));
  return (
    <nav aria-label="Mobile navigation" aria-hidden={!visible} inert={!visible}
      className={`tg-glass-nav md:hidden ${visible ? '' : 'tg-glass-nav--hidden'}`}
      onPointerEnter={e => { if (e.pointerType === 'mouse') setInteracting(true); }}
      onPointerLeave={() => setInteracting(false)} onPointerDown={() => setInteracting(true)}
      onPointerUp={() => setInteracting(false)} onPointerCancel={() => setInteracting(false)}
      onFocus={() => setInteracting(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(false); }}>
      <div className="relative grid grid-cols-5 items-center">
        {index >= 0 && <span aria-hidden="true" className="tg-nav-selection" style={{ transform: `translate3d(${index * 100}%,0,0)` }} />}
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          const content = <><span className={i === 2 ? 'tg-trade-orb' : 'tg-nav-icon'}><Icon size={20} strokeWidth={index === i ? 2.4 : 1.8} /></span><span>{tab.label}</span></>;
          const className = `tg-nav-item ${index === i ? 'tg-nav-item--active' : ''}`;
          return i === 2 ? <button key={tab.path} type="button" className={className} onClick={onTrade} aria-expanded={tradeOpen} aria-label="Open trading tools">{content}</button>
            : <Link key={tab.path} to={tab.path} className={className} aria-current={index === i ? 'page' : undefined}>{content}</Link>;
        })}
      </div>
    </nav>
  );
}
