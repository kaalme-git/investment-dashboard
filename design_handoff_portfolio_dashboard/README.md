# Handoff: Stock Portfolio Dashboard

## Overview
A web-based dashboard for **managing and analyzing a multi-asset investment portfolio**. It
covers: a live overview (KPIs + allocation + holdings), allocation analytics, a full holdings
table, transaction import, a watchlist, an Inderes research feed, a written investment strategy
with target allocations, and a forward-looking projection calculator.

The product is built on the **Inderes Design System** (Finnish investor-media / equity-research
platform). Copy is in **English**. Numbers use the Inderes Mono numeric stack. The dashboard is
**read-only analytics**; mutation (adding/editing transactions) lives in its own **Transactions**
section.

## About the Design Files
The files in this bundle are **design references created in HTML/CSS/JS** — a working prototype
showing the intended look, layout, copy, and interactions. **They are not production code to copy
directly.**

The prototype is authored as a single "Design Component" (`Portfolio Dashboard.dc.html`) that runs
on a small in-house runtime (`support.js`). The markup is a lightweight template language and the
logic is a `class Component` with `state` + `renderVals()`. **Do not port the runtime.** Instead,
**recreate these designs in the target codebase's own environment** (React, Vue, Svelte, etc.) using
its established component library, state, routing, and data-fetching patterns. If no environment
exists yet, pick the most appropriate modern framework (React + TypeScript is a safe default) and
build there.

The logic class shows the intended data shapes and calculations (allocation rollups, cost-basis
math, the projection model) — read it as a **spec for behavior**, then implement idiomatically.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, and interactions are
all settled and pulled from the Inderes Design System tokens. Recreate the UI faithfully using the
codebase's existing primitives, matching the tokens listed below. All portfolio numbers in the
prototype are **representative mock data** — wire real data in their place.

## Screenshots
Reference captures of each screen live in `screenshots/` (PNG). They are **snapshots of the HTML
prototype** for visual reference — the live `.dc.html` and this README remain authoritative if they
ever disagree. Wider screens are captured at full width; the taller screens (overview, holdings,
transactions) are scaled to fit in one frame, so they read smaller — open the prototype for those
at full size.

- `screenshots/01-dashboard-overview.png` — Dashboard → Overview (KPIs, value chart, Asset-default donut, AI box, holdings table)
- `screenshots/02-allocation.png` — Dashboard → Allocation (donut + dynamic "Allocation over time" with a band highlighted)
- `screenshots/03-holdings.png` — Dashboard → Holdings (full per-instrument table, grouped with subtotals)
- `screenshots/04-transactions.png` — Transactions (sample CSV imported: summary, positions, history)
- `screenshots/05-watchlist.png` — Watchlist
- `screenshots/06-company-page.png` — Company page (ASML: metrics, Inderes research, notes)
- `screenshots/07-research.png` — Research feed
- `screenshots/08-strategy.png` — Strategy (text, target allocation, drift, guidelines)
- `screenshots/09-calculations.png` — Calculations (assumptions + projection chart vs target)

## Tech / data notes for the implementer
- **Mock data lives in `renderVals()`** inside the `.dc.html` — the holdings array, sector/region
  classifications, prices, ratings, transaction list, research items, etc. Treat these as the
  **data contract** (field names + shapes) the real backend/API should satisfy.
- **No live market data or Inderes connector is wired.** Research items and live prices are
  placeholders. In production these come from: (a) a market-data provider keyed by ticker for
  price/day-change/value, and (b) the Inderes research API/MCP for reports & news. The UI already
  has the "connector-style" affordances (`inderes · connected` indicator, PREMIUM badges).
- **The AI "Ask about my portfolio" box** is wired to a Claude completion call in the prototype and
  is grounded with the portfolio holdings + the user's written strategy. Replace with your app's
  LLM/backend call; keep the grounding context (holdings + strategy + targets).
- **Persistence**: watchlist entries and per-company notes are stored in `localStorage`
  (keys `pf_watchlist`, `pf_notes.<TICKER>`). Replace with real user storage.

---

## Navigation / Information Architecture
A sticky top nav (height **56px**) with the lowercase `inderes` wordmark, a `/ Portfolio` slug, and
these primary sections (left to right), plus search/notifications/avatar on the right:

1. **Dashboard** — overview, with sub-tabs: **Overview · Allocation · Holdings**
2. **Transactions** — CSV import + computed positions/history
3. **Watchlist** — tracked (not-yet-held) companies + per-company pages
4. **Research** — Inderes reports & news (Equity / Market / Macro), report detail view
5. **Strategy** — written strategy + target allocations + drift
6. **Calculations** — forward projection of portfolio value vs. a target

