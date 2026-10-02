import type { PolicyData, PolicyLink, SiteData, TrustCenterData } from "./api-types";

export const FALLBACK_POLICIES_LINKS: PolicyLink[] = [
  { slug: "privacy-policy", title: "Privacy Policy", category: "legal" },
  { slug: "terms-of-use", title: "Terms of Use", category: "legal" },
  { slug: "disclaimer", title: "Disclaimer & Risk Policy", category: "disclosure" },
  { slug: "refund-policy", title: "Refund Policy", category: "legal" },
  { slug: "risk-disclosure", title: "Risk Disclosure", category: "disclosure" },
  { slug: "investor-charter", title: "Investor Charter", category: "regulatory" },
  { slug: "grievance-redressal", title: "Grievance Redressal Policy", category: "compliance" },
  { slug: "cookie-policy", title: "Cookie Policy", category: "legal" },
];

export const FALLBACK_SITE_DATA: SiteData = {
  settings: {
    company: {
      brand_name: "Expert Stocks Consultancy",
      legal_entity_name: "Expert Stocks Consultancy",
    },
    contact: {
      email: "info@expertstocks.in",
      phone: "+91 95896 15649",
      whatsapp: "+91 95896 15649",
      registered_address: "ITC Park, Belapur Station Complex, Sector-11, CBD Belapur, Navi Mumbai, Maharashtra 400614",
      branch_address: "Techno IT Park, Jabalpur, Madhya Pradesh 482001",
      business_hours: "Monday to Friday: 9:00 AM – 4:00 PM IST",
    },
  },
  policies: FALLBACK_POLICIES_LINKS,
  regulatory_profile_verified: true,
  consent_text: {
    data_processing:
      "I agree that Expert Stocks Consultancy may store and use the details I have submitted to respond to my enquiry, as described in the Privacy Policy.",
    calls: "I agree to receive phone calls from Expert Stocks Consultancy regarding my enquiry and services.",
    whatsapp: "I agree to receive WhatsApp communications and research updates from Expert Stocks Consultancy.",
    marketing_email: "I agree to receive research publications, market notes and educational updates by email.",
  },
};

export const FALLBACK_TRUST_CENTER: TrustCenterData = {
  verified: true,
  settings: FALLBACK_SITE_DATA.settings,
  policies: FALLBACK_POLICIES_LINKS,
  regulatory: {
    entity_type: "research_advisory",
    entity_type_label: "Research Advisory Desk",
    legal_entity_name: "Expert Stocks Consultancy",
    brand_name: "Expert Stocks Consultancy",
    research_status: "Active Research Advisory",
    registration_number: null,
    registration_date: "2024-01-15",
    registration_valid_until: "Active",
    ra_name: "Research Desk Lead",
    ra_contact_email: "info@expertstocks.in",
    principal_officer: "Principal Officer",
    compliance_officer: "Compliance Officer",
    grievance_officer: {
      name: "Grievance Officer",
      email: "support@expertstocks.in",
      phone: "+91 95896 15649",
    },
    partner_ra: null,
    public_statement:
      "Expert Stocks Consultancy provides research-driven, risk-aware market intelligence for Indian equities and derivatives. Every research report is subjected to dual-control analytical review before publication.",
    version: 1,
    verified_at: "2026-09-16T10:00:00Z",
    review_due_at: "2027-09-15T10:00:00Z",
  },
};

