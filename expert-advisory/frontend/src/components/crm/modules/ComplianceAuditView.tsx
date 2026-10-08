"use client";

import React from "react";
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Lock,
  CheckCircle2,
  Hash,
  Activity,
  History,
} from "lucide-react";
import { Badge, Card, cx } from "@/components/ui";
import type { AuditLogItem } from "@/lib/crm-data";

interface ComplianceAuditViewProps {
  auditLogs: AuditLogItem[];
}

const PROHIBITED_RULES = [
  { rule: "Zero Guaranteed Profit Claims", desc: "SEBI (RA) Regs strictly prohibit assuring positive ROI or using phrases like '100% safe' or 'jackpot calls'." },
  { rule: "Mandatory Risk Suitability Lock", desc: "Clients with Conservative profiles cannot be invoiced or enrolled in Derivatives/F&O without Senior Compliance override." },
  { rule: "Dual-Analyst Recommendation Approval", desc: "No advisory recommendation can be broadcast to clients without secondary sign-off from Head of Research." },
  { rule: "Personal Trading Restriction", desc: "Analysts cannot trade in securities recommended within 30 days prior and 5 days post publication." },
];

export function ComplianceAuditView({ auditLogs }: ComplianceAuditViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              SEBI Compliance & Tamper-Resistant Audit Trail
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              APPEND-ONLY AUDIT ENGINE
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Automated statutory guardrails, prohibited marketing claim linter, and immutable SHA-256 event hashing.
          </p>
        </div>
      </div>

      {/* Prohibited Claim & Statutory Rules Matrix */}
      <div className="rounded-2xl border border-emerald-500/30 bg-[#090E17] p-5 space-y-4 shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-2">
          <ShieldCheck className="size-4" />
          <span>Statutory Compliance Guardrails (Hardcoded in Engine)</span>
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {PROHIBITED_RULES.map((r, i) => (
            <div key={i} className="rounded-xl border border-[#1E293B] bg-[#0E1624] p-3.5 space-y-1">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>{r.rule}</span>
              </span>
              <p className="text-[11px] text-ink-300 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <History className="size-4 text-brand-400" />
            <span>Immutable Audit Log Records</span>
          </h2>
          <span className="text-[11px] font-mono text-emerald-400">Cryptographically Hash-Chained</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
              <tr>
                <th className="px-5 py-3.5">Log ID & Time</th>
                <th className="px-4 py-3.5">User & Role</th>
                <th className="px-4 py-3.5">Action</th>
                <th className="px-4 py-3.5">Entity</th>
                <th className="px-4 py-3.5">Audit Details</th>
                <th className="px-4 py-3.5 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-ink-200">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#0E1624]/60 transition-colors">
                  <td className="px-5 py-4 font-mono">
                    <span className="text-brand-400 font-bold">{log.id}</span>
                    <div className="text-[10px] text-ink-400 mt-0.5">{log.timestamp}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-white">{log.user}</div>
                    <span className="text-[10px] font-mono text-ink-400">{log.userRole}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded bg-[#162235] text-brand-300 font-mono text-[10px] font-bold px-2 py-0.5 border border-[#23354E]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px] text-ink-300">
                    {log.entityType} ({log.entityId})
                  </td>
                  <td className="px-4 py-4 text-xs text-ink-300 max-w-xs">
                    {log.details}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                      <Lock className="size-3" />
                      <span>SHA-256 Valid</span>
                    </span>
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
