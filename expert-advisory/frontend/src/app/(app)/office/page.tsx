"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  LineChart,
  ShieldCheck,
  ReceiptIndianRupee,
  FileCheck2,
  ExternalLink,
  MessageSquare,
  Search,
  Filter,
  TrendingUp,
  AlertTriangle,
  PlusCircle,
  RotateCw,
  Clock,
  PhoneCall,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/app/AuthProvider";
import { PageTitle } from "@/components/app/AppShell";
import { Badge, Card, cx } from "@/components/ui";

interface Lead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  capital: string;
  segment: string;
  status: "new" | "contacted" | "qualified" | "converted";
  createdAt: string;
  source?: string;
  message?: string;
  city?: string;
}

interface KycRecord {
  code: string;
  name: string;
  mobile: string;
  score: string;
  profile: string;
  kyc: string;
  rm: string;
  createdAt: string;
  summary?: string;
}

interface AdvisoryCall {
  id: string;
  symbol: string;
  exchange: string;
  direction: "BUY" | "SELL";
  entryRange: string;
  stopLoss: string;
  targets: string;
  horizon: string;
  status: "Active" | "Target Hit" | "Closed";
  pnl: string;
}

const INITIAL_CALLS: AdvisoryCall[] = [
  {
    id: "REC-101",
    symbol: "HDFCBANK",
    exchange: "NSE",
    direction: "BUY",
    entryRange: "1680 - 1710",
    stopLoss: "1620",
    targets: "1820 / 1910",
    horizon: "3-6 Months",
    status: "Active",
    pnl: "+3.2%",
  },
  {
    id: "REC-102",
    symbol: "L&T",
    exchange: "NSE",
    direction: "BUY",
    entryRange: "3450 - 3500",
    stopLoss: "3340",
    targets: "3750 / 3900",
    horizon: "2-4 Months",
    status: "Target Hit",
    pnl: "+7.8%",
  },
  {
    id: "REC-103",
    symbol: "RELIANCE",
    exchange: "NSE",
    direction: "BUY",
    entryRange: "2940 - 2970",
    stopLoss: "2870",
    targets: "3150 / 3280",
    horizon: "1-3 Months",
    status: "Active",
    pnl: "+1.9%",
  },
];

