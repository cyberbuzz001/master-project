import React, { useState, useEffect } from 'react';
import { Key, Database, RefreshCw, Save, Download, Server, CheckCircle2, AlertTriangle, ShieldCheck, HardDrive, Layers, Globe, ExternalLink, KeyRound } from 'lucide-react';

interface MarketDataAdminProps {
  token: string;
}

export const MarketDataAdmin: React.FC<MarketDataAdminProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'DOWNLOADER'>('CONFIG');

  // Config State
  const [activeProvider, setActiveProvider] = useState<string>('DHAN');
  const [keys, setKeys] = useState({
    DHAN_CLIENT_ID: '1113019677',
    DHAN_ACCESS_TOKEN: '',
    DHAN_API_KEY: '21483ef7',
    DHAN_API_SECRET: 'e9730aa4-682c-4e75-a944-94f703449b09',
    FYERS_APP_ID: '',
    FYERS_SECRET_KEY: '',
    FYERS_ACCESS_TOKEN: '',
    FYERS_REDIRECT_URI: 'http://localhost:5000/api/v1/auth/fyers/callback',
    ANGELONE_API_KEY: '',
    ANGELONE_CLIENT_ID: '',
    ANGELONE_CLIENT_SECRET: '',
    ANGELONE_TOTP_SECRET: ''
  });

  const [authCodeInput, setAuthCodeInput] = useState<string>('');
  const [validatingFyersCode, setValidatingFyersCode] = useState<boolean>(false);
  const [configMessage, setConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Downloader State
  const [selectedTokens, setSelectedTokens] = useState<string[]>([
    'NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK'
  ]);
  const [customTokenInput, setCustomTokenInput] = useState<string>('');
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [count, setCount] = useState<number>(100);

  const [downloading, setDownloading] = useState(false);
  const [downloadResult, setDownloadResult] = useState<any | null>(null);

  // Storage Stats State
  const [stats, setStats] = useState<{
    totalCandles: number;
    storedSymbols: string[];
    timeframes: string[];
    earliestDate: string | null;
    latestDate: string | null;
    storageSizeMB: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/v1/admin/market-data/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActiveProvider(data.activeProvider);
        if (data.keys) {
          setKeys({
            DHAN_CLIENT_ID: data.keys.DHAN_CLIENT_ID || '1113019677',
            DHAN_ACCESS_TOKEN: data.keys.DHAN_ACCESS_TOKEN || '',
            DHAN_API_KEY: data.keys.DHAN_API_KEY || '21483ef7',
            DHAN_API_SECRET: data.keys.DHAN_API_SECRET || 'e9730aa4-682c-4e75-a944-94f703449b09',
            FYERS_APP_ID: data.keys.FYERS_APP_ID || '',
            FYERS_SECRET_KEY: data.keys.FYERS_SECRET_KEY || '',
            FYERS_ACCESS_TOKEN: data.keys.FYERS_ACCESS_TOKEN || '',
            FYERS_REDIRECT_URI: data.keys.FYERS_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/fyers/callback',
            ANGELONE_API_KEY: data.keys.ANGELONE_API_KEY || '',
            ANGELONE_CLIENT_ID: data.keys.ANGELONE_CLIENT_ID || '',
            ANGELONE_CLIENT_SECRET: data.keys.ANGELONE_CLIENT_SECRET || '',
            ANGELONE_TOTP_SECRET: data.keys.ANGELONE_TOTP_SECRET || ''
          });
        }
      }
    } catch (err: any) {
      console.error('Failed fetching market data config:', err);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/v1/admin/market-data/local-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed fetching storage stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, [token]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigMessage(null);
    setSavingConfig(true);

    try {
      const res = await fetch('/api/v1/admin/market-data/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          primaryProvider: activeProvider,
          keys
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigMessage({ type: 'success', text: data.message });
        fetchConfig();
      } else {
        setConfigMessage({ type: 'error', text: data.error?.message || 'Failed saving configuration' });
      }
    } catch (err: any) {
      setConfigMessage({ type: 'error', text: err.message });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenFyersLogin = async () => {
    if (!keys.FYERS_APP_ID) {
      setConfigMessage({ type: 'error', text: 'Please enter your Fyers App ID first.' });
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/broker/fyers-auth-url?appId=${encodeURIComponent(keys.FYERS_APP_ID)}&redirectUri=${encodeURIComponent(keys.FYERS_REDIRECT_URI)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.authUrl) {
        window.open(data.authUrl, '_blank');
      } else {
        setConfigMessage({ type: 'error', text: data.error?.message || 'Could not generate Fyers Auth URL.' });
      }
    } catch (err: any) {
      setConfigMessage({ type: 'error', text: err.message });
    }
  };

  const handleExchangeFyersCode = async () => {
    if (!authCodeInput.trim()) return;
    setValidatingFyersCode(true);
    setConfigMessage(null);

    try {
      const res = await fetch('/api/v1/admin/broker/fyers-validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          authCode: authCodeInput.trim(),
          appId: keys.FYERS_APP_ID,
          appSecret: keys.FYERS_SECRET_KEY
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigMessage({ type: 'success', text: data.message });
        setKeys(prev => ({ ...prev, FYERS_ACCESS_TOKEN: data.accessToken }));
        setAuthCodeInput('');
        fetchConfig();
      } else {
        setConfigMessage({ type: 'error', text: data.error?.message || 'Failed validating Fyers Auth Code' });
      }
    } catch (err: any) {
      setConfigMessage({ type: 'error', text: err.message });
    } finally {
      setValidatingFyersCode(false);
    }
  };

  const handleAddCustomToken = () => {
    if (!customTokenInput.trim()) return;
    const formatted = customTokenInput.trim().toUpperCase();
    if (!selectedTokens.includes(formatted)) {
      setSelectedTokens(prev => [...prev, formatted]);
    }
    setCustomTokenInput('');
  };

  const handleToggleToken = (tokenName: string) => {
    if (selectedTokens.includes(tokenName)) {
      setSelectedTokens(prev => prev.filter(t => t !== tokenName));
    } else {
      setSelectedTokens(prev => [...prev, tokenName]);
    }
  };

  const handleTriggerDownload = async () => {
    if (selectedTokens.length === 0) return;
    setDownloading(true);
    setDownloadResult(null);

    try {
      const res = await fetch('/api/v1/admin/market-data/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tokens: selectedTokens,
          timeframe,
          count
        })
      });
      const data = await res.json();
      if (data.success) {
        setDownloadResult(data.result);
        fetchStats();
      } else {
        setDownloadResult({ error: data.error?.message || 'Download failed' });
      }
    } catch (err: any) {
      setDownloadResult({ error: err.message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--text-main)]">
            <Key className="w-5 h-5 text-[var(--gogrow-blue)]" />
            Market Data API Keys & Local Storage
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Configure primary market data feed (Dhan HQ v2 / Fyers v3 / Angel One), manage API secrets, and sync local market cache.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-[var(--bg-surface-elevated)] p-1.5 rounded-xl border border-[var(--border-color)]">
          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'CONFIG' ? 'bg-[var(--gogrow-blue)] text-[var(--text-on-accent)] shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>API Keys & Primary Provider</span>
          </button>
          <button
            onClick={() => setActiveTab('DOWNLOADER')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'DOWNLOADER' ? 'bg-[var(--gogrow-blue)] text-[var(--text-on-accent)] shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Data Downloader & Local DB</span>
          </button>
        </div>
      </div>

      {/* TAB 1: API KEYS & PRIMARY PROVIDER */}
      {activeTab === 'CONFIG' && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          
          {/* Active Provider Selector */}
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--gogrow-blue)]" />
              Select Primary Market Data Provider
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: 'DHAN', name: 'Dhan HQ API v2', desc: 'Live Market Feed & High-Speed WebSocket', badge: 'Dhan Active' },
                { id: 'FYERS', name: 'Fyers API v3', desc: 'Live Market Feed, History & Data Sockets', badge: 'Fyers Active' },
                { id: 'ANGELONE', name: 'Angel One SmartAPI', desc: 'Indian Stock & Derivatives Broker Feed', badge: 'SmartAPI' },
                { id: 'MOCK_ENGINE', name: 'Mock Simulation Engine', desc: 'High-frequency Synthetic Data Engine', badge: 'Simulation' }
              ].map(p => (
                <div
                  key={p.id}
                  onClick={() => setActiveProvider(p.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    activeProvider === p.id
                      ? 'border-[var(--gogrow-blue)] bg-[var(--gogrow-blue-light)]/10 shadow-md'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)] hover:border-[var(--gogrow-blue)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-[var(--gogrow-blue)]/10 text-[var(--gogrow-blue)]">
                      {p.badge}
                    </span>
                    <input
                      type="radio"
                      name="primaryProvider"
                      checked={activeProvider === p.id}
                      onChange={() => setActiveProvider(p.id)}
                      aria-label={`Set ${p.name} as primary provider`}
                      className="accent-indigo-600"
                    />
                  </div>
                  <h4 className="font-bold text-sm text-[var(--text-main)] mt-2">{p.name}</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* API Key Credentials Settings */}
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--gogrow-blue)]" />
              API Keys & Authentication Secret Credentials
            </h3>

            {configMessage && (
              <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                configMessage.type === 'success' ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20' : 'bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/20'
              }`}>
                {configMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <span>{configMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Dhan HQ v2 Keys */}
              <div className="space-y-3 p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
                <h4 className="text-xs font-bold text-[var(--info)] uppercase tracking-wider flex items-center justify-between">
                  <span>Dhan HQ API v2 Credentials</span>
                  <span className="text-[10px] bg-[var(--info)]/10 text-[var(--info)] px-2 py-0.5 rounded font-extrabold">Active Broker Feed</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Dhan Client ID</label>
                    <input
                      type="text"
                      value={keys.DHAN_CLIENT_ID}
                      onChange={(e) => setKeys({ ...keys, DHAN_CLIENT_ID: e.target.value })}
                      placeholder="1113019677"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:outline-none focus:border-[var(--gogrow-blue)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">API Key</label>
                    <input
                      type="text"
                      value={keys.DHAN_API_KEY}
                      onChange={(e) => setKeys({ ...keys, DHAN_API_KEY: e.target.value })}
                      placeholder="21483ef7"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:outline-none focus:border-[var(--gogrow-blue)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Access Token (JWT)</label>
                  <input
                    type="password"
                    value={keys.DHAN_ACCESS_TOKEN}
                    onChange={(e) => setKeys({ ...keys, DHAN_ACCESS_TOKEN: e.target.value })}
                    placeholder="Paste JWT Access Token from Dhan Console"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:outline-none focus:border-[var(--gogrow-blue)] font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">API Secret</label>
                  <input
                    type="password"
                    value={keys.DHAN_API_SECRET}
                    onChange={(e) => setKeys({ ...keys, DHAN_API_SECRET: e.target.value })}
                    placeholder="e9730aa4-682c-4e75-a944-94f703449b09"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:outline-none focus:border-[var(--gogrow-blue)] font-mono"
                  />
                </div>
              </div>

              {/* Fyers API v3 Keys */}
              <div className="space-y-3 p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    <span>Fyers API v3 Credentials</span>
                  </h4>
                  <a
                    href="https://fyers.in/web/api-dashboard/user-apps"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[var(--primary)] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Fyers Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">App ID (Client ID)</label>
                    <input
                      type="text"
                      value={keys.FYERS_APP_ID}
                      onChange={(e) => setKeys({ ...keys, FYERS_APP_ID: e.target.value })}
                      placeholder="e.g. XC12345-100"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Secret Key</label>
                    <input
                      type="password"
                      value={keys.FYERS_SECRET_KEY}
                      onChange={(e) => setKeys({ ...keys, FYERS_SECRET_KEY: e.target.value })}
                      placeholder="Enter Fyers Secret Key"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Access Token (24hr)</label>
                  <input
                    type="password"
                    value={keys.FYERS_ACCESS_TOKEN}
                    onChange={(e) => setKeys({ ...keys, FYERS_ACCESS_TOKEN: e.target.value })}
                    placeholder="Paste Fyers Access Token or Generate Below"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] font-mono"
                  />
                </div>

                {/* Fyers OAuth Assistant */}
                <div className="pt-2 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenFyersLogin}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 text-xs font-bold hover:bg-[var(--primary-hover)]/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>1. Generate Auth Code</span>
                  </button>

                  <div className="flex-1 w-full flex items-center gap-2">
                    <input
                      type="text"
                      value={authCodeInput}
                      onChange={(e) => setAuthCodeInput(e.target.value)}
                      placeholder="Paste redirected auth_code here"
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleExchangeFyersCode}
                      disabled={validatingFyersCode || !authCodeInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--text-on-accent)] text-xs font-bold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-all flex items-center gap-1"
                    >
                      {validatingFyersCode ? <RefreshCw className="w-3 h-3 animate-spin" /> : <span>2. Get Token</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* AngelOne SmartAPI Credentials */}
              <div className="md:col-span-2 space-y-4 p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
                <h4 className="text-xs font-bold text-[var(--gogrow-blue)] uppercase tracking-wider">Angel One SmartAPI Broker Credentials</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">SmartAPI Key</label>
                    <input
                      type="password"
                      value={keys.ANGELONE_API_KEY}
                      onChange={(e) => setKeys({ ...keys, ANGELONE_API_KEY: e.target.value })}
                      placeholder="Angel One API Key"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--text-main)] font-mono focus:border-[var(--gogrow-blue)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Client ID / Code</label>
                    <input
                      type="text"
                      value={keys.ANGELONE_CLIENT_ID}
                      onChange={(e) => setKeys({ ...keys, ANGELONE_CLIENT_ID: e.target.value })}
                      placeholder="e.g. N89824"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--text-main)] font-mono focus:border-[var(--gogrow-blue)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Client Password / Secret</label>
                    <input
                      type="password"
                      value={keys.ANGELONE_CLIENT_SECRET}
                      onChange={(e) => setKeys({ ...keys, ANGELONE_CLIENT_SECRET: e.target.value })}
                      placeholder="Client Secret"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--text-main)] font-mono focus:border-[var(--gogrow-blue)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">TOTP Secret</label>
                    <input
                      type="password"
                      value={keys.ANGELONE_TOTP_SECRET}
                      onChange={(e) => setKeys({ ...keys, ANGELONE_TOTP_SECRET: e.target.value })}
                      placeholder="TOTP Secret Key"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--text-main)] font-mono focus:border-[var(--gogrow-blue)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={savingConfig}
                className="px-6 py-2.5 rounded-xl bg-[var(--gogrow-blue)] text-[var(--text-on-accent)] font-bold text-xs hover:bg-[var(--gogrow-blue)] shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Keys & Switch Primary Provider</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: LOCAL MARKET DATA DOWNLOADER & STORAGE */}
      {activeTab === 'DOWNLOADER' && (
        <div className="space-y-6">
          {/* Storage Dashboard Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="tg-stat-card">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
                <span>Total Stored Candles</span>
                <Database className="w-4 h-4 text-[var(--gogrow-blue)]" />
              </div>
              <div className="text-2xl font-extrabold text-[var(--text-main)] num-font mt-2">
                {stats ? stats.totalCandles.toLocaleString() : '0'}
              </div>
              <span className="text-[10px] text-[var(--primary)] font-semibold mt-1 inline-block">PostgreSQL Storage</span>
            </div>

            <div className="tg-stat-card">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
                <span>Stored Symbols</span>
                <Layers className="w-4 h-4 text-[var(--gogrow-blue)]" />
              </div>
              <div className="text-2xl font-extrabold text-[var(--text-main)] num-font mt-2">
                {stats ? stats.storedSymbols.length : '0'}
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] mt-1 inline-block">Unique Instruments</span>
            </div>

            <div className="tg-stat-card">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
                <span>Database Table Size</span>
                <HardDrive className="w-4 h-4 text-[var(--gogrow-blue)]" />
              </div>
              <div className="text-2xl font-extrabold text-[var(--text-main)] num-font mt-2">
                {stats ? `${stats.storageSizeMB.toFixed(2)} MB` : '0.00 MB'}
              </div>
              <span className="text-[10px] text-[var(--gogrow-blue)] font-semibold mt-1 inline-block">Indexed Storage</span>
            </div>

            <div className="tg-stat-card">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
                <span>Earliest / Latest Date</span>
                <Server className="w-4 h-4 text-[var(--gogrow-blue)]" />
              </div>
              <div className="text-xs font-bold text-[var(--text-main)] num-font mt-2 truncate">
                {stats?.latestDate ? new Date(stats.latestDate).toLocaleDateString() : 'No Data'}
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] mt-1 inline-block truncate">
                {stats?.earliestDate ? `From ${new Date(stats.earliestDate).toLocaleDateString()}` : 'Ready to sync'}
              </span>
            </div>
          </div>

          {/* Downloader Form */}
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2">
              <Download className="w-4 h-4 text-[var(--gogrow-blue)]" />
              Historical Market Data Downloader
            </h3>

            {/* Token Selector Badges */}
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">Select Target Instruments</label>
              <div className="flex flex-wrap gap-2">
                {['NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleToggleToken(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      selectedTokens.includes(t)
                        ? 'bg-[var(--gogrow-blue)] text-[var(--text-on-accent)] border-[var(--gogrow-blue)] shadow-sm'
                        : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--gogrow-blue)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Custom Token Adder */}
              <div className="flex items-center gap-2 mt-3 max-w-md">
                <input
                  type="text"
                  value={customTokenInput}
                  onChange={(e) => setCustomTokenInput(e.target.value)}
                  placeholder="Enter custom token (e.g. NSE_SBIN)"
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-main)] font-mono focus:border-[var(--gogrow-blue)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomToken}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-bold hover:bg-[var(--gogrow-blue)] hover:text-[var(--text-on-accent)] transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Timeframe & Candle Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Timeframe Interval</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-main)] font-semibold focus:border-[var(--gogrow-blue)] focus:outline-none"
                >
                  <option value="1m">1 Minute (1m)</option>
                  <option value="5m">5 Minutes (5m)</option>
                  <option value="15m">15 Minutes (15m)</option>
                  <option value="1h">1 Hour (1h)</option>
                  <option value="1D">1 Day (1D)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">Candles Count Per Instrument</label>
                <select
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-main)] font-semibold focus:border-[var(--gogrow-blue)] focus:outline-none"
                >
                  <option value={50}>50 Candles</option>
                  <option value={100}>100 Candles</option>
                  <option value={250}>250 Candles</option>
                  <option value={500}>500 Candles</option>
                  <option value={1000}>1,000 Candles</option>
                </select>
              </div>
            </div>

            {/* Execution Trigger */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border-light)]">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                Active Provider: <strong className="text-[var(--gogrow-blue)] font-mono">{activeProvider}</strong>
              </span>

              <button
                type="button"
                onClick={handleTriggerDownload}
                disabled={downloading || selectedTokens.length === 0}
                className="px-6 py-2.5 rounded-xl bg-[var(--gogrow-blue)] text-[var(--text-on-accent)] font-bold text-xs hover:bg-[var(--gogrow-blue)] shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Start Download & Save to Server DB</span>
              </button>
            </div>

            {/* Output Log */}
            {downloadResult && (
              <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-mono space-y-2">
                <div className="font-bold text-[var(--gogrow-blue)] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Execution Result Summary:
                </div>
                <pre className="text-[11px] text-[var(--text-main)] whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(downloadResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
