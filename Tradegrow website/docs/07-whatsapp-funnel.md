# Trade Grow — WhatsApp Funnel

**Status:** Draft. Templates require WhatsApp Business API template approval **and** Compliance
sign-off before use.

---

## 1. Hard constraints before anything is sent

| Constraint | Detail |
|---|---|
| **Official API only** | Use a Meta-authorised WhatsApp Business Solution Provider. Never personal numbers, never unofficial automation tools. |
| **Opt-in required** | Verbal consent captured on the call, timestamped and logged against the lead. No opt-in, no message. |
| **Template pre-approval** | Business-initiated messages must use Meta-approved templates. Approval is per template, per language. |
| **24-hour window** | Free-form replies only within 24 hours of the customer's last message. Outside it, templates only. |
| **Verified business profile** | Display name, logo and website verified. Without the green tick, our anti-fraud advice is undermined — we tell customers to check the official number. |
| **Opt-out honoured immediately** | Any STOP / "don't message" → automation halts within the same session and the lead is marked DND. |
| **No financial claims** | No returns, no profit language, no "zero tax". Templates are compliance-reviewed like any other published copy. |
| **No credentials** | Never request or accept OTP, PAN, bank details or documents over WhatsApp. |

**Single official number.** Publish it on `/support` and `/verify`. Every message we send must be
verifiable against a number the customer can look up independently — this is the same principle as
the rest of the site.

---

## 2. Sequence map

```
CALL ENDS
   │
   ├─ consent given? ── no ──▶ nothing sent. Lead → NOT INTERESTED / FOLLOW-UP
   │
  yes
   │
   ▼
Day 0  M1  Trust Pack          (within 5 min of call)
   │
   ▼
Day 1  M2  Verify              ── skip if verify_page_view already tracked
   │
   ▼
Day 2  M3  Pricing             ── skip if pricing_view already tracked
   │
   ▼
Day 3  M4  Platform demo       ── skip if platform_demo already tracked
   │
   ▼
Day 5  M5  KYC invitation      ── skip if kyc_start already tracked
   │
   ▼
Day 7  M6  Final check-in      ── last automated message. No further automation.
   │
   ▼
CLOSE: lead → FOLLOW-UP (manual, 30-day horizon) or NOT INTERESTED
```

### Global stop conditions

Automation halts **immediately and permanently** on any of:

- `DND` flag set
- Customer replies STOP / unsubscribe / "do not message"
- Account activated (sequence switches to the onboarding sequence, §5)
- Customer requests no contact on a call
- Lead marked `NOT INTERESTED`
- Hard bounce / number invalid
- Any complaint logged against the lead

### Global suppression rules

- **Never** more than one automated message per 24 hours
- **Never** between 21:00 and 09:00 IST
- Skip any message whose corresponding website event has already fired — do not ask someone to
  check pricing when they have already read the pricing page. Send the *next* one instead.
- If the customer replies at any point, **pause automation** and route to the assigned agent. A
  human reply outranks the sequence.

---

## 3. Message templates

> Placeholders: `{{1}}` customer name · `{{2}}` agent name.
> Links must be the plain published URLs, never shortened — link shorteners are a fraud signal and
> we spend the whole website telling customers to check URLs.

### M1 — Day 0: Trust Pack

**Category:** Marketing · **Sent:** within 5 minutes of the call

> Hi {{1}}, thank you for speaking with Trade Grow.
>
> As promised, here are our official details so you can check us yourself before deciding anything:
>
> 🔍 Verify our company & registration
> tradegrow.in/verify
>
> 💰 Full charge list (brokerage + statutory charges, shown separately)
> tradegrow.in/pricing
>
> 📱 See the platform
> tradegrow.in/platform
>
> We'd genuinely suggest starting with the first link. It takes about two minutes.
>
> — {{2}}, Trade Grow
>
> *Trade Grow will never ask for your OTP, password or PIN.*

**Buttons:** `VERIFY TRADE GROW` · `VIEW PRICING` · `SEE PLATFORM`

---

### M2 — Day 1: Verify

**Skip if:** `verify_page_view` already tracked for this lead.

> Hi {{1}}, one suggestion before you consider opening an account anywhere — including with us.
>
> Check the registration independently. Our details are here, and each one links to SEBI's own
> database or the exchange's own directory:
>
> tradegrow.in/verify
>
> These are sources we don't control and can't edit. That's the point of them.
>
> — Trade Grow

**Buttons:** `VERIFY DETAILS` · `I HAVE A QUESTION`

---

### M3 — Day 2: Pricing

**Skip if:** `pricing_view` already tracked.

