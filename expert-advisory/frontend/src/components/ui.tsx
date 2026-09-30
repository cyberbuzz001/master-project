import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:translate-y-px disabled:bg-brand-200 disabled:text-white",
  secondary:
    "bg-white text-ink-900 ring-1 ring-inset ring-ink-200 hover:ring-ink-300 hover:bg-ink-50 active:translate-y-px disabled:text-ink-400",
  ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-400",
  danger: "bg-danger-600 text-white hover:bg-danger-700 active:translate-y-px disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-xl font-semibold transition-[background,box-shadow,color,transform] duration-150 disabled:cursor-not-allowed whitespace-nowrap";

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
  return <div className={cx("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-[var(--radius-card)] bg-white ring-1 ring-ink-200/70 shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  );
}

type Tone = "neutral" | "brand" | "teal" | "positive" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  brand: "bg-brand-50 text-brand-700",
  teal: "bg-teal-50 text-teal-700",
  positive: "bg-positive-50 text-positive-600",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}
      {...props}
    />
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-xs font-semibold uppercase tracking-[0.14em] text-teal-600", className)}>{children}</p>
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
    <div className={cx("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl text-balance">{title}</h2>
      {lead && <p className="mt-4 text-lg leading-8 text-ink-600 text-pretty">{lead}</p>}
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
    warning: "bg-warning-50 ring-warning-200 text-warning-700",
    brand: "bg-brand-50 ring-brand-100 text-brand-900",
    danger: "bg-danger-50 ring-danger-600/20 text-danger-700",
    neutral: "bg-ink-50 ring-ink-200 text-ink-700",
  } as const;

  return (
    <div role="note" className={cx("rounded-xl px-4 py-3 text-sm ring-1 ring-inset", tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={cx(title && "mt-1", "leading-6")}>{children}</div>
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
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-sm font-medium text-ink-800">
        {label}
        {optional && <span className="text-xs font-normal text-ink-500">Optional</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-ink-900 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none aria-[invalid=true]:ring-danger-600 transition-shadow";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "min-h-28", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "pr-8", className)} {...props} />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-300 bg-white/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-full bg-ink-100 text-ink-500">{icon}</div>}
      <p className="text-base font-semibold text-ink-900">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-sm leading-6 text-ink-600">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
