# 🇵🇰 Pakistan Economic Dashboard

An interactive web dashboard visualising Pakistan's key economic indicators using **official government data** from the State Bank of Pakistan (SBP), Pakistan Bureau of Statistics (PBS), and Ministry of Finance.

**Live:** [https://pakeconomicdash.z5.web.core.windows.net/](https://pakeconomicdash.z5.web.core.windows.net/)

## Dashboard Sections

| Section | Key Metrics | Source |
|---------|------------|--------|
| **Overview** | 8 KPI cards (reserves, exchange rate, remittances, FDI, IT exports, GDP growth, inflation, policy rate) | Derived from all data files |
| **Trade** | Monthly imports/exports, trade balance, top 15 partner countries | SBP Excel |
| **Foreign Reserves** | Weekly SBP + commercial bank reserves, import cover estimate | SBP forex.pdf |
| **Exchange Rate** | PKR vs USD/EUR/GBP/CNY monthly averages | SBP Excel |
| **Remittances** | Monthly worker remittances, source country breakdown | SBP EasyData API |
| **FDI** | Net FDI by sector & country, annual trends, FYTD comparison | SBP Excel |
| **IT & Services** | Services exports by EBOPS category, IT sub-sector breakdown | SBP Excel |
| **Inflation** | National/Urban/Rural CPI, Food/Non-Food, SPI, WPI | SBP EasyData API |
| **Monetary** | M2, private credit, deposits, NFA, reserve money | SBP EasyData API |
| **Public Finance** | GDP growth, fiscal/primary balance, revenue & expenditure | SBP EasyData API + Excel |

## Tech Stack

- **Frontend:** React 18 + Vite 5 + Chart.js 4
- **Hosting:** Azure Storage Static Website
- **Data:** JSON files in `public/data/`, updated from SBP sources
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

| File | URL | Produces |
|------|-----|----------|
| `exp_import_BOP.xls` | https://www.sbp.org.pk/ecodata/exp_import_BOP.xls | `trade.json` (monthly imports/exports) |
| `Foreign_Dir.xls` | https://www.sbp.org.pk/ecodata/Foreign_Dir.xls | `fdi.json` (FDI by sector) |
| `Netinflow.xls` | https://www.sbp.org.pk/ecodata/Netinflow.xls | `fdi.json` (FDI by country) |
| `NetinflowSummary.xls` | https://www.sbp.org.pk/ecodata/NetinflowSummary.xls | `fdi.json` (annual FDI) |
| `GDP_table.xlsx` | https://www.sbp.org.pk/ecodata/GDP_table.xlsx | `fiscal.json` (GDP growth) |
| `Balancepayment_BPM6.xls` | https://www.sbp.org.pk/ecodata/Balancepayment_BPM6.xls | BOP summary data |
| `IBF_Arch.xls` | https://www.sbp.org.pk/ecodata/IBF_Arch.xls | `exchange-rates.json` (PKR rates) |
| `dt.xls` | https://www.sbp.org.pk/ecodata/dt.xls | `services.json` (EBOPS services trade) |
| `Export_Receipts_by_all_Countries.xls` | https://www.sbp.org.pk/ecodata/Export_Receipts_by_all_Countries.xls | `trade.json` (export countries) |
| `Import-Payments-by-All-Countries.xlsx` | https://www.sbp.org.pk/ecodata/Import-Payments-by-All-Countries.xlsx | `trade.json` (import countries) |
| `forex.pdf` | https://www.sbp.org.pk/ecodata/forex.pdf | `reserves.json` (weekly SBP + bank reserves) |

### SBP EasyData API (fetched by `update-data.mjs`)

| Dataset | API Series | Produces |
|---------|-----------|----------|
| Workers' Remittances | `TS_GP_BOP_WR_M.*` (total + 6 country groups) | `remittances.json` |
| Inflation (CPI/SPI/WPI) | `TS_GP_PT_CPI_M.*` (9 series) | `inflation.json` |
| Monetary Sector | `TS_GP_BAM_M2_W.*`, `TS_GP_BAM_RM_W.*` (9 series) | `monetary.json` |
| Public Finance | `TS_GP_PF_SPF_Y.*` (8 series) | `fiscal.json` (publicFinance key) |

**API Registration:** https://easydata.sbp.org.pk → My Account → API Key → Generate

### KPI Summary

`kpi-summary.json` is **auto-generated** from all the above data files by `generateKpiFromData()` — it is never manually edited. This runs as the final step after all parsers and API updates complete, ensuring all 8 KPIs reflect the latest data.

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

This runs 4 steps:
1. **Download** — Fetches 10 Excel/PDF files from sbp.org.pk
2. **Excel Parse** — `parse-sbp-excel.mjs` processes files → JSON
3. **API Update** — `update-data.mjs` fetches remittances, inflation, monetary, public finance
4. **KPI Regeneration** — `parse-sbp-excel.mjs --kpi-only` rebuilds KPI summary from all data

### Partial Updates

```bash
# Only API data (remittances, inflation, monetary, public finance)
npm run update-data

# Only parse existing Excel files (skip download)
node scripts/update-all.mjs --skip-download

# Only regenerate KPIs from existing data files
node scripts/parse-sbp-excel.mjs --kpi-only

# Update a specific API section
npm run update-data -- --section remittances
npm run update-data -- --section inflation
npm run update-data -- --section monetary
npm run update-data -- --section publicFinance
```

### Update Frequency

SBP typically publishes updated data monthly. Recommended schedule:
- **Monthly:** Run `npm run update` after SBP publishes new data (usually 2nd–3rd week of each month)
- The pipeline is idempotent — safe to run anytime

---

## Deploying to Azure Storage

The dashboard is hosted as a static website on Azure Blob Storage.

### Prerequisites

- Azure CLI installed and logged in (`az login`)
- Resource group `rg-pak-eco` in `westus2` (auto-created on first deploy)

### Deploy

```bash
npm run deploy
# or
pwsh scripts/deploy.ps1
```

This will:
1. Build the production bundle (`npm run build`)
2. Create Azure resources if they don't exist (storage account `pakeconomicdash`, static website enabled)
3. Upload all files from `dist/` to the `$web` container
4. Print the live URL

### Azure Configuration

| Setting | Value |
|---------|-------|
| Storage Account | `pakeconomicdash` |
| Resource Group | `rg-pak-eco` |
| Region | `westus2` |
| SKU | `Standard_LRS` |
| Index Document | `index.html` |
| Error Document | `index.html` |
| Live URL | https://pakeconomicdash.z5.web.core.windows.net/ |

### Full Update + Deploy (end-to-end)

```bash
npm run update && npm run deploy
```

---

## Project Structure

```
pak-eco/
├── public/
│   └── data/                  # JSON data files (auto-generated)
│       ├── trade.json         # Monthly imports/exports + country breakdown
│       ├── fdi.json           # FDI by sector, country, annual
│       ├── fiscal.json        # GDP growth + public finance
│       ├── exchange-rates.json# PKR vs USD/EUR/GBP/CNY
│       ├── reserves.json      # Weekly SBP + bank reserves
│       ├── services.json      # IT & services exports (EBOPS)
│       ├── remittances.json   # Monthly remittances + source countries
│       ├── inflation.json     # CPI/SPI/WPI series
│       ├── monetary.json      # M2, credit, deposits, NFA
│       └── kpi-summary.json   # 8 headline KPIs (auto-derived)
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
│   ├── update-all.mjs         # Master orchestrator (download + parse + API + KPI)
│   ├── parse-sbp-excel.mjs    # Excel/PDF → JSON parser
│   ├── update-data.mjs        # SBP EasyData API fetcher
│   ├── deploy.ps1             # Azure Storage deploy script
│   └── sbp-raw/               # Downloaded Excel/PDF files (gitignored)
├── package.json
├── vite.config.js
└── eslint.config.js
```

---

## Data Pipeline Architecture

```
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
```

**Single source of truth:** Each JSON data file is written by exactly one script (except `fiscal.json` which merges GDP from Excel and publicFinance from API). `kpi-summary.json` is always regenerated last from all canonical data files.

---

## Pakistan Fiscal Year

Pakistan's fiscal year runs **July 1 – June 30**. FY2026 = July 2025 – June 2026. FYTD (Fiscal Year to Date) figures typically cover Jul–Mar or Jul–Feb depending on the latest available data.

## License

Data sourced from the State Bank of Pakistan, Pakistan Bureau of Statistics, and Ministry of Finance. All data is publicly available from official government sources.
