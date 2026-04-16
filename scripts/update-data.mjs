#!/usr/bin/env node

/**
 * Pakistan Economic Dashboard — Data Update Script
 *
 * Fetches latest data from the SBP EasyData API and updates
 * the JSON files in public/data/.
 *
 * Usage:
 *   npm run update-data                           # update all SBP-sourced data
 *   npm run update-data -- --section remittances   # update only remittances
 *   npm run update-data -- --section kpi           # update only KPI summary
 *   npm run update-data -- --manual                # guided manual entry for PBS/MoF data
 *   SBP_API_KEY=xxx npm run update-data            # pass API key via env
 *
 * Get your free API key:
 *   1. Register at https://easydata.sbp.org.pk
 *   2. Go to My Account → API Key → Generate
 *   3. Save it in a .env file as SBP_API_KEY=your_key_here
 *
 * Coverage:
 *   ✅ Auto (SBP API):  Workers' Remittances (monthly, by country)
 *   📝 Manual update:   All other data (reserves, exchange rates, trade, FDI,
 *                        IT/services, inflation, fiscal, defence)
 *
 * Manual data sources:
 *   - Reserves & Exchange Rates: SBP (https://www.sbp.org.pk)
 *   - Trade:       PBS (https://www.pbs.gov.pk/content/external-trade-statistics)
 *   - FDI:         Board of Investment (https://invest.gov.pk)
 *   - IT/Services: PSEB (https://pseb.org.pk)
 *   - Inflation:   PBS (https://www.pbs.gov.pk/price-statistics)
 *   - Fiscal:      Ministry of Finance (https://www.finance.gov.pk)
 *   - Defence:     Ministry of Defence / SIPRI
 */

