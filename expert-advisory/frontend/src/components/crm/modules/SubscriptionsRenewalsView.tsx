"use client";

import React, { useState, useEffect } from "react";
import {
  RotateCw,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ReceiptIndianRupee,
  PhoneCall,
  MessageSquare,
  Sparkles,
  Plus,
  Edit2,
  PauseCircle,
  PlayCircle,
  XCircle,
  Trash2,
  Search,
  Check,
  X,
  Loader2,
  CreditCard,
  User,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { Customer360 } from "@/lib/crm-data";
import type { StoredSubscription } from "@/lib/leads-store";

interface SubscriptionsRenewalsViewProps {
  customers: Customer360[];
  onInitiateRenewalCall?: (customer: Customer360) => void;
  onUpdateCustomerSubscription?: (customerId: string, newSub: any) => void;
}

const PACKAGES = [
  { name: "Starter Equity Advisory", price: "₹8,000 / Qtr", amount: 8000, duration: "3 Months", target: "Retail Equity Delivery" },
  { name: "Equity Swing & Momentum", price: "₹15,000 / Qtr", amount: 15000, duration: "3 Months", target: "Positional Cash Traders" },
  { name: "Index Derivatives Alpha", price: "₹25,000 / Qtr", amount: 25000, duration: "3 Months", target: "Nifty & Bank Nifty F&O" },
  { name: "Multi-Segment Pro (F&O + MCX)", price: "₹45,000 / 6 Mo", amount: 45000, duration: "6 Months", target: "Active Derivatives" },
  { name: "HNI Bespoke Advisory", price: "₹75,000 / Year", amount: 75000, duration: "12 Months", target: "HNIs (Portfolio > ₹25L)" },
  { name: "Institutional Desk", price: "₹1,50,000 / Year", amount: 150000, duration: "12 Months", target: "Family Offices & Corporates" },
];

export function SubscriptionsRenewalsView({
  customers,
  onInitiateRenewalCall,
  onUpdateCustomerSubscription,
}: SubscriptionsRenewalsViewProps) {
  const [activeTab, setActiveTab] = useState<"renewals" | "subscriptions" | "packages">("subscriptions");
  const [subscriptions, setSubscriptions] = useState<StoredSubscription[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSub, setEditingSub] = useState<StoredSubscription | null>(null);
  const [cancelingSub, setCancelingSub] = useState<StoredSubscription | null>(null);

  // Loading & Toasts
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Form state for creating plan
  const [newSubForm, setNewSubForm] = useState({
    customerId: customers[0]?.id || "CUST-1001",
    customerName: customers[0]?.name || "Arjun Nambiar",
    customerCode: customers[0]?.customerCode || "ESC-2026-0042",
    planName: "Index Derivatives Alpha",
    tier: "Quarterly (3 Months)",
    amount: 25000,
    duration: "3 Months",
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    paymentMethod: "Razorpay / UPI",
    relationshipManager: "Vikram Malhotra",
    notes: "",
  });

  // Fetch live subscriptions
  const fetchSubscriptions = async () => {
    try {
      const res = await fetch("/api/v1/office/subscriptions");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSubscriptions(json.data);
          return;
        }
      }
    } catch (_) {}

    // Fallback seed from customers
    const fallback: StoredSubscription[] = customers.map((c, i) => ({
      id: `SUB-2026-${1000 + i}`,
      customerId: c.id,
      customerName: c.name,
      customerCode: c.customerCode,
      planName: c.currentSubscription.planName,
      tier: "Standard Advisory",
      amount: c.currentSubscription.amount,
      duration: "3 Months",
      startDate: c.currentSubscription.startDate,
      expiryDate: c.currentSubscription.expiryDate,
      daysRemaining: c.currentSubscription.daysRemaining,
      status: "ACTIVE",
      paymentMethod: "Razorpay / UPI",
      relationshipManager: c.relationshipManager,
      createdAt: c.joinedDate,
      updatedAt: "Today",
    }));
    setSubscriptions(fallback);
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  // Create Plan Handler
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedCust = customers.find((c) => c.id === newSubForm.customerId);
      const payload = {
        customerId: newSubForm.customerId,
        customerName: selectedCust?.name || newSubForm.customerName,
        customerCode: selectedCust?.customerCode || newSubForm.customerCode,
        planName: newSubForm.planName,
        tier: newSubForm.tier,
        amount: Number(newSubForm.amount) || 25000,
        duration: newSubForm.duration,
        expiryDate: newSubForm.expiryDate,
        paymentMethod: newSubForm.paymentMethod,
        relationshipManager: newSubForm.relationshipManager,
        notes: newSubForm.notes,
      };

      const res = await fetch("/api/v1/office/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubscriptions((prev) => [json.data, ...prev]);
        setShowCreateModal(false);
        showToast(`Created subscription ${json.data.id} for ${json.data.customerName}!`);
      } else {
        showToast(json.message || "Failed to create subscription", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Plan Handler
  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/office/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSub.id,
          updates: {
            planName: editingSub.planName,
            tier: editingSub.tier,
            amount: Number(editingSub.amount),
            expiryDate: editingSub.expiryDate,
            status: editingSub.status,
            relationshipManager: editingSub.relationshipManager,
            notes: editingSub.notes,
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === editingSub.id ? json.data : s))
        );
        setEditingSub(null);
        showToast(`Updated plan ${json.data.id} successfully!`);
      } else {
        showToast(json.message || "Failed to update subscription", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pause / Resume / Cancel Handler
  const handleToggleStatus = async (sub: StoredSubscription, nextStatus: "ACTIVE" | "PAUSED" | "CANCELLED") => {
    try {
      const res = await fetch("/api/v1/office/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sub.id,
          updates: { status: nextStatus },
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, status: nextStatus } : s))
        );
        showToast(`Subscription ${sub.id} marked as ${nextStatus}!`);
      }
    } catch (e: any) {
      showToast(e.message || "Could not update status", "error");
    }
  };

  const filteredSubs = subscriptions.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.customerName.toLowerCase().includes(q) ||
      s.customerCode.toLowerCase().includes(q) ||
      s.planName.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q);

    const matchesStatus = filterStatus === "ALL" || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Subscription Lifecycle & Billing Desk
            </h1>
            <span className="rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono px-3 py-1 border border-cyan-500/20">
              RETENTION & BILLING ENGINE
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Complete CRUD for client advisory plans, renewal countdown cadences, and SEBI compliance billing tiers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Plus className="size-4" />
            <span>+ Create Client Plan</span>
          </button>

          <div className="flex items-center gap-1 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
            <button
              type="button"
              onClick={() => setActiveTab("subscriptions")}
              className={cx(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "subscriptions" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Active Subscriptions ({subscriptions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("renewals")}
              className={cx(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "renewals" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Renewal Pipeline
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("packages")}
              className={cx(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "packages" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Advisory Catalog
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: ACTIVE SUBSCRIPTIONS CRUD TABLE */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B121E] border border-[#1E293B] p-4 rounded-2xl">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 size-4 text-ink-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subscriptions by client name, code, plan..."
                className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] pl-10 pr-4 py-2 text-xs text-white placeholder-ink-400 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3 py-2 text-xs text-ink-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses ({subscriptions.length})</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0E1624] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
                  <tr>
                    <th className="px-5 py-3.5">Subscription & Client</th>
                    <th className="px-4 py-3.5">Advisory Plan Tier</th>
                    <th className="px-4 py-3.5">Recurring Fee</th>
                    <th className="px-4 py-3.5">Validity & Expiry</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Assigned RM</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60 text-ink-200">
                  {filteredSubs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-ink-400">
                        No subscriptions found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredSubs.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[#0E1624]/60 transition-colors">
                        {/* Subscription & Client */}
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-sm">{sub.customerName}</div>
                          <div className="font-mono text-[11px] text-cyan-400">{sub.id}</div>
                          <div className="font-mono text-[10px] text-ink-400">{sub.customerCode}</div>
                        </td>

                        {/* Plan Tier */}
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">{sub.planName}</div>
                          <span className="text-[11px] text-ink-400">{sub.tier || sub.duration}</span>
                        </td>

                        {/* Fee */}
                        <td className="px-4 py-4 font-mono">
                          <div className="text-emerald-400 font-bold text-sm">
                            ₹{sub.amount.toLocaleString("en-IN")}
                          </div>
                          <span className="text-[10px] text-ink-400">{sub.paymentMethod}</span>
                        </td>

                        {/* Expiry */}
                        <td className="px-4 py-4 font-mono text-[11px]">
                          <div className="text-white">Expires: {sub.expiryDate}</div>
                          <span
                            className={cx(
                              "font-bold text-[10px] px-2 py-0.5 rounded border inline-block mt-1",
                              sub.daysRemaining <= 7
                                ? "bg-red-500/15 border-red-500/30 text-red-300"
                                : sub.daysRemaining <= 30
                                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                            )}
                          >
                            {sub.daysRemaining} Days Left
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span
                            className={cx(
                              "font-mono font-bold text-[11px] px-2.5 py-1 rounded-full border inline-block",
                              sub.status === "ACTIVE" && "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
                              sub.status === "PAUSED" && "bg-amber-500/15 border-amber-500/30 text-amber-400",
                              sub.status === "EXPIRED" && "bg-ink-700 border-ink-600 text-ink-300",
                              sub.status === "CANCELLED" && "bg-rose-500/15 border-rose-500/30 text-rose-400"
                            )}
                          >
                            ● {sub.status}
                          </span>
                        </td>

                        {/* Assigned RM */}
                        <td className="px-4 py-4 text-white font-medium">
                          {sub.relationshipManager}
                        </td>

                        {/* Action buttons */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingSub({ ...sub })}
                              className="rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 p-2 hover:bg-cyan-600/30 transition-colors cursor-pointer"
                              title="Edit / Upgrade Plan"
                            >
                              <Edit2 className="size-3.5" />
                            </button>

                            {sub.status === "ACTIVE" ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(sub, "PAUSED")}
                                className="rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-300 p-2 hover:bg-amber-600/30 transition-colors cursor-pointer"
                                title="Pause Plan"
                              >
                                <PauseCircle className="size-3.5" />
                              </button>
                            ) : sub.status === "PAUSED" ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(sub, "ACTIVE")}
                                className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 p-2 hover:bg-emerald-600/30 transition-colors cursor-pointer"
                                title="Resume Plan"
                              >
                                <PlayCircle className="size-3.5" />
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(sub, "CANCELLED")}
                              className="rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-300 p-2 hover:bg-rose-600/30 transition-colors cursor-pointer"
                              title="Cancel Plan"
                            >
                              <XCircle className="size-3.5" />
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

      {/* TAB 2: RENEWAL PIPELINE */}
      {activeTab === "renewals" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
              <span className="text-[10px] font-mono uppercase text-ink-400">Renewals Due &lt;7 Days</span>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">4 Clients</div>
              <p className="text-[11px] text-ink-400 mt-0.5">Est. ₹1,15,000 value</p>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
              <span className="text-[10px] font-mono uppercase text-ink-400">Renewals Due &lt;30 Days</span>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">12 Clients</div>
              <p className="text-[11px] text-ink-400 mt-0.5">Est. ₹3,85,000 value</p>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
              <span className="text-[10px] font-mono uppercase text-ink-400">Renewal Retention Rate</span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">87.4%</div>
              <p className="text-[11px] text-emerald-300 mt-0.5">Above statutory target</p>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
              <span className="text-[10px] font-mono uppercase text-ink-400">Churned Subscriptions</span>
              <div className="text-2xl font-bold font-mono text-ink-400 mt-1">2 Clients</div>
              <p className="text-[11px] text-ink-500 mt-0.5">Exit surveys logged</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                Upcoming Subscriptions Expirations Queue
              </h2>
              <span className="text-[11px] font-mono text-ink-400">Automated Alert Triggers Active</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
                  <tr>
                    <th className="px-5 py-3.5">Client & Code</th>
                    <th className="px-4 py-3.5">Current Plan</th>
                    <th className="px-4 py-3.5">Expiry Date</th>
                    <th className="px-4 py-3.5">Days Left</th>
                    <th className="px-4 py-3.5">Alert Cadence</th>
                    <th className="px-4 py-3.5">Assigned RM</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60 text-ink-200">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-[#0E1624]/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-white text-sm">{c.name}</div>
                        <div className="font-mono text-[11px] text-emerald-400">{c.customerCode}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{c.currentSubscription.planName}</div>
                        <span className="font-mono text-emerald-400">
                          ₹{c.currentSubscription.amount.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-ink-300">
                        {c.currentSubscription.expiryDate}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cx(
                            "font-mono font-bold text-xs px-2 py-0.5 rounded border",
                            c.currentSubscription.daysRemaining <= 7
                              ? "bg-red-500/15 border-red-500/30 text-red-300"
                              : c.currentSubscription.daysRemaining <= 30
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                              : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                          )}
                        >
                          {c.currentSubscription.daysRemaining} Days
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px]">
                        <span className="text-emerald-400">● 30d Notice Dispatched</span>
                        <div className="text-ink-400 text-[10px]">7d Notice Queued</div>
                      </td>
                      <td className="px-4 py-4 text-white font-medium">{c.relationshipManager}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => onInitiateRenewalCall && onInitiateRenewalCall(c)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 px-3 py-1.5 text-xs font-bold hover:bg-cyan-600/30 transition-colors cursor-pointer"
                        >
                          <PhoneCall className="size-3" />
                          <span>Renewal Call</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADVISORY CATALOG */}
      {activeTab === "packages" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.name}
              className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3 hover:border-brand-500/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-brand-400 font-bold">
                  SEBI Approved Tier
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNewSubForm({
                      ...newSubForm,
                      planName: pkg.name,
                      amount: pkg.amount,
                      duration: pkg.duration,
                    });
                    setShowCreateModal(true);
                  }}
                  className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 text-[11px] font-bold hover:bg-emerald-600/30 cursor-pointer"
                >
                  Enroll Client
                </button>
              </div>
              <h3 className="font-bold text-base text-white">{pkg.name}</h3>
              <div className="text-2xl font-bold font-mono text-emerald-400">{pkg.price}</div>
              <p className="text-xs text-ink-300">{pkg.target}</p>
              <div className="border-t border-[#1E293B] pt-3 text-[11px] font-mono text-ink-400 flex justify-between">
                <span>Duration: {pkg.duration}</span>
                <span className="text-brand-300">GST SAC 997159</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE SUBSCRIPTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl p-6 text-white space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <ReceiptIndianRupee className="size-5 text-emerald-400" />
                <h3 className="font-bold text-lg font-display">Create Client Advisory Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="space-y-4 text-xs">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">
                  Select Enrolled Client <span className="text-red-400">*</span>
                </label>
                <select
                  value={newSubForm.customerId}
                  onChange={(e) => {
                    const cust = customers.find((c) => c.id === e.target.value);
                    setNewSubForm({
                      ...newSubForm,
                      customerId: e.target.value,
                      customerName: cust?.name || "",
                      customerCode: cust?.customerCode || "",
                    });
                  }}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customerCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Advisory Plan</label>
                  <select
                    value={newSubForm.planName}
                    onChange={(e) => {
                      const found = PACKAGES.find((p) => p.name === e.target.value);
                      setNewSubForm({
                        ...newSubForm,
                        planName: e.target.value,
                        amount: found ? found.amount : newSubForm.amount,
                        duration: found ? found.duration : newSubForm.duration,
                      });
                    }}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {PACKAGES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Advisory Fee (₹)</label>
                  <input
                    type="number"
                    required
                    value={newSubForm.amount}
                    onChange={(e) => setNewSubForm({ ...newSubForm, amount: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Duration</label>
                  <select
                    value={newSubForm.duration}
                    onChange={(e) => setNewSubForm({ ...newSubForm, duration: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="3 Months">3 Months (Quarterly)</option>
                    <option value="6 Months">6 Months (Half-Yearly)</option>
                    <option value="12 Months">12 Months (Annual)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={newSubForm.expiryDate}
                    onChange={(e) => setNewSubForm({ ...newSubForm, expiryDate: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Payment Method</label>
                  <select
                    value={newSubForm.paymentMethod}
                    onChange={(e) => setNewSubForm({ ...newSubForm, paymentMethod: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Razorpay / UPI">Razorpay / UPI</option>
                    <option value="Direct NEFT / RTGS">Direct NEFT / RTGS</option>
                    <option value="Cashfree Payment Gateway">Cashfree Payment Gateway</option>
                    <option value="HDFC Bank Transfer">HDFC Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Assigned RM</label>
                  <input
                    type="text"
                    value={newSubForm.relationshipManager}
                    onChange={(e) => setNewSubForm({ ...newSubForm, relationshipManager: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Advisory Mandate Notes</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions, capital allocation limits, risk parameters..."
                  value={newSubForm.notes}
                  onChange={(e) => setNewSubForm({ ...newSubForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 font-bold shadow-md transition-colors cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  <span>Confirm Plan Activation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ACTIVE PLAN MODAL */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl p-6 text-white space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="size-5 text-cyan-400" />
                <h3 className="font-bold text-lg font-display">
                  Edit Plan: {editingSub.customerName} ({editingSub.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSub(null)}
                className="text-ink-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubscription} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Advisory Tier / Package</label>
                  <select
                    value={editingSub.planName}
                    onChange={(e) => {
                      const found = PACKAGES.find((p) => p.name === e.target.value);
                      setEditingSub({
                        ...editingSub,
                        planName: e.target.value,
                        amount: found ? found.amount : editingSub.amount,
                      });
                    }}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {PACKAGES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Recurring Fee (₹)</label>
                  <input
                    type="number"
                    value={editingSub.amount}
                    onChange={(e) => setEditingSub({ ...editingSub, amount: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={editingSub.expiryDate}
                    onChange={(e) => setEditingSub({ ...editingSub, expiryDate: e.target.value })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Lifecycle Status</label>
                  <select
                    value={editingSub.status}
                    onChange={(e) => setEditingSub({ ...editingSub, status: e.target.value as any })}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Relationship Manager</label>
                <input
                  type="text"
                  value={editingSub.relationshipManager}
                  onChange={(e) => setEditingSub({ ...editingSub, relationshipManager: e.target.value })}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Adjustment Notes</label>
                <textarea
                  rows={2}
                  value={editingSub.notes || ""}
                  onChange={(e) => setEditingSub({ ...editingSub, notes: e.target.value })}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setEditingSub(null)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 font-bold shadow-md transition-colors cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  <span>Save Plan Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
