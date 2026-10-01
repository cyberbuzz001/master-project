import type { ReactNode } from "react";
import { Container, Eyebrow } from "../ui";

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-[#1C2734] bg-[#05070B] py-16 sm:py-24">
      {/* Background Tech Pattern */}
      <div
        className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-25 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 size-96 -translate-x-1/2 rounded-full bg-[#43D9FF]/5 blur-[120px]"
        aria-hidden="true"
      />

      <Container className="relative z-10">
        <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
        <h1 className="max-w-3xl text-3xl sm:text-5xl font-bold tracking-tight text-[#F5F7FA] font-display text-balance">
          {title}
        </h1>
        {lead && (
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-[#9AA7B5] text-pretty">
            {lead}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  );
}

export function Section({
  children,
  className = "",
  tone = "plain",
}: {
  children: ReactNode;
  className?: string;
  tone?: "plain" | "muted";
}) {
  return (
    <section
      className={`${
        tone === "muted" ? "bg-[#080D14]" : "bg-[#05070B]"
      } py-16 sm:py-24 border-b border-[#1C2734] text-[#F5F7FA] ${className}`}
    >
      <Container>{children}</Container>
    </section>
  );
}
