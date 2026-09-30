# Trade Grow — Design System

Implemented in `site/assets/css/styles.css`. No framework, no external fonts, no icon library.

---

## 1. Design intent

The site must read as **calm institutional infrastructure**, not as a sales page. Every visual
decision is downstream of one question: *does this make the customer more or less able to check us?*

| Do | Don't |
|---|---|
| Generous whitespace, clear hierarchy | Dense, banner-stacked layouts |
| One accent colour, used sparingly | Rainbow gradients |
| Real data structures (tables, key-value lists) | Decorative stock-market graphics |
| Static, legible numbers | Animated tickers, flashing P&L |
| Muted status colours | Alarming reds and greens as decoration |
| Neutral, factual imagery | Photos of people celebrating money |

**The visual restraint is the message.** A new broker that looks expensive and loud looks like the
scams customers have been warned about. Looking like a regulated utility is the point.

---

## 2. Colour tokens

```css
--ink:       #0A2540   /* primary text, deep navy — the institutional anchor */
--ink-2:     #1E3A5F   /* secondary text */
--muted:     #5A6B87   /* supporting copy */
--muted-2:   #617186   /* labels, captions */

--brand:     #1B4DFF   /* primary action. ONE accent, used sparingly */
--brand-700: #1039CC
--brand-100: #E8EEFF
--brand-50:  #F3F6FF

--teal:      #0FB5A5   /* secondary accent: logo, verify links on dark */
--teal-50:   #E9FAF8

--ok:        #0D7E57   --ok-50:     #E8F7F0   /* verified */
--warn:      #9F5E0A   --warn-50:   #FDF4E5   /* pending / illustrative */
--danger:    #C0342B   --danger-50: #FDEEED   /* fraud warnings only */

--bg:        #FFFFFF   --bg-tint:  #F7F9FC   --bg-deep: #071B31
--line:      #E3E8F0   --line-2:   #EDF1F7
```

### Semantic colour rules

| Colour | Reserved for | Never for |
|---|---|---|
| `--brand` | Primary CTAs, links, active nav | Decoration, backgrounds at scale |
| `--ok` | Verified status only | Profit, gains, "good news" |
| `--warn` | Pending values, illustrative labels | Urgency, promotions |
| `--danger` | Fraud warnings, OTP notices | Losses, downward price moves as decoration |

> `--ok` green marks *verified*, not *profitable*. Using the same green for both would let a status
> indicator read as a performance claim.

**Contrast — computed, not asserted.** Run `node build/contrast.js`; it reads the tokens straight
out of `styles.css`, so this table cannot drift from the stylesheet. All 14 pairs that occur in the
rendered site clear WCAG AA for small text (4.5:1):

| Pair | Ratio |
|---|---|
| `--ink` on white | 15.54:1 |
| `--ink-2` on white | 11.50:1 |
| `--brand` on white | 5.91:1 |
| `--danger` on white | 5.57:1 |
| `--muted` on white | 5.40:1 |
| `--warn` on white | 5.15:1 |
| `--ok` on white | 5.07:1 |
| `--muted` on `--bg-tint` | 5.12:1 |
| `--muted-2` on white | 4.98:1 |
| `--danger` on `--danger-50` | 4.94:1 |
| `--muted-2` on `--bg-tint` | 4.72:1 |
| `--warn` on `--warn-50` | 4.72:1 |
| `--ok` on `--ok-50` | 4.59:1 |

> An earlier version of this document claimed 5.9:1 for `--muted` on white. The real figure is
> 5.40:1 — it passes, but the number was wrong because it was written rather than calculated.
> Three tokens genuinely failed and were darkened: `--muted-2` (3.07 → 4.98), `--ok` (4.36 → 5.07)
> and `--warn` (4.26 on `--warn-50` → 4.72). The `--warn` pair is the `.pending` badge, the single
> most important component on the site, and it was failing AA.

**Two exceptions handled separately:**

