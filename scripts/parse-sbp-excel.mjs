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
 *   - Foreign_Dir.xls           → (broad ISIC sector cut, superseded by Netinflow.xls)
 *   - Netinflow.xls             → fdi.json (by country)
 *   - NetinflowSummary.xls      → fdi.json (annual)
 *   - GDP_table.xlsx            → fiscal.json
 *   - Balancepayment_BPM6.xls   → services.json (BOP services aggregate)
 *   - dt.xls                    → services.json (detailed EBOPS categories)
 *   - ExportsImports-Goods.pdf  → services.json (latest IT headline)
 *
 * Also attempts to download IBF_Arch.xls for exchange rate history.
 */

import XLSX from 'xlsx';
import * as fs from 'fs';
import { readFile, writeFile, access } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parsePdfTextItems } from './pdf-text.mjs';
import {
  requireColumn,
  requireRowIndex,
  findRowIndex,
  forwardFill,
  latestFiscalYear,
  parseFiscalYear as parseFullFy,
} from './lib/sheet-utils.mjs';
import { recordProvenance, flushProvenance } from './lib/provenance-store.mjs';
import { writeDataFile } from './lib/data-writer.mjs';
import {
  classifyCountryColumns,
  resolveFdiCountryColumns,
  resolveServicesColumns,
  fyMonthToYearMonth,
  EBOPS_ROW_PATTERNS,
} from './lib/sbp-resolvers.mjs';
import { parseServicesHeadline } from './lib/services-headline.mjs';
import { parseReserveObservations } from './lib/reserves-parser.mjs';
import { fbrCollectionLabel } from '../src/utils/periodHelpers.js';

XLSX.set_fs(fs);

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

function directionalSentiment(trend, positiveWhenUp = true) {
  if (trend === 'stable') return 'neutral';
  const positive = positiveWhenUp ? trend === 'up' : trend === 'down';
  return positive ? 'positive' : 'negative';
}

function targetBandSentiment(value, trend, min, max) {
  if (value >= min && value <= max) return 'positive';
  if (value > max) return trend === 'down' ? 'positive' : 'negative';
  return trend === 'up' ? 'positive' : 'negative';
}

/** Months in fiscal-year order, so July sorts before January. */
const FISCAL_MONTH_ORDER = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'];

function fiscalPeriodEndIndex(period) {
  const match = String(period || '').match(/jul(?:y)?[-\s]+([a-z]+)/i);
  if (!match) return null;
  const end = match[1].slice(0, 3).toLowerCase();
  const index = FISCAL_MONTH_ORDER.indexOf(end);
  return index >= 0 ? index : null;
}

/**
 * SBP spells the same cumulative span differently per workbook ("Jul-May",
 * "July-June FY26", "July-June-FY26"). Render one consistent label.
 */
