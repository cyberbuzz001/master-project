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
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import type { CrmPayment } from "@/lib/crm-data";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewInvoicePayment, setViewInvoicePayment] = useState<CrmPayment | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Payment Form State
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [service, setService] = useState("Index Options Alpha Desk");
  const [amount, setAmount] = useState("29500");
  const [gateway, setGateway] = useState<CrmPayment["gateway"]>("Direct NEFT");
  const [transactionRef, setTransactionRef] = useState("");
  const [agent, setAgent] = useState("Vikram Malhotra");

  const totalCollections = payments
    .filter((p) => p.status === "SUCCESSFUL")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalGst = payments
    .filter((p) => p.status === "SUCCESSFUL")
    .reduce((sum, p) => sum + p.gstAmount, 0);

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
    setShowAddModal(false);
    setCustomerName("");
    setCustomerId("");
    setTransactionRef("");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Payments, Invoicing & GST Compliance Desk
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              SAC CODE 997159
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Reconcile gateway callbacks (Razorpay / Cashfree), wire transfers, and automated GST tax invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 text-xs font-bold shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Record Bank Wire / Payment</span>
        </button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Total Verified Collections</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            ₹{totalCollections.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-ink-400 mt-0.5">Net advisory fees</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Total 18% GST Collected</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            ₹{totalGst.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-ink-400 mt-0.5">CGST 9% + SGST 9%</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Pending Wire Verifications</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {payments.filter((p) => p.status === "PENDING").length} Transactions
          </div>
          <p className="text-[11px] text-amber-300 mt-0.5">Two-person auth required</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Refund Ratio</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">0.0%</div>
          <p className="text-[11px] text-ink-400 mt-0.5">Zero disputed claims</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B121E] p-3 rounded-xl border border-[#1E293B]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by client name, payment ID, invoice #, UTR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0E1624] border border-[#1E293B] rounded-lg text-xs text-white placeholder-ink-400 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["ALL", "SUCCESSFUL", "PENDING", "FAILED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={cx(
                "px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase font-bold transition-colors cursor-pointer",
                statusFilter === st ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white bg-[#0E1624]"
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Ledger Table */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Transaction Ledger & Invoices ({filteredPayments.length})
          </h2>
          <span className="text-[11px] font-mono text-emerald-400">Razorpay / NetBanking Reconciled</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
              <tr>
                <th className="px-5 py-3.5">Payment ID & Date</th>
                <th className="px-4 py-3.5">Customer & Plan</th>
                <th className="px-4 py-3.5">Amount (incl. GST)</th>
                <th className="px-4 py-3.5">Invoice #</th>
                <th className="px-4 py-3.5">Gateway & Ref</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-ink-200">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-[#0E1624]/60 transition-colors">
                  <td className="px-5 py-4 font-mono">
                    <span className="text-brand-400 font-bold">{p.id}</span>
                    <div className="text-[10px] text-ink-400 mt-0.5">{p.date}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-white text-sm">{p.customerName}</div>
                    <div className="text-ink-400 text-[11px]">{p.service}</div>
                  </td>
                  <td className="px-4 py-4 font-mono">
                    <div className="font-bold text-white text-sm">₹{p.amount.toLocaleString("en-IN")}</div>
                    <span className="text-[10px] text-ink-400">GST: ₹{p.gstAmount.toLocaleString("en-IN")}</span>
                  </td>
                  <td className="px-4 py-4 font-mono text-brand-300">
                    {p.invoiceNumber}
                  </td>
                  <td className="px-4 py-4 font-mono text-ink-300 text-[11px]">
                    <div>{p.gateway}</div>
                    <span className="text-[10px] text-ink-500">{p.transactionRef}</span>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={p.status === "SUCCESSFUL" ? "positive" : p.status === "PENDING" ? "warning" : "neutral"}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {p.status === "PENDING" ? (
                      <button
                        type="button"
                        onClick={() => onVerifyPayment && onVerifyPayment(p.id)}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Approve Wire
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setViewInvoicePayment(p)}
                        className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-white transition-colors bg-[#0E1624] border border-[#1E293B] hover:border-brand-500/40 px-3 py-1.5 rounded-lg cursor-pointer font-medium"
                      >
                        <FileText className="size-3.5" />
                        <span>View / Print Invoice</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-ink-400">
                    No transactions matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TAX INVOICE MODAL */}
      {viewInvoicePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#1E293B] bg-[#0B121E] p-6 shadow-2xl space-y-6 text-white my-8">
            {/* Header / Actions */}
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div className="flex items-center gap-2">
                <ReceiptIndianRupee className="size-5 text-emerald-400" />
                <h3 className="font-bold text-lg font-display">Tax Invoice & Statutory Receipt</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewInvoicePayment(null)}
                  className="rounded-lg p-1.5 text-ink-400 hover:text-white bg-[#0E1624] border border-[#1E293B] cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Body */}
            <div className="space-y-6 bg-[#090E17] p-6 rounded-xl border border-[#1E293B] text-xs">
              {/* Company & Invoice Meta */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-[#1E293B] pb-4">
                <div>
                  <h4 className="font-bold text-sm text-brand-400">EXPERT STOCKS CONSULTANCY</h4>
                  <p className="text-ink-400 text-[11px] mt-0.5">SEBI Registered Research Analyst (INH00001842)</p>
                  <p className="text-ink-400 text-[11px]">GSTIN: 27AAACE2314M1Z5 | SAC Code: 997159</p>
                  <p className="text-ink-500 text-[10px] mt-1">BKC Financial District, Bandra East, Mumbai, Maharashtra 400051</p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-brand-300 font-bold text-sm">{viewInvoicePayment.invoiceNumber}</div>
                  <div className="text-ink-400 text-[11px]">Date: {viewInvoicePayment.date}</div>
                  <div className="text-emerald-400 font-bold text-[11px] mt-1">STATUS: {viewInvoicePayment.status}</div>
                </div>
              </div>

              {/* Billed To */}
              <div className="grid grid-cols-2 gap-4 border-b border-[#1E293B] pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-ink-400 block mb-1">Billed To (Client):</span>
                  <div className="font-bold text-white text-sm">{viewInvoicePayment.customerName}</div>
                  <div className="font-mono text-ink-400 text-[11px]">Client Code: {viewInvoicePayment.customerId}</div>
                  <div className="text-ink-400 text-[11px]">Relationship Manager: {viewInvoicePayment.agent}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-ink-400 block mb-1">Payment Reference:</span>
                  <div className="font-mono text-white text-xs">{viewInvoicePayment.transactionRef}</div>
                  <div className="text-ink-400 text-[11px]">Gateway: {viewInvoicePayment.gateway}</div>
                  <div className="text-emerald-400 text-[11px] mt-1">✓ Digital Payment Reconciled</div>
                </div>
              </div>

              {/* Service Line Item */}
              <div className="border-b border-[#1E293B] pb-4">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-mono uppercase text-ink-400 border-b border-[#1E293B]/40">
                    <tr>
                      <th className="py-2">Description of Advisory Service</th>
                      <th className="py-2 text-right">SAC Code</th>
                      <th className="py-2 text-right">Taxable Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]/20">
                    <tr>
                      <td className="py-3">
                        <div className="font-bold text-white">{viewInvoicePayment.service}</div>
                        <span className="text-[10px] text-ink-400">Quarterly Research Subscription with Risk-Reward Analysis</span>
                      </td>
                      <td className="py-3 text-right font-mono">997159</td>
                      <td className="py-3 text-right font-mono font-bold">
                        ₹{(viewInvoicePayment.amount - viewInvoicePayment.gstAmount).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax & Total Calculation */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-ink-400">
                    <span>Taxable Base:</span>
                    <span>₹{(viewInvoicePayment.amount - viewInvoicePayment.gstAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-ink-400">
                    <span>CGST (9.0%):</span>
                    <span>₹{Math.round(viewInvoicePayment.gstAmount / 2).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-ink-400">
                    <span>SGST (9.0%):</span>
                    <span>₹{Math.round(viewInvoicePayment.gstAmount / 2).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#1E293B] pt-2 text-sm font-bold text-emerald-400">
                    <span>Total Paid (INR):</span>
                    <span>₹{viewInvoicePayment.amount.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Regulatory Declaration */}
              <div className="rounded-lg bg-[#0E1624] p-3 text-[10px] text-ink-400 border border-[#1E293B]/60 space-y-1">
                <p className="font-semibold text-ink-300">Statutory Notice:</p>
                <p>
                  This is a computer-generated tax invoice issued in accordance with Section 31 of the CGST Act, 2017. Investment in securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD BANK WIRE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#0B121E] p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="size-5 text-brand-400" />
                <h3 className="font-bold text-lg font-display">Record Client Payment / Wire</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:text-white bg-[#0E1624] border border-[#1E293B] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Harish Chandra Rao"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Client Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ESC-2026-904"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Total Fee (₹ incl. 18% GST) *</label>
                  <input
                    type="number"
                    required
                    placeholder="29500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Advisory Plan</label>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Index Options Alpha Desk">Index Options Alpha Desk</option>
                    <option value="HNI Wealth Advisory">HNI Wealth Advisory</option>
                    <option value="Momentum Equity Cash">Momentum Equity Cash</option>
                    <option value="Commodity Bullion Advisory">Commodity Bullion Advisory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Payment Method</label>
                  <select
                    value={gateway}
                    onChange={(e) => setGateway(e.target.value as any)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Direct NEFT">Direct Bank Wire (NEFT/RTGS)</option>
                    <option value="Razorpay">Razorpay Gateway</option>
                    <option value="UPI">Direct UPI / QR</option>
                    <option value="Cashfree">Cashfree Auto-Debit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Transaction Ref / Bank UTR *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC0001928374 / CMS92810"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Assigned Relationship Manager</label>
                <select
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                >
                  <option value="Vikram Malhotra">Vikram Malhotra</option>
                  <option value="Ananya Iyer">Ananya Iyer</option>
                  <option value="Rohit Sharma">Rohit Sharma</option>
                  <option value="Pooja Hegde">Pooja Hegde</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 font-bold text-ink-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-2 font-bold text-white transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
                >
                  Confirm & Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
