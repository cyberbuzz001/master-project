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
  Search,
  X,
  Filter,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import { CrmTicket, INITIAL_TICKETS } from "@/lib/crm-data";

export function SupportTicketingView() {
  const [tickets, setTickets] = useState<CrmTicket[]>(INITIAL_TICKETS);
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [category, setCategory] = useState<CrmTicket["category"]>("SUBSCRIPTION");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<CrmTicket["priority"]>("HIGH");
  const [assignedAgent, setAssignedAgent] = useState("Vikram Malhotra");

  const filtered = tickets.filter((t) => {
    const matchesCat = filterCat === "ALL" || t.category === filterCat;
    const matchesSearch =
      !searchQuery ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !subject) return;

    const newTicket: CrmTicket = {
      id: `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName,
      customerId: customerId || `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      category,
      subject,
      priority,
      status: "OPEN",
      assignedAgent,
      slaRemainingDays: category === "SEBI_SCORES" ? 21 : 3,
      createdAt: "Today, Just now",
    };

    setTickets((prev) => [newTicket, ...prev]);
    setShowAddModal(false);
    setCustomerName("");
    setCustomerId("");
    setSubject("");
  };

  const handleToggleResolve = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: t.status === "RESOLVED" ? "IN_PROGRESS" : "RESOLVED",
            }
          : t
      )
    );
  };

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

        <div className="flex items-center gap-2">
          <a
            href="https://scores.sebi.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0E1624] hover:bg-[#162235] text-white px-3.5 py-2 text-xs font-bold border border-[#1E293B] transition-colors"
          >
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>SCORES Portal</span>
            <ExternalLink className="size-3 text-ink-400" />
          </a>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-3.5 py-2 text-xs font-bold shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Open Ticket</span>
          </button>
        </div>
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Total Active Tickets</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {tickets.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED").length}
          </div>
          <p className="text-[11px] text-ink-400 mt-0.5">Average SLA: 4.2 Hours</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">SEBI SCORES Escalations</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">0 Pending</div>
          <p className="text-[11px] text-emerald-300 mt-0.5">100% Resolved On-Time</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Resolution Rate</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {Math.round((tickets.filter((t) => t.status === "RESOLVED").length / Math.max(1, tickets.length)) * 100)}%
          </div>
          <p className="text-[11px] text-ink-400 mt-0.5">Customer satisfaction: 4.8/5</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0B121E] p-4">
          <span className="text-[10px] font-mono uppercase text-ink-400">Compliance Audit</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">Cleared</div>
          <p className="text-[11px] text-ink-400 mt-0.5">Audited by Principal Officer</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B121E] p-3 rounded-xl border border-[#1E293B]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by customer, ticket ID, or issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0E1624] border border-[#1E293B] rounded-lg text-xs text-white placeholder-ink-400 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {["ALL", "SUBSCRIPTION", "PAYMENT", "SEBI_SCORES", "ADVISORY", "TECHNICAL"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCat(cat)}
              className={cx(
                "px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase font-bold transition-colors cursor-pointer",
                filterCat === cat ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white bg-[#0E1624]"
              )}
            >
              {cat.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List Table */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Support Queue & Redressal Ledger ({filtered.length})
          </h2>
          <span className="text-[11px] font-mono text-emerald-400">Statutory 21-Day Redressal Enforced</span>
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
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
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
                    <span
                      className={cx(
                        "font-mono font-bold text-[10px] px-2 py-0.5 rounded border",
                        t.priority === "CRITICAL"
                          ? "bg-red-500/15 border-red-500/30 text-red-300"
                          : t.priority === "HIGH"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                          : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                      )}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-white font-medium">{t.assignedAgent}</td>
                  <td className="px-4 py-4 font-mono text-emerald-400">
                    {t.slaRemainingDays} of 21 Days Remaining
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={t.status === "RESOLVED" ? "positive" : t.status === "IN_PROGRESS" ? "warning" : "neutral"}>
                      {t.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleResolve(t.id)}
                      className={cx(
                        "rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer",
                        t.status === "RESOLVED"
                          ? "bg-[#0E1624] text-ink-400 hover:text-white border border-[#1E293B]"
                          : "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30"
                      )}
                    >
                      {t.status === "RESOLVED" ? "Reopen" : "Resolve"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-ink-400">
                    No tickets found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OPEN TICKET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#1E293B] bg-[#0B121E] p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div className="flex items-center gap-2">
                <LifeBuoy className="size-5 text-brand-400" />
                <h3 className="font-bold text-lg font-display">Open Customer Grievance / Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:text-white bg-[#0E1624] border border-[#1E293B] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Customer ID</label>
                  <input
                    type="text"
                    placeholder="e.g. ESC-2026-904"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="SUBSCRIPTION">Subscription & Renewals</option>
                    <option value="PAYMENT">Payment Reconciliation</option>
                    <option value="ADVISORY">Advisory Recommendation Query</option>
                    <option value="SEBI_SCORES">Statutory SEBI SCORES Complaint</option>
                    <option value="LOGIN">Terminal & App Access</option>
                    <option value="TECHNICAL">Technical Error</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-300 font-semibold mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="CRITICAL">Critical (SCORES / Legal)</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Issue / Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Delay in activation of Options Alpha Desk after UTR submission"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Assigned Support Officer</label>
                <select
                  value={assignedAgent}
                  onChange={(e) => setAssignedAgent(e.target.value)}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0E1624] p-2.5 text-white focus:border-brand-500 focus:outline-none cursor-pointer"
                >
                  <option value="Vikram Malhotra">Vikram Malhotra</option>
                  <option value="Rajeshwar Rao">Rajeshwar Rao (Principal Officer)</option>
                  <option value="Ananya Iyer">Ananya Iyer</option>
                  <option value="Rohit Sharma">Rohit Sharma</option>
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
                  Log Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
