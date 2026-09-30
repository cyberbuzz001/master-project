# Trade Grow — Product Requirements & User Journeys

---

## 1. Problem statement

Trade Grow is a new Indian trading platform. The constraint that shapes every decision:

> A prospect has no reason to believe us. Lead generation is not the bottleneck — **credibility is.**

Conventional broker marketing (aggressive CTAs, testimonials, trust badges, "100% safe", headline
zero-brokerage claims) actively *worsens* this problem for a new entrant, because those are exactly
the signals a fraudulent platform also produces. A sceptical customer cannot distinguish us from a
scam by looking at our marketing. They can only distinguish us by checking sources we do not control.

**Therefore the strategy is verification, not persuasion.**

---

## 2. Objectives

| # | Objective | Measure |
|---|---|---|
| O1 | Enable independent verification before KYC | `verify_page_view` rate; outbound verification clicks |
| O2 | Make total trading cost legible | `calculator_used` rate; pricing → KYC conversion |
| O3 | Convert verified interest into funded accounts | Activation→funding rate |
| O4 | Reach ~1,000 activated clients | Activated accounts with ≥1 trade |
| O5 | Zero regulatory incidents | Compliance flags; complaints per 100 accounts |

**O5 outranks O1–O4.** A mis-selling incident at a new broker is existential in a way that a slow
month is not.

### Non-goals

- Investment advice, research, tips or recommendations of any kind
- Any performance, return or profit claim
- Competing on marketing aggression
- Publishing a self-awarded trust score or rating

---

## 3. Success metrics

**Primary:** activated + funded + first-traded clients.
**Never** KYC starts — that metric rewards pressure and is trivially gamed.

| Metric | Why |
|---|---|
| Verify page visit rate (of all sessions) | Core trust behaviour |
| Outbound regulator clicks | Genuine independent verification |
| Calculator usage | Cost comprehension |
| KYC start → completion | Onboarding friction |
| Activation → first funding | **Sales quality.** Low = pressure selling |
| First funding → first trade | Product adoption |
| Complaints per 100 accounts | Compliance health |
| WhatsApp opt-out rate | Message relevance; alert > 2% |

---

## 4. Personas

**P1 — The Sceptical Switcher.** Trades with an established broker. Cost-aware. Primary objection:
"why would I trust a new platform?" → Needs `/verify` and `/compare`. **Highest-value persona.**

**P2 — The Cost-Sensitive Active Trader.** Intraday or F&O, high volume, knows brokerage matters.
→ Needs `/pricing` and the calculator. Converts fastest, churns fastest.

**P3 — The First-Time Investor.** No demat account. Doesn't know what STT or DP charges are.
→ Needs `/learn`, `/open-account`, `/security-awareness`. **Must never be pushed into F&O.**

**P4 — The Previously Defrauded.** Burned by a tips group or fake platform. Deeply suspicious.
→ Needs `/security-awareness` and `/verify`. Slow to convert; loyal if won.

**P5 — Internal: the Sales Agent.** Needs scripts, verification links, and a queue that tells them
who to call next.

---

## 5. Sitemap

```
/                          Homepage
/verify/                   ★ Verification hub — the strategic centre of the site
    #entity #sebi #office #officers #official-channels #documents #how-to-verify
/pricing/                  Charges, split Trade Grow vs statutory
    #calculator            Interactive cost calculator
/compare/                  Source-linked broker comparison
/platform/                 Interactive terminal walkthrough, labelled illustrative
/open-account/             Onboarding preview + link to the real platform signup
    #onboarding-portal     In-browser walkthrough (submits nothing)
/security/                 Implemented controls only
/security-awareness/       Fraud red flags
/support/                  Contact, escalation ladder, ticket form + tracker
    #escalation #ticket
/faq/                      42 FAQs, 5 categories, keyword search, FAQPage schema

Legal (versioned, linked from /verify#documents):
/terms/                    Terms & Conditions
/privacy/                  Privacy Policy
/risk-disclosure/          Risk Disclosure Document
/investor-charter/         Investor Charter
/grievance-policy/         Grievance Redressal Policy
/pmla-policy/              AML / PMLA Policy

404.html                   Not-found page; warns that near-miss addresses are a fraud signal
/learn/                    SEO hub
    how-to-verify-a-stock-broker/
    brokerage-charges-explained/
    what-is-stt/
    what-is-dp-charge/
    what-is-demat-account/
    how-kyc-works/
    how-to-choose-a-stock-broker/
    how-to-compare-brokerage-charges/
```

★ Every page links to `/verify/`. It is reachable in one click from anywhere, including the sticky
mobile bar.

---

## 6. User journeys

### J1 — Cold call → activated client (primary)

```
Cold call
   │  Agent offers verification unprompted     ← trust-defining moment
   ▼
WhatsApp trust pack (within 5 min)
   │
   ▼
/verify  ──▶ clicks out to SEBI / NSE / CDSL    ← O1 achieved
   │
   ▼
/pricing ──▶ calculator with a real trade       ← O2 achieved
   │
   ▼
/compare ──▶ checks competitor's own site
   │
   ▼
/platform ──▶ sees screens
   │
   ▼
/open-account ──▶ KYC (customer completes it themselves)
   │
   ▼
Activation ──▶ Funding ──▶ First trade ──▶ ACTIVE
```

