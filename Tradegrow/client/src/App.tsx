import React, { useState, useEffect, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { User, Wallet, isStaffUser } from './types';
import { MarketSocketProvider, globalTickStore } from './hooks/useMarketSocket';
import { AppShell } from './components/AppShell';
import { AuthModal } from './components/AuthModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { OrderPreviewModal, OrderPreviewDetails } from './components/OrderPreviewModal';
import { MobileChartModal } from './components/mobile/MobileChartModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { PWAInstallBanner } from './components/mobile/PWAInstallBanner';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ToastProvider } from './context/ToastContext';

// ── Lazy-Loaded Route Components (Code Splitting) ───────────────────────────
const GrowwExploreView = React.lazy(() => import('./components/GrowwExploreView').then(m => ({ default: m.GrowwExploreView })));
const GrowwWatchlistView = React.lazy(() => import('./components/GrowwWatchlistView').then(m => ({ default: m.GrowwWatchlistView })));
const GrowwTerminalView = React.lazy(() => import('./components/GrowwTerminalView').then(m => ({ default: m.GrowwTerminalView })));
const OptionChainView = React.lazy(() => import('./components/OptionChainView').then(m => ({ default: m.OptionChainView })));
const OrdersPositionsView = React.lazy(() => import('./components/OrdersPositionsView').then(m => ({ default: m.OrdersPositionsView })));
const PortfolioHoldingsAnalyticsView = React.lazy(() => import('./components/PortfolioHoldingsAnalyticsView').then(m => ({ default: m.PortfolioHoldingsAnalyticsView })));
const TradingJournalView = React.lazy(() => import('./components/TradingJournalView').then(m => ({ default: m.TradingJournalView })));
const AdminPanel = React.lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const ProfilePage = React.lazy(() => import('./components/ProfilePage').then(m => ({ default: m.ProfilePage })));

const SEARCH_TAB_TO_PATH: Record<string, string> = {
  EXPLORE: '/', HOLDINGS: '/portfolio/holdings', POSITIONS: '/portfolio/positions',
  ORDERS: '/portfolio/orders', WATCHLIST: '/watchlist', OPTION_CHAIN: '/option-chain',
  ADMIN: '/admin', PORTFOLIO: '/portfolio/positions', TERMINAL: '/terminal', JOURNAL: '/portfolio/journal',
};

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoot />
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

function AppRoot() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('token');
    } catch (_) {
      return null;
    }
  });
  const [user, setUser] = useState<User | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState<boolean>(() => Boolean(localStorage.getItem('token')));
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('user_theme') as 'light' | 'dark') || 'dark';
    } catch (_) {
      return 'dark';
    }
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    try {
      localStorage.setItem('user_theme', theme);
    } catch (_) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    } catch (_) {}
    setToken(null);
    setUser(null);
    setIsValidatingToken(false);
  };

  useEffect(() => {
    if (!token) {
      setIsValidatingToken(false);
      return;
    }
    fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then(data => {
        if (data.success && data.user) {
          setUser(data.user);
        } else {
          handleLogout();
        }
      })
      .catch(() => handleLogout())
      .finally(() => setIsValidatingToken(false));
  }, [token]);

  const isRegisterPath = location.pathname === '/register' || location.pathname === '/signup';

  if (isValidatingToken && token && !user) {
    return (
      <div className="min-h-screen bg-[var(--bg-body,#0b0e14)] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="text-xs font-mono text-[var(--text-muted,#94a3b8)]">Loading TradeGrow...</span>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <AuthModal
        initialMode={isRegisterPath ? 'register' : 'login'}
        onModeChange={(mode) => {
          if (mode === 'register') {
            navigate('/register');
          } else {
            navigate('/login');
          }
        }}
        onSuccess={(t: string, u?: any) => {
          localStorage.setItem('token', t);
          setToken(t);
          if (u) setUser(u);
          if (location.pathname.startsWith('/profile') || isRegisterPath || location.pathname === '/login') {
            navigate('/', { replace: true });
          }
        }}
      />
    );
  }

  return (
    <AuthenticatedApp
      token={token}
      user={user}
      theme={theme}
      toggleTheme={toggleTheme}
      onLogout={handleLogout}
    />
  );
}

interface AuthenticatedAppProps {
  token: string;
  user: User;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onLogout: () => void;
}

function AuthenticatedApp({
  token,
  user,
  theme,
  toggleTheme,
  onLogout,
}: AuthenticatedAppProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(window.innerWidth < 768);

  const [mobileOrderDetails, setMobileOrderDetails] = useState<OrderPreviewDetails | null>(null);
  const [mobileWatchlistChart, setMobileWatchlistChart] = useState<{ symbol: string; token: string; exchange: string } | null>(null);
  const [isMobileOrderModalOpen, setIsMobileOrderModalOpen] = useState<boolean>(false);

  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchWallet = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/portfolio/wallet', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.wallet) {
          setWallet(data.wallet);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchWallet();
  }, [token]);

  const PROFILE_TAB_TO_PATH: Record<string, string> = {
    PROFILE: 'account', KYC: 'kyc', BANK: 'bank', SECURITY: 'security',
    FUNDS: 'funds', SUPPORT: 'support', PERMISSIONS: 'permissions', APPEARANCE: 'appearance',
  };
  const goToProfileTab = (tab?: string) => navigate(`/profile/${PROFILE_TAB_TO_PATH[tab || 'PROFILE'] || 'account'}`);

  const openMobileQuickOrder = (opts: { symbol: string; price?: number; side?: 'BUY' | 'SELL'; exchange?: string; token?: string }) => {
    const exchange = opts.exchange || 'NSE';
    const tickKey = opts.token || `${exchange}_${opts.symbol}`;
    const livePrice = globalTickStore.getSnapshot(tickKey)?.ltp || opts.price || 0;
    setMobileOrderDetails({
      token: tickKey,
      symbol: opts.symbol,
      underlying: opts.symbol,
      exchange,
      expiry: '',
      strike: 0,
      optionType: 'CE',
      side: opts.side || 'BUY',
      lots: 1,
      lotSize: 1,
      quantity: 1,
      price: livePrice,
      orderType: 'MARKET',
      productType: 'MIS',
    });
    setIsMobileOrderModalOpen(true);
  };

  useKeyboardShortcuts({
    token,
    onOpenSearch: () => setIsSearchOpen(true),
    onQuickBuy: () => openMobileQuickOrder({ symbol: 'NIFTY 50', exchange: 'NSE', side: 'BUY' }),
    onQuickSell: () => openMobileQuickOrder({ symbol: 'NIFTY 50', exchange: 'NSE', side: 'SELL' }),
    onRefreshWallet: fetchWallet,
  });

  const routeSuspenseFallback = (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
    </div>
  );

  if (isMobileScreen) {
    return (
      <MarketSocketProvider userToken={token}>
        <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text-main)] font-sans flex flex-col w-full max-w-full overflow-x-hidden">
          <AppShell
            user={user}
            token={token || ''}
            walletBalance={wallet?.cashBalance || 0}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenWalletModal={() => goToProfileTab('FUNDS')}
            isTerminalMode={location.pathname === '/terminal'}
            onToggleTerminal={() => (location.pathname === '/terminal' ? navigate(-1) : navigate('/terminal'))}
          />

          <div className="flex-1 w-full max-w-full">
            <Suspense fallback={routeSuspenseFallback}>
              <Routes>
                <Route path="/" element={
                  <div className="max-w-lg mx-auto px-3 pt-3 pb-24">
                    <GrowwExploreView
                      token={token}
                      wallet={wallet}
                      theme={theme}
                      onOpenSearch={() => setIsSearchOpen(true)}
                      onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')}
                      onOpenProfile={goToProfileTab}
                      onSelectSymbol={(symbol, price) => openMobileQuickOrder({ symbol, price })}
                    />
                  </div>
                } />

                <Route path="/terminal" element={
                  <div className="w-full pb-16">
                    <TerminalRoute token={token} wallet={wallet} onRefreshWallet={fetchWallet} theme={theme} onToggleTheme={toggleTheme} />
                  </div>
                } />

                <Route path="/portfolio" element={<Navigate to="/portfolio/positions" replace />} />
                <Route path="/portfolio/positions" element={
                  <div className="max-w-lg mx-auto p-3 pb-24">
                    <OrdersPositionsView token={token} initialTab="POSITIONS" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                  </div>
                } />
                <Route path="/portfolio/orders" element={
                  <div className="max-w-lg mx-auto p-3 pb-24">
                    <OrdersPositionsView token={token} initialTab="ORDERS" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                  </div>
                } />
                <Route path="/portfolio/history" element={
                  <div className="max-w-lg mx-auto p-3 pb-24">
                    <OrdersPositionsView token={token} initialTab="TRADE_HISTORY" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                  </div>
                } />
                <Route path="/portfolio/holdings" element={
                  <div className="max-w-lg mx-auto p-3 pb-24">
                    <PortfolioHoldingsAnalyticsView token={token || ''} wallet={wallet} riskRestriction={user?.riskRestriction} onRefreshWallet={fetchWallet} initialTab="HOLDINGS" />
                  </div>
                } />
                <Route path="/portfolio/analytics" element={
                  <div className="max-w-lg mx-auto p-3 pb-24">
                    <PortfolioHoldingsAnalyticsView token={token || ''} wallet={wallet} riskRestriction={user?.riskRestriction} onRefreshWallet={fetchWallet} initialTab="ANALYTICS" />
                  </div>
                } />
                <Route path="/portfolio/journal" element={
                  <div className="max-w-lg mx-auto p-3 pb-24">
                    <TradingJournalView token={token || ''} />
                  </div>
                } />

                <Route path="/option-chain" element={
                  <div className="max-w-2xl mx-auto p-2 pb-24">
                    <OptionChainView token={token} onRefreshWallet={fetchWallet} riskRestriction={user?.riskRestriction} />
                  </div>
                } />

                <Route path="/watchlist" element={
                  <div className="max-w-lg mx-auto p-3 pb-24">
                    <GrowwWatchlistView
                      token={token || ''}
                      onRefreshWallet={fetchWallet}
                      onSelectSymbolForTerminal={(symbol, chartToken, exchange) => navigate(`/terminal?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(chartToken)}&exchange=${encodeURIComponent(exchange)}`)}
                      riskRestriction={user?.riskRestriction}
                    />
                  </div>
                } />

                <Route path="/admin/*" element={
                  <div className="max-w-4xl mx-auto p-2 pb-24">
                    {isStaffUser(user.role) ? (
                      <AdminPanel token={token} theme={theme} onToggleTheme={toggleTheme} />
                    ) : (
                      <div className="p-4 text-center text-xs text-rose-500 font-bold bg-rose-500/10 rounded-xl border border-rose-500/20 my-8">
                        Admin access restricted to authorized staff accounts.
                      </div>
                    )}
                  </div>
                } />

                <Route path="/profile" element={<Navigate to="/profile/account" replace />} />
                <Route path="/profile/:tab" element={
                  <div className="max-w-lg mx-auto p-3 pb-24">
                    <ProfilePage user={user} wallet={wallet} token={token} theme={theme} onToggleTheme={toggleTheme} onLogout={onLogout} onRefreshWallet={fetchWallet} />
                  </div>
                } />

                <Route path="/register" element={<Navigate to="/" replace />} />
                <Route path="/signup" element={<Navigate to="/" replace />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>

          <OrderPreviewModal
            isOpen={isMobileOrderModalOpen}
            onClose={() => setIsMobileOrderModalOpen(false)}
            onConfirm={() => fetchWallet()}
            details={mobileOrderDetails}
            userToken={token || ''}
            sideEditable
            riskRestriction={user?.riskRestriction}
          />

          {mobileWatchlistChart && (
            <MobileChartModal
              isOpen={Boolean(mobileWatchlistChart)}
              onClose={() => setMobileWatchlistChart(null)}
              symbol={mobileWatchlistChart.symbol}
              token={mobileWatchlistChart.token}
              exchange={mobileWatchlistChart.exchange}
              theme={theme}
              onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')}
              onOpenOrderModal={(side, price) => openMobileQuickOrder({ symbol: mobileWatchlistChart.symbol, exchange: mobileWatchlistChart.exchange, token: mobileWatchlistChart.token, price, side })}
            />
          )}

          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            userRole={user?.role}
            onSelectSymbol={(selectedToken, selectedSymbol) => {
              navigate(`/terminal?symbol=${encodeURIComponent(selectedSymbol)}&token=${encodeURIComponent(selectedToken)}`);
            }}
            onSelectTab={() => {}}
          />

          <OnboardingWizard
            isOpen={isOnboardingOpen}
            onClose={() => {
              if (user) localStorage.setItem('onboarding_dismissed_' + user.id, 'true');
              setIsOnboardingOpen(false);
            }}
            user={user}
            token={token || ''}
            wallet={wallet}
            onRefreshWallet={fetchWallet}
          />

          <PWAInstallBanner />
        </div>
      </MarketSocketProvider>
    );
  }

  const isTerminalMode = location.pathname === '/terminal';

  return (
    <MarketSocketProvider userToken={token}>
      <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text-main)] flex flex-col font-sans">
        <AppShell
          user={user}
          token={token || ''}
          walletBalance={wallet?.cashBalance || 0}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenWalletModal={() => goToProfileTab('FUNDS')}
          isTerminalMode={isTerminalMode}
          onToggleTerminal={() => (isTerminalMode ? navigate(-1) : navigate('/terminal'))}
        />

        <main className="flex-1">
          <Suspense fallback={routeSuspenseFallback}>
            <Routes>
              <Route path="/terminal" element={<TerminalRoute token={token} wallet={wallet} onRefreshWallet={fetchWallet} theme={theme} onToggleTheme={toggleTheme} />} />

              <Route path="/" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <GrowwExploreView
                    token={token}
                    wallet={wallet}
                    onRefreshWallet={fetchWallet}
                    onSelectSymbol={(sym) => navigate(`/terminal?symbol=${encodeURIComponent(sym)}`)}
                    onOpenProfile={goToProfileTab}
                    onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')}
                    onOpenSearch={() => setIsSearchOpen(true)}
                    theme={theme}
                  />
                </div>
              } />

              <Route path="/watchlist" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <GrowwWatchlistView
                    token={token}
                    onRefreshWallet={fetchWallet}
                    onSelectSymbolForTerminal={(sym) => navigate(`/terminal?symbol=${encodeURIComponent(sym)}`)}
                    riskRestriction={user?.riskRestriction}
                  />
                </div>
              } />

              <Route path="/option-chain" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xs">
                    <OptionChainView token={token} onRefreshWallet={fetchWallet} riskRestriction={user?.riskRestriction} />
                  </div>
                </div>
              } />

              <Route path="/portfolio" element={<Navigate to="/portfolio/positions" replace />} />
              <Route path="/portfolio/positions" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <OrdersPositionsView token={token} initialTab="POSITIONS" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                </div>
              } />
              <Route path="/portfolio/orders" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <OrdersPositionsView token={token} initialTab="ORDERS" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                </div>
              } />
              <Route path="/portfolio/history" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <OrdersPositionsView token={token} initialTab="TRADE_HISTORY" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                </div>
              } />
              <Route path="/portfolio/holdings" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <PortfolioHoldingsAnalyticsView token={token || ''} wallet={wallet} riskRestriction={user?.riskRestriction} onRefreshWallet={fetchWallet} initialTab="HOLDINGS" />
                </div>
              } />
              <Route path="/portfolio/analytics" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <PortfolioHoldingsAnalyticsView token={token || ''} wallet={wallet} riskRestriction={user?.riskRestriction} onRefreshWallet={fetchWallet} initialTab="ANALYTICS" />
                </div>
              } />
              <Route path="/portfolio/journal" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <TradingJournalView token={token || ''} />
                </div>
              } />

              <Route path="/profile" element={<Navigate to="/profile/account" replace />} />
              <Route path="/profile/:tab" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  <ProfilePage user={user} wallet={wallet} token={token || ''} theme={theme} onToggleTheme={toggleTheme} onLogout={onLogout} onRefreshWallet={fetchWallet} />
                </div>
              } />

              <Route path="/admin/*" element={
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                  {isStaffUser(user.role) ? (
                    <AdminPanel token={token} theme={theme} onToggleTheme={toggleTheme} />
                  ) : (
                    <div className="bg-[var(--bg-surface)] border border-rose-500/30 rounded-2xl p-8 text-center max-w-lg mx-auto my-12 space-y-4 shadow-xl">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-extrabold text-[var(--text-main)]">Access Denied — Client Account</h3>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        The Admin Control Center is strictly restricted to administrative staff and broker management teams. Client accounts do not have permission to view system controls.
                      </p>
                      <button
                        onClick={() => navigate('/')}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-xl transition-colors shadow-md shadow-emerald-500/20"
                      >
                        Return to Trading Workspace
                      </button>
                    </div>
                  )}
                </div>
              } />

              <Route path="/register" element={<Navigate to="/" replace />} />
              <Route path="/signup" element={<Navigate to="/" replace />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          userRole={user?.role}
          onSelectSymbol={(selectedToken, selectedSymbol) => {
            navigate(`/terminal?symbol=${encodeURIComponent(selectedSymbol)}&token=${encodeURIComponent(selectedToken)}`);
          }}
          onSelectTab={(v) => navigate(SEARCH_TAB_TO_PATH[v] ?? '/')}
        />

        <OnboardingWizard
          isOpen={isOnboardingOpen}
          onClose={() => {
            if (user) localStorage.setItem('onboarding_dismissed_' + user.id, 'true');
            setIsOnboardingOpen(false);
          }}
          user={user}
          token={token || ''}
          wallet={wallet}
          onRefreshWallet={fetchWallet}
        />

        <PWAInstallBanner />
      </div>
    </MarketSocketProvider>
  );
}

function TerminalRoute(props: {
  token: string;
  wallet: Wallet | null;
  onRefreshWallet: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const [searchParams] = useSearchParams();
  const initialSymbol = searchParams.get('symbol') || 'RELIANCE';
  const initialToken = searchParams.get('token') || undefined;
  const initialExchange = (searchParams.get('exchange') as 'NSE' | 'BSE' | 'MCX' | null) || undefined;

  return (
    <GrowwTerminalView
      token={props.token}
      wallet={props.wallet}
      onRefreshWallet={props.onRefreshWallet}
      initialSymbol={initialSymbol}
      initialToken={initialToken}
      initialExchange={initialExchange}
      theme={props.theme}
      onToggleTheme={props.onToggleTheme}
    />
  );
}
