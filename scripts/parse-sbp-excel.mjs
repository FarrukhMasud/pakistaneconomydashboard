#!/usr/bin/env node

/**
 * Pakistan Economic Dashboard — SBP Excel Parser
 *
 * Reads downloaded SBP Excel files from scripts/sbp-raw/ and updates
 * the JSON data files in public/data/.
 *
 * Usage:
 *   node scripts/parse-sbp-excel.mjs
 *
 * Expects these files in scripts/sbp-raw/:
 *   - exp_import_BOP.xls        → trade.json
 *   - Foreign_Dir.xls           → fdi.json (by sector)
 *   - Netinflow.xls             → fdi.json (by country)
 *   - NetinflowSummary.xls      → fdi.json (annual)
 *   - GDP_table.xlsx            → fiscal.json
 *   - Balancepayment_BPM6.xls   → kpi-summary.json
 *
 * Also attempts to download IBF_Arch.xls for exchange rate history.
 */

import XLSX from 'xlsx';
import { readFile, writeFile, access } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PdfReader } = require('pdfreader');

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = resolve(__dirname, 'sbp-raw');
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

// ─── Helpers ───

function readExcel(filename) {
  return XLSX.readFile(resolve(RAW_DIR, filename));
}

function getSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" not found. Available: ${wb.SheetNames.join(', ')}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

function excelDateToYYYYMM(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  return `${d.y}-${String(d.m).padStart(2, '0')}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function readJson(filename) {
  const raw = await readFile(resolve(DATA_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(filename, data) {
  await writeFile(resolve(DATA_DIR, filename), JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✅ Updated ${filename}`);
}

async function fileExists(filepath) {
  try { await access(filepath); return true; } catch { return false; }
}

// ─── Country → Flag Emoji ───

const FLAG_MAP = {
  'argentina': '🇦🇷', 'australia': '🇦🇺', 'austria': '🇦🇹',
  'bahrain': '🇧🇭', 'bangladesh': '🇧🇩', 'belgium': '🇧🇪',
  'canada': '🇨🇦', 'china': '🇨🇳', 'denmark': '🇩🇰',
  'egypt': '🇪🇬', 'finland': '🇫🇮', 'france': '🇫🇷',
  'germany': '🇩🇪', 'hongkong': '🇭🇰', 'hong kong': '🇭🇰',
  'hungary': '🇭🇺', 'indonesia': '🇮🇩', 'iran': '🇮🇷',
  'ireland': '🇮🇪', 'italy': '🇮🇹', 'japan': '🇯🇵',
  'korea (south)': '🇰🇷', 'kuwait': '🇰🇼', 'lebanon': '🇱🇧',
  'luxembourg': '🇱🇺', 'malaysia': '🇲🇾', 'netherlands': '🇳🇱',
  'newzealand': '🇳🇿', 'norway': '🇳🇴', 'oman': '🇴🇲',
  'qatar': '🇶🇦', 'saudi arabia': '🇸🇦', 'singapore': '🇸🇬',
  'south africa': '🇿🇦', 'sweden': '🇸🇪', 'switzerland': '🇨🇭',
  'thailand': '🇹🇭', 'turkiye': '🇹🇷', 'turkey': '🇹🇷',
  'u.a.e': '🇦🇪', 'uae': '🇦🇪', 'united arab emirates': '🇦🇪',
  'united kingdom': '🇬🇧', 'united states': '🇺🇸', 'usa': '🇺🇸',
  'afghanistan': '🇦🇫', 'india': '🇮🇳', 'spain': '🇪🇸',
  'brazil': '🇧🇷', 'russia': '🇷🇺', 'kenya': '🇰🇪',
  'sri lanka': '🇱🇰', 'vietnam': '🇻🇳', 'philippines': '🇵🇭',
  'hong kong': '🇭🇰', 'poland': '🇵🇱', 'czech republic': '🇨🇿',
  'mexico': '🇲🇽', 'mauritius': '🇲🇺', 'tanzania': '🇹🇿',
  'iraq': '🇮🇶', 'korea': '🇰🇷', 'korea, south': '🇰🇷',
  'new zealand': '🇳🇿', 'taiwan': '🇹🇼',
  'others': '🌍',
};

