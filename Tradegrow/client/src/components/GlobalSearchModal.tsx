import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, TrendingUp, LineChart, Layers, PieChart, ShieldAlert, Zap,
  User, ListOrdered, HelpCircle, ArrowRight, Building2, CheckCircle2,
  Clock, Shield, Wallet
} from 'lucide-react';
import { isStaffUser } from '../types';
import { Badge } from './ui/Badge';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol?: (token: string, symbol: string) => void;
  onSelectTab?: (view: 'EXPLORE' | 'HOLDINGS' | 'POSITIONS' | 'ORDERS' | 'WATCHLIST' | 'TERMINAL' | 'OPTION_CHAIN' | 'MARKET_DEPTH' | 'PORTFOLIO' | 'SCANNER' | 'ADMIN') => void;
  userRole?: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSymbol,
  onSelectTab,
  userRole,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [adminResults, setAdminResults] = useState<{ customers: any[]; orders: any[]; tickets: any[] }>({
    customers: [],
    orders: [],
    tickets: [],
  });
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const isAdminUser = isStaffUser(userRole);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced admin search across Customers, Orders, Tickets
  useEffect(() => {
    if (!isAdminUser || !query.trim() || query.length < 2) {
      setAdminResults({ customers: [], orders: [], tickets: [] });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const timer = setTimeout(async () => {
      setLoadingAdmin(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const q = encodeURIComponent(query.trim());

        const [custRes, ordRes] = await Promise.allSettled([
          fetch(`/api/v1/admin/users?search=${q}&limit=5`, { headers }).then(r => r.ok ? r.json() : null),
          fetch(`/api/v1/admin/orders?search=${q}&limit=5`, { headers }).then(r => r.ok ? r.json() : null),
        ]);

        const customers = custRes.status === 'fulfilled' && custRes.value?.users ? custRes.value.users : [];
        const orders = ordRes.status === 'fulfilled' && ordRes.value?.orders ? ordRes.value.orders : [];

        setAdminResults({ customers, orders, tickets: [] });
      } catch (_) {
      } finally {
        setLoadingAdmin(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isAdminUser]);

  // Live Scrip Search via /api/v1/instruments/search for all NSE stocks
  const [serverInstruments, setServerInstruments] = useState<Array<{
    token: string;
    symbol: string;
    name: string;
    exchange: string;
    segment?: string;
    lotSize?: number;
    strikePrice?: number;
    optionType?: string;
    expiryDate?: string;
  }>>([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setServerInstruments([]);
      setLoadingInstruments(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingInstruments(true);
      try {
        const q = encodeURIComponent(query.trim());
        const res = await fetch(`/api/v1/instruments/search?q=${q}&limit=30`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.instruments)) {
            setServerInstruments(data.instruments);
          }
        }
      } catch (_) {
      } finally {
        setLoadingInstruments(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const staticInstruments = [
    { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', name: 'Nifty 50 Index', exchange: 'NSE', type: 'INDEX' },
    { token: 'BSE_SENSEX', symbol: 'SENSEX', name: 'BSE Sensex Index', exchange: 'BSE', type: 'INDEX' },
    { token: 'NSE_BANKNIFTY', symbol: 'BANK NIFTY', name: 'Nifty Bank Index', exchange: 'NSE', type: 'INDEX' },
    { token: 'NSE_FINNIFTY', symbol: 'FIN NIFTY', name: 'Nifty Financial Services', exchange: 'NSE', type: 'INDEX' },
    { token: 'NSE_RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_TCS', symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_INFY', symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_ICICIBANK', symbol: 'ICICIBANK', name: 'ICICI Bank Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_SBIN', symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_ITC', symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_TATAMOTORS', symbol: 'TATAMOTORS', name: 'Tata Motors Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_TATASTEEL', symbol: 'TATASTEEL', name: 'Tata Steel Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_MARUTI', symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_LT', symbol: 'LT', name: 'Larsen & Toubro Ltd', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_WIPRO', symbol: 'WIPRO', name: 'Wipro Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_BAJFINANCE', symbol: 'BAJFINANCE', name: 'Bajaj Finance Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_ADANIENT', symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_ZOMATO', symbol: 'ZOMATO', name: 'Zomato Limited (Eternal)', exchange: 'NSE', type: 'EQ' },
  ];

  const quickNav = [
    { id: 'EXPLORE', label: 'Dashboard & Pulse', icon: TrendingUp, path: '/', color: 'text-emerald-500' },
    { id: 'OPTION_CHAIN', label: 'Option Chain Matrix', icon: Layers, path: '/option-chain', color: 'text-emerald-500' },
    { id: 'POSITIONS', label: 'Positions & Orders', icon: ListOrdered, path: '/portfolio/positions', color: 'text-indigo-500' },
    { id: 'HOLDINGS', label: 'Holdings & 30D Heatmap', icon: PieChart, path: '/portfolio/holdings', color: 'text-purple-500' },
    ...(isAdminUser ? [
      { id: 'ADMIN_CUSTOMERS', label: 'Admin: Customers Queue', icon: User, path: '/admin?tab=CUSTOMERS', color: 'text-rose-500' },
      { id: 'ADMIN_ORDERS', label: 'Admin: Order Monitor', icon: ListOrdered, path: '/admin?tab=ORDER_MONITOR', color: 'text-rose-500' },
      { id: 'ADMIN_KYC', label: 'Admin: KYC Queue', icon: Shield, path: '/admin?tab=KYC_QUEUE', color: 'text-rose-500' },
      { id: 'ADMIN_FUNDS', label: 'Admin: Funds & Ledger', icon: Wallet, path: '/admin?tab=FUNDS_OVERVIEW', color: 'text-rose-500' },
    ] : []),
  ];

  const getDynamicOptionResults = () => {
    if (!query.trim()) return [];
    const qLower = query.toLowerCase();
    const numbers = query.match(/\d+/g);

    const isNiftySearch = qLower.includes('nifty') || qLower.includes('nfo') || !qLower.includes('sensex');
    const isSensexSearch = qLower.includes('sensex') || qLower.includes('bfo') || qLower.includes('bse');

    const options: Array<{ token: string; symbol: string; name: string; exchange: string; type: string }> = [];

    if (numbers && numbers.length > 0) {
      const strike = parseInt(numbers[numbers.length - 1], 10);
      if (isNiftySearch) {
        options.push(
          { token: `NFO_NIFTY_${strike}_CE`, symbol: `NIFTY ${strike} CE`, name: `NIFTY ${strike} CALL OPTION`, exchange: 'NFO', type: 'OPT' },
          { token: `NFO_NIFTY_${strike}_PE`, symbol: `NIFTY ${strike} PE`, name: `NIFTY ${strike} PUT OPTION`, exchange: 'NFO', type: 'OPT' }
        );
      }
      if (isSensexSearch) {
        options.push(
          { token: `BFO_SENSEX_${strike}_CE`, symbol: `SENSEX ${strike} CE`, name: `SENSEX ${strike} CALL OPTION`, exchange: 'BFO', type: 'OPT' },
          { token: `BFO_SENSEX_${strike}_PE`, symbol: `SENSEX ${strike} PE`, name: `SENSEX ${strike} PUT OPTION`, exchange: 'BFO', type: 'OPT' }
        );
      }
    }
    return options.filter(o => o.symbol.toLowerCase().includes(qLower) || o.name.toLowerCase().includes(qLower));
  };

  const dynamicOptions = getDynamicOptionResults();

  // Combine server search results with local quick fallback
  const allFilteredInstruments = (() => {
    if (!query.trim()) {
      return staticInstruments.slice(0, 10);
    }

    const seenTokens = new Set<string>();
    const list: Array<{ token: string; symbol: string; name: string; exchange: string; type: string }> = [];

    // 1. Add server live results
    for (const inst of serverInstruments) {
      if (!seenTokens.has(inst.token)) {
        seenTokens.add(inst.token);
        const type = inst.optionType === 'CE' || inst.optionType === 'PE'
          ? 'OPT'
          : inst.segment?.includes('INDEX')
          ? 'INDEX'
          : 'EQ';
        list.push({
          token: inst.token,
          symbol: inst.symbol,
          name: inst.name,
          exchange: inst.exchange || 'NSE',
          type,
        });
      }
    }

    // 2. Add dynamic strike options if any
    for (const opt of dynamicOptions) {
      if (!seenTokens.has(opt.token)) {
        seenTokens.add(opt.token);
        list.push(opt);
      }
    }

    // 3. Fallback matching static instruments
    const qLower = query.toLowerCase();
    for (const inst of staticInstruments) {
      if (!seenTokens.has(inst.token) && (inst.symbol.toLowerCase().includes(qLower) || inst.name.toLowerCase().includes(qLower))) {
        seenTokens.add(inst.token);
        list.push(inst);
      }
    }

    return list;
  })();

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-start justify-center pt-16 sm:pt-20 px-4 font-body text-[var(--text-main)]">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* SEARCH INPUT BAR */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-color)] bg-[var(--bg-surface-inset)]">
          <Search className="w-5 h-5 text-[var(--primary)]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isAdminUser ? "Jump to customer, order ID, option strike, or nav section (Ctrl+K)..." : "Search Nifty, Sensex, Equity & Options (e.g. NIFTY 24850 CE)..."}
            className="w-full bg-transparent text-[var(--text-main)] placeholder-[var(--text-muted)] font-sans text-sm focus:outline-none"
          />
          <kbd className="hidden sm:inline bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] text-[10px] font-mono px-2 py-0.5 rounded">
            Esc
          </kbd>
          <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* RESULTS LIST */}
        <div className="max-h-[70vh] overflow-y-auto p-3 flex flex-col gap-4">
          
          {/* QUICK NAV MODULES */}
          {query === '' && (
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 py-1 block font-mono">
                {isAdminUser ? 'Admin Quick Jump & Navigation' : 'Quick Navigation'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {quickNav.map(nav => {
                  const Icon = nav.icon;
                  return (
                    <button
                      key={nav.id}
                      type="button"
                      onClick={() => {
                        navigate(nav.path);
                        onClose();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--bg-surface-inset)] hover:bg-[var(--bg-surface-elevated)] text-left transition border border-[var(--border-color)] text-xs min-h-[44px] cursor-pointer"
                    >
                      <Icon className={`w-4 h-4 ${nav.color}`} />
                      <span className="font-bold text-[var(--text-main)]">{nav.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADMIN SEARCH RESULTS (CUSTOMERS & ORDERS) */}
          {isAdminUser && query.trim().length >= 2 && (
            <>
              {adminResults.customers.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider px-2 py-1 block font-mono">
                    Matching Customers ({adminResults.customers.length})
                  </span>
                  <div className="flex flex-col gap-1">
                    {adminResults.customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          navigate(`/admin?customer=${c.id}`);
                          onClose();
                        }}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition text-left cursor-pointer min-h-[44px] border border-transparent hover:border-[var(--border-color)]"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs">
                            {(c.username || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-[var(--text-main)]">
                              {c.full_name || c.username} <span className="font-mono text-[10px] text-[var(--text-muted)]">({c.email})</span>
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">ID: {c.id.slice(0, 14)}...</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={c.kyc_status === 'APPROVED' ? 'gain' : 'warning'}>{c.kyc_status || 'PENDING'}</Badge>
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {adminResults.orders.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider px-2 py-1 block font-mono">
                    Matching Admin Orders ({adminResults.orders.length})
                  </span>
                  <div className="flex flex-col gap-1">
                    {adminResults.orders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          navigate(`/admin?tab=ORDER_MONITOR&orderId=${o.id}`);
                          onClose();
                        }}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition text-left cursor-pointer min-h-[44px] border border-transparent hover:border-[var(--border-color)]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[var(--text-main)]">{o.symbol}</span>
                            <Badge variant={o.side === 'BUY' ? 'gain' : 'loss'}>{o.side}</Badge>
                            <span className="text-[11px] font-mono text-[var(--text-muted)]">Qty: {o.quantity} @ ₹{o.price}</span>
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">User: {o.username || o.user_id?.slice(0, 8)}</span>
                        </div>
                        <Badge variant={o.status === 'FILLED' ? 'gain' : o.status === 'REJECTED' ? 'loss' : 'warning'}>{o.status}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* INSTRUMENTS SEARCH LIST */}
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 py-1 block font-mono">
              Market Instruments &amp; Options
            </span>
            {allFilteredInstruments.length === 0 && (!isAdminUser || adminResults.customers.length === 0) ? (
              <div className="text-center py-8 text-xs text-[var(--text-muted)] font-medium">No matching instruments found for "{query}".</div>
            ) : (
              <div className="flex flex-col gap-1">
                {allFilteredInstruments.map(inst => (
                  <button
                    key={inst.token}
                    type="button"
                    onClick={() => {
                      if (onSelectSymbol) {
                        onSelectSymbol(inst.token, inst.symbol);
                      } else {
                        navigate(`/terminal?symbol=${encodeURIComponent(inst.symbol)}&token=${encodeURIComponent(inst.token)}`);
                      }
                      onClose();
                    }}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition text-left cursor-pointer min-h-[44px] border border-transparent hover:border-[var(--border-color)]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-xs ${inst.symbol.includes('CE') ? 'text-[var(--gain)]' : inst.symbol.includes('PE') ? 'text-[var(--loss)]' : 'text-[var(--text-main)]'}`}>
                          {inst.symbol}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-medium">{inst.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface-inset)] text-[var(--text-muted)] font-bold border border-[var(--border-color)]">
                        {inst.exchange}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold ${
                        inst.type === 'OPT' ? 'bg-[var(--gain-light)] text-[var(--gain)]' : 'bg-[var(--primary-light)] text-[var(--primary)]'
                      }`}>
                        {inst.type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
