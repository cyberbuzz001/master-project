# Trade Grow — Admin CMS Specification

**Goal:** non-developers change every customer-facing fact without touching code — while making it
structurally impossible to publish an unverified regulatory claim.

---

## 1. Current state (config-file CMS)

Today the CMS is five JSON files plus a build command. That is a legitimate CMS for a small team and
has one significant advantage over a database-backed admin: **every change is a reviewable diff in
version control**, and the build refuses prohibited copy before it can go live.

| File | Controls |
|---|---|
| `site/config/site.config.json` | Entity, SEBI/exchange/depository, officers, support, documents, CTA text, disclaimers |
| `site/config/charges.config.json` | Brokerage plan, statutory rates, other charges, rate verification flag |
| `site/config/faq.json` | 40 FAQs across 5 categories |
| `site/config/compare.json` | Comparison criteria and per-broker sourced values |
| `site/config/checklist.json` | Verification checklist statuses |
| `site/config/testimonials.json` | Testimonials + publish gate |

```bash
node build/build.js     # rebuild after any edit
```

**Workflow:** edit JSON → PR → Compliance approves the diff → CI runs the build (fails on prohibited
claims) → merge → deploy.

> Do not replace this with a database CMS until the operational pain is real. The PR-based flow
> gives you the two-person rule, an audit trail and a rollback path for free.

---

## 2. Target state (admin UI over the same data)

When a web UI is built, it must preserve every control the file-based flow provides.

### Sections

| Section | Fields | Role |
|---|---|---|
| **Company & Regulatory** | Entity, CIN, GSTIN, offices, SEBI, exchanges, depositories, officers | `ADMIN` + `COMPLIANCE` co-approval |
| **Pricing** | Brokerage per segment, statutory rates, other charges, `ratesVerified` | `ADMIN` + `COMPLIANCE` co-approval |
| **Documents** | Upload, version, effective date, publish/hide | `ADMIN`, audit-logged |
| **FAQ** | Category, question, answer, order, status | `ADMIN` |
| **Scripts** | Category, title, body, version, approval | `ADMIN` writes, `COMPLIANCE` approves |
| **WhatsApp templates** | Template key, body, buttons, approval | `ADMIN` writes, `COMPLIANCE` approves |
| **Testimonials** | Full record + consent + verification | `ADMIN` writes, `COMPLIANCE` approves |
| **Checklist** | Per-item status and evidence | `COMPLIANCE` only |
| **Support** | Phone, email, WhatsApp, hours, escalation ladder | `ADMIN` |
| **Site copy** | Headlines, CTA labels, banners, notices | `ADMIN` |
| **Scoring rules** | Signal weights | `ADMIN`, audit-logged |
| **Campaigns & follow-up** | Sequences, day offsets, quiet hours, kill switch | `ADMIN` |

---

## 3. Non-negotiable CMS controls

These are the reason the CMS exists in this form. Each one blocks a specific, realistic failure.

### 3.1 The pending rule
Clearing a field is always allowed and always renders *"Information to be verified"*.
**A blank field can never render as a plausible-looking default.**

### 3.2 The two-person rule
Publishing any regulatory claim, approving any script or template, or setting `ratesVerified: true`
requires a second actor holding `COMPLIANCE`.
*Blocks:* one compromised or careless admin account putting a false SEBI number on the site.

### 3.3 The compliance linter
Runs on save **and** on publish, not just at build. Blocks: guaranteed/assured returns, "zero tax",
"100% safe", "risk-free", fake urgency, unverified certifications.
*Blocks:* marketing copy that would be a regulatory breach.

### 3.4 The statutory/brokerage split
Every charge row carries a mandatory `is_statutory` flag. The UI must not allow a statutory charge
to be presented as a Trade Grow charge or vice versa.
*Blocks:* the "zero brokerage means zero cost" conflation.

### 3.5 The testimonial publish gate
`published = true` is rejected unless consent obtained **and** verification complete **and**
compliance approved. Enforced by a database CHECK constraint, not only by the UI.
*Blocks:* fabricated social proof — the most common integrity failure at new brokers.

### 3.6 Rate history is append-only
Changing a statutory rate inserts a new row with a new `effective_from`. Old rows are never updated.
*Blocks:* silently rewriting history so past cost estimates can no longer be reproduced.

### 3.7 Audit everything
Every change records actor, role, timestamp, IP, before/after. Logs are append-only; no role holds
DELETE.

---

## 4. Publishing workflow

```
DRAFT ──▶ IN REVIEW ──▶ APPROVED ──▶ PUBLISHED
   ▲           │                          │
   └───────────┴─── rejected ─────────────┘
                                          │
                                    SUPERSEDED
```

- Preview any draft on a staging URL before publish
- Publishing triggers a rebuild and CDN purge
- **One-click rollback** to any previous published version
- Scheduled publishing for rate changes with a known effective date

---

## 5. Admin UI requirements

- **Diff view before publish** — show exactly what changes, old vs new. Never a bare "Save".
- **Impact summary** — "this change affects: /pricing, /compare, footer on all pages"
- **Blocking validation** — clear, specific errors; never a silent save that drops a field
- **Preview** — render the actual page, not a generic form preview
- **Mandatory source field** on every regulatory value: where was this verified, by whom, on what date
- **Quarterly review prompts** — flag any regulatory value not re-verified in 90 days

---

## 6. Deliberately *not* editable in the CMS

| Locked | Why |
|---|---|
| Market risk and no-advice disclaimers | Regulatory requirement; removing them must require a code change and a review |
| The OTP warning | Core anti-fraud control |
| Escalation path to exchange / SEBI SCORES | Must always be reachable by the customer |
| "Illustrative interface" labels | Prevents mockups being passed off as real screenshots |
| The compliance linter's banned list | Adding an exception must be a reviewed code change |
| `.pending` styling | Its visual prominence is a control, not a design preference |

> A CMS that lets an admin delete the risk disclaimer to "clean up the footer" is a liability. These
> six items are hardcoded on purpose, and that decision should survive future redesign pressure.

---

## 7. Field validation

| Field | Rule |
|---|---|
| SEBI registration | Format check + **mandatory source URL and verification date** |
| Exchange member code | Format check + source |
| DP ID | Numeric format + depository selection |
| CIN | 21-char format check |
| GSTIN | 15-char format check |
| Phone | Indian format; must match the number published on `/support` |
| Email | Must be on a company domain — not a free webmail address |
| Charge rate | Numeric, range-checked, with an effective date |
| Brokerage `claimText` | Linter-checked; cannot contain "tax" |
| Document upload | PDF only, virus-scanned, version and effective date required |

**A free-webmail compliance contact is a fraud signal to customers.** The validator should enforce
what the security-awareness page teaches people to look for.
