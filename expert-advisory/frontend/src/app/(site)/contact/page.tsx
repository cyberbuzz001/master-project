import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/site/LeadForm";
import { PageHero, Section } from "@/components/site/PageHero";
import { Card } from "@/components/ui";
import { getSiteData } from "@/lib/api-server";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the Expert Stocks Consultancy team about research services, risk profiling and onboarding.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const site = await getSiteData();
  const contact = site.ok ? (site.data.settings.contact ?? {}) : {};

  const rows = [
    { icon: MessageCircle, label: "WhatsApp Desk", value: "Chat on WhatsApp (+91 92388 37041)", href: "https://wa.me/919238837041" },
    contact.email && { icon: Mail, label: "Email Support", value: contact.email, href: `mailto:${contact.email}` },
    contact.registered_address && { icon: MapPin, label: "Registered office", value: contact.registered_address },
    contact.branch_address && { icon: MapPin, label: "Operations Branch", value: contact.branch_address },
    contact.business_hours && { icon: Clock, label: "Operating Hours", value: contact.business_hours },
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; value: string; href?: string }>;

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to our team"
        lead="Tell us what you are looking for. We'll explain how research services, risk profiling and onboarding work — without pressure and without promises."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-6 sm:p-8">
            <LeadForm formKey="contact" consentText={site.ok ? site.data.consent_text : null} />
          </Card>
          <div className="space-y-5">
            {rows.length > 0 ? (
              <Card className="p-6">
                <ul className="space-y-4">
                  {rows.map((row) => (
                    <li key={row.label} className="flex gap-3">
                      <row.icon className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{row.label}</p>
                        {row.href ? (
                          <a href={row.href} className="text-sm font-medium text-ink-900 hover:text-brand-700" rel="noopener">
                            {row.value}
                          </a>
                        ) : (
                          <p className="text-sm text-ink-900">{row.value}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <Card className="p-6 text-sm leading-6 text-ink-600">Our contact details are being verified. Please use the form in the meantime.</Card>
            )}
            <Card className="p-6 text-sm leading-6 text-ink-600">
              Have a complaint? Please follow the{" "}
              <Link href="/legal/grievance-redressal" className="font-medium text-brand-700 underline underline-offset-2">
                grievance redressal process
              </Link>{" "}
              so it is recorded and tracked.
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
