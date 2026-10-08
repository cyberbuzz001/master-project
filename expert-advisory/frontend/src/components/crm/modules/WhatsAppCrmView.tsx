"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Send,
  FileText,
  CreditCard,
  CheckCheck,
  Paperclip,
  Clock,
  Sparkles,
  ShieldCheck,
  User,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import type { CrmLead } from "@/lib/crm-data";

interface WhatsAppCrmViewProps {
  leads: CrmLead[];
}

const TEMPLATES = [
  { id: "welcome", title: "Official Welcome & Investor Charter", body: "Hello {{name}}, welcome to Expert Stocks Consultancy. As a SEBI Registered Research Analyst firm, we are pleased to assist your investment journey. Download our Investor Charter here: https://expertstocks.in/trust-center" },
  { id: "options_plan", title: "Index Options Alpha Brochure", body: "Hello {{name}}, here is the complete service schedule and risk management guidelines for our Index Options Alpha Desk. Strictly 1:2 Risk-Reward setups with predefined stop-losses." },
  { id: "payment_link", title: "Razorpay Secure Payment Link", body: "Hello {{name}}, your subscription invoice #ESC-INV-2026-0845 is generated. Pay securely with GST input credit here: https://expertstocks.in/pay/esc-0845" },
  { id: "renewal", title: "Subscription Renewal Notice", body: "Hello {{name}}, your advisory subscription expires in 7 days. To maintain uninterrupted recommendation access on the terminal, click here to renew." },
];

export function WhatsAppCrmView({ leads }: WhatsAppCrmViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || "");
  const [messageText, setMessageText] = useState("");
  const [chatHistory, setChatHistory] = useState<Record<string, Array<{ text: string; sender: "rep" | "client"; time: string }>>>({
    "TG-LD-901": [
      { text: "Hello Harish! Thank you for inquiring about our Index Options desk.", sender: "rep", time: "11:20 AM" },
      { text: "Hi, I wanted to know the average holding period and stop-loss rules.", sender: "client", time: "11:25 AM" },
      { text: "Our options setups are strictly intraday or 1-2 day positional with max 30-40 pt SL.", sender: "rep", time: "11:28 AM" },
    ],
  });

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || leads[0];
  const messages = chatHistory[selectedLead?.id || ""] || [];

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedLead) return;
    const newMsg = { text: messageText.trim(), sender: "rep" as const, time: "Just now" };
    setChatHistory((prev) => ({
      ...prev,
      [selectedLead.id]: [...(prev[selectedLead.id] || []), newMsg],
    }));
    setMessageText("");
  };

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[number]) => {
    if (!selectedLead) return;
    const personalized = tmpl.body.replace("{{name}}", selectedLead.name);
    setMessageText(personalized);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Meta WhatsApp Cloud API Integration
            </h1>
            <span className="rounded-full bg-[#22C55E]/15 text-[#22C55E] text-xs font-mono px-3 py-1 border border-[#22C55E]/30 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span>OFFICIAL CLOUD API ONLINE</span>
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Compliant 1-to-1 client messaging, pre-approved SEBI templates, document sharing, and instant payment links.
          </p>
        </div>
      </div>

      {/* Main WhatsApp Split View */}
      <div className="grid gap-6 lg:grid-cols-12 rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-2xl min-h-[640px]">
        {/* Left Column: Client Chats List (4 cols) */}
        <div className="lg:col-span-4 border-r border-[#1E293B] bg-[#0B121E] flex flex-col">
          <div className="p-4 border-b border-[#1E293B] bg-[#0E1624]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Active WhatsApp Threads
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#1E293B]/60">
            {leads.map((l) => {
              const isSelected = selectedLead?.id === l.id;
              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedLeadId(l.id)}
                  className={cx(
                    "p-3.5 hover:bg-[#162235] transition-colors cursor-pointer space-y-1",
                    isSelected ? "bg-[#162235] border-l-4 border-l-[#22C55E]" : ""
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{l.name}</span>
                    <span className="font-mono text-[10px] text-ink-400">Today</span>
                  </div>
                  <p className="text-[11px] text-ink-400 truncate">{l.mobile} • {l.preferredService}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Chat Window & Template Bar (8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-[#070B12]">
          {selectedLead && (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>{selectedLead.name}</span>
                    <span className="font-mono text-xs text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">
                      {selectedLead.mobile}
                    </span>
                  </h3>
                  <p className="text-[11px] text-ink-400 mt-0.5 font-mono">
                    DPDPA Consent: Granted • Ref: {selectedLead.id}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ink-400">
                  <ShieldCheck className="size-4 text-[#22C55E]" />
                  <span>Meta Verified Business</span>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:16px_16px]">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-ink-400 italic">
                    No WhatsApp messages in this thread yet. Send a pre-approved template below.
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={cx(
                        "flex flex-col max-w-md rounded-2xl p-3 text-xs leading-relaxed shadow-sm",
                        m.sender === "rep"
                          ? "ml-auto bg-[#0A3D28] text-white border border-[#166534]"
                          : "mr-auto bg-[#162235] text-white border border-[#23354E]"
                      )}
                    >
                      <p>{m.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] font-mono text-ink-300">
                        <span>{m.time}</span>
                        {m.sender === "rep" && <CheckCheck className="size-3 text-[#22C55E]" />}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Template Quick Selection Bar */}
              <div className="p-3 border-t border-[#1E293B] bg-[#0B121E] space-y-2">
                <div className="flex items-center gap-2 overflow-x-auto text-[11px] font-mono">
                  <span className="text-ink-400 shrink-0">SEBI Templates:</span>
                  {TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="rounded-lg bg-[#162235] hover:bg-[#1E2D44] text-ink-300 hover:text-white px-2.5 py-1 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      + {tmpl.title}
                    </button>
                  ))}
                </div>

                {/* Input Text Box */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendMessage();
                    }}
                    placeholder="Type a compliance-approved WhatsApp message..."
                    className="flex-1 rounded-xl border border-[#1E293B] bg-[#0E1624] px-4 py-2.5 text-xs text-white placeholder-ink-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    className="rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black px-4 py-2.5 font-bold transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Send className="size-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