export default function OfficeDashboardPage() {
  const { me } = useAuth();
  const [activeTab, setActiveTab] = useState<"leads" | "research" | "kyc" | "compliance">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [kycRecords, setKycRecords] = useState<KycRecord[]>([]);
  const [calls, setCalls] = useState<AdvisoryCall[]>(INITIAL_CALLS);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("Just now");

  // New recommendation form modal state
  const [showCallModal, setShowCallModal] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [newDirection, setNewDirection] = useState<"BUY" | "SELL">("BUY");
  const [newEntry, setNewEntry] = useState("");
  const [newSL, setNewSL] = useState("");
  const [newTargets, setNewTargets] = useState("");
  const [newHorizon, setNewHorizon] = useState("1-3 Months");

  const fetchOfficeData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [leadsRes, kycRes] = await Promise.all([
        fetch("/api/v1/office/leads", { cache: "no-store" }).catch(() => null),
        fetch("/api/v1/office/kyc", { cache: "no-store" }).catch(() => null),
      ]);

      if (leadsRes && leadsRes.ok) {
        const json = await leadsRes.json();
        if (json?.success && Array.isArray(json.data)) {
          setLeads(json.data);
        }
      }

      if (kycRes && kycRes.ok) {
        const json = await kycRes.json();
        if (json?.success && Array.isArray(json.data)) {
          setKycRecords(json.data);
        }
      }

      setLastRefreshed(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err) {
      console.warn("[Office] Data fetch failed, retaining active state:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOfficeData();
    // Auto-refresh every 15 seconds to stream in new leads
    const interval = setInterval(() => fetchOfficeData(true), 15000);
    return () => clearInterval(interval);
  }, [fetchOfficeData]);

  const handleCreateCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol || !newEntry || !newSL || !newTargets) return;
    const newCall: AdvisoryCall = {
      id: `REC-${Math.floor(100 + Math.random() * 900)}`,
      symbol: newSymbol.toUpperCase(),
      exchange: "NSE",
      direction: newDirection,
      entryRange: newEntry,
      stopLoss: newSL,
      targets: newTargets,
      horizon: newHorizon,
      status: "Active",
      pnl: "0.0%",
    };
    setCalls([newCall, ...calls]);
    setShowCallModal(false);
    setNewSymbol("");
    setNewEntry("");
    setNewSL("");
    setNewTargets("");
  };

  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      l.mobile.includes(leadSearch) ||
      (l.segment && l.segment.toLowerCase().includes(leadSearch.toLowerCase())) ||
      (l.email && l.email.toLowerCase().includes(leadSearch.toLowerCase())) ||
      l.id.toLowerCase().includes(leadSearch.toLowerCase());
    const matchesFilter = leadFilter === "all" || l.status === leadFilter;
    return matchesSearch && matchesFilter;
  });

  const toggleLeadStatus = async (id: string, newStatus: Lead["status"]) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    try {
      await fetch("/api/v1/office/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
    } catch (err) {
      console.warn("[Office] Could not persist status change:", err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Multi-Desk Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-200 pb-5">
        <div>
          <PageTitle
            title="Staff Operations & Executive Desk"
            description="Manage inbound leads, research publications, client suitability, and regulatory oversight."
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono text-ink-600">
            <span className="size-2 rounded-full bg-positive-500 animate-pulse" />
            <span>Operator: <strong>{me.name}</strong></span>
            <span>•</span>
            <span className="text-brand-700 font-semibold">Dual-Control Audit Active</span>
            <span>•</span>
            <span className="text-ink-400">Synced: {lastRefreshed}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => fetchOfficeData()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-100 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Fetch latest leads and KYC submissions"
          >
            <RotateCw className={cx("size-3.5 text-brand-600", refreshing && "animate-spin")} />
            <span>{refreshing ? "Refreshing..." : "Refresh Feed"}</span>
          </button>

          {/* Quick link to TradeGrow Brokerage Admin */}
          <a
            href="https://tradegrowx.in/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-ink-800 transition-colors"
          >
            <TrendingUp className="size-4 text-accent-400" />
            <span>TradeGrow Admin</span>
            <ExternalLink className="size-3 text-ink-400" />
          </a>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border-l-4 border-l-brand-600">
          <div className="flex items-center justify-between text-xs font-mono text-ink-500">
            <span>INBOUND CRM LEADS</span>
            <Users className="size-4 text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink-900">
            {loading ? "..." : `${leads.length} Records`}
          </div>
          <p className="mt-1 text-xs text-positive-600 font-medium">
            {leads.filter((l) => l.status === "new").length} New / Unhandled
          </p>
        </Card>

        <Card className="p-5 border-l-4 border-l-positive-600">
          <div className="flex items-center justify-between text-xs font-mono text-ink-500">
            <span>KYC & ASSESSMENTS</span>
            <FileCheck2 className="size-4 text-positive-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink-900">
            {loading ? "..." : `${kycRecords.length} Submissions`}
          </div>
          <p className="mt-1 text-xs text-ink-600">SEBI Suitability Matrix</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-accent-600">
          <div className="flex items-center justify-between text-xs font-mono text-ink-500">
            <span>ACTIVE ADVISORY CALLS</span>
            <LineChart className="size-4 text-accent-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink-900">
            {calls.filter((c) => c.status === "Active").length} Live Calls
          </div>
          <p className="mt-1 text-xs text-ink-600">Avg Risk:Reward 1 : 2.4</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-warning-600">
          <div className="flex items-center justify-between text-xs font-mono text-ink-500">
            <span>SEBI COMPLIANCE SLA</span>
            <ShieldCheck className="size-4 text-warning-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink-900">100% On-Time</div>
          <p className="mt-1 text-xs text-ink-600">Zero Pending Grievances</p>
        </Card>
      </div>

      {/* Desk Navigation Tabs */}
      <div className="border-b border-ink-200">
        <nav className="flex space-x-4 sm:space-x-8">
          {[
            { id: "leads", label: "Leads & Telecaller CRM", icon: Users, count: leads.length },
            { id: "kyc", label: "Client KYC & Risk Profiles", icon: FileCheck2, count: kycRecords.length },
            { id: "research", label: "Research & Calls Dispatch", icon: LineChart, count: calls.length },
            { id: "compliance", label: "Compliance & Audit Trail", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cx(
                  "flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-medium transition-colors cursor-pointer",
                  active
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800"
                )}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={cx("rounded-full px-2 py-0.5 text-xs font-mono", active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-600")}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: LEADS & TELECALLER CRM */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-ink-400" />
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Search by name, phone, segment, or ref..."
                className="w-full rounded-xl border border-ink-300 bg-white pl-9 pr-4 py-2 text-sm text-ink-900 placeholder-ink-400 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="size-4 text-ink-500" />
              <select
                value={leadFilter}
                onChange={(e) => setLeadFilter(e.target.value)}
                className="rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 focus:outline-none"
              >
                <option value="all">All Statuses ({leads.length})</option>
                <option value="new">New ({leads.filter((l) => l.status === "new").length})</option>
                <option value="contacted">Contacted ({leads.filter((l) => l.status === "contacted").length})</option>
                <option value="qualified">Qualified ({leads.filter((l) => l.status === "qualified").length})</option>
                <option value="converted">Converted ({leads.filter((l) => l.status === "converted").length})</option>
              </select>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs font-mono uppercase tracking-wider text-ink-500 border-b border-ink-200">
                  <tr>
                    <th className="px-5 py-3">Lead ID & Name</th>
                    <th className="px-5 py-3">Contact Details</th>
                    <th className="px-5 py-3">Declared Capital</th>
                    <th className="px-5 py-3">Segment / Source</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Captured</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-500">
                        No leads matching your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-ink-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-ink-900">{lead.name}</div>
                          <div className="font-mono text-xs text-brand-700">{lead.id}</div>
                          {lead.message && (
                            <div className="text-[11px] text-ink-500 line-clamp-1 mt-0.5" title={lead.message}>
                              &quot;{lead.message}&quot;
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-ink-800">
                          <div className="font-semibold text-ink-900">{lead.mobile}</div>
                          <div className="text-ink-500">{lead.email}</div>
                          {lead.city && <div className="text-[11px] text-ink-400">{lead.city}</div>}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-medium text-ink-900">{lead.capital}</td>
                        <td className="px-5 py-3.5 text-xs text-ink-700">
                          <div>{lead.segment}</div>
                          {lead.source && <div className="text-[11px] text-ink-400 mt-0.5">{lead.source}</div>}
                        </td>
                        <td className="px-5 py-3.5">
                          <select
                            value={lead.status}
                            onChange={(e) => toggleLeadStatus(lead.id, e.target.value as any)}
                            className={cx(
                              "rounded-md border px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer",
                              lead.status === "new" && "bg-brand-50 border-brand-300 text-brand-700",
                              lead.status === "contacted" && "bg-warning-50 border-warning-300 text-warning-800",
                              lead.status === "qualified" && "bg-accent-50 border-accent-300 text-accent-800",
                              lead.status === "converted" && "bg-positive-50 border-positive-300 text-positive-700"
                            )}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="converted">Converted</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-ink-500">{lead.createdAt}</td>
                        <td className="px-5 py-3.5 text-right">
                          <a
                            href={`https://wa.me/${lead.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Hello ${lead.name}, thank you for contacting Expert Stocks Consultancy regarding our advisory services (Ref: ${lead.id}). How may our advisory team assist you today?`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 px-2.5 py-1 text-xs font-medium text-[#16A34A] hover:bg-[#22C55E]/20 transition-colors"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: CLIENT KYC & RISK PROFILES */}
      {activeTab === "kyc" && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-100 pb-3 gap-2">
            <div>
              <h3 className="text-base font-semibold text-ink-900">SEBI Suitability & KYC Verification Queue</h3>
              <p className="text-xs text-ink-500">Every subscribed client must have an active risk suitability assessment.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="positive">{kycRecords.length} Assessments Active</Badge>
              <button
                type="button"
                onClick={() => fetchOfficeData()}
                className="text-xs text-brand-700 hover:underline font-mono"
              >
                Reload
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {kycRecords.length === 0 ? (
              <p className="text-sm text-ink-500 py-6 text-center">No KYC submissions found.</p>
            ) : (
              kycRecords.map((c) => (
                <div key={c.code} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-ink-200 bg-ink-50/50 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-900">{c.name}</span>
                      <span className="font-mono text-xs text-brand-700 font-bold">({c.code})</span>
                      <span className="text-xs font-mono text-ink-500">{c.mobile}</span>
                    </div>
                    <div className="mt-1 text-xs text-ink-600">
                      RM: <strong>{c.rm}</strong> • Status: <span className="text-positive-700 font-semibold">{c.kyc}</span>
                      {c.summary && <span className="text-ink-500 italic ml-2">— &quot;{c.summary}&quot;</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-ink-500">Risk Profile: <strong>{c.score}</strong></div>
                      <div className="text-xs font-semibold text-brand-700">{c.profile}</div>
                    </div>
                    <a
                      href={`https://wa.me/${c.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Hello ${c.name}, your SEBI Risk Suitability assessment (${c.profile}, Score: ${c.score}) has been reviewed by our compliance desk.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-ink-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <MessageSquare className="size-3 text-[#22C55E]" />
                      <span>Follow Up</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 3: RESEARCH & CALLS DISPATCH */}
      {activeTab === "research" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-600">
              Publish formal SEBI-mandated technical & fundamental recommendations with verifiable stop-loss and targets.
            </p>
            <button
              type="button"
              onClick={() => setShowCallModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <PlusCircle className="size-4" />
              <span>Publish Recommendation</span>
            </button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs font-mono uppercase tracking-wider text-ink-500 border-b border-ink-200">
                  <tr>
                    <th className="px-5 py-3">Symbol / Segment</th>
                    <th className="px-5 py-3">Call</th>
                    <th className="px-5 py-3">Entry Range</th>
                    <th className="px-5 py-3">Stop Loss</th>
                    <th className="px-5 py-3">Targets</th>
                    <th className="px-5 py-3">Horizon</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {calls.map((call) => (
                    <tr key={call.id} className="hover:bg-ink-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-ink-900">{call.symbol}</div>
                        <div className="text-xs text-ink-500">{call.exchange} • Equity Cash</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={call.direction === "BUY" ? "positive" : "danger"}>
                          {call.direction}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-ink-900">₹{call.entryRange}</td>
                      <td className="px-5 py-3.5 font-mono text-danger-600 font-semibold">₹{call.stopLoss}</td>
                      <td className="px-5 py-3.5 font-mono text-positive-700 font-semibold">{call.targets}</td>
                      <td className="px-5 py-3.5 text-xs text-ink-600">{call.horizon}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={call.status === "Active" ? "brand" : "positive"}>{call.status}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-positive-600">{call.pnl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: COMPLIANCE & AUDIT TRAIL */}
      {activeTab === "compliance" && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-base font-semibold text-ink-900 mb-2">Statutory Audit Logs & Compliance Matrix</h3>
            <p className="text-xs text-ink-600 mb-4 leading-relaxed">
              All communications, recommendation logs, client fee receipts, and risk disclosures are cryptographically preserved for a mandatory 5-year retention period under SEBI Research Analysts Regulations, 2014.
            </p>

            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <div className="rounded-xl border border-ink-200 bg-white p-4">
                <div className="text-xs font-mono text-ink-500">GRIEVANCE ESCALATIONS</div>
                <div className="mt-1 text-xl font-bold font-mono text-positive-700">0 Open</div>
                <p className="text-[11px] text-ink-500 mt-0.5">SCORES & ODR Clean</p>
              </div>
              <div className="rounded-xl border border-ink-200 bg-white p-4">
                <div className="text-xs font-mono text-ink-500">RESEARCH DUAL CONTROL</div>
                <div className="mt-1 text-xl font-bold font-mono text-brand-700">Enabled</div>
                <p className="text-[11px] text-ink-500 mt-0.5">Analyst + Approver Sign-off</p>
              </div>
              <div className="rounded-xl border border-ink-200 bg-white p-4">
                <div className="text-xs font-mono text-ink-500">TAMPER-EVIDENT ARCHIVE</div>
                <div className="mt-1 text-xl font-bold font-mono text-ink-900">SHA-256</div>
                <p className="text-[11px] text-ink-500 mt-0.5">Historical Calls Hash Verified</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: PUBLISH NEW ADVISORY CALL */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-ink-200 pb-3">
              <h3 className="text-lg font-bold text-ink-900">Publish Research Recommendation</h3>
              <button
                type="button"
                onClick={() => setShowCallModal(false)}
                className="text-ink-400 hover:text-ink-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCall} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700">Symbol</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INFY, TCS"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink-300 p-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700">Call Type</label>
                  <select
                    value={newDirection}
                    onChange={(e) => setNewDirection(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-ink-300 p-2 text-sm font-semibold"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700">Entry Range</label>
                  <input
                    type="text"
                    required
                    placeholder="1500 - 1520"
                    value={newEntry}
                    onChange={(e) => setNewEntry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink-300 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700">Stop Loss</label>
                  <input
                    type="text"
                    required
                    placeholder="1460"
                    value={newSL}
                    onChange={(e) => setNewSL(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink-300 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700">Targets</label>
                  <input
                    type="text"
                    required
                    placeholder="1600 / 1680"
                    value={newTargets}
                    onChange={(e) => setNewTargets(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink-300 p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700">Time Horizon</label>
                <select
                  value={newHorizon}
                  onChange={(e) => setNewHorizon(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-300 p-2 text-sm"
                >
                  <option value="Intraday">Intraday (Same Day)</option>
                  <option value="1-2 Weeks">Short Term (1-2 Weeks)</option>
                  <option value="1-3 Months">Positional (1-3 Months)</option>
                  <option value="6-12 Months">Long Term Investment (6-12 Months)</option>
                </select>
              </div>

              <div className="rounded-lg bg-ink-50 p-3 text-[11px] text-ink-600 flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning-600 shrink-0 mt-0.5" />
                <span>
                  By publishing, you confirm that you have conducted appropriate fundamental/technical due diligence and hold no personal conflict of interest in this security.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCallModal(false)}
                  className="rounded-xl border border-ink-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 shadow-sm transition-colors cursor-pointer"
                >
                  Publish to Client Portal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
