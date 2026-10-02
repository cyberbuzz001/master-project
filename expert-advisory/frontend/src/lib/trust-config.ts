/**
 * Centralized Trust Center & Regulatory Configuration
 *
 * DO NOT hardcode unverified SEBI registration numbers or statutory claims.
 * All compliance disclosures, regulatory statements, documents, and grievance
 * contacts are centralized here so verified details can be updated without
 * redesigning application templates.
 */

export interface RegulatoryConfig {
  entityName: string;
  brandName: string;
  tagline: string;
  registrationStatus: "VERIFICATION_PENDING" | "REGISTERED" | "DISCLOSED";
  registrationNumber: string | null;
  complianceOfficer: {
    name: string;
    designation: string;
    email: string;
    phone: string;
    address: string;
  };
  grievanceOfficer: {
    name: string;
    designation: string;
    email: string;
    phone: string;
    escalationTimeline: string;
  };
  statutoryNotice: string;
  advisoryDisclaimer: string;
  documents: Array<{
    id: string;
    title: string;
    version: string;
    publishedDate: string;
    lastUpdated: string;
    summary: string;
    href: string;
    category: "Methodology" | "Regulatory" | "Disclosures" | "Grievance";
  }>;
}

export const TRUST_CONFIG: RegulatoryConfig = {
  entityName: "Expert Stocks Consultancy Services",
  brandName: "Expert Stocks",
  tagline: "Market Intelligence, Engineered.",
  registrationStatus: "DISCLOSED",
  registrationNumber: null,
  complianceOfficer: {
    name: "Designated Compliance Desk",
    designation: "Head of Regulatory Oversight & Quality",
    email: "support@expertstocks.in",
    phone: "+91 95896 15649",
    address: "Expert Stocks Consultancy, ITC Park, Sector-11, CBD Belapur, Navi Mumbai, Maharashtra 400614",
  },
  grievanceOfficer: {
    name: "Investor Grievance Redressal Cell",
    designation: "Principal Grievance Officer",
    email: "support@expertstocks.in",
    phone: "+91 95896 15649",
    escalationTimeline: "Formal written acknowledgment within 24 hours through our dedicated internal grievance cell.",
  },
  statutoryNotice:
    "Investments in securities market are subject to market risks. Read all related documents carefully before investing.",
  advisoryDisclaimer:
    "Expert Stocks Consultancy provides research-driven market intelligence, quantitative analytics and structured educational resources for Indian equity and derivative markets. All research publications are based on publicly available data, technical price structure and fundamental analysis, accompanied by explicit invalidation levels and risk parameters. Research views do not constitute guaranteed return promises, PMS services or discretionary portfolio management. Past performance does not guarantee future results.",
  documents: [
    {
      id: "methodology-doc-v2",
      title: "Quantitative Research & Technical Methodology",
      version: "v2.4.1",
      publishedDate: "2026-01-15",
      lastUpdated: "2026-09-20",
      summary:
        "Deterministic framework combining multi-timeframe price action, volatility bands, liquidity sweeps, and balance-sheet solvency ratios.",
      href: "/methodology",
      category: "Methodology",
    },
    {
      id: "regulatory-framework-v1",
      title: "Regulatory Standards & Conflict of Interest Policy",
      version: "v1.8.0",
      publishedDate: "2026-02-01",
      lastUpdated: "2026-09-15",
      summary:
        "Statutory compliance boundaries, personal trading blackout windows for analysts (T-30 to T+5), and third-party fee disclosures.",
      href: "/trust-center",
      category: "Regulatory",
    },
    {
      id: "risk-disclosure-v3",
      title: "Derivatives & Market Risk Warning Document",
      version: "v3.1.0",
      publishedDate: "2026-03-10",
      lastUpdated: "2026-09-28",
      summary:
        "Detailed warning on leverage risk, options theta decay, overnight gap risk, and SEBI mandate on 9 out of 10 individual traders incurring net losses in F&O.",
      href: "/legal/risk-disclosure",
      category: "Disclosures",
    },
    {
      id: "grievance-charter-v1",
      title: "Investor Charter & Grievance Redressal Matrix",
      version: "v1.2.0",
      publishedDate: "2026-01-10",
      lastUpdated: "2026-09-10",
      summary:
        "Step-by-step internal escalation hierarchy from front-desk customer support to dedicated Compliance and Grievance Officers.",
      href: "/legal/grievance-redressal",
      category: "Grievance",
    },
  ],
};
