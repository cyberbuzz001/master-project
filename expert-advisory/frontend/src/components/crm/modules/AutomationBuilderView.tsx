"use client";

import React from "react";
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
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";

const WORKFLOWS = [
  {
    id: "wf-1",
    name: "VIP / Hot Lead Fast-Track Routing",
    active: true,
    trigger: "New Lead Created (Web Form / Risk Test)",
    condition: "AI Score >= 80 OR Capital >= ₹10 Lakhs",
    actions: [
      "Assign Senior Wealth Specialist via Round-Robin",
      "Create Urgent Call Task (Due in 15 mins)",
      "Send WhatsApp Welcome & Investor Charter PDF",
      "Notify Sales Manager via Slack/In-App",
    ],
  },
  {
    id: "wf-2",
    name: "Proactive Subscription Renewal Cadence (T-7d)",
    active: true,
    trigger: "Subscription Expiry <= 7 Days",
    condition: "Status == ACTIVE AND Days Remaining == 7",
    actions: [
      "Dispatch Pre-Approved WhatsApp Renewal Notice",
      "Create Renewal Follow-up Task for Assigned RM",
      "Generate Pro-Forma Renewal Invoice with 10% Loyalty Credit",
    ],
  },
  {
    id: "wf-3",
    name: "NPC (Not Picked) Smart 7-Attempt Recycler",
    active: true,
    trigger: "Call Outcome Marked as 'NPC'",
    condition: "NPC Attempts < 7",
    actions: [
      "Increment Lead NPC Counter (+1)",
      "Auto-Schedule Next Call: Attempt +1 in 4 Hours",
      "If NPC Count == 7: Auto-Move to 'Cold Nurture'",
    ],
  },
];

export function AutomationBuilderView() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              CRM Automation Builder & Workflow Engine
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20 flex items-center gap-1.5">
              <Zap className="size-3.5 text-brand-400" />
              <span>TRIGGER → CONDITION → ACTION</span>
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Automate lead allocation, SLA escalations, renewal reminders, and multi-channel messaging flows.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-md"
        >
          <Plus className="size-4" />
          <span>Create New Workflow</span>
        </button>
      </div>

      {/* Active Workflows Grid */}
      <div className="space-y-4">
        {WORKFLOWS.map((wf) => (
          <div
            key={wf.id}
            className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-4 shadow-xl hover:border-brand-500/50 transition-colors"
          >
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
                  <Zap className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{wf.name}</h3>
                  <span className="text-[11px] font-mono text-ink-400">{wf.id}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 text-xs font-mono font-bold border border-emerald-500/30">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE
                </span>
              </div>
            </div>

            {/* Visual Workflow Steps */}
            <div className="grid gap-3 sm:grid-cols-3 text-xs font-mono">
              {/* Trigger */}
              <div className="rounded-xl border border-blue-500/30 bg-[#0B1524] p-3.5 space-y-1">
                <span className="text-[10px] text-blue-400 uppercase font-bold block">1. When Trigger Occurs</span>
                <p className="text-white font-semibold font-sans">{wf.trigger}</p>
              </div>

              {/* Condition */}
              <div className="rounded-xl border border-purple-500/30 bg-[#120E24] p-3.5 space-y-1">
                <span className="text-[10px] text-purple-400 uppercase font-bold block">2. If Condition Matches</span>
                <p className="text-white font-semibold font-sans">{wf.condition}</p>
              </div>

              {/* Actions */}
              <div className="rounded-xl border border-emerald-500/30 bg-[#0A1A14] p-3.5 space-y-1">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">3. Then Execute Actions</span>
                <div className="space-y-1 text-ink-300 font-sans text-[11px]">
                  {wf.actions.map((act, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
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
    </div>
  );
}
