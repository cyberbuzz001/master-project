import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Search, Users, Bot } from 'lucide-react';
import { useMarketSocket, useAdminSubscribeAll } from '../../hooks/useMarketSocket';
import { AI_BOT_USER_ID } from '../../utils/supportBot';

interface LiveChatProps { token: string; }

interface Conversation {
  customer_id: string;
  username: string;
  email: string;
  client_id: string;
  last_message: string;
  last_message_at: string;
  last_sender_role: string;
  unread_count: number;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({ token }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const { onAdminEvent, sendChatMessage } = useMarketSocket();
  useAdminSubscribeAll();

  const fetchConversations = useCallback(() => {
    fetch('/api/v1/admin/chat/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setConversations(d.conversations); });
  }, [token]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const fetchMessages = useCallback((customerId: string) => {
    fetch(`/api/v1/admin/chat/${customerId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setMessages(d.messages); });
    fetch(`/api/v1/admin/chat/${customerId}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => fetchConversations());
  }, [token, fetchConversations]);

  useEffect(() => {
    if (selectedCustomerId) fetchMessages(selectedCustomerId);
  }, [selectedCustomerId, fetchMessages]);

  useEffect(() => {
    const unsub = onAdminEvent((event) => {
      const msg = event.data?.message as ChatMessage | undefined;
      if (!msg) return;
      // event.userId is the conversation's customer_id regardless of who sent the message
      if (event.userId === selectedCustomerId) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
      fetchConversations();
    }, 'CHAT_MESSAGE_RECEIVED');
    return unsub;
  }, [onAdminEvent, selectedCustomerId, fetchConversations]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim() || !selectedCustomerId) return;
    sendChatMessage(input.trim(), selectedCustomerId);
    setInput('');
  };

  const filtered = search
    ? conversations.filter(c => c.username?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const selectedConv = conversations.find(c => c.customer_id === selectedCustomerId);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--text-main)]">Live Chat</h2>
          <span className="text-[10px] text-[var(--text-muted)]">Real-time conversations with customers.</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        <div className="md:col-span-1 bg-[var(--bg-surface)]/80 border border-[var(--border-color)] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[var(--border-color)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-tertiary)]">
                <Users className="w-6 h-6 mx-auto mb-2" />
                <p className="text-xs">No conversations yet.</p>
              </div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.customer_id}
                  onClick={() => setSelectedCustomerId(c.customer_id)}
                  className={`w-full text-left px-3.5 py-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer ${selectedCustomerId === c.customer_id ? 'bg-[var(--bg-surface-elevated)]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-main)] truncate">{c.username}</span>
                    {c.unread_count > 0 && (
                      <span className="min-w-[16px] h-4 px-1 rounded-full bg-[var(--loss)] text-[var(--text-on-accent)] text-[9px] font-bold flex items-center justify-center">{c.unread_count}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                    {c.last_sender_role !== 'USER' && <span className="text-[var(--primary)] font-semibold">You: </span>}
                    {c.last_message}
                  </p>
                  <span className="text-[9px] text-[var(--text-tertiary)]">{new Date(c.last_message_at).toLocaleString('en-IN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="md:col-span-2 bg-[var(--bg-surface)]/80 border border-[var(--border-color)] rounded-xl flex flex-col overflow-hidden">
          {!selectedCustomerId ? (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <p className="text-xs text-[var(--text-tertiary)]">Select a conversation to view messages.</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <div className="text-sm font-bold text-[var(--text-main)]">{selectedConv?.username}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">{selectedConv?.email}</div>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[var(--bg-body)]">
                {messages.map(m => {
                  const isBot = m.sender_id === AI_BOT_USER_ID;
                  return (
                    <div key={m.id} className={`flex ${m.sender_role !== 'USER' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-xs ${
                        m.sender_role !== 'USER'
                          ? 'bg-[var(--primary)] text-[var(--text-on-accent)] rounded-br-sm'
                          : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] rounded-bl-sm'
                      }`}>
                        {isBot && (
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide opacity-80 mb-1">
                            <Bot className="w-3 h-3" />TradeGrow AI
                          </div>
                        )}
                        {m.message}
                        <div className="text-[9px] mt-1 opacity-70">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-[var(--border-color)] flex items-center gap-2">
                <input
                  type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Type a reply..."
                  className="flex-1 bg-[var(--bg-body)] border border-[var(--border-color)] rounded-full px-4 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-[var(--text-on-accent)] transition cursor-pointer"
                  aria-label="Send reply"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
