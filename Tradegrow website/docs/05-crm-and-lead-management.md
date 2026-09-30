# Trade Grow — CRM, Lead Management & Acquisition Operations

**Status:** Specification. Not yet built.

---

## 1. Lead lifecycle

```
NEW ──▶ CONTACTED ──▶ INTERESTED ──▶ TRUST VERIFICATION ──▶ WHATSAPP SENT
                                                                  │
                                                                  ▼
                                                          WEBSITE VISITED
                                                                  │
                                                                  ▼
                            KYC STARTED ──▶ KYC COMPLETED ──▶ ACCOUNT ACTIVATED
                                                                  │
                                                                  ▼
                                    FIRST FUNDING ──▶ FIRST TRADE ──▶ ACTIVE
```

**Terminal / side states:** `FOLLOW-UP` · `NOT INTERESTED` · `DND`

### Stage definitions — these must be unambiguous or the funnel numbers are worthless

| Stage | Entry condition | Owner |
|---|---|---|
| `NEW` | Lead created, never dialled | System |
| `CONTACTED` | Call attempted, regardless of connection | Agent |
| `INTERESTED` | Connected **and** customer agreed to receive details | Agent |
| `TRUST VERIFICATION` | `verify_page_view` fired, or customer asked a registration question | System / Agent |
| `WHATSAPP SENT` | M1 delivered (not merely sent) | System |
| `WEBSITE VISITED` | Any tracked page view attributed to the lead | System |
| `KYC STARTED` | Onboarding step 1 completed | System |
| `KYC COMPLETED` | Application submitted, e-sign done | System |
| `ACCOUNT ACTIVATED` | Client code issued | System |
| `FIRST FUNDING` | First credit to trading account | System |
| `FIRST TRADE` | First executed order | System |
| `ACTIVE` | ≥ 1 trade in trailing 30 days | System (nightly job) |
| `FOLLOW-UP` | Agreed future contact date exists | Agent |
| `NOT INTERESTED` | Explicit decline | Agent |
| `DND` | Requested no contact, or on NDNC | Agent / System |

**Rule: stages after `WHATSAPP SENT` are set by the system, never by an agent.** Agents must not be
able to mark a lead as KYC-completed. This removes the incentive to inflate the funnel and keeps
the conversion data honest.

**`DND` is irreversible** without a Compliance-role override plus an audit-logged reason.

---

## 2. Data captured per lead

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | |
| `phone` | string, encrypted at rest | Unique index. Primary dedupe key |
| `email` | string, encrypted at rest | Nullable |
| `city`, `state` | string | |
| `source_id` | fk → `lead_sources` | |
| `campaign_id` | fk → `campaigns` | |
| `assigned_agent_id` | fk → `employees` | |
| `stage` | enum | Per §1 |
| `score` | int 0–100 | Per §3 |
| `existing_broker` | string | Free text from discovery |
| `trading_frequency` | enum | daily / weekly / monthly / rare / none |
| `segments_traded` | set | delivery, intraday, fno, currency, commodity |
| `primary_concern` | text | **In the customer's own words** |
| `last_objection` | enum | Links to script library |
| `whatsapp_consent` | bool + timestamp | No consent, no message |
| `whatsapp_status` | enum | not_sent / sent / delivered / read / replied / opted_out |
| `first_contacted_at`, `last_activity_at` | timestamp | |
| `next_followup_at` | timestamp | Drives the daily queue |
| `dnd` | bool | |
| `dnd_reason`, `dnd_set_by`, `dnd_set_at` | | Audit trail |
| `kyc_status` | enum | not_started / started / submitted / rejected / completed |
| `client_code` | string | Populated on activation |
| `activated_at`, `first_funded_at`, `first_traded_at` | timestamp | |

**Website behaviour** (joined from `website_events`, not duplicated on the lead):
`visited_site`, `visited_verify`, `visited_pricing`, `used_calculator`, `visited_compare`,
`visited_platform`, `clicked_whatsapp`, `clicked_call`.

### Attribution

Attribute website events to a lead via a signed, short-lived `lead_ref` parameter on WhatsApp links
only — never by matching phone numbers in URLs. The parameter maps server-side to a lead id and is
stripped before any analytics write. **Never put a phone number, PAN or email in a URL.**

---

## 3. Lead scoring (100 points, admin-configurable)

Every weight below lives in a `scoring_rules` table editable by Admin, with an audit log on change.
These are **starting values, not fixed truths** — tune them against real conversion data after the
first 60 days.

### Positive

| Signal | Points |
|---|---|
| Existing active trader | +20 |
| Has an existing demat account | +10 |
| Expressed interest in reducing costs | +15 |
| Visited pricing page | +15 |
| Visited verification page | +15 |
| Used the cost calculator | +10 |
| Visited comparison page | +8 |
| Replied on WhatsApp | +10 |
| Requested a callback | +12 |
| Started KYC | +20 |
| Completed KYC | +25 |
| First funding | +30 |

### Negative

| Signal | Points |
|---|---|
| DND | −100 (hard floor to 0) |
| Not interested | −50 |
| Invalid / unreachable number | −100 |
| No engagement after full WhatsApp sequence | −15 |
| Three connected calls with no progression | −10 |

Score is clamped to 0–100. Recomputed on every event.

### Priority bands

