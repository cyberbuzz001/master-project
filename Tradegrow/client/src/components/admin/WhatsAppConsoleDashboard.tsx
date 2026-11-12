import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Search, Smartphone, Settings, RefreshCw, CheckCheck,
  Check, Clock, AlertCircle, Copy, ExternalLink, QrCode, Shield, CheckCircle2,
  Phone, User, X, ChevronRight, Zap, Sparkles, Filter
} from 'lucide-react';

interface WhatsAppConsoleProps {
  token?: string;
}

interface Conversation {
  jid: string;
  phone: string;
  name: string;
  profilePicUrl?: string | null;
  unreadCount: number;
  lastMessage: string;
  lastMessageDirection: 'INBOUND' | 'OUTBOUND';
  lastMessageTimestamp: number;
  provider: string;
  isGroup?: boolean;
}

interface ChatMessage {
  id: string;
  fromMe: boolean;
  direction: 'INBOUND' | 'OUTBOUND';
  senderName: string;
  phone: string;
  body: string;
  timestamp: number;
  status?: string;
  source?: string;
}

interface ProviderStatus {
  evolution: {
    state: string;
    instance?: string;
    ownerJid?: string;
    phoneNumber?: string;
    profileName?: string;
    counts?: { Message: number; Contact: number; Chat: number };
  };
  meta: {
    configured: boolean;
    phoneNumberId?: string;
    wabaId?: string;
    hasToken?: boolean;
    tokenMasked?: string;
    verifyToken?: string;
    webhookUrl?: string;
  };
  activeProvider: string;
  metrics?: {
    messagesSentToday: number;
    dailyWarmupLimit: number;
    warmupRemaining: number;
    optedOutCount: number;
  };
}

const CANNED_RESPONSES = [
  { label: 'Welcome & KYC', text: 'Hello! Welcome to TradeGrow. Complete your instant paperless KYC verification here to activate your account: https://tradegrowx.in/kyc\n\nReply directly to this message if you need assistance.' },
  { label: 'Live Options Link', text: 'Hi! You can access TradeGrow live streaming Option Chain & F&O terminal here: https://tradegrowx.in/option-chain' },
  { label: 'Margin / Funds Help', text: 'Hello! To manage your trading funds or deposit margin instantly via UPI / Netbanking, navigate to Profile → Funds in your terminal: https://tradegrowx.in/profile/funds' },
  { label: 'Support Followup', text: 'Our compliance & trading desk team has reviewed your query. How can we further assist you today?' },
  { label: 'Opt-Out Notice', text: 'You can reply STOP anytime to pause automated WhatsApp updates from TradeGrow.' },
];

