# Trade Grow — 1,000 Client Acquisition Plan & 30/60/90

---

## 1. The honest starting position

**We do not know our conversion rates.** Any plan that states "assume 2% lead-to-account" is
fabricating the single most important number in the model.

So this document does two things:

1. Defines the **funnel model** and how to compute required volumes from *whatever* the real rates
   turn out to be
2. Defines the **30/60/90 plan** whose primary purpose in the first 30 days is *measuring* those
   rates, not hitting a client target

An interactive calculator implementing this model ships at
**`tools/acquisition-calculator.html`** — open it in a browser, enter your actual observed rates,
and it computes required volumes, daily activity and headcount. No assumed numbers are baked in.

---

## 2. The model

```
Leads
  × connect rate              → Connected calls
  × interest rate             → Interested
  × verification rate         → Verified (visited /verify)
  × KYC start rate            → KYC started
  × KYC completion rate       → KYC completed
  × activation rate           → Activated
  × funding rate              → Funded
  × first-trade rate          → ACTIVE CLIENT
```

Working backwards from a target of **N active clients**:

```
Leads required = N ÷ (r_connect × r_interest × r_verify × r_kycstart
                      × r_kyccomplete × r_activate × r_fund × r_trade)
```

**Worked illustration only — these are not predictions.** They show how sensitive the model is:

| If every step ran at… | Leads needed for 1,000 active clients |
|---|---|
| End-to-end 1.0% | 100,000 |
| End-to-end 2.0% | 50,000 |
| End-to-end 3.0% | 33,333 |

A single percentage point of end-to-end conversion is the difference between 100,000 and 50,000
dials. **This is why the first 30 days must be spent measuring, not scaling.** Scaling on a guessed
rate is how call centres burn a lead database.

---

## 3. Capacity arithmetic

```
Dials per agent per day            = D
Working days per month             = W          (typically 22)
Agents                             = A
Monthly dial capacity              = D × W × A

Months to target = Leads required ÷ (D × W × A)
Agents required  = Leads required ÷ (D × W × months available)
```

Enter your real dial rate — measure it in week 1, do not assume it. It varies enormously with list
quality, dialler type and how long agents actually spend on each conversation. Our playbook
deliberately produces *longer* calls than a pure pitch, so a benchmark borrowed from another
call centre will overstate our capacity.

**Budget:**
```
Cost per lead       = total spend ÷ leads
Cost per activated  = total spend ÷ activated
Cost per funded     ← manage against this one
Payback (months)    = cost per funded ÷ expected monthly revenue per client
```

---

## 4. 30 / 60 / 90 day plan

### Days 1–30 — Measure, don't scale

**Goal: know our real conversion rates. Not a client count.**

| Workstream | Deliverable |
|---|---|
| Compliance | All regulatory config filled and signed off; `/verify` fully populated |
| Pricing | Brokerage plan approved; `ratesVerified = true` after rate reconciliation |
| Website | Live with real numbers; Lighthouse ≥ 90; analytics endpoint wired |
| Sales | 6–10 agents hired and trained on the playbook; QA scorecard running |
| CRM | Lead stages, scoring, followups, WhatsApp integration live |
| Data | **Every stage transition instrumented before the first dial** |
| Volume | A controlled test list — enough for statistical signal, not the whole database |

**Exit criteria (all must be true before increasing volume):**
- [ ] Measured connect, interest, verification, KYC-start and activation rates
- [ ] ≥ 50 completed KYCs, so the rates mean something
- [ ] Activation → funding rate measured per agent
- [ ] Zero unresolved compliance flags
- [ ] QA scores stable across agents

> Burning the whole lead database in month 1 to hit a vanity number destroys the asset that the
> other 11 months depend on. A cold list is consumable and non-renewable.

### Days 31–60 — Optimise

- Recompute required volume from **measured** rates using the calculator
- Fix the worst drop-off step first — usually KYC-start → KYC-complete, or activation → funding
- A/B test hero headline and CTA wording (never claim substance)
- Publish the first `/learn` SEO content and start measuring organic
- Review agent-level activation→funding; coach or remove pressure sellers
- Scale headcount **only after** the rates are stable

**Exit criteria:** stable rates; identified and improved the top drop-off; cost per funded client
known and trending down.

### Days 61–90 — Scale

- Scale lead volume and headcount against the recomputed model
- Diversify sources: organic, referral (if legally cleared), partners — not cold calling alone
- Launch the post-activation sequence to drive funding and first trade
- Begin retention work on the first cohort — dormancy is the silent killer of a client count
- Establish the quarterly compliance review cycle

---

## 5. Tracking cadence

**Daily:** leads assigned · dials · connects · interested · WhatsApp sent · verify visits ·
KYC starts · activations · funded · first trades · followups due vs done

**Weekly:** full funnel with drop-off; agent leaderboard **by funded clients**; source conversion;
QA scores; complaints; opt-out rate; cost per funded

**Monthly:** progress to 1,000; recomputed requirements; cohort retention; unit economics;
compliance review

---

## 6. Guardrails on the target

The 1,000-client goal must not override these. If the target and a guardrail conflict, **the
guardrail wins** — this needs to be stated to the sales floor explicitly and repeatedly.

| Guardrail | Threshold |
|---|---|
| Complaints per 100 activated accounts | Investigate above any non-zero trend |
| Activation → funding rate | < 60% of team median for an agent → coaching, then removal |
| Compliance flags | Any § 1 breach → immediate escalation, regardless of the agent's numbers |
| WhatsApp opt-out rate | > 2% → pause the sequence and review templates |
| DND compliance | 100%. No exceptions, no "one more try" |

**Commission must pay on funded, traded clients — never on KYC starts.** Paying on KYC starts
manufactures exactly the behaviour these guardrails exist to catch, and no amount of training
overcomes a compensation structure.

---

## 7. What would make the target unrealistic

Worth stating plainly so it can be discussed rather than discovered in month 9:

- **Registration details still pending at launch.** The entire strategy is verification; with
  nothing to verify, the trust argument collapses and conversion will be poor. This is the single
  largest risk to the plan.
- **Brokerage not competitive for the segments we target.** The calculator is honest, so prospects
  will see it immediately.
- **Lead list quality.** Recycled or untargeted lists produce low connect rates regardless of script
  quality.
- **Underestimating time-to-fund.** Activated ≠ funded. The gap is where new brokers lose people.

None of these are reasons not to proceed. They are reasons to measure in month 1 and re-plan in
month 2 with real numbers rather than defend an original projection.
