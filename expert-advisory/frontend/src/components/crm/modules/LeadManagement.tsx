"use client";

import React, { useState, useTransition } from "react";
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
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  User,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { CrmLead, LeadTemperature, LeadStatus, CrmUser } from "@/lib/crm-data";

interface LeadManagementProps {
  leads: CrmLead[];
  users: CrmUser[];
  onWorkLead: (lead: CrmLead) => void;
  onUpdateLeadStatus: (leadId: string, status: LeadStatus) => void;
  onAssignLead: (leadId: string, agentName: string) => void;
  onAddLead?: (newLead: CrmLead) => void;
  onEditLead?: (updatedLead: CrmLead) => void;
  onDeleteLead?: (leadId: string) => void;
  onDistributeLeads?: () => void;
  onNavigateToCustomer?: (lead: CrmLead) => void;
}

const CAPITAL_OPTIONS = [
  "< ₹5L",
  "₹5L - ₹10L",
  "₹10L - ₹25L",
  "₹25L - ₹50L",
  "₹50L+",
];

const SERVICE_OPTIONS = [
  "Nifty & Bank Nifty Options",
  "Index Derivatives Alpha",
  "Large-cap Equity & Options",
  "Equity Swing & Momentum",
  "Cash Equity Only",
  "HNI Bespoke Advisory",
  "Institutional Desk",
];

const SOURCE_OPTIONS = [
  "Manual Direct Inbound",
  "Website Inbound (/contact)",
  "TradeGrow Bridge",
  "WhatsApp Referral",
  "Direct Consultation",
  "Google Ads / Performance",
  "Partner Referral",
];

