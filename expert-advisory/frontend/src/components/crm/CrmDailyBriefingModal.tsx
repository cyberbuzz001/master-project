"use client";

import React from "react";
import {
  Sparkles,
  Flame,
  Clock,
  CreditCard,
  RotateCw,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  X,
  PhoneCall,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { CrmLead, Customer360, CrmTask } from "@/lib/crm-data";

interface CrmDailyBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkLead: (lead: CrmLead) => void;
  leads: CrmLead[];
  customers: Customer360[];
  tasks: CrmTask[];
  userName?: string;
}

export function CrmDailyBriefingModal({
  isOpen,
  onClose,
  onWorkLead,
  leads,
  customers,
  tasks,
  userName = "Priya Sharma",
}: CrmDailyBriefingModalProps) {
  if (!isOpen) return null;

  const hotLeads = leads.filter((l) => l.temperature === "VERY_HOT" || l.temperature === "HOT");
  const pendingPayments = leads.filter((l) => l.status === "PAYMENT_PENDING");
  const renewalsDue = customers.filter(
    (c) => c.status === "RENEWAL_DUE" || c.currentSubscription.daysRemaining <= 15
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl bg-[#090E17] border border-[#1E293B] shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E293B] bg-[#0E1624] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-display text-white">
                  Good Morning, {userName}!
                </h2>
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono px-2 py-0.5 border border-emerald-500/30">
                  AI BRIEFING ACTIVE
                </span>
              </div>
              <p className="text-xs text-ink-300 mt-0.5">
                Here is your prioritized execution queue for today, October 8, 2026.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Priority Summary Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 bg-[#0B121E] border-b border-[#1E293B]">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5">
            <div className="flex items-center justify-between text-xs text-red-400 font-mono">
              <span>HOT LEADS</span>
              <Flame className="size-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{hotLeads.length}</div>
            <p className="text-[11px] text-ink-400 mt-0.5">High conversion intent</p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
            <div className="flex items-center justify-between text-xs text-amber-400 font-mono">
              <span>FOLLOW-UPS</span>
              <Clock className="size-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {tasks.filter((t) => t.type === "CALL" || t.type === "FOLLOWUP").length + 2}
            </div>
            <p className="text-[11px] text-ink-400 mt-0.5">Scheduled for today</p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-mono">
              <span>PAYMENTS DUE</span>
              <CreditCard className="size-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{pendingPayments.length}</div>
            <p className="text-[11px] text-ink-400 mt-0.5">Invoices dispatched</p>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
            <div className="flex items-center justify-between text-xs text-cyan-400 font-mono">
              <span>RENEWALS DUE</span>
              <RotateCw className="size-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{renewalsDue.length}</div>
            <p className="text-[11px] text-ink-400 mt-0.5">Expiring &lt;15 days</p>
          </div>
        </div>

        {/* AI Priority Execution Queue */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono flex items-center gap-2">
              <Sparkles className="size-4 text-brand-400" />
              <span>AI Ranked Execution Order (Highest Impact First)</span>
            </h3>
            <span className="text-[11px] text-ink-400 font-mono">Updated 5 mins ago</span>
          </div>

          <div className="space-y-3">
            {hotLeads.map((lead, idx) => (
              <div
                key={lead.id}
                className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-brand-500/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="size-5 rounded-full bg-brand-500/20 text-brand-300 font-mono text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white text-sm">{lead.name}</span>
                    <span className="font-mono text-xs text-brand-400 bg-[#162235] px-2 py-0.5 rounded border border-[#1E2E48]">
                      AI Score: {lead.aiScore}/100
                    </span>
                    <span className="text-xs font-mono text-emerald-400">
                      Est. ₹{lead.estimatedValue.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-xs text-ink-300 pl-7">
                    <strong className="text-brand-300">Action:</strong> {lead.aiNextAction}
                  </p>
                  <p className="text-[11px] text-ink-400 pl-7 italic">&quot;{lead.aiNextActionWhy}&quot;</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onWorkLead(lead);
                    onClose();
                  }}
                  className="self-end sm:self-center shrink-0 inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer shadow-sm"
                >
                  <PhoneCall className="size-3.5" />
                  <span>Execute Now</span>
                </button>
              </div>
            ))}

            {renewalsDue.map((cust, idx) => (
              <div
                key={cust.id}
                className="rounded-xl border border-cyan-500/30 bg-[#0A1624] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="size-5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                      R{idx + 1}
                    </span>
                    <span className="font-bold text-white text-sm">{cust.name}</span>
                    <span className="font-mono text-xs text-cyan-400 bg-[#11243B] px-2 py-0.5 rounded">
                      Expires in {cust.currentSubscription.daysRemaining} Days
                    </span>
                  </div>
                  <p className="text-xs text-ink-300 pl-7">
                    <strong className="text-cyan-300">Retention Risk:</strong> Plan &apos;
                    {cust.currentSubscription.planName}&apos; valued at ₹
                    {cust.currentSubscription.amount.toLocaleString("en-IN")}.
                  </p>
                </div>

                <span className="rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-3 py-1 text-xs font-mono font-bold self-end sm:self-center">
                  Renewal Task Active
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#1E293B] bg-[#0E1624] px-6 py-3 text-xs">
          <span className="text-ink-400 font-mono">
            SEBI Regulatory Reminder: All calls recorded and audited.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#1E293B] hover:bg-[#2D3F59] text-white px-5 py-2 font-semibold transition-colors cursor-pointer"
          >
            Start Work Day
          </button>
        </div>
      </div>
    </div>
  );
}