function formatFyPeriodLabel(period) {
  const raw = String(period || '').trim();
  const match = raw.match(/jul(?:y)?[-\s]+([a-z]+)/i);
  if (!match) return raw;
  const cap = (s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
  const span = `Jul-${cap(match[1].slice(0, 3).toLowerCase())}`;
  const fy = raw.match(/FY\s*-?\s*(\d{2,4})/i);
  return fy ? `${span} FY${fy[1]}` : span;
}

/**
 * SBP spells the same cumulative span differently per workbook ("Jul-May",
 * "July-June FY26"). Reduce it to a bare month span so the fiscal year is
 * carried once, by the label, and never printed twice in the UI.
 */
function normaliseFytdPeriod(period) {
  const raw = String(period || '').trim();
  // First month of a new FY is often published as a standalone "July 2026".
  if (/^jul(?:y)?[-\s]*\d{4}/i.test(raw) && !/jul(?:y)?[-\s]+[a-z]/i.test(raw)) {
    return 'Jul-Jul';
  }
  const match = raw.match(/jul(?:y)?[-\s]+([a-z]+)/i);
  if (!match) return raw;
  const end = match[1].slice(0, 3).toLowerCase();
  return `Jul-${end.charAt(0).toUpperCase()}${end.slice(1)}`;
}

function isLegacyExcel(buffer) {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return signature.every((byte, index) => buffer[index] === byte);
}

async function readJson(filename) {
  const raw = await readFile(resolve(DATA_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(filename, data) {
  const { changed, revisions } = await writeDataFile(filename, data);
  console.log(
    `  ✅ Updated ${filename}${changed ? '' : ' (no change)'}${revisions ? ` · ${revisions} revision(s) logged` : ''}`,
  );
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
  // Netinflow.xls publishes its own, more detailed sector list.
  'transport equipment(automobiles)': 'Automobiles',
  'oil & gas explorations': 'Oil & Gas Exploration',
  'financial business': 'Financial Business',
  'machinery other than electrical': 'Machinery (non-electrical)',
  'pharmaceuticals & otc products': 'Pharmaceuticals',
  'leather & leather products': 'Leather Products',
  'rubber & rubber products': 'Rubber Products',
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
  const sheetName = wb.SheetNames.find(name =>
    ['Exp.Imp.(BOP)Arch', 'Exp.Imp.(BOP)'].includes(name.trim()),
  );
  if (!sheetName) {
    throw new Error(`Trade sheet not found. Available: ${wb.SheetNames.join(', ')}`);
  }
  const rows = getSheet(wb, sheetName);
  const currentArchiveLayout = sheetName.trim() === 'Exp.Imp.(BOP)Arch';
  const dateCol = currentArchiveLayout ? 1 : 0;
  const exportsCol = currentArchiveLayout ? 3 : 2;
  const importsCol = currentArchiveLayout ? 7 : 6;

  // The current SBP archive adds a leading blank column and a revision-status
  // column. The legacy workbook remains supported as a fallback source.
  const monthly = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row[dateCol] !== 'number') continue;

    const exports_ = row[exportsCol];
    const imports_ = row[importsCol];
    if (typeof exports_ !== 'number' || typeof imports_ !== 'number') continue;

    const date = excelDateToYYYYMM(row[dateCol]);
    if (parseInt(date.substring(0, 4)) < 2021) continue;

    monthly.push({
      date,
      imports: Math.round(imports_),
      exports: Math.round(exports_),
      balance: Math.round(exports_ - imports_),
    });
  }

  monthly.sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(monthly.map(row => row.date)).size !== monthly.length) {
    throw new Error('Trade source contains duplicate monthly observations');
  }

  const existing = await readJson('trade.json');
  const firstDate = monthly[0]?.date;
  const lastDate = monthly.at(-1)?.date;
  await writeJson('trade.json', {
    ...existing,
    monthly,
    topExportCountries: existing.topExportCountries || [],
    topImportCountries: existing.topImportCountries || [],
    exportCountryPeriod: existing.exportCountryPeriod || null,
    importCountryPeriod: existing.importCountryPeriod || null,
    dataSource: 'SBP',
    lastUpdated: new Date().toISOString().split('T')[0],
    dataCoverage: `${firstDate} – ${lastDate}`,
  });

  console.log(`  📊 ${monthly.length} months (${firstDate} → ${lastDate})`);
  return monthly.length;
}

// ═══════════════════════════════════════════════════
// 2. FDI (Netinflow sector/country, NetinflowSummary annual)
// ═══════════════════════════════════════════════════

async function updateFdi() {
  console.log('\n💰 Parsing FDI Data...');

  // --- By Sector (Netinflow.xls / Sector sheet) ---
  // SBP publishes two sector cuts: Foreign_Dir.xls carries broad ISIC letter
  // sections, Netinflow.xls carries its own detailed sector list. The detailed
  // sheet is refreshed earlier in the month and its rows sum exactly to the
  // published total, so it is the source of record here. Row 5 = period block,
  // row 6 = Inflow/Outflow/Net FDI sub-headers, rows 7+ = data.
  console.log('  📋 FDI by sector (Netinflow.xls)...');
  const wbS = readExcel('Netinflow.xls');
  const sRows = getSheet(wbS, 'Sector');

  // Columns are resolved from the printed fiscal year, never by position: if
  // SBP moves these columns we must fail loudly instead of silently publishing
  // a different period's numbers.
  const sectorCols = resolveFdiCountryColumns(sRows[5] || [], sRows[6] || [], sRows[6] || [], {
    file: 'Netinflow.xls',
    sheet: 'Sector',
  });
  const sCurrentInCol = sectorCols.current.inflow;
  const sCurrentOutCol = sectorCols.current.outflow;
  const sCurrentNetCol = sectorCols.current.net;
  const sPriorInCol = sectorCols.prior.inflow;
  const sPriorOutCol = sectorCols.prior.outflow;
  const sPriorNetCol = sectorCols.prior.net;
  const sCurrentPeriod = sectorCols.current.period;
  const sPriorPeriod = sectorCols.prior.period;
  console.log(`  Sector columns: current ${sCurrentPeriod} @${sCurrentNetCol}, prior ${sPriorPeriod} @${sPriorNetCol}`);

  // The sheet nests breakdowns under their parent ("Power" is followed by
  // "I) Thermal", "II) Hydel"). Only top-level rows are summed, otherwise the
  // sector table would double-count and stop reconciling with the total.
  const SECTOR_SUBROW = /^(?:[IVX]+\)|\d+\)|of which)/i;
  const allSectors = [];
  for (let i = 7; i < sRows.length; i++) {
    const row = sRows[i];
    if (!row) continue;
    const sector = (row[2] || '').toString().trim();
    if (!sector) continue;
    if (/^total/i.test(sector)) break;
    if (SECTOR_SUBROW.test(sector)) continue;

    const netFdi = row[sCurrentNetCol];
    if (typeof netFdi !== 'number') continue;

    const entry = {
      sector: shortenSector(sector),
      amount: round2(netFdi),
      inflow: typeof row[sCurrentInCol] === 'number' ? round2(row[sCurrentInCol]) : null,
      outflow: typeof row[sCurrentOutCol] === 'number' ? round2(row[sCurrentOutCol]) : null,
    };
    // Prior year comparison
    const priorNet = row[sPriorNetCol];
    if (typeof priorNet === 'number') {
      entry.priorAmount = round2(priorNet);
      entry.priorInflow = typeof row[sPriorInCol] === 'number' ? round2(row[sPriorInCol]) : null;
      entry.priorOutflow = typeof row[sPriorOutCol] === 'number' ? round2(row[sPriorOutCol]) : null;
    }
    allSectors.push(entry);
  }

  // Stable sector universe: rank by max absolute net across both years
  allSectors.sort((a, b) => {
    const magA = Math.max(Math.abs(a.amount), Math.abs(a.priorAmount || 0));
    const magB = Math.max(Math.abs(b.amount), Math.abs(b.priorAmount || 0));
    return magB - magA;
  });
  // The sheet already publishes its own "Others" line; fold it into the
  // remainder bucket so the chart cannot show two rows with the same name.
  const rawOtherSectorIdx = allSectors.findIndex((s) => /^others$/i.test(s.sector));
  const rawOtherSector = rawOtherSectorIdx >= 0 ? allSectors.splice(rawOtherSectorIdx, 1)[0] : null;
  const topSectors = allSectors.slice(0, 10);
  const otherSectorAmt = allSectors.slice(10).reduce((s, x) => s + x.amount, 0) + (rawOtherSector?.amount || 0);
  const otherSectorPrior = allSectors.slice(10).reduce((s, x) => s + (x.priorAmount || 0), 0) + (rawOtherSector?.priorAmount || 0);
  if (Math.abs(otherSectorAmt) > 0.01 || Math.abs(otherSectorPrior) > 0.01) {
    topSectors.push({
      sector: 'Others',
      amount: round2(otherSectorAmt),
      inflow: null, outflow: null,
      priorAmount: round2(otherSectorPrior),
      priorInflow: null, priorOutflow: null,
    });
  }

  // --- By Country (Netinflow.xls / Country sheet) ---
  // Row 3: period headers, Row 4: sub-headers, Row 6+: data
  console.log('  📋 FDI by country (Netinflow.xls)...');
  const wbC = readExcel('Netinflow.xls');
  const cRows = getSheet(wbC, 'Country');

  // Resolve column indices from header rows. Current vs prior is decided by the
  // fiscal year printed in the header, not by column order or the (P) marker.
  // Row 3 = period block, row 4 = instrument (FDI / FPI / Total),
  // row 5 = FDI sub-column (Inflow / Outflow / Net).
  const countryCols = resolveFdiCountryColumns(cRows[3] || [], cRows[4] || [], cRows[5] || [], {
    file: 'Netinflow.xls',
    sheet: 'Country',
  });
  const cCurrentNetCol = countryCols.current.net;
  const cPriorNetCol = countryCols.prior.net;
  const cCurrentPeriod = countryCols.current.period;
  const cPriorPeriod = countryCols.prior.period;
  console.log(`  Country columns: current ${cCurrentPeriod} @${cCurrentNetCol}, prior ${cPriorPeriod} @${cPriorNetCol}`);

  const allCountries = [];
  const countryNames = new Set();
  for (let i = 6; i < cRows.length; i++) {
    const row = cRows[i];
    if (!row || typeof row[0] !== 'number') break;

    const country = (row[1] || '').toString().trim();
    const netFdi = row[cCurrentNetCol];
    if (!country || typeof netFdi !== 'number' || Math.abs(netFdi) < 0.01) continue;
    if (countryNames.has(country)) continue; // dedupe "Others"
    countryNames.add(country);

    const entry = { country, amount: round2(netFdi), flag: getFlag(country) };
    const priorNet = row[cPriorNetCol];
    if (typeof priorNet === 'number') entry.priorAmount = round2(priorNet);
    allCountries.push(entry);
  }

  allCountries.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  // The country sheet's own "Total" line is the same measure the summary
  // workbook publishes (net FDI for the fiscal year to date), but SBP refreshes
  // Netinflow.xls earlier in the month than NetinflowSummary.xls. Capture it so
  // the headline can prefer whichever official file covers the later period.
  let countryFytd = null;
  const totalRowIdx = findRowIndex(cRows, /^total$/i, { labelCol: 0, from: 6 });
  if (totalRowIdx >= 0) {
    const totalRow = cRows[totalRowIdx];
    const readCol = (col) => (typeof col === 'number' && typeof totalRow[col] === 'number' ? round2(totalRow[col]) : null);
    const currentNet = readCol(cCurrentNetCol);
    const priorNet = readCol(cPriorNetCol);
    if (currentNet != null) {
      countryFytd = {
        period: normaliseFytdPeriod(cCurrentPeriod),
        current: {
          label: `FY${countryCols.current.fiscalYear}`,
          net_fdi: currentNet,
          inflow: readCol(countryCols.current.inflow),
          outflow: readCol(countryCols.current.outflow),
          status: countryCols.current.status === 'provisional' ? 'provisional' : null,
        },
        prior: priorNet != null ? {
          label: `FY${countryCols.prior.fiscalYear}`,
          net_fdi: priorNet,
          inflow: readCol(countryCols.prior.inflow),
          outflow: readCol(countryCols.prior.outflow),
        } : null,
        sourceFile: 'Netinflow.xls',
        sourceSheet: 'Country',
        sourceLocation: '"Total" row, net FDI column of the current fiscal-year-to-date block',
      };
      console.log(`  Country totals: ${cCurrentPeriod} net $${currentNet}M (prior ${cPriorPeriod} $${priorNet}M)`);
    }
  }

  // Separate raw "Others" from named countries, then aggregate remainder into "Others"
  const rawOthersIdx = allCountries.findIndex(c => c.country.toLowerCase() === 'others');
  const rawOthers = rawOthersIdx >= 0 ? allCountries.splice(rawOthersIdx, 1)[0] : null;
  const topCountries = allCountries.slice(0, 10);
  const remainderAmt = allCountries.slice(10).reduce((s, x) => s + x.amount, 0) + (rawOthers?.amount || 0);
  const remainderPrior = allCountries.slice(10).reduce((s, x) => s + (x.priorAmount || 0), 0) + (rawOthers?.priorAmount || 0);
  if (Math.abs(remainderAmt) > 0.01 || Math.abs(remainderPrior) > 0.01) {
    topCountries.push({
      country: 'Others', amount: round2(remainderAmt), flag: '🌍',
      priorAmount: round2(remainderPrior),
    });
  }

  // --- Annual FDI (NetinflowSummary.xls / Summary sheet) ---
  // Rows are located by their own labels, not by fixed indices, so an inserted
  // row upstream can never silently shift which line we publish.
  console.log('  📋 Annual FDI (NetinflowSummary.xls)...');
  const wbA = readExcel('NetinflowSummary.xls');
  const aRows = getSheet(wbA, 'Summary');

  const summaryCtx = { file: 'NetinflowSummary.xls', sheet: 'Summary' };
  const fdiRowIdx = requireRowIndex(aRows, /^Direct\s+Investment$/i, { labelCol: 1, ...summaryCtx });
  const inflowRowIdx = requireRowIndex(aRows, /^Inflow$/i, { labelCol: 3, from: fdiRowIdx, to: fdiRowIdx + 4 });
  const outflowRowIdx = requireRowIndex(aRows, /^Outflow$/i, { labelCol: 3, from: fdiRowIdx, to: fdiRowIdx + 4 });
  // The FY header block sits a few rows above the first data line.
  const headerRowIdx = requireRowIndex(aRows, /^FY\s*\d{2}/i, { labelCol: 4, to: fdiRowIdx }) ;
  const headerRow = aRows[headerRowIdx];
  const fdiRow = aRows[fdiRowIdx];     // Direct Investment (net)
  const inflowRow = aRows[inflowRowIdx];
  const outflowRow = aRows[outflowRowIdx];
  const subHeaderRow = aRows[headerRowIdx + 1] || [];
  console.log(`  Summary rows: header@${headerRowIdx}, net@${fdiRowIdx}, inflow@${inflowRowIdx}, outflow@${outflowRowIdx}`);

  const annual = [];
  let fytdComparison = null;
  let monthlyComparison = null;

  // Find the latest cumulative FYTD column (for example "Jul-Apr").
  // SBP places current FYTD first, with the prior-year comparison in the next column.
  let fytdCurrentCol = -1;
  let fytdPriorCol = -1;
  let fytdCurrentFy = null;
  let fytdPriorFy = null;
  let fytdPeriod = '';
  const toFullFy = parseFullFy;

  for (let col = 0; col < headerRow.length; col++) {
    const hdr = (headerRow[col] || '').toString().trim();

    // Full fiscal year columns
    const m = hdr.match(/^FY(\d{2})/);
    if (m) {
      const fy = parseInt(m[1]) + (parseInt(m[1]) >= 90 ? 1900 : 2000);
      if (fy < 2017) continue;
      const val = fdiRow[col];
      if (typeof val !== 'number') continue;
      const status = /\(R\)/i.test(hdr) ? 'revised' : /\(P\)/i.test(hdr) ? 'provisional' : null;
      const entry = { year: `FY${fy}`, net_fdi: Math.round(val) };
      if (typeof inflowRow?.[col] === 'number') entry.inflow = Math.round(inflowRow[col]);
      if (typeof outflowRow?.[col] === 'number') entry.outflow = Math.round(outflowRow[col]);
      if (status) entry.status = status;
      annual.push(entry);
    }

    if (
      fytdCurrentCol === -1 &&
      /^jul[-\s]/i.test(hdr) &&
      typeof fdiRow[col] === 'number' &&
      typeof fdiRow[col + 1] === 'number'
    ) {
      const firstMatch = (subHeaderRow[col] || '').toString().trim().match(/^FY(\d{2,4})/i);
      const secondMatch = (subHeaderRow[col + 1] || '').toString().trim().match(/^FY(\d{2,4})/i);

      if (firstMatch && secondMatch) {
        const firstFy = toFullFy(firstMatch[1]);
        const secondFy = toFullFy(secondMatch[1]);
        const currentIsFirst = firstFy > secondFy;
        fytdCurrentCol = currentIsFirst ? col : col + 1;
        fytdPriorCol = currentIsFirst ? col + 1 : col;
        fytdCurrentFy = Math.max(firstFy, secondFy);
        fytdPriorFy = Math.min(firstFy, secondFy);
      } else {
        fytdCurrentCol = col;
        fytdPriorCol = col + 1;
      }
      fytdPeriod = normaliseFytdPeriod(hdr.replace(/\s*\([RP]\)\s*/i, '').trim());
    }

    if (!monthlyComparison && /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(hdr)) {
      const priorHdr = (subHeaderRow[col] || '').toString().trim();
      const currentHdr = (subHeaderRow[col + 1] || '').toString().trim();
      const priorMatch = priorHdr.match(/^FY(\d{2,4})/i);
      const currentMatch = currentHdr.match(/^FY(\d{2,4})/i);

      if (
        priorMatch &&
        currentMatch &&
        typeof fdiRow[col] === 'number' &&
        typeof fdiRow[col + 1] === 'number'
      ) {
        const priorFy = toFullFy(priorMatch[1]);
        const currentFy = toFullFy(currentMatch[1]);

        monthlyComparison = {
          month: hdr,
          current: {
            label: `FY${currentFy}`,
            net_fdi: round2(fdiRow[col + 1]),
            inflow: typeof inflowRow?.[col + 1] === 'number' ? round2(inflowRow[col + 1]) : null,
            outflow: typeof outflowRow?.[col + 1] === 'number' ? round2(outflowRow[col + 1]) : null,
            status: /\(P\)/i.test(currentHdr) ? 'provisional' : /\(R\)/i.test(currentHdr) ? 'revised' : null,
          },
          prior: {
            label: `FY${priorFy}`,
            net_fdi: round2(fdiRow[col]),
            inflow: typeof inflowRow?.[col] === 'number' ? round2(inflowRow[col]) : null,
            outflow: typeof outflowRow?.[col] === 'number' ? round2(outflowRow[col]) : null,
            status: /\(P\)/i.test(priorHdr) ? 'provisional' : /\(R\)/i.test(priorHdr) ? 'revised' : null,
          },
        };
      }
    }
  }

  // Extract FYTD comparison (e.g. Jul-Apr FY26 vs Jul-Apr FY25)
  if (fytdCurrentCol >= 0 && typeof fdiRow[fytdCurrentCol] === 'number') {
    const currentFytd = fdiRow[fytdCurrentCol];
    const priorFytd = fytdPriorCol >= 0 && typeof fdiRow[fytdPriorCol] === 'number'
      ? fdiRow[fytdPriorCol] : null;

    const lastFy = annual[annual.length - 1];
    const lastFyNum = parseInt(lastFy?.year?.replace('FY', '') || '2025');
    const currentFyLabel = `FY${fytdCurrentFy || lastFyNum + 1}`;
    const priorFyLabel = `FY${fytdPriorFy || lastFyNum}`;
    const currentSubHeader = (subHeaderRow[fytdCurrentCol] || '').toString();

    fytdComparison = {
      period: fytdPeriod,
      current: {
        label: currentFyLabel,
        net_fdi: round2(currentFytd),
        inflow: typeof inflowRow?.[fytdCurrentCol] === 'number' ? round2(inflowRow[fytdCurrentCol]) : null,
        outflow: typeof outflowRow?.[fytdCurrentCol] === 'number' ? round2(outflowRow[fytdCurrentCol]) : null,
        status: /\(P\)/i.test(currentSubHeader) ? 'provisional' : /\(R\)/i.test(currentSubHeader) ? 'revised' : null,
      },
      prior: priorFytd != null ? {
        label: priorFyLabel,
        net_fdi: round2(priorFytd),
        inflow: typeof inflowRow?.[fytdPriorCol] === 'number' ? round2(inflowRow[fytdPriorCol]) : null,
        outflow: typeof outflowRow?.[fytdPriorCol] === 'number' ? round2(outflowRow[fytdPriorCol]) : null,
      } : null,
      sourceFile: 'NetinflowSummary.xls',
      sourceSheet: 'Summary',
      sourceLocation: '"Direct Investment" row, current fiscal-year-to-date column',
    };
  }

  // SBP publishes the same fiscal-year-to-date net FDI figure in two workbooks
  // on different schedules. Whichever covers the later month is the current
  // official figure, so the headline follows the period, never a fixed file.
  if (countryFytd) {
    const summaryEnd = fiscalPeriodEndIndex(fytdComparison?.period);
    const countryEnd = fiscalPeriodEndIndex(countryFytd.period);
    const fyNum = (label) => {
      const match = String(label || '').match(/(\d{4}|\d{2})$/);
      if (!match) return null;
      const n = parseInt(match[1], 10);
      return n < 100 ? 2000 + n : n;
    };
    const summaryFy = fyNum(fytdComparison?.current?.label);
    const countryFy = fyNum(countryFytd.current.label);
    const laterFy = countryFy != null && (summaryFy == null || countryFy > summaryFy);
    const sameFy = fytdComparison?.current?.label === countryFytd.current.label;
    if (
      !fytdComparison ||
      laterFy ||
      (sameFy && countryEnd != null && (summaryEnd == null || countryEnd > summaryEnd))
    ) {
      if (fytdComparison) {
        console.log(
          `  ↪ Headline FDI switched to ${countryFytd.sourceFile} (${countryFytd.period}) — ` +
          `${fytdComparison.sourceFile} still publishes ${fytdComparison.period}`,
        );
      }
      fytdComparison = countryFytd;
    }
  }

  // Once the fiscal year has closed, its Jul–Jun cumulative *is* the annual
  // figure. Publish it as soon as an official file carries the complete year
  // rather than waiting for the annual summary column to appear.
  if (fytdComparison && fiscalPeriodEndIndex(fytdComparison.period) === 11) {
    const year = fytdComparison.current.label;
    const entry = {
      year,
      net_fdi: Math.round(fytdComparison.current.net_fdi),
      status: fytdComparison.current.status || 'provisional',
    };
    if (fytdComparison.current.inflow != null) entry.inflow = Math.round(fytdComparison.current.inflow);
    if (fytdComparison.current.outflow != null) entry.outflow = Math.round(fytdComparison.current.outflow);
    const existingIdx = annual.findIndex((a) => a.year === year);
    if (existingIdx >= 0) annual[existingIdx] = { ...annual[existingIdx], ...entry };
    else annual.push(entry);
    annual.sort((a, b) => parseInt(a.year.replace('FY', '')) - parseInt(b.year.replace('FY', '')));
    console.log(`  📊 Completed fiscal year ${year} published as annual: $${entry.net_fdi}M (${entry.status})`);
  }

  const existing = await readJson('fdi.json').catch(() => ({}));
  // NetinflowSummary lags the July FY rollover; keep completed years already
  // published from a closed Jul-Jun Netinflow.xls so they do not disappear.
  for (const entry of existing.annual || []) {
    if (!entry?.year || annual.some((a) => a.year === entry.year)) continue;
    annual.push(entry);
  }
  annual.sort((a, b) => parseInt(a.year.replace('FY', '')) - parseInt(b.year.replace('FY', '')));
  const existingFytd = existing.fytdComparison;
  if (
    fytdComparison &&
    existingFytd?.current?.label === fytdComparison.current.label
  ) {
    const existingEnd = fiscalPeriodEndIndex(existingFytd.period);
    const incomingEnd = fiscalPeriodEndIndex(fytdComparison.period);
    if (existingEnd != null && incomingEnd != null && incomingEnd < existingEnd) {
      throw new Error(
        `Refusing FDI period regression from ${existingFytd.period} to ${fytdComparison.period} for ${fytdComparison.current.label}`,
      );
    }
  }

  const result = {
    ...existing,
    by_sector: topSectors,
    by_country: topCountries,
    annual,
    sectorPeriod: formatFyPeriodLabel(sCurrentPeriod),
    sectorPriorPeriod: formatFyPeriodLabel(sPriorPeriod),
    countryPeriod: formatFyPeriodLabel(cCurrentPeriod),
    countryPriorPeriod: formatFyPeriodLabel(cPriorPeriod),
    source: 'State Bank of Pakistan',
    dataSource: 'SBP',
    lastUpdated: new Date().toISOString().split('T')[0],
  };
  if (fytdComparison) result.fytdComparison = fytdComparison;
  if (monthlyComparison) result.monthlyComparison = monthlyComparison;

  const coverageParts = [
    existing.monthly?.at(-1)?.date ? `monthly through ${existing.monthly.at(-1).date}` : null,
    `sector ${formatFyPeriodLabel(sCurrentPeriod)}`,
    `country ${formatFyPeriodLabel(cCurrentPeriod)}`,
    fytdComparison
      ? `headline ${fytdComparison.current.label} ${fytdComparison.period} (${fytdComparison.sourceFile})`
      : `annual ${annual[0]?.year} – ${annual.at(-1)?.year}`,
  ].filter(Boolean);
  result.dataCoverage = coverageParts.join('; ');

  await writeJson('fdi.json', result);

  console.log(`  📊 ${topSectors.length} sectors, ${topCountries.length} countries, ${annual.length} fiscal years`);
  if (fytdComparison) console.log(`  📊 FYTD: ${fytdComparison.current.label} ${fytdComparison.period}: $${fytdComparison.current.net_fdi}M vs ${fytdComparison.prior?.label}: $${fytdComparison.prior?.net_fdi}M`);
  if (monthlyComparison) console.log(`  📊 Monthly: ${monthlyComparison.month} ${monthlyComparison.current.label}: $${monthlyComparison.current.net_fdi}M vs ${monthlyComparison.prior.label}: $${monthlyComparison.prior.net_fdi}M`);
  return { sectors: topSectors.length, countries: topCountries.length, years: annual.length };
}