export const WhatsAppConsoleDashboard: React.FC<WhatsAppConsoleProps> = ({ token }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CLIENTS' | 'UNREAD'>('ALL');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ base64?: string; pairingCode?: string } | null>(null);
  const [sendProvider, setSendProvider] = useState<'AUTO' | 'EVOLUTION_API' | 'META_CLOUD'>('AUTO');
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Meta Config Form State
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaVerifyToken, setMetaVerifyToken] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaActiveProvider, setMetaActiveProvider] = useState('EVOLUTION_API');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  // Notify Helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMsg({ type, text });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Fetch Providers Status
  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/warroom/whatsapp/providers', { headers: authHeaders });
      const data = await res.json();
      if (data.success && data.data) {
        setProviderStatus(data.data);
      }
    } catch (_) {}
  }, [token]);

  // Fetch Meta Config for Settings Modal
  const fetchMetaConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/warroom/whatsapp/meta-config', { headers: authHeaders });
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        setMetaPhoneId(d.phoneNumberId || '');
        setMetaWabaId(d.wabaId || '');
        setMetaVerifyToken(d.verifyToken || 'tradegrow_meta_secret_verify_token');
        setMetaActiveProvider(d.activeProvider || 'EVOLUTION_API');
      }
    } catch (_) {}
  }, [token]);

  // Fetch Conversations List
  const fetchConversations = useCallback(async (isInitial = false) => {
    if (isInitial) setLoadingChats(true);
    try {
      const res = await fetch('/api/v1/warroom/whatsapp/conversations', { headers: authHeaders });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setConversations(data.data);
      }
    } catch (e: any) {
      console.warn('Failed to load conversations:', e);
    } finally {
      if (isInitial) setLoadingChats(false);
    }
  }, [token]);

  // Fetch Message Thread for Active Contact
  const fetchMessages = useCallback(async (phone: string, isInitial = false) => {
    if (isInitial) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/v1/warroom/whatsapp/conversations/${encodeURIComponent(phone)}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMessages(data.data);
      }
    } catch (e: any) {
      console.warn('Failed to load messages for', phone, e);
    } finally {
      if (isInitial) setLoadingMessages(false);
    }
  }, [token]);

  // Initial Load
  useEffect(() => {
    fetchProviders();
    fetchConversations(true);
    fetchMetaConfig();
  }, [fetchProviders, fetchConversations, fetchMetaConfig]);

  // Polling intervals
  useEffect(() => {
    const convTimer = setInterval(() => {
      fetchConversations(false);
    }, 4500);

    const provTimer = setInterval(() => {
      fetchProviders();
    }, 15000);

    return () => {
      clearInterval(convTimer);
      clearInterval(provTimer);
    };
  }, [fetchConversations, fetchProviders]);

  // Message Polling when chat is selected
  useEffect(() => {
    if (!activePhone) return;
    fetchMessages(activePhone, true);

    const msgTimer = setInterval(() => {
      fetchMessages(activePhone, false);
    }, 3000);

    return () => clearInterval(msgTimer);
  }, [activePhone, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filter conversations
  useEffect(() => {
    let result = [...conversations];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.phone.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
      );
    }
    if (filterType === 'CLIENTS') {
      result = result.filter(c => !c.isGroup);
    } else if (filterType === 'UNREAD') {
      result = result.filter(c => c.unreadCount > 0);
    }
    setFilteredConversations(result);
  }, [conversations, search, filterType]);

  // Select active conversation
  const handleSelectChat = (phone: string) => {
    setActivePhone(phone);
  };

  // Send Direct Message
  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if (!textToSend.trim() || !activePhone || isSending) return;

    setIsSending(true);
    try {
      const body: any = { message: textToSend.trim(), senderName: 'TradeGrow Support' };
      if (sendProvider !== 'AUTO') {
        body.provider = sendProvider;
      }

      const res = await fetch(`/api/v1/warroom/whatsapp/conversations/${encodeURIComponent(activePhone)}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        if (!overrideText) setInputText('');
        showToast('Message sent to client on WhatsApp!', 'success');
        fetchMessages(activePhone, false);
        fetchConversations(false);
      } else {
        showToast(data.error?.message || 'Failed to dispatch WhatsApp message', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error sending message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Save Meta Configuration
  const handleSaveMetaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMeta(true);
    try {
      const payload: any = {
        phoneNumberId: metaPhoneId,
        wabaId: metaWabaId,
        verifyToken: metaVerifyToken,
        activeProvider: metaActiveProvider,
      };
      if (metaToken.trim()) payload.accessToken = metaToken.trim();
      if (metaAppSecret.trim()) payload.appSecret = metaAppSecret.trim();

      const res = await fetch('/api/v1/warroom/whatsapp/meta-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Meta WhatsApp credentials saved successfully!', 'success');
        setIsSettingsOpen(false);
        fetchProviders();
      } else {
        showToast(data.error?.message || 'Failed to save configuration', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving configuration', 'error');
    } finally {
      setIsSavingMeta(false);
    }
  };

  // Open QR Code Pairing
  const handleOpenQrModal = async () => {
    setIsQrModalOpen(true);
    try {
      const res = await fetch('/api/v1/warroom/whatsapp/qr', { headers: authHeaders });
      const data = await res.json();
      if (data.success && data.data) {
        setQrCodeData(data.data);
      }
    } catch (_) {}
  };

  const activeChat = conversations.find(c => c.phone === activePhone);

  const formatMessageTime = (ts: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatChatListTime = (ts: number) => {
    if (!ts) return '';
    const now = new Date();
    const date = new Date(ts);
    const isToday = now.toDateString() === date.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[600px] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
      {/* ── TOP HEADER / STATUS BAR ── */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-[var(--bg-surface-elevated)] border-b border-[var(--border-color)] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 flex-shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">
                WhatsApp Live Console
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                Live Messaging Hub
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Dual-Provider Engine: Evolution API & Meta Cloud API · Real-time client conversation viewer
            </p>
          </div>
        </div>

        {/* Provider Badges & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Evolution API Gateway Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              providerStatus?.evolution?.state === 'open'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            }`}
            title="Evolution API multi-device gateway on port 8080"
          >
            <span className={`w-2 h-2 rounded-full ${providerStatus?.evolution?.state === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>
              Evolution: {providerStatus?.evolution?.phoneNumber || '+91 95896 15649'}
            </span>
            {providerStatus?.evolution?.counts && (
              <span className="text-[10px] opacity-75 font-mono">
                ({providerStatus.evolution.counts.Chat} chats)
              </span>
            )}
          </div>

          {/* Meta Cloud API Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              providerStatus?.meta?.configured
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                : 'bg-slate-500/10 border-slate-500/30 text-[var(--text-muted)]'
            }`}
            title="Meta WhatsApp Cloud API (Graph API v21.0)"
          >
            <span className={`w-2 h-2 rounded-full ${providerStatus?.meta?.configured ? 'bg-blue-500' : 'bg-slate-400'}`} />
            <span>
              Meta API: {providerStatus?.meta?.configured ? 'Configured' : 'Setup Needed'}
            </span>
          </div>

          {/* QR Pairing Button */}
          <button
            onClick={handleOpenQrModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] transition-colors cursor-pointer"
            title="Connect / Pair WhatsApp via QR or Pair Code"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pair Device</span>
          </button>

          {/* Provider Settings Button */}
          <button
            onClick={() => { setIsSettingsOpen(true); fetchMetaConfig(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] transition-colors cursor-pointer"
            title="Configure Meta Cloud API & Gateway Tokens"
          >
            <Settings className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>API Settings</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => { fetchConversations(true); if (activePhone) fetchMessages(activePhone, true); }}
            className="p-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            title="Refresh All Chats"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {notificationMsg && (
        <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between border-b ${
          notificationMsg.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
        }`}>
          <span>{notificationMsg.text}</span>
          <button onClick={() => setNotificationMsg(null)} className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── MAIN 2-COLUMN VIEW (LEFT: CHAT LIST, RIGHT: ACTIVE CHAT CONVERSATION) ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL: CONVERSATIONS LIST ── */}
        <div className="w-full md:w-80 lg:w-96 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-surface)] flex-shrink-0">
          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-[var(--border-color)] space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by client name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl text-xs font-medium text-[var(--text-main)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-emerald-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 font-semibold text-[11px]">
              {(['ALL', 'CLIENTS', 'UNREAD'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`flex-1 py-1 rounded-lg text-center transition-colors cursor-pointer ${
                    filterType === t
                      ? 'bg-emerald-500/15 text-emerald-500 font-bold border border-emerald-500/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                  }`}
                >
                  {t === 'ALL' ? `All (${conversations.length})` : t === 'CLIENTS' ? 'Direct Chats' : 'Unread'}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-light)]">
            {loadingChats && conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                Loading WhatsApp conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                <Smartphone className="w-8 h-8 opacity-30 mx-auto mb-2" />
                <p className="font-bold">No conversations found</p>
                <p className="text-[10px] mt-1 opacity-70">
                  {search ? 'Try adjusting your search filter' : 'Client incoming messages will appear here live'}
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = activePhone === c.phone;
                return (
                  <button
                    key={c.phone || c.jid}
                    onClick={() => handleSelectChat(c.phone)}
                    className={`w-full text-left p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500'
                        : 'hover:bg-[var(--bg-surface-elevated)]'
                    }`}
                  >
                    {/* Contact Avatar */}
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs flex-shrink-0 relative">
                      {c.profilePicUrl ? (
                        <img src={c.profilePicUrl} alt={c.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{(c.name || c.phone || 'U').slice(0, 2).toUpperCase()}</span>
                      )}
                      {c.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white font-black text-[9px] flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Chat Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[var(--text-main)] truncate">
                          {c.name || c.phone}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
                          {formatChatListTime(c.lastMessageTimestamp)}
                        </span>
                      </div>

                      <div className="text-[10.5px] font-mono text-[var(--text-tertiary)] truncate">
                        {c.phone}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                        {c.lastMessageDirection === 'OUTBOUND' && (
                          <CheckCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        )}
                        <span className="truncate">{c.lastMessage || 'Message'}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: ACTIVE CONVERSATION THREAD & COMPOSER ── */}
        <div className="flex-1 flex flex-col bg-[var(--bg-surface-elevated)]/50">
          {activePhone && activeChat ? (
            <>
              {/* Active Chat Header */}
              <div className="px-5 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-color)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {activeChat.profilePicUrl ? (
                      <img src={activeChat.profilePicUrl} alt={activeChat.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span>{(activeChat.name || activeChat.phone).slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-[var(--text-main)]">
                        {activeChat.name || activeChat.phone}
                      </h3>
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 uppercase">
                        {activeChat.provider}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                      <span>{activeChat.phone}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(activeChat.phone); showToast('Copied phone number'); }}
                        className="hover:text-[var(--text-main)]"
                        title="Copy Phone Number"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendMessage('Hello! Your TradeGrow paperless KYC link is ready: https://tradegrowx.in/kyc\n\nLet us know if you need assistance completing it!')}
                    className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/25 text-xs font-bold transition-all cursor-pointer"
                    title="Send instant KYC link"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Send KYC Link</span>
                  </button>

                  <button
                    onClick={() => handleSendMessage('You can explore live option chain strikes and quotes anytime on our terminal: https://tradegrowx.in/option-chain')}
                    className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/25 text-xs font-bold transition-all cursor-pointer"
                    title="Send Option Chain link"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Send Terminal Link</span>
                  </button>
                </div>
              </div>

              {/* Message Bubbles Container */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[var(--bg-surface)]/30">
                {loadingMessages && messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Loading message history...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                    <MessageSquare className="w-10 h-10 opacity-20 mx-auto mb-2" />
                    <p className="font-bold text-sm">No messages in this chat yet</p>
                    <p className="text-[11px] mt-1 opacity-70">
                      Send a message below to start the conversation with this client.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isInbound = m.direction === 'INBOUND' || !m.fromMe;
                    return (
                      <div
                        key={m.id || idx}
                        className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-xs text-xs whitespace-pre-wrap ${
                            isInbound
                              ? 'bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] rounded-tl-xs'
                              : 'bg-emerald-600 text-white rounded-tr-xs'
                          }`}
                        >
                          {/* Sender name for group or client identification */}
                          {isInbound && m.senderName && (
                            <div className="text-[10px] font-black text-emerald-500 mb-1">
                              {m.senderName}
                            </div>
                          )}

                          <div className="leading-relaxed font-sans">{m.body}</div>

                          {/* Time & Delivery Status Ticks */}
                          <div
                            className={`flex items-center justify-end gap-1 text-[9.5px] mt-1 ${
                              isInbound ? 'text-[var(--text-tertiary)]' : 'text-emerald-100'
                            }`}
                          >
                            <span>{formatMessageTime(m.timestamp)}</span>
                            {!isInbound && (
                              <span>
                                {m.status === 'READ' ? (
                                  <span title="Read (Blue Ticks)"><CheckCheck className="w-3.5 h-3.5 text-blue-300" /></span>
                                ) : m.status === 'DELIVERED' ? (
                                  <span title="Delivered"><CheckCheck className="w-3.5 h-3.5 text-emerald-200" /></span>
                                ) : m.status === 'FAILED' ? (
                                  <span title="Failed"><AlertCircle className="w-3 h-3 text-rose-300" /></span>
                                ) : (
                                  <span title="Sent"><Check className="w-3 h-3 text-emerald-200" /></span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Footer */}
              <div className="p-3 bg-[var(--bg-surface)] border-t border-[var(--border-color)] space-y-2">
                {/* Canned Quick Templates Drawer */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                  <span className="font-bold text-[var(--text-tertiary)] uppercase flex items-center gap-0.5 flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Templates:
                  </span>
                  {CANNED_RESPONSES.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setInputText(r.text)}
                      className="px-2 py-0.5 rounded-md bg-[var(--bg-surface-elevated)] hover:bg-emerald-500/15 hover:text-emerald-500 border border-[var(--border-color)] text-[var(--text-muted)] whitespace-nowrap transition-colors cursor-pointer"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* Textbox & Send Button */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="flex items-end gap-2"
                >
                  <div className="flex-1 relative">
                    <textarea
                      rows={2}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={`Reply to ${activeChat.name || activeChat.phone} on WhatsApp (Enter to send, Shift+Enter for new line)...`}
                      className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl text-xs font-medium text-[var(--text-main)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  {/* Provider Choice */}
                  <select
                    value={sendProvider}
                    onChange={(e: any) => setSendProvider(e.target.value)}
                    className="hidden sm:block text-[10px] font-bold py-2 px-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] focus:outline-none"
                    title="Select outgoing provider"
                  >
                    <option value="AUTO">Auto Provider</option>
                    <option value="EVOLUTION_API">Evolution API</option>
                    <option value="META_CLOUD">Meta Cloud API</option>
                  </select>

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                    title="Send WhatsApp Message"
                  >
                    {isSending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 flex items-center justify-center mb-4">
                <Smartphone className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-base text-[var(--text-main)]">
                Select a WhatsApp Conversation
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1">
                Choose any client from the left pane to view inbound client messages, full chat history, and send live WhatsApp replies.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: SETTINGS & META CLOUD API CREDENTIALS ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)]">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-sm text-[var(--text-main)]">
                  WhatsApp Providers & Meta Cloud API Settings
                </h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMetaConfig} className="p-5 space-y-4 text-xs">
              {/* Webhook Configuration Guide */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Meta Cloud Webhook Endpoint
                </div>
                <p className="text-[11px] leading-relaxed text-blue-300">
                  Configure this Webhook in your Meta App Dashboard (<strong>WhatsApp &gt; Configuration &gt; Callback URL</strong>):
                </p>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded font-mono text-[11px] text-white">
                  <span>https://tradegrowx.in/api/v1/webhooks/whatsapp</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://tradegrowx.in/api/v1/webhooks/whatsapp');
                      showToast('Webhook URL copied!');
                    }}
                    className="hover:text-emerald-400"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Outbound Provider Selector */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Primary Outbound Gateway
                </label>
                <select
                  value={metaActiveProvider}
                  onChange={(e) => setMetaActiveProvider(e.target.value)}
                  className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl font-bold text-xs text-[var(--text-main)]"
                >
                  <option value="EVOLUTION_API">Evolution API (Baileys Local Gateway - Port 8080)</option>
                  <option value="META_CLOUD">Meta WhatsApp Cloud API (Graph API)</option>
                </select>
              </div>

              {/* Meta Phone Number ID */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Meta Phone Number ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1065790192958102"
                  value={metaPhoneId}
                  onChange={(e) => setMetaPhoneId(e.target.value)}
                  className="w-full p-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl font-mono text-xs text-[var(--text-main)]"
                />
              </div>

              {/* Meta Business Account ID (WABA) */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  WhatsApp Business Account ID (WABA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1098234857291823"
                  value={metaWabaId}
                  onChange={(e) => setMetaWabaId(e.target.value)}
                  className="w-full p-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl font-mono text-xs text-[var(--text-main)]"
                />
              </div>

              {/* Meta Access Token */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  System User / Permanent Access Token
                </label>
                <input
                  type="password"
                  placeholder={providerStatus?.meta?.hasToken ? `Current token: ${providerStatus.meta.tokenMasked}` : 'Paste EAAB... access token'}
                  value={metaToken}
                  onChange={(e) => setMetaToken(e.target.value)}
                  className="w-full p-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl font-mono text-xs text-[var(--text-main)]"
                />
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                  Leave blank to retain current token. Generated under Meta Business Manager &gt; System Users.
                </p>
              </div>

              {/* Meta Webhook Verify Token */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Webhook Verify Token (Secret Challenge)
                </label>
                <input
                  type="text"
                  value={metaVerifyToken}
                  onChange={(e) => setMetaVerifyToken(e.target.value)}
                  className="w-full p-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl font-mono text-xs text-[var(--text-main)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMeta}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingMeta ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: QR CODE PAIRING ── */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden p-5 text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[var(--text-main)]">
                Link WhatsApp Device (Evolution API)
              </h3>
              <button onClick={() => setIsQrModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Scan this QR code in WhatsApp on your mobile phone (<strong>Linked Devices &gt; Link a Device</strong>):
            </p>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
              {qrCodeData?.base64 ? (
                <img src={qrCodeData.base64} alt="WhatsApp QR Code" className="w-56 h-56 mx-auto object-contain" />
              ) : (
                <div className="w-56 h-56 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                  <span>Connecting to WhatsApp gateway...</span>
                </div>
              )}
            </div>

            {qrCodeData?.pairingCode && (
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs">
                <span className="text-[var(--text-muted)]">Or enter 8-digit Pairing Code: </span>
                <strong className="font-mono text-emerald-500 font-bold tracking-wider">{qrCodeData.pairingCode}</strong>
              </div>
            )}

            <div className="flex justify-center gap-2">
              <button
                onClick={handleOpenQrModal}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload QR
              </button>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-main)] font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
