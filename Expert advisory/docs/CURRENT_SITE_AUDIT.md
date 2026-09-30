# Current Site Audit — expertstocks.in

| | |
|---|---|
| Audit date | 2026-09-16 |
| Audited URL | https://expertstocks.in (live, public pages only) |
| Method | Rendered pages in a browser, extracted text/DOM/meta, fetched `robots.txt`, `sitemap.xml`, response headers |
| Platform detected | Hostinger Website Builder (`generator` meta, `assets.zyrosite.com` CDN, `hcdn` server) |
| Scope limits | No authenticated areas exist. Forms were **not** submitted. Client-chat images were viewed only to classify them. |

> Quoted phrases below are kept short and are used only to identify claims that need legal review. They are not recommended copy.

---

## 1. Page inventory

| # | URL | `<title>` | In nav | In sitemap | Notes |
|---|---|---|---|---|---|
| 1 | `/` | "Golden Expert Consultancy - Real Stock Ideas for NSE, BSE, NFO, MCX, NCDEX \| Expert Consultancy : SEBI Registered Company" | Yes | Yes | Hero, stats, 1 testimonial, WhatsApp-screenshot carousel, contact form |
| 2 | `/about-us` | "About Us \| Expert Consultancy : SEBI Registered Company" | Yes | Yes | Long-form about, "technical analyst" section, stats, mission, vision |
| 3 | `/services` | "Expert Equity & Option Consultancy for India \| …" | Yes | Yes | Generic service tiles, 2 testimonials |
| 4 | `/research` | "Golden Consultancy Services for Equity and Option Trading \| …" | Yes | Yes | Two near-duplicate blog posts dated 5/8/2024 |
| 5 | `/contact` | "Golden Expert Consultancy Contact Information \| …" | Yes | Yes | Addresses, phone, email, hours, form |
| 6 | `/disclaimer` | "Important Disclaimer for Financial Trading Decisions \| …" | Yes | Yes | All-caps generic disclaimer + **not-registered statement** |
| 7 | `/policy` | "Golden Consultancy No-Refund Policy for Services \| …" | Yes | Yes | Free trial + no-refund policy, form |
| 8 | `/testimonials-and-portfolio` | "Invest in Customized HNI Wealth Generator Strategy \| …" | Yes | Yes | "HNI Wealth Generator" product, "Verified PNL" button, testimonial |
| 9–10 | `/expert-stocks-consultancy-service-providing-…-worldwide` (×2) | Blog posts | No | Yes | Thin, duplicated content |
| 11–18 | `/classic-cap-hpeszv`, `/face-serum-gxrcld`, `/handmade-vase-slowpy`, `/hand-soap-giguos`, `/set-of-plates-cxlzwx`, `/sunglasses-iubjnq`, `/wooden-chair-mopukh`, `/wool-sweater-lortoo` | e.g. "Classic Cap \| Expert Consultancy : SEBI Registered Company" | No | **Yes** | **Leftover e-commerce template products, live (HTTP 200) and indexed** |

Missing pages expected for a research business: Privacy Policy, Terms of Use, Risk Disclosure, Investor Charter, Grievance/complaints process, Research methodology, Disclosures (conflict of interest, RA details), Pricing, FAQ, Login.

## 2. Business information found

| Item | Value as published | Status |
|---|---|---|
| Brand names used | "Expert Stocks Consultancy", "Expert Consultancy", "Golden Expert Consultancy", "Golden Consultancy", "Golden Investment" (image watermark), "a branch of Real Stock Ideas" | **Inconsistent — 5 names** |
| Legal entity | Not stated anywhere | **Unknown** |
| SEBI registration number | Not stated anywhere | **Unknown** |
| GSTIN / CIN | Not stated | Unknown |
| Email | info@expertstocks.in (also "Info@expertstocks.in") | Usable after confirmation |
| Phone / WhatsApp | +91 73894 87726 (formatted inconsistently as "+9173894 87726") | Usable after confirmation |
| Registered address | ITC Park, Belapur Station Complex, Sector-11, CBD Belapur, Navi Mumbai | Needs verification against legal entity records |
| Branch address | Techno IT Park, Jabalpur, Madhya Pradesh | Needs verification |
| Hours | Mon–Fri 9am–4pm | Usable |
| Social links | facebook.com/, instagram.com/, tiktok.com/, twitter.com/ (bare homepages) | **Broken placeholders**; TikTok is not available in India |
| Logo | `expert-AoPWDBVo54IDvE22.png` (alt text contains "SEBI Registered Company") | Reuse the mark only; fix alt text |
| Footer credits | Refrens invoicing/accounting links | Unrelated third-party links |