function getFlag(country) {
  const c = country.toLowerCase().trim();
  // Direct match
  if (FLAG_MAP[c]) return FLAG_MAP[c];
  // Normalize dots and spaces: "U. S. A." → "usa", "U. K." → "uk", "U. A. E. Dubai" → "uae dubai"
  const normalized = c.replace(/\.\s*/g, '').replace(/\s+/g, ' ');
  if (FLAG_MAP[normalized]) return FLAG_MAP[normalized];
  // Partial matches for common SBP abbreviations
  if (normalized.startsWith('u s a') || normalized.startsWith('usa')) return '🇺🇸';
  if (normalized.startsWith('u k') || normalized === 'uk') return '🇬🇧';
  if (normalized.startsWith('uae') || normalized.startsWith('u a e')) return '🇦🇪';
  if (normalized.includes('korea')) return '🇰🇷';
  if (normalized.includes('hong kong')) return '🇭🇰';
  // Try matching a substring of the country name against FLAG_MAP keys
  for (const [key, flag] of Object.entries(FLAG_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return flag;
  }
  return '🏳️';
}

// ─── Sector name shortener ───

const SECTOR_SHORT = {
  'agriculture, forestry and fishing': 'Agriculture',
  'mining and quarrying': 'Mining & Quarrying',
  'manufacturing': 'Manufacturing',
  'electricity, gas, steam and air conditioning supply': 'Power & Energy',
  'water supply; sewerage, waste management and remediation activities': 'Water & Waste Mgmt',
  'construction': 'Construction',
  'wholesale and retail trade; repair of motor vehicles and motorcycles': 'Trade & Commerce',
  'transportation and storage': 'Transport & Storage',
  'accommodation and food service activities': 'Food & Hospitality',
  'information and communication': 'IT & Telecom',
  'financial and insurance activities': 'Financial Services',
  'real estate activities': 'Real Estate',
  'professional, scientific and technical activities': 'Professional Services',
  'administrative and support service activities': 'Admin Services',
  'education': 'Education',
  'human health and social work activities': 'Healthcare',
  'arts, entertainment and recreation': 'Entertainment',
  'other service activities': 'Other Services',
};

function shortenSector(name) {
  return SECTOR_SHORT[name.toLowerCase()] || name;
}

// ═══════════════════════════════════════════════════
// 1. TRADE (exp_import_BOP.xls)
// ═══════════════════════════════════════════════════

async function updateTrade() {
  console.log('\n📦 Parsing Trade Data (exp_import_BOP.xls)...');

  const wb = readExcel('exp_import_BOP.xls');
  const rows = getSheet(wb, 'Exp.Imp.(BOP)');

  // Row 7+: data. Col 0 = Excel serial date, 2 = exports, 6 = imports
  // Empty rows at fiscal-year boundaries; text rows are footnotes.
  const monthly = [];

  for (let i = 7; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row[0] !== 'number') continue;

    const exports_ = row[2];
    const imports_ = row[6];
    if (typeof exports_ !== 'number' || typeof imports_ !== 'number') continue;

    const date = excelDateToYYYYMM(row[0]);
    if (parseInt(date.substring(0, 4)) < 2021) continue;

    monthly.push({
      date,
      imports: Math.round(imports_),
      exports: Math.round(exports_),
      balance: Math.round(exports_ - imports_),
    });
  }

  monthly.sort((a, b) => a.date.localeCompare(b.date));

  const existing = await readJson('trade.json');
  await writeJson('trade.json', {
    monthly,
    topExportCountries: existing.topExportCountries || [],
    topImportCountries: existing.topImportCountries || [],
    dataSource: 'SBP',
  });

  console.log(`  📊 ${monthly.length} months (${monthly[0]?.date} → ${monthly.at(-1)?.date})`);
  return monthly.length;
}

// ═══════════════════════════════════════════════════
// 2. FDI (Foreign_Dir, Netinflow, NetinflowSummary)
// ═══════════════════════════════════════════════════

