"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  PhoneCall,
  PhoneOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Calendar,
  MessageSquare,
  ShieldCheck,
  User,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  X,
  FileText,
  TrendingUp,
  Tag,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { StoredLead, LeadStatus } from "@/lib/leads-store";

interface TelecallerWorkbenchProps {
  lead: StoredLead | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: (updatedLead: StoredLead) => void;
  operatorName?: string;
}

const OBJECTION_SCRIPTS = [
  {
    id: "fees",
    title: "Fee Justification vs Free Tips",
    tag: "Pricing & Value",
    question: "Why should I pay ₹15,000/quarter when Telegram/YouTube gives free tips?",
    script:
      "Sir/Ma'am, free channels are unregistered, unverified, and have zero accountability—often trading against their followers. As a SEBI Registered Research Analyst firm, every recommendation goes through dual-analyst review, defined risk-to-reward ratios (minimum 1:2), deterministic stop-losses, and mandatory regulatory audits. One prevented drawdown in a volatile week easily covers the statutory fee.",
    sebiNote: "SEBI Compliance: Focus on institutional methodology, position sizing, and stop-loss discipline. Never promise returns.",
  },
  {
    id: "guarantee",
    title: "100% Guaranteed Returns / Sure-Shot Calls",
    tag: "Statutory Shield",
    question: "Do you guarantee 100% profit or sure-shot jackpot calls?",
    script:
      "Under SEBI (Research Analysts) Regulations, 2014, promising assured or guaranteed returns in capital markets is strictly prohibited by law. We operate on mathematical probabilities, disciplined risk management, and capital preservation. Our historical edge comes from holding winning setups longer and cutting losses swiftly with hard stop-losses.",
    sebiNote: "SEBI Mandatory: Never use words like 'sure-shot', 'guaranteed', 'jackpot', or '100% safe'. Disclose market risk clearly.",
  },
  {
    id: "past_loss",
    title: "Past Losses with Other Advisory Firms",
    tag: "Trust Recovery",
    question: "I lost money following another advisory company earlier.",
    script:
      "We completely understand your hesitation. A major reason retail traders incur losses is over-leveraging and lack of capital allocation rules. At Expert Stocks, we don't just provide entry and exit levels; we specify exact portfolio allocation per trade (e.g. maximum 3-5% risk per idea) so that no single volatile movement harms your principal capital.",
    sebiNote: "Review client's trading history and confirm they have completed their Risk Profile before offering high-risk F&O.",
  },
  {
    id: "volatility",
    title: "Market is Crashing / Too Volatile",
    tag: "Market Sentiment",
    question: "The market is too volatile right now. I will invest when it stabilizes.",
    script:
      "Volatility is where professional research provides the highest value. In strong bull runs, almost everything rises; in volatile or sideways markets, sector rotation and hedging strategies protect capital and identify accumulation zones before the public recognizes the breakout.",
    sebiNote: "Explain how hedged strategies mitigate downside risk during index pullbacks.",
  },
];

const QUICK_NOTES = [
  "Interested in Nifty/BankNifty Options Advisory",
  "Requested evening call back (after 6:30 PM)",
  "Sent pricing PDF & SEBI disclosures on WhatsApp",
  "Capital currently tied up; will start next month",
  "Completed Risk Assessment; suitability pending",
  "Budget constraints; pitched quarterly cash equity",
];

const DISPOSITIONS: Array<{
  label: string;
  status: LeadStatus;
  color: string;
  isNpc?: boolean;
}> = [
  { label: "Answered - Qualified", status: "qualified", color: "bg-brand-50 border-brand-300 text-brand-700 hover:bg-brand-100" },
  { label: "Call Back Scheduled", status: "call_back", color: "bg-warning-50 border-warning-300 text-warning-800 hover:bg-warning-100" },
  { label: "Follow Up (Nurture)", status: "follow_up", color: "bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100" },
  { label: "Expected Payment", status: "expected_payment", color: "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100" },
  { label: "NPC (Not Picked / Switch Off)", status: "contacted", color: "bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100", isNpc: true },
  { label: "Converted & Enrolled", status: "converted", color: "bg-positive-50 border-positive-300 text-positive-800 hover:bg-positive-100" },
  { label: "Not Interested", status: "not_interested", color: "bg-ink-100 border-ink-300 text-ink-700 hover:bg-ink-200" },
  { label: "Lost / DND", status: "lost", color: "bg-red-50 border-red-300 text-red-700 hover:bg-red-100" },
];

