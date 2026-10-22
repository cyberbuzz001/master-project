"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Send,
  Loader2,
  Copy,
  ChevronRight,
  RefreshCw,
  FileText,
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

export const OBJECTION_SCRIPTS = [
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
  {
    id: "think_later",
    title: "Think & Decide Later (Procrastination)",
    tag: "Objection Handling",
    question: "I will think about it and let you know next week.",
    script:
      "Understood, taking an informed financial decision is important. May I ask what specific factor you'd like to evaluate—is it the capital allocation, our research methodology, or the market segment? I can send our audited performance disclosures and sample risk charter directly on WhatsApp right now so you have all facts in front of you.",
    sebiNote: "Respect client autonomy. Avoid aggressive pressure; offer transparent regulatory disclosures.",
  },
  {
    id: "sebi_proof",
    title: "SEBI Registration & Verification Fear",
    tag: "Regulatory Legitimacy",
    question: "How do I verify if you are genuinely SEBI registered?",
    script:
      "You can verify our registration directly on SEBI's official portal (sebi.gov.in) under Recognized Intermediaries -> Research Analysts. Our SEBI Registration Number, compliance officer details, and grievance escalation matrix are published publicly on expertstocks.in/trust-center.",
    sebiNote: "Always share official sebi.gov.in verification path and registered corporate address.",
  },
  {
    id: "capital_low",
    title: "Capital Shortage / Starting Small",
    tag: "Capital Allocation",
    question: "I only have ₹50,000 to ₹1,00,000 right now. Is that enough?",
    script:
      "Yes, starting with modest capital is actually ideal for learning our discipline. For portfolios under ₹2 Lakhs, we recommend our Cash Equity Intraday or Delivery Alpha setup rather than high-lot F&O, ensuring position sizing never exposes more than 2% of your total capital to risk on any single trade.",
    sebiNote: "Never recommend index options to clients with capital below ₹2 Lakhs without conservative risk disclosure.",
  },
  {
    id: "options_fear",
    title: "Fear of F&O / Options Trading",
    tag: "Risk & Suitability",
    question: "I heard 9 out of 10 people lose money in F&O. Isn't it too risky?",
    script:
      "You are completely right—SEBI's official study revealed 93% of individual F&O traders make losses due to emotional revenge trading and zero stop-loss discipline. That is precisely why an institutionally researched plan with predefined risk limits and stop-loss invalidation is necessary if you choose to participate, or we can guide you strictly in Cash Equity.",
    sebiNote: "Affirm SEBI's 9/10 F&O loss disclosure. Offer Cash Equity as the conservative alternative.",
  },
  {
    id: "no_time",
    title: "Lack of Screen Time During Market Hours",
    tag: "Execution Feasibility",
    question: "I have a day job and cannot watch screens between 9:15 AM and 3:30 PM.",
    script:
      "For working professionals, our Positional & BTST (Buy Today Sell Tomorrow) Equity delivery desk is tailored specifically. Recommendations are dispatched with predefined GTT/limit orders before market open or after 3:00 PM, requiring no more than 5 minutes of order placement on your mobile broker app.",
    sebiNote: "Recommend swing and positional plans with GTT orders rather than scalping/intraday.",
  },
  {
    id: "telegram_groups",
    title: "Comparison to Free Telegram/WhatsApp Groups",
    tag: "Channel Accountability",
    question: "I already get 5 free tips daily on Telegram.",
    script:
      "Free Telegram groups have zero statutory liability. When trades go wrong, admins delete the messages or block members. As SEBI Research Analysts, every recommendation we publish is recorded in immutable audit logs with SEBI audit trails. We trade for quality and capital preservation, not random call volume.",
    sebiNote: "Highlight lack of auditability and pump-and-dump risks in anonymous messaging channels.",
  },
  {
    id: "algo_bot",
    title: "Algo Bot vs Human Research Analysts",
    tag: "Methodology",
    question: "Why should I use advisory when automated algo bots trade automatically?",
    script:
      "Algo bots follow rigid mathematical scripts that frequently fail during regime shifts, geopolitical black-swan events, or policy rate announcements. Our advisory combines quantitative screening models with senior macroeconomic oversight, ensuring human risk control halts strategies when volatility breaches normal bounds.",
    sebiNote: "SEBI requires human oversight on all advisory strategies and prohibits unauthorized automated trade guarantees.",
  },
  {
    id: "spouse_partner",
    title: "Need to Consult Family or Spouse",
    tag: "Decision Alignment",
    question: "I need to discuss this with my spouse/business partner first.",
    script:
      "That is a great approach—financial planning should always involve family alignment. I will share a concise PDF summary outlining our SEBI registration, risk-management protocols, fee schedule, and sample trade rationale so both of you can review together this evening.",
    sebiNote: "Offer institutional overview PDF via WhatsApp for transparent household review.",
  },
  {
    id: "free_trial_ext",
    title: "Request for Free Trial Extension",
    tag: "Trial Discipline",
    question: "Can you give me another 3-4 days of free trial calls?",
    script:
      "Our 48-Hour Free Trial is designed strictly to demonstrate signal delivery speed, stop-loss adherence, and research formatting. Under compliance guidelines, continued live advisory beyond the trial window requires formal client enrollment and KYC completion. We can structure your first month with installment flexibility.",
    sebiNote: "Do not provide perpetual unauthenticated trial calls. Comply with KYC enrollment requirements.",
  },
  {
    id: "demat_transfer",
    title: "Do I Need to Open a New Demat Account?",
    tag: "Account Independence",
    question: "Will I have to transfer my shares or open a new demat account with you?",
    script:
      "Not at all. You retain 100% custody of your existing Demat account with your chosen broker (Zerodha, Groww, AngelOne, Dhan, Upstox, etc.). You execute recommendations on your own terminal. Expert Stocks never asks for your trading credentials or Demat funds.",
    sebiNote: "Reiterate strict separation: RAs never take custody of client funds or Demat assets.",
  },
  {
    id: "bad_experience_tips",
    title: "Past Fraud / Unauthorized Tip Provider",
    tag: "Trust Recovery",
    question: "An Indore/Surat firm took ₹50,000 from me and vanished.",
    script:
      "We deeply regret that you experienced that. Unscrupulous, unregistered operators often make false promises. Expert Stocks is an audited SEBI Registered Research Analyst with official bank accounts, GST invoicing, and strict adherence to the SEBI SCORES grievance redressal mechanism.",
    sebiNote: "Inform client about SEBI SCORES portal (scores.gov.in) for legitimate regulatory recourse.",
  },
  {
    id: "mutual_funds",
    title: "Why Not Just Invest in Mutual Funds?",
    tag: "Active vs Passive Alpha",
    question: "Isn't investing in Nifty 50 Index funds or SIP safer?",
    script:
      "Mutual funds and index SIPs are excellent for core baseline wealth accumulation over 10-15 years. However, advisory research aims for tactical alpha—capitalizing on momentum breakouts, sector rotation, and cyclical swings to generate differentiated returns on your active tactical capital.",
    sebiNote: "Validate mutual funds as core holdings; position advisory as tactical alpha allocation.",
  },
  {
    id: "taxation_losses",
    title: "Taxation on F&O and Capital Gains",
    tag: "Financial Literacy",
    question: "How do I account for advisory fees and trading gains for income tax?",
    script:
      "All our advisory subscriptions include official GST tax invoices (18% GST). In accordance with Income Tax guidelines, equity trading gains are taxed under STCG/LTCG, while F&O is categorized as non-speculative business income, where legitimate advisory and trading expenses can be claimed against business revenue.",
    sebiNote: "Provide factual tax information while advising the client to consult a certified Chartered Accountant.",
  },
  {
    id: "suitability_conservative",
    title: "Conservative Profile Demanding Aggressive F&O",
    tag: "Suitability Enforcement",
    question: "I want only high-leverage hero-or-zero options calls.",
    script:
      "Under SEBI suitability norms, we cannot recommend aggressive derivatives if your financial capacity or risk tolerance indicates a conservative profile. We are legally bound to protect your capital. We can offer you high-conviction momentum equity trades with lower drawdown risk.",
    sebiNote: "SEBI MANDATORY: Never override a low suitability score to sell aggressive options advisory.",
  },
];

