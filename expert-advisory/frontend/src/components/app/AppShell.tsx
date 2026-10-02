"use client";

import { ClipboardCheck, KeyRound, LayoutDashboard, LifeBuoy, LineChart, LogOut, Menu, ReceiptIndianRupee, ShieldCheck, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogoMark } from "../site/Logo";
import { Badge, cx } from "../ui";
import { useAuth } from "./AuthProvider";
import { useChanged } from "./hooks";
import { ApiErrorView } from "./widgets";

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: string; anyOf?: string[] };

const NAV: Record<"portal" | "office", { title: string; items: NavItem[] }> = {
  portal: {
    title: "Client portal",
    items: [
      { href: "/portal", label: "Overview", icon: LayoutDashboard, permission: "portal.access" },
      { href: "/portal/research", label: "Research desk", icon: LineChart, permission: "portal.access" },
      { href: "/portal/onboarding", label: "Onboarding", icon: ClipboardCheck, permission: "portal.access" },
      { href: "/portal/billing", label: "Services & billing", icon: ReceiptIndianRupee, permission: "portal.access" },
      { href: "/portal/support", label: "Support & Grievance", icon: LifeBuoy, permission: "portal.access" },
    ],
  },
  office: {
    title: "Staff Back-Office",
    items: [
      { href: "/office", label: "Executive Desk", icon: LayoutDashboard },
      { href: "/portal", label: "Client Portal View", icon: LineChart },
    ],
  },
};

export function AppShell({ area, children }: { area: keyof typeof NAV; children: ReactNode }) {
  const { me, can, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (useChanged(pathname) && open) setOpen(false);

  const allowedAreas = {
    portal: me.areas.includes("portal") || me.user_type === "staff",
    office: me.user_type === "staff" || me.areas.includes("office") || me.roles.some((r) => r.name === "admin" || r.name === "super_admin"),
  };

  const items = NAV[area].items.filter((item) => (item.permission ? can(item.permission) : item.anyOf ? item.anyOf.some(can) : true));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <LogoMark className="size-7" />
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Expert Stocks</p>
          <p className="text-[11px] text-ink-400">{NAV[area].title}</p>
        </div>
      </div>
      <nav aria-label={NAV[area].title} className="flex-1 space-y-0.5 px-3 py-4">
        {items.map((item) => {
          const active = item.href === `/${area}` ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-ink-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <div className="my-4 border-t border-white/10" />
        <Link
          href="/account/security"
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/account") ? "bg-white/10 text-white" : "text-ink-300 hover:bg-white/5 hover:text-white",
          )}
        >
          <KeyRound className="size-4" aria-hidden="true" /> Account security
        </Link>
        {me.user_type === "staff" && (
          <a href="/office" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-300 hover:bg-white/5 hover:text-white">
            <LayoutDashboard className="size-4" aria-hidden="true" /> Back-office (CRM)
          </a>
        )}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{me.name}</p>
        <p className="truncate text-xs text-ink-400">{me.roles.map((r) => r.label).join(", ") || me.email}</p>
        <button type="button" onClick={() => void logout()} className="mt-3 flex items-center gap-2 text-sm text-ink-300 hover:text-white">
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50 lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden bg-ink-950 lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-ink-950/50" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink-950 animate-rise">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 text-ink-300" aria-label="Close navigation">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ink-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg hover:bg-ink-100" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <p className="text-sm font-semibold">{NAV[area].title}</p>
          <span className="size-9" />
        </header>
        {me.demo_mode && (
          <div className="border-b border-warning-200 bg-warning-50 px-4 py-2 text-center text-xs font-medium text-warning-700">
            Demo mode is on — records marked [DEMO] are sample data and are excluded from analytics.
          </div>
        )}
        {me.two_factor.required && !me.two_factor.verified_this_session && me.two_factor.enabled && (
          <div className="border-b border-warning-200 bg-warning-50 px-4 py-2 text-center text-xs text-warning-700">
            <ShieldCheck className="mr-1 inline size-3.5" aria-hidden="true" /> Sign out and back in with your authenticator to access protected areas.
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {allowedAreas[area] ? children : <ApiErrorView code="FORBIDDEN" message="Your role does not include access to this area." />}
        </main>
      </div>
    </div>
  );
}

export function PageTitle({ title, description, actions, badge }: { title: string; description?: string; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-ink-950">
          {title} {badge}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export { Badge };