## 3. Claims inventory (requires verification or removal)

Severity: **Critical** = possible misrepresentation of regulatory status / return promise; **High** = unsubstantiated performance or suitability claim; **Medium** = vague/unsupported marketing.

| # | Claim (short quote) | Where | Severity | Issue |
|---|---|---|---|---|
| C1 | "SEBI Registered Research Analyst Equity and Derivative Advisory Company" | Header banner on every page, WhatsApp pre-fill text | **Critical** | No registration number or legal entity shown; contradicted by C2 |
| C2 | "is not a SEBI Certified Research entity" … "tied up with SEBI Certified Research Analyst" | `/disclaimer` (last paragraph) | **Critical** | Directly contradicts C1, C3, C5, C6. Partner RA is not named |
| C3 | "Expert Consultancy : SEBI Registered Company" | Site name in every `<title>`, `og:site_name`, logo alt text | **Critical** | Same as C1; propagated to search results and social shares |
| C4 | "Registration granted by SEBI, membership of BASL and certification from NISM…" | Footer, all pages | **Critical** | Standard RA footer that implies the site owner holds SEBI registration and BASL membership |
| C5 | "SEBI-registered research services" (free trial) | `/policy` | **Critical** | Same as C1 |
| C6 | "Investment Advisor" (mission section) | `/about-us` | **Critical** | Investment Adviser is a separate SEBI registration category |
| C7 | "portfolio management", "portfolio managers" | `/about-us` | **Critical** | Portfolio management is a separately regulated activity |
| C8 | "mutual funds, investment planning" | `/about-us` | High | Distribution/planning are separately regulated activities |
| C9 | "95%+" (twice) and "Accurate Predictions Made" | `/`, `/about-us` | **Critical** | Accuracy claim; no methodology, period, or audit |
| C10 | "150+ … Accurate Predictions", "650+ Trusted by clients" | `/`, `/about-us` | High | Unverified counts |
| C11 | "consistent results", "Great results on consistent basis" | `/`, `/services`, testimonials | **Critical** | Implies consistent returns |
| C12 | "help them get good returns over years", "achieve optimal returns", "maximize returns/gains" | `/about-us`, `/testimonials-and-portfolio` | **Critical** | Return promise language |
| C13 | "protect clients investment" | `/about-us` | High | Implies capital protection |
| C14 | "Extract alpha", "HNI Wealth Generator", capital "INR 25 L to 1 Cr", "non-discretionary absolute momentum strategy" | `/testimonials-and-portfolio` | **Critical** | Reads as a managed/portfolio product for HNIs; strategy and capital mandate need regulatory basis |
| C15 | "Check Our Verified PNL" (button has no link) | `/testimonials-and-portfolio` | **Critical** | "Verified" P&L with no verifier, no data, dead button |
| C16 | 25+ WhatsApp chat screenshots (watermark "Golden Investment") | `/` carousel | **Critical** | Unverifiable client chats/P&L screenshots; possible third-party personal data; reads as performance advertising |
| C17 | Named testimonials (Keshav Kumar, Neha Jain, Aman Sharma, Aman Aggrawal) with 5 stars and stock photos | `/`, `/services`, `/testimonials-and-portfolio` | High | No evidence of authenticity; avatar is an Unsplash stock photo |
| C18 | "25+ YEARS EXPERIENCE" | `/about-us` | High | Analyst not named; unverifiable |
| C19 | "one of the fastest-growing stock advisory firms in India" | `/about-us` | High | Unsourced ranking claim; "advisory" wording |
| C20 | "real-time market updates, personalized dashboards, and secure transactions" | `/about-us` | Medium | Features do not exist on the current site |
| C21 | "Personalized Services", "Customized Trading Plans… based on individual risk appetite" | `/`, `/about-us` | High | Personalized advice requires the correct registration and a risk-profiling process |
| C22 | "Providing … globally" / "Worldwide" | `/`, `/research` | Medium | Inconsistent with India-only markets |
| C23 | Coverage of "MCX and NCDEX" commodities | `/`, `/research`, titles | Medium | Must match the actual registration/segment scope |
| C24 | "Trial Satisfaction Guarantee" + "strict no-refund policy" | `/policy` | High | Conflicting framing; refund terms need legal review |
| C25 | "Personalized coaching, webinars, seminars, trading community", "Expert Mentorship" | `/services` | Medium | No evidence these services exist |
| C26 | Disclaimer mentions "FOREX, CFDS … CRYPTOCURRENCIES" | `/disclaimer` | Medium | Boilerplate for products not offered; CFDs/forex are not permitted retail products in India |
| C27 | "research being circulated on its APP" | `/disclaimer` | Medium | No app exists |