const QUICK_NOTES = [
  "Interested in Nifty/BankNifty Options Advisory",
  "Requested evening call back (after 6:30 PM)",
  "Sent pricing PDF & SEBI disclosures on WhatsApp",
  "Capital currently tied up; will start next month",
  "Completed Risk Assessment; suitability approved",
  "Budget constraints; pitched quarterly cash equity",
  "Sent Welcome message via Meta Cloud API",
  "NPC Attempt logged; queued for next day follow-up",
];

const DISPOSITIONS: Array<{
  label: string;
  status: LeadStatus;
  color: string;
  isNpc?: boolean;
}> = [
  { label: "Answered - Qualified", status: "qualified", color: "bg-cyan-500/20 border-cyan-400 text-cyan-300" },
  { label: "Call Back Scheduled", status: "call_back", color: "bg-amber-500/20 border-amber-400 text-amber-300" },
  { label: "Follow Up (Nurture)", status: "follow_up", color: "bg-blue-500/20 border-blue-400 text-blue-300" },
  { label: "Expected Payment", status: "expected_payment", color: "bg-emerald-500/20 border-emerald-400 text-emerald-300" },
  { label: "NPC (Not Picked / Switch Off)", status: "contacted", color: "bg-orange-500/20 border-orange-400 text-orange-300", isNpc: true },
  { label: "Converted & Enrolled", status: "converted", color: "bg-teal-500/20 border-teal-400 text-teal-300" },
  { label: "Not Interested", status: "not_interested", color: "bg-slate-700/40 border-slate-500 text-slate-300" },
  { label: "Lost / DND", status: "lost", color: "bg-red-500/20 border-red-400 text-red-300" },
];

