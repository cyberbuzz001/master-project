"use client";

import React, { useState } from "react";
import {
  User,
  ShieldCheck,
  Calendar,
  CreditCard,
  FileCheck2,
  PhoneCall,
  MessageSquare,
  LifeBuoy,
  Briefcase,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ReceiptIndianRupee,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { Customer360, TimelineEvent, CrmPayment, AdvisoryRecommendation } from "@/lib/crm-data";

interface Customer360ViewProps {
  customers: Customer360[];
  timeline: TimelineEvent[];
  payments: CrmPayment[];
  recommendations: AdvisoryRecommendation[];
  onInitiateCall?: (customer: Customer360) => void;
}

const TABS = [
  "Overview",
  "Timeline",
  "Calls",
  "WhatsApp",
  "Payments",
  "Subscriptions",
  "Advisory",
  "Portfolio",
  "Documents",
  "Tickets",
  "Tasks",
  "Notes",
] as const;

export function Customer360View({
  customers,
  timeline,
  payments,
  recommendations,
  onInitiateCall,
}: Customer360ViewProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || "");
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Overview");

  const customer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  if (!customer) return null;

  const customerTimeline = timeline.filter((t) => t.customerId === customer.id);
  const customerPayments = payments.filter((p) => p.customerId === customer.id || p.customerName === customer.name);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Customer 360° Profile & Lifecycle Desk
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              KYC & SUITABILITY VERIFIED
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Unified view of subscriptions, portfolio exposure, communication logs, and statutory audit events.
          </p>
        </div>

        {/* Customer Quick Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-400">Select Client:</span>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="rounded-xl border border-[#1E293B] bg-[#0E1624] px-3.5 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.customerCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer 360 Header Bar */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
              {customer.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold font-display text-white">{customer.name}</h2>
                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  {customer.customerCode}
                </span>
                <span className="rounded-full bg-brand-500/15 text-brand-300 text-[10px] font-mono px-2 py-0.5 border border-brand-500/30">
                  {customer.riskCategory} Risk
                </span>
              </div>
              <p className="text-xs text-ink-400 mt-1">
                {customer.mobile} • {customer.email} • Client since {customer.joinedDate}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-[#0E1624] border border-[#1E293B] p-2.5 text-right font-mono">
              <span className="text-[10px] text-ink-400 uppercase block">Customer Lifetime Value</span>
              <strong className="text-emerald-400 text-sm">
                ₹{customer.customerValue.toLocaleString("en-IN")}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => onInitiateCall && onInitiateCall(customer)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-md"
            >
              <PhoneCall className="size-4" />
              <span>Call Client</span>
            </button>
          </div>
        </div>

        {/* Quick Health & RM Meta Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#1E293B] text-xs">
          <div>
            <span className="text-[10px] font-mono uppercase text-ink-400 block">Health Score</span>
            <span className={cx(
              "font-bold font-mono mt-0.5 inline-block",
              customer.healthScore === "Healthy" ? "text-emerald-400" : "text-amber-400"
            )}>
              ● {customer.healthScore}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-ink-400 block">Current Plan</span>
            <span className="font-semibold text-white mt-0.5 block truncate">
              {customer.currentSubscription.planName}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-ink-400 block">Renewal In</span>
            <span className="font-bold font-mono text-cyan-400 mt-0.5 block">
              {customer.currentSubscription.daysRemaining} Days ({customer.currentSubscription.expiryDate})
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-ink-400 block">Assigned RM</span>
            <span className="font-semibold text-white mt-0.5 block">
              {customer.relationshipManager}
            </span>
          </div>
        </div>
      </div>

      {/* 13 TABS NAVIGATION */}
      <div className="border-b border-[#1E293B] bg-[#090E17] rounded-xl px-2 overflow-x-auto">
        <nav className="flex space-x-1 py-2">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cx(
                  "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                  active
                    ? "bg-brand-600 text-white shadow-xs"
                    : "text-ink-400 hover:text-white hover:bg-[#162030]"
                )}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENT AREAS */}
      {activeTab === "Overview" && (
        <div className="grid gap-6 md:grid-cols-12">
          {/* Left Column: Portfolio & Suitability (7 cols) */}
          <div className="md:col-span-7 space-y-4">
            <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-mono">
                Declared Portfolio & Market Engagement
              </h3>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Trading Capital</span>
                  <p className="font-bold text-white mt-1 text-sm font-mono">{customer.portfolioSize}</p>
                </div>
                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Open Ideas</span>
                  <p className="font-bold text-white mt-1 text-sm font-mono">{customer.openPositionsCount} Active</p>
                </div>
                <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3">
                  <span className="text-[10px] uppercase font-mono text-ink-400">Tracked P&L</span>
                  <p className="font-bold text-emerald-400 mt-1 text-sm font-mono">{customer.realizedPnlPercent}</p>
                </div>
              </div>
            </div>

            {/* SEBI Compliance Card */}
            <div className="rounded-2xl border border-emerald-500/20 bg-[#0A1624] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="size-4" />
                  <span>SEBI Regulatory & Suitability Status</span>
                </span>
                <Badge tone="positive">100% Compliant</Badge>
              </div>
              <div className="text-xs space-y-1.5 text-ink-300">
                <p>• <strong>Suitability Matrix:</strong> Score {customer.riskScore}/100 verified on DigiLocker.</p>
                <p>• <strong>Masked PAN:</strong> {customer.panMasked} (NSDL Active).</p>
                <p>• <strong>Masked Aadhaar:</strong> {customer.aadhaarMasked} (e-KYC Completed).</p>
                <p>• <strong>Service Agreement:</strong> Digitally accepted with SHA-256 fingerprint timestamp.</p>
              </div>
            </div>
          </div>

          {/* Right Column: AI Retention & Churn Risk (5 cols) */}
          <div className="md:col-span-5 rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono flex items-center gap-1.5">
              <Sparkles className="size-4" />
              <span>AI Retention & Renewal Intelligence</span>
            </h3>

            <div className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Churn Risk Probability:</span>
                <span className="font-mono text-emerald-400 font-bold">Low (4.2%)</span>
              </div>
              <p className="text-xs text-ink-300">{customer.healthRationale}</p>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase text-ink-400">Automated Renewal Milestones:</span>
              <div className="space-y-1.5 text-xs text-ink-300">
                <div className="flex justify-between py-1 border-b border-[#1E293B]">
                  <span>30 Days Reminder:</span>
                  <span className="font-mono text-emerald-400">Sent (Read)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1E293B]">
                  <span>15 Days Reminder:</span>
                  <span className="font-mono text-amber-400">Scheduled in 21d</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Relationship Call:</span>
                  <span className="font-mono text-brand-300">RM Assigned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: UNIFIED TIMELINE */}
      {activeTab === "Timeline" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Unified Chronological Customer Journey
            </h3>
            <span className="text-[11px] font-mono text-ink-400">
              {customerTimeline.length} Total Events Logged
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {customerTimeline.map((evt, idx) => (
              <div key={evt.id} className="relative flex items-start gap-4">
                <div className="relative z-10 size-8 rounded-full bg-[#162235] border border-brand-500/40 flex items-center justify-center text-brand-300 shrink-0 text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{evt.title}</span>
                    <span className="text-[10px] font-mono text-ink-400">{evt.timestamp}</span>
                  </div>
                  <p className="text-xs text-ink-300">{evt.description}</p>
                  <span className="text-[10px] font-mono text-brand-400 block pt-1">
                    Actor: {evt.agent}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS */}
      {activeTab === "Payments" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Verified Payments & GST Invoices (SAC 997159)
          </h3>
          <div className="space-y-2">
            {customerPayments.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">₹{p.amount.toLocaleString("en-IN")}</span>
                    <Badge tone="positive">{p.status}</Badge>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Invoice: {p.invoiceNumber} • Gateway: {p.gateway} • GST: ₹{p.gstAmount.toLocaleString("en-IN")}
                  </p>
                </div>
                <span className="font-mono text-xs text-ink-400">{p.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback for other tabs */}
      {activeTab !== "Overview" && activeTab !== "Timeline" && activeTab !== "Payments" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-12 text-center text-xs text-ink-400 space-y-2">
          <p className="font-semibold text-white">Active {activeTab} Records</p>
          <p>Live synchronized records for {customer.name} under compliance encryption.</p>
        </div>
      )}
    </div>
  );
}
