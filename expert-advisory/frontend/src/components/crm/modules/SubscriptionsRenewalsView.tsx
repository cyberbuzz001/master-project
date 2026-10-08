"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { Customer360 } from "@/lib/crm-data";

interface SubscriptionsRenewalsViewProps {
  customers: Customer360[];
  onInitiateRenewalCall?: (customer: Customer360) => void;
}

const PACKAGES = [
  { name: "Starter Equity Advisory", price: "₹8,000 / Qtr", duration: "3 Months", target: "Retail Equity Delivery" },
  { name: "Equity Swing & Momentum", price: "₹15,000 / Qtr", duration: "3 Months", target: "Positional Cash Traders" },
  { name: "Index Derivatives Alpha", price: "₹25,000 / Qtr", duration: "3 Months", target: "Nifty & Bank Nifty F&O" },
  { name: "Multi-Segment Pro (F&O + MCX)", price: "₹45,000 / 6 Mo", duration: "6 Months", target: "Active Derivatives" },
  { name: "HNI Bespoke Advisory", price: "₹75,000 / Year", duration: "12 Months", target: "HNIs (Portfolio > ₹25L)" },
  { name: "Institutional Desk", price: "₹1,50,000 / Year", duration: "12 Months", target: "Family Offices & Corporates" },
];

export function SubscriptionsRenewalsView({
  customers,
  onInitiateRenewalCall,
}: SubscriptionsRenewalsViewProps) {
  const [activeTab, setActiveTab] = useState<"renewals" | "packages">("renewals");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Subscription Lifecycle & Renewal Desk
            </h1>
            <span className="rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono px-3 py-1 border border-cyan-500/20">
              RETENTION ENGINE
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Proactive renewal cadences (30d, 15d, 7d, 3d, 1d), advisory package catalog, and churn risk mitigation.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setActiveTab("renewals")}
            className={cx(
              "px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "renewals" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            Renewal Pipeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("packages")}
            className={cx(
              "px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "packages" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            Advisory Packages
          </button>
        </div>
      </div>

      {activeTab === "renewals" ? (
        <div className="space-y-6">
          {/* Renewal Summary Cards */}
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
              <p className="text-[11px] text-emerald-300 mt-0.5">Above target (80%)</p>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
              <span className="text-[10px] font-mono uppercase text-ink-400">Churned Subscriptions</span>
              <div className="text-2xl font-bold font-mono text-ink-400 mt-1">2 Clients</div>
              <p className="text-[11px] text-ink-500 mt-0.5">Exit surveys recorded</p>
            </div>
          </div>

          {/* Active Renewal Queue Table */}
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
                        <span className={cx(
                          "font-mono font-bold text-xs px-2 py-0.5 rounded border",
                          c.currentSubscription.daysRemaining <= 7
                            ? "bg-red-500/15 border-red-500/30 text-red-300"
                            : c.currentSubscription.daysRemaining <= 30
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                            : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                        )}>
                          {c.currentSubscription.daysRemaining} Days
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px]">
                        <span className="text-emerald-400">● 30d Notice Dispatched</span>
                        <div className="text-ink-400 text-[10px]">7d Notice Queued</div>
                      </td>
                      <td className="px-4 py-4 text-white font-medium">
                        {c.relationshipManager}
                      </td>
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
      ) : (
        /* PACKAGES CATALOG */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.name}
              className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3 hover:border-brand-500/50 transition-colors"
            >
              <span className="text-[10px] font-mono uppercase text-brand-400 font-bold">
                SEBI Approved Package
              </span>
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
    </div>
  );
}