export function LeadManagement({
  leads,
  users,
  onWorkLead,
  onUpdateLeadStatus,
  onAssignLead,
  onAddLead,
  onEditLead,
  onDeleteLead,
  onDistributeLeads,
  onNavigateToCustomer,
}: LeadManagementProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterTemp, setFilterTemp] = useState<string>("ALL");
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [deletingLead, setDeletingLead] = useState<CrmLead | null>(null);

  // Toast / Feedback State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    mobile: "",
    email: "",
    city: "Mumbai",
    capital: "₹10L - ₹25L",
    segment: "Nifty & Bank Nifty Options",
    source: "Manual Direct Inbound",
    assignedAgent: users[0]?.name || "Vikram Malhotra",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Client-Side Validation for Create Lead
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!newLeadForm.name.trim()) errors.name = "Full name is required.";
    const cleanPhone = newLeadForm.mobile.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.mobile = "A valid 10-digit mobile number is required.";
    }
    if (newLeadForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLeadForm.email)) {
      errors.email = "Please enter a valid email address.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create Lead Handler with API Persistence
  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: newLeadForm.name.trim(),
        mobile: newLeadForm.mobile.trim(),
        email: newLeadForm.email.trim(),
        city: newLeadForm.city,
        capital: newLeadForm.capital,
        segment: newLeadForm.segment,
        source: newLeadForm.source,
        assignedAgent: newLeadForm.assignedAgent,
        notes: newLeadForm.notes.trim(),
      };

      const res = await fetch("/api/v1/office/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const createdLead: CrmLead = json.data;
        if (onAddLead) onAddLead(createdLead);
        setShowAddModal(false);
        setNewLeadForm({
          name: "",
          mobile: "",
          email: "",
          city: "Mumbai",
          capital: "₹10L - ₹25L",
          segment: "Nifty & Bank Nifty Options",
          source: "Manual Direct Inbound",
          assignedAgent: users[0]?.name || "Vikram Malhotra",
          notes: "",
        });
        setFormErrors({});
        showToast(`Lead ${createdLead.name} (${createdLead.id}) created successfully!`);
      } else {
        showToast(json.message || "Failed to create lead", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error while saving lead", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Lead Handler with API Persistence
  const handleUpdateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/office/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLead.id,
          updates: {
            name: editingLead.name,
            mobile: editingLead.mobile,
            email: editingLead.email,
            city: editingLead.city,
            budget: editingLead.budget,
            capital: editingLead.budget,
            preferredService: editingLead.preferredService,
            segment: editingLead.preferredService,
            status: editingLead.status,
            temperature: editingLead.temperature,
            assignedAgent: editingLead.assignedAgent,
            notes: editingLead.notes,
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (onEditLead) onEditLead(editingLead);
        setEditingLead(null);
        showToast(`Lead ${editingLead.id} updated successfully!`);
      } else {
        showToast(json.message || "Failed to update lead", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Lead Handler with API Persistence
  const handleDeleteLeadConfirm = async () => {
    if (!deletingLead) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/office/leads?id=${encodeURIComponent(deletingLead.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (onDeleteLead) onDeleteLead(deletingLead.id);
        const name = deletingLead.name;
        const id = deletingLead.id;
        setDeletingLead(null);
        showToast(`Lead ${name} (${id}) deleted successfully.`);
      } else {
        showToast(json.message || "Failed to delete lead", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline Status Change with API PATCH
  const handleInlineStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    onUpdateLeadStatus(leadId, newStatus);
    showToast(`Status updated to ${newStatus}`);
    try {
      await fetch("/api/v1/office/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
    } catch (e) {
      console.warn("[Lead Status Patch Deferred]", e);
    }
  };

  // Inline Agent Reassignment with API PATCH
  const handleInlineAgentChange = async (leadId: string, newAgent: string) => {
    onAssignLead(leadId, newAgent);
    showToast(`Reassigned to ${newAgent}`);
    try {
      await fetch("/api/v1/office/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, assignedAgent: newAgent }),
      });
    } catch (e) {
      console.warn("[Lead Agent Patch Deferred]", e);
    }
  };

  const [waSendingId, setWaSendingId] = useState<string | null>(null);

  const handleInstantWhatsApp = async (lead: CrmLead) => {
    if (waSendingId) return;
    setWaSendingId(lead.id);
    try {
      const res = await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.mobile,
          templateName: "adv_lead_welcome",
          templateParams: [lead.name, lead.id],
          clientName: lead.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          `Meta WhatsApp Welcome sent to ${lead.name} (+91 ${lead.mobile.replace(/\D/g, "").slice(-10)})`
        );
      } else {
        showToast(`WhatsApp dispatch error: ${data.message || "Failed to send"}`, "error");
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, "error");
    } finally {
      setWaSendingId(null);
    }
  };

  const handleAutoDistribute = () => {
    if (onDistributeLeads) {
      onDistributeLeads();
      return;
    }
    const salesAgents = users.filter(
      (u) => u.role === "sales_agent" || u.role === "sales_manager" || u.role === "relationship_manager"
    );
    if (salesAgents.length === 0) return;
    let count = 0;
    leads.forEach((l, idx) => {
      const agent = salesAgents[idx % salesAgents.length].name;
      if (l.assignedAgent !== agent) {
        handleInlineAgentChange(l.id, agent);
        count++;
      }
    });
    showToast(`Evenly distributed ${count} leads across ${salesAgents.length} sales agents!`);
  };

  const filteredLeads = leads.filter((lead) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      lead.name.toLowerCase().includes(q) ||
      lead.mobile.includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.id.toLowerCase().includes(q) ||
      lead.city.toLowerCase().includes(q) ||
      (lead.preferredService && lead.preferredService.toLowerCase().includes(q));

    const matchesStatus =
      filterStatus === "ALL" ||
      lead.status.toUpperCase() === filterStatus.toUpperCase();

    const matchesTemp =
      filterTemp === "ALL" ||
      (lead.temperature && lead.temperature.toUpperCase() === filterTemp.toUpperCase());

    return matchesSearch && matchesStatus && matchesTemp;
  });

  const getTemperatureBadge = (temp: LeadTemperature) => {
    switch (temp) {
      case "VERY_HOT":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
            <Flame className="size-3" /> VERY HOT
          </span>
        );
      case "HOT":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
            <Flame className="size-3" /> HOT
          </span>
        );
      case "WARM":
        return (
          <span className="rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
            WARM
          </span>
        );
      case "COLD":
        return (
          <span className="rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
            COLD
          </span>
        );
      default:
        return (
          <span className="rounded bg-ink-700 text-ink-300 px-2 py-0.5 text-[10px] font-mono font-bold">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={cx(
            "fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md animate-fade-in",
            toast.type === "success"
              ? "border-emerald-500/40 bg-[#0B1A14]/90 text-emerald-300 shadow-emerald-500/10"
              : "border-rose-500/40 bg-[#1A0B0E]/90 text-rose-300 shadow-rose-500/10"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="size-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-ink-400 hover:text-white cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleAutoDistribute}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer"
            title="Evenly distribute leads across active agents"
          >
            <UserCheck className="size-4" />
            <span>Distribute Leads (Round-Robin)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Plus className="size-4" />
            <span>+ Add New Lead</span>
          </button>

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
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3 py-2 text-xs text-ink-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses ({leads.length})</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="CONSULTATION_SCHEDULED">Consultation Scheduled</option>
            <option value="PAYMENT_PENDING">Payment Pending</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
          </select>

          <select
            value={filterTemp}
            onChange={(e) => setFilterTemp(e.target.value)}
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3 py-2 text-xs text-ink-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Temperatures</option>
            <option value="VERY_HOT">Very Hot (85-100)</option>
            <option value="HOT">Hot (70-84)</option>
            <option value="WARM">Warm (50-69)</option>
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
                    className="hover:bg-[#0E1624]/60 transition-colors"
                  >
                    {/* Lead & Contact (Clickable ID & Name) */}
                    <td className="px-5 py-4">
                      <div
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowDrawer(true);
                        }}
                        className="font-bold text-white text-sm hover:text-brand-300 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{lead.name}</span>
                        <ExternalLink className="size-3 text-ink-400 inline" />
                      </div>
                      <div
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowDrawer(true);
                        }}
                        className="font-mono text-[11px] text-brand-400 hover:underline cursor-pointer"
                      >
                        {lead.id}
                      </div>
                      <div className="font-mono text-[11px] text-ink-400 mt-0.5">
                        {lead.mobile} • {lead.city || "Mumbai"}
                      </div>
                    </td>

                    {/* AI Score & Temperature */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cx(
                            "size-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs border",
                            lead.aiScore >= 90
                              ? "bg-red-500/15 border-red-500/30 text-red-300"
                              : lead.aiScore >= 75
                              ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                              : lead.aiScore >= 50
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                              : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                          )}
                        >
                          {lead.aiScore}
                        </div>
                        <div>{getTemperatureBadge(lead.temperature)}</div>
                      </div>
                      <p
                        className="text-[10px] text-ink-400 mt-1 max-w-[140px] truncate"
                        title={lead.aiScoreRationale}
                      >
                        {lead.aiScoreRationale}
                      </p>
                    </td>

                    {/* AI Next Best Action */}
                    <td className="px-4 py-4 max-w-[220px]">
                      <div
                        className="flex items-start gap-1.5 text-brand-300 font-semibold line-clamp-1"
                        title={lead.aiNextAction}
                      >
                        <Sparkles className="size-3.5 text-brand-400 shrink-0 mt-0.5" />
                        <span>{lead.aiNextAction}</span>
                      </div>
                      <p
                        className="text-[10px] text-ink-400 line-clamp-1 italic mt-0.5"
                        title={lead.aiNextActionWhy}
                      >
                        &quot;{lead.aiNextActionWhy}&quot;
                      </p>
                    </td>

                    {/* Capital & Service */}
                    <td className="px-4 py-4">
                      <div className="font-mono font-bold text-white">{lead.budget || lead.capital}</div>
                      <div className="text-[11px] text-ink-400 mt-0.5">
                        {lead.preferredService || lead.segment}
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Est. ₹{(lead.estimatedValue || 25000).toLocaleString("en-IN")}
                      </span>
                    </td>

                    {/* Attribution */}
                    <td className="px-4 py-4 font-mono text-[11px] text-ink-400">
                      <div className="text-white font-medium">{lead.source}</div>
                      <div>{lead.campaign || "Direct"}</div>
                      {lead.utmMedium && (
                        <div className="text-[10px] text-ink-500">{lead.utmMedium}</div>
                      )}
                    </td>

                    {/* Assigned Agent (Interactive Reassignment) */}
                    <td className="px-4 py-4">
                      <select
                        value={lead.assignedAgent || lead.assignedTo || users[0]?.name}
                        onChange={(e) => handleInlineAgentChange(lead.id, e.target.value)}
                        className="rounded-lg border border-[#1E293B] bg-[#0E1624] px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Status (Interactive Status Change) */}
                    <td className="px-4 py-4">
                      <select
                        value={lead.status.toUpperCase()}
                        onChange={(e) =>
                          handleInlineStatusChange(lead.id, e.target.value as LeadStatus)
                        }
                        className={cx(
                          "rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-none cursor-pointer",
                          lead.status.toUpperCase() === "NEW" &&
                            "bg-blue-500/10 border-blue-500/30 text-blue-400",
                          lead.status.toUpperCase() === "CONTACTED" &&
                            "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
                          lead.status.toUpperCase() === "QUALIFIED" &&
                            "bg-purple-500/10 border-purple-500/30 text-purple-400",
                          lead.status.toUpperCase() === "PAYMENT_PENDING" &&
                            "bg-amber-500/10 border-amber-500/30 text-amber-400",
                          lead.status.toUpperCase() === "CONVERTED" &&
                            "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                          lead.status.toUpperCase() === "LOST" &&
                            "bg-red-500/10 border-red-500/30 text-red-400"
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

                    {/* Actions: Call, WhatsApp, Edit, Delete */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onWorkLead(lead)}
                          className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 p-2 hover:bg-emerald-600/30 transition-colors cursor-pointer"
                          title="Call Lead via CTI Workbench"
                        >
                          <PhoneCall className="size-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={waSendingId === lead.id}
                          onClick={() => handleInstantWhatsApp(lead)}
                          className="rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] p-2 hover:bg-[#22C55E]/25 transition-colors cursor-pointer disabled:opacity-50"
                          title="Send Official Meta WhatsApp Welcome (+91 92018 00995)"
                        >
                          {waSendingId === lead.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="size-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingLead({ ...lead })}
                          className="rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 p-2 hover:bg-cyan-600/30 transition-colors cursor-pointer"
                          title="Edit Lead Details"
                        >
                          <Edit2 className="size-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingLead(lead)}
                          className="rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-300 p-2 hover:bg-rose-600/30 transition-colors cursor-pointer"
                          title="Delete / Archive Lead"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW LEAD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl p-6 text-white space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="size-5 text-emerald-400" />
                <h3 className="font-bold text-lg font-display">Create New Inbound Lead</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4 text-xs">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  className={cx(
                    "w-full rounded-xl border bg-[#0E1624] p-2.5 text-white focus:outline-none",
                    formErrors.name ? "border-red-500" : "border-[#1E293B] focus:border-brand-500"
                  )}
                />
                {formErrors.name && (
                  <p className="text-red-400 text-[11px] mt-1">{formErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">
                    Phone / Mobile <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="98201 44521"
                    value={newLeadForm.mobile}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, mobile: e.target.value })}
                    className={cx(
                      "w-full rounded-xl border bg-[#0E1624] p-2.5 text-white focus:outline-none",
                      formErrors.mobile ? "border-red-500" : "border-[#1E293B] focus:border-brand-500"
                    )}
                  />
                  {formErrors.mobile && (
                    <p className="text-red-400 text-[11px] mt-1">{formErrors.mobile}</p>
                  )}
                </div>

                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="investor@example.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">City / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, Bangalore"
                    value={newLeadForm.city}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, city: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Capital Bracket</label>
                  <select
                    value={newLeadForm.capital}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, capital: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {CAPITAL_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Desired Service Segment</label>
                  <select
                    value={newLeadForm.segment}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, segment: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {SERVICE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-ink-300 font-semibold mb-1">UTM / Lead Source</label>
                  <select
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {SOURCE_OPTIONS.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Assigned Sales Agent</label>
                <select
                  value={newLeadForm.assignedAgent}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, assignedAgent: e.target.value })}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Initial Advisory Notes</label>
                <textarea
                  rows={2}
                  placeholder="Trading experience, capital horizon, special requests..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2 font-bold shadow-md transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Create Lead</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LEAD MODAL */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl p-6 text-white space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="size-5 text-cyan-400" />
                <h3 className="font-bold text-lg font-display">
                  Edit Lead: {editingLead.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingLead(null)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLeadSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingLead.name}
                    onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={editingLead.mobile}
                    onChange={(e) => setEditingLead({ ...editingLead, mobile: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={editingLead.email}
                    onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={editingLead.city}
                    onChange={(e) => setEditingLead({ ...editingLead, city: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Capital Bracket</label>
                  <select
                    value={editingLead.budget || editingLead.capital}
                    onChange={(e) => setEditingLead({ ...editingLead, budget: e.target.value, capital: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {CAPITAL_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Advisory Service</label>
                  <select
                    value={editingLead.preferredService}
                    onChange={(e) => setEditingLead({ ...editingLead, preferredService: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {SERVICE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Lifecycle Status</label>
                  <select
                    value={editingLead.status.toUpperCase()}
                    onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as LeadStatus })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="CONSULTATION_SCHEDULED">Consultation</option>
                    <option value="PAYMENT_PENDING">Payment Pending</option>
                    <option value="CONVERTED">Converted</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Assigned Agent</label>
                  <select
                    value={editingLead.assignedAgent}
                    onChange={(e) => setEditingLead({ ...editingLead, assignedAgent: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editingLead.notes}
                  onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 font-bold shadow-md transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE LEAD CONFIRMATION MODAL */}
      {deletingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#090E17] shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="size-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Delete Lead Record</h3>
                <p className="text-xs text-ink-400 font-mono">{deletingLead.id}</p>
              </div>
            </div>

            <p className="text-xs text-ink-300">
              Are you sure you want to permanently delete lead{" "}
              <strong className="text-white">{deletingLead.name}</strong> ({deletingLead.mobile})? All logged activity, notes, and telecalling records will be removed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setDeletingLead(null)}
                className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteLeadConfirm}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 font-bold shadow-md transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Confirm Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAD 360 DETAIL SLIDE-OVER DRAWER */}
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

            {/* Quick Actions Row */}
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

              <button
                type="button"
                onClick={() => {
                  setEditingLead({ ...selectedLead });
                  setShowDrawer(false);
                }}
                className="rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 px-4 py-2.5 text-xs font-bold hover:bg-cyan-600/30 transition-colors cursor-pointer"
              >
                <Edit2 className="size-4" />
              </button>

              <button
                type="button"
                disabled={waSendingId === selectedLead.id}
                onClick={() => handleInstantWhatsApp(selectedLead)}
                className="rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] px-4 py-2.5 text-xs font-bold hover:bg-[#22C55E]/25 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title="Send Official Meta WhatsApp Welcome"
              >
                {waSendingId === selectedLead.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquare className="size-4" />
                )}
                <span>WhatsApp Welcome</span>
              </button>
            </div>

            {/* AI Insights Card */}
            <div className="rounded-xl border border-brand-500/30 bg-[#0E1624] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-300 uppercase font-mono flex items-center gap-1.5">
                  <Sparkles className="size-4 text-brand-400" />
                  <span>AI Advisory Analysis</span>
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

            {/* Lead Specifications */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 space-y-1">
                <span className="text-[10px] uppercase font-mono text-ink-400">Trading Capital</span>
                <p className="font-bold text-white font-mono">{selectedLead.budget || selectedLead.capital}</p>
              </div>
              <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 space-y-1">
                <span className="text-[10px] uppercase font-mono text-ink-400">Preferred Service</span>
                <p className="font-bold text-white truncate">{selectedLead.preferredService || selectedLead.segment}</p>
              </div>
              <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 space-y-1">
                <span className="text-[10px] uppercase font-mono text-ink-400">Assigned Agent</span>
                <p className="font-bold text-white">{selectedLead.assignedAgent}</p>
              </div>
              <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 space-y-1">
                <span className="text-[10px] uppercase font-mono text-ink-400">Source / Campaign</span>
                <p className="font-bold text-white truncate">{selectedLead.source}</p>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] uppercase font-mono text-ink-400">Advisory Notes & Timeline</span>
              <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 text-ink-300 space-y-2">
                <p>{selectedLead.notes || "No notes logged for this lead yet."}</p>
                <div className="flex items-center justify-between text-[10px] font-mono text-ink-400 border-t border-[#1E293B] pt-2">
                  <span>Created: {selectedLead.createdAt}</span>
                  <span>NPC Attempts: {selectedLead.npcAttempts || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