// ═══════════════════════════════════════════════════
// 3. GDP / FISCAL (GDP_table.xlsx)
// ═══════════════════════════════════════════════════

async function updateGdpFiscal() {
  console.log('\n📈 Parsing GDP Data (GDP_table.xlsx)...');

  const wb = readExcel('GDP_table.xlsx');
  const rows = getSheet(wb, 'Annual');

  // The year header row and the growth row are located by label so an inserted
  // row or column upstream cannot silently shift which series we publish.
  const growthRowIdx = requireRowIndex(rows, /GDP\s+Growth\s+Rate/i, {
    labelCol: 2,
    to: 40,
    file: 'GDP_table.xlsx',
    sheet: 'Annual',
  });
  const headerRowIdx = requireRowIndex(rows, /^\d{4}-\d{2,4}$/, {
    labelCol: 3,
    to: growthRowIdx + 1,
    file: 'GDP_table.xlsx',
    sheet: 'Annual',
  });
  const headerRow = rows[headerRowIdx];
  const growthRow = rows[growthRowIdx];
  console.log(`  GDP rows: header@${headerRowIdx}, growth@${growthRowIdx}`);

  const existing = await readJson('fiscal.json').catch(() => ({}));
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

  // Spread existing keys (e.g. publicFinance from API updates) to preserve them.
  // `dataSource` is deliberately preserved when already set — it usually names
  // the exact SBP EasyData series, which is more traceable than a generic label.
  await writeJson('fiscal.json', {
    ...existing,
    annual,
    dataSource: existing.dataSource || 'SBP / PBS',
    lastUpdated: new Date().toISOString().split('T')[0],
    dataCoverage: `${annual[0]?.year} – ${annual.at(-1)?.year}`,
  });
  console.log(`  📊 ${annual.length} fiscal years with GDP growth data`);
  return annual.length;
}

// ═══════════════════════════════════════════════════
// 4. BALANCE OF PAYMENTS (Balancepayment_BPM6.xls)
//
// A previous implementation read fixed cells (row 24, row 38, row 79 …) from
// BPM6_Summary and printed them as if they were authoritative, but it never
// wrote a JSON file and its labels were stale. It was removed.
//
// This replacement exists for one reason: SBP refreshes the BOP summary a
// month ahead of the detailed EBOPS services table, so the headline services
// aggregate for the newest month is published here first. Every row and
// column below is resolved by its printed label.
// ═══════════════════════════════════════════════════

