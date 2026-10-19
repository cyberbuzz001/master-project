"use client";

import React, { useState } from "react";
import {
  User,
  ShieldCheck,
  Calendar,
  CreditCard,
  FileCheck2,
  PhoneCall,
  MessageSquare,
  LifeBuoy,
  Briefcase,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ReceiptIndianRupee,
  ChevronRight,
  ExternalLink,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Send,
  Check,
  Tag,
  Flame,
  X,
  Play,
  RotateCw,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type {
  Customer360,
  TimelineEvent,
  CrmPayment,
  AdvisoryRecommendation,
  CallLogItem,
  CrmTask,
  CrmTicket,
} from "@/lib/crm-data";

interface Customer360ViewProps {
  customers: Customer360[];
  timeline: TimelineEvent[];
  payments: CrmPayment[];
  recommendations: AdvisoryRecommendation[];
  onInitiateCall?: (customer: Customer360) => void;
}

const TABS = [
  "Overview",
  "Timeline",
  "Calls",
  "WhatsApp",
  "Payments",
  "Subscriptions",
  "Advisory",
  "Portfolio",
  "Documents",
  "Tickets",
  "Tasks",
  "Notes",
] as const;

export function Customer360View({
  customers,
  timeline,
  payments,
  recommendations,
  onInitiateCall,
}: Customer360ViewProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || "");
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Overview");

  // Local interactive state for tabs
  const [newNoteText, setNewNoteText] = useState("");
  const [clientNotes, setClientNotes] = useState<Record<string, Array<{ id: string; author: string; text: string; time: string }>>>({
    "CUST-1001": [
      { id: "n1", author: "Sunita Verma", text: "Client requested weekly portfolio rebalance review on Saturdays.", time: "Yesterday, 04:30 PM" },
      { id: "n2", author: "Compliance Cell", text: "SEBI Risk Profile Suitability Assessment verified via DigiLocker.", time: "08 Oct 2026" },
    ],
  });

  const [newWhatsAppMsg, setNewWhatsAppMsg] = useState("");
  const [clientChats, setClientChats] = useState<Record<string, Array<{ id: string; sender: "client" | "agent"; text: string; time: string }>>>({
    "CUST-1001": [
      { id: "m1", sender: "agent", text: "Namaste Arjun ji, welcome to Expert Stocks HNI Bespoke Advisory. Your onboarding docket is ready.", time: "08 Oct 11:35 AM" },
      { id: "m2", sender: "client", text: "Thank you Sunita ji. Received the WhatsApp notification and invoice.", time: "08 Oct 11:42 AM" },
      { id: "m3", sender: "agent", text: "Dr. Ananya Ray has published your weekly positional ideas in your client portal.", time: "Yesterday, 10:00 AM" },
    ],
  });

  const [tasksList, setTasksList] = useState<Record<string, Array<{ id: string; title: string; due: string; done: boolean; tag: string }>>>({
    "CUST-1001": [
      { id: "t1", title: "Conduct quarterly suitability review", due: "15 Oct 2026", done: false, tag: "Compliance" },
      { id: "t2", title: "Review banking sector allocation", due: "20 Oct 2026", done: false, tag: "Advisory" },
      { id: "t3", title: "Send Diwali festival market outlook report", due: "25 Oct 2026", done: true, tag: "Relationship" },
    ],
  });

  const [ticketsList, setTicketsList] = useState<Record<string, Array<{ id: string; subject: string; status: string; priority: string; date: string }>>>({
    "CUST-1001": [
      { id: "TKT-2026-9041", subject: "Inquiry on dividend distribution taxation under advisory", status: "RESOLVED", priority: "MEDIUM", date: "09 Oct 2026" },
    ],
  });

  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);

  const customer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  if (!customer) return null;

  const customerTimeline = timeline.filter((t) => t.customerId === customer.id);
  const customerPayments = payments.filter((p) => p.customerId === customer.id || p.customerName === customer.name);

  // Tab Action Handlers
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const noteObj = {
      id: `note-${Date.now()}`,
      author: customer.relationshipManager || "Relationship Manager",
      text: newNoteText.trim(),
      time: "Just now",
    };
    setClientNotes((prev) => ({
      ...prev,
      [customer.id]: [noteObj, ...(prev[customer.id] || [])],
    }));
    setNewNoteText("");
  };

  const handleSendWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhatsAppMsg.trim()) return;
    const msgObj = {
      id: `w-${Date.now()}`,
      sender: "agent" as const,
      text: newWhatsAppMsg.trim(),
      time: "Just now",
    };
    setClientChats((prev) => ({
      ...prev,
      [customer.id]: [...(prev[customer.id] || []), msgObj],
    }));
    setNewWhatsAppMsg("");
  };

  const handleToggleTask = (taskId: string) => {
    setTasksList((prev) => ({
      ...prev,
      [customer.id]: (prev[customer.id] || []).map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t
      ),
    }));
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim()) return;
    const tkt = {
      id: `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      subject: newTicketSubject.trim(),
      status: "OPEN",
      priority: "HIGH",
      date: "Today, Just now",
    };
    setTicketsList((prev) => ({
      ...prev,
      [customer.id]: [tkt, ...(prev[customer.id] || [])],
    }));
    setNewTicketSubject("");
    setShowNewTicketModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Customer 360° Profile & Lifecycle Desk
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              KYC & SUITABILITY VERIFIED
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Unified view of subscriptions, portfolio exposure, communication logs, and statutory audit events.
          </p>
        </div>

        {/* Customer Quick Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-400">Select Client:</span>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.customerCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer 360 Header Card */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
              {customer.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold font-display text-white">{customer.name}</h2>
                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  {customer.customerCode}
                </span>
                <span className="rounded-full bg-brand-500/15 text-brand-300 text-[10px] font-mono px-2 py-0.5 border border-brand-500/30">
                  {customer.riskCategory} Risk
                </span>
              </div>
              <p className="text-xs text-ink-400 mt-1">
                {customer.mobile} • {customer.email} • Client since {customer.joinedDate}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-[#0E1624] border border-[#1E293B] p-2.5 text-right font-mono">
              <span className="text-[10px] text-ink-400 uppercase block">Customer Lifetime Value</span>
              <strong className="text-emerald-400 text-sm">
                ₹{customer.customerValue.toLocaleString("en-IN")}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => onInitiateCall && onInitiateCall(customer)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-md"
            >
              <PhoneCall className="size-4" />
              <span>Call Client</span>
            </button>
          </div>
        </div>

        {/* Quick Health & RM Meta Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#1E293B] text-xs">
          <div>
            <span className="text-[10px] font-mono uppercase text-ink-400 block">Health Score</span>
            <span
              className={cx(
                "font-bold font-mono mt-0.5 inline-block",
                customer.healthScore === "Healthy" ? "text-emerald-400" : "text-amber-400"
              )}
            >
              ● {customer.healthScore}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-ink-400 block">Current Plan</span>
            <span className="font-semibold text-white mt-0.5 block truncate">
              {customer.currentSubscription.planName}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-ink-400 block">Renewal In</span>
            <span className="font-bold font-mono text-cyan-400 mt-0.5 block">
              {customer.currentSubscription.daysRemaining} Days ({customer.currentSubscription.expiryDate})
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-ink-400 block">Assigned RM</span>
            <span className="font-semibold text-white mt-0.5 block">
              {customer.relationshipManager}
            </span>
          </div>
        </div>
      </div>

      {/* 12 TABS NAVIGATION */}
      <div className="border-b border-[#1E293B] bg-[#090E17] rounded-xl px-2 overflow-x-auto">
        <nav className="flex space-x-1 py-2">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cx(
                  "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                  active
                    ? "bg-brand-600 text-white shadow-xs"
                    : "text-ink-400 hover:text-white hover:bg-[#162030]"
                )}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === "Overview" && (
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-7 space-y-4">
            <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-mono">
                Declared Portfolio & Market Engagement
              </h3>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Trading Capital</span>
                  <p className="font-bold text-white mt-1 text-sm font-mono">{customer.portfolioSize}</p>
                </div>
                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Open Positions</span>
                  <p className="font-bold text-white mt-1 text-sm font-mono">{customer.openPositionsCount} Active</p>
                </div>
                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Tracked P&L</span>
                  <p className="font-bold text-emerald-400 mt-1 text-sm font-mono">{customer.realizedPnlPercent}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-[#0A1624] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="size-4" />
                  <span>SEBI Regulatory & Suitability Status</span>
                </span>
                <Badge tone="positive">100% Compliant</Badge>
              </div>
              <div className="text-xs space-y-1.5 text-ink-300">
                <p>• <strong>Suitability Matrix:</strong> Score {customer.riskScore}/100 verified on DigiLocker.</p>
                <p>• <strong>Masked PAN:</strong> {customer.panMasked} (NSDL Active).</p>
                <p>• <strong>Masked Aadhaar:</strong> {customer.aadhaarMasked} (e-KYC Completed).</p>
                <p>• <strong>Service Agreement:</strong> Digitally accepted with SHA-256 fingerprint timestamp.</p>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono flex items-center gap-1.5">
              <Sparkles className="size-4" />
              <span>AI Retention & Renewal Intelligence</span>
            </h3>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Churn Risk Probability:</span>
                <span className="font-mono text-emerald-400 font-bold">Low (4.2%)</span>
              </div>
              <p className="text-xs text-ink-300">{customer.healthRationale}</p>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase text-ink-400">Automated Renewal Milestones:</span>
              <div className="space-y-1.5 text-xs text-ink-300">
                <div className="flex justify-between py-1 border-b border-[#1E293B]">
                  <span>30 Days Reminder:</span>
                  <span className="font-mono text-emerald-400">Sent (Read)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1E293B]">
                  <span>15 Days Reminder:</span>
                  <span className="font-mono text-amber-400">Scheduled in 21d</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Relationship Call:</span>
                  <span className="font-mono text-brand-300">RM Assigned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: TIMELINE ── */}
      {activeTab === "Timeline" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Unified Chronological Customer Journey
            </h3>
            <span className="text-[11px] font-mono text-ink-400">
              {customerTimeline.length || 3} Total Events Logged
            </span>
          </div>
          <div className="space-y-4 pt-2">
            {(customerTimeline.length > 0 ? customerTimeline : [
              { id: "e1", title: "Enrolled in HNI Bespoke Advisory", description: "Payment of ₹75,000 verified. RM Sunita Verma assigned.", timestamp: "08 Oct 2026 11:30 AM", agent: "System" },
              { id: "e2", title: "Risk Profile & KYC DigiLocker Verified", description: "Risk Score 62/100, Aadhaar e-Sign SHA-256 completed.", timestamp: "08 Oct 2026 11:25 AM", agent: "Compliance Cell" },
              { id: "e3", title: "Initial Consultation Call", description: "Discussed equity cash & hedged index derivative setups.", timestamp: "07 Oct 2026 04:15 PM", agent: "Sunita Verma" },
            ]).map((evt, idx) => (
              <div key={evt.id} className="relative flex items-start gap-4">
                <div className="relative z-10 size-8 rounded-full bg-[#162235] border border-brand-500/40 flex items-center justify-center text-brand-300 shrink-0 text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{evt.title}</span>
                    <span className="text-[10px] font-mono text-ink-400">{evt.timestamp}</span>
                  </div>
                  <p className="text-xs text-ink-300">{evt.description}</p>
                  <span className="text-[10px] font-mono text-brand-400 block pt-1">
                    Actor: {evt.agent}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: CALLS ── */}
      {activeTab === "Calls" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Encrypted Telecalling History & Call Logs
            </h3>
            <button
              type="button"
              onClick={() => onInitiateCall && onInitiateCall(customer)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              <PhoneCall className="size-3.5" />
              <span>Launch Dialer</span>
            </button>
          </div>
          <div className="space-y-3">
            {[
              { id: "call-1", agent: customer.relationshipManager || "Sunita Verma", duration: "06m 42s", disp: "Qualified & Enrolled", time: "08 Oct 2026, 11:20 AM", recording: "REC-2026-98102.mp3" },
              { id: "call-2", agent: "Vikram Malhotra", duration: "03m 15s", disp: "Follow-up Completed", time: "06 Oct 2026, 04:10 PM", recording: "REC-2026-97914.mp3" },
              { id: "call-3", agent: "Sunita Verma", duration: "01m 20s", disp: "Call Back Scheduled", time: "04 Oct 2026, 10:30 AM", recording: "REC-2026-97601.mp3" },
            ].map((c) => (
              <div key={c.id} className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{c.agent}</span>
                    <Badge tone="positive">{c.disp}</Badge>
                    <span className="font-mono text-cyan-400 text-xs">Duration: {c.duration}</span>
                  </div>
                  <p className="text-ink-400 text-[11px] mt-0.5">{c.time} • Statutory Recording Stored (3y SEBI retention)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-1">
                    <Play className="size-3" />
                    <span>Play Audio</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: WHATSAPP ── */}
      {activeTab === "WhatsApp" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-[#22C55E]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                Official WhatsApp Business Thread ({customer.mobile})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">Meta Cloud API Connected</span>
          </div>

          {/* Chat Window */}
          <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4 h-72 overflow-y-auto space-y-3">
            {(clientChats[customer.id] || []).map((msg) => (
              <div
                key={msg.id}
                className={cx(
                  "max-w-md rounded-xl p-3 text-xs space-y-1",
                  msg.sender === "agent"
                    ? "ml-auto bg-brand-600/30 border border-brand-500/40 text-white"
                    : "mr-auto bg-[#162030] border border-[#1E293B] text-ink-200"
                )}
              >
                <p>{msg.text}</p>
                <span className="text-[9px] font-mono text-ink-400 block text-right">{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendWhatsApp} className="flex gap-2">
            <input
              type="text"
              placeholder="Type official advisory message or dispatch SEBI update..."
              value={newWhatsAppMsg}
              onChange={(e) => setNewWhatsAppMsg(e.target.value)}
              className="flex-1 rounded-xl border border-[#1E293B] bg-[#0E1624] px-4 py-2.5 text-xs text-white placeholder-ink-400 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#22C55E] hover:bg-[#1ea950] text-white px-5 py-2.5 text-xs font-bold cursor-pointer transition-colors"
            >
              <Send className="size-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 5: PAYMENTS ── */}
      {activeTab === "Payments" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Verified Payments & GST Invoices (SAC 997159)
            </h3>
            <span className="text-xs font-mono text-emerald-400">Total Paid: ₹{customer.customerValue.toLocaleString("en-IN")}</span>
          </div>
          <div className="space-y-2">
            {customerPayments.length > 0 ? (
              customerPayments.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">₹{p.amount.toLocaleString("en-IN")}</span>
                      <Badge tone="positive">{p.status}</Badge>
                    </div>
                    <p className="text-xs text-ink-400 mt-0.5">
                      Invoice: {p.invoiceNumber} • Gateway: {p.gateway} • GST: ₹{p.gstAmount.toLocaleString("en-IN")} (18%)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-ink-400">{p.date}</span>
                    <button
                      type="button"
                      className="rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-300 px-3 py-1.5 text-xs font-bold flex items-center gap-1 hover:bg-brand-600/30 cursor-pointer"
                    >
                      <Download className="size-3" />
                      <span>Invoice PDF</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div
                className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">₹{customer.currentSubscription.amount.toLocaleString("en-IN")}</span>
                    <Badge tone="positive">SUCCESSFUL</Badge>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Invoice: INV-2026-0042 • Gateway: HDFC NetBanking • GST: ₹{(customer.currentSubscription.amount * 0.18 / 1.18).toFixed(0)} (18%)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-400">{customer.currentSubscription.startDate}</span>
                  <button
                    type="button"
                    className="rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-300 px-3 py-1.5 text-xs font-bold flex items-center gap-1 hover:bg-brand-600/30 cursor-pointer"
                  >
                    <Download className="size-3" />
                    <span>Invoice PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 6: SUBSCRIPTIONS ── */}
      {activeTab === "Subscriptions" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Active Advisory Subscription Plan
            </h3>
            <Badge tone="positive">ACTIVE MANDATE</Badge>
          </div>

          <div className="rounded-2xl border border-brand-500/30 bg-[#0E1624] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-white">{customer.currentSubscription.planName}</h4>
                <p className="text-xs text-ink-400 mt-0.5">Dedicated Advisory Coverage • Direct Analyst Access</p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-bold text-emerald-400">
                  ₹{customer.currentSubscription.amount.toLocaleString("en-IN")}
                </span>
                <span className="text-[11px] text-ink-400 block">Annual Advisory Fee</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[#1E293B] pt-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-mono text-ink-400 block">Activation Date</span>
                <span className="font-bold text-white font-mono">{customer.currentSubscription.startDate}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-ink-400 block">Renewal / Expiry Date</span>
                <span className="font-bold text-cyan-400 font-mono">{customer.currentSubscription.expiryDate}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-ink-400 block">Days Remaining</span>
                <span className="font-bold text-emerald-400 font-mono">{customer.currentSubscription.daysRemaining} Days</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-ink-400 block">Assigned Advisor</span>
                <span className="font-bold text-white">{customer.assignedAdvisor}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 7: ADVISORY ── */}
      {activeTab === "Advisory" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Active Research Calls Delivered to {customer.name}
            </h3>
            <span className="text-xs font-mono text-emerald-400">Research Desk Active</span>
          </div>
          <div className="space-y-3">
            {recommendations.slice(0, 3).map((rec) => (
              <div key={rec.id} className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{rec.symbol}</span>
                    <span className="font-mono text-[10px] bg-brand-500/10 text-brand-300 px-2 py-0.5 rounded border border-brand-500/20">{rec.instrumentType}</span>
                    <span className={cx(
                      "font-mono font-bold text-[11px] px-2 py-0.5 rounded",
                      rec.direction === "BUY" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                    )}>
                      {rec.direction}
                    </span>
                  </div>
                  <p className="text-ink-400 text-xs mt-1">
                    Entry: <strong className="text-white font-mono">{rec.entryRange}</strong> • Target 1: <strong className="text-emerald-400 font-mono">{rec.target1}</strong> • Stop Loss: <strong className="text-rose-400 font-mono">{rec.stopLoss}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone={rec.status === "ACTIVE" ? "neutral" : "positive"}>{rec.status}</Badge>
                  <span className="text-[10px] font-mono text-ink-400 block mt-1">{rec.publishedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 8: PORTFOLIO ── */}
      {activeTab === "Portfolio" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Tracked Portfolio & Capital Deployment
            </h3>
            <span className="text-xs font-mono text-emerald-400">Total Capital: {customer.portfolioSize}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
              <span className="text-[10px] uppercase font-mono text-ink-400">Cash Equities (45%)</span>
              <p className="font-bold text-white mt-1 font-mono">₹20,25,000</p>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
              <span className="text-[10px] uppercase font-mono text-ink-400">Options Hedged (30%)</span>
              <p className="font-bold text-white mt-1 font-mono">₹13,50,000</p>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
              <span className="text-[10px] uppercase font-mono text-ink-400">Liquid Cash (25%)</span>
              <p className="font-bold text-emerald-400 mt-1 font-mono">₹11,25,000</p>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
              <span className="text-[10px] uppercase font-mono text-ink-400">Net Realized P&L</span>
              <p className="font-bold text-emerald-400 mt-1 font-mono">{customer.realizedPnlPercent}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 9: DOCUMENTS ── */}
      {activeTab === "Documents" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              SEBI Statutory & Identity Dossier
            </h3>
            <span className="text-xs font-mono text-emerald-400">All 4 Mandatory Documents Verified</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: "DigiLocker PAN Card", id: customer.panMasked, status: "NSDL VERIFIED", date: "08 Oct 2026" },
              { title: "Aadhaar e-KYC Proof", id: customer.aadhaarMasked, status: "UIDAI VERIFIED", date: "08 Oct 2026" },
              { title: "SEBI Risk Profile Assessment", id: `Score: ${customer.riskScore}/100`, status: "COMPLIANT", date: "08 Oct 2026" },
              { title: "Digital Advisory Agreement", id: "SHA-256 e-Sign Accepted", status: "LEGALLY BINDING", date: "08 Oct 2026" },
            ].map((doc) => (
              <div key={doc.title} className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{doc.title}</div>
                  <div className="font-mono text-cyan-400 text-[11px] mt-0.5">{doc.id}</div>
                  <span className="text-ink-400 text-[10px] font-mono">{doc.date}</span>
                </div>
                <Badge tone="positive">{doc.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 10: TICKETS ── */}
      {activeTab === "Tickets" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Client Support Desk & SEBI SCORES Escalations
            </h3>
            <button
              type="button"
              onClick={() => setShowNewTicketModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Log Grievance / Ticket</span>
            </button>
          </div>
          <div className="space-y-3">
            {(ticketsList[customer.id] || []).length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-400 italic">No tickets or grievances logged for this client.</div>
            ) : (
              (ticketsList[customer.id] || []).map((tkt) => (
                <div key={tkt.id} className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-brand-400 font-bold">{tkt.id}</span>
                      <Badge tone={tkt.status === "RESOLVED" ? "positive" : "warning"}>{tkt.status}</Badge>
                      <span className="font-mono text-[10px] text-amber-400">{tkt.priority}</span>
                    </div>
                    <p className="text-white mt-1">{tkt.subject}</p>
                  </div>
                  <span className="text-[11px] font-mono text-ink-400">{tkt.date}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 11: TASKS ── */}
      {activeTab === "Tasks" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Action Items & RM Follow-up Checklist
            </h3>
            <span className="text-xs font-mono text-brand-300">{(tasksList[customer.id] || []).filter((t) => !t.done).length} Pending</span>
          </div>
          <div className="space-y-2.5">
            {(tasksList[customer.id] || []).map((t) => (
              <div
                key={t.id}
                onClick={() => handleToggleTask(t.id)}
                className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 flex items-center justify-between text-xs cursor-pointer hover:border-brand-500/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cx(
                      "size-5 rounded-md border flex items-center justify-center transition-colors",
                      t.done
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "border-[#1E293B] bg-[#090E17]"
                    )}
                  >
                    {t.done && <Check className="size-3.5" />}
                  </div>
                  <span className={cx(t.done ? "line-through text-ink-500" : "text-white font-medium")}>
                    {t.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">{t.tag}</span>
                  <span className="font-mono text-ink-400 text-[11px]">{t.due}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 12: NOTES ── */}
      {activeTab === "Notes" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Internal Relationship Manager & Compliance Notes
            </h3>
            <span className="text-xs font-mono text-ink-400">Encrypted Notes Vault</span>
          </div>

          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              placeholder="Add internal advisory note for this client..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="flex-1 rounded-xl border border-[#1E293B] bg-[#0E1624] px-4 py-2.5 text-xs text-white placeholder-ink-400 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 text-xs font-bold cursor-pointer transition-colors"
            >
              <Plus className="size-3.5" />
              <span>Add Note</span>
            </button>
          </form>

          <div className="space-y-3 pt-2">
            {(clientNotes[customer.id] || []).map((note) => (
              <div key={note.id} className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-300">{note.author}</span>
                  <span className="font-mono text-[10px] text-ink-400">{note.time}</span>
                </div>
                <p className="text-ink-200">{note.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW TICKET MODAL */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="font-bold text-base text-white">Log Support Ticket / Grievance</h3>
              <button
                type="button"
                onClick={() => setShowNewTicketModal(false)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">Subject / Summary</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inbound query regarding Nifty options allocation"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 font-bold shadow-md cursor-pointer"
                >
                  Log Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
