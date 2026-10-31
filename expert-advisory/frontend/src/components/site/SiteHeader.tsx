"use client";

import { Menu, X, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PRIMARY_NAV } from "@/lib/site";
import { cx, LinkButton } from "../ui";
import { Logo } from "./Logo";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      aria-label="Expert Stocks site header"
      className={cx(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "bg-[#05070B]/85 backdrop-blur-[20px] border-b border-[#1C2734] shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[#43D9FF] focus:text-[#05070B] focus:px-3 focus:py-1.5 focus:font-semibold"
      >
        Skip to content
      </a>

      <div
        className={cx(
          "mx-auto flex max-w-[1280px] items-center justify-between px-4 sm:px-8 transition-all duration-300",
          scrolled ? "h-16 lg:h-[68px]" : "h-20 lg:h-[88px]",
        )}
      >
        <Logo />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1.5">
            {PRIMARY_NAV.map((item) => {
              const isAnchor = item.href.includes("#");
              const active = !isAnchor && (pathname === item.href || pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-150 relative",
                      active
                        ? "text-[#43D9FF] bg-[#43D9FF]/10"
                        : "text-[#9AA7B5] hover:text-[#F5F7FA] hover:bg-[#111923]/60",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LinkButton href="/login" variant="secondary" size="sm">
            Client Login
          </LinkButton>
          <LinkButton href="/contact" variant="primary" size="sm">
            Talk to Expert
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </LinkButton>
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-lg border border-[#1C2734] bg-[#0D131C] text-[#F5F7FA] hover:border-[#283749] lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43D9FF]"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-[68px] z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobile-nav"
            aria-label="Mobile Navigation"
            className="relative z-50 border-b border-[#1C2734] bg-[#05070B] px-5 pb-6 pt-3 shadow-[0_18px_30px_rgba(0,0,0,0.35)] lg:hidden"
          >
            <ul className="flex flex-col space-y-1">
              {PRIMARY_NAV.map((item) => {
                const isAnchor = item.href.includes("#");
                const active = !isAnchor && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex min-h-11 items-center justify-between rounded-lg px-3 text-base font-medium transition-colors",
                        active
                          ? "bg-[#43D9FF]/10 text-[#43D9FF]"
                          : "text-[#F5F7FA] hover:bg-[#111923] hover:text-[#43D9FF]",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      <span>{item.label}</span>
                      {active && <span className="size-1.5 rounded-full bg-[#43D9FF]" aria-hidden="true" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#1C2734] pt-4">
              <LinkButton href="/login" variant="secondary" size="md" className="w-full" onClick={() => setOpen(false)}>
                Client Login
              </LinkButton>
              <LinkButton href="/contact" variant="primary" size="md" className="w-full" onClick={() => setOpen(false)}>
                Talk to Expert
              </LinkButton>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