async function updateBopServices() {
  console.log('\n🧾 Parsing BOP services aggregate (Balancepayment_BPM6.xls)...');

  const wb = readExcel('Balancepayment_BPM6.xls');
  const rows = getSheet(wb, 'BPM6_Summary');
  const ctx = { file: 'Balancepayment_BPM6.xls', sheet: 'BPM6_Summary' };

  const headerIdx = requireRowIndex(rows, /^items$/i, { labelCol: 0, to: 20, ...ctx });
  const width = Math.max(rows[headerIdx]?.length || 0, rows[headerIdx + 1]?.length || 0);
  // "Jul-Jun" is a merged cell spanning the prior and current fiscal year.
  const periodRow = forwardFill(rows[headerIdx], width);
  const fyRow = rows[headerIdx + 1] || [];

  const maxFy = latestFiscalYear(fyRow);
  if (maxFy === null) {
    throw new Error('No fiscal year found in the BPM6_Summary header row');
  }

  const creditIdx = requireRowIndex(rows, /^exports of services$/i, { labelCol: 0, ...ctx });
  const debitIdx = requireRowIndex(rows, /^imports of services$/i, { labelCol: 0, ...ctx });
  const netIdx = requireRowIndex(rows, /^balance on trade in services$/i, { labelCol: 0, ...ctx });

  let cumulative = null;
  let latestMonth = null;
  for (let col = 1; col < width; col++) {
    if (parseFullFy(fyRow[col]) !== maxFy) continue;
    const period = (periodRow[col] || '').trim();
    if (!period) continue;
    const status = /R\s*$/i.test(String(fyRow[col])) ? 'revised'
      : /P\s*$/i.test(String(fyRow[col])) ? 'provisional' : null;

    const cumulativeEnd = fiscalPeriodEndIndex(period);
    if (cumulativeEnd != null) {
      if (!cumulative || cumulativeEnd > cumulative.endIndex) {
        cumulative = { col, period, status, endIndex: cumulativeEnd };
      }
      continue;
    }

    const monthIndex = FISCAL_MONTH_ORDER.indexOf(period.slice(0, 3).toLowerCase());
    if (monthIndex >= 0 && period.length <= 9 && !period.includes('-')) {
      if (!latestMonth || monthIndex > latestMonth.endIndex) {
        latestMonth = { col, period, status, endIndex: monthIndex };
      }
    }
  }

  const readBlock = (entry) => {
    if (!entry) return null;
    const num = (rowIdx) => (typeof rows[rowIdx]?.[entry.col] === 'number' ? round2(rows[rowIdx][entry.col]) : null);
    const credit = num(creditIdx);
    if (credit === null) return null;
    return {
      period: entry.period,
      fiscalYear: `FY${maxFy}`,
      status: entry.status,
      credit,
      debit: num(debitIdx),
      net: num(netIdx),
    };
  };

  const cumulativeBlock = readBlock(cumulative);
  const monthBlock = readBlock(latestMonth);
  if (!cumulativeBlock && !monthBlock) {
    throw new Error(`No FY${maxFy} services columns resolved in BPM6_Summary`);
  }

  const existing = await readJson('services.json').catch(() => ({}));
  const bopSummary = {
    source: 'SBP Balance of Payments (BPM6) summary',
    sourceFile: 'Balancepayment_BPM6.xls',
    sourceSheet: 'BPM6_Summary',
    fiscalYear: `FY${maxFy}`,
    unit: 'US$ million',
    cumulative: cumulativeBlock,
    latestMonth: monthBlock,
    note: 'SBP publishes this aggregate before the detailed EBOPS table, so it can cover a later month than the category and IT breakdowns in this section.',
  };

  await writeJson('services.json', { ...existing, bopSummary });

  if (cumulativeBlock) {
    await recordProvenance('services.bop.cumulative', {
      label: 'Balance on trade in services, fiscal year to date',
      sourceKey: 'Balancepayment_BPM6.xls',
      sheet: 'BPM6_Summary',
      location: `"Balance on Trade in Services" row, "${cumulativeBlock.period} ${cumulativeBlock.fiscalYear}" column`,
      period: `${cumulativeBlock.period} ${cumulativeBlock.fiscalYear}`,
      status: cumulativeBlock.status || 'final',
      unit: 'US$ million',
      value: cumulativeBlock.net,
    });
    console.log(`  📊 Services ${cumulativeBlock.period} FY${maxFy}: credit $${cumulativeBlock.credit}M, debit $${cumulativeBlock.debit}M, net $${cumulativeBlock.net}M`);
  }
  if (monthBlock) {
    await recordProvenance('services.bop.latestMonth', {
      label: 'Exports of services, latest published month',
      sourceKey: 'Balancepayment_BPM6.xls',
      sheet: 'BPM6_Summary',
      location: `"Exports of Services" row, "${monthBlock.period} ${monthBlock.fiscalYear}" column`,
      period: `${monthBlock.period} ${monthBlock.fiscalYear}`,
      status: monthBlock.status || 'final',
      unit: 'US$ million',
      value: monthBlock.credit,
    });
    console.log(`  📊 Latest month ${monthBlock.period} FY${maxFy}: credit $${monthBlock.credit}M, net $${monthBlock.net}M`);
  }
  return bopSummary;
}

// ═══════════════════════════════════════════════════
// 5. EXCHANGE RATES — attempt archive download
// ═══════════════════════════════════════════════════

async function downloadExchangeRateArchive() {
  console.log('\n💱 Attempting to download exchange rate archive...');
  const urls = [
    'https://www.sbp.org.pk/assets/document/IBF_Arch.xls',
    'https://archive.sbp.org.pk/ecodata/IBF_Arch.xls',
  ];
  const filepath = resolve(RAW_DIR, 'IBF_Arch.xls');

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });

      if (!res.ok) {
        console.log(`  ⚠️  HTTP ${res.status} from ${url}`);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 5000) {
        console.log(`  ⚠️  Response too small (${buffer.length} bytes) from ${url}`);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      const header = buffer.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
      if (contentType.toLowerCase().includes('text/html') || header.startsWith('<!doctype html') || !isLegacyExcel(buffer)) {
        console.log(`  ⚠️  Invalid XLS response from ${url}`);
        continue;
      }

      await writeFile(filepath, buffer);
      console.log(`  ✅ Downloaded IBF_Arch.xls (${(buffer.length / 1024).toFixed(0)} KB)`);
      return true;
    } catch (err) {
      console.log(`  ⚠️  Download failed from ${url}: ${err.message}`);
    }
  }

  console.log('  ⚠️  No verified official exchange-rate source succeeded; existing archive preserved');
  return false;
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
    await writeJson('exchange-rates.json', {
      monthly,
      dataSource: 'SBP',
      lastUpdated: new Date().toISOString().split('T')[0],
      dataCoverage: `${monthly[0]?.date} – ${monthly.at(-1)?.date}`,
    });
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
  return parsePdfTextItems(resolve(RAW_DIR, 'forex.pdf'));
}

