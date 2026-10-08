"use client";

import React from "react";
import {
  CreditCard,
  ReceiptIndianRupee,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  Download,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import type { CrmPayment } from "@/lib/crm-data";

interface PaymentsInvoicingViewProps {
  payments: CrmPayment[];
  onVerifyPayment?: (paymentId: string) => void;
}

export function PaymentsInvoicingView({ payments, onVerifyPayment }: PaymentsInvoicingViewProps) {
  const totalCollections = payments
    .filter((p) => p.status === "SUCCESSFUL")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalGst = payments
    .filter((p) => p.status === "SUCCESSFUL")
    .reduce((sum, p) => sum + p.gstAmount, 0);

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

      {/* Payments Ledger Table */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Transaction Ledger & Invoices
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
              {payments.map((p) => (
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
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Approve Wire
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-white transition-colors"
                      >
                        <Download className="size-3.5" />
                        <span>PDF Invoice</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