export function TelecallerWorkbench({
  lead,
  isOpen,
  onClose,
  onLeadUpdated,
  operatorName = "Priya Sharma",
}: TelecallerWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<"dialer" | "playbook" | "whatsapp" | "history">("dialer");
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "ended">("idle");
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState<string>("Answered - Qualified");
  const [notes, setNotes] = useState<string>("");
  const [nextFollowup, setNextFollowup] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [activeScriptId, setActiveScriptId] = useState<string>("fees");
  const [scriptSearch, setScriptSearch] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // WhatsApp Tab State
  const [waMessages, setWaMessages] = useState<any[]>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waText, setWaText] = useState("");
  const [waSending, setWaSending] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Reset state when lead changes
  useEffect(() => {
    if (isOpen) {
      setCallState("idle");
      setCallDuration(0);
      setIsMuted(false);
      setNotes("");
      setNextFollowup("");
      setSelectedDisposition("Answered - Qualified");
      if (lead) {
        fetchWhatsAppThread(lead.id, lead.mobile);
      }
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

  const fetchWhatsAppThread = async (leadId: string, phone: string) => {
    if (!leadId && !phone) return;
    setWaLoading(true);
    try {
      const res = await fetch(
        `/api/v1/office/whatsapp?leadId=${encodeURIComponent(leadId)}&phone=${encodeURIComponent(phone)}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setWaMessages(json.data);
        }
      }
    } catch (_) {
    } finally {
      setWaLoading(false);
    }
  };

  const handleStartCall = () => {
    setCallState("dialing");
    setTimeout(() => {
      setCallState("connected");
      setCallDuration(0);
    }, 1500);
  };

  const handleEndCall = () => {
    setCallState("ended");
  };

  const handleQuickWhatsAppSend = async (templateName: string, customParams?: string[]) => {
    if (!lead || waSending) return;
    setWaSending(true);
    try {
      const res = await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.mobile,
          templateName,
          templateParams: customParams || [lead.name, lead.id],
          clientName: lead.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Template "${templateName}" dispatched via Meta API to ${lead.name}`);
        fetchWhatsAppThread(lead.id, lead.mobile);
        setNotes((prev) => (prev ? `${prev}; Sent WhatsApp template: ${templateName}` : `Sent WhatsApp template: ${templateName}`));
      } else {
        showToast(`WhatsApp failed: ${data.message || "API Error"}`);
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`);
    } finally {
      setWaSending(false);
    }
  };

  const handleSendWhatsAppText = async () => {
    if (!lead || !waText.trim() || waSending) return;
    setWaSending(true);
    try {
      const res = await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.mobile,
          text: waText.trim(),
          clientName: lead.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`WhatsApp message sent to ${lead.name}`);
        setWaText("");
        if (data.data) {
          setWaMessages((prev) => [...prev, data.data]);
        } else {
          fetchWhatsAppThread(lead.id, lead.mobile);
        }
      } else {
        showToast(`WhatsApp failed: ${data.message || "API error"}`);
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`);
    } finally {
      setWaSending(false);
    }
  };

  const handleSaveInteraction = async () => {
    if (!lead) return;
    setSubmitting(true);

    try {
      const dispObj = DISPOSITIONS.find((d) => d.label === selectedDisposition);
      const targetStatus = dispObj?.status || "contacted";

      const res = await fetch("/api/v1/office/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          action: "call",
          durationSec: callDuration,
          disposition: selectedDisposition,
          notes: notes.trim(),
          agent: operatorName,
          nextFollowup: nextFollowup.trim() || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          onLeadUpdated(json.data);
          onClose();
          return;
        }
      }

      // Fallback optimistic update
      const updatedNpc = dispObj?.isNpc ? (lead.npcAttempts || 0) + 1 : lead.npcAttempts || 0;
      const optimisticLead: StoredLead = {
        ...lead,
        status: targetStatus,
        npcAttempts: updatedNpc,
        lastContactedAt: "Today, Just now",
        nextFollowup: nextFollowup.trim() || lead.nextFollowup,
        callLogs: [
          {
            id: `CALL-${Date.now()}`,
            timestamp: "Just now",
            durationSec: callDuration,
            disposition: selectedDisposition,
            notes: notes.trim(),
            agent: operatorName,
          },
          ...(lead.callLogs || []),
        ],
      };

      onLeadUpdated(optimisticLead);
      onClose();
    } catch (err) {
      console.error("[TelecallerWorkbench] Error saving interaction:", err);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !lead) return null;

  const currentNpc = lead.npcAttempts || 0;
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredScripts = OBJECTION_SCRIPTS.filter((s) => {
    const q = scriptSearch.toLowerCase();
    return !q || s.title.toLowerCase().includes(q) || s.question.toLowerCase().includes(q) || s.tag.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-xs p-4 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-60 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0B1A14]/95 px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="relative w-full max-w-5xl rounded-2xl border border-[#1E293B] bg-[#090E1A] text-[#F5F7FA] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1E293B] bg-[#070B14] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold">
              <PhoneCall className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-display text-white">{lead.name}</h3>
                <span className="rounded bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-300">
                  {lead.id}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-slate-300">
                  {lead.mobile}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Assigned Rep: <span className="text-slate-200">{operatorName}</span> • City: {lead.city || "Mumbai"} • Source: {lead.source}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="flex border-b border-[#1E293B] bg-[#070B14] px-6 text-xs overflow-x-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("dialer")}
            className={cx(
              "flex items-center gap-2 border-b-2 py-3 px-4 font-semibold uppercase tracking-wider transition-colors cursor-pointer",
              activeTab === "dialer"
                ? "border-cyan-400 text-cyan-300 bg-[#0E1624] rounded-t-lg"
                : "border-transparent text-slate-400 hover:text-white hover:bg-[#0E1624]/60"
            )}
          >
            <PhoneCall className="size-4" />
            <span>CTI Cloud Dialer</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("whatsapp")}
            className={cx(
              "flex items-center gap-2 border-b-2 py-3 px-4 font-semibold uppercase tracking-wider transition-colors cursor-pointer",
              activeTab === "whatsapp"
                ? "border-emerald-500 text-emerald-300 bg-[#0E1624] rounded-t-lg"
                : "border-transparent text-slate-400 hover:text-white hover:bg-[#0E1624]/60"
            )}
          >
            <MessageSquare className="size-4 text-emerald-400" />
            <span>WhatsApp Bridge ({waMessages.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("playbook")}
            className={cx(
              "flex items-center gap-2 border-b-2 py-3 px-4 font-semibold uppercase tracking-wider transition-colors cursor-pointer",
              activeTab === "playbook"
                ? "border-cyan-400 text-cyan-300 bg-[#0E1624] rounded-t-lg"
                : "border-transparent text-slate-400 hover:text-white hover:bg-[#0E1624]/60"
            )}
          >
            <BookOpen className="size-4" />
            <span>Objection Scripts ({OBJECTION_SCRIPTS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cx(
              "flex items-center gap-2 border-b-2 py-3 px-4 font-semibold uppercase tracking-wider transition-colors cursor-pointer",
              activeTab === "history"
                ? "border-cyan-400 text-cyan-300 bg-[#0E1624] rounded-t-lg"
                : "border-transparent text-slate-400 hover:text-white hover:bg-[#0E1624]/60"
            )}
          >
            <Clock className="size-4" />
            <span>Call History ({lead.callLogs?.length || 0})</span>
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
                <div
                  className={cx(
                    "rounded-2xl p-5 border-2 transition-all shadow-md",
                    callState === "idle" && "border-[#1E293B] bg-[#0E1624]",
                    callState === "dialing" && "border-amber-500/50 bg-amber-950/40 animate-pulse",
                    callState === "connected" && "border-emerald-500/50 bg-emerald-950/40",
                    callState === "ended" && "border-[#1E293B] bg-[#0E1624]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cx(
                          "size-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm",
                          callState === "idle" && "bg-slate-700",
                          callState === "dialing" && "bg-amber-600",
                          callState === "connected" && "bg-emerald-600 animate-pulse",
                          callState === "ended" && "bg-slate-600"
                        )}
                      >
                        {callState === "connected" ? <Mic className="size-6" /> : <PhoneCall className="size-6" />}
                      </div>
                      <div>
                        <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                          {callState === "idle" && "Ready to Connect"}
                          {callState === "dialing" && "Initiating Cloud CTI Bridge..."}
                          {callState === "connected" && "Call In Progress"}
                          {callState === "ended" && "Call Ended • Disposition Required"}
                        </div>
                        <div className="text-2xl font-bold font-mono text-white">
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
                            isMuted ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-[#162235] border-[#1E293B] text-slate-300 hover:text-white"
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
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 transition-colors cursor-pointer"
                        >
                          <PhoneCall className="size-4" />
                          <span>{callState === "ended" ? "Redial Lead" : "Start Call"}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleEndCall}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/50 transition-colors cursor-pointer"
                        >
                          <PhoneOff className="size-4" />
                          <span>Disconnect</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-[#1E293B] pt-2.5">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <ShieldCheck className="size-3.5" />
                      <span>Encrypted Cloud Call Recording Active (SEBI RA Audit Proof)</span>
                    </span>
                    <span>Bridge: Tata Tele / Exotel</span>
                  </div>
                </div>

                {/* 1-Click WhatsApp Quick Dispatch Bar */}
                <div className="rounded-xl border border-emerald-500/30 bg-[#061713] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <MessageSquare className="size-3.5 text-emerald-400" />
                      <span>Instant Meta WhatsApp Cloud Dispatch:</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400">+91 92018 00995 Verified</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={waSending}
                      onClick={() => handleQuickWhatsAppSend("adv_lead_welcome", [lead.name, lead.id])}
                      className="rounded-lg border border-emerald-500/30 bg-[#0D241E] hover:bg-[#12332B] p-2 text-left transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <p className="font-bold text-[11px] text-emerald-200 truncate">Welcome & Intro</p>
                      <p className="text-[9px] font-mono text-emerald-400">adv_lead_welcome</p>
                    </button>
                    <button
                      type="button"
                      disabled={waSending}
                      onClick={() => handleQuickWhatsAppSend("adv_kyc_nudge", [lead.name, lead.id])}
                      className="rounded-lg border border-emerald-500/30 bg-[#0D241E] hover:bg-[#12332B] p-2 text-left transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <p className="font-bold text-[11px] text-emerald-200 truncate">KYC / RPM Nudge</p>
                      <p className="text-[9px] font-mono text-emerald-400">adv_kyc_nudge</p>
                    </button>
                    <button
                      type="button"
                      disabled={waSending}
                      onClick={() => handleQuickWhatsAppSend("adv_plan_activation", [lead.name, lead.segment || "Index Options", lead.id])}
                      className="rounded-lg border border-emerald-500/30 bg-[#0D241E] hover:bg-[#12332B] p-2 text-left transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <p className="font-bold text-[11px] text-emerald-200 truncate">Plan Activation</p>
                      <p className="text-[9px] font-mono text-emerald-400">adv_plan_activation</p>
                    </button>
                  </div>
                </div>

                {/* Dispositioning Buttons */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
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
                              ? "ring-2 ring-cyan-400 border-transparent shadow-md font-bold " + disp.color
                              : "border-[#1E293B] bg-[#0E1624] text-slate-300 hover:bg-[#162235] hover:text-white"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      2. Consultation Notes & Next Action:
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">Appends to audit trail</span>
                  </div>

                  {/* Quick Note Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_NOTES.map((qn) => (
                      <button
                        key={qn}
                        type="button"
                        onClick={() => setNotes((prev) => (prev ? `${prev}; ${qn}` : qn))}
                        className="rounded-lg border border-[#1E293B] bg-[#0E1624] px-2 py-0.5 text-[11px] text-slate-300 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors cursor-pointer"
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
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Schedule Next Follow-up */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      3. Schedule Next Callback (Optional):
                    </label>
                    <input
                      type="text"
                      value={nextFollowup}
                      onChange={(e) => setNextFollowup(e.target.value)}
                      placeholder="e.g. Tomorrow 10:30 AM or Post-market 4:00 PM"
                      className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end self-end pt-5">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSaveInteraction}
                      className="rounded-xl bg-cyan-400 hover:bg-cyan-300 px-6 py-2.5 text-xs font-bold text-[#05070B] shadow-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? "Saving..." : "Save & Wrap Up"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Lead Dossier & Suitability Summary (5 cols) */}
              <div className="md:col-span-5 space-y-4 border-t md:border-t-0 md:border-l border-[#1E293B] md:pl-6">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Lead Dossier & Intent
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">Captured: {lead.createdAt}</span>
                </div>

                {/* NPC Recycler Cadence Status */}
                <div className="rounded-xl border border-orange-500/30 bg-[#1C120B] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-300">NPC Attempt Cadence</span>
                    <span className="font-mono text-xs font-bold text-orange-400">
                      {currentNpc} of 7 Attempts
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-orange-950/80 rounded-full h-1.5">
                    <div
                      className="bg-orange-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (currentNpc / 7) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-orange-300/80">
                    {currentNpc >= 7
                      ? "Maximum NPC threshold reached. Lead auto-recycled to Cold Nurture."
                      : `${7 - currentNpc} attempts remaining before auto-cold recycling.`}
                  </p>
                </div>

                {/* Capital & Segment Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[#0E1624] border border-[#1E293B] p-2.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Declared Capital</span>
                    <p className="font-bold font-mono text-white mt-0.5">{lead.capital}</p>
                  </div>
                  <div className="rounded-lg bg-[#0E1624] border border-[#1E293B] p-2.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Preferred Segment</span>
                    <p className="font-semibold text-white mt-0.5">{lead.segment || "General Advisory"}</p>
                  </div>
                </div>

                {/* Risk Assessment Score (if taken) */}
                {lead.assessment ? (
                  <div className="rounded-xl border border-cyan-500/30 bg-[#0B1A24] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300">SEBI Suitability Matrix</span>
                      <Badge tone="positive">Score: {lead.assessment.score}/100</Badge>
                    </div>
                    <p className="text-xs font-semibold text-cyan-200 mt-1">
                      Profile: {lead.assessment.category}
                    </p>
                    {lead.assessment.suitability_summary && (
                      <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                        {lead.assessment.suitability_summary}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 text-center">
                    <span className="text-xs font-medium text-slate-300">
                      Risk Assessment Questionnaire Pending
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Prompt client to complete suitability declaration.
                    </p>
                  </div>
                )}

                {/* Lead Message Note */}
                {lead.message && (
                  <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Inbound Inquiry Message</span>
                    <p className="text-xs text-slate-200 italic mt-1">&quot;{lead.message}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP DIRECT BRIDGE */}
          {activeTab === "whatsapp" && (
            <div className="rounded-2xl border border-ink-200 bg-[#090E17] text-white overflow-hidden shadow-lg space-y-0">
              <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>{lead.name}</span>
                    <span className="font-mono text-xs text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">
                      {lead.mobile}
                    </span>
                  </h4>
                  <p className="text-[11px] text-ink-400 font-mono mt-0.5">
                    Official Sender: +91 92018 00995 • Ref: {lead.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchWhatsAppThread(lead.id, lead.mobile)}
                  className="rounded-lg border border-[#1E293B] bg-[#162235] px-3 py-1.5 text-xs text-ink-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={cx("size-3.5", waLoading && "animate-spin")} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Chat Thread Messages */}
              <div className="p-5 h-[320px] overflow-y-auto space-y-3 bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:16px_16px]">
                {waLoading ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-ink-400 text-xs">
                    <Loader2 className="size-4 animate-spin text-emerald-400" />
                    <span>Loading conversation...</span>
                  </div>
                ) : waMessages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-ink-400 italic">
                    No WhatsApp interactions recorded for this lead yet. Send a pre-approved template below.
                  </div>
                ) : (
                  waMessages.map((m, idx) => {
                    const isRep = m.sender === "rep" || m.sender === "system";
                    return (
                      <div
                        key={idx}
                        className={cx(
                          "flex flex-col max-w-md rounded-2xl p-3 text-xs leading-relaxed",
                          isRep
                            ? "ml-auto bg-[#0A3D28] text-white border border-[#166534]"
                            : "mr-auto bg-[#162235] text-white border border-[#23354E]"
                        )}
                      >
                        {m.templateName && (
                          <span className="text-[9px] font-mono font-bold text-emerald-300 uppercase mb-1">
                            {m.templateName}
                          </span>
                        )}
                        <p>{m.text}</p>
                        <span className="text-[10px] text-ink-400 self-end mt-1 font-mono">{m.time}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Template Buttons & Text Dispatch */}
              <div className="p-4 border-t border-[#1E293B] bg-[#0B121E] space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto text-[11px] font-mono">
                  <span className="text-ink-400 shrink-0 font-bold uppercase">Quick Templates:</span>
                  <button
                    type="button"
                    disabled={waSending}
                    onClick={() => handleQuickWhatsAppSend("adv_lead_welcome", [lead.name, lead.id])}
                    className="rounded-lg bg-[#162235] hover:bg-[#1E2D44] text-emerald-300 px-2.5 py-1 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    + Welcome ({lead.name})
                  </button>
                  <button
                    type="button"
                    disabled={waSending}
                    onClick={() => handleQuickWhatsAppSend("adv_risk_assessment_cert", [lead.name, lead.segment || "Growth", lead.id])}
                    className="rounded-lg bg-[#162235] hover:bg-[#1E2D44] text-emerald-300 px-2.5 py-1 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    + RPM Certificate
                  </button>
                  <button
                    type="button"
                    disabled={waSending}
                    onClick={() => handleQuickWhatsAppSend("adv_kyc_nudge", [lead.name, lead.id])}
                    className="rounded-lg bg-[#162235] hover:bg-[#1E2D44] text-emerald-300 px-2.5 py-1 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    + KYC Nudge
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={waText}
                    disabled={waSending}
                    onChange={(e) => setWaText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendWhatsAppText();
                    }}
                    placeholder="Type custom compliance reply to client..."
                    className="flex-1 rounded-xl border border-[#1E293B] bg-[#0E1624] px-4 py-2.5 text-xs text-white placeholder-ink-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={waSending || !waText.trim()}
                    onClick={handleSendWhatsAppText}
                    className="rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black px-4 py-2.5 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {waSending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OBJECTION HANDLING PLAYBOOK */}
          {activeTab === "playbook" && (
            <div className="grid gap-6 md:grid-cols-12">
              {/* Objection Index List (4 cols) */}
              <div className="md:col-span-5 space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Objection Library ({filteredScripts.length})
                  </span>
                </div>
                <input
                  type="text"
                  value={scriptSearch}
                  onChange={(e) => setScriptSearch(e.target.value)}
                  placeholder="Filter scripts (e.g. fees, loss, sebi)..."
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none mb-2"
                />

                <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredScripts.map((script) => {
                    const isSelected = activeScriptId === script.id;
                    return (
                      <button
                        key={script.id}
                        type="button"
                        onClick={() => setActiveScriptId(script.id)}
                        className={cx(
                          "w-full text-left rounded-xl p-2.5 border transition-all cursor-pointer",
                          isSelected
                            ? "bg-cyan-500/20 border-cyan-400 text-white shadow-sm"
                            : "bg-[#0E1624] border-[#1E293B] hover:bg-[#162235] text-slate-300 hover:text-white"
                        )}
                      >
                        <span className="text-[9px] font-mono uppercase text-cyan-400 font-bold block">
                          {script.tag}
                        </span>
                        <p className="text-xs font-bold text-white mt-0.5 leading-snug">{script.title}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Script Detail (7 cols) */}
              <div className="md:col-span-7">
                {(() => {
                  const active = OBJECTION_SCRIPTS.find((s) => s.id === activeScriptId) || OBJECTION_SCRIPTS[0];
                  return (
                    <div className="rounded-2xl p-5 space-y-4 border-l-4 border-l-cyan-400 bg-[#0E1624] border-y border-r border-[#1E293B] shadow-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold px-2 py-0.5">
                            {active.tag}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-2 font-display">
                            &quot;{active.question}&quot;
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNotes((prev) => (prev ? `${prev}; Handled objection: ${active.title}` : `Handled objection: ${active.title}`));
                            showToast(`Appended "${active.title}" to consultation notes`);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-[#1E293B] bg-[#162235] hover:bg-[#1E2D45] px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <Copy className="size-3" />
                          <span>Add to Notes</span>
                        </button>
                      </div>

                      <div className="rounded-xl bg-[#070B14] p-4 border border-[#1E293B]">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block mb-1">
                          Recommended Verbatim Response:
                        </span>
                        <p className="text-xs leading-relaxed text-slate-200">{active.script}</p>
                      </div>

                      <div className="rounded-xl bg-amber-950/30 p-3 border border-amber-500/40 flex items-start gap-2 text-amber-200 text-xs">
                        <ShieldCheck className="size-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{active.sebiNote}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 4: CALL HISTORY TIMELINE */}
          {activeTab === "history" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Interaction Audit History
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  {lead.callLogs?.length || 0} Total Interactions Logged
                </span>
              </div>

              {!lead.callLogs || lead.callLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No previous phone calls logged for this lead yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lead.callLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
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
                          <span className="text-xs font-mono text-slate-400">{log.timestamp}</span>
                          <span className="text-xs font-semibold text-slate-200">• Rep: {log.agent}</span>
                        </div>
                        {log.notes && <p className="text-xs text-slate-300 italic mt-0.5">&quot;{log.notes}&quot;</p>}
                      </div>

                      <div className="font-mono text-xs text-slate-400 sm:text-right">
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
