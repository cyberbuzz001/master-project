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
  Copy,
  Check,
  Percent,
  ShieldCheck,
  DollarSign,
  Layers,
  Link as LinkIcon,
  Filter,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import { CrmCampaign, CrmReferral, INITIAL_CAMPAIGNS, INITIAL_REFERRALS } from "@/lib/crm-data";
import { buildCampaignUrl } from "@/lib/attribution";

type AttributionModel = "FIRST_TOUCH" | "LAST_TOUCH" | "LINEAR" | "TIME_DECAY";

interface ChannelAnalytics {
  source: string;
  firstTouchLeads: number;
  lastTouchLeads: number;
  linearLeads: number;
  qualified: number;
  converted: number;
  revenue: number;
  spend: number;
  cac: number;
  roi: string;
}

const BASE_SOURCE_ANALYTICS: ChannelAnalytics[] = [
  {
    source: "Google Search Ads (High Intent)",
    firstTouchLeads: 64,
    lastTouchLeads: 58,
    linearLeads: 61,
    qualified: 36,
    converted: 14,
    revenue: 1850000,
    spend: 91700,
    cac: 6550,
    roi: "4.86x",
  },
  {
    source: "Meta Ads (Instagram / Facebook)",
    firstTouchLeads: 48,
    lastTouchLeads: 42,
    linearLeads: 45,
    qualified: 24,
    converted: 8,
    revenue: 1200000,
    spend: 55200,
    cac: 6900,
    roi: "4.13x",
  },
  {
    source: "Organic SEO & Research Blog",
    firstTouchLeads: 32,
    lastTouchLeads: 22,
    linearLeads: 27,
    qualified: 14,
    converted: 6,
    revenue: 720000,
    spend: 0,
    cac: 0,
    roi: "Infinite",
  },
  {
    source: "Partner & Creator Network",
    firstTouchLeads: 16,
    lastTouchLeads: 12,
    linearLeads: 14,
    qualified: 8,
    converted: 5,
    revenue: 480000,
    spend: 7500,
    cac: 1500,
    roi: "6.40x",
  },
  {
    source: "YouTube Masterclass & Podcasts",
    firstTouchLeads: 14,
    lastTouchLeads: 8,
    linearLeads: 11,
    qualified: 4,
    converted: 2,
    revenue: 180000,
    spend: 8400,
    cac: 4200,
    roi: "2.14x",
  },
];

interface CreatorTier {
  name: string;
  minClients: number;
  maxClients: number;
  advisoryRevShare: string;
  orderBonus: string;
  badgeTone: "neutral" | "positive" | "warning";
}

const CREATOR_TIERS: CreatorTier[] = [
  { name: "Bronze Partner", minClients: 0, maxClients: 10, advisoryRevShare: "10%", orderBonus: "₹5 / order", badgeTone: "neutral" },
  { name: "Silver Partner", minClients: 11, maxClients: 25, advisoryRevShare: "15%", orderBonus: "₹8 / order", badgeTone: "positive" },
  { name: "Gold Creator", minClients: 26, maxClients: 50, advisoryRevShare: "20%", orderBonus: "₹12 / order", badgeTone: "warning" },
  { name: "Institutional Master", minClients: 51, maxClients: 999, advisoryRevShare: "25%", orderBonus: "₹15 / order", badgeTone: "positive" },
];