> Hi {{1}}, here's the complete cost picture on a trade — brokerage and the statutory charges
> (STT, GST, stamp duty, exchange, SEBI, DP) shown as separate lines:
>
> tradegrow.in/pricing
>
> There's a calculator on that page. Put in a trade you'd actually place and compare it against
> what you pay today.
>
> Worth knowing: statutory charges are set by the government and exchanges and are identical at
> every broker. Only brokerage differs.
>
> — Trade Grow

**Buttons:** `VIEW PRICING` · `OPEN CALCULATOR`

---

### M4 — Day 3: Platform

**Skip if:** `platform_demo` already tracked.

> Hi {{1}}, here's a quick look at the Trade Grow platform — dashboard, watchlist, order screen,
> portfolio and funds:
>
> tradegrow.in/platform
>
> The order screen shows your estimated charges before you confirm, which is the part we think
> matters most.
>
> — Trade Grow

**Buttons:** `SEE PLATFORM` · `WATCH DEMO`

---

### M5 — Day 5: KYC invitation

**Skip if:** `kyc_start` already tracked. **Do not send** if the lead has never opened any link
(no engagement = not ready; let M6 close instead).

> Hi {{1}}, if you've had a chance to look at our details and charges, and you'd like to go ahead,
> account opening is fully digital and takes place entirely on your own phone:
>
> tradegrow.in/open-account
>
> A reminder that matters: every OTP in that process is entered by you, on the official screen.
> Nobody from Trade Grow will ever ask you for it.
>
> If you'd rather ask questions first, just reply here.
>
> — Trade Grow

**Buttons:** `START ACCOUNT OPENING` · `I HAVE QUESTIONS`

---

### M6 — Day 7: Final check-in

**Last automated message in the sequence.**

> Hi {{1}}, just checking whether you had a chance to look at the Trade Grow details.
>
> No rush at all from our side, and nothing expires. If it's not for you, that's completely fine —
> just let us know and we'll stop messaging.
>
> — Trade Grow

**Buttons:** `YES, I'VE LOOKED` · `I HAVE QUESTIONS` · `CALL ME` · `STOP MESSAGING`

---

## 4. Button routing

| Button | CRM effect |
|---|---|
| `VERIFY TRADE GROW` / `VERIFY DETAILS` | Stage → `TRUST VERIFICATION`, score +15 |
| `VIEW PRICING` / `OPEN CALCULATOR` | Stage → `WEBSITE VISITED`, score +15 |
| `SEE PLATFORM` / `WATCH DEMO` | Score +10 |
| `START ACCOUNT OPENING` | Stage → `KYC STARTED`, score +20, **automation pauses** |
| `I HAVE QUESTIONS` | Task to assigned agent, SLA 2 working hours, **automation pauses** |
| `CALL ME` | Callback task, SLA same day, **automation pauses** |
| `YES, I'VE LOOKED` | Task to agent for a human follow-up |
| `STOP MESSAGING` | `DND`, automation halted permanently, confirmation sent once |

---

## 5. Post-activation sequence (separate from acquisition)

Triggered on `ACCOUNT ACTIVATED`. Service messages, not marketing.

| Day | Message |
|---|---|
| 0 | Welcome + client code reminder + official contact numbers + the never-share-OTP rule |
| 1 | How to add funds safely (own bank account only; never to an individual) |
| 3 | How to read your contract note and where charges appear |
| 7 | Not funded yet? One check-in, then stop |
| 14 | Funded but not traded? Offer a walkthrough call, no pressure |
| 30 | Security reminder + how to raise a grievance and escalate past us |

**Referral messaging must not be sent until the referral programme has legal sign-off** (see
`docs/05-crm-and-lead-management.md` §7).

---

## 6. What must never be sent on WhatsApp

- Any APK, installer or app file
- Any request for OTP, PAN, bank details, or document images
- Any stock tip, target, recommendation or market call
- Any return, profit or "zero tax" claim
- Any group invite (we run no trading groups — and we tell customers that group invites are a
  fraud signal, so sending one would be self-defeating)
- Any shortened or redirect URL
- Any message from a number other than the published official number

---

## 7. Metrics

| Metric | Definition | Why it matters |
|---|---|---|
| Delivery rate | delivered / sent | Number quality |
| Read rate | read / delivered | Template and timing quality |
| Verify CTR | `/verify` clicks / M1 delivered | **The core trust metric** |
| Pricing CTR | `/pricing` clicks / M3 delivered | Cost-motivated interest |
| KYC start rate | `kyc_start` / sequence entered | Sequence effectiveness |
| Opt-out rate | STOP / delivered | **Alert if > 2%** — the sequence is annoying people |
| Complaint rate | complaints / delivered | **Alert on any occurrence** |
| Reply rate | inbound / delivered | Engagement quality |

**Verify CTR is the headline number for this funnel.** If customers are opening the pricing link
but not the verification link, the trust strategy is not landing and the call scripts need review —
not the templates.
