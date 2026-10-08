"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Layers,
  Sparkles,
  PhoneCall,
  MessageSquare,
  Clock,
  Calendar,
  ReceiptIndianRupee,
  CreditCard,
  LineChart,
  Briefcase,
  RotateCw,
  HeartHandshake,
  Megaphone,
  Share2,
  LifeBuoy,
  BarChart3,
  Brain,
  ShieldCheck,
  Settings,
  History,
  Command,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Flame,
} from "lucide-react";
import { cx } from "@/components/ui";
import {
  CrmModuleId,
  CrmRole,
  CRM_USERS,
  INITIAL_LEADS,
  INITIAL_CUSTOMERS,
  INITIAL_TIMELINE,
  INITIAL_RECOMMENDATIONS,
  INITIAL_TASKS,
  INITIAL_PAYMENTS,
  INITIAL_CALL_LOGS,
  INITIAL_AUDIT_LOGS,
  CrmLead,
  Customer360,
  LeadStatus,
  AdvisoryRecommendation,
} from "@/lib/crm-data";

// Sub-modules
import { ExecutiveDashboard } from "./modules/ExecutiveDashboard";
import { LeadManagement } from "./modules/LeadManagement";
import { SalesPipelineKanban } from "./modules/SalesPipelineKanban";
import { Customer360View } from "./modules/Customer360View";
import { AiSalesAssistantView } from "./modules/AiSalesAssistantView";
import { CallingDeskView } from "./modules/CallingDeskView";
import { WhatsAppCrmView } from "./modules/WhatsAppCrmView";
import { SubscriptionsRenewalsView } from "./modules/SubscriptionsRenewalsView";
import { PaymentsInvoicingView } from "./modules/PaymentsInvoicingView";
import { AdvisoryRecommendationsView } from "./modules/AdvisoryRecommendationsView";
import { AiManagementAssistantView } from "./modules/AiManagementAssistantView";
import { ComplianceAuditView } from "./modules/ComplianceAuditView";
import { AutomationBuilderView } from "./modules/AutomationBuilderView";
import { TasksAppointmentsView } from "./modules/TasksAppointmentsView";
import { CampaignsReferralsView } from "./modules/CampaignsReferralsView";
import { SupportTicketingView } from "./modules/SupportTicketingView";
import { ReportsAnalyticsView } from "./modules/ReportsAnalyticsView";
import { TeamManagementView } from "./modules/TeamManagementView";

// Command & Briefing Modals
import { CrmCommandPalette } from "./CrmCommandPalette";
import { CrmDailyBriefingModal } from "./CrmDailyBriefingModal";
import { TelecallerWorkbench } from "@/components/app/TelecallerWorkbench";