async function updateReserves() {
  console.log('\n🏦 Parsing Reserves Data (forex.pdf)...');

  const pdfItems = await parseForexPdf();
  console.log(`  📋 Extracted ${pdfItems.length} text items from PDF`);

  const weekly = parseReserveObservations(pdfItems);

  await writeJson('reserves.json', {
    weekly,
    dataSource: 'SBP',
    lastUpdated: new Date().toISOString().split('T')[0],
    dataCoverage: `${weekly[0]?.date} – ${weekly.at(-1)?.date}`,
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

  // Resolve columns from header row (row 6). Each period group is
  // [Credit, Debit, Net]. No positional fallbacks — see note above.
  const hdr6 = rows[6] || [];
  const svcCols = resolveServicesColumns(hdr6, { file: 'dt.xls', sheet: sheetName });
  const currentPeriodCols = { credit: svcCols.current.credit, debit: svcCols.current.debit, net: svcCols.current.net };
  const priorPeriodCols = { credit: svcCols.prior.credit, debit: svcCols.prior.debit, net: svcCols.prior.net };
  const month1Cols = svcCols.month1 ? { credit: svcCols.month1.credit, debit: svcCols.month1.debit, net: svcCols.month1.net } : null;
  const month2Cols = svcCols.month2 ? { credit: svcCols.month2.credit, debit: svcCols.month2.debit, net: svcCols.month2.net } : null;
  const month1Label = svcCols.month1?.label || '';
  const month2Label = svcCols.month2?.label || '';
  const currentPeriodLabel = svcCols.current.label;
  const priorPeriodLabel = svcCols.prior.label;
  const currentCum = svcCols.current;
  const priorCum = svcCols.prior;
  console.log(`  Services columns: current ${currentPeriodLabel} @${currentCum.credit}, prior ${priorPeriodLabel} @${priorCum.credit}`);


  const toM = (v) => (typeof v === 'number' ? round2(v / 1000) : 0);

  // Every row below is located by its published label rather than by a fixed
  // index. SBP inserts and removes EBOPS lines between releases; a positional
  // read would silently attribute one service's numbers to another.
  const ebopsCtx = { file: 'dt.xls', sheet: sheetName };
  const rowByLabel = (pattern, opts = {}) => requireRowIndex(rows, pattern, { labelCol: 0, ...ebopsCtx, ...opts });

  const ROW = Object.fromEntries(
    Object.entries(EBOPS_ROW_PATTERNS).map(([key, pattern]) => [key, rowByLabel(pattern)]),
  );

  const categoryRows = [
    { row: ROW.transport, name: 'Transport' },
    { row: ROW.travel, name: 'Travel' },
    { row: ROW.insurance, name: 'Insurance & Pension' },
    { row: ROW.financial, name: 'Financial Services' },
    { row: ROW.ipCharges, name: 'IP Charges' },
    { row: ROW.itTelecom, name: 'IT & Telecom' },
    { row: ROW.otherBusiness, name: 'Other Business' },
    { row: ROW.personalCultural, name: 'Personal/Cultural' },
  ];

  const categories = [];
  for (const { row, name } of categoryRows) {
    const r = rows[row];
    if (!r) continue;
    categories.push({
      name,
      credit: toM(r[currentPeriodCols.credit]),
      debit: toM(r[currentPeriodCols.debit]),
      net: toM(r[currentPeriodCols.net]),
      priorCredit: toM(r[priorPeriodCols.credit]),
      priorDebit: toM(r[priorPeriodCols.debit]),
      priorNet: toM(r[priorPeriodCols.net]),
      period: currentPeriodLabel,
    });
  }

  // IT sub-category breakdown
  const itBreakdown = [
    { row: ROW.telecom, name: 'Telecom' },
    { row: ROW.softwareConsultancy, name: 'Software Consultancy' },
    { row: ROW.softwareExportImport, name: 'Computer Software Export/Import' },
    { row: ROW.freelance, name: 'Freelance IT' },
    { row: ROW.informationServices, name: 'Information Services' },
  ];

  const itItems = [];
  for (const { row, name } of itBreakdown) {
    const r = rows[row];
    if (!r) continue;
    itItems.push({
      name,
      credit: toM(r[currentPeriodCols.credit]),
      priorCredit: toM(r[priorPeriodCols.credit]),
    });
  }

  // "Other Computer Services" = Computer services minus named subcategories
  const computerServicesRow = rows[ROW.computerServices];
  if (computerServicesRow) {
    const computerTotal = toM(computerServicesRow[currentPeriodCols.credit]);
    const namedSum = itItems.filter(i => ['Software Consultancy', 'Computer Software Export/Import', 'Freelance IT'].includes(i.name))
      .reduce((s, x) => s + x.credit, 0);
    const other = round2(computerTotal - namedSum);
    if (other > 0) {
      const priorComputerTotal = toM(computerServicesRow[priorPeriodCols.credit]);
      const priorNamedSum = itItems.filter(i => ['Software Consultancy', 'Computer Software Export/Import', 'Freelance IT'].includes(i.name))
        .reduce((s, x) => s + (x.priorCredit || 0), 0);
      itItems.push({ name: 'Other Computer Services', credit: other, priorCredit: round2(priorComputerTotal - priorNamedSum) });
    }
  }

  // Total services row
  const totalRow = rows[ROW.totalServices];
  const totalCredit = toM(totalRow?.[currentPeriodCols.credit]);
  const totalDebit = toM(totalRow?.[currentPeriodCols.debit]);
  const totalNet = toM(totalRow?.[currentPeriodCols.net]);
  const totalCreditPrior = toM(totalRow?.[priorPeriodCols.credit]);

  // IT & Telecom aggregate
  const itRow = rows[ROW.itTelecom];
  const itCredit = toM(itRow?.[currentPeriodCols.credit]);
  const itNet = toM(itRow?.[currentPeriodCols.net]);
  const itCreditPrior = toM(itRow?.[priorPeriodCols.credit]);

  // Computer services
  const csCredit = toM(computerServicesRow?.[currentPeriodCols.credit]);

  // Monthly data for recent months (if available)
  const recentMonths = [];
  for (const [cols, label] of [[month1Cols, month1Label], [month2Cols, month2Label]]) {
    if (!cols) continue;
    const totalMo = toM(totalRow?.[cols.credit]);
    const itMo = toM(itRow?.[cols.credit]);
    if (totalMo > 0) {
      recentMonths.push({ month: label, totalCredit: totalMo, itCredit: itMo });
    }
  }

  // ── IT & Freelance monthly snapshot (latest month, prior month, year-ago month,
  // plus FYTD current vs prior) per IT sub-component. The SBP EBOPS file publishes
  // only the latest two months + same-month-last-year + FYTD — every figure authentic.
  const shortMonthToNum = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const labelToYearMonth = (label) => {
    const m = (label || '').match(/^(\w{3})-(\d{2})/);
    if (!m) return null;
    const mm = shortMonthToNum[m[1].toLowerCase()];
    return mm ? `20${m[2]}-${mm}` : null;
  };
  // The year-ago comparison month is stored as an Excel date serial in row 6.
  let yearAgoCol = null;
  let yearAgoMonth = null;
  for (let c = 0; c < hdr6.length; c++) {
    if (typeof hdr6[c] === 'number' && hdr6[c] > 40000 && hdr6[c] < 50000) {
      yearAgoCol = c;
      yearAgoMonth = excelDateToYYYYMM(hdr6[c]);
      break;
    }
  }

  const IT_COMPONENT_ROWS = [
    { row: ROW.itTelecom, name: 'IT & Telecom (total)', key: 'itTotal' },
    { row: ROW.telecom, name: 'Telecommunications', key: 'telecom' },
    { row: ROW.softwareConsultancy, name: 'Software Consultancy', key: 'softwareConsultancy' },
    { row: ROW.softwareExportImport, name: 'Computer Software Exports', key: 'softwareExports' },
    { row: ROW.freelance, name: 'Freelance IT', key: 'freelance' },
    { row: ROW.informationServices, name: 'Information Services', key: 'informationServices' },
  ];
  const components = IT_COMPONENT_ROWS.map(({ row, name, key }) => {
    const r = rows[row] || [];
    return {
      key,
      name,
      latest: month2Cols ? toM(r[month2Cols.credit]) : null,
      prev: month1Cols ? toM(r[month1Cols.credit]) : null,
      yearAgo: yearAgoCol != null ? toM(r[yearAgoCol]) : null,
      fytd: toM(r[currentPeriodCols.credit]),
      fytdPrior: toM(r[priorPeriodCols.credit]),
    };
  });
  const fytdStem = (currentPeriodLabel.match(/Jul-\w+/) || ['Jul–latest'])[0].replace('-', '–');
  const itMonthly = {
    latestMonth: labelToYearMonth(month2Label),
    prevMonth: labelToYearMonth(month1Label),
    yearAgoMonth,
    fytdLabel: currentPeriodLabel,
    fytdPriorLabel: priorPeriodLabel,
    note: `SBP's EBOPS services file publishes the latest month, prior month, the same month a year earlier, and fiscal-year-to-date totals. Values are exports (credit) in US$ million. "Freelance IT" is SBP's own line for individual freelancer earnings; total IT & freelancing exports are captured within IT & Telecom (${fytdStem}).`,
    components,
  };

  // ── Accumulating monthly IT/freelance export series. SBP only exposes two months
  // at a time, so we persist them into a growing contiguous series across updates.
  const existingSvc = await readJson('services.json').catch(() => ({}));
  const seriesMap = new Map((existingSvc.monthlySeries || []).map((m) => [m.month, m]));
  const freelanceRow = rows[ROW.freelance] || [];
  for (const cols of [month1Cols, month2Cols]) {
    if (!cols) continue;
    const ym = labelToYearMonth(cols === month1Cols ? month1Label : month2Label);
    if (!ym) continue;
    const totalMo = toM(totalRow?.[cols.credit]);
    const itMo = toM(itRow?.[cols.credit]);
    const freelanceMo = toM(freelanceRow[cols.credit]);
    if (itMo > 0 || totalMo > 0) {
      seriesMap.set(ym, { month: ym, totalCredit: totalMo, itCredit: itMo, freelanceCredit: freelanceMo });
    }
  }
  const monthlySeries = [...seriesMap.values()].sort((a, b) => a.month.localeCompare(b.month));

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
      period: currentPeriodLabel,
    },
    comparison: {
      // `current`/`prior` are the stable keys. The FY-named aliases are kept for
      // backwards compatibility but must never be relied on — they were a latent
      // bug waiting for the next fiscal year to roll over.
      current: { totalCredit: totalCredit, itCredit: itCredit, fy: currentCum.fy },
      prior: { totalCredit: totalCreditPrior, itCredit: itCreditPrior, fy: priorCum.fy },
      fy25: { totalCredit: totalCreditPrior, itCredit: itCreditPrior },
      fy26: { totalCredit: totalCredit, itCredit: itCredit },
      period: currentPeriodLabel.replace(/FY\d{2}/, '').trim().replace(/,$/, ''),
      currentLabel: `FY${String(currentCum.fy).slice(-2)}`,
      priorLabel: `FY${String(priorCum.fy).slice(-2)}`,
    },
    recentMonths,
    itMonthly,
    monthlySeries,
    dataSource: 'SBP',
    lastUpdated: new Date().toISOString().slice(0, 10),
    dataCoverage: currentPeriodLabel,
  };

  await writeJson('services.json', servicesData);

  console.log(`  📊 ${categories.length} service categories, ${itItems.length} IT sub-categories`);
  console.log(`     Total Services Credit: $${totalCredit}M, IT&Telecom: $${itCredit}M`);
  if (recentMonths.length > 0) console.log(`     Recent months: ${recentMonths.map(m => `${m.month}: $${m.totalCredit}M`).join(', ')}`);
  console.log(`     IT monthly snapshot: latest ${itMonthly.latestMonth || '?'}, ${components.length} components; accumulating series ${monthlySeries.length} month(s)`);
  return servicesData;
}

