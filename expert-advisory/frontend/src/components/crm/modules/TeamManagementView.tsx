"use client";

import React, { useState } from "react";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  Lock,
  UserCheck,
  Award,
  TrendingUp,
  Percent,
} from "lucide-react";
import { Badge, cx } from "@/components/ui";
import { CRM_USERS, CrmUser, CrmRole } from "@/lib/crm-data";

const ROLES_INFO: Array<{ role: CrmRole; name: string; scope: string; accessLevel: string }> = [
  { role: "super_admin", name: "Super Admin", scope: "Unrestricted enterprise access across all data and configuration", accessLevel: "Level 1 (Root)" },
  { role: "management", name: "Management / Executive", scope: "Executive cockpit, CAC, revenue analytics, team audit", accessLevel: "Level 2 (Executive)" },
  { role: "sales_manager", name: "Sales Manager", scope: "Floor lead distribution, telecaller queues, call coaching", accessLevel: "Level 3 (Manager)" },
  { role: "sales_agent", name: "Sales Telecaller", scope: "Assigned leads only, CTI dialer, objection playbooks", accessLevel: "Level 4 (Agent)" },
  { role: "advisor", name: "Research Analyst (RA)", scope: "Advisory creation, dual-sign workflow, research feed", accessLevel: "Level 4 (Advisory)" },
  { role: "relationship_manager", name: "Relationship Manager (RM)", scope: "Customer 360, renewal cadences, portfolio review", accessLevel: "Level 4 (RM)" },
  { role: "support_agent", name: "Support Specialist", scope: "Support ticketing desk, SLA redressal, SCORES verification", accessLevel: "Level 4 (Support)" },
  { role: "finance", name: "Finance & Accounts", scope: "Invoicing, GST SAC 997159 ledger, wire verification", accessLevel: "Level 3 (Finance)" },
  { role: "compliance", name: "Compliance Officer", scope: "Immutable audit logs, prohibited phrase audit, SEBI SCORES", accessLevel: "Level 2 (Compliance)" },
];

export function TeamManagementView() {
  const [activeTab, setActiveTab] = useState<"team" | "rbac">("team");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Team Management & 9-Persona RBAC Governance
            </h1>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 border border-emerald-500/20">
              SEBI CHINESE WALL ENFORCED
            </span>
          </div>
          <p className="text-xs text-ink-300 mt-1">
            Separation of duties between sales telecallers, research analysts, and compliance officers.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0E1624] p-1 rounded-xl border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={cx(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "team" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            Staff Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rbac")}
            className={cx(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "rbac" ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"
            )}
          >
            9-Role RBAC Matrix
          </button>
        </div>
      </div>

      {activeTab === "team" ? (
        <div className="rounded-2xl border border-[#1E293B] bg-[#090E17] overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#1E293B] bg-[#0E1624] flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Staff Productivity & Conversion Matrix
            </h2>
            <span className="text-[11px] font-mono text-ink-400">Total Active Staff: {CRM_USERS.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B121E] border-b border-[#1E293B] text-[11px] font-mono uppercase text-ink-400">
                <tr>
                  <th className="px-5 py-3.5">Employee Name & Email</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Leads Handled</th>
                  <th className="px-4 py-3.5">Conversion Win Rate</th>
                  <th className="px-4 py-3.5">Revenue MTD</th>
                  <th className="px-5 py-3.5 text-right">Est. Commission (10%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-ink-200">
                {CRM_USERS.map((user) => (
                  <tr key={user.id} className="hover:bg-[#0E1624]/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{user.name}</div>
                      <span className="font-mono text-[11px] text-ink-400">{user.email}</span>
                    </td>
                    <td className="px-4 py-4 text-white font-medium">{user.department}</td>
                    <td className="px-4 py-4">
                      <span className="rounded bg-[#162235] text-brand-300 font-mono text-[10px] font-bold px-2 py-0.5 border border-[#23354E]">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-white">{user.leadsHandled}</td>
                    <td className="px-4 py-4 font-mono text-emerald-400 font-bold">
                      {user.conversionRate > 0 ? `${user.conversionRate}%` : "N/A (Non-Sales)"}
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-white">
                      ₹{user.revenueThisMonth.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-emerald-400 font-bold">
                      ₹{Math.floor(user.revenueThisMonth * 0.1).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* RBAC MATRIX */
        <div className="grid gap-3 sm:grid-cols-3">
          {ROLES_INFO.map((r) => (
            <div
              key={r.role}
              className="rounded-2xl border border-[#1E293B] bg-[#090E17] p-5 space-y-2.5 shadow-xl hover:border-brand-500/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="rounded bg-brand-500/15 text-brand-300 text-[10px] font-mono font-bold px-2 py-0.5">
                  {r.accessLevel}
                </span>
                <ShieldCheck className="size-4 text-emerald-400" />
              </div>
              <h3 className="font-bold text-sm text-white">{r.name}</h3>
              <p className="text-xs text-ink-300 leading-relaxed">{r.scope}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
