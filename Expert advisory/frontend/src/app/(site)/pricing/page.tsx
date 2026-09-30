import type { Metadata } from "next";
import { PageHero, Section } from "@/components/site/PageHero";
import { Card, LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Plans",
  description: "How research plans work at Expert Stocks Consultancy: risk profiling first, clear invoices, and service activation only after verification.",
  alternates: { canonical: "/pricing" },
};

const STEPS = [
  ["Risk profile", "Complete the assessment so plan options match your profile."],
  ["Plan selection", "Plans list the segments covered, duration, research access and price including taxes."],
  ["Agreement & KYC", "Review and accept the client agreement and required disclosures; upload required documents."],
  ["Invoice & payment", "Receive a numbered invoice. Payment is confirmed only after verification with the payment provider."],
  ["Activation", "Your service starts once payment, documents and agreements are verified — you'll receive confirmation."],
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Plans"
        title="Clear plans, verified activation"
        lead="Published plans and prices will be listed here once configured. Until then, our team can explain the options that fit your risk profile."
      >
        <LinkButton href="/contact">Ask about plans</LinkButton>
      </PageHero>
      <Section>
        <h2 className="text-2xl font-bold tracking-tight text-ink-950">From enquiry to activation</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {STEPS.map(([title, body], index) => (
            <li key={title}>
              <Card className="h-full p-5">
                <span className="grid size-8 place-items-center rounded-full bg-brand-600 font-mono text-sm text-white">{index + 1}</span>
                <p className="mt-4 text-sm font-semibold text-ink-900">{title}</p>
                <p className="mt-1.5 text-sm leading-6 text-ink-600">{body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
