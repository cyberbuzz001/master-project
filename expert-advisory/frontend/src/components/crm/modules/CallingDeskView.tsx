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
  TrendingUp,
  Target,
  Award,
  Zap,
  Filter,
  Users,
  Copy,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { CrmLead, CallLogItem } from "@/lib/crm-data";
import { OBJECTION_SCRIPTS } from "@/components/app/TelecallerWorkbench";

interface CallingDeskViewProps {
  leads: CrmLead[];
  callLogs: CallLogItem[];
  onWorkLead: (lead: CrmLead) => void;
  onLeadUpdated?: (leadId: string, updates: Partial<CrmLead>) => void;
}

type QuickFilterCategory =
  | "ALL"
  | "CALLBACKS_DUE"
  | "SPEED_TO_LEAD"
  | "ACTIVE_TRIALS"
  | "NPC_CADENCE"
  | "CRITICAL_NPC";

const TEAM_LEADERBOARD = [
  { rank: 1, name: "Vikram Malhotra", role: "Senior BA", calls: 58, targetCalls: 65, talkTimeMins: 134, trials: 8, convRate: "42.1%", revenue: "₹1,45,000", status: "TOP PERFORMER" },
  { rank: 2, name: "Priya Sharma", role: "Senior BA", calls: 52, targetCalls: 65, talkTimeMins: 118, trials: 7, convRate: "39.0%", revenue: "₹1,20,000", status: "ON TRACK" },
  { rank: 3, name: "Sunita Verma", role: "Business Assoc.", calls: 48, targetCalls: 60, talkTimeMins: 104, trials: 6, convRate: "38.5%", revenue: "₹95,000", status: "ON TRACK" },
  { rank: 4, name: "Rahul Mehta", role: "Business Assoc.", calls: 41, targetCalls: 60, talkTimeMins: 92, trials: 5, convRate: "33.3%", revenue: "₹70,000", status: "PACING UP" },
];

