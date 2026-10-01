import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0D131C" stroke="#1C2734" strokeWidth="1.5" />
      {/* Precision grid lines */}
      <line x1="8" y1="16" x2="24" y2="16" stroke="#1C2734" strokeWidth="1" strokeDasharray="2 2" />
      <line x1="16" y1="8" x2="16" y2="24" stroke="#1C2734" strokeWidth="1" strokeDasharray="2 2" />
      {/* Dynamic quantitative price vector */}
      <path
        d="M8 21L13.5 15.5L17.5 19.5L24 10.5"
        stroke="#43D9FF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Precision node point */}
      <circle cx="24" cy="10.5" r="2.2" fill="#7C5CFF" stroke="#43D9FF" strokeWidth="1" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43D9FF]"
      aria-label="Expert Stocks Consultancy home"
    >
      <div className="transition-transform duration-200 group-hover:scale-105">
        <LogoMark className="size-8.5" />
      </div>
      <div className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-[#F5F7FA] font-display group-hover:text-[#43D9FF] transition-colors">
          EXPERT STOCKS
        </span>
        <span className="block text-[10px] font-medium tracking-[0.16em] text-[#9AA7B5] font-mono">
          CONSULTANCY
        </span>
      </div>
    </Link>
  );
}