async function updateFdi() {
  console.log('\n💰 Parsing FDI Data...');

  // --- By Sector (Foreign_Dir.xls / BS_M sheet) ---
  // Headers: Row 2 = period labels, Row 3 = sub-headers
  //   Col 0: Sector name (ISIC-4)
  //   Col 6: Net FDI for Jul-Mar FY26 (P)
  console.log('  📋 FDI by sector (Foreign_Dir.xls)...');
  const wbS = readExcel('Foreign_Dir.xls');
  const sRows = getSheet(wbS, 'BS_M');

  const bySector = [];
  for (let i = 4; i <= 27; i++) {
    const row = sRows[i];
    if (!row) continue;
    let sector = (row[0] || '').toString().trim();
    if (!sector) continue;
    if (/privatisation|total/i.test(sector)) continue;

    sector = sector.replace(/^[A-Z]\.\s+/, '');
    const netFdi = row[6];
    if (typeof netFdi !== 'number') continue;

    bySector.push({ sector: shortenSector(sector), amount: round2(netFdi) });
  }

  bySector.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const topSectors = bySector.slice(0, 9);
  const otherSectorAmt = bySector.slice(9).reduce((s, x) => s + x.amount, 0);
  if (Math.abs(otherSectorAmt) > 0.01) {
    topSectors.push({ sector: 'Others', amount: round2(otherSectorAmt) });
  }

  // --- By Country (Netinflow.xls / Country sheet) ---
  // Row 5: sub-headers.  Row 6+: data.
  //   Col 0: Sr. No (number),  Col 1: Country name
  //   Col 9: Net FDI for Jul-Mar FY26 (P)
  console.log('  📋 FDI by country (Netinflow.xls)...');
  const wbC = readExcel('Netinflow.xls');
  const cRows = getSheet(wbC, 'Country');

  const byCountry = [];
  for (let i = 6; i < cRows.length; i++) {
    const row = cRows[i];
    if (!row || typeof row[0] !== 'number') break;

    const country = (row[1] || '').toString().trim();
    const netFdi = row[9];
    if (!country || typeof netFdi !== 'number' || Math.abs(netFdi) < 0.01) continue;

    byCountry.push({ country, amount: round2(netFdi), flag: getFlag(country) });
  }

  byCountry.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const topCountries = byCountry.slice(0, 10);
  const otherCountryAmt = byCountry.slice(10).reduce((s, x) => s + x.amount, 0);
  if (Math.abs(otherCountryAmt) > 0.01) {
    topCountries.push({ country: 'Others', amount: round2(otherCountryAmt), flag: '🌍' });
  }

  // --- Annual FDI (NetinflowSummary.xls / Summary sheet) ---
  // Row 4: FY headers (col 4 = "FY09", col 5 = "FY10", ..., col 20 = "FY25 (R)")
  // Row 8: "Direct Investment" — net FDI values per fiscal year
  console.log('  📋 Annual FDI (NetinflowSummary.xls)...');
  const wbA = readExcel('NetinflowSummary.xls');
  const aRows = getSheet(wbA, 'Summary');

  const headerRow = aRows[4];
  const fdiRow = aRows[8]; // "Direct Investment" row

  const annual = [];
  for (let col = 4; col < headerRow.length; col++) {
    const hdr = (headerRow[col] || '').toString().trim();
    const m = hdr.match(/^FY(\d{2})/);
    if (!m) continue;

    const fy = parseInt(m[1]) + (parseInt(m[1]) >= 90 ? 1900 : 2000);
    if (fy < 2017) continue;

    const val = fdiRow[col];
    if (typeof val !== 'number') continue;

    annual.push({ year: `FY${fy}`, net_fdi: Math.round(val) });
  }

  await writeJson('fdi.json', {
    by_sector: topSectors,
    by_country: topCountries,
    annual,
    source: 'State Bank of Pakistan',
    dataSource: 'SBP',
  });

  console.log(`  📊 ${topSectors.length} sectors, ${topCountries.length} countries, ${annual.length} fiscal years`);
  return { sectors: topSectors.length, countries: topCountries.length, years: annual.length };
}

// ═══════════════════════════════════════════════════
// 3. GDP / FISCAL (GDP_table.xlsx)
// ═══════════════════════════════════════════════════

async function updateGdpFiscal() {
  console.log('\n📈 Parsing GDP Data (GDP_table.xlsx)...');

  const wb = readExcel('GDP_table.xlsx');
  const rows = getSheet(wb, 'Annual');

  // Row 4: year headers (col 2 = "1999-2000", col 3 = "2000-01", ..., col 27 = "2024-25")
  // Row 5: GDP Growth Rate (%)
  const headerRow = rows[4];
  const growthRow = rows[5];

  const existing = await readJson('fiscal.json');
  const map = new Map();
  for (const e of existing.annual || []) map.set(e.year, { ...e });

  for (let col = 2; col < headerRow.length; col++) {
    const yrStr = (headerRow[col] || '').toString().trim();
    const m = yrStr.match(/^(\d{4})-(\d{2})\s*$/);
    if (!m) continue;

    const fy = 2000 + parseInt(m[2]);
    if (fy < 2017 || fy > 2099) continue;

    const growth = growthRow[col];
    if (typeof growth !== 'number') continue;

    const key = `FY${fy}`;
    const entry = map.get(key) || { year: key };
    entry.gdpGrowth = round2(growth);
    map.set(key, entry);
  }

  const annual = Array.from(map.values()).sort((a, b) => a.year.localeCompare(b.year));

  await writeJson('fiscal.json', { annual, dataSource: 'SBP / PBS' });
  console.log(`  📊 ${annual.length} fiscal years with GDP growth data`);
  return annual.length;
}

// ═══════════════════════════════════════════════════
// 4. BALANCE OF PAYMENTS (Balancepayment_BPM6.xls)
//    Also updates kpi-summary.json
// ═══════════════════════════════════════════════════

