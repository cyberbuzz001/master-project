import Link from "next/link";
import { getSiteData } from "@/lib/api-server";
import { FOOTER_NAV, LEGAL_PAGES, MARKET_RISK_NOTE, SITE } from "@/lib/site";
import { Container } from "../ui";
import { CookieSettingsLink } from "./CookieConsent";
import { Logo } from "./Logo";
import { TRUST_CONFIG } from "@/lib/trust-config";
import { Mail, Phone, MapPin, ShieldCheck } from "lucide-react";

export async function SiteFooter() {
  const site = await getSiteData();
  const settings = site.ok ? site.data.settings : {};
  const contact = settings.contact ?? {};

  const email = contact.email || "info@expertstocks.in";
  const phone = contact.phone || "+91 73894 87726";

  return (
    <footer className="mt-auto border-t border-[#1C2734] bg-[#05070B] text-[#9AA7B5]">
      {/* Upper 4-Column Layout */}
      <Container className="grid gap-10 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* Column 1: Brand & Positioning */}
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-xs sm:text-sm leading-relaxed text-[#9AA7B5]">
            {SITE.description}
          </p>

          <div className="mt-6 space-y-2.5 text-xs font-mono text-[#667383]">
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 text-[#43D9FF]" />
              <a href={`mailto:${email}`} className="text-[#9AA7B5] hover:text-[#F5F7FA]">
                {email}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 text-[#43D9FF]" />
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className="text-[#9AA7B5] hover:text-[#F5F7FA]">
                {phone}
              </a>
            </div>
            <div className="flex items-start gap-2 pt-1">
              <MapPin className="size-3.5 text-[#43D9FF] shrink-0 mt-0.5" />
              <span>Bengaluru, Karnataka, India</span>
            </div>
          </div>
        </div>

        {/* Column 2: Company */}
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#F5F7FA]">
            Company
          </p>
          <ul className="mt-4 space-y-2.5 text-xs">
            {FOOTER_NAV.Company.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-[#9AA7B5] hover:text-[#43D9FF] transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: Research & Markets */}
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#F5F7FA]">
            Research & Markets
          </p>
          <ul className="mt-4 space-y-2.5 text-xs">
            {FOOTER_NAV.Research.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-[#9AA7B5] hover:text-[#43D9FF] transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 4: Trust & Compliance */}
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#F5F7FA]">
            Trust & Compliance
          </p>
          <ul className="mt-4 space-y-2.5 text-xs">
            {FOOTER_NAV.Trust.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-[#9AA7B5] hover:text-[#43D9FF] transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={TRUST_CONFIG.grievanceOfficer.scoresUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9AA7B5] hover:text-[#43D9FF] transition-colors"
              >
                SEBI SCORES Portal ↗
              </a>
            </li>
          </ul>
        </div>
      </Container>

      {/* Prominent Mandatory Statutory Risk Disclosure Box */}
      <div className="border-t border-[#1C2734] bg-[#080D14]">
        <Container className="py-6 space-y-4">
          <div className="rounded-xl border border-[#F5B84B]/20 bg-[#111923] p-4 text-xs font-mono text-[#F5B84B] leading-relaxed">
            <span className="font-bold uppercase tracking-wider block mb-1">
              Mandatory Market Risk Disclosure:
            </span>
            {MARKET_RISK_NOTE}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-[#667383] pt-2">
            <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
              {LEGAL_PAGES.map((page) => (
                <Link
                  key={page.slug}
                  href={`/legal/${page.slug}`}
                  className="hover:text-[#F5F7FA] transition-colors"
                >
                  {page.label}
                </Link>
              ))}
              <CookieSettingsLink />
            </nav>

            <div className="text-[11px]">
              © {new Date().getFullYear()} {TRUST_CONFIG.entityName}. All rights reserved.
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
