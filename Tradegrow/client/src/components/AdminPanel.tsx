import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FileCheck, Activity, ShieldAlert, Power,
  Wifi, DollarSign, BookOpen, Server, FileText, ChevronLeft, ChevronRight,
  Sun, Moon, LifeBuoy, Shield, MessageCircle, ChevronDown, HelpCircle, X, Command
} from 'lucide-react';
import { AdminDashboard } from './admin/AdminDashboard';
import { CustomerList } from './admin/CustomerList';
import { Customer360 } from './admin/Customer360';
import { KYCQueue } from './admin/KYCQueue';
import { OrderMonitor } from './admin/OrderMonitor';
import { RiskCommandCenter } from './admin/RiskCommandCenter';
import { KillSwitch } from './admin/KillSwitch';
import { BrokerHealth } from './admin/BrokerHealth';
import { FundsDashboard } from './admin/FundsDashboard';
import { LedgerViewer } from './admin/LedgerViewer';
import { SystemMonitor } from './admin/SystemMonitor';
import { AuditLogViewer } from './admin/AuditLogViewer';
import { MarketDataAdmin } from './admin/MarketDataAdmin';
import { BankManagement } from './admin/BankManagement';
import { AdminNotificationBell } from './admin/AdminNotificationBell';
import { useMarketSocket } from '../hooks/useMarketSocket';
import { PermissionsDashboard } from './admin/PermissionsDashboard';
import { SupportTickets } from './admin/SupportTickets';
import { ManagerManagement } from './admin/ManagerManagement';
import { LiveChat } from './admin/LiveChat';
import { NotificationSoundAdmin } from './admin/NotificationSoundAdmin';
import { EmailAdmin } from './admin/EmailAdmin';
import { WarRoomDashboard } from './admin/WarRoomDashboard';
import { StaffDeskSwitcher } from './admin/StaffDeskSwitcher';
import { QrCode as QrCodeIcon, ShieldCheck, Landmark, Volume2, Mail, Target } from 'lucide-react';

