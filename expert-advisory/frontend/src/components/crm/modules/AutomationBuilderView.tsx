"use client";

import React, { useState } from "react";
import {
  Zap,
  ArrowRight,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Settings,
  Bell,
  Mail,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Power,
  Sliders,
  Send,
  FileCheck,
  Layers,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";

interface AutomationWorkflow {
  id: string;
  name: string;
  active: boolean;
  eventTopic: string;
  trigger: string;
  condition: string;
  actions: string[];
  templateUsed?: string;
  avgLatency: string;
  totalTriggered: number;
}

interface AuditLogItem {
  id: string;
  timestamp: string;
  event: string;
  recipient: string;
  channel: "WhatsApp Cloud API" | "Internal Event Bus" | "CRM Dialer Queue" | "Email Dispatch";
  status: "DELIVERED" | "SENT" | "ACKNOWLEDGED" | "READ";
  latencyMs: number;
  details: string;
}

const INITIAL_WORKFLOWS: AutomationWorkflow[] = [
  {
    id: "WF-01",
    name: "Inbound Lead Instant Engagement & Cadence",
    active: true,
    eventTopic: "stream:leads -> lead.captured",
    trigger: "New Lead Ingested (Web Form / Risk Test / Ads)",
    condition: "E.164 Mobile Validated & Consent Granted",
    actions: [
      "Compute AI Priority Score (Capital Bracket & Risk Tier)",
      "Assign Telecaller via Weighted Round-Robin Queue",
      "Dispatch Meta WhatsApp Welcome (Template: adv_lead_welcome)",
      "Create 5-Minute Inbound Speed-to-Lead Callback Task",
    ],
    templateUsed: "adv_lead_welcome",
    avgLatency: "1.8s",
    totalTriggered: 1420,
  },
  {
    id: "WF-02",
    name: "Statutory Risk Profiling & KYC Verification Alert",
    active: true,
    eventTopic: "stream:kyc -> kyc.verified",
    trigger: "Client Submits 20-Factor Suitability (RPM)",
    condition: "Score Computed (Conservative / Moderate / Aggressive)",
    actions: [
      "Dispatch WhatsApp Suitability Certificate (adv_risk_assessment_cert)",
      "Sync DigiLocker PAN / UIDAI Audit Timestamps",
      "If Aggressive F&O: Enforce Demat Trading History Gate",
      "Notify Relationship Manager for Advisory Agreement Sign-off",
    ],
    templateUsed: "adv_risk_assessment_cert",
    avgLatency: "2.1s",
    totalTriggered: 685,
  },
  {
    id: "WF-03",
    name: "SEBI Compliance-Approved Research Signal Broadcast",
    active: true,
    eventTopic: "stream:advisory -> rec.published",
    trigger: "Research Head & Compliance Sign-off Complete",
    condition: "Risk-Reward Ratio >= 1:2.0 AND Conflict Disclosed",
    actions: [
      "Broadcast WhatsApp Advisory Report (adv_research_report)",
      "Push Notification to Client Self-Service Cockpit (/portal)",
      "Dispatch Real-Time Signal to Verified Telegram Advisory Channel",
      "Log Immutable SHA-256 Regulatory Timestamp for SCORES Audit",
    ],
    templateUsed: "adv_research_report",
    avgLatency: "2.4s",
    totalTriggered: 312,
  },
  {
    id: "WF-04",
    name: "1-Click Broker Order Execution Confirmation",
    active: true,
    eventTopic: "stream:orders -> order.filled",
    trigger: "Fyers V3 / TradeGrow OMS Confirms Order Execution",
    condition: "Order Status == FILLED",
    actions: [
      "Dispatch WhatsApp Digital Trade Confirmation (adv_order_execution)",
      "Update Client Portfolio Positions & Margin Ledger in Real-Time",
      "Link Order Reference to Published Advisory Recommendation",
    ],
    templateUsed: "adv_order_execution",
    avgLatency: "1.6s",
    totalTriggered: 2450,
  },
  {
    id: "WF-05",
    name: "RMS Risk Engine Margin Deficit Breach Alert",
    active: true,
    eventTopic: "stream:risk -> margin.breached",
    trigger: "Client Total Available Margin Drops Below 100% Requirement",
    condition: "Deficit Amount > ₹1,000",
    actions: [
      "Dispatch High-Urgency WhatsApp Margin Alert (adv_margin_alert)",
      "Trigger SMS Gateway Fallback Notice",
      "Queue Automated RMS Square-Off Countdown Timer (15:15 IST)",
    ],
    templateUsed: "adv_margin_alert",
    avgLatency: "1.2s",
    totalTriggered: 84,
  },
  {
    id: "WF-06",
    name: "Subscription Expiry & Renewal Retention Cadence",
    active: true,
    eventTopic: "stream:subscriptions -> sub.renewal.due",
    trigger: "Advisory Subscription Expiry <= 7 Days",
    condition: "Status == ACTIVE AND Days Remaining <= 7",
    actions: [
      "Dispatch Pre-Approved WhatsApp Renewal Notice with 10% Loyalty Credit",
      "Create Retention Task for Assigned Relationship Manager",
      "Generate Pro-Forma GST Invoice for 1-Click Payment",
    ],
    templateUsed: "adv_plan_activation",
    avgLatency: "2.2s",
    totalTriggered: 418,
  },
];

const INITIAL_LOGS: AuditLogItem[] = [
  {
    id: "LOG-9841",
    timestamp: "Just now",
    event: "rec.published",
    recipient: "+91 98201 44210",
    channel: "WhatsApp Cloud API",
    status: "DELIVERED",
    latencyMs: 1820,
    details: "Dispatched 'adv_research_report' for NIFTY Large-Cap Alpha review (Ref: ESC-EQ-2026-042).",
  },
  {
    id: "LOG-9840",
    timestamp: "4 mins ago",
    event: "order.filled",
    recipient: "+91 94250 88219",
    channel: "WhatsApp Cloud API",
    status: "READ",
    latencyMs: 1450,
    details: "Executed BUY 50 units HDFCBANK @ ₹1,695 via Fyers V3. Order ID: FYERS-ORD-98412.",
  },
  {
    id: "LOG-9839",
    timestamp: "18 mins ago",
    event: "lead.captured",
    recipient: "+91 86024 67804",
    channel: "WhatsApp Cloud API",
    status: "READ",
    latencyMs: 1720,
    details: "Welcomed Rajesh Verma (TG-LEAD-9821). Assigned to Telecaller Vikram Malhotra.",
  },
  {
    id: "LOG-9838",
    timestamp: "32 mins ago",
    event: "kyc.verified",
    recipient: "+91 91114 33290",
    channel: "WhatsApp Cloud API",
    status: "DELIVERED",
    latencyMs: 2050,
    details: "Sent 20-Point RPM Certificate (Category: Moderate / Growth). Score: 78/100.",
  },
  {
    id: "LOG-9837",
    timestamp: "1 hour ago",
    event: "margin.breached",
    recipient: "+91 97551 22841",
    channel: "WhatsApp Cloud API",
    status: "DELIVERED",
    latencyMs: 1180,
    details: "Shortfall alert for ₹14,500 deficit. Square-off timer active for 15:15 IST.",
  },
];

export function AutomationBuilderView() {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(INITIAL_WORKFLOWS);
  const [logs, setLogs] = useState<AuditLogItem[]>(INITIAL_LOGS);
  const [activeTab, setActiveTab] = useState<"workflows" | "logs">("workflows");

  // New Workflow Modal State
  const [showModal, setShowModal] = useState(false);
  const [wfName, setWfName] = useState("");
  const [wfTrigger, setWfTrigger] = useState("lead.captured");
  const [wfCondition, setWfCondition] = useState("AI Score >= 75");
  const [wfAction, setWfAction] = useState("adv_lead_welcome");

  function toggleWorkflow(id: string) {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w))
    );
  }

  function handleCreateWorkflow(e: React.FormEvent) {
    e.preventDefault();
    if (!wfName.trim()) return;

    const newWf: AutomationWorkflow = {
      id: `WF-0${workflows.length + 1}`,
      name: wfName.trim(),
      active: true,
      eventTopic: `stream:custom -> ${wfTrigger}`,
      trigger: `Trigger: ${wfTrigger}`,
      condition: wfCondition,
      actions: [
        `Dispatch Meta WhatsApp Template: ${wfAction}`,
        "Log Audit Verification Record to PostgreSQL",
      ],
      templateUsed: wfAction,
      avgLatency: "1.9s",
      totalTriggered: 1,
    };

    setWorkflows([newWf, ...workflows]);
    setShowModal(false);
    setWfName("");
  }

  return (
    <div className="space-y-6 animate-fade-in text-ink-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Event-Driven Automation & WhatsApp Engine
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20 flex items-center gap-1.5">
              <Zap className="size-3.5 text-brand-400" />
              <span>PHASE 5 AUTOMATION HUB</span>
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Real-time event streams (Redis Streams) orchestrating Meta WhatsApp Cloud API templates, SLA timers, and order notifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-md shadow-brand-500/20"
          >
            <Plus className="size-4" />
            <span>Create Workflow</span>
          </button>

          <div className="flex items-center gap-1.5 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
            <button
              type="button"
              onClick={() => setActiveTab("workflows")}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "workflows" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Active Workflows ({workflows.filter((w) => w.active).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "logs" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Execution Audit Log ({logs.length})
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Real-Time Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-ink-400 font-mono">
            <span>ACTIVE AUTOMATIONS</span>
            <Zap className="h-4 w-4 text-brand-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {workflows.filter((w) => w.active).length} / {workflows.length}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono">100% Operational Health</div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-ink-400 font-mono">
            <span>AVG DISPATCH LATENCY</span>
            <Clock className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">1.82s</div>
          <div className="text-[11px] text-emerald-400 font-mono">✓ Well under &lt; 3.0s SLA</div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-ink-400 font-mono">
            <span>WHATSAPP SUCCESS RATE</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">99.4%</div>
          <div className="text-[11px] text-ink-400 font-mono">Verified Meta Cloud API</div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-ink-400 font-mono">
            <span>TOTAL EVENT EXECUTIONS</span>
            <Send className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {workflows.reduce((acc, w) => acc + w.totalTriggered, 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-ink-400 font-mono">Across All 6 Redis Streams</div>
        </div>
      </div>

      {/* TAB 1: Active Workflows List */}
      {activeTab === "workflows" && (
        <div className="space-y-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={cx(
                "rounded-2xl border bg-[#090E17] p-5 space-y-4 shadow-xl transition-all",
                wf.active ? "border-[#1E293B] hover:border-brand-500/50" : "border-slate-800/40 opacity-70"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1E293B] pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cx(
                      "size-9 rounded-xl flex items-center justify-center border",
                      wf.active
                        ? "bg-brand-500/15 border-brand-500/30 text-brand-400"
                        : "bg-slate-800/20 border-slate-700/30 text-ink-400"
                    )}
                  >
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>{wf.name}</span>
                      <span className="text-[10px] font-mono font-bold text-ink-400 px-2 py-0.5 rounded bg-[#0E1624] border border-[#1E293B]">
                        {wf.id}
                      </span>
                    </h3>
                    <span className="text-[11px] font-mono text-brand-300">{wf.eventTopic}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-ink-400">
                    Avg Latency: <strong className="text-cyan-300">{wf.avgLatency}</strong> • Triggered:{" "}
                    <strong className="text-white">{wf.totalTriggered.toLocaleString()}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWorkflow(wf.id)}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold border transition-colors cursor-pointer",
                      wf.active
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                        : "bg-slate-800/40 text-ink-400 border-slate-700/40 hover:bg-slate-800/60"
                    )}
                  >
                    <span
                      className={cx(
                        "size-1.5 rounded-full",
                        wf.active ? "bg-emerald-400 animate-pulse" : "bg-ink-500"
                      )}
                    />
                    {wf.active ? "ACTIVE" : "PAUSED"}
                  </button>
                </div>
              </div>

              {/* Visual Workflow Steps */}
              <div className="grid gap-3 sm:grid-cols-3 text-xs font-mono">
                {/* 1. Trigger */}
                <div className="rounded-xl border border-blue-500/30 bg-[#0B1524] p-3.5 space-y-1">
                  <span className="text-[10px] text-blue-400 uppercase font-bold block">1. When Event Triggers</span>
                  <p className="text-white font-semibold font-sans">{wf.trigger}</p>
                </div>

                {/* 2. Condition */}
                <div className="rounded-xl border border-purple-500/30 bg-[#120E24] p-3.5 space-y-1">
                  <span className="text-[10px] text-purple-400 uppercase font-bold block">2. Evaluate Condition</span>
                  <p className="text-white font-semibold font-sans">{wf.condition}</p>
                </div>

                {/* 3. Actions */}
                <div className="rounded-xl border border-emerald-500/30 bg-[#0A1A14] p-3.5 space-y-1">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                    3. Dispatch Multi-Channel Actions
                  </span>
                  <div className="space-y-1 text-ink-300 font-sans text-[11px]">
                    {wf.actions.map((act, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Execution Audit Log */}
      {activeTab === "logs" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                <FileCheck className="h-3.5 w-3.5 text-brand-400" />
                Real-Time Automation Execution Log (Redis Streams → Meta Cloud API)
              </h2>
              <span className="text-[11px] font-mono text-ink-400">
                Statutory audit log under IT Act Section 65B & SEBI Research Analyst regulations.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const newLog: AuditLogItem = {
                  id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
                  timestamp: "Just now",
                  event: "order.filled",
                  recipient: "+91 98201 44210",
                  channel: "WhatsApp Cloud API",
                  status: "DELIVERED",
                  latencyMs: 1640,
                  details: "Verified live signal delivery: BUY NIFTY 25000 CE (Fyers V3 executed).",
                };
                setLogs([newLog, ...logs]);
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#090E17] border border-[#1E293B] rounded-lg text-xs font-mono text-ink-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh Log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
                <tr>
                  <th className="px-5 py-3.5">Log ID & Time</th>
                  <th className="px-4 py-3.5">Event Stream</th>
                  <th className="px-4 py-3.5">Recipient</th>
                  <th className="px-4 py-3.5">Delivery Channel</th>
                  <th className="px-4 py-3.5">Latency</th>
                  <th className="px-4 py-3.5">Execution Details</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-ink-200 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#0E1624]/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white font-mono">{log.id}</div>
                      <span className="text-[10px] text-ink-400">{log.timestamp}</span>
                    </td>
                    <td className="px-4 py-4 text-brand-300 font-bold">{log.event}</td>
                    <td className="px-4 py-4 text-white font-semibold">{log.recipient}</td>
                    <td className="px-4 py-4 text-ink-300">{log.channel}</td>
                    <td className="px-4 py-4 text-cyan-300 font-bold">{log.latencyMs}ms</td>
                    <td className="px-4 py-4 font-sans text-xs text-ink-200 max-w-xs truncate">{log.details}</td>
                    <td className="px-5 py-4 text-right">
                      <Badge tone={log.status === "READ" ? "positive" : "neutral"}>{log.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Create New Automation Workflow */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090E17] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="font-bold text-white text-base font-mono uppercase tracking-wider flex items-center gap-2">
                <Plus className="h-4 w-4 text-brand-400" />
                Create Event-Driven Automation Workflow
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-ink-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkflow} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-ink-300 block mb-1">Workflow Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HNI Options Alpha Speed Cadence"
                  value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-ink-300 block mb-1">Trigger Event</label>
                  <select
                    value={wfTrigger}
                    onChange={(e) => setWfTrigger(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="lead.captured">lead.captured (Inbound Lead)</option>
                    <option value="kyc.verified">kyc.verified (Risk Profile Done)</option>
                    <option value="rec.published">rec.published (Research Call)</option>
                    <option value="order.filled">order.filled (Fyers V3 Executed)</option>
                    <option value="margin.breached">margin.breached (RMS Alert)</option>
                    <option value="sub.renewal.due">sub.renewal.due (Expiry &lt; 7d)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-ink-300 block mb-1">WhatsApp Template</label>
                  <select
                    value={wfAction}
                    onChange={(e) => setWfAction(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="adv_lead_welcome">adv_lead_welcome</option>
                    <option value="adv_risk_assessment_cert">adv_risk_assessment_cert</option>
                    <option value="adv_research_report">adv_research_report</option>
                    <option value="adv_order_execution">adv_order_execution</option>
                    <option value="adv_margin_alert">adv_margin_alert</option>
                    <option value="adv_kyc_nudge">adv_kyc_nudge</option>
                    <option value="adv_plan_activation">adv_plan_activation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-ink-300 block mb-1">Trigger Condition Logic</label>
                <input
                  type="text"
                  placeholder="e.g. AI Score >= 80 AND Capital >= ₹10 Lakhs"
                  value={wfCondition}
                  onChange={(e) => setWfCondition(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#0E1624] text-ink-300 hover:text-white text-xs font-bold rounded-xl border border-[#1E293B] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-500/20 cursor-pointer"
                >
                  Save & Activate Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
