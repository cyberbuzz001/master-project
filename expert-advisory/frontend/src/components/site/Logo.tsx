import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1f56d6" />
      <path d="M8 21.5 13.2 16l3.6 3.4L24 11.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="11.5" r="2.2" fill="#5eead4" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg" aria-label="Expert Stocks Consultancy home">
      <LogoMark />
      <span className="leading-none">
        <span className="block text-[15px] font-bold tracking-tight text-ink-950">Expert Stocks</span>
        <span className="block text-[11px] font-medium tracking-wide text-ink-500">CONSULTANCY</span>
      </span>
    </Link>
  );
}
