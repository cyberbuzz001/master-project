import { Fingerprint, History, Lock, ServerCog, ShieldAlert, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Technology",
  description: "Security, traceability and data practices behind the Expert Stocks Consultancy platform.",
  alternates: { canonical: "/technology" },
};

const FEATURES = [
  { icon: History, title: "Immutable history", body: "Published research, approvals, consents and payments are append-only records with a full audit trail." },
  { icon: ShieldAlert, title: "Fail-closed publishing", body: "Missing or stale data, an incomplete approval or unverified compliance settings block publication." },
  { icon: Fingerprint, title: "Two-factor authentication", body: "Staff accounts require two-factor authentication. Every sign-in and sensitive action is logged." },
  { icon: Lock, title: "Least-privilege access", body: "Employees see only the records their role and team allow. Client documents are private and access is logged." },
  { icon: ServerCog, title: "Provider-independent AI", body: "AI providers can be switched without changing the research workflow, and every AI run is traceable." },
  { icon: Smartphone, title: "Mobile-first", body: "The client portal and staff workspace are designed for phones as well as desktops." },
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Technology"
        title="A platform designed for accountability"
        lead="The same system that produces research also records who did what, when, and based on which data."
      />
      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-6">
              <f.icon className="size-6 text-teal-600" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-ink-950">{f.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">{f.body}</p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