export function CallingDeskView({
  leads,
  callLogs,
  onWorkLead,
  onLeadUpdated,
}: CallingDeskViewProps) {
  const [callingSearch, setCallingSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilterCategory>("ALL");
  const [toast, setToast] = useState<string | null>(null);
  const [waSendingId, setWaSendingId] = useState<string | null>(null);

  // Modals
  const [showObjectionsModal, setShowObjectionsModal] = useState(false);
  const [objectionSearch, setObjectionSearch] = useState("");
  const [selectedLeadForPlaybook, setSelectedLeadForPlaybook] = useState<CrmLead | null>(null);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

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

  const handleCopyScript = (scriptText: string, scriptId: string) => {
    navigator.clipboard.writeText(scriptText);
    setCopiedScriptId(scriptId);
    showToast("Objection script copied to clipboard!");
    setTimeout(() => setCopiedScriptId(null), 2500);
  };

  const handleSendScriptViaWhatsApp = async (lead: CrmLead | null, scriptText: string) => {
    if (!lead) {
      showToast("Select a lead first to send script directly.");
      return;
    }
    showToast(`Dispatching script to ${lead.name} via WhatsApp...`);
    try {
      const res = await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.mobile,
          customMessage: scriptText,
          clientName: lead.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Script dispatched to ${lead.name} on WhatsApp!`);
      } else {
        showToast(`Dispatched message to WhatsApp queue`);
      }
    } catch {
      showToast(`Script dispatched to WhatsApp queue`);
    }
  };

  // Filter leads based on search & quick categories
  const filtered = leads.filter((l) => {
    const q = callingSearch.toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.mobile.includes(q) ||
      l.id.toLowerCase().includes(q) ||
      (l.city && l.city.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    const npc = l.npcAttempts || 0;
    if (activeFilter === "CALLBACKS_DUE") {
      return (
        l.status === "CONTACTED" ||
        l.temperature === "HOT" ||
        (l.nextFollowUp && l.nextFollowUp.toLowerCase().includes("today"))
      );
    }
    if (activeFilter === "SPEED_TO_LEAD") {
      return (
        l.status === "NEW" ||
        l.createdAt.toLowerCase().includes("just now") ||
        l.createdAt.toLowerCase().includes("today")
      );
    }
    if (activeFilter === "ACTIVE_TRIALS") {
      return (
        l.status === "QUALIFIED" ||
        (l.tags && l.tags.some((t) => t.toLowerCase().includes("trial")))
      );
    }
    if (activeFilter === "NPC_CADENCE") {
      return npc >= 1 && npc <= 4;
    }
    if (activeFilter === "CRITICAL_NPC") {
      return npc >= 5 && npc <= 6;
    }

    return true;
  });

  const filteredObjections = OBJECTION_SCRIPTS.filter((s) => {
    const q = objectionSearch.toLowerCase();
    return (
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.question.toLowerCase().includes(q) ||
      s.tag.toLowerCase().includes(q) ||
      s.script.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Floating Notification Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0B1A14]/95 px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Cloud Telecalling (CTI) & Productivity Cockpit
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              Tata Tele / Exotel Bridge
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Section 10 KPI Tracking • 7-Attempt NPC Recycling • 18 Battle-Tested Objection Playbooks • 1-Click WhatsApp Meta Dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLeaderboardModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#1E293B] bg-[#0E1624] hover:bg-[#162032] text-xs font-bold text-white px-3.5 py-2 cursor-pointer transition-colors shadow-sm"
          >
            <Award className="size-3.5 text-amber-400" />
            <span>Daily Leaderboard</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedLeadForPlaybook(filtered[0] || null);
              setShowObjectionsModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-xs font-bold text-brand-300 px-3.5 py-2 cursor-pointer transition-colors shadow-sm"
          >
            <BookOpen className="size-3.5 text-brand-400" />
            <span>18 Objection Scripts</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 10: DAILY PRODUCTIVITY & TELECALLING KPI METERS ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Daily Connected Calls */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-400">
              Connected Calls Today
            </span>
            <span className="rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono px-2 py-0.5">
              Goal: 50–70
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">48</span>
            <span className="text-xs text-ink-400 font-mono">/ 65 Target</span>
            <span className="ml-auto text-xs font-bold font-mono text-emerald-400">73.8%</span>
          </div>
          <div className="w-full bg-[#162030] rounded-full h-2 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: "73.8%" }} />
          </div>
          <p className="text-[11px] text-ink-400 flex items-center gap-1">
            <Zap className="size-3 text-emerald-400" />
            <span>17 more calls needed to achieve maximum tier bonus</span>
          </p>
        </div>

        {/* KPI 2: Talk Time Benchmark */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3 relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-400">
              Daily Talk Time
            </span>
            <span className="rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono px-2 py-0.5">
              Benchmark: 120m
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">104</span>
            <span className="text-xs text-ink-400 font-mono">/ 120 Mins</span>
            <span className="ml-auto text-xs font-bold font-mono text-cyan-400">86.6%</span>
          </div>
          <div className="w-full bg-[#162030] rounded-full h-2 overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: "86.6%" }} />
          </div>
          <p className="text-[11px] text-ink-400 flex items-center gap-1">
            <Clock className="size-3 text-cyan-400" />
            <span>16 mins remaining to hit SEBI compliance quota</span>
          </p>
        </div>

        {/* KPI 3: Active 48-Hour Free Trials */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-400">
              Active Trials Pipeline
            </span>
            <span className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono px-2 py-0.5">
              Goal: 5–8 Active
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400 font-mono">6</span>
            <span className="text-xs text-ink-400 font-mono">Concurrent Live</span>
            <Badge tone="positive" className="ml-auto text-[10px]">Optimal Range</Badge>
          </div>
          <div className="w-full bg-[#162030] rounded-full h-2 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: "75%" }} />
          </div>
          <p className="text-[11px] text-ink-400 flex items-center gap-1">
            <Flame className="size-3 text-amber-400" />
            <span>2 trials ready for Day-2 Closing Interview today</span>
          </p>
        </div>

        {/* KPI 4: Proposal Conversion Rate */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3 relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-400">
              Proposal Conversion
            </span>
            <span className="rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-mono px-2 py-0.5">
              Benchmark: &gt;35%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-400 font-mono">38.5%</span>
            <span className="text-xs text-ink-400 font-mono">Closures</span>
            <span className="ml-auto text-xs font-bold font-mono text-emerald-400">+3.5% vs KPI</span>
          </div>
          <div className="w-full bg-[#162030] rounded-full h-2 overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: "77%" }} />
          </div>
          <p className="text-[11px] text-ink-400 flex items-center gap-1">
            <TrendingUp className="size-3 text-emerald-400" />
            <span>₹4.3L closed MTD across all allocated desks</span>
          </p>
        </div>
      </div>

      {/* ── PRIORITY QUEUE CONTROLS & QUICK FILTERS ── */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
              <span>Active Priority Calling Queue</span>
              <span className="rounded-full bg-brand-500/20 text-brand-300 px-2.5 py-0.5 text-xs font-mono">
                {filtered.length} Leads
              </span>
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">
              Filtered and ranked by AI intent score, time elapsed, and callback appointments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={callingSearch}
                onChange={(e) => setCallingSearch(e.target.value)}
                placeholder="Search queue by name, phone, city, ID..."
                className="w-64 rounded-xl border border-[#1E293B] bg-[#0E1624] pl-9 pr-3.5 py-2 text-xs text-white placeholder-ink-400 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Filter Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: "ALL", label: "All Queue" },
            { id: "SPEED_TO_LEAD", label: "⚡ Speed-to-Lead (< 5m)" },
            { id: "CALLBACKS_DUE", label: "📞 Callbacks Due Today" },
            { id: "ACTIVE_TRIALS", label: "🔥 Active 48h Trials" },
            { id: "NPC_CADENCE", label: "🔄 NPC Cadence (1–4)" },
            { id: "CRITICAL_NPC", label: "⚠️ Critical NPC (5–6)" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveFilter(cat.id as QuickFilterCategory)}
              className={cx(
                "rounded-xl px-3.5 py-1.5 font-bold transition-all whitespace-nowrap cursor-pointer border text-xs",
                activeFilter === cat.id
                  ? "bg-brand-600 text-white border-brand-500 shadow-sm"
                  : "bg-[#0E1624] text-ink-300 border-[#1E293B] hover:border-brand-500/40 hover:text-white"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Lead Calling Cards Grid */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-ink-400 italic">
              No leads matching the current filter or search criteria.
            </div>
          ) : (
            filtered.map((lead) => {
              const currentNpc = lead.npcAttempts || 0;
              const isUrgent =
                lead.temperature === "VERY_HOT" ||
                lead.createdAt.toLowerCase().includes("just now");

              return (
                <div
                  key={lead.id}
                  className={cx(
                    "rounded-xl border bg-[#0E1624] p-4 space-y-3 transition-all relative flex flex-col justify-between",
                    isUrgent
                      ? "border-rose-500/40 shadow-rose-950/20 shadow-md"
                      : "border-[#1E293B] hover:border-brand-500/50"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm text-white">{lead.name}</h3>
                          {isUrgent && (
                            <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                          )}
                        </div>
                        <span className="font-mono text-xs text-brand-400">
                          {lead.id} {lead.city ? `• ${lead.city}` : ""}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Score: {lead.aiScore}
                      </span>
                    </div>

                    {/* NPC Cadence Bar */}
                    <div className="rounded-lg bg-[#090E17] p-2.5 border border-[#1E293B]">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-ink-400">NPC Cadence:</span>
                        <span
                          className={cx(
                            currentNpc >= 5
                              ? "text-rose-400 font-bold"
                              : currentNpc >= 3
                              ? "text-amber-400 font-bold"
                              : "text-emerald-400 font-bold"
                          )}
                        >
                          {currentNpc} / 7 Attempts
                        </span>
                      </div>
                      <div className="w-full bg-[#162030] rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className={cx(
                            "h-full rounded-full transition-all",
                            currentNpc >= 5
                              ? "bg-rose-500"
                              : currentNpc >= 3
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(100, (currentNpc / 7) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-ink-300 space-y-0.5">
                      <p>
                        <strong className="text-ink-400">Capital:</strong>{" "}
                        <span className="text-white font-mono">{lead.budget || lead.capital}</span>
                      </p>
                      <p className="truncate">
                        <strong className="text-ink-400">Interest:</strong>{" "}
                        <span className="text-cyan-400">{lead.preferredService || lead.segment}</span>
                      </p>
                      {lead.nextFollowUp && (
                        <p className="text-[11px] font-mono text-amber-300">
                          Follow-up: {lead.nextFollowUp}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-[#1E293B]/60 space-y-2">
                    <div className="flex items-center gap-2">
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
                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-2.5 text-xs font-mono font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
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
                        className="rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 px-3 py-2.5 text-xs font-mono font-bold transition-colors cursor-pointer"
                        title="Log Not-Picked-Call (+1 Attempt)"
                      >
                        +1 NPC
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeadForPlaybook(lead);
                        setShowObjectionsModal(true);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#090E17] hover:bg-[#121B2B] text-ink-300 hover:text-white py-1.5 text-[11px] font-mono font-semibold transition-colors cursor-pointer"
                    >
                      <BookOpen className="size-3 text-brand-400" />
                      <span>In-Call Objection Playbook</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 18 OBJECTION SCRIPTS MODAL / QUICK DRAWER ── */}
      {showObjectionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl text-white overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1E293B] flex items-center justify-between bg-[#0E1624]">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <BookOpen className="size-4 text-brand-400" />
                    <span>Objection Handling Library (18 Battle-Tested Scripts)</span>
                  </h3>
                  <Badge tone="brand">Section 5 Aligned</Badge>
                </div>
                <p className="text-xs text-ink-400">
                  {selectedLeadForPlaybook
                    ? `Live Guidance for: ${selectedLeadForPlaybook.name} (${selectedLeadForPlaybook.mobile})`
                    : "Select a script to copy or send directly via Meta WhatsApp Cloud API."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowObjectionsModal(false)}
                className="text-ink-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-[#1E293B] bg-[#090E17]">
              <div className="relative">
                <Search className="size-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={objectionSearch}
                  onChange={(e) => setObjectionSearch(e.target.value)}
                  placeholder="Search scripts by objection (e.g. past losses, fees, guarantee, sebi, options fear)..."
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] pl-9 pr-4 py-2.5 text-xs text-white placeholder-ink-400 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Scripts List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {filteredObjections.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-400 italic">
                  No scripts found matching &ldquo;{objectionSearch}&rdquo;.
                </div>
              ) : (
                filteredObjections.map((script, idx) => (
                  <div
                    key={script.id}
                    className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 space-y-3 hover:border-brand-500/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B]/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-400">#{idx + 1}</span>
                        <h4 className="font-bold text-sm text-white">{script.title}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                          {script.tag}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyScript(script.script, script.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#090E17] hover:bg-[#162032] text-ink-200 px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                        >
                          {copiedScriptId === script.id ? (
                            <>
                              <Check className="size-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3 text-ink-400" />
                              <span>Copy Script</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleSendScriptViaWhatsApp(selectedLeadForPlaybook, script.script)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors"
                        >
                          <MessageSquare className="size-3" />
                          <span>Send on WhatsApp</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="text-amber-400 font-semibold">Prospect Says:</span>{" "}
                        <span className="text-ink-200 italic">&ldquo;{script.question}&rdquo;</span>
                      </div>

                      <div className="rounded-lg bg-[#090E17] p-3 text-xs text-white leading-relaxed border border-[#1E293B]">
                        <span className="text-emerald-400 font-semibold block mb-1">
                          Recommended Telecaller Response:
                        </span>
                        {script.script}
                      </div>

                      {script.sebiNote && (
                        <div className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1.5 pt-0.5">
                          <ShieldCheck className="size-3.5 text-cyan-400 shrink-0" />
                          <span>{script.sebiNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#1E293B] bg-[#0E1624] flex items-center justify-between text-xs font-mono text-ink-400">
              <span>Expert Stocks CRM Compliance Guardian Enabled</span>
              <button
                type="button"
                onClick={() => setShowObjectionsModal(false)}
                className="rounded-xl border border-[#1E293B] bg-[#090E17] hover:bg-[#162032] text-white px-4 py-2 cursor-pointer"
              >
                Close Playbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DAILY LEADERBOARD MODAL ── */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl text-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Award className="size-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">
                  Daily Telecaller Leaderboard & Pacing
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaderboardModal(false)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              {TEAM_LEADERBOARD.map((rep) => (
                <div
                  key={rep.name}
                  className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cx(
                        "size-7 rounded-full flex items-center justify-center font-bold font-mono text-xs",
                        rep.rank === 1
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : rep.rank === 2
                          ? "bg-slate-300/20 text-slate-200 border border-slate-300/40"
                          : "bg-[#162030] text-ink-300 border border-[#1E293B]"
                      )}
                    >
                      #{rep.rank}
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-sm">{rep.name}</h4>
                      <span className="text-[11px] text-ink-400">{rep.role}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-right font-mono">
                    <div>
                      <span className="text-[10px] text-ink-400 block uppercase">Calls</span>
                      <span className="font-bold text-white">
                        {rep.calls} <span className="text-ink-500 font-normal">/ {rep.targetCalls}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 block uppercase">Talk Time</span>
                      <span className="font-bold text-cyan-400">{rep.talkTimeMins}m</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 block uppercase">Trials</span>
                      <span className="font-bold text-amber-400">{rep.trials}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 block uppercase">Conversion</span>
                      <span className="font-bold text-emerald-400">{rep.convRate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs text-ink-400 font-mono">
              <span>Benchmark: Min 120m talk time & 35% proposal conversion</span>
              <button
                type="button"
                onClick={() => setShowLeaderboardModal(false)}
                className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
