# Trade Grow — Security Architecture & Compliance Content Checklist

---

# PART A — SECURITY ARCHITECTURE

## A1. Threat model

The realistic threats to a new Indian broker, in order of likelihood:

| # | Threat | Mitigation |
|---|---|---|
| 1 | **Impersonation of Trade Grow** by fraudsters calling customers | Published official numbers; `/security-awareness`; verified WhatsApp profile; agent employee codes; "call back on a number you looked up" |
| 2 | **Social engineering of customers** for OTP/credentials | Site-wide OTP warning; never-ask policy; API refuses credential-shaped input |
| 3 | **Insider misuse** — agent exporting lead lists | Masked numbers; no export for agents; dial tokens; audit logs |
| 4 | CRM compromise | PII encrypted; **no KYC data in the CRM**; zone separation |
| 5 | Credential stuffing on internal accounts | Argon2id, mandatory MFA for privileged roles, lockout |
| 6 | Website defacement / false registration number | Two-person rule on regulatory config; audit logs; static hosting |
| 7 | Supply chain (npm/CDN) | Marketing site has **zero** third-party dependencies; strict CSP |

> Threat 1 is the most likely and the least technical. Most of our security spend belongs in
> customer education and in making our official channels trivially verifiable — which is why
> `/security-awareness` exists and why the WhatsApp number must be on `/verify`.

## A2. Zone separation

See `docs/02-architecture-and-deployment.md` §1. The rule restated:

- **Zone 1 (marketing)** — static files. No database, no auth, no PII. Full compromise leaks nothing.
- **Zone 2 (CRM)** — leads, calls, tickets. PII encrypted. **No KYC data, ever.**
- **Zone 3 (onboarding)** — KYC, PAN, bank, e-sign. Separate infrastructure. Exposes status only.

## A3. Controls

### Application
- HTTPS everywhere, HSTS with preload
- CSP without `unsafe-inline` or `unsafe-eval`
- CSRF tokens on all state-changing internal requests
- Parameterised queries / ORM only — no string-built SQL
- Output encoding by default; `innerHTML` only with build-generated content
- Input validation at the API boundary, allowlist-based
- Rate limiting per IP and per account
- Security headers (see architecture doc §6)

### Authentication (internal users)
- Argon2id password hashing
- **Mandatory TOTP MFA** for `admin`, `super_admin`, `compliance`
- 15-minute access tokens, rotating refresh tokens with reuse detection
- Lockout after 5 failed attempts / 15 min
- Session invalidation on role change
- **No shared accounts.** Every action traces to a named person.

### Data
- Application-level encryption for `phone`, `email`, `name` (envelope encryption, KMS-held key)
- Lookup by salted hash, never by plaintext
- TLS in transit; encryption at rest on all volumes and backups
- Secrets in KMS/Vault — **never** in the repository, never in `.env` committed to git
- Key rotation schedule documented and rehearsed

### What is never stored
- OTPs in any durable store (hash in Redis with short TTL, or not at all)
- Passwords in plaintext or reversible encryption
- Card numbers, CVV, UPI PIN — we never take these at all
- KYC documents in the CRM
- Full phone numbers in agent-facing list responses

### Operational
- Append-only audit logs; no role holds DELETE
- Daily backups + PITR, **with quarterly restore drills**
- Dependency and container scanning in CI
- Annual penetration test; before-launch test mandatory
- Documented incident response with named owners and escalation

## A4. Customer-facing security honesty rule

`/security` lists **only controls that are actually implemented.** Where a control is not live, the
page says "Information to be verified" rather than implying it exists.

**Never publish:** "bank-grade security", "military-grade encryption", "100% safe", or any
certification logo not actually held with a nameable assessor and date.

> An unearned security badge is a reason for *less* confidence in a new broker, not more — it is
> exactly what a fraudulent platform puts on its homepage. Restraint here is a differentiator.

---

# PART B — COMPLIANCE CONTENT CHECKLIST

## B1. Prohibited on every surface

Website, WhatsApp, call scripts, SMS, email, social, print, app store listings:

| # | Prohibited | Notes |
|---|---|---|
| 1 | Guaranteed / assured returns or profits | |
| 2 | "Zero tax", "tax-free trading", "no charges" | Statutory charges apply by law |
| 3 | Unverified SEBI registration, exchange membership, depository status | |
| 4 | "100% safe", "risk-free", "fully secure" | |
| 5 | Investment advice, tips, targets, stock calls | We hold no advisory registration |
| 6 | Fabricated testimonials, reviews, ratings, customer counts | |
| 7 | Self-awarded trust scores or badges | Use the verification checklist instead |
| 8 | Fake urgency, countdowns, "limited slots" | |
| 9 | Competitor disparagement or unverified competitor pricing | |
| 10 | Performance figures, backtests, past-return claims | |
| 11 | Insurance or protection claims on investments | |
| 12 | Unverified security certifications | |

**Enforced automatically:** `build/build.js` fails the build on most of these patterns. CI must
treat the build as a required check so a marketer cannot merge prohibited copy.

## B2. Mandatory on every page

- [ ] Market risk disclaimer in the footer
- [ ] No-advice disclaimer in the footer
- [ ] Legal entity name in the footer
- [ ] SEBI registration (or explicit pending state)
- [ ] Compliance Officer and Grievance Officer contacts
- [ ] Link to grievance escalation including SEBI SCORES
- [ ] Charges disclaimer separating brokerage from statutory charges

## B3. Page-specific requirements

| Page | Must include |
|---|---|
| `/verify` | Entity, CIN, SEBI, exchange, depository, officers, documents, independent-verification steps |
| `/pricing` | Brokerage/statutory split; unverified-rates banner while `ratesVerified=false`; contract-note precedence |
| `/compare` | Per-cell source links; no winner; trademark attribution |
| `/platform` | "Illustrative interface" on every mock; no simulated P&L figures |
| `/open-account` | OTP warning before step 1; document list; rejection reasons |
| `/security` | Implemented controls only |
| `/security-awareness` | Never-ask list; red flags; cybercrime.gov.in and SCORES routes |
| `/support` | Full escalation ladder with timelines, ending outside Trade Grow |
| `/learn/*` | Educational-not-advice disclaimer |

## B4. Pre-publication sign-off

Every new or changed customer-facing page requires:

1. Author self-check against B1 and B2
2. `node build/build.js` exits 0
3. Compliance review recorded with reviewer name and date
4. Any regulatory claim traced to a config value with a verified source
5. Version recorded in the CMS with an audit-log entry

**Two-person rule:** publishing a regulatory claim, approving a script or WhatsApp template, or
setting `ratesVerified: true` requires a second actor holding the `COMPLIANCE` role.

## B5. Quarterly review

- [ ] Re-verify every registration detail against the regulator's current database
- [ ] Reconcile statutory rates against current circulars; update `charges.config.json`
- [ ] Re-check competitor figures on `/compare` against their live tariff pages, or blank them
- [ ] Review testimonials for continuing consent
- [ ] Re-verify document versions and effective dates
- [ ] Review call QA scores and compliance flags
- [ ] Review complaint themes for systematic mis-selling
- [ ] Confirm the compliance linter still covers current prohibited phrasing

## B6. Tone guide

**Use:** verify · compare · understand · review · decide · transparent · applicable ·
estimated · indicative · to be confirmed

**Avoid:** guaranteed · assured · 100% · risk-free · secret · exclusive · hurry · don't miss ·
act now · limited time · best broker · #1 · unbeatable

**Preferred constructions**

| Instead of | Write |
|---|---|
| "Zero brokerage, zero tax" | "₹0 brokerage under applicable plan terms. Statutory charges apply." |
| "100% safe and secure" | "Here are the specific controls in place." |
| "India's best trading platform" | "Compare us against your current broker." |
| "Open your account now!" | "Start account opening" |
| "Trusted by thousands" | "Here is how to verify us independently." |
| "Guaranteed best prices" | "Here is our full charge list, including statutory charges." |

> The consistent move: replace a claim the customer must take on faith with an action the customer
> can take themselves. That substitution *is* the brand.
