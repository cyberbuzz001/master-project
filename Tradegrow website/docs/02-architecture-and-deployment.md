# Trade Grow — System Architecture, Testing & Deployment

---

## 1. Architecture principle

**Three separate trust zones, separated by network and by credential.** The public website must not
be able to reach KYC data even if fully compromised.

```
        PUBLIC INTERNET
              │
         ┌────▼────┐
         │   CDN   │  static site, cached at edge
         └────┬────┘
              │
   ┌──────────▼──────────┐
   │  ZONE 1: MARKETING  │   dist/ — static HTML/CSS/JS
   │  No database.       │   Zero server-side code.
   │  No PII. No auth.   │   A full compromise leaks nothing.
   └──────────┬──────────┘
              │ HTTPS, rate-limited, no shared credentials
   ┌──────────▼──────────────────────────────┐
   │  ZONE 2: CRM / OPS                      │
   │  API · PostgreSQL · Redis · queue       │
   │  Leads, calls, WhatsApp, tickets        │
   │  PII encrypted. No KYC data.            │
   │  VPN / IP-allowlisted admin access      │
   └──────────┬──────────────────────────────┘
              │ signed, audited, status-only API
   ┌──────────▼──────────────────────────────┐
   │  ZONE 3: REGULATED ONBOARDING           │
   │  KYC, PAN, Aadhaar, bank, e-sign        │
   │  Separate infrastructure & access model │
   │  Zone 2 may read STATUS only            │
   └─────────────────────────────────────────┘
```

**The Zone 2 → Zone 3 boundary is the most important line in this system.** The CRM asks
"is lead X's KYC complete?" and receives a status enum. It can never retrieve a PAN, a document, or
a bank account number. This bounds a CRM breach to names and phone numbers.

---

## 2. Current implementation (Zone 1 — built)

**Zero-dependency static site generator.** No npm install, no framework, no supply-chain surface.

```
site/config/*.json   ─┐
site/partials/*.html  ├─▶  build/build.js  ──▶  dist/  ──▶  CDN
site/pages/**/*.html  │         │
site/assets/**        ─┘        ├─ build/components.js   (config → HTML)
                                └─ compliance linter      (fails build on prohibited claims)
```

**Why static rather than Next.js for the marketing site:**

| | Static (chosen) | Next.js |
|---|---|---|
| Attack surface | Effectively zero | Node runtime, dependency tree |
| Lighthouse | Trivially >95 | Needs tuning |
| Hosting | Any CDN / shared host | Node runtime required |
| Config → HTML | Build-time, crawlable | Build-time, crawlable |
| Team editing | Edit JSON, run one command | Same, plus a toolchain |
| Supply chain | No third-party packages at all | ~300 transitive deps |

For a marketing site whose entire purpose is *being trustworthy*, a zero-dependency build is the
right call. **Migrate to Next.js only if** the site needs authenticated pages or server-rendered
personalisation — neither is in scope.

### Commands

```bash
node build/build.js            # build to dist/
node build/build.js --serve    # build + dev server on :4321
node build/gen-learn-pages.js  # regenerate /learn pages
```

Build fails (exit 1) on any prohibited claim. **Wire this into CI as a required check.**

---

## 3. Proposed stack (Zones 2 & 3 — not yet built)

| Layer | Choice | Rationale |
|---|---|---|
| Marketing | Static + CDN | §2 |
| CRM frontend | React + Vite (SPA, internal only) | No SEO need; fast iteration |
| API | Node 22 + Fastify + TypeScript, **or** Laravel 11 | Pick for team skill, not fashion |
| Database | PostgreSQL 15 | Partial indexes, JSONB, partitioning |
| Cache / queue | Redis 7 + BullMQ | Sessions, rate limits, OTP hashes (TTL), job queue |
| Object storage | S3-compatible | Documents, recordings. Private buckets, signed URLs |
| WhatsApp | Meta-authorised BSP | Never unofficial automation |
| Telephony | Cloud dialler with recording consent support | |
| Analytics | Self-hosted, privacy-conscious | No third-party tags on a broker site |
| Auth (internal) | Argon2id + mandatory TOTP for admin/compliance | |
| Secrets | Cloud KMS / Vault | Never in env files in the repo |
| CI/CD | GitHub Actions | |
| Monitoring | Health checks, error tracking, uptime, SLA breach alerts | |

**Hosting note:** this repository is Hostinger-deployable as-is for Zone 1 — `dist/` is plain static
files. Zones 2 and 3 need a VPS or managed platform, not shared hosting.

---

## 4. Environments

| Env | Purpose | Data |
|---|---|---|
| Local | Development | Synthetic only |
| Staging | QA, UAT, compliance review | Synthetic only |
| Production | Live | Real |

**Production data must never be copied to staging.** If realistic data is needed, generate it.
Anonymised production data is still production data until proven otherwise, and phone numbers do not
anonymise well.

---

## 5. Testing plan

### Automated

**Live in CI today** (`.github/workflows/deploy.yml`, gates the deploy):