import { readFile, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

// SBP's SSL certificate sometimes causes issues with Node.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

// ─── SBP EasyData API Configuration ───

const SBP_API_BASE = 'https://easydata.sbp.org.pk/api/v1';

// Series keys — only Workers' Remittances dataset works (TS_GP_BOP_WR_M.*)
// All other datasets (reserves, exchange rates, trade, FDI, CPI, services) return 404.
const SERIES = {
  remittances_total: 'TS_GP_BOP_WR_M.WR0010',
  remit_usa: 'TS_GP_BOP_WR_M.WR0020',
  remit_uk: 'TS_GP_BOP_WR_M.WR0030',
  remit_saudi: 'TS_GP_BOP_WR_M.WR0040',
  remit_uae: 'TS_GP_BOP_WR_M.WR0050',
  remit_other_gcc: 'TS_GP_BOP_WR_M.WR0100',
  remit_eu: 'TS_GP_BOP_WR_M.WR0150',
};

// ─── Helpers ───

function getApiKey() {
  if (process.env.SBP_API_KEY) return process.env.SBP_API_KEY;
  try {
    const envPath = resolve(__dirname, '..', '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    const match = envFile.match(/^SBP_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch { /* no .env file */ }
  return null;
}

async function fetchSeries(seriesKey, apiKey, startDate, endDate) {
  const url = new URL(`${SBP_API_BASE}/series/${seriesKey}/data`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  if (startDate) url.searchParams.set('start_date', startDate);
  if (endDate) url.searchParams.set('end_date', endDate);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SBP API ${res.status} for ${seriesKey}: ${text.substring(0, 200)}`);
  }
  return res.json();
}

// SBP returns { columns: [...], rows: [[...], ...] }
// Each row: [datasetName, seriesKey, seriesName, observationDate, observationValue, unit, status, comments]
async function fetchSeriesSafe(seriesKey, apiKey, startDate, endDate) {
  try {
    const raw = await fetchSeries(seriesKey, apiKey, startDate, endDate);
    const rows = raw?.rows || [];
    return rows.map(row => ({
      date: row[3],     // Observation Date
      value: row[4],    // Observation Value
      unit: row[5],     // Unit
    }));
  } catch (err) {
    console.log(`    ⚠️  ${seriesKey}: ${err.message}`);
    return [];
  }
}

async function readJson(filename) {
  const raw = await readFile(resolve(DATA_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(filename, data) {
  await writeFile(resolve(DATA_DIR, filename), JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✅ Updated ${filename}`);
}

const getValue = (item) => parseFloat(item?.value || item?.Value || item?.obs_value || 0);
const getDate = (item) => item?.date || item?.Date || item?.period || '';
const toYearMonth = (dateStr) => (dateStr || '').substring(0, 7);
const today = () => new Date().toISOString().split('T')[0];

function fiveYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().split('T')[0];
}

function askQuestion(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// Track results for summary
const results = { updated: [], failed: [], skipped: [] };

function logResult(section, status, detail = '') {
  results[status].push(detail ? `${section}: ${detail}` : section);
}

// ─── Update Functions ───

async function updateRemittances(apiKey) {
  console.log('\n💸 Updating Remittances...');
  const start = fiveYearsAgo(), end = today();

  try {
    const [totalData, usaData, ukData, saudiData, uaeData, otherGccData, euData] = await Promise.all([
      fetchSeriesSafe(SERIES.remittances_total, apiKey, start, end),
      fetchSeriesSafe(SERIES.remit_usa, apiKey, start, end),
      fetchSeriesSafe(SERIES.remit_uk, apiKey, start, end),
      fetchSeriesSafe(SERIES.remit_saudi, apiKey, start, end),
      fetchSeriesSafe(SERIES.remit_uae, apiKey, start, end),
      fetchSeriesSafe(SERIES.remit_other_gcc, apiKey, start, end),
      fetchSeriesSafe(SERIES.remit_eu, apiKey, start, end),
    ]);

    const dateMap = new Map();
    const addSeries = (data, field) => {
      for (const item of data) {
        const date = toYearMonth(getDate(item));
        if (!date) continue;
        if (!dateMap.has(date)) dateMap.set(date, { date, total: 0, saudiArabia: 0, uae: 0, uk: 0, usa: 0, otherGcc: 0, eu: 0 });
        dateMap.get(date)[field] = getValue(item);
      }
    };

    addSeries(totalData, 'total');
    addSeries(usaData, 'usa');
    addSeries(ukData, 'uk');
    addSeries(saudiData, 'saudiArabia');
    addSeries(uaeData, 'uae');
    addSeries(otherGccData, 'otherGcc');
    addSeries(euData, 'eu');

    const monthly = Array.from(dateMap.values()).filter(d => d.total > 0).sort((a, b) => a.date.localeCompare(b.date));
    const last12 = monthly.slice(-12);
    const sourceCountries = [
      { country: 'Saudi Arabia', value: Math.round(last12.reduce((s, d) => s + d.saudiArabia, 0)) },
      { country: 'UAE', value: Math.round(last12.reduce((s, d) => s + d.uae, 0)) },
      { country: 'United Kingdom', value: Math.round(last12.reduce((s, d) => s + d.uk, 0)) },
      { country: 'United States', value: Math.round(last12.reduce((s, d) => s + d.usa, 0)) },
      { country: 'EU Countries', value: Math.round(last12.reduce((s, d) => s + d.eu, 0)) },
      { country: 'Other GCC Countries', value: Math.round(last12.reduce((s, d) => s + d.otherGcc, 0)) },
    ].sort((a, b) => b.value - a.value);

    if (monthly.length > 0) {
      const existing = await readJson('remittances.json').catch(() => ({}));
      await writeJson('remittances.json', { monthly, sourceCountries: sourceCountries.length ? sourceCountries : existing.sourceCountries });
      console.log(`  📊 ${monthly.length} months (${monthly[0].date} → ${monthly.at(-1).date})`);
      logResult('Remittances', 'updated', `${monthly.length} months`);
    } else {
      logResult('Remittances', 'failed', 'No data');
    }
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    logResult('Remittances', 'failed', err.message);
  }
}

async function updateKpiSummary(apiKey) {
  console.log('\n📊 Updating KPI Summary (remittances only)...');

  try {
    const existing = await readJson('kpi-summary.json');
    const indicators = existing.indicators || existing;
    const indicatorList = Array.isArray(indicators) ? indicators : [];

    const remitTotal = await fetchSeriesSafe(SERIES.remittances_total, apiKey, fiveYearsAgo(), today());

    // Only update remittances KPI — other KPIs kept as-is (manual update)
    const kpi = indicatorList.find(i => i.id === 'remittances');
    if (kpi && remitTotal.length >= 2) {
      const latest = getValue(remitTotal.at(-1));
      const prev = getValue(remitTotal.at(-2));
      const change = (latest - prev) / 1000;
      kpi.value = String(Math.round((latest / 1000) * 10) / 10);
      kpi.change = Math.round(change * 10) / 10;
      kpi.period = toYearMonth(getDate(remitTotal.at(-1)));
      const improving = change > 0;
      kpi.trend = Math.abs(change) < 0.5 ? 'stable' : improving ? 'up' : 'down';
    }

    const result = Array.isArray(existing) ? indicatorList : { ...existing, indicators: indicatorList, lastUpdated: today() };
    if (!Array.isArray(existing)) result.lastUpdated = today();
    await writeJson('kpi-summary.json', result);
    logResult('KPI Summary', 'updated', 'remittances KPI');
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    logResult('KPI Summary', 'failed', err.message);
  }
}

// ─── Guided Manual Entry ───

async function manualUpdate() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n📝 Guided Manual Data Entry');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('This helps you add new monthly data points to files');
  console.log('that cannot be fully automated via API.\n');

  const sections = [
    { name: 'Inflation (categories)', file: 'inflation.json', source: 'PBS: https://www.pbs.gov.pk/price-statistics' },
    { name: 'Trade (commodity breakdowns)', file: 'trade.json', source: 'PBS: https://www.pbs.gov.pk/content/external-trade-statistics' },
    { name: 'Fiscal (GDP, deficit, debt)', file: 'fiscal.json', source: 'MoF: https://www.finance.gov.pk' },
    { name: 'FDI (sector/country breakdown)', file: 'fdi.json', source: 'BoI: https://invest.gov.pk' },
    { name: 'Services (IT categories)', file: 'services.json', source: 'PSEB: https://pseb.org.pk' },
  ];

  for (const section of sections) {
    const answer = await askQuestion(rl, `\nUpdate ${section.name}? (y/n) `);
    if (answer.toLowerCase() !== 'y') {
      console.log(`  ⏭  Skipping ${section.name}`);
      continue;
    }

    console.log(`\n  📋 Source: ${section.source}`);
    console.log(`  📁 File: public/data/${section.file}`);

    if (section.file === 'fiscal.json') {
      await manualFiscalEntry(rl);
    } else if (section.file === 'inflation.json') {
      await manualInflationCategories(rl);
    } else {
      console.log(`  💡 Open the file in your editor and add new entries.`);
      console.log(`     The JSON structure is self-documenting — follow the existing pattern.`);
      await askQuestion(rl, `  Press Enter when done...`);
    }
  }

  rl.close();
}

async function manualFiscalEntry(rl) {
  console.log('\n  Add a new fiscal year entry:');
  const year = await askQuestion(rl, '  Fiscal Year (e.g. FY2027): ');
  if (!year) return;

  const gdpGrowth = parseFloat(await askQuestion(rl, '  GDP Growth Rate (%): ') || '0');
  const gdpSize = parseFloat(await askQuestion(rl, '  GDP Size (USD billions): ') || '0');
  const deficit = parseFloat(await askQuestion(rl, '  Fiscal Deficit (% of GDP, enter as negative e.g. -6.5): ') || '0');
  const debtToGdp = parseFloat(await askQuestion(rl, '  Debt-to-GDP Ratio (%): ') || '0');

  if (!gdpSize) {
    console.log('  ⏭  Skipping — no data entered');
    return;
  }

  try {
    const data = await readJson('fiscal.json');
    const existing = data.annual || data;
    const arr = Array.isArray(existing) ? existing : [];

    // Remove existing entry for same year if present
    const filtered = arr.filter(e => e.year !== year);
    filtered.push({ year, gdpGrowth, gdpSize, fiscalDeficit: deficit, debtToGdp });
    filtered.sort((a, b) => a.year.localeCompare(b.year));

    const output = Array.isArray(data) ? filtered : { ...data, annual: filtered };
    await writeJson('fiscal.json', output);
    console.log(`  ✅ Added ${year} fiscal data`);
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
  }
}

async function manualInflationCategories(rl) {
  console.log('\n  Update inflation category breakdown (latest month):');
  const data = await readJson('inflation.json');
  const categories = data.categories || [];

  if (categories.length === 0) {
    console.log('  No existing categories found. Add them manually to the JSON file.');
    return;
  }

  console.log('  Current categories:');
  for (const cat of categories) {
    console.log(`    ${cat.category}: ${cat.rate}%`);
  }

  const update = await askQuestion(rl, '\n  Enter new rates? (y/n) ');
  if (update.toLowerCase() !== 'y') return;

  for (const cat of categories) {
    const newRate = await askQuestion(rl, `  ${cat.category} rate (% YoY, current: ${cat.rate}): `);
    if (newRate) cat.rate = parseFloat(newRate);
  }

  await writeJson('inflation.json', data);
  console.log('  ✅ Inflation categories updated');
}

// ─── Main ───

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  🇵🇰 Pakistan Economic Dashboard — Data Updater   ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const isManual = args.includes('--manual');
  const sectionFilter = args.find((a, i) => args[i - 1] === '--section');

  if (isManual) {
    await manualUpdate();
    return;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    console.log(`
⚠️  No SBP API key found.

To use this script, get a free API key from SBP EasyData:

  1. Register at https://easydata.sbp.org.pk
  2. Go to My Account → API Key → Generate
  3. Create a .env file in the project root:

     SBP_API_KEY=your_api_key_here

  Or pass directly:  SBP_API_KEY=your_key npm run update-data

  For guided manual entry:  npm run update-data -- --manual
`);
    process.exit(1);
  }

  console.log(`\n🔑 API key: ${apiKey.substring(0, 6)}...`);
  console.log(`📅 Range: ${fiveYearsAgo()} → ${today()}`);
  if (sectionFilter) console.log(`🎯 Section: ${sectionFilter}`);

  const updaters = {
    remittances: updateRemittances,
    kpi: updateKpiSummary,
  };

  if (sectionFilter) {
    const fn = updaters[sectionFilter];
    if (!fn) {
      console.error(`\n❌ Unknown section: "${sectionFilter}". Available: ${Object.keys(updaters).join(', ')}`);
      process.exit(1);
    }
    await fn(apiKey);
  } else {
    // Run all updaters
    for (const [, fn] of Object.entries(updaters)) {
      await fn(apiKey);
    }
  }

  // ─── Summary ───
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                  Update Summary                  ║');
  console.log('╚══════════════════════════════════════════════════╝');

  if (results.updated.length > 0) {
    console.log(`\n  ✅ Updated (${results.updated.length}):`);
    for (const r of results.updated) console.log(`     • ${r}`);
  }
  if (results.skipped.length > 0) {
    console.log(`\n  ⏭  Skipped (${results.skipped.length}):`);
    for (const r of results.skipped) console.log(`     • ${r}`);
  }
  if (results.failed.length > 0) {
    console.log(`\n  ❌ Failed (${results.failed.length}):`);
    for (const r of results.failed) console.log(`     • ${r}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📝 The following data must be updated manually:

     • Reserves & Exchange Rates  → SBP website
     • Trade (imports/exports)    → PBS: pbs.gov.pk/content/external-trade-statistics
     • FDI (sector/country)       → BoI: invest.gov.pk
     • IT/Services exports        → PSEB: pseb.org.pk
     • Inflation (CPI)            → PBS: pbs.gov.pk/price-statistics
     • Fiscal (GDP, deficit, debt)→ MoF: finance.gov.pk
     • Defence spending           → SIPRI / MoD

  Run guided manual entry:  npm run update-data -- --manual

  🚀 To redeploy after updates:

     npm run deploy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
