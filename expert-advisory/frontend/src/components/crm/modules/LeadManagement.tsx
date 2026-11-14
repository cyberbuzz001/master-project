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
  Users,
  ReceiptIndianRupee,
  FileText,
  CheckSquare,
  Send,
  Layers,
  Calculator,
  Percent,
  DollarSign,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import {
  type CrmLead,
  type LeadTemperature,
  type LeadStatus,
  type CrmUser,
  type CrmFreeTrial,
  type CrmProposal,
  INITIAL_FREE_TRIALS,
  INITIAL_PROPOSALS,
} from "@/lib/crm-data";

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

  // Sub-tabs: "leads" | "trials" | "proposals"
  const [activeTab, setActiveTab] = useState<"leads" | "trials" | "proposals">("leads");

  // Free Trials & Proposals State (Sections 6 & 7)
  const [freeTrials, setFreeTrials] = useState<CrmFreeTrial[]>(INITIAL_FREE_TRIALS);
  const [proposals, setProposals] = useState<CrmProposal[]>(INITIAL_PROPOSALS);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [deletingLead, setDeletingLead] = useState<CrmLead | null>(null);

  // Free Trial Modal State
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialLead, setTrialLead] = useState<CrmLead | null>(null);
  const [trialForm, setTrialForm] = useState<{
    segment: "Index Options" | "Equity Intraday" | "MCX Commodity" | "Combo";
    startDate: string;
    endDate: string;
    advisor: string;
    notes: string;
  }>({
    segment: "Index Options",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    advisor: users[0]?.name || "Vikram Malhotra",
    notes: "SEBI Compliance: 2 sessions max, 1 rec/session, strict SL enforced.",
  });

  // Proposal Modal State
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalLead, setProposalLead] = useState<CrmLead | null>(null);
  const [proposalForm, setProposalForm] = useState({
    packageName: "Index Options Alpha Desk — 6 Months",
    durationDays: 180,
    standardFee: 35000,
    discount: 5000,
    finalFee: 30000,
    installmentsCount: 2,
    advisor: users[0]?.name || "Vikram Malhotra",
  });

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
        full_name: newLeadForm.name.trim() || null,
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
        const createdLead = json.data as CrmLead & { full_name?: string };
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
        showToast(`Lead ${createdLead.name || createdLead.full_name || "record"} (${createdLead.id}) created successfully!`);
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
            full_name: editingLead.name,
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

  // 48-Hour Free Trial Workflow Handlers (Section 6)
  const handleOpenTrialModal = (lead: CrmLead) => {
    setTrialLead(lead);
    const segMap = lead.preferredService?.toLowerCase().includes("options")
      ? "Index Options"
      : lead.preferredService?.toLowerCase().includes("equity") || lead.preferredService?.toLowerCase().includes("cash")
      ? "Equity Intraday"
      : lead.preferredService?.toLowerCase().includes("commodity")
      ? "MCX Commodity"
      : "Combo";

    setTrialForm({
      segment: segMap as any,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
      advisor: lead.assignedAgent || users[0]?.name || "Vikram Malhotra",
      notes: "Strict 2-session adherence. Max 1 trade per session with predefined stop-loss.",
    });
    setShowTrialModal(true);
  };

  const handleStartTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialLead) return;

    const newTrial: CrmFreeTrial = {
      id: `TR-2026-${Math.floor(100 + Math.random() * 900)}`,
      leadId: trialLead.id,
      leadName: trialLead.name,
      mobile: trialLead.mobile,
      segment: trialForm.segment,
      startDate: trialForm.startDate,
      endDate: trialForm.endDate,
      status: "ACTIVE",
      touchpoint1Done: false,
      touchpoint2Done: false,
      touchpoint3Done: false,
      advisor: trialForm.advisor,
      notes: trialForm.notes,
    };

    setFreeTrials((prev) => [newTrial, ...prev]);
    onUpdateLeadStatus(trialLead.id, "QUALIFIED");

    // Auto-dispatch WhatsApp confirmation
    try {
      await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: trialLead.id,
          phone: trialLead.mobile,
          templateName: "adv_lead_welcome",
          templateParams: [trialLead.name, `${trialForm.segment} 48H Trial`],
          clientName: trialLead.name,
        }),
      });
    } catch (err) {
      console.warn("[Free Trial WhatsApp Dispatch Deferred]", err);
    }

    setShowTrialModal(false);
    showToast(`48-Hour Free Trial activated for ${trialLead.name}! WhatsApp welcome dispatched.`);
  };

  const handleToggleTouchpoint = (trialId: string, touchpointNum: 1 | 2 | 3) => {
    setFreeTrials((prev) =>
      prev.map((t) => {
        if (t.id === trialId) {
          const key = `touchpoint${touchpointNum}Done` as const;
          const nextVal = !t[key];
          return { ...t, [key]: nextVal };
        }
        return t;
      })
    );
    showToast(`Touchpoint ${touchpointNum} logged successfully.`);
  };

  const handleConvertTrialToPaid = (trial: CrmFreeTrial) => {
    setFreeTrials((prev) =>
      prev.map((t) => (t.id === trial.id ? { ...t, status: "CONVERTED" } : t))
    );
    onUpdateLeadStatus(trial.leadId, "PAYMENT_PENDING");

    // Open proposal modal for this lead
    const matchedLead = leads.find((l) => l.id === trial.leadId);
    if (matchedLead) {
      handleOpenProposalModal(matchedLead);
    } else {
      showToast(`Trial ${trial.id} converted to paid! Status updated to PAYMENT_PENDING.`);
    }
  };

  // Proposals & Installments Workflow Handlers (Section 7)
  const handleOpenProposalModal = (lead: CrmLead) => {
    setProposalLead(lead);
    setProposalForm({
      packageName: "Index Options Alpha Desk — 6 Months",
      durationDays: 180,
      standardFee: 35000,
      discount: 5000,
      finalFee: 30000,
      installmentsCount: 2,
      advisor: lead.assignedAgent || users[0]?.name || "Vikram Malhotra",
    });
    setShowProposalModal(true);
  };

  const handlePackageSelect = (pkgName: string) => {
    let std = 35000;
    let days = 180;
    let disc = 5000;

    if (pkgName.includes("3 Months")) {
      std = 25000;
      days = 90;
      disc = 3000;
    } else if (pkgName.includes("Annual") || pkgName.includes("Bespoke")) {
      std = 65000;
      days = 365;
      disc = 10000;
    } else if (pkgName.includes("Equity")) {
      std = 30000;
      days = 180;
      disc = 5000;
    } else if (pkgName.includes("Commodity")) {
      std = 35000;
      days = 180;
      disc = 5000;
    }

    setProposalForm((prev) => ({
      ...prev,
      packageName: pkgName,
      standardFee: std,
      durationDays: days,
      discount: disc,
      finalFee: std - disc,
    }));
  };

  const handleSaveAndDispatchProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalLead) return;

    const newProposal: CrmProposal = {
      id: `PROP-261021-${Math.floor(10 + Math.random() * 90)}`,
      leadId: proposalLead.id,
      leadName: proposalLead.name,
      mobile: proposalLead.mobile,
      packageName: proposalForm.packageName,
      durationDays: proposalForm.durationDays,
      standardFee: proposalForm.standardFee,
      discount: proposalForm.discount,
      finalFee: proposalForm.finalFee,
      installmentsCount: proposalForm.installmentsCount,
      status: "SENT",
      createdAt: "Today, Just now",
      advisor: proposalForm.advisor,
    };

    setProposals((prev) => [newProposal, ...prev]);
    onUpdateLeadStatus(proposalLead.id, "PAYMENT_PENDING");

    // Auto-dispatch WhatsApp with proposal summary
    try {
      await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: proposalLead.id,
          phone: proposalLead.mobile,
          templateName: "adv_plan_activation",
          templateParams: [
            proposalLead.name,
            proposalForm.packageName,
            `₹${proposalForm.finalFee.toLocaleString("en-IN")}`,
          ],
          clientName: proposalLead.name,
        }),
      });
    } catch (err) {
      console.warn("[Proposal WhatsApp Dispatch Deferred]", err);
    }

    setShowProposalModal(false);
    showToast(`Proposal ${newProposal.id} dispatched via WhatsApp to ${proposalLead.mobile}!`);
  };

  const handleAcceptProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: "ACCEPTED" } : p))
    );
    showToast(`Proposal ${proposalId} marked as ACCEPTED. Milestones registered in Installment Recovery Book.`);
  };

  const handleResendProposalWhatsApp = async (p: CrmProposal) => {
    try {
      await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: p.leadId,
          phone: p.mobile,
          templateName: "adv_plan_activation",
          templateParams: [
            p.leadName,
            p.packageName,
            `₹${p.finalFee.toLocaleString("en-IN")}`,
          ],
          clientName: p.leadName,
        }),
      });
      showToast(`Proposal details re-sent to ${p.mobile} via Meta WhatsApp.`);
    } catch (err) {
      showToast("Failed to dispatch WhatsApp message.", "error");
    }
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

      {/* Workflow Navigation Sub-tabs: Leads Matrix | 48h Free Trials (Sec 6) | Proposals & Closures (Sec 7) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1E293B] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("leads")}
          className={cx(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer",
            activeTab === "leads"
              ? "bg-brand-600 text-white shadow-lg shadow-brand-500/25"
              : "text-ink-300 hover:text-white hover:bg-[#0E1624] border border-[#1E293B]"
          )}
        >
          <Users className="size-4" />
          <span>Leads & Inbound Matrix ({filteredLeads.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("trials")}
          className={cx(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer",
            activeTab === "trials"
              ? "bg-orange-600 text-white shadow-lg shadow-orange-500/25"
              : "text-ink-300 hover:text-white hover:bg-[#0E1624] border border-[#1E293B]"
          )}
        >
          <Flame className="size-4 text-orange-400" />
          <span>48-Hour Free Trials ({freeTrials.length})</span>
          <span className="ml-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] text-orange-300 font-mono">
            Section 6
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("proposals")}
          className={cx(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer",
            activeTab === "proposals"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
              : "text-ink-300 hover:text-white hover:bg-[#0E1624] border border-[#1E293B]"
          )}
        >
          <ReceiptIndianRupee className="size-4 text-indigo-400" />
          <span>Proposals & Milestone Closures ({proposals.length})</span>
          <span className="ml-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300 font-mono">
            Section 7
          </span>
        </button>
      </div>

      {/* TAB 1: ALL LEADS MATRIX */}
      {activeTab === "leads" && (
        <div className="space-y-6">
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
                          onClick={() => handleOpenTrialModal(lead)}
                          className="rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-300 p-2 hover:bg-orange-600/30 transition-colors cursor-pointer"
                          title="Start 48h Free Trial (Section 6)"
                        >
                          <Flame className="size-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenProposalModal(lead)}
                          className="rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 p-2 hover:bg-indigo-600/30 transition-colors cursor-pointer"
                          title="Draft Proposal & Split Installments (Section 7)"
                        >
                          <ReceiptIndianRupee className="size-3.5" />
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
    </div>
  )}

      {/* TAB 2: 48-HOUR FREE TRIAL PLAYBOOK (SECTION 6) */}
      {activeTab === "trials" && (
        <div className="space-y-6 animate-fade-in">
          {/* Trial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-orange-500/30 bg-[#0E1624] p-4">
              <div className="flex items-center justify-between text-ink-400">
                <span className="text-xs font-mono uppercase">Active 48h Trials</span>
                <Flame className="size-4 text-orange-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono text-white">
                {freeTrials.filter((t) => t.status === "ACTIVE").length}
              </p>
              <span className="text-[11px] text-orange-300">Live 2-session demo trading</span>
            </div>

            <div className="rounded-2xl border border-blue-500/30 bg-[#0E1624] p-4">
              <div className="flex items-center justify-between text-ink-400">
                <span className="text-xs font-mono uppercase">Touchpoint 1 (Margin)</span>
                <Clock className="size-4 text-blue-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono text-white">
                {freeTrials.filter((t) => !t.touchpoint1Done && t.status === "ACTIVE").length} Pending
              </p>
              <span className="text-[11px] text-blue-300">Pre-market margin verification</span>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-[#0E1624] p-4">
              <div className="flex items-center justify-between text-ink-400">
                <span className="text-xs font-mono uppercase">Touchpoint 3 (Closing)</span>
                <Calendar className="size-4 text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono text-white">
                {freeTrials.filter((t) => t.touchpoint2Done && !t.touchpoint3Done && t.status === "ACTIVE").length} Ready
              </p>
              <span className="text-[11px] text-amber-300">Day-2 closing conversion review</span>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-[#0E1624] p-4">
              <div className="flex items-center justify-between text-ink-400">
                <span className="text-xs font-mono uppercase">Converted to Paid</span>
                <CheckCircle2 className="size-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono text-white">
                {freeTrials.filter((t) => t.status === "CONVERTED").length}
              </p>
              <span className="text-[11px] text-emerald-300">Moved to payment pending</span>
            </div>
          </div>

          {/* Section 6 Playbook Banner */}
          <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-950/40 via-[#0E1624] to-[#090E17] p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Flame className="size-5 text-orange-400" />
                  <h3 className="font-bold text-white text-base">Section 6: The 48-Hour Free Trial Playbook</h3>
                </div>
                <p className="text-xs text-ink-300 max-w-2xl">
                  Enforces 2 trading sessions, maximum 1 recommendation per session, and strict stop-loss adherence.
                  Execute Touchpoint 1 (Morning margin check), Touchpoint 2 (Post-market review), and Touchpoint 3 (Closing conversion interview) to hit target 45%+ trial-to-paid ratios.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (leads[0]) handleOpenTrialModal(leads[0]);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md shadow-orange-500/20 cursor-pointer shrink-0"
              >
                <Plus className="size-4" />
                <span>+ Enroll New Lead to 48h Trial</span>
              </button>
            </div>
          </div>

          {/* Active Trials Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {freeTrials.map((trial) => (
              <div
                key={trial.id}
                className={cx(
                  "rounded-2xl border p-5 transition-all space-y-4",
                  trial.status === "CONVERTED"
                    ? "border-emerald-500/30 bg-[#091510]"
                    : trial.status === "ACTIVE"
                    ? "border-orange-500/30 bg-[#0B101B]"
                    : "border-[#1E293B] bg-[#090E17]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base">{trial.leadName}</h4>
                      <span className="font-mono text-[10px] text-ink-400 border border-[#1E293B] px-2 py-0.5 rounded bg-[#0E1624]">
                        {trial.id}
                      </span>
                    </div>
                    <div className="text-xs text-ink-400 font-mono mt-0.5">
                      {trial.mobile} • Advisor: <span className="text-white">{trial.advisor}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[11px] font-bold px-2.5 py-1">
                      {trial.segment}
                    </span>
                    <span
                      className={cx(
                        "rounded-full text-[10px] font-mono font-bold px-2.5 py-1 border",
                        trial.status === "ACTIVE"
                          ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                          : trial.status === "CONVERTED"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                          : "bg-ink-700/50 border-ink-600 text-ink-400"
                      )}
                    >
                      {trial.status}
                    </span>
                  </div>
                </div>

                {/* 3 Touchpoints Checklist */}
                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-2.5">
                  <div className="text-[11px] font-mono uppercase text-ink-400 font-bold">
                    Mandatory 3-Touchpoint Cadence
                  </div>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer text-ink-200 hover:text-white">
                      <input
                        type="checkbox"
                        checked={trial.touchpoint1Done}
                        onChange={() => handleToggleTouchpoint(trial.id, 1)}
                        className="rounded border-[#1E293B] bg-[#090E17] text-orange-500 focus:ring-0 cursor-pointer size-4"
                      />
                      <span className={trial.touchpoint1Done ? "line-through text-ink-400" : ""}>
                        <strong>Touchpoint 1 (09:00 AM):</strong> Confirm Telegram/WhatsApp signal delivery & margin readiness
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-ink-200 hover:text-white">
                      <input
                        type="checkbox"
                        checked={trial.touchpoint2Done}
                        onChange={() => handleToggleTouchpoint(trial.id, 2)}
                        className="rounded border-[#1E293B] bg-[#090E17] text-orange-500 focus:ring-0 cursor-pointer size-4"
                      />
                      <span className={trial.touchpoint2Done ? "line-through text-ink-400" : ""}>
                        <strong>Touchpoint 2 (03:45 PM):</strong> Review Day-1 trade execution & validate strict stop-loss adherence
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer text-ink-200 hover:text-white">
                      <input
                        type="checkbox"
                        checked={trial.touchpoint3Done}
                        onChange={() => handleToggleTouchpoint(trial.id, 3)}
                        className="rounded border-[#1E293B] bg-[#090E17] text-orange-500 focus:ring-0 cursor-pointer size-4"
                      />
                      <span className={trial.touchpoint3Done ? "line-through text-ink-400" : ""}>
                        <strong>Touchpoint 3 (Day-2 Close):</strong> Conduct formal closing interview & pitch structured advisory package
                      </span>
                    </label>
                  </div>
                </div>

                {/* Trial Validity & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[#1E293B]/60 text-xs">
                  <div className="text-ink-400 font-mono text-[11px]">
                    Window: <span className="text-white">{trial.startDate}</span> to{" "}
                    <span className="text-white">{trial.endDate}</span> (2 sessions)
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const matched = leads.find((l) => l.id === trial.leadId);
                        if (matched) handleInstantWhatsApp(matched);
                        else showToast(`WhatsApp touchpoint sent to ${trial.mobile}`);
                      }}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>WhatsApp Nudge</span>
                    </button>

                    {trial.status !== "CONVERTED" && (
                      <button
                        type="button"
                        onClick={() => handleConvertTrialToPaid(trial)}
                        className="rounded-xl bg-orange-600 hover:bg-orange-500 text-white px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-orange-500/20"
                      >
                        <ReceiptIndianRupee className="size-3.5" />
                        <span>Convert to Paid</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PROPOSALS & MILESTONE CLOSURES (SECTION 7) */}
      {activeTab === "proposals" && (
        <div className="space-y-6 animate-fade-in">
          {/* Proposals KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-indigo-500/30 bg-[#0E1624] p-4">
              <div className="flex items-center justify-between text-ink-400">
                <span className="text-xs font-mono uppercase">Total Proposals</span>
                <ReceiptIndianRupee className="size-4 text-indigo-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono text-white">{proposals.length}</p>
              <span className="text-[11px] text-indigo-300">Drafted or in negotiation</span>
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-[#0E1624] p-4">
              <div className="flex items-center justify-between text-ink-400">
                <span className="text-xs font-mono uppercase">Pipeline Value</span>
                <DollarSign className="size-4 text-cyan-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono text-white">
                ₹{proposals.reduce((acc, p) => acc + p.finalFee, 0).toLocaleString("en-IN")}
              </p>
              <span className="text-[11px] text-cyan-300">Net receivable post-discounts</span>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-[#0E1624] p-4">
              <div className="flex items-center justify-between text-ink-400">
                <span className="text-xs font-mono uppercase">Accepted Closures</span>
                <CheckCircle2 className="size-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono text-white">
                {proposals.filter((p) => p.status === "ACCEPTED" || p.status === "CONVERTED").length}
              </p>
              <span className="text-[11px] text-emerald-300">Installments ledger generated</span>
            </div>

            <div className="rounded-2xl border border-purple-500/30 bg-[#0E1624] p-4">
              <div className="flex items-center justify-between text-ink-400">
                <span className="text-xs font-mono uppercase">Avg Milestone Split</span>
                <Layers className="size-4 text-purple-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono text-white">2.2 Installments</p>
              <span className="text-[11px] text-purple-300">50% upfront / 50% milestone</span>
            </div>
          </div>

          {/* Section 7 Guidance Banner */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-[#0E1624] to-[#090E17] p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ReceiptIndianRupee className="size-5 text-indigo-400" />
                  <h3 className="font-bold text-white text-base">Section 7: Sales Proposals & Milestone Closures</h3>
                </div>
                <p className="text-xs text-ink-300 max-w-2xl">
                  Draft formal proposals with transparent standard fees, authorized discounts, and duration. Split fees into 2 or 3 structured installments (e.g. 50% upfront, 50% after 15 trading days). Dispatch proposal breakdown directly via Meta WhatsApp Cloud API.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (leads[0]) handleOpenProposalModal(leads[0]);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer shrink-0"
              >
                <Plus className="size-4" />
                <span>+ Draft New Proposal</span>
              </button>
            </div>
          </div>

          {/* Proposals List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {proposals.map((prop) => (
              <div
                key={prop.id}
                className={cx(
                  "rounded-2xl border p-5 transition-all space-y-4",
                  prop.status === "ACCEPTED"
                    ? "border-emerald-500/30 bg-[#091510]"
                    : prop.status === "SENT"
                    ? "border-indigo-500/30 bg-[#0B101B]"
                    : "border-[#1E293B] bg-[#090E17]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base">{prop.leadName}</h4>
                      <span className="font-mono text-[10px] text-ink-400 border border-[#1E293B] px-2 py-0.5 rounded bg-[#0E1624]">
                        {prop.id}
                      </span>
                    </div>
                    <div className="text-xs text-ink-400 font-mono mt-0.5">
                      {prop.mobile} • RM: <span className="text-white">{prop.advisor}</span>
                    </div>
                  </div>

                  <span
                    className={cx(
                      "rounded-full text-[10px] font-mono font-bold px-2.5 py-1 border",
                      prop.status === "SENT"
                        ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                        : prop.status === "ACCEPTED"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                        : "bg-ink-700/50 border-ink-600 text-ink-400"
                    )}
                  >
                    {prop.status}
                  </span>
                </div>

                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-2 text-xs">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{prop.packageName}</span>
                    <span className="font-mono text-cyan-400">{prop.durationDays} Days</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1E293B] text-[11px] font-mono">
                    <div>
                      <span className="text-ink-400 block text-[10px]">Standard Fee</span>
                      <span className="text-ink-300 line-through">₹{prop.standardFee.toLocaleString("en-IN")}</span>
                    </div>
                    <div>
                      <span className="text-ink-400 block text-[10px]">Discount</span>
                      <span className="text-emerald-400">-₹{prop.discount.toLocaleString("en-IN")}</span>
                    </div>
                    <div>
                      <span className="text-ink-400 block text-[10px]">Final Fee</span>
                      <span className="text-white font-bold text-sm">₹{prop.finalFee.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between text-[11px]">
                    <span className="text-ink-400 font-mono">Installment Structure:</span>
                    <span className="font-bold text-indigo-300">
                      {prop.installmentsCount} Milestone{prop.installmentsCount > 1 ? "s" : ""}{" "}
                      (₹{Math.round(prop.finalFee / prop.installmentsCount).toLocaleString("en-IN")} / installment)
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#1E293B]/60 text-xs">
                  <span className="text-[11px] text-ink-400 font-mono">Created: {prop.createdAt}</span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResendProposalWhatsApp(prop)}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>WhatsApp Proposal</span>
                    </button>

                    {prop.status !== "ACCEPTED" && (
                      <button
                        type="button"
                        onClick={() => handleAcceptProposal(prop.id)}
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>Mark Accepted</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  Full Name <span className="text-ink-500">(optional)</span>
                </label>
                <input
                  type="text"
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onWorkLead(selectedLead);
                  setShowDrawer(false);
                }}
                className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                <PhoneCall className="size-4" />
                <span>Call Lead via CTI</span>
              </button>

              <button
                type="button"
                disabled={waSendingId === selectedLead.id}
                onClick={() => handleInstantWhatsApp(selectedLead)}
                className="rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] px-3.5 py-2.5 text-xs font-bold hover:bg-[#22C55E]/25 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title="Send Official Meta WhatsApp Welcome"
              >
                {waSendingId === selectedLead.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquare className="size-4" />
                )}
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleOpenTrialModal(selectedLead);
                  setShowDrawer(false);
                }}
                className="rounded-xl bg-orange-600 hover:bg-orange-500 text-white px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-orange-500/20"
                title="Start 48h Free Trial (Section 6)"
              >
                <Flame className="size-4" />
                <span>48h Trial</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleOpenProposalModal(selectedLead);
                  setShowDrawer(false);
                }}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
                title="Draft Proposal & Split Installments (Section 7)"
              >
                <ReceiptIndianRupee className="size-4" />
                <span>Proposal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingLead({ ...selectedLead });
                  setShowDrawer(false);
                }}
                className="rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 p-2.5 text-xs font-bold hover:bg-cyan-600/30 transition-colors cursor-pointer"
                title="Edit Lead"
              >
                <Edit2 className="size-4" />
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

      {/* MODAL 1: 48-HOUR FREE TRIAL ENROLLMENT (SECTION 6) */}
      {showTrialModal && trialLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-orange-500/30 bg-[#090E17] shadow-2xl p-6 text-white space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Flame className="size-5 text-orange-400" />
                <h3 className="font-bold text-lg font-display">Start 48-Hour Free Trial</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTrialModal(false)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-xs text-orange-300">
              <span className="font-bold block mb-0.5">Section 6 Compliance Framework:</span>
              Free trials are strictly restricted to 2 trading sessions, maximum 1 recommendation per session, with predefined stop-loss orders.
            </div>

            <form onSubmit={handleStartTrialSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Lead Name</label>
                  <input
                    type="text"
                    disabled
                    value={trialLead.name}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624]/60 p-2.5 text-white/80 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Mobile</label>
                  <input
                    type="text"
                    disabled
                    value={trialLead.mobile}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624]/60 p-2.5 text-white/80 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Advisory Segment</label>
                <select
                  value={trialForm.segment}
                  onChange={(e) =>
                    setTrialForm({
                      ...trialForm,
                      segment: e.target.value as any,
                    })
                  }
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-orange-500 focus:outline-none cursor-pointer"
                >
                  <option value="Index Options">Index Options (Nifty & Bank Nifty)</option>
                  <option value="Equity Intraday">Equity Intraday (High Beta Cash)</option>
                  <option value="MCX Commodity">MCX Commodity (Crude Oil & Gold)</option>
                  <option value="Combo">Combo (Index + Equity Alpha)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={trialForm.startDate}
                    onChange={(e) => setTrialForm({ ...trialForm, startDate: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-orange-500 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">End Date (48 Hours)</label>
                  <input
                    type="date"
                    required
                    value={trialForm.endDate}
                    onChange={(e) => setTrialForm({ ...trialForm, endDate: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-orange-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Assigned Telecaller / Advisor</label>
                <select
                  value={trialForm.advisor}
                  onChange={(e) => setTrialForm({ ...trialForm, advisor: e.target.value })}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-orange-500 focus:outline-none cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Trial Guidelines & Notes</label>
                <textarea
                  rows={2}
                  value={trialForm.notes}
                  onChange={(e) => setTrialForm({ ...trialForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowTrialModal(false)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white px-5 py-2 font-bold shadow-md shadow-orange-500/20 transition-colors cursor-pointer"
                >
                  <Flame className="size-4" />
                  <span>Activate 48h Trial & Send WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROPOSAL & STRUCTURED INSTALLMENTS (SECTION 7) */}
      {showProposalModal && proposalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-indigo-500/30 bg-[#090E17] shadow-2xl p-6 text-white space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <ReceiptIndianRupee className="size-5 text-indigo-400" />
                <h3 className="font-bold text-lg font-display">Draft Proposal & Split Installments</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProposalModal(false)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-300">
              <span className="font-bold block mb-0.5">Section 7 Milestone Closures:</span>
              Structure standard advisory fees with transparent discounts and 1 to 3 milestone installments.
            </div>

            <form onSubmit={handleSaveAndDispatchProposal} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Client Name</label>
                  <input
                    type="text"
                    disabled
                    value={proposalLead.name}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624]/60 p-2.5 text-white/80 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Mobile</label>
                  <input
                    type="text"
                    disabled
                    value={proposalLead.mobile}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624]/60 p-2.5 text-white/80 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Advisory Package</label>
                <select
                  value={proposalForm.packageName}
                  onChange={(e) => handlePackageSelect(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Index Options Alpha Desk — 3 Months">Index Options Alpha Desk — 3 Months (Std ₹25,000)</option>
                  <option value="Index Options Alpha Desk — 6 Months">Index Options Alpha Desk — 6 Months (Std ₹35,000)</option>
                  <option value="Equity Intraday & Swing Desk — 6 Months">Equity Intraday & Swing Desk — 6 Months (Std ₹30,000)</option>
                  <option value="HNI Bespoke Multi-Cap Desk — Annual">HNI Bespoke Multi-Cap Desk — Annual (Std ₹65,000)</option>
                  <option value="Commodity MCX Alpha Desk — 6 Months">Commodity MCX Alpha Desk — 6 Months (Std ₹35,000)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Standard Fee (₹)</label>
                  <input
                    type="number"
                    value={proposalForm.standardFee}
                    onChange={(e) => {
                      const std = Number(e.target.value) || 0;
                      setProposalForm((prev) => ({
                        ...prev,
                        standardFee: std,
                        finalFee: Math.max(0, std - prev.discount),
                      }));
                    }}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Approved Discount (₹)</label>
                  <input
                    type="number"
                    value={proposalForm.discount}
                    onChange={(e) => {
                      const disc = Number(e.target.value) || 0;
                      setProposalForm((prev) => ({
                        ...prev,
                        discount: disc,
                        finalFee: Math.max(0, prev.standardFee - disc),
                      }));
                    }}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Final Payable (₹)</label>
                  <input
                    type="number"
                    disabled
                    value={proposalForm.finalFee}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624]/60 p-2.5 text-emerald-400 font-bold font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Installment Split</label>
                <select
                  value={proposalForm.installmentsCount}
                  onChange={(e) =>
                    setProposalForm({
                      ...proposalForm,
                      installmentsCount: Number(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-indigo-500 focus:outline-none cursor-pointer font-mono"
                >
                  <option value={1}>1 Installment (100% Upfront: ₹{proposalForm.finalFee.toLocaleString("en-IN")})</option>
                  <option value={2}>
                    2 Installments (50% Upfront: ₹{Math.round(proposalForm.finalFee / 2).toLocaleString("en-IN")}, 50% in 15 Days: ₹{Math.round(proposalForm.finalFee / 2).toLocaleString("en-IN")})
                  </option>
                  <option value={3}>
                    3 Installments (40%: ₹{Math.round(proposalForm.finalFee * 0.4).toLocaleString("en-IN")}, 30%: ₹{Math.round(proposalForm.finalFee * 0.3).toLocaleString("en-IN")}, 30%: ₹{Math.round(proposalForm.finalFee * 0.3).toLocaleString("en-IN")})
                  </option>
                </select>
              </div>

              {/* Installment Milestone Schedule Preview */}
              <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-mono text-ink-400 font-bold block">
                  Milestone Schedule Preview
                </span>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-ink-200">
                    <span>Milestone 1 (Immediate / Activation):</span>
                    <span className="font-bold text-white">
                      ₹{Math.round(proposalForm.finalFee / proposalForm.installmentsCount).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {proposalForm.installmentsCount >= 2 && (
                    <div className="flex items-center justify-between text-ink-400">
                      <span>Milestone 2 (15 Trading Days):</span>
                      <span className="font-bold text-white">
                        ₹{Math.round(proposalForm.finalFee / proposalForm.installmentsCount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                  {proposalForm.installmentsCount >= 3 && (
                    <div className="flex items-center justify-between text-ink-400">
                      <span>Milestone 3 (30 Trading Days):</span>
                      <span className="font-bold text-white">
                        ₹{Math.round(proposalForm.finalFee / proposalForm.installmentsCount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 font-bold shadow-md shadow-indigo-500/20 transition-colors cursor-pointer"
                >
                  <Send className="size-4" />
                  <span>Dispatch Proposal via WhatsApp & Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