async function updateServicesHeadline() {
  console.log('\n💻 Parsing Services Headline (ExportsImports-Goods.pdf)...');

  const pdfItems = await parsePdfTextItems(resolve(RAW_DIR, 'ExportsImports-Goods.pdf'));
  const headline = parseServicesHeadline(pdfItems);
  const existing = await readJson('services.json');
  const detail = existing.itMonthly || {};
  const detailLatestMonth = detail.detailLatestMonth || detail.latestMonth || null;
  const detailYearAgoMonth = detail.detailYearAgoMonth || detail.yearAgoMonth || null;
  const detailFytdLabel = detail.detailFytdLabel || detail.fytdLabel || null;
  const detailFytdPriorLabel = detail.detailFytdPriorLabel || detail.fytdPriorLabel || null;
  const components = (detail.components || []).map((component) => ({
    ...component,
    latestMonth: component.latestMonth || detailLatestMonth,
    yearAgoMonth: component.yearAgoMonth || detailYearAgoMonth,
    fytdLabel: component.fytdLabel || detailFytdLabel,
    fytdPriorLabel: component.fytdPriorLabel || detailFytdPriorLabel,
  }));
  if (!components.some((component) => component.key === 'itTotal')) {
    throw new Error('Services detail is missing the IT total component');
  }

  const seriesMap = new Map((existing.monthlySeries || []).map((row) => [row.month, row]));
  seriesMap.set(headline.latestMonth, {
    month: headline.latestMonth,
    totalCredit: headline.totalServicesLatest,
    itCredit: headline.latest,
    freelanceCredit: seriesMap.get(headline.latestMonth)?.freelanceCredit ?? null,
  });

  const recentMonths = [...seriesMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-4)
    .map((row) => {
      const [year, month] = String(row.month).split('-');
      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = month ? `${names[Number(month) - 1]}-${String(year).slice(-2)}` : row.month;
      return {
        month: label,
        totalCredit: row.totalCredit,
        itCredit: row.itCredit,
      };
    });

  const updated = {
    ...existing,
    recentMonths,
    itHeadline: {
      ...headline,
      source: 'State Bank of Pakistan',
      sourceFile: 'ExportsImports-Goods.pdf',
      sourceUrl: 'https://www.sbp.org.pk/assets/document/ExportsImports-Goods.pdf',
      status: 'provisional',
    },
    itMonthly: {
      ...detail,
      detailLatestMonth,
      detailYearAgoMonth,
      detailFytdLabel,
      detailFytdPriorLabel,
      note: `SBP's headline services table publishes total IT & Telecom through ${headline.latestMonth}, while the detailed EBOPS workbook currently publishes subcomponents through ${detailLatestMonth}. Values are exports (credit) in US$ million; component cards retain their own coverage dates.`,
      components,
    },
    monthlySeries: [...seriesMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    headlineCoverage: headline.latestMonth,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };

  await writeJson('services.json', updated);
  await recordProvenance('services.itTelecom.headline', {
    label: 'Telecommunications, computer and information services exports (credit), latest month',
    value: headline.latest,
    unit: 'US$ million',
    sourceKey: 'ExportsImports-Goods.pdf',
    location: `Row 9 "Telecommunications, Computer, and Information Services", ${headline.latestMonth} column`,
  });
  console.log(`  📊 IT & Telecom headline: $${headline.latest}M in ${headline.latestMonth}; detailed EBOPS through ${detailLatestMonth}`);
  return headline;
}

// ═══════════════════════════════════════════════════
// 8. TRADE BY COUNTRY (Export/Import by country files)
// ═══════════════════════════════════════════════════

// Column classification for the by-country workbooks now lives in
// scripts/lib/sbp-resolvers.mjs so it can be unit-tested against captured
// header fixtures, including synthetic future fiscal years.

// Read a by-country export/import workbook into a Map keyed by clean country
// name, capturing the snapshot columns (values converted thousand-USD → $M).
function parseCountryTradeFile(filename, sheetRegex) {
  const wb = readExcel(filename);
  const sheetName = wb.SheetNames.find((s) => sheetRegex.test(s)) || wb.SheetNames[0];
  const rows = getSheet(wb, sheetName);
  const cols = classifyCountryColumns(rows);

  const cell = (row, c) => {
    if (c === undefined) return null;
    const v = row[c];
    return typeof v === 'number' && isFinite(v) ? round2(v / 1000) : null;
  };

  // Fail loudly rather than silently reading whatever sits in a guessed column.
  requireColumn(cols.fytdCur, { file: filename, sheet: sheetName, want: `Jul-* FY${cols.curFY} fiscal-year-to-date column` });
  requireColumn(cols.fytdPrior, { file: filename, sheet: sheetName, want: `Jul-* FY${cols.priorFY} fiscal-year-to-date column` });
  requireColumn(cols.latest, { file: filename, sheet: sheetName, want: `latest provisional month column for FY${cols.curFY}` });

  const map = new Map();
  for (let i = 6; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    let country = (row[0] || '').toString().trim();
    if (!country || /^total|^grand|^sub|^all|^others?\s*$/i.test(country)) continue;
    if (/^\d+$/.test(country)) continue;
    if (/^[IVX]+\./i.test(country)) continue;
    if (/receipts|payments|through\s+banks|memo|of which/i.test(country)) continue;
    country = country.replace(/\s*\*+$/, '').trim();
    map.set(country, {
      latest: cell(row, cols.latest),
      prev: cell(row, cols.prev),
      yearAgo: cell(row, cols.yearAgo),
      fytd: cell(row, cols.fytdCur),
      fytdPrior: cell(row, cols.fytdPrior),
    });
  }
  return { sheetName, cols, map };
}

async function updateTradeCountries() {
  console.log('\n🌍 Parsing Trade by Country...');

  const countryPeriodLabel = (headerPeriods, headerYears, col) => {
    let period = (headerPeriods[col] || '').toString().trim();
    for (let c = col - 1; !period && c >= 0; c--) {
      period = (headerPeriods[c] || '').toString().trim();
    }
    const year = (headerYears[col] || '').toString().trim();
    return [period, year].filter(Boolean).join(' ');
  };

  // --- Exports by Country ---
  console.log('  📋 Export destinations (Export_Receipts_by_all_Countries.xls)...');
  const wbExp = readExcel('Export_Receipts_by_all_Countries.xls');
  const expSheetName = wbExp.SheetNames.find(s => /Exp.*Acount/i.test(s)) || wbExp.SheetNames[0];
  console.log(`  Using sheet: "${expSheetName}"`);
  const expRows = getSheet(wbExp, expSheetName);

  // The current fiscal-year-to-date column is resolved from the sheet's own
  // headers (row 4 = period, row 5 = fiscal year). Never hardcode a fiscal year
  // and never fall back to a fixed column index — when SBP shifts the layout we
  // must fail loudly rather than publish whatever happens to sit there.
  const expHeader4 = expRows[4] || [];
  const expHeader5 = expRows[5] || [];
  const expCols = classifyCountryColumns(expRows);
  const expCol = requireColumn(expCols.fytdCur, {
    file: 'Export_Receipts_by_all_Countries.xls',
    sheet: expSheetName,
    want: `Jul-* FY${expCols.curFY} fiscal-year-to-date export column`,
    headerPeriods: expHeader4.filter(Boolean).join(' | '),
    headerYears: expHeader5.filter(Boolean).join(' | '),
  });
  console.log(`  Export data column: ${expCol} (FY${expCols.curFY} ${expCols.fytdLabel || ''})`);
  const exportCountryPeriod = countryPeriodLabel(expHeader4, expHeader5, expCol);

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

  const impHeader4 = impRows[4] || [];
  const impHeader5 = impRows[5] || [];
  const impCols = classifyCountryColumns(impRows);
  const impCol = requireColumn(impCols.fytdCur, {
    file: 'Import-Payments-by-All-Countries.xlsx',
    sheet: impSheetName,
    want: `Jul-* FY${impCols.curFY} fiscal-year-to-date import column`,
    headerPeriods: impHeader4.filter(Boolean).join(' | '),
    headerYears: impHeader5.filter(Boolean).join(' | '),
  });
  console.log(`  Import data column: ${impCol} (FY${impCols.curFY} ${impCols.fytdLabel || ''})`);
  const importCountryPeriod = countryPeriodLabel(impHeader4, impHeader5, impCol);

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

  // --- Per-country monthly snapshot (latest month, prior month, year-ago month,
  // FYTD current & prior) for the most important trade partners. The SBP
  // by-country files only publish these few points per country (no long monthly
  // series), so this is a snapshot + YoY/MoM/FYTD view — every figure authentic.
  const expParsed = parseCountryTradeFile('Export_Receipts_by_all_Countries.xls', /Exp.*Acount/i);
  const impParsed = parseCountryTradeFile('Import-Payments-by-All-Countries.xlsx', /Import/i);

  // Normalise country names so export & import rows line up and split sub-rows
  // (e.g. UAE is listed as "Dubai" + "Abu Dhabi") collapse into one partner.
  const normName = (s) => s.toLowerCase().replace(/\.\s*/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const canonical = (raw) => {
    const n = normName(raw);
    if (/^u ?a ?e|^uae|abu ?dhabi|^dubai|sharjah/.test(n)) return { key: 'uae', display: 'U.A.E.' };
    if (/^u ?s ?a|united states|^usa/.test(n)) return { key: 'usa', display: 'United States' };
    if (/^u ?k|united kingdom/.test(n)) return { key: 'uk', display: 'United Kingdom' };
    if (/netherland|holland/.test(n)) return { key: 'netherlands', display: 'Netherlands' };
    if (/saudi/.test(n)) return { key: 'saudi arabia', display: 'Saudi Arabia' };
    if (/south korea|korea, rep|rep.*korea|^korea/.test(n) && !/north/.test(n)) return { key: 'south korea', display: 'South Korea' };
    // Default: strip parentheticals for display
    const display = raw.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    return { key: n, display };
  };
  const FIELDS = ['latest', 'prev', 'yearAgo', 'fytd', 'fytdPrior'];
  const blank = () => ({ latest: null, prev: null, yearAgo: null, fytd: null, fytdPrior: null });
  const addSnap = (target, snap) => {
    if (!snap) return;
    for (const f of FIELDS) {
      if (typeof snap[f] === 'number') target[f] = round2((target[f] || 0) + snap[f]);
    }
  };
  const merged = new Map();
  const collect = (map, kind) => {
    for (const [country, snap] of map) {
      const { key, display } = canonical(country);
      if (!key) continue;
      if (!merged.has(key)) merged.set(key, { name: display, exports: blank(), imports: blank() });
      addSnap(merged.get(key)[kind], snap);
    }
  };
  collect(expParsed.map, 'exports');
  collect(impParsed.map, 'imports');

  // Rank by total trade engagement (export FYTD + import FYTD), keep the leaders.
  const ranked = [...merged.values()]
    .map((e) => ({ ...e, totalTrade: (e.exports.fytd || 0) + (e.imports.fytd || 0) }))
    .filter((e) => e.totalTrade > 0)
    .sort((a, b) => b.totalTrade - a.totalTrade);

  // Always include key remittance/strategic partners even if outside the top trade list.
  const MUST_INCLUDE = ['saudi arabia', 'usa', 'uk', 'uae', 'china'];
  const importantKeys = new Set(ranked.slice(0, 18).map((e) => canonical(e.name).key));
  for (const k of MUST_INCLUDE) importantKeys.add(k);
  const countries = ranked
    .filter((e) => importantKeys.has(canonical(e.name).key))
    .map((e) => ({
      country: e.name,
      flag: getFlag(e.name),
      exports: e.exports,
      imports: e.imports,
    }));

  const c = expParsed.cols;
  const fytdStem = (c.fytdLabel || 'Jul–latest').replace(/-/g, '–');
  const fytdLabel = `${fytdStem} FY${c.curFY}`;
  const fytdPriorLabel = `${fytdStem} FY${c.priorFY}`;
  const countryMonthly = {
    latestMonth: c.latestMonth || null,
    prevMonth: c.prevMonth || null,
    yearAgoMonth: c.yearAgoMonth || null,
    fytdLabel,
    fytdPriorLabel,
    note: 'SBP by-country files publish the latest month, prior month, same month a year earlier, and fiscal-year-to-date totals per country. Values in US$ million.',
    countries,
  };

  // Update trade.json — merge with existing data
  const existing = await readJson('trade.json');
  existing.topExportCountries = topExportCountries;
  existing.topImportCountries = topImportCountries;
  existing.exportCountryPeriod = exportCountryPeriod || null;
  existing.importCountryPeriod = importCountryPeriod || null;
  existing.countryMonthly = countryMonthly;
  await writeJson('trade.json', existing);

  console.log(`  📊 Top ${topExportCountries.length} export destinations (${exportCountryPeriod || 'period unknown'}), Top ${topImportCountries.length} import sources (${importCountryPeriod || 'period unknown'})`);
  console.log(`  🌍 Country monthly snapshot: ${countries.length} partners (latest ${countryMonthly.latestMonth || '?'}, ${fytdLabel})`);
  return { exports: topExportCountries.length, imports: topImportCountries.length };
}

// ═══════════════════════════════════════════════════
// DERIVED RESERVES ADEQUACY — official reserves / goods imports
// ═══════════════════════════════════════════════════

async function updateReservesAdequacyFromData() {
  console.log('\n🏦 Updating reserves adequacy from canonical official data...');

  const reserves = await readJson('reserves.json');
  const trade = await readJson('trade.json');
  const existing = await readJson('reserves-adequacy.json');
  const latest = reserves.weekly?.at(-1);
  const imports = (trade.monthly || [])
    .filter(row => typeof row.imports === 'number')
    .slice(-12);

  if (!latest || imports.length !== 12) {
    throw new Error('Reserves adequacy requires the latest reserves point and 12 months of goods imports');
  }

  const averageMonthlyImports = imports.reduce((sum, row) => sum + row.imports, 0) / imports.length;
  const importCoverMonths = Math.round((latest.sbp / averageMonthlyImports) * 10) / 10;
  const date = latest.date;
  const monthKey = date.slice(0, 7);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const trajectory = (existing.trajectory || [])
    .filter(point => point.date !== monthKey)
    .concat({
      date: monthKey,
      sbpReserves: round2(latest.sbp / 1000),
      importCoverMonths,
      label,
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const sbpReserves = round2(latest.sbp / 1000);
  const totalReserves = round2(latest.total / 1000);
  const bankReserves = round2(latest.banks / 1000);
  const averageImportsBn = round2(averageMonthlyImports / 1000);
  const officialSources = [
    'https://www.sbp.org.pk/assets/document/forex.pdf',
    'https://www.sbp.org.pk/assets/document/exp_import_BOP_Arch.xls',
  ];
  const retiredSources = new Set([
    'https://archive.sbp.org.pk/ecodata/exp_import_BOP.xls',
  ]);

  await writeJson('reserves-adequacy.json', {
    ...existing,
    current: {
      ...existing.current,
      sbpReserves,
      totalReserves,
      bankReserves,
      asOf: date,
      importCoverMonths,
      importCoverLabel: 'Goods-import cover',
      importCoverNote: `Computed from SBP-held reserves of $${sbpReserves}bn and the trailing 12-month average monthly goods-import bill of $${averageImportsBn}bn.`,
      importCoverBasis: 'SBP-held reserves divided by the trailing 12-month average of official SBP monthly goods imports.',
    },
    trajectory,
    context: `The latest official SBP reserve stock covers about ${importCoverMonths} months of the trailing goods-import bill on this dashboard's stated calculation. This is a transparent directional measure, not the IMF's broader reserve-adequacy metric.`,
    sourceUrl: officialSources[0],
    lastVerified: new Date().toISOString().split('T')[0],
    verifiedFrom: [
      ...officialSources,
      ...(existing.verifiedFrom || []).filter(url =>
        !officialSources.includes(url) && !retiredSources.has(url),
      ),
    ],
    methodologyNote: `The current ${importCoverMonths}-month figure is calculated as $${sbpReserves}bn of SBP-held reserves divided by $${averageImportsBn}bn, the trailing 12-month average of SBP monthly goods imports through ${imports.at(-1).date}. It therefore measures goods-import cover and may differ from official or IMF measures that use broader imports or reserve-adequacy methods. Historical trajectory points are reported estimates and are not recalculated on the same basis.`,
  });
  console.log(`  📊 ${importCoverMonths} months of trailing goods imports as of ${date}`);
}

// ═══════════════════════════════════════════════════
// KPI GENERATION — derives all KPIs from canonical data files
// ═══════════════════════════════════════════════════

async function generateKpiFromData() {
  console.log('\n📊 Generating KPI summary from canonical data files...');

  const today = new Date().toISOString().split('T')[0];
  const indicators = [];

  // --- Reserves (from reserves.json) ---
  try {
    const reserves = await readJson('reserves.json');
    const pts = reserves.weekly || [];
    if (pts.length > 0) {
      const latest = pts[pts.length - 1];
      const prev = pts.length > 1 ? pts[pts.length - 2] : latest;
      const sbpBn = round2(latest.sbp / 1000);
      const totalBn = round2(latest.total / 1000);
      const changeBn = round2((latest.total - prev.total) / 1000);
      const trend = Math.abs(changeBn) < 0.3 ? 'stable' : changeBn > 0 ? 'up' : 'down';
      // Format date for display
      const dateLabel = latest.date.length > 7 ? latest.date : latest.date; // weekly dates are full, monthly are YYYY-MM
      indicators.push({
        id: 'reserves', label: 'Foreign Reserves (Total)',
        value: totalBn, unit: '$ Billion', period: dateLabel,
        change: changeBn, changeUnit: '$B', changeBasis: `vs week ending ${prev.date}`,
        trend, sentiment: directionalSentiment(trend), source: 'SBP',
        provenanceKey: 'reserves.weekly.total',
        sub: `SBP: $${sbpBn}B · Banks: $${round2(latest.banks / 1000)}B`,
      });
    }
  } catch (err) {
    throw new Error(`Could not generate reserves KPI: ${err.message}`, { cause: err });
  }

  // --- Exchange Rate (from exchange-rates.json) ---
  try {
    const ex = await readJson('exchange-rates.json');
    const pts = ex.monthly || [];
    if (pts.length > 0) {
      const latest = pts[pts.length - 1];
      const prev = pts.length > 1 ? pts[pts.length - 2] : latest;
      const change = round2(latest.USD - prev.USD);
      const trend = Math.abs(change) < 1 ? 'stable' : change > 0 ? 'up' : 'down';
      indicators.push({
        id: 'exchange-rate', label: 'PKR / USD',
        value: latest.USD, unit: 'PKR', period: latest.date,
        change, changeUnit: 'PKR', changeBasis: `vs ${prev.date}`,
        trend, sentiment: directionalSentiment(trend, false), source: 'SBP',
        provenanceKey: 'exchange-rates.monthly.usd',
      });
    }
  } catch (err) {
    throw new Error(`Could not generate exchange-rate KPI: ${err.message}`, { cause: err });
  }

  // --- Remittances (from remittances.json) ---
  try {
    const rem = await readJson('remittances.json');
    const pts = rem.monthly || [];
    if (pts.length > 0) {
      const latest = pts[pts.length - 1];
      const prev = pts.length > 1 ? pts[pts.length - 2] : latest;
      const valBn = round2(latest.total / 1000);
      const changeBn = round2((latest.total - prev.total) / 1000);
      const trend = Math.abs(changeBn) < 0.2 ? 'stable' : changeBn > 0 ? 'up' : 'down';
      indicators.push({
        id: 'remittances', label: 'Remittances (Monthly)',
        value: valBn, unit: '$ Billion', period: latest.date,
        change: changeBn, changeUnit: '$B', changeBasis: `vs ${prev.date}`,
        trend, sentiment: directionalSentiment(trend), source: 'SBP',
        provenanceKey: 'remittances.monthly.total',
      });
    }
  } catch (err) {
    throw new Error(`Could not generate remittances KPI: ${err.message}`, { cause: err });
  }

  // --- FDI (from fdi.json) ---
  try {
    const fdi = await readJson('fdi.json');
    if (fdi.fytdComparison) {
      const cur = fdi.fytdComparison.current;
      const prior = fdi.fytdComparison.prior;
      const curNet = cur.net_fdi ?? cur.net;
      const priorNet = prior.net_fdi ?? prior.net;
      const changePct = priorNet ? round2(((curNet - priorNet) / Math.abs(priorNet)) * 100) : null;
      const netBn = round2(curNet / 1000);
      const trend = changePct > 2 ? 'up' : changePct < -2 ? 'down' : 'stable';
      indicators.push({
        id: 'fdi', label: 'Net FDI',
        value: netBn, unit: '$B', decimals: 2,
        period: `${fdi.fytdComparison.period} ${cur.label}${cur.status === 'provisional' ? ' (P)' : ''}`,
        change: changePct, changeUnit: '%', changeBasis: `vs ${fdi.fytdComparison.period} ${prior.label}`,
        trend, sentiment: directionalSentiment(trend), source: 'SBP',
        provenanceKey: 'fdi.fytd.current',
      });
    }
  } catch (err) {
    throw new Error(`Could not generate FDI KPI: ${err.message}`, { cause: err });
  }

  // --- IT & Services (from services.json) ---
  try {
    const svc = await readJson('services.json');
    if (svc.itHeadline || svc.comparison) {
      const current = svc.itHeadline?.fytd
        ?? svc.comparison.current?.itCredit
        ?? svc.comparison.fy26.itCredit;
      const prior = svc.itHeadline?.fytdPrior
        ?? svc.comparison.prior?.itCredit
        ?? svc.comparison.fy25.itCredit;
      const itBn = round2(current / 1000);
      const priorBn = round2(prior / 1000);
      const changePct = priorBn ? round2(((itBn - priorBn) / priorBn) * 100) : null;
      const trend = changePct == null ? 'stable' : changePct > 0 ? 'up' : 'down';
      indicators.push({
        id: 'it_exports', label: 'IT & Telecom Exports',
        value: itBn, unit: '$B', decimals: 2,
        period: svc.itHeadline?.fytdLabel
          || `${svc.comparison.period} ${svc.comparison.currentLabel || 'FY26'}`,
        change: changePct, changeUnit: '%',
        changeBasis: svc.itHeadline?.fytdPriorLabel
          ? `vs ${svc.itHeadline.fytdPriorLabel}`
          : `vs ${svc.comparison.period} ${svc.comparison.priorLabel || 'FY25'}`,
        trend,
        sentiment: directionalSentiment(trend),
        source: 'SBP',
        provenanceKey: svc.itHeadline ? 'services.itHeadline.fytd' : 'services.itTelecom.credit',
      });
    }
  } catch (err) {
    throw new Error(`Could not generate IT exports KPI: ${err.message}`, { cause: err });
  }

  // --- GDP Growth (from fiscal.json) ---
  try {
    const fiscal = await readJson('fiscal.json');
    const annual = fiscal.annual || [];
    if (annual.length > 0) {
      const latest = annual[annual.length - 1];
      const prev = annual.length > 1 ? annual[annual.length - 2] : null;
      const change = prev ? round2(latest.gdpGrowth - prev.gdpGrowth) : 0;
      const trend = change > 0.2 ? 'up' : change < -0.2 ? 'down' : 'stable';
      // Mark last FY as estimate if it's current/upcoming
      const isEstimate = latest.year >= 'FY2026';
      indicators.push({
        id: 'gdp-growth', label: 'GDP Growth Rate',
        value: latest.gdpGrowth, unit: '%',
        period: `${latest.year}${isEstimate ? ' (Est.)' : ''}`,
        change, changeUnit: 'pp', changeBasis: prev ? `vs ${prev.year}` : 'no prior year',
        trend, sentiment: directionalSentiment(trend), source: 'PBS / IMF',
        provenanceKey: 'fiscal.gdpGrowth.latest',
      });
    }
  } catch (err) {
    throw new Error(`Could not generate GDP KPI: ${err.message}`, { cause: err });
  }

  // --- Inflation (from inflation.json) ---
  try {
    const inf = await readJson('inflation.json');
    const cpi = inf.national_cpi?.data || [];
    if (cpi.length > 0) {
      const latest = cpi[cpi.length - 1];
      const prev = cpi.length > 1 ? cpi[cpi.length - 2] : latest;
      const change = round2(latest.value - prev.value);
      const trend = latest.value > 5 ? (change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable') : 'down';
      indicators.push({
        id: 'inflation', label: 'CPI Inflation (YoY)',
        value: round2(latest.value), unit: '%',
        period: latest.date,
        change, changeUnit: 'pp', changeBasis: `vs ${prev.date}`,
        trend,
        sentiment: targetBandSentiment(latest.value, trend, 5, 7),
        source: 'PBS',
        provenanceKey: 'inflation.nationalCpi.latest',
        sub: `SBP target: 5–7%`,
      });
    }
  } catch (err) {
    throw new Error(`Could not generate inflation KPI: ${err.message}`, { cause: err });
  }

  // --- FBR Tax Collection (from fbr-tax.json) ---
  try {
    const fbr = await readJson('fbr-tax.json');
    const pts = (fbr.monthly || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const latest = pts[pts.length - 1];
    if (fbr.fytd && latest) {
      const f = fbr.fytd;
      const growthPct = f.priorNet ? round2(((f.net - f.priorNet) / f.priorNet) * 100) : 0;
      const trend = growthPct > 0.5 ? 'up' : growthPct < -0.5 ? 'down' : 'stable';
      const gap = f.target != null ? Math.round(f.net - f.target) : null;
      const sub = gap != null
        ? `Target ₨${(f.target / 1000).toFixed(2)}T · ${gap >= 0 ? 'surplus' : 'shortfall'} ₨${Math.abs(gap)}B`
        : `Latest: ₨${Math.round(latest.net)}B (${latest.date})`;
      indicators.push({
        id: 'fbr-tax', label: fbrCollectionLabel(f),
        value: round2(f.net / 1000), unit: 'T PKR',
        period: f.period,
        change: growthPct, changeUnit: '%',
        changeBasis: f.priorPeriod ? `vs ${f.priorPeriod}` : 'vs same period last year',
        trend,
        sentiment: gap == null ? directionalSentiment(trend) : gap >= 0 ? 'positive' : 'negative',
        source: f.sourceType === 'secondary-attributed'
          ? (f.sourceLabel || 'Secondary report citing provisional FBR data')
          : 'FBR',
        sourceType: f.sourceType || 'official-primary',
        provenanceKey: 'fbr.fytd.net',
        sub,
      });
    }
  } catch (err) {
    throw new Error(`Could not generate FBR KPI: ${err.message}`, { cause: err });
  }

  // --- Policy Rate (from monetary-policy.json) ---
  // Derived from the SBP Monetary Policy Committee decision series — never
  // copied forward from the previous kpi-summary.json, which would let a stale
  // rate persist indefinitely while `lastUpdated` kept advancing.
  try {
    const mp = await readJson('monetary-policy.json');
    const decisions = (mp.decisions || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const lastDecision = decisions[decisions.length - 1];
    if (typeof mp.currentRate !== 'number') {
      throw new Error('monetary-policy.json is missing a numeric currentRate');
    }
    if (lastDecision && Math.abs(lastDecision.rate - mp.currentRate) > 0.001) {
      throw new Error(
        `monetary-policy.json currentRate (${mp.currentRate}%) disagrees with the latest ` +
        `decision on ${lastDecision.date} (${lastDecision.rate}%)`,
      );
    }
    const changePp = lastDecision?.changeBps != null ? round2(lastDecision.changeBps / 100) : 0;
    const trend = changePp > 0 ? 'up' : changePp < 0 ? 'down' : 'stable';
    indicators.push({
      id: 'policy-rate',
      label: 'SBP Policy Rate',
      value: mp.currentRate,
      unit: '%',
      period: mp.asOf || lastDecision?.date || null,
      change: changePp,
      changeUnit: 'pp',
      changeBasis: lastDecision ? `last MPC decision ${lastDecision.date}` : 'no decision on record',
      trend,
      sentiment: 'neutral',
      source: 'SBP Monetary Policy Committee',
      provenanceKey: 'monetaryPolicy.currentRate',
      sub: mp.nextMeeting
        ? `Next MPC: ${mp.nextMeeting.dateText || mp.nextMeeting.date || 'date to be announced'}`
        : undefined,
    });
  } catch (err) {
    throw new Error(`Could not generate policy-rate KPI: ${err.message}`, { cause: err });
  }

  const expectedIds = ['reserves', 'exchange-rate', 'remittances', 'fdi', 'it_exports', 'gdp-growth', 'inflation', 'fbr-tax', 'policy-rate'];
  const missingIds = expectedIds.filter(id => !indicators.some(indicator => indicator.id === id));
  if (missingIds.length > 0) {
    throw new Error(`KPI generation incomplete; missing: ${missingIds.join(', ')}`);
  }
  // A bare "+1.4" next to a headline number is unreadable and, worse, invites a
  // reader to compare a $B week-on-week delta with a percent YoY change. Every
  // KPI must therefore declare what its `change` is measured in and against what.
  const unlabelled = indicators.filter(i => i.change != null && (!i.changeUnit || !i.changeBasis));
  if (unlabelled.length > 0) {
    throw new Error(
      `KPI change values must declare changeUnit and changeBasis; missing on: ${unlabelled.map(i => i.id).join(', ')}`,
    );
  }
  const kpi = { lastUpdated: today, indicators };
  await writeJson('kpi-summary.json', kpi);
  await recordKpiProvenance(indicators);
  console.log(`  ✅ Generated ${indicators.length} KPI indicators from data files`);
}

// Record where each headline KPI came from so the UI can cite it precisely.
async function recordKpiProvenance(indicators) {
  const byId = Object.fromEntries(indicators.map((i) => [i.id, i]));
  const cite = async (key, entry) => recordProvenance(key, entry);

  if (byId.reserves) {
    await cite('reserves.weekly.total', {
      label: 'Total liquid foreign exchange reserves (SBP + scheduled banks)',
      sourceKey: 'forex.pdf',
      location: 'Weekly reserves statement, "Total Liquid Foreign Reserves" line',
      period: byId.reserves.period,
      unit: 'US$ billion',
      value: byId.reserves.value,
    });
  }
  if (byId['exchange-rate']) {
    await cite('exchange-rates.monthly.usd', {
      label: 'PKR/USD interbank closing rate, monthly average',
      sourceKey: 'IBF_Arch.xls',
      location: 'Interbank rates archive, USD column',
      period: byId['exchange-rate'].period,
      unit: 'PKR per USD',
      value: byId['exchange-rate'].value,
    });
  }
  if (byId.remittances) {
    await cite('remittances.monthly.total', {
      label: 'Workers\u2019 remittances, monthly total',
      sourceKey: 'sbp-easydata',
      location: 'Workers\u2019 remittances by country of origin, total',
      period: byId.remittances.period,
      unit: 'US$ billion',
      value: byId.remittances.value,
    });
  }
  if (byId.fdi) {
    const fdiJson = await readJson('fdi.json').catch(() => ({}));
    const fytd = fdiJson.fytdComparison || {};
    await cite('fdi.fytd.current', {
      label: 'Net foreign direct investment, fiscal year to date',
      sourceKey: fytd.sourceFile || 'NetinflowSummary.xls',
      sheet: fytd.sourceSheet || 'Summary',
      location: fytd.sourceLocation || '"Direct Investment" row, current fiscal-year-to-date column',
      period: byId.fdi.period,
      status: /\(P\)/.test(byId.fdi.period || '') ? 'provisional' : 'final',
      unit: 'US$ billion',
      value: Number(byId.fdi.value),
    });
  }
  if (byId.it_exports) {
    const servicesJson = await readJson('services.json');
    const headline = servicesJson.itHeadline;
    await cite(byId.it_exports.provenanceKey, {
      label: 'Telecommunications, computer and information services exports (credit)',
      sourceKey: headline ? 'ExportsImports-Goods.pdf' : 'dt.xls',
      location: headline
        ? 'IT & Telecommunication Services, current fiscal-year cumulative column'
        : 'EBOPS line 9 "Telecommunications, Computer and information services", credit column',
      period: byId.it_exports.period,
      status: 'provisional',
      unit: 'US$ billion',
      value: Number(byId.it_exports.value),
    });
  }
  if (byId['gdp-growth']) {
    await cite('fiscal.gdpGrowth.latest', {
      label: 'Real GDP growth rate at constant basic prices of 2015-16',
      sourceKey: 'GDP_table.xlsx',
      sheet: 'Annual',
      location: '"GDP Growth Rate (%)" row',
      period: byId['gdp-growth'].period,
      status: /Est/.test(byId['gdp-growth'].period || '') ? 'estimate' : 'final',
      unit: '%',
      value: byId['gdp-growth'].value,
    });
  }
  if (byId.inflation) {
    await cite('inflation.nationalCpi.latest', {
      label: 'National Consumer Price Index, year-on-year inflation',
      sourceKey: 'pbs-cpi',
      location: 'Monthly CPI review, national year-on-year rate',
      period: byId.inflation.period,
      unit: '%',
      value: byId.inflation.value,
    });
  }
  if (byId['fbr-tax']) {
    await cite('fbr.fytd.net', {
      label: 'FBR net tax collection, fiscal year to date',
      sourceKey: 'fbr-collection',
      location: 'FBR revenue collection statement, net collection',
      period: byId['fbr-tax'].period,
      status: 'provisional',
      unit: 'PKR trillion',
      value: byId['fbr-tax'].value,
      note: byId['fbr-tax'].sourceType === 'secondary-attributed'
        ? 'Currently sourced from press reporting of provisional FBR figures, not an FBR publication.'
        : null,
    });
  }
  if (byId['policy-rate']) {
    await cite('monetaryPolicy.currentRate', {
      label: 'SBP policy (target) rate set by the Monetary Policy Committee',
      sourceKey: 'sbp-monetary-policy',
      location: 'Latest Monetary Policy Statement',
      period: byId['policy-rate'].period,
      unit: '%',
      value: byId['policy-rate'].value,
    });
  }

  // Figures that are cited on charts but are not headline KPIs.
  try {
    const trade = await readJson('trade.json');
    const latest = (trade.monthly || []).at(-1);
    if (latest) {
      await cite('trade.monthly.balance', {
        label: 'Monthly goods trade balance (BOP basis)',
        sourceKey: 'exp_import_BOP.xls',
        location: 'Exports and imports of goods, monthly',
        period: latest.date,
        unit: 'US$ million',
        value: latest.balance,
        derivedFrom: `Exports of $${latest.exports}M less imports of $${latest.imports}M as published by SBP`,
      });
    }
  } catch (err) {
    throw new Error(`Could not record trade provenance: ${err.message}`, { cause: err });
  }

  const count = await flushProvenance();
  console.log(`  ✅ provenance.json now cites ${count} figures`);
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

  // 5. (Balance of Payments diagnostics removed — see note above.)

  // 6. Exchange rates (if archive was downloaded)
  if (archiveOk) {
    summary.exchangeRates = await updateExchangeRates();
  }

  // 7. Reserves (forex.pdf)
  summary.reserves = await updateReserves();

  // 8. Services (dt.xls — EBOPS)
  summary.services = await updateServices();

  // 8b. Services headline from the BOP summary. Runs after updateServices()
  // because it augments the same file, and SBP refreshes it a month earlier.
  summary.bopServices = await updateBopServices();

  // 8c. Newer IT headline from SBP's monthly goods-and-services table. This
  // advances the aggregate without relabelling lagging EBOPS subcomponents.
  summary.servicesHeadline = await updateServicesHeadline();

  // 9. Trade by country
  summary.tradeCountries = await updateTradeCountries();

  // 10. Refresh derived metrics from the newly parsed canonical data.
  await updateReservesAdequacyFromData();

  // 11. Regenerate KPI summary from all canonical data files
  await generateKpiFromData();

  // ─── Summary ───
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Parse Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✅ trade.json       — ${summary.trade} monthly data points`);
  console.log(`  ✅ fdi.json         — ${summary.fdi?.sectors} sectors, ${summary.fdi?.countries} countries, ${summary.fdi?.years} FY`);
  console.log(`  ✅ fiscal.json      — ${summary.fiscal} fiscal years`);
  console.log(`  ✅ kpi-summary.json — derived from canonical data files`);
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

// ─── Entry Point ───

const args = process.argv.slice(2);

if (args.includes('--kpi-only')) {
  // Regenerate KPI summary from existing data files (no Excel parsing)
  console.log('\n🇵🇰 Regenerating KPI summary from canonical data files...\n');
  updateReservesAdequacyFromData().then(generateKpiFromData).then(() => {
    console.log('\n✨ KPI regeneration done!\n');
  }).catch(err => {
    console.error('\n❌ KPI generation error:', err.message);
    process.exit(1);
  });
} else {
  main().catch(err => {
    console.error('\n❌ Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}
