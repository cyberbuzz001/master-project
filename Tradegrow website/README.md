# Trade Grow — Trust & Client Acquisition System

A verification-first website and acquisition playbook for a new Indian trading platform.

> **The strategy in one line:** Trade Grow is new, so the pitch is not *"trust us."*
> It is **"Verify us. Compare us. Understand us. Then decide."**
> Every page, script and message here reinforces that.

---

## Quick start

```bash
node build/build.js --serve
```

Then open <http://localhost:4321>. No `npm install` — there are no dependencies.

```bash
node build/build.js            # build to dist/
node build/gen-learn-pages.js  # regenerate /learn pages after editing the generator
node build/check-links.js      # internal link check (run with the same BASE_PATH as the build)
node build/check-a11y.js       # structural accessibility scan
```

**The build exits 1 if it finds a prohibited marketing claim.** Wire it into CI as a required check.

---

## What's here

```
site/config/*.json      ← SINGLE SOURCE OF TRUTH. Non-developers edit only these.
site/pages/**/*.html    Page content
site/partials/*.html    Layout, header, footer
site/assets/            CSS + JS (zero dependencies)
build/build.js          Static site generator + compliance linter
build/components.js     Config → HTML components
build/check-links.js    Internal link checker (base-path aware)
build/check-a11y.js     Structural accessibility scan
.github/workflows/      CI: build → checks → deploy to Pages
tools/                  acquisition-calculator.html (internal planning tool)
docs/                   Written deliverables (PRD, schema, playbooks, plans)
dist/                   Build output — deploy this (gitignored)
```

---

## The two mechanisms that make this different

### 1. No unverified fact can reach the website

Every regulatory, contact and pricing value lives in `site/config/*.json` and ships **null**.
A null renders as a visible amber badge:

> *Information to be verified*

There is no path by which a blank field becomes a plausible-looking number. A registration number
appears on the site only when someone puts it in config, and it appears next to a link to SEBI's own
database so the customer can check it.

**54 values are currently pending.** That is the correct pre-launch state — fill them as Compliance
signs off, not before.

### 2. The build refuses prohibited claims

`build/build.js` fails on `guaranteed returns`, `assured returns`, `100% safe`, `risk-free`,
**`zero tax`**, `multibagger`, `earn lakhs`, fake urgency patterns and others.

Two narrow escape hatches exist so that pages *warning against* these claims can name them:
a negation immediately before the phrase, and explicit `<!--lint:ignore-->` markers.

**Practical effect:** nobody can ship "Zero Brokerage, Zero Tax" to production. The build stops it.

---

## On "Zero Brokerage, Zero Tax"

This was an explicit requirement, and it needed splitting in two.

- **Zero brokerage** can be genuine. Brokerage is Trade Grow's own charge. If Legal confirms a
  nil-brokerage plan, set `brokerage.claimText` to the approved wording with its conditions
  (e.g. *"₹0 brokerage under applicable plan/offer terms"*).
- **Zero tax is not a real thing.** STT, GST and stamp duty are levied by law. No Indian broker can
  waive them. The linter blocks the phrase, the FAQ explains why, and `/pricing` separates every
  charge into **"Trade Grow sets this"** vs **"Government / Exchange / SEBI sets this"**.

This is a commercial asset, not a limitation. Every competitor blurs the line; being the platform
that refuses to is a differentiator a sceptical customer can feel immediately.

---

## Editing content

| To change | Edit | Then |
|---|---|---|
| Registration, entity, officers, support | `site/config/site.config.json` | `node build/build.js` |
| Brokerage plan, statutory rates, other charges | `site/config/charges.config.json` | rebuild |
| FAQ answers | `site/config/faq.json` | rebuild |
| Competitor comparison | `site/config/compare.json` | rebuild |
| Verification checklist statuses | `site/config/checklist.json` | rebuild |
| Testimonials | `site/config/testimonials.json` | rebuild |

**Rules:** leave a value `null` until Compliance verifies it. Never publish a competitor figure from
memory — open their tariff page and record the date. Never mark a checklist item `verified` unless a
customer can confirm it from an independent source.

---

## Documentation

