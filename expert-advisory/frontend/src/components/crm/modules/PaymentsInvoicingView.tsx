"use client";

import React, { useState } from "react";
import {
  CreditCard,
  ReceiptIndianRupee,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  Download,
  Printer,
  Search,
  Plus,
  X,
  AlertCircle,
  Building2,
  UserCheck,
  MessageSquare,
  Send,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Calendar,
  Lock,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import {
  type CrmPayment,
  type CrmInstallment,
  INITIAL_INSTALLMENTS,
} from "@/lib/crm-data";

interface PaymentsInvoicingViewProps {
  payments: CrmPayment[];
  onVerifyPayment?: (paymentId: string) => void;
  onRecordPayment?: (newPayment: CrmPayment) => void;
}

export function PaymentsInvoicingView({
  payments,
  onVerifyPayment,
  onRecordPayment,
}: PaymentsInvoicingViewProps) {
  const [activeTab, setActiveTab] = useState<"payments" | "installments">("payments");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewInvoicePayment, setViewInvoicePayment] = useState<CrmPayment | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Installments State
  const [installments, setInstallments] = useState<CrmInstallment[]>(INITIAL_INSTALLMENTS);
  const [selectedInstallmentForUtr, setSelectedInstallmentForUtr] = useState<CrmInstallment | null>(null);
  const [utrInput, setUtrInput] = useState("");
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  // New Payment Form State
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [service, setService] = useState("Index Options Alpha Desk");
  const [amount, setAmount] = useState("29500");
  const [gateway, setGateway] = useState<CrmPayment["gateway"]>("Direct NEFT");
  const [transactionRef, setTransactionRef] = useState("");
  const [agent, setAgent] = useState("Vikram Malhotra");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const totalCollections = payments
    .filter((p) => p.status === "SUCCESSFUL")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalGst = payments
    .filter((p) => p.status === "SUCCESSFUL")
    .reduce((sum, p) => sum + p.gstAmount, 0);

  const totalInstallmentReceivables = installments.reduce((sum, i) => sum + i.amount, 0);
  const pendingInstallments = installments.filter((i) => i.status === "PENDING" || i.status === "OVERDUE");
  const pendingVerificationInstallments = installments.filter((i) => i.status === "PENDING_VERIFICATION");

  const filteredPayments = payments.filter((p) => {
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.transactionRef.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredInstallments = installments.filter((i) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      i.customerName.toLowerCase().includes(q) ||
      i.customerId.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q) ||
      i.mobile.includes(q) ||
      (i.utrNumber && i.utrNumber.toLowerCase().includes(q))
    );
  });

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !amount) return;

    const numAmount = parseFloat(amount) || 0;
    const gstVal = Math.round((numAmount * 18) / 118);

    const newPayment: CrmPayment = {
      id: `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName,
      customerId: customerId || `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: numAmount,
      gstAmount: gstVal,
      service,
      gateway,
      status: gateway === "Direct NEFT" ? "PENDING" : "SUCCESSFUL",
      invoiceNumber: `ESC-INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      transactionRef: transactionRef || `UTR-${Date.now().toString().slice(-8)}`,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      agent,
      complianceApproved: gateway !== "Direct NEFT",
    };

    if (onRecordPayment) {
      onRecordPayment(newPayment);
    }
    showToast(`Payment ${newPayment.id} recorded successfully.`);
    setShowAddModal(false);
    setCustomerName("");
    setCustomerId("");
    setTransactionRef("");
  };

  // RM Action: Submit Bank UTR for verification
  const handleSubmitUtr = () => {
    if (!selectedInstallmentForUtr || !utrInput.trim()) return;

    setInstallments((prev) =>
      prev.map((inst) =>
        inst.id === selectedInstallmentForUtr.id
          ? {
              ...inst,
              status: "PENDING_VERIFICATION",
              utrNumber: utrInput.trim(),
              submittedBy: "Sales RM / Telecaller",
            }
          : inst
      )
    );

    showToast(
      `UTR #${utrInput.trim()} submitted for ${selectedInstallmentForUtr.customerName}. Queued for Finance Manager approval.`
    );
    setSelectedInstallmentForUtr(null);
    setUtrInput("");
  };

  // Finance Manager Action: Verify credit in bank statement & approve
  const handleFinanceApprove = (inst: CrmInstallment) => {
    setInstallments((prev) =>
      prev.map((i) =>
        i.id === inst.id
          ? {
              ...i,
              status: "APPROVED",
              verifiedBy: "Finance Manager (Bank Ledger Confirmed)",
              verifiedAt: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            }
          : i
      )
    );

    // Auto-create payment entry
    if (onRecordPayment) {
      const gstVal = Math.round((inst.amount * 18) / 118);
      onRecordPayment({
        id: `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: inst.customerName,
        customerId: inst.customerId,
        amount: inst.amount,
        gstAmount: gstVal,
        service: "Advisory Installment Milestone",
        gateway: "Direct NEFT",
        status: "SUCCESSFUL",
        invoiceNumber: `ESC-INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        transactionRef: inst.utrNumber || `VERIFIED-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        agent: inst.submittedBy || "Finance Desk",
        complianceApproved: true,
      });
    }

    showToast(`Installment ${inst.id} verified & credited! GST tax invoice auto-generated.`);
  };

  // WhatsApp Nudge: Send reminder via Meta Cloud API
  const handleWhatsAppNudge = async (inst: CrmInstallment) => {
    setNudgingId(inst.id);
    try {
      const res = await fetch("/api/v1/office/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: inst.customerId,
          phone: inst.mobile,
          text: `Hello ${inst.customerName}, gentle reminder from Expert Stocks Consultancy regarding your advisory installment #${inst.installmentNumber} of ₹${inst.amount.toLocaleString("en-IN")} due on ${inst.dueDate}. Kindly share the bank UTR or NEFT reference once transferred. Official helpline: +91 92018 00995.`,
          clientName: inst.customerName,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setInstallments((prev) =>
          prev.map((i) =>
            i.id === inst.id
              ? {
                  ...i,
                  nudgeCount: (i.nudgeCount || 0) + 1,
                  lastNudgeAt: "Today, Just now",
                }
              : i
          )
        );
        showToast(`Automated WhatsApp payment reminder dispatched to ${inst.customerName} via Meta API.`);
      } else {
        showToast(json.message || "Failed to send WhatsApp reminder", "error");
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, "error");
    } finally {
      setNudgingId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={cx(
            "fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md animate-fade-in",
            toast.type === "success"
              ? "border-emerald-500/40 bg-[#0B1A14]/95 text-emerald-300"
              : "border-rose-500/40 bg-[#1A0B0E]/95 text-rose-300"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="size-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Payments, Invoicing & Financial Controls
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              SAC CODE 997159
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Separation of duties: Sales RMs submit UTRs, Finance Managers verify bank credit, automated GST invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 text-xs font-bold shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Record Bank Wire / Payment</span>
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex border-b border-[#1E293B] text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={cx(
            "flex items-center gap-2 border-b-2 py-3 px-5 font-bold uppercase tracking-wider transition-colors cursor-pointer",
            activeTab === "payments"
              ? "border-emerald-500 text-emerald-400 bg-[#0E1624]"
              : "border-transparent text-ink-400 hover:text-white"
          )}
        >
          <ReceiptIndianRupee className="size-4" />
          <span>Verified Invoices & Payments ({payments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("installments")}
          className={cx(
            "flex items-center gap-2 border-b-2 py-3 px-5 font-bold uppercase tracking-wider transition-colors cursor-pointer",
            activeTab === "installments"
              ? "border-brand-500 text-brand-400 bg-[#0E1624]"
              : "border-transparent text-ink-400 hover:text-white"
          )}
        >
          <Clock className="size-4" />
          <span>Installments & Milestone Recovery ({installments.length})</span>
          {pendingVerificationInstallments.length > 0 && (
            <span className="rounded-full bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 border border-amber-500/30">
              {pendingVerificationInstallments.length} Verify
            </span>
          )}
        </button>
      </div>

      {/* Financial Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Total Verified Collections</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            ₹{totalCollections.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-ink-400 mt-0.5">Audited bank receipts</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Total 18% GST Collected</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            ₹{totalGst.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-ink-400 mt-0.5">CGST 9% + SGST 9%</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Pending FM Verifications</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {pendingVerificationInstallments.length} Transactions
          </div>
          <p className="text-[11px] text-amber-300 mt-0.5">Two-person separation of duties</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Active Installment Book</span>
          <div className="text-2xl font-bold font-mono text-brand-400 mt-1">
            ₹{totalInstallmentReceivables.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-ink-400 mt-0.5">{pendingInstallments.length} installments pending</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B121E] p-3 rounded-xl border border-[#1E293B]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-400" />
          <input
            type="text"
            placeholder={
              activeTab === "payments"
                ? "Search by client name, payment ID, invoice #, UTR..."
                : "Search installments by client name, ID, phone, UTR..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0E1624] border border-[#1E293B] rounded-lg text-xs text-white placeholder-ink-400 focus:outline-none focus:border-brand-500"
          />
        </div>

        {activeTab === "payments" && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {["ALL", "SUCCESSFUL", "PENDING", "FAILED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cx(
                  "px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer",
                  statusFilter === st
                    ? "bg-brand-600 text-white font-bold"
                    : "bg-[#0E1624] text-ink-400 hover:text-white"
                )}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: PAYMENTS & INVOICES TABLE */}
      {activeTab === "payments" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#0B121E] overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0E1624] text-ink-400 font-mono uppercase text-[10px]">
                <th className="py-3.5 px-4 font-semibold">Payment / Invoice #</th>
                <th className="py-3.5 px-4 font-semibold">Client Name</th>
                <th className="py-3.5 px-4 font-semibold">Advisory Service</th>
                <th className="py-3.5 px-4 font-semibold">Gateway / Mode</th>
                <th className="py-3.5 px-4 font-semibold text-right">Fee (Incl. GST)</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold">Assigned Agent</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-ink-300">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-[#111A29] transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-white">
                    <div>{p.id}</div>
                    <div className="text-[10px] text-ink-400 font-normal">{p.invoiceNumber}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">{p.customerName}</div>
                    <div className="text-[10px] font-mono text-ink-400">{p.customerId}</div>
                  </td>
                  <td className="py-3.5 px-4 text-ink-300">{p.service}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    <span className="text-white">{p.gateway}</span>
                    <div className="text-[10px] text-ink-400 truncate max-w-[120px]">{p.transactionRef}</div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                    ₹{p.amount.toLocaleString("en-IN")}
                    <div className="text-[10px] text-cyan-400 font-normal">GST: ₹{p.gstAmount}</div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold border",
                        p.status === "SUCCESSFUL"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : p.status === "PENDING"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-ink-300">{p.agent}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewInvoicePayment(p)}
                        className="rounded-lg bg-[#162235] hover:bg-[#1E2D44] text-ink-300 hover:text-white px-2.5 py-1 text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <FileText className="size-3" />
                        <span>Invoice</span>
                      </button>
                      {p.status === "PENDING" && onVerifyPayment && (
                        <button
                          type="button"
                          onClick={() => onVerifyPayment(p.id)}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: INSTALLMENTS & MILESTONE RECOVERY DESK */}
      {activeTab === "installments" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#1E293B] bg-[#0B121E] overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#0E1624] text-ink-400 font-mono uppercase text-[10px]">
                  <th className="py-3.5 px-4 font-semibold">Installment ID</th>
                  <th className="py-3.5 px-4 font-semibold">Client Name & Contact</th>
                  <th className="py-3.5 px-4 font-semibold">Milestone #</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Amount (₹)</th>
                  <th className="py-3.5 px-4 font-semibold">Due Date</th>
                  <th className="py-3.5 px-4 font-semibold">UTR / Verification</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-ink-300">
                {filteredInstallments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-[#111A29] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      <div>{inst.id}</div>
                      {inst.proposalId && (
                        <div className="text-[10px] text-ink-400 font-normal">{inst.proposalId}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{inst.customerName}</div>
                      <div className="text-[11px] font-mono text-ink-400">{inst.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-white">
                      Installment {inst.installmentNumber} of {inst.totalInstallments}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-sm">
                      ₹{inst.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <span className={cx(inst.status === "OVERDUE" && "text-rose-400 font-bold")}>
                        {inst.dueDate}
                      </span>
                      {inst.lastNudgeAt && (
                        <div className="text-[10px] text-emerald-400">Nudged {inst.nudgeCount}x</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {inst.utrNumber ? (
                        <div>
                          <span className="text-white font-bold">{inst.utrNumber}</span>
                          <div className="text-[10px] text-ink-400">{inst.submittedBy}</div>
                        </div>
                      ) : (
                        <span className="text-ink-500 italic">No UTR logged</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={cx(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold border",
                          inst.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : inst.status === "PENDING_VERIFICATION"
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse"
                            : inst.status === "OVERDUE"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        )}
                      >
                        {inst.status === "PENDING_VERIFICATION" ? "VERIFICATION PENDING" : inst.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1. Nudge Button via Meta WhatsApp */}
                        {inst.status !== "APPROVED" && (
                          <button
                            type="button"
                            disabled={nudgingId === inst.id}
                            onClick={() => handleWhatsAppNudge(inst)}
                            className="rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] px-2.5 py-1 text-xs font-mono hover:bg-[#22C55E]/25 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            title="Send Automated WhatsApp Payment Reminder"
                          >
                            {nudgingId === inst.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <MessageSquare className="size-3" />
                            )}
                            <span>Nudge</span>
                          </button>
                        )}

                        {/* 2. Sales RM Submit UTR Action */}
                        {inst.status === "PENDING" || inst.status === "OVERDUE" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInstallmentForUtr(inst);
                              setUtrInput("");
                            }}
                            className="rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-300 px-2.5 py-1 text-xs font-bold hover:bg-brand-600/30 transition-colors cursor-pointer"
                          >
                            Enter UTR
                          </button>
                        ) : null}

                        {/* 3. Finance Manager Verify Action */}
                        {inst.status === "PENDING_VERIFICATION" && (
                          <button
                            type="button"
                            onClick={() => handleFinanceApprove(inst)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer shadow-md"
                            title="Verify bank statement credit and generate official tax invoice"
                          >
                            Approve Credit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UTR ENTRY MODAL (Sales RM) */}
      {selectedInstallmentForUtr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">Log Client Payment Reference</h3>
                <p className="text-xs text-ink-400 font-mono mt-0.5">
                  {selectedInstallmentForUtr.customerName} • Due: ₹{selectedInstallmentForUtr.amount.toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstallmentForUtr(null)}
                className="text-ink-400 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">
                  Bank UTR / IMPS / UPI Reference Number:
                </label>
                <input
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. HDFC9821873918 or 429188219401"
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-white font-mono placeholder-ink-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> Separation of Duties Mandate:
                </span>
                <p>
                  Entering a UTR sets the status to <strong>PENDING_VERIFICATION</strong>. Only an authorized Finance Manager can audit the bank statement and issue the final GST invoice.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setSelectedInstallmentForUtr(null)}
                className="rounded-xl border border-[#1E293B] px-4 py-2 text-xs text-ink-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!utrInput.trim()}
                onClick={handleSubmitUtr}
                className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD BANK WIRE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#090E17] shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">Record Client Bank Wire / Payment</h3>
                <p className="text-xs text-ink-400">Generate an automated GST compliance invoice</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-ink-400 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">Customer Full Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Harish Raghavan"
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Customer / Lead ID</label>
                  <input
                    type="text"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="e.g. TG-LD-901"
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Total Fee Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Advisory Service</label>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Index Options Alpha Desk">Index Options Alpha Desk</option>
                    <option value="Cash Equity Intraday">Cash Equity Intraday</option>
                    <option value="HNI Bespoke Multi-Cap">HNI Bespoke Multi-Cap</option>
                    <option value="Commodity Futures Momentum">Commodity Futures Momentum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Payment Mode</label>
                  <select
                    value={gateway}
                    onChange={(e) => setGateway(e.target.value as any)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Direct NEFT">Direct Bank NEFT / RTGS</option>
                    <option value="Razorpay">Razorpay Gateway</option>
                    <option value="UPI">Direct UPI QR Transfer</option>
                    <option value="Cashfree">Cashfree Gateway</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Transaction Ref / Bank UTR</label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. HDFC9821873918"
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-xs text-ink-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 text-xs font-bold transition-colors cursor-pointer"
                >
                  Confirm & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TAX INVOICE MODAL */}
      {viewInvoicePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#1E293B] bg-white text-ink-950 shadow-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Invoice Printable Header */}
            <div className="flex items-start justify-between border-b pb-6 border-ink-200">
              <div>
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
                    ES
                  </div>
                  <h2 className="text-xl font-bold font-display text-ink-900">Expert Stocks Consultancy</h2>
                </div>
                <p className="text-xs text-ink-600 mt-1">
                  SEBI Registered Research Analyst • INH000000000<br />
                  GSTIN: 27AABCE1234F1Z5 • SAC Code: 997159
                </p>
              </div>

              <div className="text-right">
                <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 uppercase">
                  TAX INVOICE (ORIGINAL)
                </span>
                <p className="text-sm font-bold font-mono text-ink-900 mt-1">{viewInvoicePayment.invoiceNumber}</p>
                <p className="text-xs text-ink-500 font-mono">{viewInvoicePayment.date}</p>
              </div>
            </div>

            {/* Bill To Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl bg-ink-50 p-4 border border-ink-200">
                <span className="text-[10px] uppercase font-mono text-ink-500 font-bold block mb-1">
                  Billed To (Client):
                </span>
                <p className="font-bold text-ink-900 text-sm">{viewInvoicePayment.customerName}</p>
                <p className="text-ink-600 font-mono text-xs mt-0.5">Client Code: {viewInvoicePayment.customerId}</p>
              </div>

              <div className="rounded-xl bg-ink-50 p-4 border border-ink-200">
                <span className="text-[10px] uppercase font-mono text-ink-500 font-bold block mb-1">
                  Payment Reference:
                </span>
                <p className="text-ink-700 font-mono">
                  Gateway: <strong>{viewInvoicePayment.gateway}</strong>
                </p>
                <p className="text-ink-700 font-mono text-[11px] truncate">
                  UTR / Ref: <strong>{viewInvoicePayment.transactionRef}</strong>
                </p>
              </div>
            </div>

            {/* Invoice Line Items */}
            <div className="rounded-xl border border-ink-200 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-ink-100 font-mono uppercase text-[10px] text-ink-700 border-b border-ink-200">
                  <tr>
                    <th className="py-2.5 px-3">Service Description</th>
                    <th className="py-2.5 px-3">SAC</th>
                    <th className="py-2.5 px-3 text-right">Taxable Amount</th>
                    <th className="py-2.5 px-3 text-right">18% GST</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200">
                  <tr>
                    <td className="py-3 px-3 font-semibold text-ink-900">{viewInvoicePayment.service}</td>
                    <td className="py-3 px-3 font-mono">997159</td>
                    <td className="py-3 px-3 text-right font-mono">
                      ₹{(viewInvoicePayment.amount - viewInvoicePayment.gstAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-cyan-800">
                      ₹{viewInvoicePayment.gstAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-ink-900">
                      ₹{viewInvoicePayment.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer & Actions */}
            <div className="flex items-center justify-between border-t border-ink-200 pt-4">
              <div className="text-[11px] text-ink-500 font-mono">
                Digitally generated and verified under SEBI RA Compliance Framework.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-xl border border-ink-300 bg-white hover:bg-ink-50 px-4 py-2 text-xs font-bold text-ink-700 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="size-3.5" />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewInvoicePayment(null)}
                  className="rounded-xl bg-ink-900 hover:bg-ink-800 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
