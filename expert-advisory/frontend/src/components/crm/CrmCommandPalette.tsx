"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  User,
  Users,
  LineChart,
  CreditCard,
  PhoneCall,
  Calendar,
  Sparkles,
  Command,
  ArrowRight,
  X,
  FileCheck2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import type { CrmLead, Customer360, AdvisoryRecommendation, CrmModuleId } from "@/lib/crm-data";

interface CrmCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateModule: (module: CrmModuleId) => void;
  onSelectLead?: (lead: CrmLead) => void;
  onSelectCustomer?: (customer: Customer360) => void;
  leads: CrmLead[];
  customers: Customer360[];
  recommendations: AdvisoryRecommendation[];
}

export function CrmCommandPalette({
  isOpen,
  onClose,
  onNavigateModule,
  onSelectLead,
  onSelectCustomer,
  leads,
  customers,
  recommendations,
}: CrmCommandPaletteProps) {
  const [query, setQuery] = useState("");

  // Keyboard shortcut listener for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  // Natural Language Queries Detection
  const isHotLeadQuery = q.includes("hot") || q.includes("high intent");
  const isRenewalQuery = q.includes("renew") || q.includes("expir");
  const isPaymentQuery = q.includes("pay") || q.includes("invoice");
  const isOptionQuery = q.includes("option") || q.includes("derivative");

  const matchingLeads = leads.filter((l) => {
    if (!q) return true;
    if (isHotLeadQuery && (l.temperature === "VERY_HOT" || l.temperature === "HOT")) return true;
    if (isOptionQuery && l.tradingExperience.toLowerCase().includes("option")) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      l.mobile.includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q)
    );
  });

  const matchingCustomers = customers.filter((c) => {
    if (!q) return true;
    if (isRenewalQuery && (c.status === "RENEWAL_DUE" || c.currentSubscription.daysRemaining < 30)) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      c.customerCode.toLowerCase().includes(q)
    );
  });

  const matchingRecs = recommendations.filter((r) => {
    if (!q) return true;
    return r.symbol.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs pt-16 sm:pt-24 p-3 animate-fade-in">
      <div className="relative flex flex-col w-full max-w-2xl rounded-2xl bg-[#0B111A] border border-[#1E293B] shadow-2xl overflow-hidden text-white">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[#1E293B] px-4 py-3.5 bg-[#0D1522]">
          <Search className="size-5 text-brand-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, customer name, phone, or 'show hot leads' (Ctrl + K)..."
            className="flex-1 bg-transparent text-sm text-white placeholder-ink-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-ink-400 hover:text-white p-1"
            >
              <X className="size-4" />
            </button>
          )}
          <span className="rounded bg-ink-800 border border-ink-700 px-1.5 py-0.5 text-[10px] font-mono text-ink-300">
            ESC
          </span>
        </div>

        {/* Quick Natural Language Suggestions */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#080D15] border-b border-[#1E293B] text-[11px] font-mono text-ink-400 overflow-x-auto">
          <span className="flex items-center gap-1 text-brand-400">
            <Sparkles className="size-3" />
            <span>AI Quick Filters:</span>
          </span>
          <button
            type="button"
            onClick={() => setQuery("hot leads")}
            className="rounded bg-[#162030] hover:bg-[#1E2D44] text-ink-300 hover:text-white px-2 py-0.5 transition-colors"
          >
            Hot Leads
          </button>
          <button
            type="button"
            onClick={() => setQuery("renewals")}
            className="rounded bg-[#162030] hover:bg-[#1E2D44] text-ink-300 hover:text-white px-2 py-0.5 transition-colors"
          >
            Expiring Subscriptions
          </button>
          <button
            type="button"
            onClick={() => setQuery("options")}
            className="rounded bg-[#162030] hover:bg-[#1E2D44] text-ink-300 hover:text-white px-2 py-0.5 transition-colors"
          >
            Options Traders
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4 text-xs divide-y divide-[#1E293B]/50">
          {/* Quick Module Navigation */}
          {!query && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-mono uppercase text-ink-400 font-bold px-2">
                Quick Jump
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 pt-1">
                {[
                  { id: "dashboard", label: "Executive Dashboard", icon: Command },
                  { id: "pipeline", label: "Sales Pipeline (Kanban)", icon: ArrowRight },
                  { id: "leads", label: "Lead Management Desk", icon: Users },
                  { id: "calling", label: "Telecalling CTI Desk", icon: PhoneCall },
                  { id: "advisory", label: "Research & Calls", icon: LineChart },
                  { id: "ai_intelligence", label: "Ask Management AI", icon: Sparkles },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigateModule(item.id as CrmModuleId);
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-[#162030] text-ink-200 hover:text-white transition-colors"
                  >
                    <item.icon className="size-3.5 text-brand-400" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Leads Results */}
          {matchingLeads.length > 0 && (
            <div className="space-y-1 pt-2">
              <span className="text-[10px] font-mono uppercase text-ink-400 font-bold px-2">
                Leads ({matchingLeads.length})
              </span>
              {matchingLeads.slice(0, 4).map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => {
                    if (onSelectLead) onSelectLead(lead);
                    onNavigateModule("leads");
                    onClose();
                  }}
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-[#162030] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold font-mono">
                      {lead.aiScore}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{lead.name}</span>
                        <span className="font-mono text-[10px] text-brand-400">{lead.id}</span>
                      </div>
                      <p className="text-[11px] text-ink-400">
                        {lead.mobile} • {lead.preferredService} • {lead.budget}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-ink-400">{lead.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Customers Results */}
          {matchingCustomers.length > 0 && (
            <div className="space-y-1 pt-2">
              <span className="text-[10px] font-mono uppercase text-ink-400 font-bold px-2">
                Customers ({matchingCustomers.length})
              </span>
              {matchingCustomers.slice(0, 3).map((cust) => (
                <div
                  key={cust.id}
                  onClick={() => {
                    if (onSelectCustomer) onSelectCustomer(cust);
                    onNavigateModule("customers");
                    onClose();
                  }}
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-[#162030] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold">
                      <User className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{cust.name}</span>
                        <span className="font-mono text-[10px] text-emerald-400">{cust.customerCode}</span>
                      </div>
                      <p className="text-[11px] text-ink-400">
                        {cust.currentSubscription.planName} • {cust.currentSubscription.daysRemaining}d left
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">{cust.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations Results */}
          {matchingRecs.length > 0 && (
            <div className="space-y-1 pt-2">
              <span className="text-[10px] font-mono uppercase text-ink-400 font-bold px-2">
                Advisory Recommendations
              </span>
              {matchingRecs.slice(0, 3).map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => {
                    onNavigateModule("advisory");
                    onClose();
                  }}
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-[#162030] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold font-mono text-brand-300">{rec.symbol}</span>
                    <span className="text-ink-400">{rec.entryRange}</span>
                    <span className="text-emerald-400 font-mono">{rec.pnlReturn}</span>
                  </div>
                  <span className="text-[10px] font-mono text-ink-400">{rec.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-[#1E293B] px-4 py-2.5 bg-[#0D1522] text-[11px] font-mono text-ink-400">
          <span>Search customers, leads, phone, recommendations</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
