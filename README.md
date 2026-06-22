# 🇵🇰 Pakistan Economic Dashboard

An interactive web dashboard visualising Pakistan's key economic
indicators using **official government data** from the State Bank
of Pakistan (SBP), Pakistan Bureau of Statistics (PBS), and
Ministry of Finance.

**Live:** [https://economyofpakistan.com/](https://economyofpakistan.com/)

## Dashboard Sections

| Section              | Key Metrics                                    | Source              |
| -------------------- | ---------------------------------------------- | ------------------- |
| **Overview**         | 8 KPI cards (reserves, exchange rate, etc.)    | All data files      |
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
| **FBR Tax**          | Monthly net tax collection + tax-head breakdown | FBR official tables |
| **Federal Budget**   | Outlay, revenue, deficit, spending mix + Good/Bad/Ugly commentary | Finance Division (Budget in Brief) |
| **Provincial Budgets** | Punjab/Sindh/KP/Balochistan outlay, ADP, transfers + commentary | Provincial Finance Depts |

Navigation is grouped into **Overview**, **External Sector**, **Prices & Money**, and
**Public Finance & Budget**, each drilling down to its sub-sections.

## Tech Stack

- **Frontend:** React 19 + Vite 5 + Chart.js 4
- **Hosting:** Cloudflare Pages (auto-build & deploy on push); legacy Azure Storage script retained as fallback
- **Data:** JSON files in `public/data/`, updated from SBP sources
- **Data Trust:** Generated source manifest + freshness audit metadata
- **SEO:** `index.html` meta/Open Graph/Twitter tags + JSON-LD (`WebSite`/`Dataset`) structured data, a crawlable no-JS fallback, plus `public/robots.txt`, `public/sitemap.xml` and `public/og-image.svg`
- **Theme:** Light / Dark / System (auto)

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 (tested with 22.x)
- **Azure CLI** (for deployment only)
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

All data comes from official Pakistani government sources. There are **no synthetic or fabricated** data points.

### SBP Excel/PDF Files (parsed by `parse-sbp-excel.mjs`)

These files are auto-downloaded by `npm run update`:

- **exp_import_BOP.xls** → `trade.json`
  <https://www.sbp.org.pk/ecodata/exp_import_BOP.xls>
- **Foreign_Dir.xls** → `fdi.json` (by sector)
  <https://www.sbp.org.pk/ecodata/Foreign_Dir.xls>
- **Netinflow.xls** → `fdi.json` (by country)
  <https://www.sbp.org.pk/ecodata/Netinflow.xls>
- **NetinflowSummary.xls** → `fdi.json` (annual)
  <https://www.sbp.org.pk/ecodata/NetinflowSummary.xls>
- **GDP_table.xlsx** → `fiscal.json` (GDP growth)
  <https://www.sbp.org.pk/ecodata/GDP_table.xlsx>
- **Balancepayment_BPM6.xls** → BOP summary
  <https://www.sbp.org.pk/ecodata/Balancepayment_BPM6.xls>
- **IBF_Arch.xls** → `exchange-rates.json`
  <https://www.sbp.org.pk/ecodata/IBF_Arch.xls>
- **dt.xls** → `services.json` (EBOPS)
  <https://www.sbp.org.pk/ecodata/dt.xls>
- **Export_Receipts_by_all_Countries.xls** → `trade.json`
  <https://www.sbp.org.pk/ecodata/Export_Receipts_by_all_Countries.xls>
- **Import-Payments-by-All-Countries.xlsx** → `trade.json`
  <https://www.sbp.org.pk/ecodata/Import-Payments-by-All-Countries.xlsx>
- **forex.pdf** → `reserves.json` (weekly reserves)
  <https://www.sbp.org.pk/ecodata/forex.pdf>

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
| `fbr-tax.json`    | Monthly net tax collection + tax-head breakdown  | FBR official Month-wise/Tax-wise table (`download1.fbr.gov.pk`) + FBR press releases |
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
FBR's official *"Month-wise / Tax-wise Net Collection"* table; current-year
months are provisional press-release figures, clearly flagged. `indicators.json`
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
6. **Source/Freshness Metadata** — generates `source-manifest.json`
   and `data-freshness.json`
7. **Git Commit & Push** — commits data changes to GitHub. **Cloudflare Pages
   then auto-builds and deploys the site on push** (no separate upload step).

Use `npm run update -- --no-deploy` to skip the git commit & push (and therefore
the Cloudflare auto-deploy).

> **FBR monthly data:** `update-fbr.mjs` auto-refreshes the *closed* fiscal
> year from FBR's official PDF (exact, internally validated — the parsed
> monthly nets must sum to the printed full-year total or the file is left
> unchanged). The **current** fiscal year's provisional months and the `fytd`
> block are curated by hand from FBR press releases (`fbr.gov.pk`). When FBR
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

