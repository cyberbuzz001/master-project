"use client";

import React, { useState } from "react";
import {
  Flame,
  PhoneCall,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  User,
  Plus,
  ArrowRight,
} from "lucide-react";
import { cx } from "@/components/ui";
import type { CrmLead, LeadStatus } from "@/lib/crm-data";

interface SalesPipelineKanbanProps {
  leads: CrmLead[];
  onWorkLead: (lead: CrmLead) => void;
  onUpdateLeadStatus: (leadId: string, status: LeadStatus) => void;
}

const PIPELINE_COLUMNS: Array<{ id: LeadStatus; title: string; color: string }> = [
  { id: "NEW", title: "New Lead", color: "border-blue-500/50" },
  { id: "CONTACTED", title: "Contacted", color: "border-indigo-500/50" },
  { id: "INTERESTED", title: "Interested", color: "border-violet-500/50" },
  { id: "QUALIFIED", title: "Qualified", color: "border-purple-500/50" },
  { id: "CONSULTATION_SCHEDULED", title: "Consultation Scheduled", color: "border-fuchsia-500/50" },
  { id: "OFFER_PRESENTED", title: "Offer Presented", color: "border-pink-500/50" },
  { id: "PAYMENT_PENDING", title: "Payment Pending", color: "border-amber-500/50" },
  { id: "CONVERTED", title: "Converted", color: "border-emerald-500/50" },
  { id: "ONBOARDING", title: "Onboarding", color: "border-teal-500/50" },
  { id: "ACTIVE_CLIENT", title: "Active Client", color: "border-cyan-500/50" },
  { id: "RENEWAL", title: "Renewal", color: "border-sky-500/50" },
  { id: "LOST", title: "Lost", color: "border-red-500/50" },
];

export function SalesPipelineKanban({
  leads,
  onWorkLead,
  onUpdateLeadStatus,
}: SalesPipelineKanbanProps) {
  const getNextStage = (current: LeadStatus): LeadStatus | null => {
    const idx = PIPELINE_COLUMNS.findIndex((c) => c.id === current);
    if (idx >= 0 && idx < PIPELINE_COLUMNS.length - 1 && current !== "LOST") {
      return PIPELINE_COLUMNS[idx + 1].id;
    }
    return null;
  };

  const getPrevStage = (current: LeadStatus): LeadStatus | null => {
    const idx = PIPELINE_COLUMNS.findIndex((c) => c.id === current);
    if (idx > 0) {
      return PIPELINE_COLUMNS[idx - 1].id;
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              12-Stage Visual Sales Pipeline
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20">
              Kanban Board
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Complete conversion lifecycle from raw lead ingestion to active client onboarding and annual renewal.
          </p>
        </div>

        <div className="text-xs font-mono text-ink-400">
          Showing <strong>{leads.length} Active Deals</strong> across 12 lifecycle stages
        </div>
      </div>

      {/* Kanban Board Container with horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
        {PIPELINE_COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.id);
          const colValue = colLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

          return (
            <div
              key={col.id}
              className="flex flex-col w-72 shrink-0 rounded-2xl bg-[#090E17] border border-[#1E293B] shadow-xl overflow-hidden"
            >
              {/* Column Header */}
              <div className={cx("p-3.5 border-t-4 bg-[#0E1624] border-b border-[#1E293B]", col.color)}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-white truncate">{col.title}</h3>
                  <span className="rounded-full bg-[#162235] text-brand-300 font-mono text-[11px] font-bold px-2 py-0.5">
                    {colLeads.length}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 mt-1">
                  ₹{colValue.toLocaleString("en-IN")} Pipeline
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[68vh]">
                {colLeads.length === 0 ? (
                  <div className="py-8 text-center text-[11px] font-mono text-ink-500 italic">
                    No deals in this stage
                  </div>
                ) : (
                  colLeads.map((lead) => {
                    const nextStg = getNextStage(lead.status);
                    const prevStg = getPrevStage(lead.status);

                    return (
                      <div
                        key={lead.id}
                        className="group relative rounded-xl border border-[#1E293B] bg-[#0D1522] p-3 hover:border-brand-500/60 transition-all shadow-xs space-y-2"
                      >
                        {/* Top: Name & AI Score */}
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <h4 className="font-bold text-xs text-white">{lead.name}</h4>
                            <span className="font-mono text-[10px] text-brand-400">{lead.id}</span>
                          </div>
                          <span className={cx(
                            "rounded font-mono font-bold text-[10px] px-1.5 py-0.5 border",
                            lead.aiScore >= 80 ? "bg-red-500/15 border-red-500/30 text-red-300" :
                            lead.aiScore >= 60 ? "bg-amber-500/15 border-amber-500/30 text-amber-300" :
                            "bg-blue-500/15 border-blue-500/30 text-blue-300"
                          )}>
                            Score: {lead.aiScore}
                          </span>
                        </div>

                        {/* Middle: Service & Deal Value */}
                        <div className="text-[11px] space-y-0.5">
                          <p className="text-ink-300 truncate">{lead.preferredService}</p>
                          <div className="flex items-center justify-between font-mono">
                            <span className="text-emerald-400 font-bold">
                              ₹{lead.estimatedValue.toLocaleString("en-IN")}
                            </span>
                            <span className="text-ink-400 text-[10px]">{lead.budget}</span>
                          </div>
                        </div>

                        {/* Agent & Followup */}
                        <div className="border-t border-[#1E293B] pt-2 flex items-center justify-between text-[10px] text-ink-400">
                          <span className="truncate">Rep: {lead.assignedAgent}</span>
                          <span className="text-amber-400 font-mono">{lead.nextFollowUp || "No call set"}</span>
                        </div>

                        {/* Interactive Move / Action Controls */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#1E293B]/50">
                          <button
                            type="button"
                            onClick={() => onWorkLead(lead)}
                            className="inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-semibold cursor-pointer"
                          >
                            <PhoneCall className="size-3" />
                            <span>Work Lead</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {prevStg && (
                              <button
                                type="button"
                                onClick={() => onUpdateLeadStatus(lead.id, prevStg)}
                                className="p-1 rounded bg-[#162235] hover:bg-[#1E2D44] text-ink-300 hover:text-white transition-colors cursor-pointer"
                                title="Move Previous"
                              >
                                <ChevronLeft className="size-3" />
                              </button>
                            )}
                            {nextStg && (
                              <button
                                type="button"
                                onClick={() => onUpdateLeadStatus(lead.id, nextStg)}
                                className="p-1 rounded bg-brand-600/30 hover:bg-brand-600 text-brand-300 hover:text-white transition-colors cursor-pointer"
                                title="Move Next"
                              >
                                <ChevronRight className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