| Check | Tool | Fails build on |
|---|---|---|
| **Compliance lint** | `build/build.js` | Any prohibited claim |
| Build succeeds | `build/build.js` | Template/config error |
| Broken internal links | `build/check-links.js` | Dead link, or a root-absolute link missing the base prefix |
| Structural accessibility | `build/check-a11y.js` | Any HIGH finding |

Also live in CI, in a separate `lighthouse` job:

| Check | Tool | Fails build on |
|---|---|---|
| Colour contrast | `build/contrast.js` | Any palette pair below 4.5:1 |
| Lighthouse a11y / SEO / best-practices | `lhci` on 6 pages | Score below 0.95 |
| Lighthouse performance | `lhci` | Warns below 0.90 (see §7 for why it warns) |

That job does **not** gate the deploy — a shared-runner perf wobble should not block a content fix.
The `build` job gates the deploy; `lighthouse` reports.

**Not yet wired — do not claim these as passing until they are:**

| Check | Tool | Why it matters |
|---|---|---|
| HTML validity | `html-validate` on `dist/**` | Catches malformed markup the regex checkers miss |
| Calculator unit tests | Charge math per segment, per side | Currently verified manually only |
| API contract tests | Once Zone 2 exists | — |

#### What `check-a11y.js` does and does not cover

It is a static, zero-dependency scan of the built HTML. It catches: duplicate ids,
unlabelled form controls, images without `alt`, controls with no accessible name, skipped
heading levels, missing/multiple `h1`, positive `tabindex`, tables without a caption,
missing `lang` or `title`.

It does **not** catch colour contrast, focus order, keyboard traps, screen-reader output,
ARIA correctness beyond attribute presence, or anything rendered by JavaScript after load.

> A pass here means "no obvious structural defects", not "accessible". Contrast is covered
> separately by `build/contrast.js` and by Lighthouse in CI, both of which this scan cannot do.

#### Manual keyboard audit — done, with results

Performed in a real browser with real key events, not scripted focus. What was checked and found:

| Check | Result |
|---|---|
| Skip link | **Pass.** First Tab reveals it; activates to `#main` |
| Positive `tabindex` anywhere | **None** |
| Hidden tab panels | **Pass.** `display:none`, so their form fields are out of the tab sequence |
| Mobile nav closed | **Pass.** `display:none`, 0 focusable links |
| Mobile nav open/close | **Pass.** `aria-expanded` and the button label both update; no trap |
| Form focus indicator | **Pass.** Border `#1B4DFF` at **5.91:1** vs background and **4.76:1** vs the unfocused border. The `outline:none` is a replacement, not a removal — meets 1.4.11 and 2.4.7 |
| **Tablist arrow keys** | **Failed — now fixed.** See below |

**The one real defect.** All three tabsets (`/support/`, `/open-account/`, `/platform/`) used
`role="tab"` but implemented none of the keyboard behaviour that role promises: arrow keys did
nothing, and every tab sat in the page tab sequence instead of a roving tabindex.

Declaring `role="tab"` tells assistive technology this is a tab widget; users of that technology
then try arrow keys, and nothing happened. Fixed with a generic layer in `app.js` that attaches to
any `[role="tablist"]` and reuses each tabset's existing click handler, so the three bespoke
implementations did not need rewriting. Verified: Arrow Left/Right/Up/Down, Home, End, wrap-around,
panel switching, and `aria-selected` / roving `tabindex` staying in sync under both keyboard and
mouse activation.

`check-a11y.js` now also asserts that every `role="tab"` carries `aria-controls` and
`aria-selected`, and that every `role="tablist"` is labelled.

**Still unverified:** screen-reader output (NVDA/JAWS/VoiceOver). No tool here substitutes for it,
and nothing in this document should be read as claiming it has been tested.

### Calculator test cases (must pass)

| Case | Expectation |
|---|---|
| Delivery, both sides, 100 @ ₹500 | STT ₹100 on ₹1,00,000 turnover; stamp duty buy-side only |
| Intraday | STT sell-side only, at the intraday rate |
| Options | Turnover = premium, not strike; price label changes |
| DP charges | Only on delivery sell; scales by scrip count, not quantity |
| **Unconfigured charge** | Shows "To be verified"; **excluded from total**; warning displayed |
| GST | Applied to brokerage + exchange + SEBI + DP only — never to trade value |
| Zero quantity | No crash, no NaN, no division by zero |

> The unconfigured-charge case is the most important test in the suite. Rendering a missing rate as
> `0` would understate cost — the precise failure this project exists to prevent.

### Manual QA before each release

- Every `/verify` outbound link opens the correct regulator page
- Pending fields render as "Information to be verified" on every page
- Mobile at 375px: no horizontal scroll, sticky CTA visible, tap targets ≥ 44px
- Keyboard-only navigation through the whole site
- Screen reader: trust bar and pricing tables announce sensibly
- Print `/pricing` — charge tables must remain legible (customers do print these)

### Security testing (before public launch)

