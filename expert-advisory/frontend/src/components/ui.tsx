import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[#43D9FF] text-[#05070B] font-semibold hover:bg-[#33c9ef] hover:-translate-y-0.5 active:translate-y-0 shadow-[0_0_20px_rgba(67,217,255,0.2)] disabled:opacity-50 disabled:pointer-events-none",
  secondary:
    "bg-[#111923] text-[#F5F7FA] border border-[#1C2734] hover:border-[#283749] hover:bg-[#162130] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none",
  ghost:
    "bg-transparent text-[#9AA7B5] hover:text-[#F5F7FA] hover:bg-[#111923]/60 disabled:opacity-50 disabled:pointer-events-none",
  danger:
    "bg-[#F05252]/10 text-[#F05252] border border-[#F05252]/30 hover:bg-[#F05252]/20 active:translate-y-0 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm font-semibold gap-2.5",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cx(BUTTON_BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(BUTTON_BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("mx-auto w-full max-w-[1280px] px-4 sm:px-8", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("glass-card p-6 text-[#F5F7FA]", className)}
      {...props}
    />
  );
}

type Tone = "neutral" | "brand" | "cyan" | "violet" | "teal" | "positive" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-[#111923] border border-[#1C2734] text-[#9AA7B5]",
  brand: "bg-[#43D9FF]/10 border border-[#43D9FF]/30 text-[#43D9FF]",
  cyan: "bg-[#43D9FF]/10 border border-[#43D9FF]/30 text-[#43D9FF]",
  violet: "bg-[#7C5CFF]/10 border border-[#7C5CFF]/30 text-[#7C5CFF]",
  teal: "bg-[#43D9FF]/10 border border-[#43D9FF]/30 text-[#43D9FF]",
  positive: "bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E]",
  warning: "bg-[#F5B84B]/10 border border-[#F5B84B]/30 text-[#F5B84B]",
  danger: "bg-[#F05252]/10 border border-[#F05252]/30 text-[#F05252]",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-mono", TONES[tone], className)}
      {...props}
    />
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-xs font-semibold uppercase tracking-[0.16em] text-[#43D9FF]", className)}>{children}</p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cx("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F5F7FA] text-balance font-display">{title}</h2>
      {lead && <p className="mt-4 text-base sm:text-lg leading-relaxed text-[#9AA7B5] text-pretty">{lead}</p>}
    </div>
  );
}

export function Notice({
  tone = "warning",
  title,
  children,
  className,
}: {
  tone?: "warning" | "brand" | "danger" | "neutral";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    warning: "bg-[#F5B84B]/10 border border-[#F5B84B]/30 text-[#F5B84B]",
    brand: "bg-[#43D9FF]/10 border border-[#43D9FF]/30 text-[#43D9FF]",
    danger: "bg-[#F05252]/10 border border-[#F05252]/30 text-[#F05252]",
    neutral: "bg-[#111923] border border-[#1C2734] text-[#9AA7B5]",
  };

  return (
    <div role="note" className={cx("rounded-xl p-4 sm:p-5", tones[tone], className)}>
      {title && <h4 className="font-semibold text-sm mb-1 text-[#F5F7FA]">{title}</h4>}
      <div className="text-xs sm:text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  optional,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-sm font-medium text-[#F5F7FA]">
        {label}
        {optional && <span className="text-xs font-normal text-[#667383]">Optional</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-[#9AA7B5]">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs font-medium text-[#F05252]">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-xl border border-[#1C2734] bg-[#080D14] px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder-[#667383] focus:border-[#43D9FF] focus:outline-none focus:ring-1 focus:ring-[#43D9FF] aria-[invalid=true]:border-[#F05252] transition-colors font-sans";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "min-h-28", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "pr-8", className)} {...props} />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#1C2734] bg-[#0D131C] px-6 py-12 text-center text-[#F5F7FA]">
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-full bg-[#111923] text-[#43D9FF]">{icon}</div>}
      <p className="text-base font-semibold text-[#F5F7FA]">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-sm leading-6 text-[#9AA7B5]">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
