import React, { useEffect, useState } from 'react';
import { Smartphone, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Zap, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, Badge, Button } from './ui';

interface CTraderAccount {
  id: string;
  ctid_trader_account_id: string;
  trader_login: string;
  is_live: boolean;
  account_status: string;
  server_name: string;
  currency: string;
  leverage: number;
  balance: number;
}

interface CTraderIntegrationCardProps {
  token: string;
}

export const CTraderIntegrationCard: React.FC<CTraderIntegrationCardProps> = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [accounts, setAccounts] = useState<CTraderAccount[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check for OAuth return code or error in current URL
  useEffect(() => {
    fetchAccounts();
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const err = params.get('error');
    if (err) {
      setStatusMessage(`⚠️ Connection rejected or cancelled: ${decodeURIComponent(err)}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code) {
      handleOAuthCallback(code);
    }
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/integrations/ctrader/accounts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAccounts(data.data);
      }
    } catch (err: any) {
      console.warn('[cTrader] Error fetching accounts:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    setLoading(true);
    setStatusMessage('Exchanging authorization code with Spotware cTrader...');
    try {
      const res = await fetch('/api/v1/integrations/ctrader/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage('✅ cTrader account successfully connected!');
        // Clean URL params without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        await fetchAccounts();
      } else {
        setStatusMessage(`⚠️ Connection failed: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatusMessage(`⚠️ Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/v1/integrations/ctrader/auth-url', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data?.authUrl) {
        window.location.href = data.data.authUrl;
      } else {
        alert('Could not generate cTrader login link. Please ensure cTrader credentials are set.');
      }
    } catch (err: any) {
      alert(`Error starting cTrader link: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const isConnected = accounts.length > 0;

  return (
    <Card padding="none" className="p-4 sm:p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-color)] shadow-xs">
      <CardHeader className="pb-4 border-b border-[var(--border-color)] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-700 text-white flex items-center justify-center shadow-xs">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-bold">cTrader Terminal Integration</CardTitle>
              <Badge variant={isConnected ? 'gain' : 'neutral'}>
                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </Badge>
            </div>
            <p className="text-xs text-[var(--muted-color)] mt-0.5">
              Spotware Open API v2 · Official Mobile & Desktop App Mapping
            </p>
          </div>
        </div>
      </CardHeader>

      <div className="pt-4 space-y-4">
        {statusMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <p className="text-xs sm:text-sm text-[var(--text-color)] leading-relaxed">
          Link your TradeGrow account with <strong>Spotware cTrader</strong> to execute simulated trades directly through official <strong>cTrader iOS, Android, and Desktop apps</strong>. All orders, fills, and margins map two-way in real time.
        </p>

        {isConnected ? (
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--background-color)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted-color)] font-medium">Linked Account ID</span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {accounts[0].trader_login || `CT-${accounts[0].ctid_trader_account_id}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted-color)] font-medium">Server</span>
                <span className="text-xs font-semibold text-[var(--text-color)]">{accounts[0].server_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted-color)] font-medium">Trading Environment</span>
                <Badge variant={accounts[0].is_live ? 'loss' : 'info'}>
                  {accounts[0].is_live ? 'LIVE' : 'DEMO'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted-color)] font-medium">Protocol</span>
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> WebSocket Protobuf Active
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href="https://app.ctrader.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-xs"
              >
                <span>Launch cTrader Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <Button
                variant="secondary"
                size="sm"
                onClick={fetchAccounts}
                disabled={loading}
                className="text-xs font-medium"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Sync Status
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--background-color)] text-center space-y-3">
            <div className="max-w-md mx-auto space-y-1">
              <div className="text-xs sm:text-sm font-semibold text-[var(--text-color)]">
                Connect your cTrader ID (CTID)
              </div>
              <p className="text-xs text-[var(--muted-color)]">
                Authorize TradeGrow to mirror your virtual demo balance into the official cTrader terminal for mobile and desktop trading.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleConnect}
              disabled={connecting || loading}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm px-5 py-2.5 shadow-sm"
            >
              <Zap className="w-4 h-4 mr-2 text-cyan-200 fill-cyan-200" />
              {connecting ? 'Redirecting to cTrader...' : 'Connect cTrader (Spotware Open API)'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
