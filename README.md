# 🇵🇰 Pakistan Economic Dashboard

An interactive web dashboard visualising Pakistan's key economic
indicators using primarily **official government data** from the State Bank
of Pakistan (SBP), Pakistan Bureau of Statistics (PBS), and Ministry of
Finance. Any secondary reporting is explicitly identified and attributed.

**Live:** [https://economyofpakistan.com/](https://economyofpakistan.com/)

## Dashboard Sections

| Section              | Key Metrics                                    | Source              |
| -------------------- | ---------------------------------------------- | ------------------- |
| **Overview**         | Briefing sentence, what-moved strip, unique KPI cards (incl. trade, current account, debt) | All data files      |
| **Trade**            | Monthly imports/exports, top 15 countries       | SBP Excel           |
| **Country Trends**   | Per-partner exports, imports & remittance corridors with MoM/YoY momentum & FYTD | SBP Excel + EasyData API |
| **Foreign Reserves** | Weekly SBP + bank reserves, import cover        | SBP forex.pdf       |
| **Exchange Rate**    | PKR vs USD/EUR/GBP/CNY monthly averages         | SBP Excel           |
| **Remittances**      | Monthly remittances, source country breakdown   | SBP EasyData API    |
| **FDI**              | Net FDI by sector & country, FYTD comparison    | SBP Excel           |
| **IT & Services**    | Services exports (EBOPS), IT sub-sectors, **monthly IT & freelance exports** | SBP Excel           |
| **Inflation**        | National/Urban/Rural CPI, Food, SPI, WPI        | SBP EasyData API    |
| **Monetary**         | M2, private credit, deposits, NFA               | SBP EasyData API    |
| **Public Finance**   | GDP growth, fiscal balance, revenue/expenditure | SBP API + Excel     |
| **FBR Tax**          | Monthly net tax collection + tax-head breakdown | FBR tables/releases + identified secondary reporting |
| **Federal Budget**   | Outlay, revenue, deficit, spending mix + Good/Bad/Ugly commentary | Finance Division (Budget in Brief) |
| **Provincial Budgets** | Punjab/Sindh/KP/Balochistan outlay, ADP, transfers + commentary | Provincial Finance Depts |

Navigation is grouped into **Overview**, **External Sector**, **Prices & Money**,
**Public Finance & Budget**, and **Insights & Learning**, each drilling down to its
sub-sections. Routes are path-based (`/group/section`) with hash fallback, so every
section is a shareable deep link.

## Accuracy & Traceability

Accuracy is the product. The following guarantees are enforced by code, not by
convention:

| Guarantee | How it is enforced |
| --------- | ------------------ |
| **No positional guessing in parsers** | Every column, row and fiscal year in `parse-sbp-excel.mjs` is resolved by *label* through `scripts/lib/sheet-utils.mjs` / `sbp-resolvers.mjs`. When a workbook layout changes, the parser throws `SheetParseError` instead of silently publishing the wrong column. |
| **Every headline figure is citable** | `public/data/provenance.json` records the source document, sheet, cell location, period, unit and retrieval date for each cited figure. The 🔍 **Cite** control on KPI cards and charts shows it in-place. |
| **No hand-typed narrative numbers** | Every numeric claim in prose is computed by `scripts/generate-editorial-notes.mjs` from the same JSON the chart renders, so a sentence can never contradict the chart beneath it. |
| **Restatements are visible** | `scripts/lib/data-writer.mjs` diffs each write; changed historical values are appended to `public/data/revisions.json`. `lastUpdated` only advances when numbers actually change (`lastChecked` records the run). |
| **Dates have explicit meanings** | Freshness metadata separates the economic `observationDate`, source `publicationDate`, dashboard `verificationDate`, and `dashboardUpdated` timestamp. Staleness is calculated from the observation only. |
| **Refreshes are previewed** | `scripts/generate-update-preview.mjs` compares working data with `HEAD` and records new observations, KPI movements, revisions, source changes, review flags, and suspicious date jumps before an automated commit. |
| **Source trust is never implied** | Every dataset declares a tier — *official primary*, *derived on this dashboard*, or *secondary reporting* — surfaced as a badge next to its numbers. A data file can downgrade its own tier at runtime (FBR does this when only press-reported provisional figures exist). |
| **Reconciliation invariants** | `npm run audit:sanity` re-derives totals (trade balance, services credit/debit, reserves components, remittance corridors, fiscal series) and fails the build on any mismatch, plus cross-checks KPI ↔ provenance ↔ editorial notes. |
| **Parser regression tests** | `npm test` runs golden-file tests over the real workbook layouts, including fiscal-year rollover cases that previously produced wrong FDI figures. |
| **Projected dates are labelled** | `release-calendar.json` marks each expectation as *announced by the source* or *estimated from observed publication history*, and prints the derivation on every row. |

## Tech Stack

- **Frontend:** React 19 + Vite 5 + Chart.js 4
- **Routing:** Path-based deep links (`/group/section`, hash fallback) with per-section share links; unknown paths show a not-found page instead of silently rewriting to Overview
- **Loading:** Route-based code splitting (`React.lazy`) plus pinned `vendor-react` / `vendor-charts` chunks; insight briefing vs deep-dive bundles are separate so Briefing does not pull every scorecard
- **Navigation:** `Ctrl`/`Cmd`+`K` (or `/`) command palette that searches all sections/indicators; pin KPIs to a local watchlist
- **Accessibility:** Skip-to-content link, focusable `<main>`, `aria-live` section announcements, focus-trapped chart and tile modals, keyboard-discoverable chart data tables
- **Hosting:** Cloudflare Workers static assets (auto-build & deploy on push). Deploys inject `VITE_DATA_VERSION` from the git SHA so clients bust cached JSON after publish.
- **Data:** JSON files in `public/data/`, updated from SBP sources. PWA shell shows a “New data available — refresh” toast when the service worker or data stamp changes.
- **Data Trust:** Generated source manifest + freshness audit + per-figure provenance + revision log
- **Open data:** Static JSON/CSV API under `public/api/v1/` (no key, no rate limit)
- **Languages:** English + اردو (Urdu) with RTL layout; figures stay in English as published
- **Tests:** `node --test` golden-file parser, data-writer, release-calendar and i18n suites
- **SEO:** per-route titles/descriptions/canonicals (prerendered HTML + JSON-LD `WebPage`), a crawlable no-JS fallback on every path, `public/robots.txt`, a full `public/sitemap.xml` (`npm run generate:sitemap`), and a 1200×630 PNG Open Graph image (`public/og-image.png`)
- **Theme:** Light / Dark / System (auto)

---

## Bilingual Interface (English / اردو)

Translation uses two complementary layers, both under `src/i18n/`:

| Layer | File | Keyed by | Used for |
| ----- | ---- | -------- | -------- |
| Keyed dictionary | `en.js` / `ur.js` | stable ids (`nav.section.trade`) | chrome that has no natural English "source string": nav, status words, control labels |
| String dictionary | `strings-ur.js` | the exact English source string | section titles, chart titles, descriptions, tile labels — components just call `tx('Trade Overview')` |

`tx()` normalises curly vs straight apostrophes and whitespace before lookup, and
returns the English input unchanged when there is no translation, so an
untranslated string degrades to readable English rather than to a raw key.

**What deliberately stays in English:** figures, chart series names, axis units,
period labels, institution names and provenance strings. A number on screen must
read exactly as the issuing institution published it — translating a data label
risks changing what the number means. The UI states this explicitly whenever a
non-English language is active.

`npm test` enforces the contract: every translatable prop literal and every
inline `tx('…')` literal must have an Urdu string, no dictionary key may be a
verbatim copy of its English source, and stale keys that no longer appear in
`src/` fail the build.

Adding UI text: write it in English as usual, wrap it in `tx('…')` (shared
primitives such as `SectionHeader`, `ChartCard`, `SummaryCard` and
`ExpandableTile` already do this for their props), then run `npm test` — the
i18n suite prints exactly which strings still need an entry in `strings-ur.js`.
Note that `strings-ur.js` uses CRLF line endings; scripted edits must preserve
them.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 (tested with 22.x)
- **SBP EasyData API key** (for API-sourced data — free registration)

### Install & Run Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173/
```

### Build for Production

```bash
npm run build
# → Output in dist/
```

---

## Data Sources

Data is sourced primarily from official Pakistani government publications.
Where an official numeric release is unavailable, explicitly identified
secondary reporting may be retained with its attribution and review status.
There are **no synthetic or fabricated** data points.

### SBP Excel/PDF Files (parsed by `parse-sbp-excel.mjs`)

These files are auto-downloaded by `npm run update`:

- **exp_import_BOP_Arch.xls** → `trade.json` — <https://www.sbp.org.pk/assets/document/exp_import_BOP_Arch.xls>
- **Foreign_Dir.xls** → `fdi.json` (by sector) — <https://archive.sbp.org.pk/ecodata/Foreign_Dir.xls>
- **Netinflow.xls** → `fdi.json` (by country) — <https://www.sbp.org.pk/assets/document/Netinflow.xls>
- **NetinflowSummary.xls** → `fdi.json` (annual) — <https://archive.sbp.org.pk/ecodata/NetinflowSummary.xls>
- **GDP_table.xlsx** → `fiscal.json` (GDP growth) — <https://www.sbp.org.pk/assets/document/GDP_table.xlsx>
- **Balancepayment_BPM6.xls** → BOP summary — <https://www.sbp.org.pk/assets/document/Balancepayment_BPM6.xls>
- **IBF_Arch.xls** → `exchange-rates.json` — <https://www.sbp.org.pk/assets/document/IBF_Arch.xls>
- **dt.xls** → `services.json` (EBOPS) — <https://archive.sbp.org.pk/ecodata/dt.xls>
- **Export_Receipts_by_all_Countries.xls** → `trade.json` — <https://archive.sbp.org.pk/ecodata/Export_Receipts_by_all_Countries.xls>
- **Import-Payments-by-All-Countries.xlsx** → `trade.json` — <https://archive.sbp.org.pk/ecodata/Import-Payments-by-All-Countries.xlsx>
- **forex.pdf** → `reserves.json` (weekly reserves) — <https://www.sbp.org.pk/assets/document/forex.pdf>

### SBP EasyData API (fetched by `update-data.mjs`)

| Dataset              | API Series                  | Produces             |
| -------------------- | --------------------------- | -------------------- |
| Workers' Remittances | `TS_GP_BOP_WR_M.*` (7 ser.) | `remittances.json`   |
| Inflation (CPI/WPI)  | `TS_GP_PT_CPI_M.*` (9 ser.) | `inflation.json`     |
| Monetary Sector      | `TS_GP_BAM_M2_W.*` (9 ser.) | `monetary.json`      |
| Public Finance       | `TS_GP_PF_SPF_Y.*` (8 ser.) | `fiscal.json`        |

**API Registration:**
<https://easydata.sbp.org.pk> → My Account → API Key → Generate

### Manually-curated official data

Some datasets have no machine-readable feed and are curated by hand from
official sources, with every figure carrying a source URL and verification
date (mirroring the IMF tracker pattern):

| File              | Content                                          | Primary source                         |
| ----------------- | ------------------------------------------------ | -------------------------------------- |
| `fbr-tax.json`    | Monthly net tax collection + tax-head breakdown  | FBR official tables/releases + explicitly identified secondary reporting |
| `indicators.json` | At-a-glance rates/markets/fiscal-stress snapshot | SBP, Finance Division (Economic Survey), PSX, OGRA, Power Division |
| `imf-tracker.json`| IMF EFF program review schedule & disbursements   | IMF press releases                      |
| `budget-federal.json` | Federal budget (FY2025-26 & FY2026-27): outlay, revenue, deficit, spending mix, tax measures + editorial Good/Bad/Ugly commentary | Finance Division "Budget in Brief", as reported by Dawn & Business Recorder |
| `budget-provincial.json` | Provincial budgets (Punjab/Sindh/KP/Balochistan): outlay, ADP, transfers, surplus + commentary | Provincial Finance Department White Papers, as reported by Dawn & Business Recorder |

> **Budget data & commentary:** federal and provincial budget figures are budgeted
> estimates taken from official budget documents (Finance Division / provincial White
> Papers) as reported in detail by Dawn and Business Recorder, in PKR billion. Figures that
> could not be authentically sourced are explicitly marked **NOT FOUND** rather than
> estimated (e.g. KP and Balochistan FY2025-26 detail). The "Good / Bad / Ugly" panels are
> **editorial opinion**, clearly labelled as such, and grounded in the official figures shown.

FBR monthly figures and the four-way breakdown (Direct/Income Tax, Sales Tax,
FED, Customs) for the latest completed fiscal year are taken verbatim from
FBR's official *"Month-wise / Tax-wise Net Collection"* table. Current-year
figures are explicitly labeled by source type; secondary reports are never
presented as official FBR releases. `indicators.json`
holds point-in-time snapshots (policy rate, KSE-100, current account, public
debt, circular debt, petrol price), each dated and linked to its source.

### KPI Summary

`kpi-summary.json` is **auto-generated** from all the above data
files by `generateKpiFromData()` — it is never manually edited.
This runs as the final step after all parsers and API updates
complete, ensuring all KPIs (including FBR FYTD collection) reflect
the latest data. The `policy-rate` and `fbr-tax` KPIs are carried
from the curated files above.

---

## Updating Data

### Full Update (recommended)

Downloads fresh Excel files from SBP, parses them, fetches API data, and regenerates KPIs:

```bash
# Set your SBP API key (one-time setup)
echo SBP_API_KEY=your_key_here > .env

# Run the full pipeline
npm run update
```

This runs these steps:

1. **Download** — Fetches 11 Excel/PDF files from sbp.org.pk
2. **Excel Parse** — `parse-sbp-excel.mjs` processes files → JSON
3. **API Update** — `update-data.mjs` fetches remittances,
   inflation, monetary, public finance
4. **FBR Update** — `update-fbr.mjs` downloads & parses FBR's official
   month-wise/tax-wise PDF → refreshes closed-FY rows in `fbr-tax.json`
5. **KPI Regeneration** — rebuilds KPI summary from all data
6. **Source/Freshness Metadata** — generates `source-manifest.json`,
   `data-freshness.json` and `release-calendar.json`
6b. **Editorial claims** — `generate-editorial-notes.mjs` recomputes every
   narrative number from the refreshed data
6c. **Update preview** — `generate-update-preview.mjs` compares refreshed data with `HEAD`
6d. **Static API** — `generate-api.mjs` republishes `public/api/v1/*.json|.csv`
7. **Freshness Audit** — blocks deployment if a critical dataset is stale,
   missing, or requires review
8. **Git Commit & Push** — commits data changes to GitHub. **Cloudflare Pages
   then auto-builds and deploys the site on push** (no separate upload step).

Use `npm run update:local` to skip the git commit & push (and therefore
the Cloudflare auto-deploy).

> **FBR monthly data:** `update-fbr.mjs` auto-refreshes the *closed* fiscal
> year from FBR's official PDF (exact, internally validated — the parsed
> monthly nets must sum to the printed full-year total or the file is left
> unchanged). The **current** fiscal year's provisional months and the `fytd`
> block are curated by hand from identified sources. These can include FBR
> releases and explicitly labeled secondary reporting when FBR has not
> published a numeric release. When FBR
> publishes a new month-wise PDF, add its URL to `FBR_MONTHWISE_SOURCES` in
> `scripts/update-fbr.mjs`.
>
> **Snapshot indicators (`indicators.json`):** policy rate, KSE-100, current
> account, public debt, circular debt and petrol price are point-in-time
> official figures curated by hand — refresh them when a new MPC decision,
> Economic Survey, or OGRA notification lands, updating each `asOf` date.

### Partial Updates

```bash
# Only API data (remittances, inflation, monetary, public finance)
npm run update-data

# Only refresh FBR tax collection from the official FBR PDF
npm run update-fbr
node scripts/update-fbr.mjs --skip-download   # reparse an already-downloaded PDF

# Only parse existing Excel files (skip download)
node scripts/update-all.mjs --skip-download

# Only regenerate KPIs from existing data files
node scripts/parse-sbp-excel.mjs --kpi-only

# Generate source manifest, freshness metadata and release calendar
npm run generate:freshness

# Recompute the sourced narrative claims shown under section headers
npm run generate:notes

# Republish the static JSON/CSV API under public/api/v1
npm run generate:api
npm run generate:preview

# Run the parser / data-writer / release-calendar / i18n test suites
npm test

# Audit local data freshness against official source metadata
npm run audit:data

# Run local deployment gates: data sanity, freshness audit, lint, build
npm run ci:audit

# Verify live site JSON matches local generated data
npm run verify:live

# Update a specific API section
npm run update-data -- --section remittances
npm run update-data -- --section inflation
npm run update-data -- --section monetary
npm run update-data -- --section publicFinance
```

### Update Frequency

Recommended schedule:

- **Weekly:** Run `npm run update` to capture reserves, monetary
  updates, and newly released monthly tables as soon as available.
- **Monthly:** Expect trade, remittances, exchange-rate monthly
  averages, inflation, FDI, and services data to advance after SBP/PBS
  publish the next monthly releases.
- The pipeline is idempotent — safe to run anytime.

After each update, run:

```bash
npm run audit:sanity
npm run audit:data
npm run verify:live
```

The live dashboard also includes a **Data Freshness & Source Audit**
panel in the Overview tab, generated from `public/data/data-freshness.json`.

Run `npm run ci:audit` to execute the full gate (`audit:sanity`, `audit:data`,
lint, and build) before pushing. In CI environments that should not fetch SBP
source metadata, set `AUDIT_SKIP_SOURCE=1`; the local data sanity checks still run.

---

## Deployment (Cloudflare Workers)

The dashboard is hosted on **Cloudflare Workers static assets**, connected to this GitHub repo.
**Every push to `main` triggers an automatic build (`npm run build`) and deploy** —
so refreshing data (`npm run update`, which commits & pushes) ships the site with
no separate upload step.

- Build command: `npm run build` · Output directory: `dist`
- Deploy command: `npx wrangler deploy`
- `wrangler.jsonc` enables Workers' native single-page-application fallback
- Node version pinned via `.nvmrc` (Node 22; Vite 6 requires Node ≥ 18)
- `public/_headers` keeps `index.html` and `/data/*` `no-store` (always-fresh data)
  and caches hashed `/assets/*` immutably.

### Refresh data + auto-deploy (one command)

```bash
npm run update
```

This fetches fresh data, regenerates KPIs/freshness, commits and pushes to GitHub;
Cloudflare Pages then builds and deploys automatically. Use `--no-deploy` to skip
the commit & push (and therefore the auto-deploy).

### Continuous integration

`.github/workflows/dashboard-ci.yml` runs the data sanity checks, freshness
audit, lint, and production build (`npm run ci:audit`) on every push and pull
request. Deployment itself is handled by Cloudflare Pages' own build on push —
no deploy credentials are stored in the repo.

Live: <https://economyofpakistan.com/>

---

## Project Structure

```text
pak-eco/
├── public/
│   └── data/                  # JSON data files (auto-generated)
│       ├── trade.json         # Monthly imports/exports + country breakdown
│       ├── fdi.json           # FDI by sector, country, annual
│       ├── fiscal.json        # GDP growth + public finance
│       ├── exchange-rates.json # PKR vs USD/EUR/GBP/CNY
│       ├── reserves.json      # Weekly SBP + bank reserves
│       ├── services.json      # IT & services exports (EBOPS)
│       ├── remittances.json   # Monthly remittances + source countries
│       ├── inflation.json     # CPI/SPI/WPI series
│       ├── monetary.json      # M2, credit, deposits, NFA
│       ├── fbr-tax.json       # Monthly FBR net collection + tax-head breakdown
│       ├── budget-federal.json # Federal budget + Good/Bad/Ugly commentary (curated)
│       ├── budget-provincial.json # Provincial budgets + commentary (curated)
│       ├── indicators.json    # At-a-glance rates/markets/fiscal-stress snapshot
│       ├── imf-tracker.json   # IMF EFF program tracker (curated)
│       ├── kpi-summary.json   # Headline KPIs (auto-derived)
│       ├── provenance.json    # Per-figure source document, sheet, cell, period
│       ├── editorial-notes.json # Narrative claims computed from the data
│       ├── revisions.json     # Log of restated historical values
│       ├── release-calendar.json # Announced/estimated next-release windows
│       ├── source-manifest.json # Source URLs, cadence, parser metadata
│       ├── data-freshness.json # Observation/publication/verification dates and status
│       └── update-preview.json # Pre-commit changes and review flags
├── public/api/                # Static JSON/CSV API (generated)
│   ├── index.json             # Endpoint index with trust tier + latest period
│   └── v1/*.json|.csv         # One endpoint per dataset + metadata endpoints
├── src/
│   ├── App.jsx                # Main app with hash routing + theme/language toggles
│   ├── index.css              # Styles (light/dark theme via CSS variables)
│   ├── i18n/                  # en/ur key dictionaries, strings-ur string map, provider, useI18n hook
│   ├── components/            # One component per dashboard section
│   │   ├── KpiCards.jsx       # Overview KPI cards
│   │   ├── TradeSection.jsx
│   │   ├── ReservesSection.jsx
│   │   ├── ExchangeRateSection.jsx
│   │   ├── RemittancesSection.jsx
│   │   ├── FdiSection.jsx
│   │   ├── ServicesSection.jsx
│   │   ├── InflationSection.jsx
│   │   ├── MonetarySection.jsx
│   │   ├── FiscalSection.jsx
│   │   ├── FbrTaxSection.jsx  # Monthly FBR tax collection
│   │   ├── SnapshotPanel.jsx  # At-a-glance indicators (Overview)
│   │   ├── CiteFigure.jsx     # Per-figure provenance popover
│   │   ├── EditorialNote.jsx  # Renders a computed narrative claim
│   │   ├── SourceBadge.jsx    # Trust-tier badge
│   │   ├── ReleaseCalendarSection.jsx # Next-release expectations
│   │   ├── DataApiSection.jsx # Download & API documentation
│   │   ├── CommandPalette.jsx # Ctrl/Cmd+K jump-to-section search
│   │   ├── LanguageToggle.jsx # EN / اردو switch
│   │   └── ChartCard.jsx      # Reusable chart wrapper (+ CSV export)
│   ├── hooks/
│   │   ├── useData.js         # Data loading hook
│   │   └── useHashRoute.js    # Deep-link routing
│   └── utils/
│       ├── download.js        # Chart → CSV export
│       └── periodHelpers.js   # CY/FY period derivation from data
├── scripts/
│   ├── update-all.mjs         # Master orchestrator
│   ├── parse-sbp-excel.mjs    # Excel/PDF → JSON parser
│   ├── update-data.mjs        # SBP EasyData API fetcher
│   ├── data-catalog.mjs       # Dataset/source catalog (trust tiers, cadence)
│   ├── generate-data-freshness.mjs # Builds source/freshness/release-calendar JSON
│   ├── generate-editorial-notes.mjs # Computes narrative claims from data
│   ├── generate-api.mjs       # Publishes the static JSON/CSV API
│   ├── audit-sanity.mjs       # Reconciliation + provenance invariants
│   ├── audit-data.mjs         # Local data freshness audit
│   ├── verify-live.mjs        # Live site vs local JSON verification
│   ├── lib/                   # sheet-utils, sbp-resolvers, data-writer,
│   │                          # provenance-store, source-docs, release-calendar,
│   │                          # i18n-scan (translation coverage scanner)
│   ├── tests/                 # node --test suites
│   └── sbp-raw/               # Downloaded Excel/PDF files (gitignored)
├── package.json
├── vite.config.js
└── eslint.config.js
```

---

## Data Pipeline Architecture

```text
SBP Website (Excel/PDF)          SBP EasyData API
        │                               │
        ▼                               ▼
  parse-sbp-excel.mjs            update-data.mjs
        │                               │
        ├── trade.json                   ├── remittances.json
        ├── fdi.json                     ├── inflation.json
        ├── fiscal.json (GDP) ◄──merge── ├── fiscal.json (publicFinance)
        ├── exchange-rates.json          └── monetary.json
        ├── reserves.json
        └── services.json
                    │
                    ▼
        parse-sbp-excel.mjs --kpi-only
                    │
                    ▼
            kpi-summary.json
            (derived from ALL above)
                    │
                    ▼
        generate-data-freshness.mjs
                    │
                    ▼
 source-manifest.json + data-freshness.json + release-calendar.json
                    │
                    ▼
        generate-editorial-notes.mjs → editorial-notes.json
                    │
                    ▼
        generate-api.mjs → public/api/index.json + /api/v1/*
```

Every write goes through `scripts/lib/data-writer.mjs`, which diffs the new
content against the published file, appends any restated historical value to
`revisions.json`, and only advances `lastUpdated` when a number actually
changed.

## Open Data API

Everything the dashboard renders is published as static files, so there is no
key, quota or scraping required:

- `https://economyofpakistan.com/api/index.json` — endpoint index with each
  dataset's source, trust tier, cadence and latest observation
- `https://economyofpakistan.com/api/v1/<dataset>.json` — the full dataset
- `https://economyofpakistan.com/api/v1/<dataset>.csv` — the primary series as CSV
- `https://economyofpakistan.com/api/v1/provenance.json`,
  `data-freshness.json`, `release-calendar.json`, `revisions.json`,
  `editorial-notes.json` — the traceability metadata

Individual charts also expose a **CSV** button that exports exactly the series
drawn on screen. Please attribute the underlying issuing institution (SBP, PBS,
FBR, Finance Division) rather than this dashboard.

**Single source of truth:** Each JSON data file is written by
exactly one script (except `fiscal.json` which merges GDP from
Excel and publicFinance from API). `kpi-summary.json` is always
regenerated last from all canonical data files.

---

## Pakistan Fiscal Year

Pakistan's fiscal year runs **July 1 – June 30**. FY2026 = July 2025 – June 2026. FYTD (Fiscal Year to Date) figures typically cover Jul–Mar or Jul–Feb depending on the latest available data.

## License

Data is sourced primarily from the State Bank of Pakistan, Pakistan Bureau of
Statistics, Ministry of Finance, and other official institutions. Any
secondary reporting is explicitly identified and linked.
