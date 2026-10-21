"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  FileText,
  CreditCard,
  CheckCheck,
  Clock,
  Sparkles,
  ShieldCheck,
  User,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import type { CrmLead } from "@/lib/crm-data";

interface WhatsAppCrmViewProps {
  leads: CrmLead[];
}

interface ThreadMessage {
  id: string;
  text: string;
  sender: "rep" | "client" | "system";
  time: string;
  status?: "sent" | "delivered" | "read" | "failed";
  templateName?: string;
}

const APPROVED_TEMPLATES = [
  {
    id: "adv_lead_welcome",
    title: "Official Welcome & Intro",
    badge: "Approved Utility/Mktg",
    desc: "Thank you for inquiring with Expert Stocks Advisory (Ref: Code). An advisory specialist will reach out.",
  },
  {
    id: "adv_risk_assessment_cert",
    title: "Risk Assessment Confirmation",
    badge: "SEBI Compliance",
    desc: "Confirms completed Risk Suitability score and assigned tier.",
  },
  {
    id: "adv_kyc_nudge",
    title: "KYC & Onboarding Nudge",
    badge: "Onboarding",
    desc: "Gentle reminder to complete suitability profile before activating advisory.",
  },
  {
    id: "adv_plan_activation",
    title: "Advisory Plan Activation",
    badge: "Service Activation",
    desc: "Notifies client their advisory subscription is active with assigned Client ID.",
  },
  {
    id: "adv_research_report",
    title: "New Research Report Alert",
    badge: "Research Desk",
    desc: "Notifies client of a newly published research report with reference code.",
  },
];