# Generate source manifest and freshness metadata
npm run generate:freshness

# Audit local data freshness against official source metadata
npm run audit:data

# Run local deployment gates: data sanity, freshness audit, lint, build
npm run ci:audit

# Verify live Azure JSON matches local generated data
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

`npm run deploy` automatically runs the `predeploy` gate first
(`audit:sanity`, `audit:data`, and lint). In CI environments that should not
fetch SBP source metadata, set `AUDIT_SKIP_SOURCE=1`; the local data sanity
checks still run.

---

## Deployment (Cloudflare Pages)

The dashboard is hosted on **Cloudflare Pages**, connected to this GitHub repo.
**Every push to `main` triggers an automatic build (`npm run build`) and deploy** —
so refreshing data (`npm run update`, which commits & pushes) ships the site with
no separate upload step.

- Build command: `npm run build` · Output directory: `dist`
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

### Legacy Azure Storage deploy (optional)

The original Azure Blob static-website deploy script is retained as a fallback:

```bash
npm run deploy        # or: pwsh scripts/deploy.ps1
```

This uploads `dist` + data files to the `pakeconomydash` storage account. It is no
longer part of `npm run update`; use it only if deploying to Azure instead of/along
with Cloudflare.

### GitHub Actions Deployment

`.github/workflows/dashboard-ci.yml` runs data sanity checks, freshness audit,
lint, and production build on pushes and pull requests. A manual
`workflow_dispatch` deployment is also available after configuring Azure OIDC
secrets:

| Secret | Description |
| ------ | ----------- |
| `AZURE_CLIENT_ID` | Entra application/client ID with federated GitHub credentials |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription containing `pakeconomydash` |

Grant the app access to deploy to the storage account, then run the workflow
manually with `deploy=true`.

### Azure Configuration

| Setting          | Value                  |
| ---------------- | ---------------------- |
| Storage Account  | `pakeconomydash`       |
| Resource Group   | `rg-pak-eco`           |
| Region           | `westus2`              |
| SKU              | `Standard_LRS`         |
| Index Document   | `index.html`           |
| Error Document   | `index.html`           |

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
│       ├── source-manifest.json # Source URLs, cadence, parser metadata
│       └── data-freshness.json # Latest observation/status per dataset
├── src/
│   ├── App.jsx                # Main app with tab navigation + theme toggle
│   ├── index.css              # Styles (light/dark theme via CSS variables)
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
│   │   └── ChartCard.jsx      # Reusable chart wrapper
│   ├── hooks/
│   │   └── useData.js         # Data loading hook
│   └── utils/
│       └── periodHelpers.js   # CY/FY period derivation from data
├── scripts/
│   ├── update-all.mjs         # Master orchestrator
│   ├── parse-sbp-excel.mjs    # Excel/PDF → JSON parser
│   ├── update-data.mjs        # SBP EasyData API fetcher
│   ├── data-catalog.mjs       # Dataset/source catalog
│   ├── generate-data-freshness.mjs # Builds source/freshness JSON
│   ├── audit-data.mjs         # Local data freshness audit
│   ├── verify-live.mjs        # Live Azure vs local JSON verification
│   ├── deploy.ps1             # Azure Storage deploy script
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
 source-manifest.json + data-freshness.json
```

**Single source of truth:** Each JSON data file is written by
exactly one script (except `fiscal.json` which merges GDP from
Excel and publicFinance from API). `kpi-summary.json` is always
regenerated last from all canonical data files.

---

## Pakistan Fiscal Year

Pakistan's fiscal year runs **July 1 – June 30**. FY2026 = July 2025 – June 2026. FYTD (Fiscal Year to Date) figures typically cover Jul–Mar or Jul–Feb depending on the latest available data.

## License

Data sourced from the State Bank of Pakistan, Pakistan Bureau of Statistics, and Ministry of Finance. All data is publicly available from official government sources.