- **The dark terminal mock** on `/platform/` re-points `--muted`, `--muted-2`, `--ok` and `--danger`
  inside `[data-theme="dark"]`, because light-theme tokens fall to ~3:1 on a dark surface.
- **The WhatsApp CTA** (`.btn--wa`, `.fab--wa`) keeps the brand green `#25D366` but uses dark ink
  text. White on that green is **1.98:1** — a well-known brand-colour trap. Dark ink gives 7.83:1
  and keeps the green recognisable.

---

## 3. Typography

System font stack — **deliberately no web font**:

```css
--font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, "Noto Sans", sans-serif;
```

Zero font requests, no FOUT, no layout shift, no third-party connection. On a site whose CSP and
`/security` page promise no external resources, a Google Fonts request would be a contradiction.

> If brand insists on Inter, **self-host it** (`woff2`, `font-display: swap`, preloaded, subset to
> Latin + Devanagari if needed). Do not link `fonts.googleapis.com`.

### Scale (fluid, `clamp()`)

| Token | Size | Tracking |
|---|---|---|
| `.h1` | `clamp(2rem, 1.35rem + 2.7vw, 3.35rem)` | −0.032em |
| `.h2` | `clamp(1.55rem, 1.2rem + 1.5vw, 2.3rem)` | −0.026em |
| `.h3` | `clamp(1.25rem, 1.1rem + .7vw, 1.6rem)` | −0.021em |
| `.h4` | 1.125rem | |
| body | 16px / 1.65 | |
| `.lede` | `clamp(1.02rem, .97rem + .28vw, 1.16rem)` | max 66ch |
| `.small` | 0.875rem | |
| `.eyebrow` | 0.78rem, 700, uppercase, 0.1em | |

Negative tracking on large headings is what produces the "modern fintech" feel without a custom
typeface. Measure capped at 66–72ch for readability.

**Tabular numerals** (`font-variant-numeric: tabular-nums`) on every price, charge and calculator
figure so digits align in columns.

---

## 4. Spacing, shape, elevation

Sections: `clamp(48px, 5.5vw, 88px)` vertical. Container: 1140px, 20px side padding (never zeroed —
the mobile gutter rule).

Radii: `8px` small · `14px` default · `22px` large.

Three shadow levels only. Elevation encodes importance, not decoration:

```css
--sh-1: 0 1px 2px rgba(10,37,64,.05), 0 1px 3px rgba(10,37,64,.04);   /* cards, panels */
--sh-2: 0 4px 12px rgba(10,37,64,.06), 0 1px 3px rgba(10,37,64,.04);  /* hover */
--sh-3: 0 18px 44px rgba(10,37,64,.10), 0 2px 8px rgba(10,37,64,.05); /* device mock, FAB */
```

Glassmorphism is used in exactly two places — the sticky header and the mobile sticky CTA — where a
translucent surface genuinely helps content scroll underneath. Nowhere else.

---

## 5. Components

| Class | Purpose |
|---|---|
| `.btn--primary / --secondary / --ghost` | Blue fill / navy fill / white outline |
| `.trustbar` | Dark band under the hero. Six fields, each with a `Verify →` outbound link |
| `.pending` | **The most important component.** Amber badge for unverified values |
| `.pill--ok / --warn / --na` | Verification checklist statuses |
| `.tag--tg / --stat` | "Trade Grow" vs "Statutory" on pricing rows |
| `.card` | Standard content card, subtle hover lift |
| `.panel` + `.kvlist` / `.kv` | Key-value fact blocks on `/verify` |
| `.table--pricing` | Brokerage row tinted blue; statutory rows neutral |
| `.notice` / `--warn` / `--danger` / `--ok` | Left-bordered callouts |
| `.otp-warning` | Red-bordered OTP notice. Appears on home, `/open-account`, `/security-awareness` |
| `.flags` / `.never` | Red-flag checklists |
| `.calc` / `.calc__out` | Calculator; dark output panel, sticky on desktop |
| `.steps` | Numbered process lists (CSS counters) |
| `.empty-state` | Honest empty states — used for testimonials |
| `.illustrative` | Amber pill for non-real interfaces |
| `.sticky-cta` | Mobile-only bottom bar: Verify · Pricing · Call · Open |
| `.fab--wa` | WhatsApp FAB, only rendered when configured |