Clicking a holding row or a research report opens a **Company page** (metrics + notes + that
company's research) or a **Report page**. A `← Back` control returns to the originating view.

---

## Screens / Views

### 1. Dashboard → Overview
**Purpose:** at-a-glance health of the portfolio.
**Layout:** subhead (title `Dashboard` + as-of timestamp on the left; benchmark selector on the
right) → sub-tab row → body.
- **KPI strip** (`.kstrip`): a single bordered row of cells (`grid-template-columns:repeat(7,1fr)`),
  each cell an uppercase label (`.klbl`, 11px) over a large mono number (`.knum`, 19px/700). Metrics:
  Total value, Day P/L, Total return, Invested, Realized, Dividends (TTM), Cash. Positive = green
  `--c-fg-success`, negative = red `--c-fg-error`.
- **Allocation card** (`.alloccard`): a donut (200×200, center shows the selected dimension's headline)
  with a toggle across **Sector / Region / Asset class / Style** (**defaults to Asset class**), and a
  legend with mini weight bars (`.legrow.alrow`). Order: largest → smallest, **Cash always last**.
  Hovering a legend row or donut slice dims the others (shared `hoverAlloc` state).
- **Holdings preview** (`.hrow` grid): top holdings with logo tile, name + ticker, weight bar, value,
  day change, and an Inderes recommendation pill. "See all" jumps to the Holdings tab.
- **"Ask about my portfolio"** box: free-text input → AI answer grounded in holdings + strategy.

### 2. Dashboard → Allocation
**Purpose:** diversification analysis.
- Current allocation (donut + bars) for the selected dimension, **plus a 100% stacked area chart**
  showing how the mix has drifted over time. The stacked area is **dynamic like the donut**: it tracks
  the same dimension toggle, and it shares the `hoverAlloc` state — hovering a band (or a legend row,
  or a donut slice) dims the other bands across all three, and a caption above the chart reads out the
  hovered band's label + current weight (e.g. "Equities · 83.7% today").
- Asset-class lens groups into four buckets: **Equities** (direct stocks + equity funds combined),
  **Fixed income**, **Alternatives**, **Cash & equivalent**.

### 3. Dashboard → Holdings
**Purpose:** full per-instrument detail.
- Table grouped by asset class with **subtotals** (subtotal weight/value rendered in Inderes Mono
  SemiBold **600** — note: 700 has no matching numeric face and falls back, so use 600 for bold mono).
- Columns: instrument (logo + name + ticker), shares, avg cost, last price, market value, day %,
  total return %, weight, dividend yield, Inderes rating. Shares & avg cost derive from transactions;
  price/value/return/yield from market data.

### 4. Transactions
**Purpose:** import history and derive positions (mutation lives here, not on the dashboard).
- **Upload**: drag-and-drop or click-to-browse a `.csv`. Flexible header parsing for
  date, type (Buy/Sell/Dividend), ticker, name, quantity, price, fee, currency.
- **Two import modes**: **Refresh all** (rebuild, replacing everything) or **Add latest only**
  (append to existing history).
- **Computed output**: import summary (transactions, instruments, open positions, net invested,
  date range), a **Resulting positions** table (net shares, avg cost, invested), and a color-coded
  **Transaction history**.
- A "Try with sample data" button loads a 13-row demo.
- *Known gap*: a bare transaction file has no sector/region/price/rating data, so importing does not
  yet re-drive the dashboard charts — that requires a market-data lookup by ticker (documented in-UI).

### 5. Watchlist
**Purpose:** track companies under consideration (not held).
- Add by ticker (+ optional name); remove; per-row notes preview; status label
  **Portfolio / Watchlist / Inactive**.
- Notes + watchlist persist in `localStorage` and survive portfolio re-imports. Removing from the
  watchlist keeps notes (becomes **Inactive**); nothing is auto-deleted.

### 6. Company page (opened from Holdings / Watchlist / Research)
- Subhead: `← Back`, company name, ticker, status badge.
- **Metrics grid** (held companies): last price, market value, day %, total return %, weight, shares,
  avg cost, dividend yield, Inderes rating. Watchlist-only companies show a "not held — add via a
  transaction to populate metrics" note instead.
- **Inderes research** list: that company's reports (click → report page).
- **My notes**: editable textarea, persisted per ticker.

### 7. Research
**Purpose:** Inderes reports & news for portfolio + watchlist companies.
- Sub-tabs: **Equity research / Market research / Macro research**.
- Each item: type badge (Report / Update / News), title, company · ticker · date, optional PREMIUM
  badge, recommendation pill, and an `inderes` source tag. Clicking an item opens the **Report page**
  (header + abstract; demo content, replace with real report body/PDF).
- An `inderes · connected` indicator denotes the (future) data source.

### 8. Strategy
**Purpose:** written investment policy + targets that drive drift analysis and ground the AI.
- Editable **strategy text**.
- **Target allocation** table (asset class): Equities, Fixed income, Alternatives are **editable
  inputs**; **Cash & equivalent is the auto-calculated remainder** (100 − others). Columns: current %,
  target % (with target marker), drift. Editable inputs carry a fixed `%`; cleared inputs render
  **empty** but count as 0; the residual is **clamped ≥ 0**.
- **Active vs passive** targets: **Active** is editable, **Passive** = 100 − Active (read-only).
- **Guidelines** grid.
- Targets feed the AI ("Am I on strategy?") and the Calculations contribution split.

### 9. Calculations
**Purpose:** project portfolio value forward under user assumptions, against a target.
- **Assumptions card**: per asset class **Expected return / yr** (editable %, 4 rows: Equities, Fixed
  income, Alternatives, Cash & equivalent). Footer: **Monthly investment (€)**, **Horizon**
  (5y / 10y / 20y / 30y segmented), **Target portfolio size (€)** (wide input, thousand-separated),
  and a note that new money is invested at target allocation.
  *(Volatility was intentionally removed — return-only model.)*
- **Result KPI strip** (4): Projected value · Ny, Invested capital, Of which contributions,
  Expected gain.
- **Projection chart**: monthly compounding per class (`v = v·(1+r/12) + monthly·targetWeight`),
  rolled up to yearly points. Interactive line chart with **euro Y-axis**, **calendar-year X-axis**,
  a dashed red **target** line, hover crosshair + tooltip (year + value), and a soft area fill.
- **Target note**: states the year the expected path reaches the target, or the shortfall if not
  reached within the horizon.

> **Chart gotcha for re-implementation:** the prototype SVG is stretched to fill width
> (`preserveAspectRatio:none`), which would distort `<text>`. Axis labels are therefore rendered as
> **HTML overlays positioned by %**, not as SVG text. In a real charting lib (Recharts, visx, ECharts,
> D3) this is moot — just don't put live text inside a non-uniformly-scaled SVG.

---

## Interactions & Behavior
- **Section nav**: switches the main view; active link is solid black (`.navlink.on`), others muted.
- **Sub-tabs / segmented toggles** (`.tab`, `.pbtn`): active = solid black pill / muted fill; **color
  cross-fade only, no motion** (Inderes house style — restrained, 150–250ms ease-out max).
- **Allocation dimension toggle**: re-renders donut + legend **and the stacked-area chart** (they share
  the dimension and the `hoverAlloc` highlight state); recompute rollups client-side.
- **Hover**: default pattern is fill→`--background-dark` + text→white; icon buttons get a
  `--c-bg-muted` wash; chart shows crosshair + tooltip.
- **CSV import**: drag-over highlight; parse → preview summary → apply (refresh/append).
- **Editable targets / assumptions**: live recompute of drift, residual cash/passive, and the entire
  projection on every change. Cleared numeric inputs show empty but compute as 0; residuals clamp ≥ 0.
- **Back navigation**: company/report pages remember and return to the originating section.
- **No bouncy springs, no parallax.** Live indicators (if any) blink ~1s.

## State Management
Needed state (from the prototype's `state`):
- `navView` — active section/sub-view (`dashboard` + tab, `transactions`, `watchlist`, `research`,
  `strategy`, `calc`, `company`, `report`) and `prevView` for back-nav.
- `selTicker` / `selReport` — currently opened company / report.
- Dashboard: `allocDim` (sector|region|asset|style, **default `asset`**), `benchmark`, active dashboard `tab`, `period`.
- Research: `resTab` (equity|market|macro).
- Strategy: `strategyText`, `targets` (per-asset-class target %), `activeTarget`.
- Calculations: `calcRet` (per-class expected return), `calcMonthly`, `calcYears`, `calcTarget`,
  `calcHover` (chart hover index).
- Persisted: `watchlist[]`, `notes{ticker:text}` (localStorage).
- AI: `aiPrompt`, `aiAnswer`, `aiAsked` (loading/asked flags).

Data fetching (production): holdings + lots (from transactions), live prices/day-change by ticker,
sector/region/asset/style classification by instrument, Inderes ratings, dividend data, and the
research feed.

---

## Design Tokens
All tokens come from the **Inderes Design System** (`colors_and_type.css`, included in this bundle).
Use the codebase's equivalent if it already wraps Inderes; otherwise import these CSS variables.

**Brand / core**
- Brand blue `--c-brand-blue` **#0000E6** (Figma chart stroke variant #2E2EFF); dark/hover
  `--c-brand-blue-dark` **#0051AD**
- Near-black #000 / white #fff carry most of the page
- Warm-grey neutrals: #F8F8F8 → #EFEFEF → #E7E7E7 → #D9D9D9 → #474747

**Status**
- Success (positive) `--c-fg-success` **#256100**
- Error (negative) `--c-fg-error` **#AD0101**
- Premium `--c-premium` **#FFA31C**
- Live red `--c-live-red`

**Recommendation pills** (dedicated scale — never reuse success/error)
- Buy `.rec.buy` bg #EAF4E6 / text #2F6B1F
- Accumulate `.rec.accu` bg #EEF1EA / text #566B45
- Hold `.rec.hold` bg #EFEFEF / text #5C5C5C
- Reduce `.rec.redu` bg #FBEEE9 / text #B2492F
- Sell `.rec.sell` bg #FAE9E8 / text #A52420

**Borders & surfaces**
- 1px is the only border weight. Card divider `--c-br-subtle` #E7E7E7; input border `--c-br-muted`
  #D9D9D9. Card fill `--c-bg-surface` #fff; muted wash `--c-bg-muted`.

**Typography**
- Family: **GT America** (aliased `"Inderes"` / `--font-family`) — Standard for body, Condensed for
  display/CTAs. Numerics: **Inderes Mono** (`--font-family-mono` — Inconsolata + Chivo Mono blended,
  Chivo restricted to digits & a few symbols via `unicode-range`).
- Scale (from tokens): display, h1 2.25rem, h2 2rem, h3 1.75rem, body 1.125rem, meta 0.875rem.
  Prototype specifics: section title 26px/700, card title 16px/700, KPI number 19px/700,
  nav/link 14px/600, axis labels 10px mono.
- Letter-spacing `--letter-spacing` ≈ 0.0156em on bold/button weights.
- **All numbers/tickers/percentages use the mono stack** (`.num`).

**Radii**
- Pill `--radius-pill` **1.5em** (every CTA, tag, filter chip)
- Card `--radius-md` **0.75em** (12px); the dashboard shell uses 14px
- Input `--radius-sm` **0.5em**

**Shadows**
- Card `--shadow-sm` ≈ `0 0 1em -0.5em rgba(0 8 37 / 21%)`
- Floating `--shadow-md` ≈ `0 2px 24px -15px rgb(0 8 37 / 75%)`
- Drawer/modal `--drop-shadow` ≈ `0 4px 24px -6px #00082459`

**Spacing / layout**
- Card inner vertical gap 0.75rem; body padding ~22–24px.
- Prototype dashboard shell is a fixed **1280px** width card; in production make it responsive
  (Inderes breakpoints: mobile ≤786, tablet 787–1033, desktop ≥1034, wide ≥1544; content max
  ~82.5rem / 1320px).

**Casing & content**
- Sentence case for all UI labels and headlines. Logo always lowercase `inderes`. **No emoji.**
- Hedged, measured financial voice. Recommendation labels carry status, not icons/emoji.

## Assets
- **Fonts** (`fonts/`): GT America (Standard + Condensed weights) and Inconsolata + Chivo Mono, woff2.
  *GT America is a licensed commercial font — verify license before reuse outside an Inderes context.*
- **Icons** (`icons/`): Inderes' in-house SVG icon set, `fill="currentColor"`. A small Lucide subset
  is used elsewhere in Inderes (load from CDN if needed).
- **Tokens** (`colors_and_type.css`): the full Inderes variable set + font-faces + type scale.
- No images/illustrations are required by this design; company "logos" are colored initial tiles.

## Files
- `Portfolio Dashboard.dc.html` — the full design prototype (markup template + logic class). The
  logic class is the behavior/data spec; the template + `<style>` block in `<helmet>` are the visual
  spec (all class names referenced above live there).
- `screenshots/` — reference PNG of each screen (see the Screenshots section).
- `colors_and_type.css` — Inderes design tokens, font-faces, type scale.
- `support.js` — the prototype runtime. **Reference only — do not port.** Lets you open the
  `.dc.html` in a browser to see the design live.
- `fonts/`, `icons/` — assets (see above).

### How to view the prototype
Open `Portfolio Dashboard.dc.html` in a browser (or serve the folder). Use the top nav to move
between sections; click holdings/reports to open detail pages.