const MODULE_GROUPS: Array<{
  group: string;
  items: Array<{ id: CrmModuleId; label: string; icon: any }>;
}> = [
  {
    group: "Overview & Intelligence",
    items: [
      { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
      { id: "ai_intelligence", label: "AI Management Copilot", icon: Brain },
      { id: "ai_assistant", label: "AI Sales Assistant", icon: Sparkles },
    ],
  },
  {
    group: "Sales & Client Lifecycle",
    items: [
      { id: "leads", label: "Lead Management", icon: Users },
      { id: "pipeline", label: "12-Stage Sales Pipeline", icon: Layers },
      { id: "customers", label: "Customer 360° Profiles", icon: UserCheck },
      { id: "calling", label: "Telecalling CTI Desk", icon: PhoneCall },
      { id: "whatsapp", label: "WhatsApp CRM", icon: MessageSquare },
      { id: "tasks", label: "Tasks & Follow-ups", icon: Clock },
      { id: "appointments", label: "Consultation Appointments", icon: Calendar },
    ],
  },
  {
    group: "Subscriptions & Billing",
    items: [
      { id: "subscriptions", label: "Advisory Subscriptions", icon: ReceiptIndianRupee },
      { id: "renewals", label: "Renewal Countdown Desk", icon: RotateCw },
      { id: "payments", label: "Payments & GST Invoicing", icon: CreditCard },
      { id: "retention", label: "Customer Retention & Churn", icon: HeartHandshake },
    ],
  },
  {
    group: "Research & Advisory",
    items: [
      { id: "advisory", label: "Research Desk & Calls", icon: LineChart },
      { id: "recommendations", label: "Advisory Distribution", icon: LineChart },
      { id: "portfolio", label: "Client Portfolio Risk", icon: Briefcase },
    ],
  },
  {
    group: "Growth & Client Care",
    items: [
      { id: "campaigns", label: "Campaigns & Marketing", icon: Megaphone },
      { id: "referrals", label: "Referral Engine", icon: Share2 },
      { id: "support", label: "Support & Grievances", icon: LifeBuoy },
      { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
    ],
  },
  {
    group: "Governance & Operations",
    items: [
      { id: "team", label: "Automation Builder", icon: Settings },
      { id: "compliance", label: "SEBI Compliance Audit", icon: ShieldCheck },
      { id: "audit_logs", label: "Immutable Audit Logs", icon: History },
      { id: "settings", label: "System Settings & RBAC", icon: Settings },
    ],
  },
];

export function CrmMasterView() {
  const [activeModule, setActiveModule] = useState<CrmModuleId>("dashboard");
  const [currentRole, setCurrentRole] = useState<CrmRole>("super_admin");
  const [leads, setLeads] = useState<CrmLead[]>(INITIAL_LEADS);
  const [customers, setCustomers] = useState<Customer360[]>(INITIAL_CUSTOMERS);
  const [timeline, setTimeline] = useState(INITIAL_TIMELINE);
  const [recommendations, setRecommendations] = useState(INITIAL_RECOMMENDATIONS);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [payments, setPayments] = useState(INITIAL_PAYMENTS);
  const [callLogs, setCallLogs] = useState(INITIAL_CALL_LOGS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);

  // Modals state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [workbenchLead, setWorkbenchLead] = useState<CrmLead | null>(null);
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Keyboard shortcut: Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleWorkLead = (lead: CrmLead) => {
    setWorkbenchLead(lead);
    setShowWorkbench(true);
  };

  const handleUpdateLeadStatus = (leadId: string, status: LeadStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status, updatedAt: "Today, Just now" } : l))
    );
  };

  const handleAssignLead = (leadId: string, agentName: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, assignedAgent: agentName } : l))
    );
  };

  const handleCreateRecommendation = (newRec: AdvisoryRecommendation) => {
    setRecommendations((prev) => [newRec, ...prev]);
  };

  const handleCompleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleVerifyPayment = (paymentId: string) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: "SUCCESSFUL", complianceApproved: true } : p))
    );
  };

  const currentUser = CRM_USERS.find((u) => u.role === currentRole) || CRM_USERS[0];

  return (
    <div className="flex h-screen bg-[#05070B] text-[#F5F7FA] overflow-hidden antialiased">
      {/* SIDEBAR NAVIGATION (24 Modules) */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 w-64 bg-[#090E17] border-r border-[#1E293B] flex flex-col transition-transform lg:static lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-[#1E293B]">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center font-bold text-white font-mono shadow-md">
              ES
            </div>
            <div>
              <h2 className="text-sm font-bold font-display text-white tracking-wide">
                ExpertStocks CRM
              </h2>
              <span className="text-[10px] font-mono text-brand-400 block -mt-0.5">
                AI ADVISORY PLATFORM
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-ink-400 p-1"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 24 Modules Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
          {MODULE_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-ink-400 font-bold px-2.5 block tracking-wider">
                {grp.group}
              </span>
              <div className="space-y-0.5 pt-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveModule(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={cx(
                        "w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer text-left",
                        active
                          ? "bg-brand-600 text-white font-bold shadow-sm"
                          : "text-ink-300 hover:text-white hover:bg-[#121B2B]"
                      )}
                    >
                      <Icon className={cx("size-4 shrink-0", active ? "text-white" : "text-ink-400")} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer & Persona Switcher */}
        <div className="p-3 border-t border-[#1E293B] bg-[#070B12]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-ink-400 uppercase">Active Persona:</span>
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as CrmRole)}
              className="rounded bg-[#121B2B] text-brand-300 text-[10px] font-mono px-2 py-0.5 border border-[#1E293B] focus:outline-none cursor-pointer"
            >
              <option value="super_admin">Super Admin</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="sales_agent">Sales Agent</option>
              <option value="advisor">Research Analyst</option>
              <option value="relationship_manager">Relationship Manager</option>
              <option value="compliance">Compliance Officer</option>
            </select>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-brand-700 flex items-center justify-center font-bold text-xs text-white">
              {currentUser.name.charAt(0)}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] text-ink-400 truncate">{currentUser.department}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP COMMAND BAR */}
        <header className="h-16 border-b border-[#1E293B] bg-[#090E17]/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-ink-300 hover:text-white"
            >
              <Menu className="size-5" />
            </button>

            {/* Ctrl + K Command Button */}
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#0E1624] px-4 py-2 text-xs text-ink-400 hover:text-white hover:border-brand-500/50 transition-all cursor-pointer shadow-xs w-64 sm:w-80"
            >
              <Search className="size-3.5 text-brand-400" />
              <span className="truncate">Search leads, customers, calls...</span>
              <kbd className="ml-auto rounded bg-[#162235] px-1.5 py-0.5 font-mono text-[10px] text-ink-300 border border-[#23354E]">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Daily Briefing Button */}
            <button
              type="button"
              onClick={() => setShowBriefingModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Sparkles className="size-3.5" />
              <span className="hidden sm:inline">Daily AI Briefing</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                className="size-9 rounded-xl border border-[#1E293B] bg-[#0E1624] flex items-center justify-center text-ink-300 hover:text-white transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="size-4" />
              </button>
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 animate-pulse" />
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT ROUTER */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#05070B] scrollbar-thin">
          {activeModule === "dashboard" && (
            <ExecutiveDashboard
              leads={leads}
              customers={customers}
              payments={payments}
              users={CRM_USERS}
              onNavigateModule={setActiveModule}
              onFilterFunnel={() => setActiveModule("pipeline")}
            />
          )}

          {activeModule === "leads" && (
            <LeadManagement
              leads={leads}
              users={CRM_USERS}
              onWorkLead={handleWorkLead}
              onUpdateLeadStatus={handleUpdateLeadStatus}
              onAssignLead={handleAssignLead}
            />
          )}

          {activeModule === "pipeline" && (
            <SalesPipelineKanban
              leads={leads}
              onWorkLead={handleWorkLead}
              onUpdateLeadStatus={handleUpdateLeadStatus}
            />
          )}

          {activeModule === "customers" && (
            <Customer360View
              customers={customers}
              timeline={timeline}
              payments={payments}
              recommendations={recommendations}
              onInitiateCall={(c) => {
                const asLead = leads.find((l) => l.mobile === c.mobile) || leads[0];
                handleWorkLead(asLead);
              }}
            />
          )}

          {activeModule === "ai_assistant" && (
            <AiSalesAssistantView
              leads={leads}
              callLogs={callLogs}
              onWorkLead={handleWorkLead}
            />
          )}

          {activeModule === "calling" && (
            <CallingDeskView
              leads={leads}
              callLogs={callLogs}
              onWorkLead={handleWorkLead}
            />
          )}

          {activeModule === "whatsapp" && (
            <WhatsAppCrmView leads={leads} />
          )}

          {(activeModule === "subscriptions" || activeModule === "renewals" || activeModule === "retention") && (
            <SubscriptionsRenewalsView
              customers={customers}
              onInitiateRenewalCall={(c) => {
                const asLead = leads.find((l) => l.mobile === c.mobile) || leads[0];
                handleWorkLead(asLead);
              }}
            />
          )}

          {(activeModule === "advisory" || activeModule === "recommendations" || activeModule === "portfolio") && (
            <AdvisoryRecommendationsView
              recommendations={recommendations}
              onCreateRecommendation={handleCreateRecommendation}
            />
          )}

          {activeModule === "payments" && (
            <PaymentsInvoicingView
              payments={payments}
              onVerifyPayment={handleVerifyPayment}
            />
          )}

          {(activeModule === "tasks" || activeModule === "appointments") && (
            <TasksAppointmentsView
              tasks={tasks}
              onCompleteTask={handleCompleteTask}
            />
          )}

          {activeModule === "ai_intelligence" && (
            <AiManagementAssistantView />
          )}

          {(activeModule === "compliance" || activeModule === "audit_logs") && (
            <ComplianceAuditView auditLogs={auditLogs} />
          )}

          {(activeModule === "campaigns" || activeModule === "referrals") && (
            <CampaignsReferralsView />
          )}

          {activeModule === "support" && (
            <SupportTicketingView />
          )}

          {activeModule === "reports" && (
            <ReportsAnalyticsView />
          )}

          {activeModule === "team" && (
            <TeamManagementView />
          )}

          {activeModule === "settings" && (
            <AutomationBuilderView />
          )}
        </main>
      </div>

      {/* GLOBAL MODALS */}
      <CrmCommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigateModule={setActiveModule}
        onSelectLead={handleWorkLead}
        leads={leads}
        customers={customers}
        recommendations={recommendations}
      />

      <CrmDailyBriefingModal
        isOpen={showBriefingModal}
        onClose={() => setShowBriefingModal(false)}
        onWorkLead={handleWorkLead}
        leads={leads}
        customers={customers}
        tasks={tasks}
        userName={currentUser.name}
      />

      <TelecallerWorkbench
        lead={workbenchLead as any}
        isOpen={showWorkbench}
        onClose={() => setShowWorkbench(false)}
        onLeadUpdated={(updated: any) => {
          setLeads((prev) =>
            prev.map((l) =>
              l.id === updated.id
                ? {
                    ...l,
                    ...updated,
                    status: (updated.status ? updated.status.toUpperCase() : l.status) as LeadStatus,
                  }
                : l
            )
          );
        }}
        operatorName={currentUser.name}
      />
    </div>
  );
}