export const FALLBACK_POLICY_MAP: Record<string, PolicyData> = {
  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy Policy",
    version: 1,
    effective_from: "2026-01-01T00:00:00Z",
    published_at: "2026-01-01T00:00:00Z",
    content_hash: "sha256-privacy-v1",
    body_markdown: `# Privacy Policy

**Data Controller:** Expert Stocks Consultancy  
**Registered Office:** ITC Park, Belapur Station Complex, Sector-11, CBD Belapur, Navi Mumbai, Maharashtra 400614  
**Privacy & Grievance Contact:** info@expertstocks.in | support@expertstocks.in  

---

### 1. Information We Collect
We collect personal information necessary to deliver compliant stock market research and advisory communications:
- **Contact Details:** Full name, mobile telephone number, email address, and residential city.
- **Client Onboarding Data:** KYC verification documents (PAN card, government-issued identity and address proof), suitability questionnaires, risk-profiling scores, signed client service agreements, and payment invoice receipts.
- **Technical & Usage Records:** IP address, browser type, device information, and interaction records on our website and client portal.

---

### 2. Purpose of Data Processing
Your personal information is processed exclusively for lawful, regulatory, and operational objectives:
- To assess your investment experience, risk appetite, and financial horizon through mandatory suitability evaluations.
- To transmit authorized research publications, timely alerts, market commentaries, and administrative notices.
- To communicate via phone, SMS, email, or WhatsApp strictly based on your affirmative consent.
- To fulfill statutory compliance, audit trail maintenance, and SEBI regulatory record-keeping standards.

---

### 3. Consent and Your Rights
You retain complete authority over your personal information:
- **Right to Access & Rectify:** You may inspect your records and update inaccurate personal details at any time through the client portal or by emailing info@expertstocks.in.
- **Withdrawal of Consent:** You may withdraw marketing or channel-specific communications (such as WhatsApp or promotional calls) by adjusting your account preferences or contacting support.
- **Data Protection Inquiries:** Escalations regarding data handling may be lodged directly with our Grievance & Data Protection Officer at support@expertstocks.in.

---

### 4. Data Retention & Safeguards
Client KYC, transaction history, risk profiling questionnaires, and research transmission records are retained securely for a minimum statutory duration of 5 years in compliance with applicable Indian financial regulations. All records are protected using encryption in transit (TLS 1.3) and AES-256 encryption at rest.`,
  },

  "terms-of-use": {
    slug: "terms-of-use",
    title: "Terms of Use",
    version: 1,
    effective_from: "2026-01-01T00:00:00Z",
    published_at: "2026-01-01T00:00:00Z",
    content_hash: "sha256-terms-v1",
    body_markdown: `# Terms of Use

These Terms of Use govern your access to and use of the website, mobile services, and client portal operated by **Expert Stocks Consultancy**.

---

### 1. Acceptance of Terms
By accessing or using this website, you confirm that you are at least 18 years of age, legally competent to enter into binding agreements under the Indian Contract Act, 1872, and agree to abide by these Terms in full.

---

### 2. Nature of Services
- **Educational & Analytical Commentary:** All research, technical setups, chart patterns, and market commentaries published by Expert Stocks Consultancy are for analytical and informational purposes only.
- **No Guaranteed Returns:** We do NOT offer guaranteed profits, assured return schemes, portfolio management services (PMS), or profit-sharing arrangements.
- **Risk Assessment Prerequisite:** Access to specialized advisory tiers requires prior completion and acknowledgment of our structured Risk Assessment Questionnaire.

---

### 3. Intellectual Property Rights
All publications, indicator methodologies, chart graphics, written research notes, and portal designs are the proprietary intellectual property of Expert Stocks Consultancy. You are granted a personal, non-transferable, revocable license to view research for your own individual investing. Redistribution, scraping, reselling, or broadcasting our research to third parties or social channels is strictly prohibited.

---

### 4. Limitation of Liability
Trading and investing in Indian capital markets (NSE, BSE, MCX) involve inherent financial volatility. Expert Stocks Consultancy and its analysts expressly disclaim liability for any direct, indirect, incidental, or consequential capital drawdowns or financial losses incurred from actions taken based on published research.

---

### 5. Governing Law & Jurisdiction
These Terms are governed by and construed in accordance with the laws of the Republic of India. Any disputes arising hereunder shall be subject to the exclusive jurisdiction of the competent courts in Navi Mumbai / Mumbai, Maharashtra.`,
  },

  "refund-policy": {
    slug: "refund-policy",
    title: "Refund Policy",
    version: 1,
    effective_from: "2026-01-01T00:00:00Z",
    published_at: "2026-01-01T00:00:00Z",
    content_hash: "sha256-refund-v1",
    body_markdown: `# Refund & Cancellation Policy

Expert Stocks Consultancy maintains a transparent and straightforward refund policy across all research advisory subscriptions and plan tiers.

---

### 1. Pre-Activation Cancellation
- Clients are encouraged to review our published research methodology, sample reports, and statutory risk disclosures prior to making payments.
- If a payment has been remitted but your subscription has **not yet been activated** (i.e. KYC documents or Risk Profiling have not been finalized), you may request a cancellation within **48 hours** of payment.
- Approved pre-activation refunds are processed back to the original source bank account within 7 to 10 working days, subject to deduction of applicable payment gateway transaction processing fees.

---

### 2. Post-Activation Policy
- Once your subscription is activated and access to the Research Desk, live alert feeds, or client portal has been provisioned, **no refunds or chargebacks will be granted**.
- Research advisory involves real-time analytical output and intellectual property consumption that cannot be revoked once dispatched.
- Service periods cannot be paused, transferred, or exchanged for cash once active.

---

### 3. Inquiries & Dispute Resolution
For billing clarifications, payment receipt requests, or cancellation inquiries, please email **info@expertstocks.in** with your Transaction Reference ID and Client Code.`,
  },

  "risk-disclosure": {
    slug: "risk-disclosure",
    title: "Risk Disclosure",
    version: 1,
    effective_from: "2026-01-01T00:00:00Z",
    published_at: "2026-01-01T00:00:00Z",
    content_hash: "sha256-risk-v1",
    body_markdown: `# Statutory Risk Disclosure

Trading and investing in the Indian securities market involves substantial risk of capital loss. Prior to executing transactions or subscribing to research, you must thoroughly evaluate your financial situation.

---

### 1. Market Volatility & Capital Loss
- Security prices fluctuate continually based on macroeconomic conditions, corporate earnings, interest rates, and domestic or global geopolitical events.
- An investment can decline in value substantially. You should only commit risk capital that you can afford to lose without compromising your day-to-day liquidity or living standard.

---

### 2. Derivative Trading Risks (Futures & Options)
- **High Leverage:** Futures and options contracts require initial margin that represents only a fraction of the total notional contract value. While leverage magnifies gains, it equally magnifies downside losses.
- **Rapid Premium Decay:** Option buyers face time decay (*theta*), which accelerates as contracts approach weekly or monthly expiry. Out-of-the-money options can expire completely worthless, resulting in 100% loss of the premium paid.
- **SEBI Study Notice:** Per SEBI's published analytical study on individual investor behavior in the equity derivatives (F&O) segment:
  - 9 out of 10 individual traders in the equity F&O segment incurred net financial losses.
  - On average, loss-makers registered net trading losses close to ₹50,000 per year.
  - Active traders incurred an additional 15% to 28% of net trading losses in transactional and advisory overheads.

---

### 3. Stop-Loss & Slippage Limitations
Reference stop-loss levels and targets provided in research publications are directional analytical markers. During periods of extreme market volatility, gap openings, or diminished liquidity, exchange execution prices may differ materially from theoretical reference levels (slippage).`,
  },

  "investor-charter": {
    slug: "investor-charter",
    title: "Investor Charter",
    version: 1,
    effective_from: "2026-01-01T00:00:00Z",
    published_at: "2026-01-01T00:00:00Z",
    content_hash: "sha256-charter-v1",
    body_markdown: `# Investor Charter — Research Analyst Services

This Investor Charter outlines the mission, services, rights, and responsibilities of investors engaging with Research Analysts per SEBI guidelines.

---

### A. Vision and Mission of Research Analysts
- **Vision:** To protect investor interests and promote fair, transparent capital markets through objective and rigorous research.
- **Mission:** To maintain the highest standards of professional ethics, analytical diligence, and full disclosure of potential conflicts of interest.

---

### B. Details of Services Provided
1. Publishing data-driven, objective research reports on listed Indian equities, sectoral themes, and derivatives.
2. Formulating recommendations with transparent time horizons, entry rationales, invalidation conditions, and risk scenarios.
3. Conducting structured suitability analysis and risk assessment before onboarding clients to paid services.
4. Ensuring that all public statements, disclosures, and communications conform strictly to the SEBI (Research Analysts) Regulations, 2014.

---

### C. Rights of Investors
- Right to receive authentic, unbiased research reports that include mandatory disclosures regarding financial interests or affiliations.
- Right to be informed of all fee schedules, statutory levies, and terms of service in writing prior to subscription.
- Right to prompt resolution of grievances through our dedicated internal redressal framework.

---

### D. Do's and Don'ts for Investors
- **DO:** Verify the credentials and registration details of the Research Analyst on the official SEBI website before subscribing.
- **DO:** Complete your risk profile honestly and trade strictly within your designated risk appetite.
- **DO NOT:** Rely on rumors, unauthorized social media tips, or unverified WhatsApp groups.
- **DO NOT:** Pay subscription fees into personal employee accounts; always pay through authorized entity channels.
- **DO NOT:** Expect guaranteed or fixed returns from market investments.`,
  },

  "grievance-redressal": {
    slug: "grievance-redressal",
    title: "Grievance Redressal Policy",
    version: 1,
    effective_from: "2026-01-01T00:00:00Z",
    published_at: "2026-01-01T00:00:00Z",
    content_hash: "sha256-grievance-v1",
    body_markdown: `# Grievance Redressal & Escalation Policy

Expert Stocks Consultancy is committed to resolving client complaints and grievances in a prompt, transparent, and fair manner.

---

### Level 1: Client Support Desk
If you encounter an issue or have a concern regarding research delivery, billing, or portal access, please contact our support team first:
- **Email:** info@expertstocks.in
- **Telephone / WhatsApp:** +91 95896 15649
- **Operating Hours:** Monday to Friday, 9:00 AM to 4:00 PM IST
- **Turnaround Time:** Within 24 to 48 working hours.

---

### Level 2: Grievance Officer Escalation
If your concern remains unresolved after 3 business days or the resolution is unsatisfactory, you may escalate directly to our designated Grievance Officer:
- **Grievance Officer:** Grievance & Compliance Cell
- **Email:** support@expertstocks.in
- **Address:** ITC Park, Belapur Station Complex, Sector-11, CBD Belapur, Navi Mumbai, Maharashtra 400614
- **Resolution SLA:** All formal grievances are reviewed and resolved through our dedicated internal escalation framework.`,
  },

  "cookie-policy": {
    slug: "cookie-policy",
    title: "Cookie Policy",
    version: 1,
    effective_from: "2026-01-01T00:00:00Z",
    published_at: "2026-01-01T00:00:00Z",
    content_hash: "sha256-cookie-v1",
    body_markdown: `# Cookie Policy

This Cookie Policy explains how Expert Stocks Consultancy uses cookies and similar local storage technologies on our website and client portal.

---

### 1. Essential Cookies
These cookies are necessary for the basic operation of our platform:
- **Session Identification:** Maintains your secure sign-in status while navigating between client portal areas.
- **CSRF Protection:** Protects against Cross-Site Request Forgery attacks when submitting forms.
- **Consent Preferences:** Stores your cookie consent choices so you are not repeatedly prompted.

---

### 2. Analytical & Performance Cookies
With your affirmative consent, we utilize privacy-focused analytical cookies to understand how visitors engage with our educational resources, which pages receive high traffic, and how to improve site speed and responsiveness.

---

### 3. Managing Cookie Preferences
You can review or adjust your cookie preferences at any time by clicking the "Cookie Settings" link located in our website footer or by adjusting your browser privacy settings.`,
  },
};