| Doc | Covers |
|---|---|
| [`00-PRD-and-journeys.md`](docs/00-PRD-and-journeys.md) | PRD, personas, sitemap, user journeys, wireframes, release gates |
| [`01-design-system.md`](docs/01-design-system.md) | Tokens, type, components, accessibility, motion |
| [`02-architecture-and-deployment.md`](docs/02-architecture-and-deployment.md) | Three-zone architecture, stack, testing plan, CI/CD, launch checklist |
| [`03-database-schema.md`](docs/03-database-schema.md) | 24 tables, ER diagram, indexes, retention |
| [`04-api-spec.md`](docs/04-api-spec.md) | Endpoints, auth, rate limits, webhooks |
| [`05-crm-and-lead-management.md`](docs/05-crm-and-lead-management.md) | Lead stages, scoring, dashboards, follow-up engine, roles |
| [`06-cold-call-playbook.md`](docs/06-cold-call-playbook.md) | 5 openings, 20 objection scripts, 10 trust variations, QA scorecard |
| [`07-whatsapp-funnel.md`](docs/07-whatsapp-funnel.md) | 6-message sequence, templates, routing, stop conditions |
| [`08-analytics-and-events.md`](docs/08-analytics-and-events.md) | Event catalogue, funnel definitions, privacy posture, A/B rules |
| [`09-security-and-compliance.md`](docs/09-security-and-compliance.md) | Threat model, controls, compliance content checklist, tone guide |
| [`10-admin-cms-spec.md`](docs/10-admin-cms-spec.md) | CMS sections, publish gates, locked fields |
| [`12-acquisition-plan.md`](docs/12-acquisition-plan.md) | 1,000-client model, 30/60/90 plan, guardrails |

---

## Deploying

**Live preview:** <https://cyberbuzz001.github.io/webtradegrow/>

Every push to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which
builds and publishes to GitHub Pages. Pull requests run the build, link check and accessibility
scan **without** deploying.

**The build is the deploy gate.** `node build/build.js` exits 1 on any prohibited marketing claim,
so such copy cannot reach the live site even if it gets merged. `check-links.js` and `check-a11y.js`
gate it too — a dead link or a high-severity accessibility defect blocks the deploy.

### Base path

GitHub Pages serves project repos from a subpath (`/webtradegrow/`), but pages are authored with
root-absolute links (`/verify/`, `/assets/...`) — correct for the production domain. The builder
takes two environment variables and rewrites links at build time, so **one source tree deploys to
either a subpath or a root domain with no page edits**:

```bash
# Root domain (default) — tradegrow.in
node build/build.js

# Subpath — GitHub Pages
BASE_PATH=webtradegrow SITE_URL=https://cyberbuzz001.github.io node build/build.js
```

`BASE_PATH` accepts `webtradegrow` or `/webtradegrow`. Prefer the bare form on Windows: Git Bash
rewrites a leading `/` into a drive path. Run `build/check-links.js` with the **same** `BASE_PATH`
as the build — it resolves and validates against that base, and separately flags any link the
builder failed to rewrite.

### Going live on the real domain

When `tradegrow.in` is ready, either point a CNAME at Pages and drop the two env vars from the
workflow, or upload `dist/` to Hostinger as plain static files. Nothing else changes.

Required security headers are in
[`02-architecture-and-deployment.md`](docs/02-architecture-and-deployment.md) §6. The CSP is strict
because the site loads **nothing** external: no web fonts, no tag manager, no analytics vendor.
Adding a third-party tag would break the CSP and contradict the `/security` page.

---

## Before going live

Full checklist in [`02-architecture-and-deployment.md`](docs/02-architecture-and-deployment.md) §8.
The four that matter most:

1. **Regulatory config filled and Compliance-signed.** The entire strategy is verification — with
   nothing to verify, the trust argument collapses. This is the biggest risk to the plan.
2. **`charges.verification.ratesVerified = true`** after reconciling every statutory rate against
   the current circulars. Until then the pricing page shows an unverified-rates banner and the
   calculator labels output indicative — which is correct, but not launch-ready.
3. **Agents trained on the playbook**, QA scorecard live, DND scrubbing in place before the first dial.
4. **Commission structured on funded, traded clients — never on KYC starts.** Paying on KYC starts
   manufactures the pressure selling the guardrails exist to catch, and no amount of training
   overcomes a compensation structure.

---

## What is not built yet

This delivers the public trust layer and the operating playbooks. Deliberately **not** built:

- **CRM application** — spec'd in docs 03/04/05; needs infra decisions
- **WhatsApp automation** — spec'd in doc 07; needs a BSP contract and Meta template approval
- **Call recording analysis** — spec'd in doc 05 §9; needs legal clearance on recording consent
- **Admin web UI** — spec'd in doc 10; the JSON + PR workflow is a valid interim CMS
- **KYC onboarding system** — Zone 3, a regulated system in its own right

Those need vendor credentials, legal sign-off and infrastructure choices that shouldn't be guessed
at. The specs are written so they can be built without re-deriving any of the above.
