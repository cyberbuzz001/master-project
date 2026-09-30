import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { useMarketSocket } from '../hooks/useMarketSocket';
import { AI_BOT_USER_ID } from '../utils/supportBot';

interface ChatWidgetProps { token: string; }

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

/**
 * Customer-facing live-chat widget — Support Chats, the last of the four deferred
 * items from Phase F1's gap analysis. A floating bubble in the corner of every
 * client-panel page, distinct from the async ticketing system under Profile.
 */
export const ChatWidget: React.FC<ChatWidgetProps> = ({ token }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { onAdminEvent, sendChatMessage } = useMarketSocket();

  const fetchHistory = useCallback(() => {
    fetch('/api/v1/chat/messages', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setMessages(d.messages); })
      .catch(() => {});
  }, [token]);

  useEffect(() => { if (token) fetchHistory(); }, [token, fetchHistory]);

  useEffect(() => {
    const unsub = onAdminEvent((event) => {
      const msg = event.data?.message as ChatMessage | undefined;
      if (!msg) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      if (!open && msg.sender_role !== 'USER') setUnread(u => u + 1);
    }, 'CHAT_MESSAGE_RECEIVED');
    return unsub;
  }, [onAdminEvent, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [open, messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChatMessage(input.trim());
    setInput('');
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40">
      {open && (
        <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm h-[420px] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--primary)] text-[var(--text-on-accent)]">
            <div>
              <div className="text-sm font-bold">Chat with Support</div>
              <div className="text-[10px] opacity-80">Instant AI answers, our team can jump in anytime</div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition cursor-pointer" aria-label="Close chat">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--bg-body)]">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center px-6">
                <p className="text-xs text-[var(--text-tertiary)]">Send a message and our support team will respond here in real time.</p>
              </div>
            ) : (
              messages.map(m => {
                const isBot = m.sender_id === AI_BOT_USER_ID;
                return (
                  <div key={m.id} className={`flex ${m.sender_role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs ${
                      m.sender_role === 'USER'
                        ? 'bg-[var(--primary)] text-[var(--text-on-accent)] rounded-br-sm'
                        : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] rounded-bl-sm'
                    }`}>
                      {isBot && (
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide opacity-70 mb-1">
                          <Bot className="w-3 h-3" />TradeGrow AI
                        </div>
                      )}
                      {m.message}
                      <div className={`text-[9px] mt-1 opacity-70`}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2.5 border-t border-[var(--border-color)] flex items-center gap-2 bg-[var(--bg-surface)]">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type a message..."
              className="flex-1 bg-[var(--bg-body)] border border-[var(--border-color)] rounded-full px-4 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-[var(--text-on-accent)] transition cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-14 h-14 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-accent)] shadow-lg flex items-center justify-center transition cursor-pointer"
        aria-label={open ? 'Close support chat' : 'Open support chat'}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[var(--loss)] text-[var(--text-on-accent)] text-[11px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
};