### Key contradiction (L)

The site presents itself as a **SEBI Registered Research Analyst** (C1, C3, C4, C5) while its own disclaimer says it is **not** a SEBI-certified research entity and instead works with an unnamed SEBI-registered RA (C2). It also uses Investment Adviser and portfolio-management language (C6, C7, C14) that belong to different registration categories. **None of these representations can be carried into the new platform until the legal entity, registration category, registration number and any partner RA relationship are verified.** The new platform handles this through a versioned `regulatory_profile` (see `COMPLIANCE_RISK_MATRIX.md`) and refuses to publish regulated content while that profile is unverified.

## 4. Forms and CTAs

| Location | Fields | Behaviour observed | Issues |
|---|---|---|---|
| `/` Contact Us | Name, Mobile Number*, Email*, Message* | `<form method="get">` with **no `name` attributes**; submission handled by builder JS | No consent checkbox, no privacy link, no source/UTM capture, no confirmation of where data goes |
| `/contact` | Email*, Message*, Mobile Number* | Same builder form | Same |
| `/policy` | First Name, Email*, Message* | Same builder form | Same; no mobile field |
| CTAs | "Explore" (no destination), "Learn" (no destination), "Check Our Verified PNL" (no destination), floating WhatsApp button | Dead buttons | 3 dead CTAs; WhatsApp pre-fill repeats C1 |

## 5. Compliance language present

- Footer market-risk line (standard RA wording; see C4).
- All-caps generic disclaimer (includes forex/CFD/crypto boilerplate and an attempted blanket liability exclusion).
- "Not a SEBI certified research entity" statement (C2).
- No-refund policy with a one-day free trial.
- Cookie banner with Accept/Decline.

Absent: registration details, RA name/qualification, research methodology, conflict-of-interest disclosure, investor charter, grievance redressal process and escalation levels, privacy policy, terms of use, risk-profiling disclosure, data-protection notice.

## 6. SEO metadata

| Item | Finding |
|---|---|
| Titles | Every title ends with "Expert Consultancy : SEBI Registered Company" (compliance issue and title bloat). Home title is 120+ chars and leads with "Golden Expert Consultancy". |
| Meta description | Home description names "Golden Expert Consultancy, a branch of Real Stock Ideas" — brand mismatch |
| Keywords | "golden expert consultancy, real stock ideas, nse" — do not match the brand |
| Canonical | Present (`https://expertstocks.in/`) |
| OpenGraph/Twitter | Present; `og:image:alt` and `twitter:image:alt` empty |
| Schema.org | Only `WebSite`; no `Organization`, `ContactPoint`, `BreadcrumbList`, `Article`, `FAQPage` |
| Headings | Home `<h1>` is "What Our Clients Say"; no page-topic H1s |
| Image alt text | Carousel images have empty `alt`; stock images use Unsplash captions ("black android smartphone on macbook pro") |
| robots.txt | Allows everything, references sitemap |
| sitemap.xml | 18 URLs, **8 are leftover template shop products** |
| Thin/duplicate content | Two near-identical 1-minute posts on `/research` |
| Tracking | Meta Pixel (`1501228320667716`) and Google AdSense (`ca-pub-1057602147596504`) load **before** cookie consent |
| Security headers | HSTS and `nosniff` present; no CSP beyond frame-ancestors, no Referrer-Policy/Permissions-Policy |

