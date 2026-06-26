#!/usr/bin/env node

import { mkdir, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');
const OUT_FILE = resolve(DATA_DIR, 'peer-comparison.json');

const COUNTRIES = [
  { code: 'PAK', name: 'Pakistan' },
  { code: 'IND', name: 'India' },
  { code: 'BGD', name: 'Bangladesh' },
  { code: 'LKA', name: 'Sri Lanka' },
  { code: 'EGY', name: 'Egypt' },
  { code: 'TUR', name: 'Türkiye' },
  { code: 'VNM', name: 'Vietnam' },
];

const INDICATORS = [
  {
    id: 'gdp-growth',
    label: 'GDP growth',
    code: 'NY.GDP.MKTP.KD.ZG',
    unit: '%',
    higherIsGood: true,
    whyItMatters: 'Shows how quickly real output is expanding after inflation.',
  },
  {
    id: 'inflation',
    label: 'Inflation',
    code: 'FP.CPI.TOTL.ZG',
    unit: '%',
    higherIsGood: false,
    whyItMatters: 'High inflation erodes purchasing power and often forces tighter monetary policy.',
  },
  {
    id: 'exports-gdp',
    label: 'Exports of goods & services',
    code: 'NE.EXP.GNFS.ZS',
    unit: '% of GDP',
    higherIsGood: true,
    whyItMatters: 'Export intensity is a proxy for foreign-exchange earning capacity.',
  },
  {
    id: 'reserves-imports',
    label: 'Total reserves',
    code: 'FI.RES.TOTL.MO',
    unit: 'months of imports',
    higherIsGood: true,
    whyItMatters: 'Import-cover months indicate the external buffer available during FX stress.',
  },
  {
    id: 'current-account',
    label: 'Current account balance',
    code: 'BN.CAB.XOKA.GD.ZS',
    unit: '% of GDP',
    higherIsGood: true,
    whyItMatters: 'Persistent deficits increase dependence on financing and rollovers.',
  },
  {
    id: 'tax-revenue',
    label: 'Tax revenue',
    code: 'GC.TAX.TOTL.GD.ZS',
    unit: '% of GDP',
    higherIsGood: true,
    whyItMatters: 'Tax-to-GDP indicates the state capacity available to fund services and debt costs.',
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchWorldBankIndicator(indicator) {
  const countryCodes = COUNTRIES.map((c) => c.code).join(';');
  const url = `https://api.worldbank.org/v2/country/${countryCodes}/indicator/${indicator.code}?format=json&per_page=20000`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'pakistan-economic-dashboard/1.0' },
  });
  if (!res.ok) throw new Error(`${indicator.code}: World Bank HTTP ${res.status}`);

  const payload = await res.json();
  const rows = payload?.[1];
  if (!Array.isArray(rows)) throw new Error(`${indicator.code}: unexpected World Bank response`);

  const latestByCountry = new Map();
  for (const row of rows) {
    if (row.value == null) continue;
    const countryCode = row.countryiso3code;
    const year = Number(row.date);
    const existing = latestByCountry.get(countryCode);
    if (!existing || year > existing.year) {
      latestByCountry.set(countryCode, {
        countryCode,
        countryName: COUNTRIES.find((c) => c.code === countryCode)?.name || row.country?.value,
        year,
        value: Number(row.value.toFixed(2)),
      });
    }
  }

  return {
    ...indicator,
    sourceUrl: `https://api.worldbank.org/v2/country/${countryCodes}/indicator/${indicator.code}`,
    values: COUNTRIES.map((country) => latestByCountry.get(country.code) || {
      countryCode: country.code,
      countryName: country.name,
      year: null,
      value: null,
    }),
  };
}

async function main() {
  console.log('\n🌐 Updating official World Bank peer-comparison data...');
  const indicators = [];
  for (const indicator of INDICATORS) {
    const data = await fetchWorldBankIndicator(indicator);
    indicators.push(data);
    const years = data.values.map((v) => v.year).filter(Boolean);
    console.log(`  ✅ ${indicator.label}: ${Math.min(...years)}–${Math.max(...years)}`);
  }

  const latestYears = indicators.flatMap((indicator) => indicator.values.map((v) => v.year).filter(Boolean));
  const out = {
    dataSource: 'World Bank Open Data API (official WDI indicators)',
    sourceUrl: 'https://data.worldbank.org',
    lastUpdated: todayIso(),
    latestObservation: String(Math.max(...latestYears)),
    countries: COUNTRIES,
    indicators,
    methodologyNote: 'Peer comparison values are the latest non-null annual World Development Indicators observation available for each country and indicator. Years can differ by country because official annual data is released at different times.',
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`  ✅ Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('\n❌ Peer comparison update failed:', err.message);
  process.exit(1);
});
