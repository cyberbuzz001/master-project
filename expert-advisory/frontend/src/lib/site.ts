export const SITE = {
  name: "Expert Stocks Consultancy",
  shortName: "Expert Stocks",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Research-driven, risk-aware market intelligence for Indian equity and derivatives markets, with a transparent methodology and human-reviewed research.",
};

export const PRIMARY_NAV = [
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Plans & Pricing" },
  { href: "/research", label: "Research" },
  { href: "/testimonials", label: "Portfolio & Reviews" },
  { href: "/trust-center", label: "Trust Center" },
] as const;

export const FOOTER_NAV = {
  Company: [
    { href: "/about", label: "About" },
    { href: "/technology", label: "Technology" },
    { href: "/pricing", label: "Plans" },
    { href: "/contact", label: "Contact" },
  ],
  Research: [
    { href: "/research", label: "Research archive" },
    { href: "/market-insights", label: "Market insights" },
    { href: "/methodology", label: "How our research works" },
    { href: "/blog", label: "Blog" },
  ],
  Support: [
    { href: "/faq", label: "FAQ" },
    { href: "/testimonials", label: "Testimonials & Portfolio" },
    { href: "/trust-center", label: "Trust Center" },
    { href: "/login", label: "Client & staff login" },
  ],
} as const;

/** Legal pages that always appear in the footer; each renders the published version or a "being reviewed" notice. */
export const LEGAL_PAGES = [
  { slug: "privacy-policy", label: "Privacy" },
  { slug: "terms-of-use", label: "Terms" },
  { slug: "disclaimer", label: "Disclaimer" },
  { slug: "refund-policy", label: "Refund policy" },
  { slug: "risk-disclosure", label: "Risk disclosure" },
  { slug: "investor-charter", label: "Investor charter" },
  { slug: "grievance-redressal", label: "Grievance redressal" },
  { slug: "cookie-policy", label: "Cookies" },
] as const;

export const MARKET_RISK_NOTE =
  "Investments in the securities market are subject to market risks. Read all related documents carefully before investing. Research does not guarantee returns, and past performance does not indicate future results.";
