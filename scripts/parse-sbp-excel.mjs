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
import * as fs from 'fs';
import { readFile, writeFile, access } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parsePdfTextItems } from './pdf-text.mjs';

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

function fiscalPeriodEndIndex(period) {
  const match = String(period || '').match(/jul(?:y)?[-\s]+([a-z]+)/i);
  if (!match) return null;
  const order = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'];
  const end = match[1].slice(0, 3).toLowerCase();
  const index = order.indexOf(end);
  return index >= 0 ? index : null;
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
  const firstDate = monthly[0]?.date;
  const lastDate = monthly.at(-1)?.date;
  await writeJson('trade.json', {
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
// 2. FDI (Foreign_Dir, Netinflow, NetinflowSummary)
// ═══════════════════════════════════════════════════

async function updateFdi() {
  console.log('\n💰 Parsing FDI Data...');

  // --- By Sector (Foreign_Dir.xls / BS_M sheet) ---
  // Row 2: period labels, Row 3: Inflow/Outflow/Net sub-headers
  // Columns resolved from headers for robustness
  console.log('  📋 FDI by sector (Foreign_Dir.xls)...');
  const wbS = readExcel('Foreign_Dir.xls');
  const sRows = getSheet(wbS, 'BS_M');

  // Resolve column indices from header row 2
  const sHdr = sRows[2] || [];
  let sCurrentNetCol = 6;  // fallback: Jul-Mar FY26 Net FDI
  let sPriorNetCol = 9;    // fallback: Jul-Mar FY25 Net FDI
  let sCurrentInCol = 4;   // fallback: Jul-Mar FY26 Inflow
  let sCurrentOutCol = 5;  // fallback: Jul-Mar FY26 Outflow
  let sPriorInCol = 7;     // fallback: Jul-Mar FY25 Inflow
  let sPriorOutCol = 8;    // fallback: Jul-Mar FY25 Outflow
  let sCurrentPeriod = 'Jul-Mar FY26';
  let sPriorPeriod = 'Jul-Mar FY25';

  // Try to find the actual period columns from headers
  for (let c = 0; c < sHdr.length; c++) {
    const h = (sHdr[c] || '').toString().trim();
    if (/July.*FY\d{2}\s*\(P\)/i.test(h)) {
      sCurrentInCol = c;     // first col of current FYTD group
      sCurrentOutCol = c + 1;
      sCurrentNetCol = c + 2;
      sCurrentPeriod = h.replace(/\s*\(P\)\s*/i, '');
    } else if (/July.*FY\d{2}\s*$/i.test(h)) {
      sPriorInCol = c;
      sPriorOutCol = c + 1;
      sPriorNetCol = c + 2;
      sPriorPeriod = h.trim();
    }
  }

  const allSectors = [];
  for (let i = 4; i <= 27; i++) {
    const row = sRows[i];
    if (!row) continue;
    let sector = (row[0] || '').toString().trim();
    if (!sector) continue;
    if (/privatisation|total/i.test(sector)) continue;

    sector = sector.replace(/^[A-Z]\.\s+/, '');
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
  const topSectors = allSectors.slice(0, 10);
  const otherSectorAmt = allSectors.slice(10).reduce((s, x) => s + x.amount, 0);
  const otherSectorPrior = allSectors.slice(10).reduce((s, x) => s + (x.priorAmount || 0), 0);
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

  // Resolve column indices from header rows
  const cHdr3 = cRows[3] || [];
  const cHdr4 = cRows[4] || [];
  // Find Net FDI columns for current and prior FYTD
  let cCurrentNetCol = -1, cPriorNetCol = -1;
  let cCurrentPeriod = sCurrentPeriod, cPriorPeriod = sPriorPeriod;
  for (let c = 2; c < cHdr3.length; c++) {
    const h3 = (cHdr3[c] || '').toString().trim();
    const h4 = (cHdr4[c] || '').toString().trim();
    if (/July.*FY\d{2}\s*\(P\)/i.test(h3)) {
      // Current FYTD block — find the "Net FDI" sub-column
      for (let sc = c; sc < c + 6; sc++) {
        const sub = (cHdr4[sc] || '').toString().trim();
        if (/net/i.test(sub) && cCurrentNetCol === -1) { cCurrentNetCol = sc; break; }
      }
      cCurrentPeriod = h3.replace(/\s*\(P\)\s*/i, '');
    } else if (/July.*FY\d{2}\s*$/i.test(h3) && !/\(P\)/i.test(h3)) {
      for (let sc = c; sc < c + 6; sc++) {
        const sub = (cHdr4[sc] || '').toString().trim();
        if (/net/i.test(sub) && cPriorNetCol === -1) { cPriorNetCol = sc; break; }
      }
      cPriorPeriod = h3.trim();
    }
  }
  // Fallbacks
  if (cCurrentNetCol === -1) cCurrentNetCol = 9;
  if (cPriorNetCol === -1) cPriorNetCol = 14;

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
  // Row 4: FY headers, Row 8: "Direct Investment", Row 9: Inflow, Row 10: Outflow
  console.log('  📋 Annual FDI (NetinflowSummary.xls)...');
  const wbA = readExcel('NetinflowSummary.xls');
  const aRows = getSheet(wbA, 'Summary');

  const headerRow = aRows[4];
  const fdiRow = aRows[8];     // Direct Investment (net)
  const inflowRow = aRows[9];  // Inflow
  const outflowRow = aRows[10]; // Outflow
  const subHeaderRow = aRows[5] || [];

  const annual = [];
  let fytdComparison = null;
  let monthlyComparison = null;

  // Find the latest cumulative FYTD column (for example "Jul-Apr").
  // SBP places current FYTD first, with the prior-year comparison in the next column.
  let fytdCol = -1;
  let fytdPeriod = '';
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
      fytdCol === -1 &&
      /^jul[-\s]/i.test(hdr) &&
      typeof fdiRow[col] === 'number' &&
      typeof fdiRow[col + 1] === 'number'
    ) {
      fytdCol = col;
      fytdPeriod = hdr.replace(/\s*\([RP]\)\s*/i, '').trim();
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
        const toFullFy = (raw) => {
          const n = parseInt(raw, 10);
          if (n > 1000) return n;
          return n >= 90 ? 1900 + n : 2000 + n;
        };
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
  if (fytdCol >= 0 && typeof fdiRow[fytdCol] === 'number') {
    const currentFytd = fdiRow[fytdCol];
    const priorFytd = (fytdCol + 1 < fdiRow.length && typeof fdiRow[fytdCol + 1] === 'number')
      ? fdiRow[fytdCol + 1] : null;

    // Derive FY labels from the last full-year entry
    const lastFy = annual[annual.length - 1];
    const lastFyNum = parseInt(lastFy?.year?.replace('FY', '') || '2025');
    const currentFyLabel = `FY${lastFyNum + 1}`;
    const priorFyLabel = lastFy?.year || `FY${lastFyNum}`;

    fytdComparison = {
      period: fytdPeriod,
      current: {
        label: currentFyLabel,
        net_fdi: round2(currentFytd),
        inflow: typeof inflowRow?.[fytdCol] === 'number' ? round2(inflowRow[fytdCol]) : null,
        outflow: typeof outflowRow?.[fytdCol] === 'number' ? round2(outflowRow[fytdCol]) : null,
        status: 'provisional',
      },
      prior: priorFytd != null ? {
        label: priorFyLabel,
        net_fdi: round2(priorFytd),
        inflow: typeof inflowRow?.[fytdCol + 1] === 'number' ? round2(inflowRow[fytdCol + 1]) : null,
        outflow: typeof outflowRow?.[fytdCol + 1] === 'number' ? round2(outflowRow[fytdCol + 1]) : null,
      } : null,
    };
  }

  const existing = await readJson('fdi.json').catch(() => ({}));
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
    sectorPeriod: sCurrentPeriod,
    sectorPriorPeriod: sPriorPeriod,
    countryPeriod: cCurrentPeriod,
    countryPriorPeriod: cPriorPeriod,
    source: 'State Bank of Pakistan',
    dataSource: 'SBP',
    lastUpdated: new Date().toISOString().split('T')[0],
    dataCoverage: fytdComparison ? `${fytdComparison.current.label} ${fytdComparison.period}` : `${annual[0]?.year} – ${annual.at(-1)?.year}`,
  };
  if (fytdComparison) result.fytdComparison = fytdComparison;
  if (monthlyComparison) result.monthlyComparison = monthlyComparison;

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

  // Row 4: year headers (col 2 = "1999-2000", col 3 = "2000-01", ..., col 27 = "2024-25")
  // Row 5: GDP Growth Rate (%)
  const headerRow = rows[4];
  const growthRow = rows[5];

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

  // Spread existing keys (e.g. publicFinance from API updates) to preserve them
  await writeJson('fiscal.json', {
    ...existing,
    annual,
    dataSource: 'SBP / PBS',
    lastUpdated: new Date().toISOString().split('T')[0],
    dataCoverage: `${annual[0]?.year} – ${annual.at(-1)?.year}`,
  });
  console.log(`  📊 ${annual.length} fiscal years with GDP growth data`);
  return annual.length;
}

// ═══════════════════════════════════════════════════
// 4. BALANCE OF PAYMENTS (Balancepayment_BPM6.xls)
// ═══════════════════════════════════════════════════

async function updateBop() {
  console.log('\n🌐 Parsing Balance of Payments (Balancepayment_BPM6.xls)...');

  const wb = readExcel('Balancepayment_BPM6.xls');
  const rows = getSheet(wb, 'BPM6_Summary');

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
    sbpReservesMar26: val(79, 7),
  };

  const latestReserves = val(79, 10) ?? val(79, 7);

  // KPI updates are handled by generateKpiFromData() at the end of the pipeline

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

  // Resolve columns from header row (row 6)
  const hdr6 = rows[6] || [];
  const hdr7 = rows[7] || [];
  // Find column groups by period header
  // Each group: [Credit, Debit, Net]
  let currentPeriodCols = { credit: 13, debit: 14, net: 15 };
  let priorPeriodCols = { credit: 10, debit: 11, net: 12 };
  let month1Cols = null, month2Cols = null;
  let month1Label = '', month2Label = '', currentPeriodLabel = 'Jul-Feb FY26', priorPeriodLabel = 'Jul-Feb FY25';

  for (let c = 0; c < hdr6.length; c++) {
    const h = (hdr6[c] || '').toString().trim();
    if (!h) continue;

    // Skip date serial columns (old month) — only use named months
    if (typeof hdr6[c] === 'number' && hdr6[c] > 40000 && hdr6[c] < 50000) continue;

    // Named month like "Jan-26 (R)" or "Feb-26 (P)"
    const monthMatch = h.match(/^(\w{3})-(\d{2})\s*\(([RP])\)/i);
    if (monthMatch) {
      if (!month1Cols) {
        month1Cols = { credit: c, debit: c + 1, net: c + 2 };
        month1Label = `${monthMatch[1]}-${monthMatch[2]}`;
      } else if (!month2Cols) {
        month2Cols = { credit: c, debit: c + 1, net: c + 2 };
        month2Label = `${monthMatch[1]}-${monthMatch[2]}`;
      }
    }

    // Cumulative "Jul-Feb, FY26 (P)" or "Jul-Feb, FY25"
    const cumMatch = h.match(/^(Jul-\w+),?\s*FY(\d{2})\s*(\(P\))?/i);
    if (cumMatch) {
      const fyNum = parseInt(cumMatch[2]);
      const isProv = !!cumMatch[3];
      if (isProv) {
        currentPeriodCols = { credit: c, debit: c + 1, net: c + 2 };
        currentPeriodLabel = `Jul-${cumMatch[1].split('-')[1]} FY${cumMatch[2]}`;
      } else {
        priorPeriodCols = { credit: c, debit: c + 1, net: c + 2 };
        priorPeriodLabel = `Jul-${cumMatch[1].split('-')[1]} FY${cumMatch[2]}`;
      }
    }
  }

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
    itItems.push({
      name,
      credit: toM(r[currentPeriodCols.credit]),
      priorCredit: toM(r[priorPeriodCols.credit]),
    });
  }

  // "Other Computer Services" = Computer services (row 62) minus named subcategories
  const computerServicesRow = rows[62];
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

  // Total services row (row 8)
  const totalRow = rows[8];
  const totalCredit = toM(totalRow?.[currentPeriodCols.credit]);
  const totalDebit = toM(totalRow?.[currentPeriodCols.debit]);
  const totalNet = toM(totalRow?.[currentPeriodCols.net]);
  const totalCreditPrior = toM(totalRow?.[priorPeriodCols.credit]);

  // IT & Telecom (row 58)
  const itRow = rows[58];
  const itCredit = toM(itRow?.[currentPeriodCols.credit]);
  const itNet = toM(itRow?.[currentPeriodCols.net]);
  const itCreditPrior = toM(itRow?.[priorPeriodCols.credit]);

  // Computer services (row 62)
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
    { row: 58, name: 'IT & Telecom (total)', key: 'itTotal' },
    { row: 59, name: 'Telecommunications', key: 'telecom' },
    { row: 64, name: 'Software Consultancy', key: 'softwareConsultancy' },
    { row: 66, name: 'Computer Software Exports', key: 'softwareExports' },
    { row: 67, name: 'Freelance IT', key: 'freelance' },
    { row: 69, name: 'Information Services', key: 'informationServices' },
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
  const freelanceRow = rows[67] || [];
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
      fy25: { totalCredit: totalCreditPrior, itCredit: itCreditPrior },
      fy26: { totalCredit: totalCredit, itCredit: itCredit },
      period: currentPeriodLabel.replace(/FY\d{2}/, '').trim().replace(/,$/, ''),
      currentLabel: `FY${currentPeriodLabel.match(/FY(\d{2})/)?.[1] || '26'}`,
      priorLabel: `FY${priorPeriodLabel.match(/FY(\d{2})/)?.[1] || '25'}`,
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

// ═══════════════════════════════════════════════════
// 8. TRADE BY COUNTRY (Export/Import by country files)
// ═══════════════════════════════════════════════════

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Convert a "month name + FY two-digit" pair to a calendar YYYY-MM string.
// Pakistan fiscal year FYxx runs Jul (xx-1) → Jun (xx). Jul–Dec fall in the
// previous calendar year; Jan–Jun fall in the FY calendar year.
function fyMonthToYearMonth(monthName, fy) {
  const idx = MONTH_NAMES.findIndex((m) => new RegExp(`^${m}`, 'i').test(monthName));
  if (idx < 0 || !fy) return null;
  const monthNum = idx + 1; // 1-12
  const calYear = monthNum >= 7 ? 2000 + fy - 1 : 2000 + fy;
  return `${calYear}-${String(monthNum).padStart(2, '0')}`;
}

// Inspect the SBP by-country header rows (row 4 = period, row 5 = FY) and
// classify which physical column holds each snapshot we care about: the latest
// provisional month, the prior (revised) month, the year-ago same month, and
// the fiscal-year-to-date totals for the current and prior fiscal years.
function classifyCountryColumns(rows) {
  const r4 = rows[4] || [];
  const r5 = rows[5] || [];
  const maxc = Math.max(r4.length, r5.length);

  // Carry period labels forward across horizontally-merged header cells
  // (e.g. "Jul-Jun" spans the FY24/FY25 columns, "Jul-May" spans FY25/FY26).
  const periods = [];
  let lastLabel = '';
  for (let c = 0; c < maxc; c++) {
    const v = (r4[c] ?? '').toString().trim();
    if (v) lastLabel = v;
    periods[c] = v || lastLabel;
  }

  let maxFY = 0;
  for (let c = 0; c < maxc; c++) {
    const m = (r5[c] || '').toString().match(/FY\s*(\d{2})/i);
    if (m) maxFY = Math.max(maxFY, +m[1]);
  }
  const curFY = maxFY;
  const priorFY = maxFY - 1;

  const cols = { curFY, priorFY };
  for (let c = 1; c < maxc; c++) {
    const p4 = periods[c] || '';
    const f5 = (r5[c] || '').toString().trim();
    const fym = f5.match(/FY\s*(\d{2})/i);
    const fy = fym ? +fym[1] : null;
    if (!fy) continue;

    // Skip full fiscal-year (annual) columns — "Jul-Jun".
    if (/jul\s*-\s*jun/i.test(p4)) continue;

    const isFytd = /jul\s*-/i.test(p4);
    const isProv = /\(\s*P\s*\)/i.test(p4) || /\(\s*P\s*\)/i.test(f5);
    const isRev = /\(\s*R\s*\)/i.test(p4);
    const monthMatch = p4.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);

    if (isFytd) {
      if (fy === curFY && cols.fytdCur === undefined) {
        cols.fytdCur = c;
        cols.fytdLabel = p4.replace(/\s*\(.*$/, '').trim();
      } else if (fy === priorFY && cols.fytdPrior === undefined) {
        cols.fytdPrior = c;
      }
    } else if (monthMatch) {
      const monthName = monthMatch[1];
      if (isProv && fy === curFY && cols.latest === undefined) {
        cols.latest = c;
        cols.latestMonth = fyMonthToYearMonth(monthName, fy);
      } else if (isRev && fy === curFY && cols.prev === undefined) {
        cols.prev = c;
        cols.prevMonth = fyMonthToYearMonth(monthName, fy);
      } else if (fy === priorFY && cols.yearAgo === undefined) {
        cols.yearAgo = c;
        cols.yearAgoMonth = fyMonthToYearMonth(monthName, fy);
      }
    }
  }
  return cols;
}

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
  let impCol = -1;
  for (let c = impHeader5.length - 1; c >= 0; c--) {
    const h5 = (impHeader5[c] || '').toString();
    if (/FY26/i.test(h5)) { impCol = c; break; }
  }
  if (impCol < 0) impCol = 7;
  console.log(`  Import data column: ${impCol}`);
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
    'https://archive.sbp.org.pk/ecodata/exp_import_BOP.xls',
  ];

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
      ...(existing.verifiedFrom || []).filter(url => !officialSources.includes(url)),
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
        change: changeBn, trend, sentiment: directionalSentiment(trend), source: 'SBP',
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
        change, trend, sentiment: directionalSentiment(trend, false), source: 'SBP',
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
        change: changeBn, trend, sentiment: directionalSentiment(trend), source: 'SBP',
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
        value: String(netBn), unit: '$B',
        period: `${fdi.fytdComparison.period} ${cur.label}${cur.status === 'provisional' ? ' (P)' : ''}`,
        change: changePct, trend, sentiment: directionalSentiment(trend), source: 'SBP',
      });
    }
  } catch (err) {
    throw new Error(`Could not generate FDI KPI: ${err.message}`, { cause: err });
  }

  // --- IT & Services (from services.json) ---
  try {
    const svc = await readJson('services.json');
    if (svc.comparison) {
      const itBn = round2(svc.comparison.fy26.itCredit / 1000);
      const priorBn = round2(svc.comparison.fy25.itCredit / 1000);
      const changePct = priorBn ? round2(((itBn - priorBn) / priorBn) * 100) : null;
      const trend = changePct == null ? 'stable' : changePct > 0 ? 'up' : 'down';
      indicators.push({
        id: 'it_exports', label: 'IT & Telecom Exports',
        value: String(itBn), unit: '$B',
        period: `${svc.comparison.period} ${svc.comparison.currentLabel || 'FY26'}`,
        change: changePct, trend,
        sentiment: directionalSentiment(trend),
        source: 'SBP',
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
        change, trend, sentiment: directionalSentiment(trend), source: 'PBS / IMF',
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
        period: latest.date, change, trend,
        sentiment: targetBandSentiment(latest.value, trend, 5, 7),
        source: 'PBS',
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
        id: 'fbr-tax', label: 'FBR Tax Collection (FYTD)',
        value: round2(f.net / 1000), unit: 'T PKR',
        period: f.period,
        change: growthPct, trend,
        sentiment: gap == null ? directionalSentiment(trend) : gap >= 0 ? 'positive' : 'negative',
        source: f.sourceType === 'secondary-attributed'
          ? (f.sourceLabel || 'Secondary report citing provisional FBR data')
          : 'FBR',
        sub,
      });
    }
  } catch (err) {
    throw new Error(`Could not generate FBR KPI: ${err.message}`, { cause: err });
  }

  // --- Policy Rate (from monetary.json) ---
  try {
    const mon = await readJson('monetary.json');
    const m2 = mon.m2?.data || [];
    // Policy rate isn't directly in monetary.json — keep existing if present
    const existingKpi = await readJson('kpi-summary.json');
    const policyRate = existingKpi?.indicators?.find(i => i.id === 'policy-rate');
    if (policyRate) {
      indicators.push({ ...policyRate, sentiment: policyRate.sentiment || 'neutral' });
    }
  } catch (err) {
    throw new Error(`Could not preserve policy-rate KPI: ${err.message}`, { cause: err });
  }

  const expectedIds = ['reserves', 'exchange-rate', 'remittances', 'fdi', 'it_exports', 'gdp-growth', 'inflation', 'fbr-tax', 'policy-rate'];
  const missingIds = expectedIds.filter(id => !indicators.some(indicator => indicator.id === id));
  if (missingIds.length > 0) {
    throw new Error(`KPI generation incomplete; missing: ${missingIds.join(', ')}`);
  }
  const kpi = { lastUpdated: today, indicators };
  await writeJson('kpi-summary.json', kpi);
  console.log(`  ✅ Generated ${indicators.length} KPI indicators from data files`);
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

  // 5. Parse BOP data
  summary.bop = await updateBop();

  // 6. Exchange rates (if archive was downloaded)
  if (archiveOk) {
    summary.exchangeRates = await updateExchangeRates();
  }

  // 7. Reserves (forex.pdf)
  summary.reserves = await updateReserves();

  // 8. Services (dt.xls — EBOPS)
  summary.services = await updateServices();

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