### `.pending` — the system's keystone

```css
.pending{
  display:inline-block; font-size:.8em; font-weight:600;
  color:var(--warn); background:var(--warn-50);
  border:1px solid #F0DCB8; border-radius:6px; padding:1px 8px;
}
```

It has dark-background variants for the trust bar and footer. It is emitted automatically by
`build/components.js` whenever a config value is null. **A designer must never restyle this into
invisibility** — its visual prominence is a compliance control, not an aesthetic choice.

---

## 6. Responsive

Mobile-first. Breakpoints: `560` · `760` · `900` · `980` · `1040`.

| Width | Behaviour |
|---|---|
| < 760 | Sticky CTA bar appears; WhatsApp FAB shrinks to icon and lifts above the bar |
| < 900 | Hero stacks; calculator stacks |
| < 980 | Nav collapses to hamburger |
| < 560 | `.kv` rows stack label above value |

**Rules:**
- Side gutter ≥ 20px at every width, set once on `.wrap`
- Tap targets ≥ 44px
- Tables wrap in `.table-scroll` (`overflow-x:auto`) — the page body never scrolls horizontally
- All type in relative units

> ~70% of traffic is expected on mobile, so the mobile sticky bar carries `Verify` as its **first**
> item. On the smallest screen, verification is still one tap away.

---

## 7. Accessibility

- Semantic landmarks; single `<h1>` per page; no skipped heading levels
- Skip link to `#main`
- `:focus-visible` — 2px brand outline, 2px offset, never removed
- Tables use `<caption class="sr-only">`, `scope` on every header cell
- FAQ uses native `<details>/<summary>` — keyboard and screen-reader accessible without JS
- Calculator output is `aria-live="polite"`
- Nav toggle has `aria-expanded` / `aria-controls`
- Icons `aria-hidden`; meaning always carried by adjacent text
- `prefers-reduced-motion` disables transitions and smooth scrolling
- Colour never carries meaning alone — every status pill pairs a glyph with a text label
- Tab widgets follow the WAI-ARIA Tabs pattern: roving tabindex, Arrow/Home/End keys, and
  aria-selected kept in sync. Implemented generically in app.js for any [role="tablist"]

Measured: Lighthouse Accessibility 100 on every page checked. Contrast computed by build/contrast.js.
Keyboard behaviour manually audited (see docs/02 §5). Screen-reader output remains untested.

---

## 8. Motion

Transitions 120–180ms, `ease`. Used only for: button press, card hover lift, nav toggle, FAQ
disclosure arrow.

**No** scroll-triggered animation, parallax, counting numbers, or auto-advancing carousels. All
disabled under `prefers-reduced-motion`.

> Animated counters on a broker site imply performance. Even counting up a customer number reads as
> a growth claim we cannot substantiate.

---

## 9. Imagery

**Currently zero raster images** — the entire site is HTML, CSS and inline SVG. This is why total
page weight stays under 250KB and Lighthouse Performance stays high.

When images are added:
- WebP with a JPEG fallback, explicit `width`/`height` (prevents CLS), `loading="lazy"` below fold
- App screenshots must be **real captures**, or carry the `.illustrative` label
- No stock photography of people with money, charts trending up, or bulls
- Logo lockups only from the approved brand file

---

## 10. Extending the system

1. **Reuse before adding.** Most new needs are a `.card`, `.panel` or `.notice`.
2. **Use tokens.** No hardcoded hex values in component CSS.
3. **Check contrast** before committing a colour.
4. **Test at 375px** before merging.
5. **Never restyle `.pending` to be subtle.**
6. **Adding a dependency to the marketing site requires a security review** — it breaks the CSP and
   contradicts the claims on `/security`.
