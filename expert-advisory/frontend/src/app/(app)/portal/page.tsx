"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/app/AuthProvider";
import { PageTitle } from "@/components/app/AppShell";
import { humanize, useApiGet } from "@/components/app/hooks";
import { ApiErrorView, ModulesPanel, Spinner } from "@/components/app/widgets";
import { Badge, Card } from "@/components/ui";
import type { ModuleStatus } from "@/lib/api-types";

type ClientDashboard = {
  client: { client_code: string; full_name: string; onboarding_status: string; relationship_manager: string | null } | null;
  notices: { key: string; title: string; body: string }[];
  modules: ModuleStatus[];
};

export default function PortalPage() {
  const { me } = useAuth();
  const dashboard = useApiGet<ClientDashboard>("/client/dashboard");

  if (dashboard.loading && !dashboard.data) return <Spinner />;
  if (dashboard.error) return <ApiErrorView error={dashboard.error} />;
  if (!dashboard.data) return null;
  const { client, notices, modules } = dashboard.data;

  return (
    <>
      <PageTitle title={`Welcome, ${me.name.split(" ")[0]}`} description="Your account overview." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold text-ink-900">Your account</p>
            {client ? (
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink-500">Client ID</dt>
                  <dd className="mt-0.5 font-mono text-sm text-ink-900">{client.client_code}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Onboarding</dt>
                  <dd className="mt-0.5"><Badge tone="brand">{humanize(client.onboarding_status.toLowerCase())}</Badge></dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Relationship manager</dt>
                  <dd className="mt-0.5 text-sm text-ink-900">{client.relationship_manager ?? "To be assigned"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-ink-600">Your client record is being set up. Our team will contact you to complete onboarding.</p>
            )}
          </Card>
          {notices.map((notice) => (
            <Card key={notice.key} className="flex gap-3 p-5">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink-900">{notice.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink-600">{notice.body}</p>
                <Link href="/legal/risk-disclosure" className="mt-2 inline-block text-sm font-semibold text-brand-700">Read the risk disclosure →</Link>
              </div>
            </Card>
          ))}
        </div>
        <ModulesPanel modules={modules} />
      </div>
    </>
  );
}
