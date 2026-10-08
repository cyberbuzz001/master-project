"use client";

import React, { useState } from "react";
import {
  Sparkles,
  PhoneCall,
  Brain,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Award,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { CrmLead, CallLogItem } from "@/lib/crm-data";

interface AiSalesAssistantViewProps {
  leads: CrmLead[];
  callLogs: CallLogItem[];
  onWorkLead: (lead: CrmLead) => void;
}

export function AiSalesAssistantView({
  leads,
  callLogs,
  onWorkLead,
}: AiSalesAssistantViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || "");
  const selectedLead = leads.find((l) => l.id === selectedLeadId) || leads[0];
  const latestCallLog = callLogs.find((c) => c.leadId === selectedLead?.id) || callLogs[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              AI Sales Assistant & Conversation Intelligence
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-brand-400" />
              <span>COGNITIVE COPILOT</span>
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Real-time next-best-actions, automated call transcription analysis, compliance auditing, and coaching.
          </p>
        </div>

        {/* Lead Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-400">Analyze Lead:</span>
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
          >
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} (Score: {l.aiScore})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedLead && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Lead AI Dossier & Next Best Action (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            {/* Lead Summary */}
            <div className="rounded-2xl border border-brand-500/30 bg-[#090E17] p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono flex items-center gap-1.5">
                  <Brain className="size-4" />
                  <span>Executive AI Lead Summary</span>
                </span>
                <span className="rounded font-mono font-bold text-xs bg-red-500/15 text-red-300 border border-red-500/30 px-2 py-0.5">
                  AI Intent Score: {selectedLead.aiScore}/100
                </span>
              </div>
              <p className="text-xs text-ink-200 leading-relaxed">
                <strong>{selectedLead.name}</strong> is a high-intent prospect interested in{" "}
                <span className="text-white font-semibold">{selectedLead.preferredService}</span>. Declared capital is{" "}
                <span className="text-emerald-400 font-mono font-bold">{selectedLead.budget}</span>. Visited the pricing page multiple times, completed risk profiling with an{" "}
                <span className="text-brand-300 font-semibold">{selectedLead.riskPreference}</span> profile, and has had {selectedLead.conversationsCount} active conversations.
              </p>
            </div>

            {/* Next Best Action Engine */}
            <div className="rounded-2xl border border-emerald-500/30 bg-[#0A1624] p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
                  <Sparkles className="size-4" />
                  <span>AI Recommended Next Action</span>
                </span>
                <Badge tone="positive">High Priority</Badge>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-[#0E2034] p-4">
                <p className="text-sm font-bold text-white leading-snug">
                  👉 &quot;{selectedLead.aiNextAction}&quot;
                </p>
                <p className="text-xs text-ink-300 mt-2 italic">
                  <strong>Why this action:</strong> &quot;{selectedLead.aiNextActionWhy}&quot;
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="rounded-lg bg-[#0E1624] p-2.5">
                  <span className="text-[10px] font-mono text-ink-400 uppercase">Optimal Contact Time</span>
                  <p className="font-semibold text-white mt-0.5">Today 04:30 PM (Post-Market)</p>
                </div>
                <div className="rounded-lg bg-[#0E1624] p-2.5">
                  <span className="text-[10px] font-mono text-ink-400 uppercase">Best Channel</span>
                  <p className="font-semibold text-white mt-0.5">Phone Call + WhatsApp PDF</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onWorkLead(selectedLead)}
                className="w-full rounded-xl bg-brand-600 hover:bg-brand-500 text-white p-3 text-xs font-bold transition-colors cursor-pointer text-center shadow-md flex items-center justify-center gap-2"
              >
                <PhoneCall className="size-4" />
                <span>Execute Next Action Now</span>
              </button>
            </div>
          </div>

          {/* Right Column: Conversation Intelligence & Call Quality Score (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            {latestCallLog && (
              <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                      <PhoneCall className="size-4 text-emerald-400" />
                      <span>Latest Call Intelligence & Transcription</span>
                    </h3>
                    <p className="text-[11px] text-ink-400 mt-0.5">
                      Audited Call ({latestCallLog.timestamp}) • Rep: {latestCallLog.agent}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-ink-400 block">AI Quality Score</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {latestCallLog.qualityScore.overall}/100
                    </span>
                  </div>
                </div>

                {/* 8-Factor Quality Score Breakdown */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono uppercase text-ink-400 block">
                    8-Factor Call Quality Assessment:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-[#0E1624] border border-[#1E293B]">
                      <span>Introduction:</span>
                      <strong className="text-white font-mono">{latestCallLog.qualityScore.intro}%</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[#0E1624] border border-[#1E293B]">
                      <span>Requirement Discovery:</span>
                      <strong className="text-white font-mono">{latestCallLog.qualityScore.discovery}%</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[#0E1624] border border-[#1E293B]">
                      <span>Product Explanation:</span>
                      <strong className="text-white font-mono">{latestCallLog.qualityScore.productExpl}%</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[#0E1624] border border-[#1E293B]">
                      <span className="text-emerald-400">Compliance Audit:</span>
                      <strong className="text-emerald-400 font-mono">{latestCallLog.qualityScore.compliance}%</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[#0E1624] border border-[#1E293B]">
                      <span>Objection Handling:</span>
                      <strong className="text-white font-mono">{latestCallLog.qualityScore.objectionHandling}%</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[#0E1624] border border-[#1E293B]">
                      <span>Closing Readiness:</span>
                      <strong className="text-white font-mono">{latestCallLog.qualityScore.closing}%</strong>
                    </div>
                  </div>
                </div>

                {/* Call Summary Takeaways */}
                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-1.5 text-xs">
                  <span className="text-[10px] font-mono uppercase text-brand-400 font-bold block">
                    AI Extracted Requirements & Objections:
                  </span>
                  <p className="text-ink-200">
                    <strong>Need:</strong> {latestCallLog.summary.customerRequirement}
                  </p>
                  <p className="text-ink-300">
                    <strong>Objections:</strong> {latestCallLog.summary.objectionsDetected.join("; ")}
                  </p>
                  <p className="text-ink-300">
                    <strong>Agent Response:</strong> {latestCallLog.summary.agentResponse}
                  </p>
                </div>
              </div>
            )}

            {/* AI Sales Coaching Tips */}
            <div className="rounded-2xl border border-amber-500/30 bg-[#0E1624] p-5 space-y-3 shadow-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                <Lightbulb className="size-4" />
                <span>AI Sales Coaching Recommendations for Rep</span>
              </span>
              <div className="text-xs space-y-1.5 text-ink-300 leading-relaxed">
                <p>• Your conversion rate is high on warm leads, but ensure you address fee objections using the approved <strong>1:2 Risk-Reward Ratio comparison</strong> template.</p>
                <p>• Client raised concerns about past losses; emphasize strict SEBI position sizing rules (max 3-5% allocation per stock).</p>
                <p>• <strong>Compliance check:</strong> Zero promises of guaranteed returns detected during conversation. Pass certified.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
