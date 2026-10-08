"use client";

import React, { useState } from "react";
import {
  LifeBuoy,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import { CrmTicket, INITIAL_TICKETS } from "@/lib/crm-data";

export function SupportTicketingView() {
  const [tickets, setTickets] = useState<CrmTicket[]>(INITIAL_TICKETS);
  const [filterCat, setFilterCat] = useState<string>("ALL");

  const filtered = tickets.filter((t) => filterCat === "ALL" || t.category === filterCat);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Support Desk & SEBI Grievance Redressal
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              21-DAY STATUTORY SLA MONITOR
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Resolve customer tickets, payment disputes, login assistance, and statutory SEBI SCORES inquiries.
          </p>
        </div>

        <a
          href="https://scores.sebi.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0E1624] hover:bg-[#162235] text-white px-4 py-2.5 text-xs font-bold border border-[#1E293B] transition-colors"
        >
          <ShieldCheck className="size-4 text-emerald-400" />
          <span>SEBI SCORES Portal</span>
          <ExternalLink className="size-3 text-ink-400" />
        </a>
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Total Active Tickets</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">{tickets.length}</div>
          <p className="text-[11px] text-ink-400 mt-0.5">Average SLA: 4.2 Hours</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">SEBI SCORES Escalations</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">0 Pending</div>
          <p className="text-[11px] text-emerald-300 mt-0.5">100% Resolved On-Time</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Resolution Rate</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">98.2%</div>
          <p className="text-[11px] text-ink-400 mt-0.5">Customer satisfaction: 4.8/5</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Compliance Officer Audit</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">Cleared</div>
          <p className="text-[11px] text-ink-400 mt-0.5">Audited by Rajeshwar Rao</p>
        </div>
      </div>

      {/* Tickets List Table */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Support Queue & Redressal Ledger
          </h2>
          <div className="flex items-center gap-1 text-xs">
            {["ALL", "SUBSCRIPTION", "PAYMENT", "SEBI_SCORES"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={cx(
                  "px-3 py-1 rounded-lg font-mono text-[10px] uppercase font-bold transition-colors cursor-pointer",
                  filterCat === cat ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
                )}
              >
                {cat.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
              <tr>
                <th className="px-5 py-3.5">Ticket ID & Created</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Subject & Category</th>
                <th className="px-4 py-3.5">Priority</th>
                <th className="px-4 py-3.5">Assigned Agent</th>
                <th className="px-4 py-3.5">SEBI SLA Countdown</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-ink-200">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-[#0E1624]/60 transition-colors">
                  <td className="px-5 py-4 font-mono">
                    <span className="text-brand-400 font-bold">{t.id}</span>
                    <div className="text-[10px] text-ink-400 mt-0.5">{t.createdAt}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-white text-sm">{t.customerName}</div>
                    <span className="font-mono text-[10px] text-ink-400">{t.customerId}</span>
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    <div className="font-semibold text-white truncate">{t.subject}</div>
                    <span className="text-[10px] font-mono text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cx(
                      "font-mono font-bold text-[10px] px-2 py-0.5 rounded border",
                      t.priority === "CRITICAL" ? "bg-red-500/15 border-red-500/30 text-red-300" :
                      t.priority === "HIGH" ? "bg-amber-500/15 border-amber-500/30 text-amber-300" :
                      "bg-blue-500/15 border-blue-500/30 text-blue-300"
                    )}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-white font-medium">{t.assignedAgent}</td>
                  <td className="px-4 py-4 font-mono text-emerald-400">
                    {t.slaRemainingDays} of 21 Days Remaining
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Badge tone={t.status === "RESOLVED" ? "positive" : t.status === "IN_PROGRESS" ? "warning" : "neutral"}>
                      {t.status.replace("_", " ")}
                    </Badge>
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
