import type { ReactNode } from "react";
import { Container, Eyebrow } from "../ui";

export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50/70 via-white to-white">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden="true" />
      <Container className="relative py-14 sm:py-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl text-balance animate-rise">{title}</h1>
        {lead && <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-600 text-pretty">{lead}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  );
}

export function Section({ children, className = "", tone = "plain" }: { children: ReactNode; className?: string; tone?: "plain" | "muted" }) {
  return (
    <section className={`${tone === "muted" ? "bg-ink-50" : "bg-white"} py-16 sm:py-20 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}
