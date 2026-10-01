import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section } from "@/components/site/PageHero";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about research, risk profiling, plans, payments, data privacy and complaints.",
  alternates: { canonical: "/faq" },
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Do you guarantee profits or accuracy?",
    a: "No. Markets are uncertain and research can be wrong. We do not promise returns, accuracy rates or protection from loss, and you should be cautious of anyone who does.",
  },
  {
    q: "Is Expert Stocks Consultancy registered with SEBI?",
    a: "Our regulatory details — the legal entity, registration category and number, and the people responsible for research — are published in the Trust Center once verified. Please rely only on the details shown there.",
  },
  {
    q: "Why do I need a risk assessment first?",
    a: "Research should match your experience, horizon and ability to bear losses. The assessment records this before any service starts, and research access is matched to your profile.",
  },
  {
    q: "Does AI write your research?",
    a: "AI assists with summarizing and drafting. It does not calculate core figures, decide what is published or send research to clients. Every report is reviewed and approved by an authorized person.",
  },
  {
    q: "When does my service start after payment?",
    a: "After the payment is verified with the payment provider and your required documents and agreements are complete. You receive a confirmation when your service is activated.",
  },
  {
    q: "How is my personal data used?",
    a: "Only for the purposes you agree to, as described in the Privacy Policy. Marketing messages are sent only with your consent, and you can withdraw it at any time.",
  },
  {
    q: "How do I raise a complaint?",
    a: "Use the grievance redressal process, which lists the contacts, response timelines and escalation steps.",
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" />
      <Section>
        <div className="mx-auto max-w-3xl divide-y divide-[#1C2734] rounded-2xl bg-[#0D131C] border border-[#1C2734]">
          {FAQS.map((item) => (
            <details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[#F5F7FA]">
                {item.q}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#111923] text-[#43D9FF] transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-7 text-[#9AA7B5]">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-sm text-[#9AA7B5]">
          More questions? <Link href="/contact" className="font-medium text-brand-700 underline underline-offset-2">Contact our team</Link> or read the{" "}
          <Link href="/legal/grievance-redressal" className="font-medium text-brand-700 underline underline-offset-2">grievance process</Link>.
        </p>
      </Section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