interface AdminPanelProps {
  token: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

type AdminPage =
  | 'WAR_ROOM' | 'DASHBOARD' | 'CUSTOMERS' | 'CUSTOMER_360' | 'PERMISSIONS' | 'KYC' | 'ORDERS'
  | 'RISK' | 'KILL_SWITCH' | 'BROKER' | 'FUNDS' | 'BANK_MANAGEMENT' | 'LEDGER' | 'SYSTEM' | 'AUDIT' | 'MARKET_DATA' | 'SUPPORT' | 'MANAGERS' | 'LIVE_CHAT' | 'SOUND_ADMIN' | 'EMAIL_ADMIN';

interface NavItem {
  key: AdminPage;
  label: string;
  icon: React.ReactNode;
  section: string;
  badge?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ token, theme, onToggleTheme }) => {
  const [activePage, setActivePage] = useState<AdminPage>('DASHBOARD');
  const [collapsed, setCollapsed] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { status: socketStatus } = useMarketSocket();
  const isLive = socketStatus === 'CONNECTED';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If pressing '?' without typing in an input
      if (
        (e.key === '?' || (e.shiftKey && e.key === '/')) &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const navItems: NavItem[] = [
    // Top: Executive Dashboard (OVERVIEW)
    { key: 'WAR_ROOM', label: '1,000 Users War Room', icon: <Target className="w-4 h-4 text-emerald-400" />, section: 'OVERVIEW', badge: 'GROWTH' },
    { key: 'DASHBOARD', label: 'Executive Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, section: 'OVERVIEW' },

    // DAILY OPERATIONS (Always expanded)
    { key: 'CUSTOMERS', label: 'Customers', icon: <Users className="w-4 h-4" />, section: 'DAILY OPERATIONS' },
    { key: 'ORDERS', label: 'Order Monitor', icon: <Activity className="w-4 h-4" />, section: 'DAILY OPERATIONS' },
    { key: 'KYC', label: 'KYC Queue', icon: <FileCheck className="w-4 h-4" />, section: 'DAILY OPERATIONS' },
    { key: 'FUNDS', label: 'Funds Overview', icon: <DollarSign className="w-4 h-4" />, section: 'DAILY OPERATIONS' },
    { key: 'LEDGER', label: 'Ledger Viewer', icon: <BookOpen className="w-4 h-4" />, section: 'DAILY OPERATIONS' },
    { key: 'LIVE_CHAT', label: 'Live Chat', icon: <MessageCircle className="w-4 h-4" />, section: 'DAILY OPERATIONS' },
    { key: 'SUPPORT', label: 'Support Tickets', icon: <LifeBuoy className="w-4 h-4" />, section: 'DAILY OPERATIONS' },

    // Category groupings (Collapsed by default)
    { key: 'PERMISSIONS', label: 'Roles & Permissions', icon: <ShieldCheck className="w-4 h-4 text-blue-400" />, section: 'OPERATIONS', badge: 'RBAC' },
    { key: 'MANAGERS', label: 'Manager Management', icon: <Shield className="w-4 h-4" />, section: 'OPERATIONS' },
    { key: 'RISK', label: 'Risk Command Center', icon: <ShieldAlert className="w-4 h-4" />, section: 'RISK' },
    { key: 'KILL_SWITCH', label: 'Kill Switch', icon: <Power className="w-4 h-4" />, section: 'RISK', badge: '⚠' },
    { key: 'BROKER', label: 'Broker Health', icon: <Wifi className="w-4 h-4" />, section: 'TECHNOLOGY' },
    { key: 'MARKET_DATA', label: 'API Keys & Storage', icon: <Server className="w-4 h-4" />, section: 'TECHNOLOGY' },
    { key: 'SYSTEM', label: 'System Monitor', icon: <Server className="w-4 h-4" />, section: 'TECHNOLOGY' },
    { key: 'SOUND_ADMIN', label: 'Sound & Audio Policies', icon: <Volume2 className="w-4 h-4 text-purple-400" />, section: 'TECHNOLOGY' },
    { key: 'EMAIL_ADMIN', label: 'Email & Notifications', icon: <Mail className="w-4 h-4 text-emerald-400" />, section: 'TECHNOLOGY', badge: 'HOSTINGER' },
    { key: 'BANK_MANAGEMENT', label: 'Bank & UPI Settings', icon: <Landmark className="w-4 h-4 text-emerald-400" />, section: 'FINANCE' },
    { key: 'AUDIT', label: 'Audit Logs', icon: <FileText className="w-4 h-4" />, section: 'COMPLIANCE' },
  ];

  const sections = ['OVERVIEW', 'DAILY OPERATIONS', 'OPERATIONS', 'RISK', 'TECHNOLOGY', 'FINANCE', 'COMPLIANCE'];

  const [initialCustomerFilter, setInitialCustomerFilter] = useState<string>('');

  const handleNavigate = (page: AdminPage, filter?: string) => {
    if (filter !== undefined) {
      setInitialCustomerFilter(filter);
    }
    setActivePage(page);
  };

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    setActivePage('CUSTOMER_360');
  };

  const handleBackFromCustomer = () => {
    setSelectedCustomerId(null);
    setActivePage('CUSTOMERS');
  };

  const renderContent = () => {
    switch (activePage) {
      case 'WAR_ROOM': return <WarRoomDashboard token={token} />;
      case 'DASHBOARD': return <AdminDashboard token={token} onNavigate={handleNavigate} />;
      case 'CUSTOMERS': return <CustomerList token={token} initialFilter={initialCustomerFilter} onSelectCustomer={handleSelectCustomer} />;
      case 'CUSTOMER_360': return selectedCustomerId ? <Customer360 token={token} customerId={selectedCustomerId} onBack={handleBackFromCustomer} /> : null;
      case 'PERMISSIONS': return <PermissionsDashboard token={token} />;
      case 'KYC': return <KYCQueue token={token} onOpenCustomer360={handleSelectCustomer} />;
      case 'SUPPORT': return <SupportTickets token={token} onOpenCustomer360={handleSelectCustomer} />;
      case 'LIVE_CHAT': return <LiveChat token={token} />;
      case 'MANAGERS': return <ManagerManagement token={token} />;
      case 'ORDERS': return <OrderMonitor token={token} onOpenCustomer360={handleSelectCustomer} />;
      case 'RISK': return <RiskCommandCenter token={token} onOpenCustomer360={handleSelectCustomer} />;
      case 'KILL_SWITCH': return <KillSwitch token={token} />;
      case 'BROKER': return <BrokerHealth token={token} />;
      case 'MARKET_DATA': return <MarketDataAdmin token={token} />;
      case 'SOUND_ADMIN': return <NotificationSoundAdmin token={token} />;
      case 'EMAIL_ADMIN': return <EmailAdmin token={token} />;
      case 'FUNDS': return <FundsDashboard token={token} />;
      case 'BANK_MANAGEMENT': return <BankManagement token={token} />;
      case 'LEDGER': return <LedgerViewer token={token} onOpenCustomer360={handleSelectCustomer} />;
      case 'SYSTEM': return <SystemMonitor token={token} />;
      case 'AUDIT': return <AuditLogViewer token={token} />;
      default: return <AdminDashboard token={token} onNavigate={handleNavigate} />;
    }
  };

  const currentLabel = navItems.find(n => n.key === activePage)?.label || 'Customer 360';

  return (
    <div className="flex flex-col md:flex-row h-full bg-[var(--bg-body)] overflow-hidden">

      {/* Mobile Top Navigation Pills Bar (< 768px) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto p-2 bg-[var(--bg-surface)] border-b border-[var(--border-color)] shrink-0">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setActivePage(item.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              activePage === item.key
                ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30'
                : 'text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop Sidebar Navigation (>= 768px) */}
      <div className={`hidden md:flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)] transition-all duration-[var(--duration-normal)] ${collapsed ? 'w-14' : 'w-56'}`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
          {!collapsed && (
            <div>
              <h2 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Admin Center
              </h2>
              <span className="text-[9px] text-[var(--text-muted)]">Brokerage Control Panel</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded hover:bg-[var(--bg-surface-elevated)]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto py-2">
          {sections.map(section => {
            const items = navItems.filter(n => n.section === section);
            if (items.length === 0) return null;
            const isAlwaysExpanded = section === 'OVERVIEW' || section === 'DAILY OPERATIONS';
            const isExpanded = isAlwaysExpanded || !!expandedSections[section];

            return (
              <div key={section} className="mb-1">
                {!collapsed && (
                  isAlwaysExpanded ? (
                    <span className="text-[9px] text-[var(--text-tertiary)] uppercase font-bold tracking-wider px-3 block mb-1 mt-2">
                      {section}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] text-[var(--text-tertiary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] uppercase font-bold tracking-wider transition-colors mb-0.5 mt-2 group text-left rounded"
                      aria-expanded={isExpanded}
                      title={`${isExpanded ? 'Collapse' : 'Expand'} ${section}`}
                    >
                      <span className="truncate">{section}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)] group-hover:text-[var(--text-main)] shrink-0 transition-transform" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] group-hover:text-[var(--text-main)] shrink-0 transition-transform" />
                      )}
                    </button>
                  )
                )}
                {isExpanded && items.map(item => (
                  <button key={item.key} onClick={() => setActivePage(item.key)}
                    title={item.label}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all ${
                      activePage === item.key
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] border-r-2 border-[var(--primary)] font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                    } ${collapsed ? 'justify-center px-0' : ''}`}>
                    {item.icon}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge && <span className="ml-auto text-[10px]">{item.badge}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        {!collapsed && (
          <div className="p-3 border-t border-[var(--border-color)]">
            <div className="text-[9px] text-[var(--text-tertiary)]">
              <span className="block">🔒 Core Trading Engine</span>
              <span className="block">Real Money: DISABLED</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div>
            <h1 className="text-xs md:text-sm font-bold text-[var(--text-main)]">{currentLabel}</h1>
            <span className="text-[9px] text-[var(--text-muted)] hidden sm:inline">Admin Control Center — Brokerage Operations</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]" title={isLive ? 'Real-time connection active' : 'Reconnecting to real-time feed…'}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[var(--gain)] animate-pulse' : 'bg-[var(--text-tertiary)]'}`} />
              <span>{isLive ? 'Live' : 'Connecting…'}</span>
            </div>
            <StaffDeskSwitcher token={token} />
            <AdminNotificationBell token={token} />
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              title="Keyboard Shortcuts (?)"
              aria-label="Keyboard Shortcuts"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">?</span>
            </button>
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-5">
          {renderContent()}
        </div>
      </div>

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-main)]">
                <Command className="w-4 h-4 text-[var(--primary)]" />
                <span>Admin Keyboard Shortcuts</span>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded-lg bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { keys: ['⌘', 'K'], desc: 'Open Command Palette & Global Search' },
                { keys: ['?'], desc: 'Toggle Keyboard Shortcuts cheatsheet' },
                { keys: ['Esc'], desc: 'Close any active modal or drawer' },
              ].map((sc, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                  <span className="text-[var(--text-muted)] font-medium">{sc.desc}</span>
                  <div className="flex items-center gap-1">
                    {sc.keys.map((k, kIdx) => (
                      <kbd key={kIdx} className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] font-mono font-bold text-[11px] text-[var(--text-main)] shadow-xs">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center text-[10px] text-[var(--text-muted)] font-mono">
              TradeGrow Brokerage Operations Console
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