## 7. Weaknesses

1. **Regulatory misrepresentation risk** — contradictory registration statements (§3 C1–C7).
2. **Return and accuracy claims** — 95% accuracy, consistent results, optimal returns, verified P&L (C9–C16).
3. **Unverifiable social proof** — stock-photo testimonials and WhatsApp screenshots (C16, C17).
4. **Brand confusion** — five different business names.
5. **No lead pipeline** — forms lack consent, attribution, and any CRM integration.
6. **Dead CTAs and placeholder social links.**
7. **Template debris indexed** — 8 product pages live.
8. **AdSense on a financial-services site** — third-party ads can show competing or misleading financial promotions next to the brand.
9. **Tracking before consent.**
10. **No trust infrastructure** — no named analyst, methodology, grievance process, privacy policy, or terms.
11. **No product** — no client login, research archive, risk profiling, invoicing, or payment flow.
12. **Accessibility** — empty alt text, heading order, all-caps legal text.

## 8. Recommended improvements (implemented in the new platform)

| Area | Recommendation | Where handled |
|---|---|---|
| Regulatory status | Replace every hard-coded "SEBI Registered" string with wording rendered from a verified, versioned `regulatory_profile`. Until verified, show neutral wording only ("Expert Stocks Consultancy — market research and education"). | `regulatory_profiles`, `ComplianceGate`, Trust Center |
| Claims | Remove C9–C16 and C18–C19. Performance may only be shown from the immutable research-performance ledger (Phase 5) with methodology. | Compliance Guardian rules seeded with these phrases |
| Testimonials | Do not migrate. Testimonials module requires evidence + consent + compliance approval before display. | CMS (later phase) |
| WhatsApp screenshots | Do not migrate; delete from the builder media library. | — |
| Brand | Single brand: **Expert Stocks Consultancy**. Legal entity name shown from settings once verified. | `system_settings` |
| Forms | One lead-capture API with consent records, UTM/referrer attribution, duplicate detection, rate limiting and honeypot. | Phase 1 `POST /api/v1/public/leads` |
| Legal pages | Versioned policy documents (privacy, terms, disclaimer, refund, risk disclosure, investor charter, grievance) published only after approval. Seed text is marked *draft — requires legal review*. | `policy_documents` |
| SEO | Short brand-consistent titles, Organization + ContactPoint schema, per-page H1, sitemap generated from real routes, 301 or 410 for template product URLs. | Next.js metadata, `sitemap.ts`, redirects |
| Tracking | Remove AdSense. Load Meta Pixel/analytics only after opt-in consent. | Cookie consent component |
| Security | CSP, Referrer-Policy, Permissions-Policy, X-Frame-Options. | Next.js + Laravel headers |
| Addresses/phone/email | Keep, but load from settings and verify before launch. | `system_settings` |

## 9. Items the business must verify before launch

1. Legal entity name, constitution (proprietorship/LLP/Pvt Ltd), CIN/LLPIN, GSTIN.
2. Whether **this entity** holds SEBI Research Analyst registration — if yes: registration number, validity, RA name, principal officer, compliance officer, BSE-ASL (RAASB) enrolment.
3. If not: the partner RA's legal name, registration number, written agreement, and exactly which activities each party performs.
4. Whether any Investment Adviser or Portfolio Manager registration exists (if not, all IA/PMS language must go).
5. Segments actually covered under registration (equity, derivatives, commodities).
6. Basis for any statistic (95%, 650+, 150+, 25+ years) — or remove.
7. Consent and authenticity for every testimonial — or remove.
8. Refund policy wording approved by counsel.
9. Grievance officer name, email, escalation matrix, SCORES/ODR details as applicable.
10. Registered and branch addresses.
