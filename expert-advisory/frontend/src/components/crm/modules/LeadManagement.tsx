"use client";

import React, { useState } from "react";
import {
  Search,
  Filter,
  Flame,
  PhoneCall,
  MessageSquare,
  Sparkles,
  ArrowUpDown,
  MoreVertical,
  Plus,
  UserCheck,
  ShieldCheck,
  X,
  ExternalLink,
  Clock,
  Calendar,
  AlertCircle,
  Tag,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { CrmLead, LeadTemperature, LeadStatus, CrmUser } from "@/lib/crm-data";

interface LeadManagementProps {
  leads: CrmLead[];
  users: CrmUser[];
  onWorkLead: (lead: CrmLead) => void;
  onUpdateLeadStatus: (leadId: string, status: LeadStatus) => void;
  onAssignLead: (leadId: string, agentName: string) => void;
}

export function LeadManagement({
  leads,
  users,
  onWorkLead,
  onUpdateLeadStatus,
  onAssignLead,
}: LeadManagementProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterTemp, setFilterTemp] = useState<string>("ALL");
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const filteredLeads = leads.filter((lead) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      lead.name.toLowerCase().includes(q) ||
      lead.mobile.includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.id.toLowerCase().includes(q) ||
      lead.city.toLowerCase().includes(q) ||
      lead.preferredService.toLowerCase().includes(q);

    const matchesStatus = filterStatus === "ALL" || lead.status === filterStatus;
    const matchesTemp = filterTemp === "ALL" || lead.temperature === filterTemp;

    return matchesSearch && matchesStatus && matchesTemp;
  });

  const getTemperatureBadge = (temp: LeadTemperature) => {
    switch (temp) {
      case "VERY_HOT":
        return <span className="inline-flex items-center gap-1 rounded bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 text-[10px] font-mono font-bold"><Flame className="size-3" /> VERY HOT</span>;
      case "HOT":
        return <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 text-[10px] font-mono font-bold"><Flame className="size-3" /> HOT</span>;
      case "WARM":
        return <span className="rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">WARM</span>;
      case "COLD":
        return <span className="rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">COLD</span>;
      default:
        return <span className="rounded bg-ink-700 text-ink-300 px-2 py-0.5 text-[10px] font-mono font-bold">LOW</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Lead Management & AI Intent Matrix
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20">
              {filteredLeads.length} Total Leads
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Track multi-touch UTM attribution, automated AI scoring (0–100), and recommended next best actions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (leads[0]) onWorkLead(leads[0]);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <PhoneCall className="size-4" />
            <span>Launch Quick Call Desk</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B121E] border border-[#1E293B] p-4 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 size-4 text-ink-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, lead ID, city, or segment..."
            className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] pl-10 pr-4 py-2 text-xs text-white placeholder-ink-400 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3 py-2 text-xs text-ink-300 focus:outline-none"
          >
            <option value="ALL">All Statuses ({leads.length})</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="CONSULTATION_SCHEDULED">Consultation Scheduled</option>
            <option value="PAYMENT_PENDING">Payment Pending</option>
            <option value="CONVERTED">Converted</option>
          </select>

          <select
            value={filterTemp}
            onChange={(e) => setFilterTemp(e.target.value)}
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3 py-2 text-xs text-ink-300 focus:outline-none"
          >
            <option value="ALL">All Temperatures</option>
            <option value="VERY_HOT">Very Hot (90-100)</option>
            <option value="HOT">Hot (75-89)</option>
            <option value="WARM">Warm (50-74)</option>
            <option value="COLD">Cold (25-49)</option>
          </select>
        </div>
      </div>

      {/* Main Leads Table */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0E1624] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
              <tr>
                <th className="px-5 py-3.5">Lead & Contact</th>
                <th className="px-4 py-3.5">AI Score & Temp</th>
                <th className="px-4 py-3.5">AI Next-Best-Action</th>
                <th className="px-4 py-3.5">Capital & Service</th>
                <th className="px-4 py-3.5">UTM Attribution</th>
                <th className="px-4 py-3.5">Assigned Agent</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-ink-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-ink-400">
                    No leads matching your current search criteria.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-[#0E1624]/60 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedLead(lead);
                      setShowDrawer(true);
                    }}
                  >
                    {/* Lead & Contact */}
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{lead.name}</div>
                      <div className="font-mono text-[11px] text-brand-400">{lead.id}</div>
                      <div className="font-mono text-[11px] text-ink-400 mt-0.5">
                        {lead.mobile} • {lead.city}
                      </div>
                    </td>

                    {/* AI Score & Temperature */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cx(
                          "size-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs border",
                          lead.aiScore >= 90 ? "bg-red-500/15 border-red-500/30 text-red-300" :
                          lead.aiScore >= 75 ? "bg-orange-500/15 border-orange-500/30 text-orange-300" :
                          lead.aiScore >= 50 ? "bg-amber-500/15 border-amber-500/30 text-amber-300" :
                          "bg-blue-500/15 border-blue-500/30 text-blue-300"
                        )}>
                          {lead.aiScore}
                        </div>
                        <div>{getTemperatureBadge(lead.temperature)}</div>
                      </div>
                      <p className="text-[10px] text-ink-400 mt-1 max-w-[140px] truncate" title={lead.aiScoreRationale}>
                        {lead.aiScoreRationale}
                      </p>
                    </td>

                    {/* AI Next Best Action */}
                    <td className="px-4 py-4 max-w-[220px]">
                      <div className="flex items-start gap-1.5 text-brand-300 font-semibold line-clamp-1" title={lead.aiNextAction}>
                        <Sparkles className="size-3.5 text-brand-400 shrink-0 mt-0.5" />
                        <span>{lead.aiNextAction}</span>
                      </div>
                      <p className="text-[10px] text-ink-400 line-clamp-1 italic mt-0.5" title={lead.aiNextActionWhy}>
                        &quot;{lead.aiNextActionWhy}&quot;
                      </p>
                    </td>

                    {/* Capital & Service */}
                    <td className="px-4 py-4">
                      <div className="font-mono font-bold text-white">{lead.budget}</div>
                      <div className="text-[11px] text-ink-400 mt-0.5">{lead.preferredService}</div>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Est. ₹{lead.estimatedValue.toLocaleString("en-IN")}
                      </span>
                    </td>

                    {/* Attribution */}
                    <td className="px-4 py-4 font-mono text-[11px] text-ink-400">
                      <div className="text-white font-medium">{lead.source}</div>
                      <div>{lead.campaign || "Direct"}</div>
                      {lead.utmMedium && <div className="text-[10px] text-ink-500">{lead.utmMedium}</div>}
                    </td>

                    {/* Assigned Agent */}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.assignedAgent}
                        onChange={(e) => onAssignLead(lead.id, e.target.value)}
                        className="rounded-lg border border-[#1E293B] bg-[#0E1624] px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) => onUpdateLeadStatus(lead.id, e.target.value as LeadStatus)}
                        className={cx(
                          "rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-none cursor-pointer",
                          lead.status === "NEW" && "bg-blue-500/10 border-blue-500/30 text-blue-400",
                          lead.status === "CONTACTED" && "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
                          lead.status === "QUALIFIED" && "bg-purple-500/10 border-purple-500/30 text-purple-400",
                          lead.status === "PAYMENT_PENDING" && "bg-amber-500/10 border-amber-500/30 text-amber-400",
                          lead.status === "CONVERTED" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        )}
                      >
                        <option value="NEW">New</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="QUALIFIED">Qualified</option>
                        <option value="CONSULTATION_SCHEDULED">Consultation</option>
                        <option value="PAYMENT_PENDING">Payment Pending</option>
                        <option value="CONVERTED">Converted</option>
                        <option value="LOST">Lost</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onWorkLead(lead)}
                          className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 p-2 hover:bg-emerald-600/30 transition-colors cursor-pointer"
                          title="Call Lead via CTI Workbench"
                        >
                          <PhoneCall className="size-3.5" />
                        </button>
                        <a
                          href={`https://wa.me/${lead.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(
                            `Hello ${lead.name}, regarding your inquiry with Expert Stocks Consultancy (Ref: ${lead.id})...`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] p-2 hover:bg-[#22C55E]/25 transition-colors"
                          title="WhatsApp Message"
                        >
                          <MessageSquare className="size-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEAD 360 DETAIL SLIDE-OVER DRAWER */}
      {showDrawer && selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative flex flex-col w-full max-w-xl bg-[#090E17] border-l border-[#1E293B] shadow-2xl overflow-y-auto text-white p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div>
                <span className="font-mono text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                  {selectedLead.id}
                </span>
                <h2 className="text-xl font-bold font-display text-white mt-1">
                  {selectedLead.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="text-ink-400 hover:text-white p-2"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* AI Summary Card */}
            <div className="rounded-2xl border border-brand-500/30 bg-[#0E1624] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-brand-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="size-4" />
                  <span>AI Lead Intelligence Dossier</span>
                </span>
                <Badge tone="positive">Score: {selectedLead.aiScore}/100</Badge>
              </div>
              <p className="text-xs text-ink-300 leading-relaxed">
                <strong>Next Recommended Action:</strong> {selectedLead.aiNextAction}
              </p>
              <p className="text-[11px] text-ink-400 italic">
                <strong>Why:</strong> &quot;{selectedLead.aiNextActionWhy}&quot;
              </p>
            </div>

            {/* Complete 30-Attribute Breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-mono">
                Declared Profile & Regulatory Attributes
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Trading Experience</span>
                  <p className="font-bold text-white mt-0.5">{selectedLead.tradingExperience}</p>
                </div>
                <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Risk Preference</span>
                  <p className="font-bold text-white mt-0.5">{selectedLead.riskPreference}</p>
                </div>
                <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Preferred Market</span>
                  <p className="font-bold text-white mt-0.5">{selectedLead.preferredMarket}</p>
                </div>
                <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Budget Range</span>
                  <p className="font-bold text-white mt-0.5">{selectedLead.budget}</p>
                </div>
              </div>
            </div>

            {/* Campaign & UTM Attribution */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-mono">
                Full-Funnel Acquisition Attribution
              </h3>
              <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-3 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-ink-400">Source:</span>
                  <span className="text-white">{selectedLead.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Campaign:</span>
                  <span className="text-white">{selectedLead.campaign || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">UTM Source / Medium:</span>
                  <span className="text-brand-300">{selectedLead.utmSource} / {selectedLead.utmMedium}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Landing Page:</span>
                  <span className="text-ink-300">{selectedLead.landingPage}</span>
                </div>
              </div>
            </div>

            {/* Notes & Actions */}
            <div className="pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDrawer(false);
                  onWorkLead(selectedLead);
                }}
                className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-500 text-white p-3 text-xs font-bold transition-colors cursor-pointer text-center"
              >
                Open CTI Calling Workbench
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