export function CampaignsReferralsView() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "attribution" | "referrals">("campaigns");
  const [attrModel, setAttrModel] = useState<AttributionModel>("LINEAR");
  const [campaigns, setCampaigns] = useState<CrmCampaign[]>(INITIAL_CAMPAIGNS);
  const [referrals, setReferrals] = useState<CrmReferral[]>(INITIAL_REFERRALS);

  // New Campaign Modal State
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampName, setNewCampName] = useState("");
  const [newCampDest, setNewCampDest] = useState("/plans");
  const [newCampSource, setNewCampSource] = useState("google");
  const [newCampMedium, setNewCampMedium] = useState("cpc");
  const [newCampId, setNewCampId] = useState("alpha-q4-2026");
  const [newCampBudget, setNewCampBudget] = useState("50000");
  const [copiedLink, setCopiedLink] = useState(false);

  // Partner Link Generator State
  const [partnerHandle, setPartnerHandle] = useState("TRADER_VIKRAM");
  const [copiedPartnerAdvisory, setCopiedPartnerAdvisory] = useState(false);
  const [copiedPartnerBroker, setCopiedPartnerBroker] = useState(false);
  const [copiedWhatsAppPitch, setCopiedWhatsAppPitch] = useState(false);

  // Payout UTR Modal State
  const [selectedPayout, setSelectedPayout] = useState<CrmReferral | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [utrSuccess, setUtrSuccess] = useState(false);

  const totalSpent = campaigns.reduce((acc, c) => acc + c.spend, 0);
  const totalRevenue = campaigns.reduce((acc, c) => acc + c.revenue, 0);
  const totalConverted = campaigns.reduce((acc, c) => acc + c.converted, 0);
  const blendedCac = totalConverted > 0 ? Math.round(totalSpent / totalConverted) : 0;
  const overallRoas = totalSpent > 0 ? (totalRevenue / totalSpent).toFixed(2) + "x" : "0x";

  const generatedCampaignUrl = buildCampaignUrl({
    baseUrl: `expertstocks.in${newCampDest}`,
    utmSource: newCampSource,
    utmMedium: newCampMedium,
    utmCampaign: newCampId,
  });

  const partnerAdvisoryUrl = `https://expertstocks.in/r/${partnerHandle.trim().toUpperCase()}`;
  const partnerBrokerUrl = `https://tradegrow.com/r/${partnerHandle.trim().toUpperCase()}`;

  function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!newCampName.trim()) return;

    const budget = Number(newCampBudget) || 50000;
    const newCamp: CrmCampaign = {
      id: `CMP-2026-0${campaigns.length + 1}`,
      name: newCampName.trim(),
      type: "NEW_LEAD",
      channel: newCampSource === "google" ? "Google Ads" : newCampSource === "meta" || newCampSource === "instagram" ? "Meta Instagram" : "YouTube",
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      converted: 0,
      revenue: 0,
      spend: budget,
      roi: "0.0x",
      status: "ACTIVE",
    };

    setCampaigns([newCamp, ...campaigns]);
    setShowNewCampaignModal(false);
    setNewCampName("");
  }

  function handleProcessPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPayout || !utrNumber.trim()) return;

    setReferrals((prev) =>
      prev.map((r) =>
        r.id === selectedPayout.id
          ? { ...r, payoutStatus: "PAID" as const }
          : r
      )
    );
    setUtrSuccess(true);
    setTimeout(() => {
      setSelectedPayout(null);
      setUtrNumber("");
      setUtrSuccess(false);
    }, 1200);
  }

  return (
    <div className="space-y-6 animate-fade-in text-ink-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Campaigns, CAC & Referral Revenue Desk
            </h1>
            <span className="rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono px-3 py-1 border border-brand-500/20">
              PHASE 3 & 4 ATTRIBUTION
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Multi-touch UTM attribution, ad spend CAC analytics, and creator revenue sharing with Section 194H TDS compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowNewCampaignModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-500/20 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Launch Campaign & UTM
          </button>

          <div className="flex items-center gap-1.5 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
            <button
              type="button"
              onClick={() => setActiveTab("campaigns")}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "campaigns" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Ad Campaigns & CAC
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("attribution")}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "attribution" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Multi-Touch Attribution
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("referrals")}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                activeTab === "referrals" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
              )}
            >
              Creator & Referral Engine
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Performance KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-ink-400 font-mono">
            <span>BLENDED CAC</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">₹{blendedCac.toLocaleString("en-IN")}</div>
          <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <span>● 32% lower than ₹8,000 industry avg</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-ink-400 font-mono">
            <span>OVERALL ROAS</span>
            <Sparkles className="h-4 w-4 text-brand-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{overallRoas}</div>
          <div className="text-[11px] text-ink-400 font-mono">₹{((totalRevenue - totalSpent) / 100000).toFixed(2)}L Net Ad Profit</div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-ink-400 font-mono">
            <span>LTV / CAC HEALTH</span>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">6.8x</div>
          <div className="text-[11px] text-ink-400 font-mono">Strong Institutional Grade (&gt; 5x)</div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-ink-400 font-mono">
            <span>TOTAL ATTRIBUTED ADVISORY</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">₹{(totalRevenue / 100000).toFixed(2)}L</div>
          <div className="text-[11px] text-ink-400 font-mono">{totalConverted} Verified Closures</div>
        </div>
      </div>

      {/* TAB 1: Ad Campaigns & Budget Pacing */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-brand-400" />
              Active Marketing Campaigns & Budget Pacing
            </h2>
            <span className="text-xs font-mono text-ink-400">Monthly Pacing: 74% allocated</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const cpl = c.clicked > 0 ? Math.round(c.spend / (c.converted * 3.5 || 1)) : 0;
              const cac = c.converted > 0 ? Math.round(c.spend / c.converted) : 0;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-4 shadow-xl hover:border-brand-500/50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-brand-400 uppercase px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
                      {c.channel}
                    </span>
                    <Badge tone={c.status === "ACTIVE" ? "positive" : "neutral"}>{c.status}</Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-brand-300 transition-colors">{c.name}</h3>
                    <p className="text-[11px] font-mono text-ink-400 mt-0.5">Campaign ID: {c.id}</p>
                  </div>

                  <div className="flex items-baseline justify-between pt-2 border-t border-[#1E293B]">
                    <div>
                      <span className="text-[10px] text-ink-400 block font-mono">REVENUE GENERATED</span>
                      <span className="text-xl font-bold font-mono text-emerald-400">
                        ₹{(c.revenue / 100000).toFixed(2)}L
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-ink-400 block font-mono">ROAS MULTIPLIER</span>
                      <span className="text-sm font-bold font-mono text-brand-300">{c.roi}</span>
                    </div>
                  </div>

                  {/* Budget & Spend Meter */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-mono text-ink-300">
                      <span>Spend: ₹{(c.spend / 1000).toFixed(1)}k</span>
                      <span>{c.converted} Closes</span>
                    </div>
                    <div className="w-full bg-[#1E293B] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-brand-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(25, (c.converted / 50) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1E293B] text-[11px] font-mono text-ink-300">
                    <div className="bg-[#0E1624] p-2 rounded-lg border border-[#1E293B]/60">
                      <span className="text-[10px] text-ink-500 block">COST / CLIENT (CAC)</span>
                      <span className="text-white font-bold">₹{cac.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="bg-[#0E1624] p-2 rounded-lg border border-[#1E293B]/60">
                      <span className="text-[10px] text-ink-500 block">CLICKS / ENGAGED</span>
                      <span className="text-white font-bold">{c.clicked.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Multi-Touch Attribution Matrix */}
      {activeTab === "attribution" && (
        <div className="space-y-6">
          {/* Attribution Model Controls */}
          <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1E293B] pb-4">
              <div>
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-400" />
                  Select Attribution Methodology (SEBI Audit Ready)
                </h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  Analyze which top-of-funnel touchpoint vs closing campaign drove lifetime trading volume.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setAttrModel("FIRST_TOUCH")}
                  className={cx(
                    "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                    attrModel === "FIRST_TOUCH" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
                  )}
                >
                  First-Touch
                </button>
                <button
                  type="button"
                  onClick={() => setAttrModel("LAST_TOUCH")}
                  className={cx(
                    "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                    attrModel === "LAST_TOUCH" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
                  )}
                >
                  Last-Touch
                </button>
                <button
                  type="button"
                  onClick={() => setAttrModel("LINEAR")}
                  className={cx(
                    "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                    attrModel === "LINEAR" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
                  )}
                >
                  Linear (50/50)
                </button>
                <button
                  type="button"
                  onClick={() => setAttrModel("TIME_DECAY")}
                  className={cx(
                    "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                    attrModel === "TIME_DECAY" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
                  )}
                >
                  Time Decay
                </button>
              </div>
            </div>

            {/* Model explanation banner */}
            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs font-mono text-brand-300 flex items-center justify-between">
              <span>
                Active Model: <strong>{attrModel}</strong> —{" "}
                {attrModel === "FIRST_TOUCH" && "100% conversion credit assigned to the discovery ad or referral that originated the lead."}
                {attrModel === "LAST_TOUCH" && "100% credit assigned to the final campaign immediately before form submission."}
                {attrModel === "LINEAR" && "Credit split evenly across discovery touchpoint and converting touchpoint."}
                {attrModel === "TIME_DECAY" && "Touchpoints closer to payment receive exponentially higher weighting."}
              </span>
              <span className="text-[11px] text-ink-400">Window: 30-Day Cookies</span>
            </div>

            {/* Attribution Table */}
            <div className="overflow-x-auto rounded-xl border border-[#1E293B]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
                  <tr>
                    <th className="px-5 py-3.5">Acquisition Channel</th>
                    <th className="px-4 py-3.5">Attributed Leads</th>
                    <th className="px-4 py-3.5">Qualified (RPM)</th>
                    <th className="px-4 py-3.5">Paid Conversions</th>
                    <th className="px-4 py-3.5">Total Revenue</th>
                    <th className="px-4 py-3.5">Channel CAC</th>
                    <th className="px-5 py-3.5 text-right">ROAS Multiple</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60 text-ink-200 font-mono">
                  {BASE_SOURCE_ANALYTICS.map((s) => {
                    const attributedLeads =
                      attrModel === "FIRST_TOUCH"
                        ? s.firstTouchLeads
                        : attrModel === "LAST_TOUCH"
                        ? s.lastTouchLeads
                        : s.linearLeads;

                    return (
                      <tr key={s.source} className="hover:bg-[#0E1624]/60 transition-colors">
                        <td className="px-5 py-4 font-sans font-bold text-white text-sm">{s.source}</td>
                        <td className="px-4 py-4 text-brand-300 font-bold">{attributedLeads}</td>
                        <td className="px-4 py-4">{s.qualified}</td>
                        <td className="px-4 py-4 text-emerald-400 font-bold">{s.converted}</td>
                        <td className="px-4 py-4 font-bold text-white">₹{(s.revenue / 100000).toFixed(2)}L</td>
                        <td className="px-4 py-4 text-ink-300">
                          {s.cac === 0 ? "Organic (₹0)" : `₹${s.cac.toLocaleString("en-IN")}`}
                        </td>
                        <td className="px-5 py-4 text-right text-emerald-400 font-bold">{s.roi}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Creator & Partner Revenue Share Engine */}
      {activeTab === "referrals" && (
        <div className="space-y-6">
          {/* Creator Tier Structure */}
          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-3 flex items-center gap-2">
              <Percent className="h-4 w-4 text-brand-400" />
              Creator & Institutional Partner Revenue Share Tiers
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CREATOR_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-4 space-y-2 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs font-sans">{tier.name}</span>
                    <Badge tone={tier.badgeTone}>{tier.advisoryRevShare}</Badge>
                  </div>
                  <div className="text-[11px] font-mono text-ink-400">
                    Volume: {tier.minClients} – {tier.maxClients === 999 ? "∞" : tier.maxClients} Active Clients
                  </div>
                  <div className="pt-2 border-t border-[#1E293B] text-[11px] font-mono text-ink-300">
                    <span className="text-emerald-400 font-bold">{tier.advisoryRevShare}</span> on Advisory +{" "}
                    <span className="text-brand-300 font-bold">{tier.orderBonus}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Partner Link Generator Widget */}
          <div className="rounded-2xl border border-brand-500/30 bg-[#090E17] p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1E293B] pb-4">
              <div>
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-brand-400" />
                  Personalized Partner Link & WhatsApp Dispatch Engine
                </h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  Generate dual tracked links for both the Expert Stocks Advisory Portal and TradeGrow Brokerage app.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-ink-400">Partner Code:</span>
                <input
                  type="text"
                  value={partnerHandle}
                  onChange={(e) => setPartnerHandle(e.target.value.toUpperCase())}
                  className="px-3 py-1.5 bg-[#0E1624] border border-[#1E293B] rounded-lg text-xs font-mono font-bold text-brand-300 uppercase focus:outline-none focus:border-brand-500 w-36"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-[#0E1624] p-3.5 rounded-xl border border-[#1E293B] space-y-2">
                <span className="text-[10px] font-mono text-ink-400 uppercase font-bold block">
                  1. Advisory Portal Referral Link
                </span>
                <div className="flex items-center justify-between gap-2 bg-[#090E17] px-3 py-2 rounded-lg border border-[#1E293B]">
                  <span className="text-xs font-mono text-brand-300 truncate">{partnerAdvisoryUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(partnerAdvisoryUrl);
                      setCopiedPartnerAdvisory(true);
                      setTimeout(() => setCopiedPartnerAdvisory(false), 2000);
                    }}
                    className="p-1 text-ink-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedPartnerAdvisory ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-[#0E1624] p-3.5 rounded-xl border border-[#1E293B] space-y-2">
                <span className="text-[10px] font-mono text-ink-400 uppercase font-bold block">
                  2. TradeGrow Brokerage Link
                </span>
                <div className="flex items-center justify-between gap-2 bg-[#090E17] px-3 py-2 rounded-lg border border-[#1E293B]">
                  <span className="text-xs font-mono text-brand-300 truncate">{partnerBrokerUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(partnerBrokerUrl);
                      setCopiedPartnerBroker(true);
                      setTimeout(() => setCopiedPartnerBroker(false), 2000);
                    }}
                    className="p-1 text-ink-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedPartnerBroker ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] font-mono text-ink-400">
                Pre-approved WhatsApp text with SEBI disclosures and 48-hour live demo trial invite:
              </span>
              <button
                type="button"
                onClick={() => {
                  const pitch = `Hey! Check out Expert Stocks SEBI Registered Research Advisory and TradeGrow Brokerage. You get a 48-Hour Live Demo Trial and zero brokerage on deliveries with my invite link: ${partnerAdvisoryUrl}. Investment in securities market are subject to market risks.`;
                  navigator.clipboard.writeText(pitch);
                  setCopiedWhatsAppPitch(true);
                  setTimeout(() => setCopiedWhatsAppPitch(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#0E1624] hover:bg-[#152033] border border-[#1E293B] text-xs font-mono text-white rounded-lg transition-colors cursor-pointer"
              >
                {copiedWhatsAppPitch ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied WhatsApp Pitch!
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5 text-brand-400" />
                    Copy 1-Click WhatsApp Invite
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Referral Reward & TDS Ledger */}
          <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-brand-400" />
                  Client & Affiliate Reward Ledger (Section 194H 5% TDS Deducted)
                </h2>
                <span className="text-[11px] font-mono text-ink-400">
                  SEBI Mandate: Commissions paid strictly to verified bank accounts after PAN/TDS reconciliation.
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">Audited Payouts Active</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
                  <tr>
                    <th className="px-5 py-3.5">Referrer Name & Code</th>
                    <th className="px-4 py-3.5">Referred Client</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Deal Status</th>
                    <th className="px-4 py-3.5">Gross Revenue</th>
                    <th className="px-4 py-3.5">Gross Reward</th>
                    <th className="px-4 py-3.5">5% TDS (Sec 194H)</th>
                    <th className="px-4 py-3.5">Net Payable</th>
                    <th className="px-5 py-3.5 text-right">Action / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60 text-ink-200 font-mono">
                  {referrals.map((r) => {
                    const tdsAmount = Math.round(r.rewardEarned * 0.05);
                    const netPayable = r.rewardEarned - tdsAmount;

                    return (
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
                        <td className="px-4 py-4 text-white font-bold">₹{r.rewardEarned.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-4 text-amber-400 font-bold">-₹{tdsAmount.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-4 text-emerald-400 font-bold">₹{netPayable.toLocaleString("en-IN")}</td>
                        <td className="px-5 py-4 text-right">
                          {r.payoutStatus === "PAID" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold font-mono">
                              <CheckCircle2 className="h-3.5 w-3.5" /> PAID
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedPayout(r)}
                              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Process Bank NEFT
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Launch New Campaign & Generate Tagged UTM Link */}
      {showNewCampaignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090E17] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="font-bold text-white text-base font-mono uppercase tracking-wider flex items-center gap-2">
                <Plus className="h-4 w-4 text-brand-400" />
                Launch Campaign & Generate UTM Link
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCampaignModal(false)}
                className="text-ink-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-ink-300 block mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Alpha Surge 2026"
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-ink-300 block mb-1">Destination Route</label>
                  <select
                    value={newCampDest}
                    onChange={(e) => setNewCampDest(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="/plans">/plans (Advisory Plans)</option>
                    <option value="/free-trial">/free-trial (48h Demo)</option>
                    <option value="/portal">/portal (Client Cockpit)</option>
                    <option value="/">/ (Homepage Trust)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-mono text-ink-300 block mb-1">UTM Source</label>
                  <select
                    value={newCampSource}
                    onChange={(e) => setNewCampSource(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="google">google (Search / Performance Max)</option>
                    <option value="meta">meta (Instagram / FB)</option>
                    <option value="youtube">youtube (Influencer Collab)</option>
                    <option value="telegram">telegram (Official Channel)</option>
                    <option value="partner">partner (Affiliate Network)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-ink-300 block mb-1">UTM Medium</label>
                  <input
                    type="text"
                    value={newCampMedium}
                    onChange={(e) => setNewCampMedium(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-ink-300 block mb-1">UTM Campaign Identifier</label>
                  <input
                    type="text"
                    value={newCampId}
                    onChange={(e) => setNewCampId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-ink-300 block mb-1">Allocated Monthly Budget (₹ INR)</label>
                <input
                  type="number"
                  value={newCampBudget}
                  onChange={(e) => setNewCampBudget(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Tagged Link Preview */}
              <div className="p-3 bg-[#0B121E] rounded-xl border border-[#1E293B] space-y-1.5">
                <span className="text-[10px] font-mono uppercase font-bold text-ink-400 block">
                  Generated Full-Funnel Tagged URL
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-brand-300 break-all">{generatedCampaignUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCampaignUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="p-1.5 bg-[#0E1624] hover:bg-[#152033] border border-[#1E293B] rounded text-ink-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCampaignModal(false)}
                  className="px-4 py-2 bg-[#0E1624] text-ink-300 hover:text-white text-xs font-bold rounded-xl border border-[#1E293B] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-500/20 cursor-pointer"
                >
                  Launch & Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Process Bank Payout (NEFT/RTGS) */}
      {selectedPayout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090E17] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="font-bold text-white text-base font-mono uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                Process NEFT/RTGS Commission Payout
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                className="text-ink-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#0E1624] p-3.5 rounded-xl border border-[#1E293B] space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-ink-400">Beneficiary:</span>
                <span className="font-bold text-white font-sans">{selectedPayout.referrerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Referral Code:</span>
                <span className="text-brand-400">{selectedPayout.referrerCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Gross Reward:</span>
                <span className="text-white">₹{selectedPayout.rewardEarned.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">5% TDS Withheld (Sec 194H):</span>
                <span className="text-amber-400">-₹{Math.round(selectedPayout.rewardEarned * 0.05).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-t border-[#1E293B] pt-2 text-sm font-bold">
                <span className="text-emerald-400">Net NEFT Transfer:</span>
                <span className="text-emerald-400">
                  ₹{(selectedPayout.rewardEarned - Math.round(selectedPayout.rewardEarned * 0.05)).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <form onSubmit={handleProcessPayout} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-ink-300 block mb-1">
                  Bank UTR / Transaction Reference Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NEFT-20261022-984210"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-[#0E1624] border border-[#1E293B] rounded-xl text-sm font-mono text-white focus:outline-none focus:border-brand-500 uppercase"
                />
              </div>

              {utrSuccess ? (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-mono text-center font-bold">
                  ✓ Bank Transfer Reconciled & Marked as PAID!
                </div>
              ) : (
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPayout(null)}
                    className="px-4 py-2 bg-[#0E1624] text-ink-300 hover:text-white text-xs font-bold rounded-xl border border-[#1E293B] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    Confirm Bank Transfer
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
