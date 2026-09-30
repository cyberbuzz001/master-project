# Trade Grow — Analytics & Event Tracking

---

## 1. Principles

1. **Collect what changes a decision.** Everything else is liability, not insight.
2. **Never put PII in an event.** No phone, email, PAN, name, client code — not in `path`, not in
   `props`, not in a referrer.
3. **Path only, never query strings.** A query string on a broker site is where PII leaks.
4. **Honour DNT and GPC** client-side, and drop again server-side.
5. **No third-party tags.** A tag manager on a broker website means an external party can inject
   script into pages that discuss KYC. It also breaks our CSP and contradicts `/security`.

The current implementation (`site/assets/js/app.js`) sends `{ event, path, ts, sid, props }` where
`sid` is a per-session anonymous id in `sessionStorage` — it does not survive a browser restart and
is not a cross-site identifier.

---

## 2. Event catalogue

### Page views
| Event | Fires on |
|---|---|
| `homepage_view` | `/` |
| `verify_page_view` | `/verify/` |
| `pricing_view` | `/pricing/` |
| `comparison_view` | `/compare/` |
| `platform_demo` | `/platform/` |
| `faq_view` | `/faq/` |
| `security_view` | `/security/` |
| `security_awareness_view` | `/security-awareness/` |
| `support_view` | `/support/` |
| `page_view` | Any other page, incl. `/learn/*` |

### Intent
| Event | Fires on | Props |
|---|---|---|
| `registration_verify_click` | Any outbound link (SEBI/NSE/BSE/CDSL/NSDL/MCA) | `host` |
| `calculator_used` | Calculator recompute (debounced) | `segment`, `side` |
| `whatsapp_click` | WhatsApp FAB or link | |
| `call_click` | `tel:` link | |
| `kyc_start` | Account-opening CTA | |
| `support_ticket_created` | Ticket submitted | |

### Server-side (Zone 2, not from the browser)
`kyc_complete` · `account_activation` · `first_funding` · `first_trade`

> These four are deliberately **not** browser events. Client-side conversion signals can be forged,
> and these are the numbers that determine commission.

---

## 3. The metric that matters most

**`registration_verify_click` is the headline metric of this entire project.**

It is the only event that proves a prospect actually left our site to check us against a source we
do not control. Everything else measures interest; this measures trust-building.

| Diagnostic | Reading |
|---|---|
| High `verify_page_view`, low `registration_verify_click` | People look at the page but don't check. The outbound links are not prominent enough, or the fields are still pending and there is nothing to check. |
| High verify clicks, low KYC | Good. They are doing diligence. Be patient — do not shorten the funnel. |
| High `pricing_view`, low `verify_page_view` | Price shoppers. They will also leave on price. Expect lower retention. |
| High `calculator_used`, low `kyc_start` | Our pricing is not competitive for their pattern, or brokerage is still pending. |

---

## 4. Funnel definitions

```
Lead        → Call            calls / leads
Call        → Interest        interested / connected
Interest    → WhatsApp        whatsapp_delivered / interested
WhatsApp    → Verification    verify_page_view / whatsapp_delivered
Verification→ KYC start       kyc_start / verify_page_view
KYC start   → KYC complete    kyc_complete / kyc_start
KYC complete→ Activation      activated / kyc_complete
Activation  → Funding         funded / activated
Funding     → First trade     first_trade / funded
```

Report **conversion %** and **drop-off %** at every step, sliced by agent, source, campaign and month.

### Cost metrics
- Cost per lead = spend / leads
- Cost per activated = spend / activated
- **Cost per funded client** ← the real unit economic
- Payback period = cost per funded ÷ expected monthly revenue per client

> Cost per *activated* account flatters the numbers when sales pressure is high. Cost per *funded*
> client is the one to manage against.

---

## 5. Health alerts

| Alert | Threshold |
|---|---|
| WhatsApp opt-out rate | > 2% |
| WhatsApp complaint | Any occurrence |
| Activation → funding rate, per agent | < 60% of team median — investigate for pressure selling |
| Grievance SLA breach | Any occurrence |
| Compliance flag from call analysis | Any occurrence → page a human |
| Calculator error rate | > 0.1% |
| Verify page 4xx/5xx | Any sustained occurrence — this page failing is a trust incident |

---

## 6. Privacy posture

**Collected:** event name, path, anonymous session id, timestamp, coarse referrer host, non-PII props.

**Not collected:** name, phone, email, PAN, client code, IP stored long-term, precise location,
cross-site identifiers, fingerprints, device ids, form field values.

**Cookie banner:** not required for this site as built, because no cookies are set and no
cross-site tracking occurs. `sessionStorage` holds one anonymous id for the session only.

> If someone later proposes adding an advertising pixel, note that it would require a consent
> banner, break the CSP, and sit awkwardly beside a `/security` page promising restraint. Weigh that
> against the attribution benefit honestly.

**Retention:** raw events 13 months, then aggregate and drop. See `docs/03-database-schema.md` §5.

---

## 7. Configuration

Set the endpoint in `site/assets/js/app.js`:

```js
var TRACK_ENDPOINT = 'https://api.tradegrow.in/v1/public/events';
```

Null (the default) queues events in memory and sends nothing — safe for staging.

Server-side the endpoint must: verify origin, rate-limit by IP, reject any `path` containing `?`,
reject `props` values matching phone/email/PAN patterns, and drop when `DNT`/`GPC` is present.

---

## 8. A/B testing

**Testable:** hero headline wording, CTA labels, order of trust sections, pricing presentation,
WhatsApp CTA copy, verify CTA placement, KYC CTA wording.

**Never testable:**
- Whether a regulatory claim is present or accurate
- Whether the pending-value badge is shown
- Whether statutory charges are disclosed
- Whether the OTP warning appears
- The brokerage/statutory split
- The escalation path

> A/B testing exists to find clearer wording, not to find out whether customers convert better when
> told less. Any experiment that tests the *substance* of a disclosure is prohibited.

Variants live in `site.config.json → headlineVariants`. Measure to `kyc_start` **and** to
`first_funding` — a headline that lifts KYC starts but not funded accounts has made things worse.
