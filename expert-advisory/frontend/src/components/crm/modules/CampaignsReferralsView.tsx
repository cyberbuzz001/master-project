"use client";

import React, { useState } from "react";
import {
  Megaphone,
  Share2,
  TrendingUp,
  BarChart3,
  Users,
  CreditCard,
  Plus,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import { CrmCampaign, CrmReferral, INITIAL_CAMPAIGNS, INITIAL_REFERRALS } from "@/lib/crm-data";

const LEAD_SOURCE_ANALYTICS = [
  { source: "Google Search Ads", leads: 58, qualified: 36, converted: 14, revenue: "₹18,50,000", cac: "₹6,550", roi: "4.86x" },
  { source: "Meta Ads (Instagram)", leads: 42, qualified: 24, converted: 8, revenue: "₹12,00,000", cac: "₹6,900", roi: "4.13x" },
  { source: "Organic Search / SEO", leads: 22, qualified: 14, converted: 6, revenue: "₹7,20,000", cac: "₹0", roi: "Infinite" },
  { source: "Partner / Creator Referrals", leads: 12, qualified: 8, converted: 5, revenue: "₹4,80,000", cac: "₹1,500", roi: "6.40x" },
  { source: "YouTube Masterclass Collab", leads: 8, qualified: 4, converted: 2, revenue: "₹1,80,000", cac: "₹4,200", roi: "2.14x" },
];

export function CampaignsReferralsView() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "sources" | "referrals">("campaigns");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Campaigns, CAC & Referral Revenue Desk
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20">
              MULTI-TOUCH ATTRIBUTION
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Track ad spend, customer acquisition costs (CAC), conversion ROI, and partner revenue sharing.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={cx(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "campaigns" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            Ad Campaigns
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={cx(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "sources" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            Source ROI Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("referrals")}
            className={cx(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "referrals" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            Client Referrals
          </button>
        </div>
      </div>

      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {INITIAL_CAMPAIGNS.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-3 shadow-xl hover:border-brand-500/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-brand-400 uppercase font-bold">{c.channel}</span>
                  <Badge tone="positive">{c.status}</Badge>
                </div>
                <h3 className="font-bold text-sm text-white">{c.name}</h3>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  ₹{(c.revenue / 100000).toFixed(2)}L <span className="text-xs text-ink-400 font-sans font-normal">Revenue</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1E293B] text-[11px] font-mono text-ink-300">
                  <div>
                    <span className="text-[10px] text-ink-500 block">CLICKS</span>
                    {c.clicked.toLocaleString()}
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-500 block">CONVERTS</span>
                    {c.converted} Deals
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-500 block">ROAS ROI</span>
                    <span className="text-emerald-400 font-bold">{c.roi}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "sources" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Lead Source → Conversion → Revenue → ROI Matrix
            </h2>
            <span className="text-[11px] font-mono text-emerald-400">Blended CAC: ₹4,120</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
                <tr>
                  <th className="px-5 py-3.5">Acquisition Source</th>
                  <th className="px-4 py-3.5">Total Leads</th>
                  <th className="px-4 py-3.5">Qualified</th>
                  <th className="px-4 py-3.5">Converted</th>
                  <th className="px-4 py-3.5">Net Revenue</th>
                  <th className="px-4 py-3.5">CAC Per Client</th>
                  <th className="px-5 py-3.5 text-right">Channel ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-ink-200 font-mono">
                {LEAD_SOURCE_ANALYTICS.map((s) => (
                  <tr key={s.source} className="hover:bg-[#0E1624]/60 transition-colors">
                    <td className="px-5 py-4 font-sans font-bold text-white text-sm">{s.source}</td>
                    <td className="px-4 py-4">{s.leads}</td>
                    <td className="px-4 py-4 text-brand-300">{s.qualified}</td>
                    <td className="px-4 py-4 text-emerald-400 font-bold">{s.converted}</td>
                    <td className="px-4 py-4 font-bold text-white">{s.revenue}</td>
                    <td className="px-4 py-4 text-ink-400">{s.cac}</td>
                    <td className="px-5 py-4 text-right text-emerald-400 font-bold">{s.roi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "referrals" && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Client & Affiliate Referral Reward Ledger
            </h2>
            <span className="text-[11px] font-mono text-ink-400">10% Standard RevShare</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
                <tr>
                  <th className="px-5 py-3.5">Referrer Name & Code</th>
                  <th className="px-4 py-3.5">Referred Client</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Generated Revenue</th>
                  <th className="px-4 py-3.5">Accrued Commission</th>
                  <th className="px-5 py-3.5 text-right">Payout Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-ink-200 font-mono">
                {INITIAL_REFERRALS.map((r) => (
                  <tr key={r.id} className="hover:bg-[#0E1624]/60 transition-colors">
                    <td className="px-5 py-4 font-sans">
                      <div className="font-bold text-white text-sm">{r.referrerName}</div>
                      <span className="font-mono text-[10px] text-brand-400">{r.referrerCode}</span>
                    </td>
                    <td className="px-4 py-4 font-sans font-semibold text-white">{r.referredClient}</td>
                    <td className="px-4 py-4 text-ink-400">{r.date}</td>
                    <td className="px-4 py-4">
                      <Badge tone={r.status === "CONVERTED" ? "positive" : "neutral"}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-4 text-white font-bold">₹{r.revenue.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4 text-emerald-400 font-bold">₹{r.rewardEarned.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-amber-400 text-xs font-bold">{r.payoutStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