**Designed friction:** we deliberately do not shortcut from the call to KYC. A prospect who skips
verification converts worse at funding. The funnel is longer on purpose.

### J2 — Organic search → client

`/learn/what-is-stt/` → `/pricing/` → `/verify/` → `/open-account/`

The learn content is written to be genuinely useful even to someone who never becomes a customer.
Several articles explicitly give readers tools to judge us more harshly. That is intentional: it is
the only credible way to publish educational content as an interested party.

### J3 — Sceptic journey (P4)

`/security-awareness/` → `/verify/` → external regulator check → `/support/` (asks a question) →
long dormancy → returns weeks later → `/open-account/`

**Requirement:** no automation may chase this person. The follow-up engine stops at day 7.

### J4 — Grievance journey

`/support/` → ticket → L1 → L2 → L3 (Compliance) → L4 (Exchange / SEBI SCORES)

**Requirement:** the path out of our control is published as prominently as the path into it.

---

## 7. Page requirements

| Page | Must have | Must never have |
|---|---|---|
| Home | Trust bar with verify links, dual CTA, honest testimonial empty state | Countdown, fake reviews, return claims |
| `/verify` | Every regulatory field + independent source link; pending fields shown blank | An invented number; a "verified" badge without a checkable reference |
| `/pricing` | Brokerage / statutory split; calculator; unverified-rates banner | "Zero tax"; a total that hides unconfigured charges |
| `/compare` | Source links per cell; no winner | Competitor figures from memory; disparagement |
| `/platform` | "Illustrative interface" label on every mock | Fake P&L numbers; implied returns |
| `/open-account` | OTP warning before step 1 | Any request to share a credential |
| `/security` | Only implemented controls | Unearned certifications; "bank-grade" |
| `/security-awareness` | Red flags; reporting routes incl. cybercrime.gov.in | — |
| `/support` | Escalation ending at SEBI SCORES | A dead-end escalation |
| `/faq` | Honest "not yet confirmed" answers | Invented timelines |

---

## 8. Content governance

**The pending-value rule.** Any unverified fact renders as *"Information to be verified"*. This is
enforced at build time by `build/build.js`, not by editorial discipline — a null in config cannot
become a number on the site by accident.

**The compliance linter.** The build fails on prohibited claims (`guaranteed returns`, `assured
returns`, `100% safe`, `risk-free`, `zero tax`, `multibagger`, `earn lakhs`, urgency patterns).
Two narrow escape hatches exist for copy that must *name* a prohibited claim in order to warn
against it: a negation immediately preceding the phrase, and explicit `<!--lint:ignore-->` markers.

**Result:** a marketer cannot ship "Zero Brokerage, Zero Tax" to production. The build refuses.

---

## 9. Wireframe structure (homepage)

```
┌──────────────────────────────────────────────────┐
│ HEADER  logo · nav · [Start account opening]     │
├──────────────────────────────────────────────────┤
│ HERO                                             │
│  badge: "A new platform — check us first"        │
│  H1 · sub · [Explore] [Verify Our Details]       │
│  3 proof points        │  device mock            │
│                        │  + "Illustrative" tag   │
├──────────────────────────────────────────────────┤
│ TRUST BAR  (dark)                                │
│  SEBI · Exchange · Depository · Entity ·         │
│  Office · Support   — each with [Verify →]       │
├──────────────────────────────────────────────────┤
│ WHY TRUST US  "Don't just trust us. Verify us."  │
│  5 cards: 01 Regulatory · 02 Charges ·           │
│  03 Secure onboarding · 04 Support · 05 Docs     │
├──────────────────────────────────────────────────┤
│ PRICING SPLIT                                    │
│  [Trade Grow sets this] │ [Govt/Exchange sets]   │
├──────────────────────────────────────────────────┤
│ VERIFICATION CHECKLIST  ✓ / ⚠ / —                │
├──────────────────────────────────────────────────┤
│ SECURITY  never-ask list + OTP warning           │
├──────────────────────────────────────────────────┤
│ TESTIMONIALS  honest empty state                 │
├──────────────────────────────────────────────────┤
│ CTA BAND  Verify · Compare · Understand · Decide │
├──────────────────────────────────────────────────┤
│ FOOTER  reg details · docs · risk disclaimer     │
└──────────────────────────────────────────────────┘
│ STICKY (mobile): Verify · Pricing · Call · Open  │
```

---

## 10. Release gates

**A page cannot go live until:**
1. `node build/build.js` exits 0 (compliance lint passes)
2. No `{{pending}}` appears on a page that makes a regulatory claim
3. Compliance has signed off the copy
4. Lighthouse ≥ 90 on Performance / Accessibility / SEO / Best Practices
5. Mobile tested at 375px

**The site must not be publicly launched until** SEBI registration, exchange membership and
depository details are published with real, checkable numbers — or until the pre-launch disclosure
(cold call playbook §3.6) is live on `/verify` and agents are trained on Opening E.
