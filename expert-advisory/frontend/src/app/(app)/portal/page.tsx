"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, ClipboardCheck, CreditCard, LifeBuoy, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/app/AuthProvider";
import { PageTitle } from "@/components/app/AppShell";
import { formatDate, humanize, useApiGet } from "@/components/app/hooks";
import { ApiErrorView, Spinner, StatusBadge } from "@/components/app/widgets";
import { Card } from "@/components/ui";

type Dashboard = {
  client: { client_code: string; full_name: string; onboarding_status: string; relationship_manager: string | null } | null;
  notices: { key: string; title: string; body: string }[];
  trials?: { trial_code: string; trial_type: string; status: string; start_date: string; end_date: string; review_meeting_date: string | null }[];
};
type Billing = { subscriptions: { uuid: string; service: string | null; plan: string | null; status: string; starts_on: string | null; ends_on: string | null }[] };
type Research = { active_subscription: boolean; message?: string; reports: { uuid: string; title: string; summary: string | null; published_at: string | null }[] };

const shortcuts = [
  { href: "/portal/onboarding", label: "Onboarding & documents", description: "Complete your checklist and review your documents.", icon: ClipboardCheck },
  { href: "/portal/risk-profile", label: "Risk profile", description: "Review and acknowledge your assessed risk profile.", icon: ShieldCheck },
  { href: "/portal/billing", label: "Plans & invoices", description: "View your service dates, invoices and verified payments.", icon: CreditCard },
  { href: "/portal/support", label: "Support", description: "Ask a question or follow up on an existing ticket.", icon: LifeBuoy },
];

export default function PortalPage() {
  const { me } = useAuth();
  const dashboard = useApiGet<Dashboard>("/client/dashboard");
  const billing = useApiGet<Billing>("/client/billing");
  const research = useApiGet<Research>("/client/research");

  if (dashboard.loading && !dashboard.data) return <Spinner label="Loading your account" />;
  if (dashboard.error) return <ApiErrorView error={dashboard.error} />;
  if (!dashboard.data) return null;
  const { client, notices, trials = [] } = dashboard.data;

  return (
    <div className="space-y-6">
      <PageTitle title={`Welcome, ${me.name}`} description="Your advisory services, research and account updates." />
      {!client && <Card className="p-5"><p>Your client profile has not been linked yet. Please contact support.</p></Card>}
      {client && <Card className="grid gap-5 border-white/10 bg-[#0B111A] p-6 text-white sm:grid-cols-3">
        <div><p className="text-xs text-slate-400">Client reference</p><p className="mt-2 font-mono">{client.client_code}</p></div>
        <div><p className="mb-2 text-xs text-slate-400">Onboarding</p><StatusBadge status={client.onboarding_status} /></div>
        <div><p className="text-xs text-slate-400">Relationship manager</p><p className="mt-2">{client.relationship_manager || "Not assigned yet"}</p></div>
      </Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{shortcuts.map(item => <Link key={item.href} href={item.href} className="group rounded-xl border border-white/10 bg-[#0B111A] p-5 transition-colors hover:border-cyan-400/50">
        <item.icon className="mb-4 size-5 text-cyan-300" /><h2 className="flex items-center justify-between text-sm font-semibold text-white">{item.label}<ArrowUpRight className="size-4 text-slate-400" /></h2><p className="mt-2 text-sm text-slate-400">{item.description}</p>
      </Link>)}</div>
      {trials.length > 0 && <section aria-labelledby="trials-title"><h2 id="trials-title" className="mb-3 text-lg font-semibold">Your trials</h2><div className="grid gap-3 sm:grid-cols-2">{trials.map(trial => <Card key={trial.trial_code} className="border-white/10 bg-[#0B111A] p-5 text-white"><div className="flex items-center justify-between"><h3>{humanize(trial.trial_type)}</h3><StatusBadge status={trial.status} /></div><p className="mt-3 text-sm text-slate-400">{formatDate(trial.start_date)} – {formatDate(trial.end_date)}</p>{trial.review_meeting_date && <p className="mt-1 text-sm text-slate-400">Review: {formatDate(trial.review_meeting_date)}</p>}</Card>)}</div></section>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="services-title"><h2 id="services-title" className="mb-3 text-lg font-semibold">Your services</h2>
          {billing.loading && <Spinner label="Loading services" />}{billing.error && <ApiErrorView error={billing.error} />}
          {billing.data && <div className="space-y-3">{billing.data.subscriptions.length === 0 && <Card className="p-5 text-slate-400">No advisory subscription is recorded for your account.</Card>}{billing.data.subscriptions.map(sub => <Card key={sub.uuid} className="border-white/10 bg-[#0B111A] p-5 text-white"><div className="flex items-center justify-between gap-3"><h3 className="font-medium">{sub.plan || sub.service || "Advisory service"}</h3><StatusBadge status={sub.status} /></div><p className="mt-3 text-sm text-slate-400">Starts {formatDate(sub.starts_on)} · Ends {sub.ends_on ? formatDate(sub.ends_on) : "No end date recorded"}</p></Card>)}</div>}
        </section>
        <section aria-labelledby="research-title"><div className="mb-3 flex items-center justify-between"><h2 id="research-title" className="text-lg font-semibold">Research updates</h2><Link href="/portal/research" className="text-sm text-cyan-300">Open research desk</Link></div>
          {research.loading && <Spinner label="Loading research" />}{research.error && <ApiErrorView error={research.error} />}
          {research.data && <div className="space-y-3">{research.data.reports.length === 0 && <Card className="p-5 text-slate-400">{research.data.message || "No published research is currently available for your account."}</Card>}{research.data.reports.slice(0, 5).map(report => <Card key={report.uuid} className="border-white/10 bg-[#0B111A] p-5 text-white"><div className="flex items-start gap-3"><BookOpen className="mt-1 size-4 shrink-0 text-cyan-300" /><div><h3 className="font-medium">{report.title}</h3>{report.summary && <p className="mt-2 text-sm text-slate-400">{report.summary}</p>}<p className="mt-2 text-xs text-slate-400">Published {formatDate(report.published_at)}</p></div></div></Card>)}</div>}
        </section>
      </div>
      {notices.map(notice => <Card key={notice.key} className="border-amber-400/20 bg-amber-400/5 p-5"><h2 className="text-sm font-semibold text-amber-200">{notice.title}</h2><p className="mt-2 text-sm text-slate-300">{notice.body}</p></Card>)}
    </div>
  );
}
