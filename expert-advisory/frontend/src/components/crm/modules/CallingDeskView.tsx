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
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { CrmLead, CallLogItem } from "@/lib/crm-data";

interface CallingDeskViewProps {
  leads: CrmLead[];
  callLogs: CallLogItem[];
  onWorkLead: (lead: CrmLead) => void;
}

export function CallingDeskView({ leads, callLogs, onWorkLead }: CallingDeskViewProps) {
  const [callingSearch, setCallingSearch] = useState("");

  const filtered = leads.filter((l) => {
    const q = callingSearch.toLowerCase();
    return !q || l.name.toLowerCase().includes(q) || l.mobile.includes(q) || l.id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Cloud Telecalling (CTI) & NPC Recycling Desk
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              Tata Tele / Exotel Bridge
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            High-speed single-pane dialer with 7-attempt NPC cadence, encrypted call recordings, and in-call objection playbooks.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-ink-400">
          <span>Bridge Latency: <strong>48ms</strong></span>
          <span>•</span>
          <span className="text-emerald-400">Recording Encrypted</span>
        </div>
      </div>

      {/* Leads Calling Queue */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Active Priority Calling Queue ({filtered.length} Leads)
          </h2>
          <input
            type="text"
            value={callingSearch}
            onChange={(e) => setCallingSearch(e.target.value)}
            placeholder="Search queue by name or phone..."
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-1.5 text-xs text-white placeholder-ink-400 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 space-y-3 hover:border-brand-500/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">{lead.name}</h3>
                  <span className="font-mono text-xs text-brand-400">{lead.id} • {lead.city}</span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Score: {lead.aiScore}
                </span>
              </div>

              {/* NPC Cadence Bar */}
              <div className="rounded-lg bg-[#090E17] p-2.5 border border-[#1E293B]">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-ink-400">NPC Cadence:</span>
                  <span className="text-orange-400 font-bold">{lead.npcAttempts} / 7 Attempts</span>
                </div>
                <div className="w-full bg-[#162030] rounded-full h-1 mt-1.5">
                  <div
                    className="bg-orange-500 h-1 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (lead.npcAttempts / 7) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-ink-300">
                <p><strong>Capital:</strong> {lead.budget}</p>
                <p className="truncate mt-0.5"><strong>Service:</strong> {lead.preferredService}</p>
              </div>

              <button
                type="button"
                onClick={() => onWorkLead(lead)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                <PhoneCall className="size-4" />
                <span>Launch CTI Bridge</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