export function TelecallerWorkbench({
  lead,
  isOpen,
  onClose,
  onLeadUpdated,
  operatorName = "Priya Sharma",
}: TelecallerWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<"dialer" | "playbook" | "history">("dialer");
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "ended">("idle");
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState<string>("Answered - Qualified");
  const [notes, setNotes] = useState<string>("");
  const [nextFollowup, setNextFollowup] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [activeScriptId, setActiveScriptId] = useState<string>("fees");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when lead changes
  useEffect(() => {
    if (isOpen) {
      setCallState("idle");
      setCallDuration(0);
      setIsMuted(false);
      setNotes("");
      setNextFollowup("");
      setSelectedDisposition("Answered - Qualified");
    }
  }, [isOpen, lead?.id]);

  // Call timer logic
  useEffect(() => {
    if (callState === "connected") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  if (!isOpen || !lead) return null;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStartCall = () => {
    setCallState("dialing");
    setCallDuration(0);
    // Simulate CTI bridge connect after 2 seconds
    setTimeout(() => {
      setCallState("connected");
    }, 2000);
  };

  const handleEndCall = () => {
    setCallState("ended");
  };

  const handleSaveInteraction = async () => {
    setSubmitting(true);
    const dispConfig = DISPOSITIONS.find((d) => d.label === selectedDisposition);
    const isNpc = dispConfig?.isNpc || false;
    const finalDispositionName = isNpc ? "NPC" : selectedDisposition;

    try {
      const response = await fetch("/api/v1/office/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          action: "call",
          durationSec: callDuration,
          disposition: finalDispositionName,
          notes: notes.trim(),
          agent: operatorName,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json?.data) {
          // If a next follow-up date was set, patch that as well
          if (nextFollowup) {
            await fetch("/api/v1/office/leads", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: lead.id,
                updates: { nextFollowup },
              }),
            });
            json.data.nextFollowup = nextFollowup;
          }
          onLeadUpdated(json.data);
          onClose();
        }
      }
    } catch (err) {
      console.error("[TelecallerWorkbench] Error saving interaction:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const currentNpc = lead.npcAttempts || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-ink-200 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-ink-200 bg-ink-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300">
              <PhoneCall className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-display">{lead.name}</h2>
                <span className="font-mono text-xs text-brand-300 bg-brand-950/60 px-2 py-0.5 rounded border border-brand-700/50">
                  {lead.id}
                </span>
                {lead.capital && lead.capital.includes("25L") && (
                  <span className="rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold px-1.5 py-0.5 border border-amber-500/40">
                    ★ HNI CLIENT
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-300 flex items-center gap-2 mt-0.5">
                <span>{lead.mobile}</span>
                <span>•</span>
                <span>{lead.city || "Pan India"}</span>
                <span>•</span>
                <span>Capital: {lead.capital}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-ink-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-ink-200 bg-ink-50 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("dialer")}
            className={cx(
              "flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer",
              activeTab === "dialer"
                ? "border-brand-600 text-brand-700 bg-white"
                : "border-transparent text-ink-500 hover:text-ink-900"
            )}
          >
            <PhoneCall className="size-4" />
            <span>CTI Calling Desk</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("playbook")}
            className={cx(
              "flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer",
              activeTab === "playbook"
                ? "border-brand-600 text-brand-700 bg-white"
                : "border-transparent text-ink-500 hover:text-ink-900"
            )}
          >
            <BookOpen className="size-4" />
            <span>Objection Scripts ({OBJECTION_SCRIPTS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cx(
              "flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer",
              activeTab === "history"
                ? "border-brand-600 text-brand-700 bg-white"
                : "border-transparent text-ink-500 hover:text-ink-900"
            )}
          >
            <Clock className="size-4" />
            <span>Call Logs ({lead.callLogs?.length || 0})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: CTI DIALER & WORKBENCH */}
          {activeTab === "dialer" && (
            <div className="grid gap-6 md:grid-cols-12">
              {/* Left Column: CTI Dialer + Call Action Panel (7 cols) */}
              <div className="md:col-span-7 space-y-5">
                {/* Active Call State Box */}
                <Card
                  className={cx(
                    "p-5 border-2 transition-all shadow-xs",
                    callState === "idle" && "border-ink-200 bg-ink-50/50",
                    callState === "dialing" && "border-amber-400 bg-amber-50/40 animate-pulse",
                    callState === "connected" && "border-emerald-500 bg-emerald-50/30",
                    callState === "ended" && "border-ink-300 bg-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cx(
                          "size-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm",
                          callState === "idle" && "bg-ink-700",
                          callState === "dialing" && "bg-amber-600",
                          callState === "connected" && "bg-emerald-600 animate-pulse",
                          callState === "ended" && "bg-ink-500"
                        )}
                      >
                        {callState === "connected" ? <Mic className="size-6" /> : <PhoneCall className="size-6" />}
                      </div>
                      <div>
                        <div className="text-xs font-mono uppercase tracking-wider text-ink-500">
                          {callState === "idle" && "Ready to Connect"}
                          {callState === "dialing" && "Initiating Cloud CTI Bridge..."}
                          {callState === "connected" && "Call In Progress"}
                          {callState === "ended" && "Call Ended • Disposition Required"}
                        </div>
                        <div className="text-2xl font-bold font-mono text-ink-900">
                          {formatDuration(callDuration)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {callState === "connected" && (
                        <button
                          type="button"
                          onClick={() => setIsMuted(!isMuted)}
                          className={cx(
                            "rounded-xl border p-2.5 transition-colors cursor-pointer",
                            isMuted ? "bg-red-100 border-red-300 text-red-700" : "bg-white border-ink-300 text-ink-700"
                          )}
                          title={isMuted ? "Unmute" : "Mute"}
                        >
                          {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                        </button>
                      )}

                      {callState === "idle" || callState === "ended" ? (
                        <button
                          type="button"
                          onClick={handleStartCall}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          <PhoneCall className="size-4" />
                          <span>{callState === "ended" ? "Redial Lead" : "Start Call"}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleEndCall}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 transition-colors cursor-pointer"
                        >
                          <PhoneOff className="size-4" />
                          <span>Disconnect</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-ink-500 border-t border-ink-200/60 pt-2.5">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <ShieldCheck className="size-3.5" />
                      <span>Encrypted Cloud Call Recording Active (SEBI RA Audit Proof)</span>
                    </span>
                    <span>Bridge: Tata Tele / Exotel</span>
                  </div>
                </Card>

                {/* Dispositioning Buttons */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-700">
                    1. Select Call Outcome / Disposition:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DISPOSITIONS.map((disp) => {
                      const isSelected = selectedDisposition === disp.label;
                      return (
                        <button
                          key={disp.label}
                          type="button"
                          onClick={() => setSelectedDisposition(disp.label)}
                          className={cx(
                            "rounded-xl border p-2 text-xs font-semibold text-center transition-all cursor-pointer",
                            isSelected
                              ? "ring-2 ring-brand-600 border-transparent shadow-xs font-bold " + disp.color
                              : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                          )}
                        >
                          {disp.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Call Notes Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-700">
                      2. Consultation Notes & Next Action:
                    </label>
                    <span className="text-[11px] text-ink-400 font-mono">Appends to audit trail</span>
                  </div>

                  {/* Quick Note Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_NOTES.map((qn) => (
                      <button
                        key={qn}
                        type="button"
                        onClick={() => setNotes((prev) => (prev ? `${prev}; ${qn}` : qn))}
                        className="rounded-lg border border-ink-200 bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-800 transition-colors cursor-pointer"
                      >
                        + {qn}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter discussion summary, risk tolerance discussed, or objections raised..."
                    className="w-full rounded-xl border border-ink-300 p-3 text-xs text-ink-900 placeholder-ink-400 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Schedule Next Follow-up */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
                      3. Schedule Next Callback (Optional):
                    </label>
                    <input
                      type="text"
                      value={nextFollowup}
                      onChange={(e) => setNextFollowup(e.target.value)}
                      placeholder="e.g. Tomorrow 10:30 AM or Post-market 4:00 PM"
                      className="w-full rounded-xl border border-ink-300 px-3 py-1.5 text-xs text-ink-800 focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end self-end pt-5">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSaveInteraction}
                      className="rounded-xl bg-brand-700 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-800 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? "Saving..." : "Save & Wrap Up"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Lead Dossier & Suitability Summary (5 cols) */}
              <div className="md:col-span-5 space-y-4 border-t md:border-t-0 md:border-l border-ink-200 md:pl-6">
                <div className="flex items-center justify-between border-b border-ink-200 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-800">
                    Lead Dossier & Intent
                  </h3>
                  <span className="text-[11px] font-mono text-ink-500">Captured: {lead.createdAt}</span>
                </div>

                {/* NPC Recycler Cadence Status */}
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-900">NPC Attempt Cadence</span>
                    <span className="font-mono text-xs font-bold text-orange-800">
                      {currentNpc} of 7 Attempts
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-orange-200 rounded-full h-1.5">
                    <div
                      className="bg-orange-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (currentNpc / 7) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-orange-700">
                    {currentNpc >= 7
                      ? "Maximum NPC threshold reached. Lead auto-recycled to Cold Nurture."
                      : `${7 - currentNpc} attempts remaining before auto-cold recycling.`}
                  </p>
                </div>

                {/* Capital & Segment Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-ink-50 p-2.5">
                    <span className="text-[10px] uppercase font-mono text-ink-500">Declared Capital</span>
                    <p className="font-bold font-mono text-ink-900 mt-0.5">{lead.capital}</p>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-2.5">
                    <span className="text-[10px] uppercase font-mono text-ink-500">Preferred Segment</span>
                    <p className="font-semibold text-ink-900 mt-0.5">{lead.segment || "General Advisory"}</p>
                  </div>
                </div>

                {/* Risk Assessment Score (if taken) */}
                {lead.assessment ? (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-900">SEBI Suitability Matrix</span>
                      <Badge tone="positive">Score: {lead.assessment.score}/100</Badge>
                    </div>
                    <p className="text-xs font-semibold text-brand-800 mt-1">
                      Profile: {lead.assessment.category}
                    </p>
                    {lead.assessment.suitability_summary && (
                      <p className="text-[11px] text-ink-600 mt-1 line-clamp-2">
                        {lead.assessment.suitability_summary}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-ink-200 bg-ink-50 p-3 text-center">
                    <span className="text-xs font-medium text-ink-600">
                      Risk Assessment Questionnaire Pending
                    </span>
                    <p className="text-[11px] text-ink-400 mt-0.5">
                      Prompt client to take assessment via SMS/WhatsApp link.
                    </p>
                  </div>
                )}

                {/* Lead Message Note */}
                {lead.message && (
                  <div className="rounded-xl border border-ink-200 bg-ink-50 p-3">
                    <span className="text-[10px] uppercase font-mono text-ink-500">Inbound Inquiry Message</span>
                    <p className="text-xs text-ink-800 italic mt-1">&quot;{lead.message}&quot;</p>
                  </div>
                )}

                {/* Direct WhatsApp Action */}
                <a
                  href={`https://wa.me/${lead.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Hello ${lead.name}, this is ${operatorName} from Expert Stocks Consultancy regarding your inquiry (Ref: ${lead.id}). How may our advisory desk assist you today?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 p-2.5 text-xs font-bold text-[#16A34A] hover:bg-[#22C55E]/25 transition-colors"
                >
                  <MessageSquare className="size-4" />
                  <span>Send Pre-Formatted WhatsApp Message</span>
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: OBJECTION HANDLING PLAYBOOK */}
          {activeTab === "playbook" && (
            <div className="grid gap-6 md:grid-cols-12">
              {/* Objection Index List (4 cols) */}
              <div className="md:col-span-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500 block mb-2">
                  Select Objection:
                </span>
                {OBJECTION_SCRIPTS.map((script) => {
                  const isSelected = activeScriptId === script.id;
                  return (
                    <button
                      key={script.id}
                      type="button"
                      onClick={() => setActiveScriptId(script.id)}
                      className={cx(
                        "w-full text-left rounded-xl p-3 border transition-all cursor-pointer",
                        isSelected
                          ? "bg-brand-50 border-brand-500 shadow-xs"
                          : "bg-white border-ink-200 hover:bg-ink-50"
                      )}
                    >
                      <span className="text-[10px] font-mono uppercase text-brand-700 font-bold block">
                        {script.tag}
                      </span>
                      <p className="text-xs font-bold text-ink-900 mt-0.5">{script.title}</p>
                    </button>
                  );
                })}
              </div>

              {/* Selected Script Detail (8 cols) */}
              <div className="md:col-span-8">
                {(() => {
                  const active = OBJECTION_SCRIPTS.find((s) => s.id === activeScriptId) || OBJECTION_SCRIPTS[0];
                  return (
                    <Card className="p-5 space-y-4 border-l-4 border-l-brand-600">
                      <div>
                        <span className="rounded bg-brand-100 text-brand-800 text-[10px] font-mono font-bold px-2 py-0.5">
                          {active.tag}
                        </span>
                        <h4 className="text-sm font-bold text-ink-900 mt-2 font-display">
                          &quot;{active.question}&quot;
                        </h4>
                      </div>

                      <div className="rounded-xl bg-ink-50 p-4 border border-ink-200">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-brand-700 font-bold block mb-1">
                          Recommended Verbatim Response:
                        </span>
                        <p className="text-xs leading-relaxed text-ink-800">{active.script}</p>
                      </div>

                      <div className="rounded-xl bg-warning-50 p-3 border border-warning-200 flex items-start gap-2 text-warning-900 text-xs">
                        <ShieldCheck className="size-4 text-warning-700 shrink-0 mt-0.5" />
                        <span>{active.sebiNote}</span>
                      </div>
                    </Card>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 3: CALL HISTORY TIMELINE */}
          {activeTab === "history" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-ink-200 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-800">
                  Interaction Audit History
                </h4>
                <span className="text-xs text-ink-500 font-mono">
                  {lead.callLogs?.length || 0} Total Interactions Logged
                </span>
              </div>

              {!lead.callLogs || lead.callLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-500">
                  No previous phone calls logged for this lead yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lead.callLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-ink-200 bg-ink-50/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={
                              log.disposition.includes("Qualified") || log.disposition.includes("Converted")
                                ? "positive"
                                : log.disposition.includes("NPC")
                                ? "warning"
                                : "neutral"
                            }
                          >
                            {log.disposition}
                          </Badge>
                          <span className="text-xs font-mono text-ink-500">{log.timestamp}</span>
                          <span className="text-xs font-semibold text-ink-800">• Rep: {log.agent}</span>
                        </div>
                        {log.notes && <p className="text-xs text-ink-700 italic mt-0.5">&quot;{log.notes}&quot;</p>}
                      </div>

                      <div className="font-mono text-xs text-ink-600 sm:text-right">
                        Duration: {formatDuration(log.durationSec)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
