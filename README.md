# 🇵🇰 Pakistan Economic Dashboard

An interactive web dashboard visualising Pakistan's key economic
indicators using **official government data** from the State Bank
of Pakistan (SBP), Pakistan Bureau of Statistics (PBS), and
Ministry of Finance.

**Live:** [https://pakeconomydash.z5.web.core.windows.net/](https://pakeconomydash.z5.web.core.windows.net/)

## Dashboard Sections

| Section              | Key Metrics                                    | Source              |
| -------------------- | ---------------------------------------------- | ------------------- |
| **Overview**         | 8 KPI cards (reserves, exchange rate, etc.)    | All data files      |
| **Trade**            | Monthly imports/exports, top 15 countries       | SBP Excel           |
| **Foreign Reserves** | Weekly SBP + bank reserves, import cover        | SBP forex.pdf       |
| **Exchange Rate**    | PKR vs USD/EUR/GBP/CNY monthly averages         | SBP Excel           |
| **Remittances**      | Monthly remittances, source country breakdown   | SBP EasyData API    |
| **FDI**              | Net FDI by sector & country, FYTD comparison    | SBP Excel           |
| **IT & Services**    | Services exports (EBOPS), IT sub-sectors        | SBP Excel           |
| **Inflation**        | National/Urban/Rural CPI, Food, SPI, WPI        | SBP EasyData API    |
| **Monetary**         | M2, private credit, deposits, NFA               | SBP EasyData API    |
| **Public Finance**   | GDP growth, fiscal balance, revenue/expenditure | SBP API + Excel     |

## Tech Stack

- **Frontend:** React 19 + Vite 5 + Chart.js 4
- **Hosting:** Azure Storage Static Website
- **Data:** JSON files in `public/data/`, updated from SBP sources
- **Data Trust:** Generated source manifest + freshness audit metadata
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

### KPI Summary

`kpi-summary.json` is **auto-generated** from all the above data
files by `generateKpiFromData()` — it is never manually edited.
This runs as the final step after all parsers and API updates
complete, ensuring all 8 KPIs reflect the latest data.

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

This runs 7 steps:

1. **Download** — Fetches 11 Excel/PDF files from sbp.org.pk
2. **Excel Parse** — `parse-sbp-excel.mjs` processes files → JSON
3. **API Update** — `update-data.mjs` fetches remittances,
   inflation, monetary, public finance
4. **KPI Regeneration** — rebuilds KPI summary from all data
5. **Source/Freshness Metadata** — generates `source-manifest.json`
   and `data-freshness.json`
6. **Git Commit & Push** — commits data changes to GitHub
7. **Deploy** — builds and uploads to Azure Storage

Use `npm run update -- --no-deploy` to skip steps 5–6.

### Partial Updates

```bash
# Only API data (remittances, inflation, monetary, public finance)
npm run update-data

# Only parse existing Excel files (skip download)
node scripts/update-all.mjs --skip-download

# Only regenerate KPIs from existing data files
node scripts/parse-sbp-excel.mjs --kpi-only

# Generate source manifest and freshness metadata
npm run generate:freshness

# Audit local data freshness against official source metadata
npm run audit:data

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
npm run audit:data
npm run verify:live
```

The live dashboard also includes a **Data Freshness & Source Audit**
panel in the Overview tab, generated from `public/data/data-freshness.json`.

---

## Deploying to Azure Storage

The dashboard is hosted as a static website on Azure Blob Storage.
Deployment is handled automatically by `npm run update`, or
manually via `npm run deploy`.

### Deploy Manually

```bash
npm run deploy
# or
pwsh scripts/deploy.ps1
```

### Full Update + Commit + Deploy (one command)

```bash
npm run update
```

This fetches fresh data, commits changes to git, pushes to
GitHub, and deploys to Azure Storage. Use `--no-deploy` to skip
the git push and deploy steps.

### Azure Configuration

| Setting          | Value                  |
| ---------------- | ---------------------- |
| Storage Account  | `pakeconomydash`       |
| Resource Group   | `rg-pak-eco`           |
| Region           | `westus2`              |
| SKU              | `Standard_LRS`         |
| Index Document   | `index.html`           |
| Error Document   | `index.html`           |

Live: <https://pakeconomydash.z5.web.core.windows.net/>

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
│       ├── kpi-summary.json   # 8 headline KPIs (auto-derived)
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
