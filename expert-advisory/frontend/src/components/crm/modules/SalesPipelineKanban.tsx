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
  X,
  MessageSquare,
  ExternalLink,
  Edit2,
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
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

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

  const handleStageMove = async (leadId: string, nextStatus: LeadStatus) => {
    onUpdateLeadStatus(leadId, nextStatus);
    try {
      await fetch("/api/v1/office/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: nextStatus }),
      });
    } catch (_) {}
  };

  // Drag and Drop
  const handleDragStart = (leadId: string) => {
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetColId: LeadStatus) => {
    if (draggedLeadId) {
      handleStageMove(draggedLeadId, targetColId);
      setDraggedLeadId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              12-Stage Visual Sales Pipeline
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20">
              Interactive Kanban Board
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Drag cards or click arrows to progress leads. Click any card to inspect full lead details.
          </p>
        </div>

        <div className="text-xs font-mono text-ink-400">
          Showing <strong>{leads.length} Active Deals</strong> across 12 stages
        </div>
      </div>

      {/* Kanban Board Container with horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
        {PIPELINE_COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status.toUpperCase() === col.id);
          const colValue = colLeads.reduce((sum, l) => sum + (l.estimatedValue || 25000), 0);

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.id)}
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
                    Drop deals here
                  </div>
                ) : (
                  colLeads.map((lead) => {
                    const nextStg = getNextStage(lead.status.toUpperCase() as LeadStatus);
                    const prevStg = getPrevStage(lead.status.toUpperCase() as LeadStatus);

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id)}
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowDrawer(true);
                        }}
                        className="group relative rounded-xl border border-[#1E293B] bg-[#0D1522] p-3 hover:border-brand-500/60 transition-all shadow-xs space-y-2 cursor-pointer"
                      >
                        {/* Top: Name & AI Score */}
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <h4 className="font-bold text-xs text-white group-hover:text-brand-300 transition-colors">
                              {lead.name}
                            </h4>
                            <span className="font-mono text-[10px] text-brand-400">{lead.id}</span>
                          </div>
                          <span
                            className={cx(
                              "rounded font-mono font-bold text-[10px] px-1.5 py-0.5 border",
                              lead.aiScore >= 80
                                ? "bg-red-500/15 border-red-500/30 text-red-300"
                                : lead.aiScore >= 60
                                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                            )}
                          >
                            Score: {lead.aiScore}
                          </span>
                        </div>

                        {/* Middle: Service & Deal Value */}
                        <div className="text-[11px] space-y-0.5">
                          <p className="text-ink-300 truncate">{lead.preferredService || lead.segment}</p>
                          <div className="flex items-center justify-between font-mono">
                            <span className="text-emerald-400 font-bold">
                              ₹{(lead.estimatedValue || 25000).toLocaleString("en-IN")}
                            </span>
                            <span className="text-ink-400 text-[10px]">{lead.budget || lead.capital}</span>
                          </div>
                        </div>

                        {/* Agent & Followup */}
                        <div className="border-t border-[#1E293B] pt-2 flex items-center justify-between text-[10px] text-ink-400">
                          <span className="truncate">Rep: {lead.assignedAgent}</span>
                          <span className="text-amber-400 font-mono">{lead.nextFollowUp || "No call set"}</span>
                        </div>

                        {/* Interactive Move / Action Controls */}
                        <div
                          className="flex items-center justify-between pt-1 border-t border-[#1E293B]/50"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                                onClick={() => handleStageMove(lead.id, prevStg)}
                                className="p-1 rounded bg-[#162235] hover:bg-[#1E2D44] text-ink-300 hover:text-white transition-colors cursor-pointer"
                                title="Move to Previous Stage"
                              >
                                <ChevronLeft className="size-3" />
                              </button>
                            )}
                            {nextStg && (
                              <button
                                type="button"
                                onClick={() => handleStageMove(lead.id, nextStg)}
                                className="p-1 rounded bg-brand-600/30 hover:bg-brand-600 text-brand-300 hover:text-white transition-colors cursor-pointer"
                                title="Move to Next Stage"
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

      {/* LEAD 360 INSPECTION DRAWER */}
      {showDrawer && selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative flex flex-col w-full max-w-xl bg-[#090E17] border-l border-[#1E293B] shadow-2xl overflow-y-auto text-white p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-display">{selectedLead.name}</h2>
                  <span className="font-mono text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/30">
                    {selectedLead.id}
                  </span>
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  {selectedLead.mobile} • {selectedLead.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onWorkLead(selectedLead);
                  setShowDrawer(false);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                <PhoneCall className="size-4" />
                <span>Call Lead via CTI</span>
              </button>

              <a
                href={`https://wa.me/${selectedLead.mobile.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] px-4 py-2.5 text-xs font-bold hover:bg-[#22C55E]/25 transition-colors"
              >
                <MessageSquare className="size-4" />
              </a>
            </div>

            {/* AI Insights Card */}
            <div className="rounded-xl border border-brand-500/30 bg-[#0E1624] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-300 uppercase font-mono flex items-center gap-1.5">
                  <Sparkles className="size-4 text-brand-400" />
                  <span>AI Pipeline Analysis</span>
                </span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  Score: {selectedLead.aiScore} / 100
                </span>
              </div>
              <p className="text-xs text-ink-300">{selectedLead.aiScoreRationale}</p>
              <div className="border-t border-[#1E293B] pt-2 text-xs">
                <strong className="text-white block">Next Best Action:</strong>
                <span className="text-brand-300">{selectedLead.aiNextAction}</span>
              </div>
            </div>

            {/* Stage Selector */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] uppercase font-mono text-ink-400 block">Move Deal Stage:</span>
              <div className="grid grid-cols-3 gap-2">
                {PIPELINE_COLUMNS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleStageMove(selectedLead.id, col.id)}
                    className={cx(
                      "p-2 rounded-lg text-[11px] font-semibold border text-left truncate cursor-pointer transition-colors",
                      selectedLead.status.toUpperCase() === col.id
                        ? "bg-brand-600 border-brand-500 text-white"
                        : "bg-[#0E1624] border-[#1E293B] text-ink-300 hover:text-white hover:border-brand-500/40"
                    )}
                  >
                    {col.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Lead Specifications */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 space-y-1">
                <span className="text-[10px] uppercase font-mono text-ink-400">Deal Value</span>
                <p className="font-bold text-emerald-400 font-mono">
                  ₹{(selectedLead.estimatedValue || 25000).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 space-y-1">
                <span className="text-[10px] uppercase font-mono text-ink-400">Preferred Service</span>
                <p className="font-bold text-white truncate">{selectedLead.preferredService || selectedLead.segment}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