async function updateBop() {
  console.log('\n🌐 Parsing Balance of Payments (Balancepayment_BPM6.xls)...');

  const wb = readExcel('Balancepayment_BPM6.xls');
  const rows = getSheet(wb, 'BPM6_Summary');

  // Column layout (rows 3-4):
  //   0: Items
  //   1: Jul-Jun FY24         6: Feb FY26R
  //   2: Mar FY25R            7: Mar FY26P
  //   3: Jul-Jun FY25R        8: Jan-Mar FY26P
  //   4: Jul-Sep FY26         9: Jul-Mar FY25R
  //   5: Oct-Dec FY26R       10: Jul-Mar FY26P
  //
  // Key data rows (0-indexed):
  //   6: Current Account Balance
  //   8: Exports of Goods FOB       9: Imports of Goods FOB
  //  24: Workers' Remittances
  //  34: Direct Investment (net, financial-account sign)
  //  38: Direct Investment in Pakistan (gross inflows)
  //  79: SBP Gross Reserves incl CFC

  const val = (r, c) => {
    const v = rows[r]?.[c];
    return typeof v === 'number' ? round2(v) : null;
  };

  const bop = {
    fy24: {
      currentAccount: val(6, 1), exportsFOB: val(8, 1), importsFOB: val(9, 1),
      remittances: val(24, 1), fdiInPakistan: val(38, 1),
    },
    fy25: {
      currentAccount: val(6, 3), exportsFOB: val(8, 3), importsFOB: val(9, 3),
      remittances: val(24, 3), fdiInPakistan: val(38, 3),
    },
    julMarFY26: {
      currentAccount: val(6, 10), exportsFOB: val(8, 10), importsFOB: val(9, 10),
      remittances: val(24, 10), fdiInPakistan: val(38, 10),
    },
    julMarFY25: {
      currentAccount: val(6, 9), exportsFOB: val(8, 9), importsFOB: val(9, 9),
      remittances: val(24, 9), fdiInPakistan: val(38, 9),
    },
    sbpReservesMar26: val(79, 7), // Mar FY26P column
  };

  // Use the last column that has the reserves value
  // Row 79 col 10 = Jul-Mar FY26P closing reserves
  const latestReserves = val(79, 10) ?? val(79, 7);

  // --- Update kpi-summary.json ---
  console.log('  📊 Updating KPI summary from BOP data...');
  const kpi = await readJson('kpi-summary.json');
  const indicators = kpi.indicators || [];

  const updateKpi = (id, updates) => {
    const kpiItem = indicators.find(i => i.id === id);
    if (kpiItem) Object.assign(kpiItem, updates);
  };

  if (latestReserves) {
    const reservesBn = round2(latestReserves / 1000);
    updateKpi('reserves', { value: reservesBn, period: 'Mar 2026', source: 'SBP' });
  }

  if (bop.julMarFY26.fdiInPakistan) {
    const fdiBn = round2(bop.julMarFY26.fdiInPakistan / 1000);
    updateKpi('fdi', {
      value: String(fdiBn), period: 'FY2026 (Jul-Mar)', source: 'SBP',
    });
  }

  if (bop.julMarFY26.remittances) {
    // Approximate latest monthly from quarterly data
    const julMarMonths = 9;
    const avgMonthly = round2(bop.julMarFY26.remittances / julMarMonths / 1000);
    // Keep existing monthly KPI unless we have a better figure
    // The remittances KPI is already updated by the API script, so only update period info
  }

  kpi.lastUpdated = new Date().toISOString().split('T')[0];
  await writeJson('kpi-summary.json', kpi);

  console.log('  📊 BOP Summary:');
  console.log(`     Current Account (FY25): $${bop.fy25.currentAccount}M`);
  console.log(`     Current Account (Jul-Mar FY26): $${bop.julMarFY26.currentAccount}M`);
  console.log(`     Exports FOB (Jul-Mar FY26): $${bop.julMarFY26.exportsFOB}M`);
  console.log(`     Remittances (Jul-Mar FY26): $${bop.julMarFY26.remittances}M`);
  console.log(`     FDI in Pakistan (Jul-Mar FY26): $${bop.julMarFY26.fdiInPakistan}M`);
  console.log(`     SBP Reserves (Mar 2026): $${latestReserves}M`);

  return bop;
}

// ═══════════════════════════════════════════════════
// 5. EXCHANGE RATES — attempt archive download
// ═══════════════════════════════════════════════════