export function WhatsAppCrmView({ leads }: WhatsAppCrmViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || "");
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || leads[0];

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch thread messages from API
  const fetchThread = async (leadId: string, phone: string) => {
    if (!leadId && !phone) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/office/whatsapp?leadId=${encodeURIComponent(leadId)}&phone=${encodeURIComponent(phone)}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setMessages(json.data);
        }
      }
    } catch (err: any) {
      console.warn("Could not fetch WhatsApp thread:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLead) {
      fetchThread(selectedLead.id, selectedLead.mobile);
    }
  }, [selectedLeadId]);

  // Dispatch free-form text message via Meta API
  const handleSendText = async () => {
    if (!messageText.trim() || !selectedLead || sending) return;
    setSending(true);

    try {
      const res = await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          phone: selectedLead.mobile,
          text: messageText.trim(),
          clientName: selectedLead.name,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast("success", `WhatsApp message dispatched via Meta API to ${selectedLead.mobile}`);
        setMessageText("");
        // Append message locally or refresh
        if (json.data) {
          setMessages((prev) => [...prev, json.data]);
        } else {
          fetchThread(selectedLead.id, selectedLead.mobile);
        }
      } else {
        showToast("error", json.message || "Failed to send WhatsApp message");
      }
    } catch (err: any) {
      showToast("error", err.message || "Network error while connecting to Meta WhatsApp API");
    } finally {
      setSending(false);
    }
  };

  // Dispatch approved Meta Template
  const handleSendTemplate = async (templateId: string) => {
    if (!selectedLead || sending) return;
    setSending(true);

    try {
      let templateParams: string[] = [];
      if (templateId === "adv_lead_welcome") {
        templateParams = [selectedLead.name, selectedLead.id];
      } else if (templateId === "adv_risk_assessment_cert") {
        templateParams = [selectedLead.name, selectedLead.segment || "Moderate Growth", selectedLead.id];
      } else if (templateId === "adv_kyc_nudge") {
        templateParams = [selectedLead.name, selectedLead.id];
      } else if (templateId === "adv_plan_activation") {
        templateParams = [selectedLead.name, selectedLead.preferredService || "Index Options Alpha", selectedLead.id];
      } else if (templateId === "adv_research_report") {
        templateParams = [selectedLead.name, "Nifty & Bank Nifty Weekly Strategy", selectedLead.id];
      }

      const res = await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          phone: selectedLead.mobile,
          templateName: templateId,
          templateParams,
          clientName: selectedLead.name,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast("success", `Dispatched approved template "${templateId}" to ${selectedLead.name}`);
        if (json.data) {
          setMessages((prev) => [...prev, json.data]);
        } else {
          fetchThread(selectedLead.id, selectedLead.mobile);
        }
      } else {
        showToast("error", json.message || "Template dispatch failed");
      }
    } catch (err: any) {
      showToast("error", err.message || "Network exception during template dispatch");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={cx(
            "fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md animate-fade-in",
            toast.type === "success"
              ? "border-emerald-500/40 bg-[#0B1A14]/95 text-emerald-300"
              : "border-rose-500/40 bg-[#1A0B0E]/95 text-rose-300"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="size-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Meta WhatsApp Cloud API Cockpit
            </h1>
            <span className="rounded-full bg-[#22C55E]/15 text-[#22C55E] text-xs font-mono px-3 py-1 border border-[#22C55E]/30 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span>+91 92018 00995 ONLINE</span>
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Official Cloud API dispatch, 5 pre-approved SEBI templates, 2-way client sync, and audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-ink-400">
          <button
            type="button"
            onClick={() => selectedLead && fetchThread(selectedLead.id, selectedLead.mobile)}
            className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#0E1624] px-3 py-1.5 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={cx("size-3.5", loading && "animate-spin")} />
            <span>Sync Thread</span>
          </button>
        </div>
      </div>

      {/* Main WhatsApp Split View */}
      <div className="grid gap-6 lg:grid-cols-12 rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-2xl min-h-[660px]">
        {/* Left Column: Client Chats List (4 cols) */}
        <div className="lg:col-span-4 border-r border-[#1E293B] bg-[#0B121E] flex flex-col">
          <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Advisory Queue Threads ({leads.length})
            </h3>
            <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Verified Business
            </span>
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
                    <span className="font-mono text-[10px] text-emerald-400">{l.status}</span>
                  </div>
                  <p className="text-[11px] text-ink-400 truncate">
                    {l.mobile} • {l.preferredService || l.segment || "Equity Advisory"}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-ink-500 font-mono">
                    <span>Score: {l.aiScore || 80}</span>
                    <span>•</span>
                    <span>Ref: {l.id}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Chat Window & Template Bar (8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-[#070B12]">
          {selectedLead ? (
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
                    Consent: Verified (Opt-in) • Assigned Agent: {selectedLead.assignedAgent || "Advisory Desk"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                    <ShieldCheck className="size-3.5" />
                    <span>Meta Cloud API Bridge Active</span>
                  </span>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:16px_16px]">
                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center text-ink-400 gap-2">
                    <Loader2 className="size-6 animate-spin text-emerald-400" />
                    <span className="text-xs font-mono">Synchronizing WhatsApp thread...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center space-y-3">
                    <MessageSquare className="size-8 text-ink-500 mx-auto opacity-50" />
                    <p className="text-xs text-ink-400 italic">
                      No WhatsApp messages in this thread yet. Send a pre-approved SEBI template below to initiate.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isRep = m.sender === "rep" || m.sender === "system";
                    return (
                      <div
                        key={idx}
                        className={cx(
                          "flex flex-col max-w-lg rounded-2xl p-3.5 text-xs leading-relaxed shadow-md",
                          isRep
                            ? "ml-auto bg-[#0A3D28] text-white border border-[#166534]"
                            : "mr-auto bg-[#162235] text-white border border-[#23354E]"
                        )}
                      >
                        {m.templateName && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-300 uppercase tracking-wider mb-1 font-bold">
                            <Sparkles className="size-3" />
                            <span>{m.templateName}</span>
                          </div>
                        )}
                        <p className="whitespace-pre-line">{m.text}</p>
                        <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[10px] font-mono text-ink-300">
                          <span>{m.time}</span>
                          {isRep && <CheckCheck className="size-3.5 text-[#22C55E]" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Template Quick Selection Bar */}
              <div className="p-4 border-t border-[#1E293B] bg-[#0B121E] space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-ink-400 font-bold uppercase tracking-wider">
                      Pre-Approved SEBI WhatsApp Templates:
                    </span>
                    <span className="text-emerald-400 text-[10px]">1-Click Cloud API Dispatch</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-[11px]">
                    {APPROVED_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        disabled={sending}
                        onClick={() => handleSendTemplate(tmpl.id)}
                        className="rounded-xl border border-[#1E293B] bg-[#0E1624] hover:bg-[#162335] hover:border-emerald-500/40 text-left p-2 transition-all cursor-pointer disabled:opacity-50"
                        title={tmpl.desc}
                      >
                        <p className="font-bold text-white text-[11px] truncate">{tmpl.title}</p>
                        <p className="text-[9px] text-ink-400 font-mono mt-0.5 truncate">{tmpl.badge}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Free-form Input Text Box */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={messageText}
                    disabled={sending}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendText();
                    }}
                    placeholder="Type custom reply or notes to dispatch via WhatsApp..."
                    className="flex-1 rounded-xl border border-[#1E293B] bg-[#0E1624] px-4 py-2.5 text-xs text-white placeholder-ink-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={sending || !messageText.trim()}
                    onClick={handleSendText}
                    className="rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black px-4 py-2.5 font-bold text-xs transition-colors cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    <span>{sending ? "Sending..." : "Send"}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-400 text-xs">
              Select a lead from the left pane to view conversation history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