- Dependency and container scan
- OWASP Top 10 review of the CRM API
- Authenticated penetration test of Zone 2
- Verify Zone 1 → Zone 3 is unreachable by network policy, not just by convention
- Rate-limit verification on the ticket endpoint

---

## 6. Deployment

### Zone 1 (now)

```yaml
# .github/workflows/deploy-site.yml (outline)
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  build:
    steps:
      - checkout
      - run: node build/build.js        # exits 1 on compliance lint failure
      - run: npx html-validate 'dist/**/*.html'
      - run: npx lhci autorun           # thresholds in lighthouserc
      - if: github.ref == 'refs/heads/main'
        run: rsync dist/ → CDN origin, then purge cache
```

**Required headers at the edge:**

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self';
                         img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';
                         base-uri 'self'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

The CSP is strict because the site genuinely loads nothing external — no fonts, no tag managers, no
analytics vendors. **Do not add a third-party marketing tag to this site without a security review;
it would break the CSP and undermine the security claims on `/security`.**

### Zone 2/3 (later)

Blue-green or rolling. Migrations gated and reversible. Health check before traffic shift. Automated
rollback on error-rate threshold. Database backups: daily full + PITR, **with quarterly restore
drills** — an untested backup is a hypothesis.

---

## 7. Performance targets

All measured with Lighthouse 12, mobile emulation with throttling, against the root-mode build.

| Metric | Target | Measured |
|---|---|---|
| Lighthouse Performance | ≥ 90 | **98–100** |
| Accessibility | ≥ 90 | **100** |
| SEO | ≥ 90 | **100** |
| Best Practices | ≥ 90 | **100** |
| LCP | < 2.0s | **1.4–1.8s** |
| CLS | < 0.05 | **0** |
| Total page weight | < 250 KB | **92–115 KB** (~24 KB gzipped) |

Per page:

| | perf | a11y | best | SEO |
|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 |
| `/verify/` | 100 | 100 | 100 | 100 |
| `/pricing/` | 100 | 100 | 100 | 100 |
| `/platform/` | 98 | 100 | 100 | 100 |
| `/open-account/` | 100 | 100 | 100 | 100 |
| `/faq/` | 100 | 100 | 100 | 100 |
| `/support/` `/compare/` `/terms/` | 100 | 100 | 100 | 100 |

**Enforced by CI** via `.lighthouserc.json`, on six representative pages:

- accessibility, SEO, best-practices: **error** below 0.95
- performance: **warn** below 0.90 — CI runners are shared and perf scores move a few points
  between runs. A hard perf gate produces flaky failures that get ignored, which is worse than a
  warning that gets read.
- Individual audits asserted as errors regardless of category score: `color-contrast`,
  `definition-list`, `label-content-name-mismatch`, `heading-order`, `html-has-lang`, `link-name`,
  `button-name`, `label`, `image-alt`, `duplicate-id-aria`.
- Dev-server artefacts switched off: text compression, cache TTL, minification, unused CSS,
  render-blocking. These reflect the local static server, not the CDN, and would be noise.

Reports upload as a build artefact (14-day retention).

**Measured page weight** (uncompressed / gzipped as a CDN actually serves it):

| | HTML | + CSS + JS = first load |
|---|---|---|
| `/` | 40 KB | **110 KB** (9 KB gz page + 9 KB gz CSS + 6 KB gz JS ≈ **24 KB gz**) |
| `/faq/` (largest) | 45 KB | 115 KB |
| `/pricing/` | 29 KB | 99 KB |
| `/support/` (smallest) | 22 KB | 92 KB |

Shared assets: `styles.css` 44 KB (9 KB gz), `app.js` 25 KB (6 KB gz), `calculator.js` 8 KB
(pricing page only). Zero images, zero web fonts, zero third-party requests.

**Why it stays small:** system font stack (no web-font request, no FOUT), inline SVG icons (no icon
font or sprite), one stylesheet, deferred JS, and config inlined at build time so there is no
client-side hydration and no layout shift from late-arriving values.

**Before adding any dependency to the marketing site, check it against this table.** A tag manager
alone typically costs 15–25 Lighthouse points.

---

## 8. Launch checklist

- [ ] All regulatory config filled and Compliance-signed
- [ ] `charges.verification.ratesVerified = true` after rate reconciliation
- [ ] Brokerage plan approved by Commercial **and** Legal; `claimText` set to approved wording
- [ ] Every document uploaded, versioned, dated, published
- [ ] Compliance Officer and Grievance Officer named with working contacts
- [ ] Support phone, email and WhatsApp live and answered
- [ ] Ticket endpoint configured (`data-endpoint` on the support form)
- [ ] Analytics endpoint configured in `app.js`
- [ ] Verification checklist statuses updated from actual state
- [ ] App store listings live; developer name matches the legal entity
- [ ] All agents trained on the playbook; QA scorecard live
- [ ] WhatsApp templates approved by Meta **and** Compliance
- [ ] DND / NDNC scrubbing in place before the first dial
- [ ] Security headers verified in production
- [ ] Penetration test complete, criticals closed
- [ ] Backup restore drill completed successfully
