"use client";

import React, { useState } from "react";
import {
  PhoneCall,
  PhoneOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  BookOpen,
  Mic,
  MicOff,
  ShieldCheck,
  Search,
  Check,
  X,
  Flame,
  Volume2,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { CrmLead, CallLogItem } from "@/lib/crm-data";

interface CallingDeskViewProps {
  leads: CrmLead[];
  callLogs: CallLogItem[];
  onWorkLead: (lead: CrmLead) => void;
  onLeadUpdated?: (leadId: string, updates: Partial<CrmLead>) => void;
}

export function CallingDeskView({
  leads,
  callLogs,
  onWorkLead,
  onLeadUpdated,
}: CallingDeskViewProps) {
  const [callingSearch, setCallingSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleQuickNpc = async (lead: CrmLead, e: React.MouseEvent) => {
    e.stopPropagation();
    const newNpc = (lead.npcAttempts || 0) + 1;
    const isMaxLost = newNpc >= 7;
    const newStatus = isMaxLost ? "LOST" : "CONTACTED";

    if (onLeadUpdated) {
      onLeadUpdated(lead.id, {
        npcAttempts: newNpc,
        status: newStatus as any,
        lastContacted: "Today, Just now",
      });
    }

    showToast(`Logged NPC Attempt #${newNpc} for ${lead.name}`);

    try {
      await fetch("/api/v1/office/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          action: "call",
          durationSec: 0,
          disposition: "NPC",
          notes: `Quick NPC logged from Calling Desk (Attempt ${newNpc}/7)`,
          agent: lead.assignedAgent || "Advisory Rep",
        }),
      });
    } catch (_) {}
  };

  const [waSendingId, setWaSendingId] = useState<string | null>(null);

  const handleQuickWhatsApp = async (lead: CrmLead, e: React.MouseEvent) => {
    e.stopPropagation();
    if (waSendingId) return;
    setWaSendingId(lead.id);

    try {
      const res = await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.mobile,
          templateName: "adv_lead_welcome",
          templateParams: [lead.name, lead.id],
          clientName: lead.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`WhatsApp Welcome sent via Meta API to ${lead.name}`);
        if (onLeadUpdated) {
          onLeadUpdated(lead.id, { lastContacted: "Today, Just now" });
        }
      } else {
        showToast(`WhatsApp failed: ${data.message || "API error"}`);
      }
    } catch (err: any) {
      showToast(`Network error sending WhatsApp: ${err.message}`);
    } finally {
      setWaSendingId(null);
    }
  };

  const filtered = leads.filter((l) => {
    const q = callingSearch.toLowerCase();
    return (
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.mobile.includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0B1A14]/90 px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Cloud Telecalling (CTI) & NPC Recycling Desk
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              Tata Tele / Exotel Bridge
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            High-speed single-pane dialer with 7-attempt NPC cadence, encrypted call recordings, and in-call objection playbooks.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-ink-400">
          <span>Bridge Latency: <strong>48ms</strong></span>
          <span>•</span>
          <span className="text-emerald-400">Recording Encrypted</span>
        </div>
      </div>

      {/* Leads Calling Queue */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Active Priority Calling Queue ({filtered.length} Leads)
          </h2>
          <input
            type="text"
            value={callingSearch}
            onChange={(e) => setCallingSearch(e.target.value)}
            placeholder="Search queue by name, phone, lead ID..."
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-1.5 text-xs text-white placeholder-ink-400 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lead) => {
            const currentNpc = lead.npcAttempts || 0;
            return (
              <div
                key={lead.id}
                className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 space-y-3 hover:border-brand-500/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white">{lead.name}</h3>
                    <span className="font-mono text-xs text-brand-400">
                      {lead.id} • {lead.city}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Score: {lead.aiScore}
                  </span>
                </div>

                {/* NPC Cadence Bar */}
                <div className="rounded-lg bg-[#090E17] p-2.5 border border-[#1E293B]">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-ink-400">NPC Cadence:</span>
                    <span className={cx(currentNpc >= 5 ? "text-rose-400 font-bold" : "text-orange-400 font-bold")}>
                      {currentNpc} / 7 Attempts
                    </span>
                  </div>
                  <div className="w-full bg-[#162030] rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div
                      className={cx(
                        "h-full rounded-full transition-all",
                        currentNpc >= 5 ? "bg-rose-500" : "bg-orange-500"
                      )}
                      style={{ width: `${Math.min(100, (currentNpc / 7) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-ink-300">
                  <p>
                    <strong>Capital:</strong> {lead.budget || lead.capital}
                  </p>
                  <p className="truncate mt-0.5">
                    <strong>Service:</strong> {lead.preferredService || lead.segment}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onWorkLead(lead)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 text-xs font-bold transition-colors cursor-pointer shadow-md"
                  >
                    <PhoneCall className="size-3.5" />
                    <span>CTI Bridge</span>
                  </button>

                  <button
                    type="button"
                    disabled={waSendingId === lead.id}
                    onClick={(e) => handleQuickWhatsApp(lead, e)}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-2.5 py-2.5 text-xs font-mono font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="Send 1-Click WhatsApp Welcome via Meta API"
                  >
                    {waSendingId === lead.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="size-3.5" />
                    )}
                    <span>WA</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleQuickNpc(lead, e)}
                    className="rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 px-2.5 py-2.5 text-xs font-mono font-bold transition-colors cursor-pointer"
                    title="Log Not-Picked-Call (+1 Attempt)"
                  >
                    +1 NPC
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