async function downloadExchangeRateArchive() {
  console.log('\n💱 Attempting to download exchange rate archive...');
  const url = 'https://www.sbp.org.pk/ecodata/IBF_Arch.xls';
  const filepath = resolve(RAW_DIR, 'IBF_Arch.xls');

  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    if (!res.ok) {
      console.log(`  ⚠️  HTTP ${res.status} — exchange rate archive not available`);
      return false;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) {
      console.log(`  ⚠️  Response too small (${buffer.length} bytes) — likely an error page`);
      return false;
    }

    await writeFile(filepath, buffer);
    console.log(`  ✅ Downloaded IBF_Arch.xls (${(buffer.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    console.log(`  ⚠️  Download failed: ${err.message}`);
    return false;
  }
}

async function updateExchangeRates() {
  const archivePath = resolve(RAW_DIR, 'IBF_Arch.xls');
  if (!(await fileExists(archivePath))) {
    console.log('  ⏭  No exchange rate archive available — skipping');
    return 0;
  }

  console.log('\n💱 Parsing Exchange Rate Archive (IBF_Arch.xls)...');

  try {
    const wb = XLSX.readFile(archivePath);
    const sheetName = wb.SheetNames.find(s =>
      /monthly.*avg.*pkr/i.test(s)
    ) || wb.SheetNames[0];

    console.log(`  Using sheet: "${sheetName}"`);
    const rows = getSheet(wb, sheetName);

    // Structure: Row 7 = country names, Row 8 = currency names
    // Col 0 = month name ("January"), Col 1 = year (2026)
    // Col 5 = China (CNY), Col 22 = U.K. (GBP), Col 23 = U.S.A. (USD), Col 24 = EMU (EUR)
    // Detect columns from the first set of country/currency headers (cols 2-25)
    // The sheet has a duplicate set of columns starting around col 27 — ignore those.
    let usdCol = -1, eurCol = -1, gbpCol = -1, cnyCol = -1;

    const countryRow = rows[7] || [];
    const currencyRow = rows[8] || [];
    const maxCol = Math.min(26, Math.max(countryRow.length, currencyRow.length));
    for (let c = 0; c < maxCol; c++) {
      const country = (countryRow[c] || '').toString().toLowerCase().trim();
      const currency = (currencyRow[c] || '').toString().toLowerCase().trim();
      if (usdCol < 0 && (/u\.?s\.?a|united states/.test(country) || /u\.?s\.?\s*dollar/.test(currency))) usdCol = c;
      if (eurCol < 0 && (/emu|euro/i.test(country) || /^euro$/i.test(currency))) eurCol = c;
      if (gbpCol < 0 && (/u\.?k|united kingdom/i.test(country) || /pound sterling/i.test(currency))) gbpCol = c;
      if (cnyCol < 0 && (/china/i.test(country) || /yuan|renminbi/i.test(currency))) cnyCol = c;
    }

    if (usdCol < 0) {
      console.log('  ⚠️  Could not identify USD column');
      return 0;
    }

    console.log(`  Columns: USD=${usdCol} EUR=${eurCol} GBP=${gbpCol} CNY=${cnyCol}`);

    const MONTH_MAP = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12',
    };

    const monthly = [];
    // Data rows start after the header area; first monthly rows begin around row 9+
    // Early rows have range periods like "Aug 1947 to Jun 1949" — skip those
    for (let i = 9; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const monthStr = (row[0] || '').toString().trim().toLowerCase();
      const yearVal = row[1];
      const usd = row[usdCol];

      // Need a valid month name, a numeric year, and a numeric USD rate
      const mm = MONTH_MAP[monthStr];
      if (!mm) continue;
      if (typeof yearVal !== 'number' || yearVal < 1900) continue;
      if (typeof usd !== 'number' || usd <= 0) continue;

      const year = Math.round(yearVal);
      if (year < 2021) continue;

      const date = `${year}-${mm}`;
      const entry = { date, USD: round2(usd) };
      if (eurCol >= 0 && typeof row[eurCol] === 'number' && row[eurCol] > 0) entry.EUR = round2(row[eurCol]);
      if (gbpCol >= 0 && typeof row[gbpCol] === 'number' && row[gbpCol] > 0) entry.GBP = round2(row[gbpCol]);
      if (cnyCol >= 0 && typeof row[cnyCol] === 'number' && row[cnyCol] > 0) entry.CNY = round2(row[cnyCol]);
      monthly.push(entry);
    }

    if (monthly.length === 0) {
      console.log('  ⚠️  No exchange rate data extracted');
      return 0;
    }

    monthly.sort((a, b) => a.date.localeCompare(b.date));
    await writeJson('exchange-rates.json', { monthly, dataSource: 'SBP' });
    console.log(`  📊 ${monthly.length} months (${monthly[0]?.date} → ${monthly.at(-1)?.date})`);
    return monthly.length;
  } catch (err) {
    console.log(`  ⚠️  Parse error: ${err.message}`);
    return 0;
  }
}

// ═══════════════════════════════════════════════════
// 6. RESERVES (forex.pdf)
// ═══════════════════════════════════════════════════

function parseForexPdf() {
  return new Promise((resolve_, reject) => {
    const items = [];
    let currentPage = 0;
    new PdfReader().parseFileItems(resolve(RAW_DIR, 'forex.pdf'), (err, item) => {
      if (err) { reject(err); return; }
      if (!item) { resolve_(items); return; }
      if (item.page) { currentPage = item.page; return; }
      if (item.text) items.push({ page: currentPage, x: item.x, y: item.y, text: item.text });
    });
  });
}

const MONTH_NAMES_SHORT = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseReservesDate(raw) {
  if (!raw) return null;
  let s = raw.replace(/\s*\(?\s*[RP]\s*\)?\s*$/i, '').replace(/^1\/\s*/, '').trim();

  // Annual: "2020-21" → FY2021
  if (/^\d{4}-\d{2}$/.test(s)) {
    const fy = parseInt(s.split('-')[1]);
    const year = fy >= 90 ? 1900 + fy : 2000 + fy;
    return { type: 'annual', date: `FY${year}` };
  }

  // Weekly: "6-Mar-26", "13-Mar-26", "27-Mar-26" → DD-Mon-YY
  const weeklyMatch = s.match(/^(\d{1,2})-(\w{3})-(\d{2})$/);
  if (weeklyMatch) {
    const day = String(weeklyMatch[1]).padStart(2, '0');
    const mm = MONTH_NAMES_SHORT[weeklyMatch[2].toLowerCase()];
    const yr = parseInt(weeklyMatch[3]);
    const year = yr >= 90 ? 1900 + yr : 2000 + yr;
    if (mm) return { type: 'weekly', date: `${year}-${mm}-${day}` };
  }

  // Monthly: "Feb 25" → month + 2-digit year
  const monthlyMatch = s.match(/^(\w{3})\s+(\d{2})$/);
  if (monthlyMatch) {
    const mm = MONTH_NAMES_SHORT[monthlyMatch[1].toLowerCase()];
    const yr = parseInt(monthlyMatch[2]);
    const year = yr >= 90 ? 1900 + yr : 2000 + yr;
    if (mm) return { type: 'monthly', date: `${year}-${mm}` };
  }

  return null;
}

async function updateReserves() {
  console.log('\n🏦 Parsing Reserves Data (forex.pdf)...');

  const pdfItems = await parseForexPdf();
  console.log(`  📋 Extracted ${pdfItems.length} text items from PDF`);

  // Group items by page + y-coordinate (rounded to nearest integer)
  const rowMap = new Map();
  for (const item of pdfItems) {
    const key = `${item.page}-${Math.round(item.y)}`;
    if (!rowMap.has(key)) rowMap.set(key, { page: item.page, y: Math.round(item.y), cells: [] });
    rowMap.get(key).cells.push({ x: item.x, text: item.text.trim() });
  }

  // Sort rows by page then y
  const rows = Array.from(rowMap.values()).sort((a, b) => a.page - b.page || a.y - b.y);

  // Sort cells within each row by x
  for (const row of rows) {
    row.cells.sort((a, b) => a.x - b.x);
  }

  const weekly = [];

  for (const row of rows) {
    // Filter out whitespace-only and annotation cells like "R", "1/", "Provisonal"
    const texts = row.cells.map(c => c.text).filter(t => t.trim() && !/^\s*$/.test(t));
    if (texts.length < 2) continue;

    // Skip header/label rows
    if (texts.some(t => /END\s+PERIOD|NET\s+RESERVES|TOTAL\s+LIQUID|Million|MONTH-END|Provisonal/i.test(t))) continue;

    // Find the date — it may be preceded by "1/" or followed by "R"
    let dateStr = null;
    let dateIdx = 0;
    for (let i = 0; i < Math.min(3, texts.length); i++) {
      const candidate = texts[i].replace(/^1\/\s*/, '').replace(/\s*R\s*$/, '').trim();
      if (candidate === 'R' || candidate === '1/' || candidate === '') continue;
      const parsed = parseReservesDate(candidate);
      if (parsed) {
        dateStr = candidate;
        dateIdx = i;
        break;
      }
    }
    if (!dateStr) continue;

    const parsed = parseReservesDate(dateStr);
    if (!parsed) continue;

    // Extract numeric values from remaining cells
    const nums = [];
    for (let i = dateIdx + 1; i < texts.length; i++) {
      const cleaned = texts[i].replace(/,/g, '').replace(/\s*R\s*$/i, '').replace(/^\s*R\s*$/, '').trim();
      if (cleaned === '' || cleaned === 'R' || cleaned === '1/') continue;
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n > 0) nums.push(n);
    }

    if (nums.length < 2) continue;

    // Skip annual summary rows — only keep monthly and weekly data
    if (parsed.type === 'annual') continue;

    const sbp = round2(nums[0]);
    const banks = round2(nums[1]);
    const total = nums.length >= 3 ? round2(nums[2]) : round2(sbp + banks);

    weekly.push({ date: parsed.date, sbp, banks, total });
  }

  // Sort by date
  weekly.sort((a, b) => a.date.localeCompare(b.date));

  await writeJson('reserves.json', {
    weekly,
    dataSource: 'SBP',
    lastUpdated: '2026-04-16',
    dataCoverage: 'FY2021 – Apr 2026',
  });

  console.log(`  📊 ${weekly.length} reserve data points (${weekly[0]?.date} → ${weekly.at(-1)?.date})`);
  return weekly.length;
}

// ═══════════════════════════════════════════════════
// 7. SERVICES (dt.xls — EBOPS classification)
// ═══════════════════════════════════════════════════

async function updateServices() {
  console.log('\n💻 Parsing Services Data (dt.xls)...');

  const wb = readExcel('dt.xls');
  // Sheet name has trailing space: "EBOPS "
  const sheetName = wb.SheetNames.find(s => /EBOPS/i.test(s));
  if (!sheetName) throw new Error('EBOPS sheet not found. Available: ' + wb.SheetNames.join(', '));
  console.log(`  Using sheet: "${sheetName}"`);
  const rows = getSheet(wb, sheetName);

  // Cumulative Jul-Feb FY26 (P) = cols 13-15 (Credit, Debit, Net)
  // Cumulative Jul-Feb FY25 (R) = cols 10-12 (Credit, Debit, Net)
  // Values in THOUSAND US$
  const toM = (v) => (typeof v === 'number' ? round2(v / 1000) : 0);

  // Key row indices (0-based) for categories
  const categoryRows = [
    { row: 13, name: 'Transport' },
    { row: 33, name: 'Travel' },
    { row: 46, name: 'Insurance & Pension' },
    { row: 54, name: 'Financial Services' },
    { row: 57, name: 'IP Charges' },
    { row: 58, name: 'IT & Telecom' },
    { row: 72, name: 'Other Business' },
    { row: 87, name: 'Personal/Cultural' },
  ];

  const categories = [];
  for (const { row, name } of categoryRows) {
    const r = rows[row];
    if (!r) continue;
    categories.push({
      name,
      credit: toM(r[13]),
      debit: toM(r[14]),
      net: toM(r[15]),
      period: 'Jul-Feb FY26',
    });
  }

  // IT sub-category breakdown
  const itBreakdown = [
    { row: 59, name: 'Telecom' },
    { row: 64, name: 'Software Consultancy' },
    { row: 66, name: 'Computer Software Export/Import' },
    { row: 67, name: 'Freelance IT' },
    { row: 69, name: 'Information Services' },
  ];

  const itItems = [];
  for (const { row, name } of itBreakdown) {
    const r = rows[row];
    if (!r) continue;
    itItems.push({ name, credit: toM(r[13]) });
  }

  // Compute "Other Computer Services" = Computer services (row 62) minus the named subcategories
  const computerServicesRow = rows[62];
  if (computerServicesRow) {
    const computerTotal = toM(computerServicesRow[13]);
    const namedSum = itItems.filter(i => ['Software Consultancy', 'Computer Software Export/Import', 'Freelance IT'].includes(i.name))
      .reduce((s, x) => s + x.credit, 0);
    const other = round2(computerTotal - namedSum);
    if (other > 0) itItems.push({ name: 'Other Computer Services', credit: other });
  }

  // Total services row (row 8)
  const totalRow = rows[8];
  const totalCredit = toM(totalRow?.[13]);
  const totalDebit = toM(totalRow?.[14]);
  const totalNet = toM(totalRow?.[15]);

  // IT & Telecom (row 58)
  const itRow = rows[58];
  const itCredit = toM(itRow?.[13]);
  const itNet = toM(itRow?.[15]);

  // Computer services (row 62)
  const csCredit = toM(computerServicesRow?.[13]);

  // FY25 comparison (cols 10-12)
  const totalCreditFY25 = toM(totalRow?.[10]);
  const itCreditFY25 = toM(rows[58]?.[10]);

  const servicesData = {
    categories,
    itBreakdown: itItems,
    summary: {
      totalServicesCredit: totalCredit,
      totalServicesDebit: totalDebit,
      totalServicesNet: totalNet,
      itTelecomCredit: itCredit,
      itTelecomNet: itNet,
      computerServicesCredit: csCredit,
      period: 'Jul-Feb FY26',
    },
    comparison: {
      fy25: { totalCredit: totalCreditFY25, itCredit: itCreditFY25 },
      fy26: { totalCredit: totalCredit, itCredit: itCredit },
      period: 'Jul-Feb',
    },
    dataSource: 'SBP',
    lastUpdated: '2026-04-16',
    dataCoverage: 'Jul-Feb FY2026',
  };

  await writeJson('services.json', servicesData);

  console.log(`  📊 ${categories.length} service categories, ${itItems.length} IT sub-categories`);
  console.log(`     Total Services Credit: $${totalCredit}M, IT&Telecom: $${itCredit}M`);
  return servicesData;
}

// ═══════════════════════════════════════════════════
// 8. TRADE BY COUNTRY (Export/Import by country files)
// ═══════════════════════════════════════════════════

async function updateTradeCountries() {
  console.log('\n🌍 Parsing Trade by Country...');

  // --- Exports by Country ---
  console.log('  📋 Export destinations (Export_Receipts_by_all_Countries.xls)...');
  const wbExp = readExcel('Export_Receipts_by_all_Countries.xls');
  const expSheetName = wbExp.SheetNames.find(s => /Exp.*Acount/i.test(s)) || wbExp.SheetNames[0];
  console.log(`  Using sheet: "${expSheetName}"`);
  const expRows = getSheet(wbExp, expSheetName);

  // Find the Jul-Mar FY26 column — it's the last data column
  // Row 4 has period headers, Row 5 has FY sub-headers
  // Look for the last column with "FY26" in row 5
  const expHeader4 = expRows[4] || [];
  const expHeader5 = expRows[5] || [];
  let expCol = -1;
  for (let c = expHeader5.length - 1; c >= 0; c--) {
    const h5 = (expHeader5[c] || '').toString();
    if (/FY26/i.test(h5)) { expCol = c; break; }
  }
  if (expCol < 0) {
    // Fallback: use last numeric column
    expCol = 7;
  }
  console.log(`  Export data column: ${expCol}`);

  const exportCountries = [];
  for (let i = 6; i < expRows.length; i++) {
    const row = expRows[i];
    if (!row) continue;
    const country = (row[0] || '').toString().trim();
    if (!country || /^total|^grand|^sub|^all|^others?\s*$/i.test(country)) continue;
    if (/^\d+$/.test(country)) continue;
    // Skip section headers like "I. Export Receipts through Banks", "II. ..."
    if (/^[IVX]+\./i.test(country)) continue;
    if (/receipts|payments|through\s+banks|memo|of which/i.test(country)) continue;

    const val = row[expCol];
    if (typeof val !== 'number' || val <= 0) continue;

    // Convert from thousands to millions
    exportCountries.push({
      country: country.replace(/\s*\*+$/, '').trim(),
      value: round2(val / 1000),
      flag: getFlag(country.replace(/\s*\*+$/, '').trim()),
    });
  }

  exportCountries.sort((a, b) => b.value - a.value);
  const topExportCountries = exportCountries.slice(0, 15);

  // --- Imports by Country ---
  console.log('  📋 Import sources (Import-Payments-by-All-Countries.xlsx)...');
  const wbImp = readExcel('Import-Payments-by-All-Countries.xlsx');
  const impSheetName = wbImp.SheetNames.find(s => /Import/i.test(s)) || wbImp.SheetNames[0];
  console.log(`  Using sheet: "${impSheetName}"`);
  const impRows = getSheet(wbImp, impSheetName);

  const impHeader5 = impRows[5] || [];
  let impCol = -1;
  for (let c = impHeader5.length - 1; c >= 0; c--) {
    const h5 = (impHeader5[c] || '').toString();
    if (/FY26/i.test(h5)) { impCol = c; break; }
  }
  if (impCol < 0) impCol = 7;
  console.log(`  Import data column: ${impCol}`);

  const importCountries = [];
  for (let i = 6; i < impRows.length; i++) {
    const row = impRows[i];
    if (!row) continue;
    const country = (row[0] || '').toString().trim();
    if (!country || /^total|^grand|^sub|^all|^others?\s*$/i.test(country)) continue;
    if (/^\d+$/.test(country)) continue;
    if (/^[IVX]+\./i.test(country)) continue;
    if (/receipts|payments|through\s+banks|memo|of which/i.test(country)) continue;

    const val = row[impCol];
    if (typeof val !== 'number' || val <= 0) continue;

    importCountries.push({
      country: country.replace(/\s*\*+$/, '').trim(),
      value: round2(val / 1000),
      flag: getFlag(country.replace(/\s*\*+$/, '').trim()),
    });
  }

  importCountries.sort((a, b) => b.value - a.value);
  const topImportCountries = importCountries.slice(0, 15);

  // Update trade.json — merge with existing data
  const existing = await readJson('trade.json');
  existing.topExportCountries = topExportCountries;
  existing.topImportCountries = topImportCountries;
  await writeJson('trade.json', existing);

  console.log(`  📊 Top ${topExportCountries.length} export destinations, Top ${topImportCountries.length} import sources`);
  return { exports: topExportCountries.length, imports: topImportCountries.length };
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

async function main() {
  console.log('\n🇵🇰 Parsing SBP Excel files...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Source: scripts/sbp-raw/');
  console.log('  Target: public/data/');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const summary = {};

  // 1. Try downloading exchange rate archive first
  const archiveOk = await downloadExchangeRateArchive();

  // 2. Parse trade data
  summary.trade = await updateTrade();

  // 3. Parse FDI data
  summary.fdi = await updateFdi();

  // 4. Parse GDP / fiscal data
  summary.fiscal = await updateGdpFiscal();

  // 5. Parse BOP (also updates KPI)
  summary.bop = await updateBop();

  // 6. Exchange rates (if archive was downloaded)
  if (archiveOk) {
    summary.exchangeRates = await updateExchangeRates();
  }

  // 7. Reserves (forex.pdf)
  try {
    summary.reserves = await updateReserves();
  } catch (err) {
    console.log(`  ⚠️  Reserves parse error: ${err.message}`);
  }

  // 8. Services (dt.xls — EBOPS)
  try {
    summary.services = await updateServices();
  } catch (err) {
    console.log(`  ⚠️  Services parse error: ${err.message}`);
  }

  // 9. Trade by country
  try {
    summary.tradeCountries = await updateTradeCountries();
  } catch (err) {
    console.log(`  ⚠️  Trade countries parse error: ${err.message}`);
  }

  // ─── Summary ───
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Parse Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✅ trade.json       — ${summary.trade} monthly data points`);
  console.log(`  ✅ fdi.json         — ${summary.fdi?.sectors} sectors, ${summary.fdi?.countries} countries, ${summary.fdi?.years} FY`);
  console.log(`  ✅ fiscal.json      — ${summary.fiscal} fiscal years`);
  console.log(`  ✅ kpi-summary.json — updated from BOP data`);
  if (summary.exchangeRates) {
    console.log(`  ✅ exchange-rates.json — ${summary.exchangeRates} months`);
  } else {
    console.log(`  ⏭  exchange-rates.json — no archive data available`);
  }
  if (summary.reserves) {
    console.log(`  ✅ reserves.json    — ${summary.reserves} data points`);
  }
  if (summary.services) {
    console.log(`  ✅ services.json    — updated from EBOPS data`);
  }
  if (summary.tradeCountries) {
    console.log(`  ✅ trade.json       — added ${summary.tradeCountries.exports} export + ${summary.tradeCountries.imports} import countries`);
  }
  console.log('\n✨ Done!\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