| Band | Score | Treatment |
|---|---|---|
| **A** | 70–100 | Call same day. Senior agent. |
| **B** | 40–69 | Call within 48h. Standard sequence. |
| **C** | 15–39 | WhatsApp-first. Call only on engagement. |
| **D** | 0–14 | No outbound calling. Nurture only, or archive. |

**Note the design intent:** visiting `/verify` scores as highly as visiting `/pricing`. A customer
doing due diligence is a *better* prospect than one shopping on price alone — they are more likely
to fund and stay.

---

## 4. Agent dashboard

**Today**
- Leads assigned · Calls made · Connected · Connect rate
- Follow-ups due today (**always at the top — these outrank new leads**)
- Interested · WhatsApp sent · Verification page visits
- KYC started · completed · Accounts activated · First funding · First trade

**Queue order (enforced by the system, not left to the agent):**
1. Overdue callbacks
2. Today's callbacks
3. Band A leads
4. Band B leads
5. New leads

**Personal funnel:** a visual conversion funnel for the agent's own leads, current month, with
their conversion rate at each step against the team median.

---

## 5. Manager dashboard

**Volume:** total leads · calls · connected · connect rate · talk time
**Funnel:** every stage transition with count, conversion % and drop-off %
**Trust metrics:** verification page visits · calculator uses · comparison views
**Outcomes:** KYC started / completed · activated · funded · first trade
**Cuts:** by agent · by source · by campaign · by city · daily / weekly / monthly

**Quality metrics — weight these equally with volume:**
- QA score by agent (§7 of the call playbook)
- Compliance flags raised
- Complaints per 100 activated accounts
- **Activation-to-funding rate by agent** — a low rate here means the agent is pushing people into
  KYC who were never ready. It is the clearest early signal of pressure selling.

**Charts:** funnel bar, daily trend line, agent leaderboard (by *funded* clients, not calls),
source conversion comparison, cohort retention.

---

## 6. Automated follow-up engine

Configurable per campaign. Defaults:

| Day | Action | Channel |
|---|---|---|
| 0 | Trust pack | WhatsApp |
| 1 | Verification nudge | WhatsApp |
| 2 | Pricing | WhatsApp |
| 3 | Platform demo | WhatsApp |
| 5 | KYC reminder | WhatsApp |
| 7 | Final check-in | WhatsApp |
| 10 | Agent call task (manual) | Phone |

**Stop conditions:** DND · unsubscribed · account activated · customer requested no contact ·
complaint logged · number invalid.

**Admin controls:** enable/disable per campaign, edit day offsets, edit templates (Compliance
approval gate), set quiet hours, set max messages per lead per week, global kill switch.

**The global kill switch is a requirement, not a nice-to-have.** One badly approved template sent to
ten thousand people is a regulatory incident.

---

## 7. Referral programme — gated

Track: referrer · referred lead · stage · KYC status · activation · eligibility · reward status.

> **Do not activate any referral incentive until Legal and Compliance have confirmed it against the
> applicable regulatory position on referral and remuneration arrangements for stock brokers.**
> Build the tracking; leave the payout disabled behind a feature flag.

Referral messaging must not be included in the acquisition WhatsApp sequence — only in the
post-activation sequence, and only once enabled.

---

## 8. Roles and permissions

| Role | Capabilities |
|---|---|
| `SUPER_ADMIN` | Everything, including role management and config. Cannot delete audit logs. |
| `ADMIN` | CMS, pricing config, scripts, templates, campaigns, user management |
| `MANAGER` | All dashboards, all leads, reassignment, QA review |
| `TEAM_LEADER` | Own team's leads and dashboards, reassignment within team |
| `SALES_EXECUTIVE` | Own assigned leads only. Cannot export. Cannot set stages past `WHATSAPP SENT`. |
| `SUPPORT` | Tickets, grievances. Read-only on leads. |
| `COMPLIANCE` | Read-all, audit logs, script/template approval, DND override, complaint records. **Cannot be modified by ADMIN.** |

**Audit-logged actions:** any config or pricing change · script/template approval · role change ·
lead export · DND override · bulk reassignment · any read of a full phone/email list · deletion of
any record.

Audit logs are append-only. No role can delete them.

### Data minimisation

- Agents see the phone number only in the dialler, masked in list views (`98••••3210`)
- No agent can export lead lists; exports are Manager+ and are audit-logged with row counts
- PAN, bank details and KYC documents **never enter the CRM** — they live only in the regulated
  onboarding system. The CRM stores a KYC *status*, never KYC *data*.

That last rule is the single most important line in this document. It bounds the blast radius of a
CRM compromise to names and phone numbers rather than to full KYC packs.

---

## 9. Call recording analysis (conditional)

**Only if legally permitted and with disclosed consent at the start of every recorded call.**

Analyse: opening quality · customer intent · objection raised · agent response quality ·
talk/listen ratio · repeated mistakes · missed opportunities · **compliance violations** ·
recommended next action.

**Priority order for the model's output:** compliance violations first, coaching second, sales
optimisation third. A system that surfaces "best performing patterns" but misses an agent asking for
an OTP is worse than no system.

Retention: per policy, minimum necessary. Recordings are Compliance-access only; agents and
managers see derived scores, not raw audio of other agents' calls.

Do not publish "best-performing sales patterns" as claims about outcomes. They are internal
coaching hypotheses, not evidence.
