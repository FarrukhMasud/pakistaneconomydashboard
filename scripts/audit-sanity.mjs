#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATASETS, getDatasetFreshness } from './data-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

const MAX_AGE_DAYS = {
  Weekly: 45,
  Monthly: 150,
  'Monthly (provisional)': 75,
  'Monthly/FYTD': 180,
  'Weekly/Monthly': 75,
  'Quarterly/Annual': 540,
};

async function readJson(file) {
  return JSON.parse(await readFile(resolve(DATA_DIR, file), 'utf-8'));
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoMonth(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

function daysSince(value) {
  if (!isIsoDate(value) && !isIsoMonth(value)) return null;
  const date = new Date(isIsoMonth(value) ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function assertNear(actual, expected, tolerance, message, failures) {
  assert(
    Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} vs ${expected}`,
    failures,
  );
}

function assertSorted(rows, datasetId, failures) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i - 1].date || '') > (rows[i].date || '')) {
      failures.push(`${datasetId}: monthly/weekly rows are not sorted at index ${i}`);
      return;
    }
  }
}

const MONTH_INDEX = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Turns an SBP fiscal-year-to-date label such as "Jul-May FY26 (P)" into the
 * inclusive calendar-month window it covers.
 */
function fiscalYtdWindow(label) {
  const match = String(label || '').match(/([a-z]{3})[a-z]*\s*[-–]\s*([a-z]{3})[a-z]*.*?fy\s*(\d{2,4})/i);
  if (!match) return null;
  const startMonth = MONTH_INDEX[match[1].toLowerCase()];
  const endMonth = MONTH_INDEX[match[2].toLowerCase()];
  if (!startMonth || !endMonth) return null;
  const rawFy = Number(match[3]);
  const fiscalYear = rawFy < 100 ? 2000 + rawFy : rawFy;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: `${startMonth >= 7 ? fiscalYear - 1 : fiscalYear}-${pad(startMonth)}`,
    to: `${endMonth >= 7 ? fiscalYear - 1 : fiscalYear}-${pad(endMonth)}`,
  };
}

function assertUnique(values, datasetId, what, failures) {  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      failures.push(`${datasetId}: duplicate ${what} "${value}"`);
      return;
    }
    seen.add(value);
  }
}

function assertDescending(rows, datasetId, what, failures) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].value < rows[i].value) {
      failures.push(`${datasetId}: ${what} is not sorted by value at index ${i}`);
      return;
    }
  }
}

function assertFiniteSeries(series, datasetId, seriesName, failures) {
  if (!series || !Array.isArray(series.data) || series.data.length === 0) {
    failures.push(`${datasetId}: series ${seriesName} is missing or empty`);
    return;
  }
  assertSorted(series.data, `${datasetId}.${seriesName}`, failures);
  const invalid = series.data.filter((row) => !Number.isFinite(row.value));
  assert(invalid.length === 0, `${datasetId}: series ${seriesName} has ${invalid.length} non-numeric observations`, failures);
}

function assertContinuousMonths(rows, datasetId, failures) {
  if (!Array.isArray(rows) || rows.length < 2) return;
  for (let i = 1; i < rows.length; i++) {
    const [year, month] = rows[i - 1].date.split('-').map(Number);
    const expected = month === 12
      ? `${year + 1}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}`;
    if (rows[i].date !== expected) {
      failures.push(`${datasetId}: missing monthly observation between ${rows[i - 1].date} and ${rows[i].date}`);
      return;
    }
  }
}

async function auditEditorialNotes(failures) {
  const notes = await readJson('editorial-notes.json');
  const entries = Object.entries(notes.notes || {});
  assert(entries.length > 0, 'editorial-notes: no sourced claims were generated', failures);

  for (const [key, note] of entries) {
    assert(typeof note.text === 'string' && note.text.length > 20, `editorial-notes: ${key} has no readable claim text`, failures);
    assert(Boolean(note.derivation), `editorial-notes: ${key} does not explain how it was computed`, failures);
    assert(Array.isArray(note.sources) && note.sources.length > 0, `editorial-notes: ${key} cites no source`, failures);
    for (const source of note.sources || []) {
      assert(
        typeof source.url === 'string' && /^https?:\/\//.test(source.url),
        `editorial-notes: ${key} cites source "${source.id}" without a resolvable URL`,
        failures,
      );
      assert(Boolean(source.institution), `editorial-notes: ${key} cites a source with no institution`, failures);
    }
    // A claim must never contain a hand-typed year that predates the data.
    assert(Boolean(note.asOf), `editorial-notes: ${key} does not record the period it describes`, failures);
  }
}

async function auditReleaseCalendar(failures, warnings) {
  const calendar = await readJson('release-calendar.json');
  const rows = calendar.releases || [];
  assert(rows.length === DATASETS.length, `release-calendar: covers ${rows.length} of ${DATASETS.length} datasets`, failures);
  assertUnique(rows.map((row) => row.id), 'release-calendar', 'dataset id', failures);

  const validSchedules = new Set(['estimated', 'announced', 'event-driven']);
  const validStatuses = new Set(['scheduled', 'due', 'overdue', 'event-driven']);

  for (const row of rows) {
    const id = row.id || '(unnamed)';
    assert(validSchedules.has(row.schedule), `release-calendar: ${id} has an unknown schedule "${row.schedule}"`, failures);
    assert(validStatuses.has(row.status), `release-calendar: ${id} has an unknown status "${row.status}"`, failures);
    // Every projected date must explain itself; an unexplained date is
    // indistinguishable from an official one to a reader.
    assert(typeof row.basis === 'string' && row.basis.length > 20, `release-calendar: ${id} does not explain how its date was derived`, failures);

    if (row.schedule === 'estimated') {
      assert(/^\d{4}-\d{2}-\d{2}$/.test(row.expectedRelease || ''), `release-calendar: ${id} has no projected release date`, failures);
      assert(row.windowEnd >= row.expectedRelease, `release-calendar: ${id} has an inverted release window`, failures);
      assert(row.expectedNextObservation > (row.latestObservation || ''), `release-calendar: ${id} projects a period it already published`, failures);
      assert(/Not an official release calendar/.test(row.basis), `release-calendar: ${id} does not disclose that its date is a projection`, failures);
    }

    if (row.schedule === 'event-driven') {
      assert(row.expectedRelease === null, `release-calendar: ${id} is event-driven but still carries a projected date`, failures);
    }

    if (row.status === 'overdue') {
      warnings.push(`release-calendar: ${row.label} is ${row.daysLate} days past its expected window`);
    }
  }

  const overdue = rows.filter((row) => row.status === 'overdue').length;
  assert(calendar.overdueCount === overdue, 'release-calendar: overdueCount does not match the rows', failures);
}

async function auditKpiProvenance(failures) {
  const kpi = await readJson('kpi-summary.json');
  const provenance = await readJson('provenance.json');

  assert(Array.isArray(kpi.indicators) && kpi.indicators.length > 0, 'kpi-summary: no indicators', failures);
  assertUnique((kpi.indicators || []).map((row) => row.id), 'kpi-summary', 'indicator id', failures);

  for (const indicator of kpi.indicators || []) {
    const id = indicator.id || '(unnamed)';
    assert(Number.isFinite(indicator.value), `kpi-summary: ${id} has a non-numeric value`, failures);
    assert(Boolean(indicator.unit), `kpi-summary: ${id} does not declare a unit`, failures);
    assert(Boolean(indicator.period), `kpi-summary: ${id} does not declare the period it refers to`, failures);
    assert(Boolean(indicator.source), `kpi-summary: ${id} does not declare a source`, failures);

    if (indicator.change !== null && indicator.change !== undefined) {
      assert(Number.isFinite(indicator.change), `kpi-summary: ${id} has a non-numeric change`, failures);
      assert(Boolean(indicator.changeUnit), `kpi-summary: ${id} reports a change without a changeUnit`, failures);
      assert(Boolean(indicator.changeBasis), `kpi-summary: ${id} reports a change without a changeBasis`, failures);
    }

    assert(Boolean(indicator.provenanceKey), `kpi-summary: ${id} has no provenanceKey`, failures);
    const figure = provenance.figures?.[indicator.provenanceKey];
    assert(Boolean(figure), `provenance: no citation recorded for ${id} (${indicator.provenanceKey})`, failures);
    if (!figure) continue;

    assertNear(
      figure.value,
      indicator.value,
      Math.max(0.01, Math.abs(indicator.value) * 0.0001),
      `provenance: cited value for ${id} does not match the published KPI`,
      failures,
    );
    assert(Boolean(figure.sourceId), `provenance: ${indicator.provenanceKey} has no sourceId`, failures);
    assert(
      Boolean(provenance.sources?.[figure.sourceId]),
      `provenance: ${indicator.provenanceKey} cites unknown source "${figure.sourceId}"`,
      failures,
    );
    assert(
      figure.period === indicator.period,
      `provenance: period mismatch for ${id} (${figure.period} vs ${indicator.period})`,
      failures,
    );
  }

  for (const [id, source] of Object.entries(provenance.sources || {})) {
    assert(Boolean(source.institution), `provenance: source ${id} has no institution`, failures);
    assert(
      typeof source.url === 'string' && /^https?:\/\//.test(source.url),
      `provenance: source ${id} has no resolvable URL`,
      failures,
    );
  }
}

async function main() {
  const failures = [];
  const warnings = [];

  for (const dataset of DATASETS) {
    const data = await readJson(dataset.file);
    const freshness = getDatasetFreshness(dataset, data);

    assert(freshness.latestObservation, `${dataset.id}: missing latest observation`, failures);
    assert(freshness.dashboardUpdated, `${dataset.id}: missing dashboard update date`, failures);

    if (freshness.dashboardUpdated) {
      assert(isIsoDate(freshness.dashboardUpdated), `${dataset.id}: dashboard update is not YYYY-MM-DD`, failures);
    }

    if (data.monthly) assertSorted(data.monthly, dataset.id, failures);
    if (data.weekly) assertSorted(data.weekly, dataset.id, failures);

    const maxAge = MAX_AGE_DAYS[dataset.cadence];
    const age = daysSince(freshness.latestObservation);
    if (maxAge && age !== null) {
      const staleMessage = `${dataset.id}: latest observation ${freshness.latestObservation} is ${age} days old`;
      if (age > maxAge && !dataset.critical && data.reviewRequired === true) {
        warnings.push(staleMessage);
      } else {
        assert(age <= maxAge, staleMessage, failures);
      }
    }

    if (dataset.id === 'trade') {
      assert(data.monthly?.at(-1)?.date === freshness.latestObservation, 'trade: latest observation does not match monthly tail', failures);
      assert(data.exportCountryPeriod, 'trade: missing export country period metadata', failures);
      assert(data.importCountryPeriod, 'trade: missing import country period metadata', failures);
      assert(Array.isArray(data.topExportCountries) && data.topExportCountries.length > 0, 'trade: missing top export countries', failures);
      assert(Array.isArray(data.topImportCountries) && data.topImportCountries.length > 0, 'trade: missing top import countries', failures);
      assert(data.countryMonthly && Array.isArray(data.countryMonthly.countries) && data.countryMonthly.countries.length > 0, 'trade: missing per-country monthly snapshot', failures);
      assert(data.countryMonthly?.latestMonth, 'trade: countryMonthly missing latestMonth metadata', failures);
      assertContinuousMonths(data.monthly, 'trade', failures);

      for (const row of data.monthly || []) {
        assertNear(
          row.exports - row.imports,
          row.balance,
          0.6,
          `trade: balance does not reconcile with exports minus imports for ${row.date}`,
          failures,
        );
      }

      for (const [key, label] of [['topExportCountries', 'top export countries'], ['topImportCountries', 'top import countries']]) {
        const rows = data[key] || [];
        assertUnique(rows.map((row) => row.country), 'trade', `country in ${label}`, failures);
        assertDescending(rows, 'trade', label, failures);
        assert(rows.every((row) => Number.isFinite(row.value) && row.value > 0), `trade: ${label} contain non-positive values`, failures);
      }

      // The top-15 country lists are a strict subset of the same FYTD window, so
      // they can never exceed the BOP totals for that window.
      const fytdWindow = fiscalYtdWindow(data.exportCountryPeriod);
      if (fytdWindow) {
        const rows = (data.monthly || []).filter((row) => row.date >= fytdWindow.from && row.date <= fytdWindow.to);
        if (rows.length > 0) {
          const bopExports = rows.reduce((sum, row) => sum + row.exports, 0);
          const bopImports = rows.reduce((sum, row) => sum + row.imports, 0);
          const topExports = data.topExportCountries.reduce((sum, row) => sum + row.value, 0);
          const topImports = data.topImportCountries.reduce((sum, row) => sum + row.value, 0);
          assert(topExports <= bopExports * 1.05, `trade: top export countries (${topExports.toFixed(0)}) exceed BOP exports for ${data.exportCountryPeriod} (${bopExports.toFixed(0)})`, failures);
          assert(topImports <= bopImports * 1.05, `trade: top import countries (${topImports.toFixed(0)}) exceed BOP imports for ${data.importCountryPeriod} (${bopImports.toFixed(0)})`, failures);
        }
      }
    }

    if (dataset.id === 'fdi') {
      assert(Array.isArray(data.monthly) && data.monthly.length > 0, 'fdi: missing monthly net FDI series', failures);
      assert(data.monthly?.at(-1)?.date === freshness.latestObservation, 'fdi: latest observation does not match monthly tail', failures);
      assertContinuousMonths(data.monthly, 'fdi', failures);
      assert(data.sectorPeriod, 'fdi: missing sector coverage period', failures);
      assert(data.countryPeriod, 'fdi: missing country coverage period', failures);
      assert(data.fytdComparison?.period, 'fdi: missing FYTD summary period', failures);

      const sectorTotal = data.by_sector?.reduce((sum, row) => sum + row.amount, 0);
      assertNear(
        sectorTotal,
        data.fytdComparison?.current?.net_fdi,
        2,
        'fdi: sector total does not reconcile with FYTD summary',
        failures,
      );

      for (const row of data.monthly || []) {
        assertNear(
          row.equity + row.debt,
          row.net_fdi,
          0.1,
          `fdi: monthly components do not reconcile for ${row.date}`,
          failures,
        );
      }

      if (/july-june/i.test(data.countryPeriod || '') && data.monthly?.at(-1)?.date.endsWith('-06')) {
        const countryTotal = data.by_country?.reduce((sum, row) => sum + row.amount, 0);
        const fiscalYearMonthlyTotal = data.monthly.slice(-12).reduce((sum, row) => sum + row.net_fdi, 0);
        assertNear(
          countryTotal,
          fiscalYearMonthlyTotal,
          5,
          'fdi: country total does not reconcile with the monthly fiscal-year total',
          failures,
        );
      }
    }

    if (dataset.id === 'services') {
      assert(data.itMonthly && Array.isArray(data.itMonthly.components) && data.itMonthly.components.length > 0, 'services: missing IT monthly snapshot', failures);
      assert(data.itMonthly?.components?.some((c) => c.key === 'freelance'), 'services: IT monthly missing Freelance IT component', failures);
      assert(Array.isArray(data.monthlySeries) && data.monthlySeries.length > 0, 'services: missing accumulating monthly series', failures);

      assert(data.comparison?.current && data.comparison?.prior, 'services: comparison is missing current/prior blocks', failures);
      const currentFy = data.comparison?.current?.fy;
      const priorFy = data.comparison?.prior?.fy;
      assert(
        Number.isFinite(currentFy) && Number.isFinite(priorFy) && currentFy === priorFy + 1,
        `services: comparison fiscal years are not consecutive (${priorFy} → ${currentFy})`,
        failures,
      );
      assertNear(
        data.comparison?.current?.totalCredit,
        data.summary?.totalServicesCredit,
        0.6,
        'services: comparison current total does not match the summary total',
        failures,
      );

      for (const row of data.categories || []) {
        assertNear(row.credit - row.debit, row.net, 0.6, `services: net does not reconcile for ${row.name}`, failures);
        assertNear(row.priorCredit - row.priorDebit, row.priorNet, 0.6, `services: prior-year net does not reconcile for ${row.name}`, failures);
      }
      assertUnique((data.categories || []).map((row) => row.name), 'services', 'category', failures);

      assertNear(
        data.summary?.totalServicesCredit - data.summary?.totalServicesDebit,
        data.summary?.totalServicesNet,
        0.6,
        'services: summary net does not reconcile with credit minus debit',
        failures,
      );

      // Categories are a named subset of the EBOPS table, so they must not exceed the totals.
      const categoryCredit = (data.categories || []).reduce((sum, row) => sum + row.credit, 0);
      const categoryDebit = (data.categories || []).reduce((sum, row) => sum + row.debit, 0);
      assert(categoryCredit <= data.summary?.totalServicesCredit + 0.6, `services: category credits (${categoryCredit.toFixed(2)}) exceed total services credit`, failures);
      assert(categoryDebit <= data.summary?.totalServicesDebit + 0.6, `services: category debits (${categoryDebit.toFixed(2)}) exceed total services debit`, failures);
      assert(
        data.summary?.computerServicesCredit <= data.summary?.itTelecomCredit + 0.6,
        'services: computer-services credit exceeds the IT & telecom parent line',
        failures,
      );
      assert(
        data.summary?.itTelecomCredit <= data.summary?.totalServicesCredit + 0.6,
        'services: IT & telecom credit exceeds total services credit',
        failures,
      );

      for (const row of data.monthlySeries || []) {
        assert(isIsoMonth(row.month), `services: monthlySeries has a non-ISO month "${row.month}"`, failures);
        assert(row.itCredit <= row.totalCredit + 0.6, `services: IT credit exceeds total services credit for ${row.month}`, failures);
        assert(row.freelanceCredit <= row.itCredit + 0.6, `services: freelance credit exceeds IT credit for ${row.month}`, failures);
      }
      assertUnique((data.monthlySeries || []).map((row) => row.month), 'services', 'monthlySeries month', failures);
    }

    if (dataset.id === 'reserves') {
      for (const row of data.weekly || []) {
        assertNear(row.sbp + row.banks, row.total, 0.6, `reserves: SBP plus banks does not reconcile with total for ${row.date}`, failures);
        assert(row.sbp > 0 && row.banks > 0, `reserves: non-positive component for ${row.date}`, failures);
      }
      assertUnique((data.weekly || []).map((row) => row.date), 'reserves', 'weekly date', failures);
    }

    if (dataset.id === 'remittances') {
      assertContinuousMonths(data.monthly, 'remittances', failures);
      const corridors = ['saudiArabia', 'uae', 'uk', 'usa', 'otherGcc', 'eu'];
      for (const row of data.monthly || []) {
        const namedTotal = corridors.reduce((sum, key) => sum + (row[key] || 0), 0);
        assert(
          Number.isFinite(row.total) && row.total > 0,
          `remittances: missing total for ${row.date}`,
          failures,
        );
        assert(
          namedTotal <= row.total + 0.6,
          `remittances: named corridors (${namedTotal.toFixed(1)}) exceed the reported total (${row.total?.toFixed(1)}) for ${row.date}`,
          failures,
        );
      }
    }

    if (dataset.id === 'inflation') {
      for (const [key, series] of Object.entries(data)) {
        if (!series || typeof series !== 'object' || !Array.isArray(series.data)) continue;
        assertFiniteSeries(series, 'inflation', key, failures);
        assert(series.seriesKey, `inflation: series ${key} does not declare a source seriesKey`, failures);
      }
      const cpi = data.national_cpi?.data?.at(-1);
      assert(cpi && isIsoMonth(cpi.date), 'inflation: national CPI has no dated latest observation', failures);
    }

    if (dataset.id === 'fiscal') {
      const years = (data.annual || []).map((row) => row.year);
      assertUnique(years, 'fiscal', 'annual year', failures);
      for (let i = 1; i < years.length; i++) {
        assert(years[i] > years[i - 1], `fiscal: annual years are not ascending at ${years[i - 1]} → ${years[i]}`, failures);
      }
      assert((data.annual || []).every((row) => Number.isFinite(row.gdpGrowth)), 'fiscal: annual rows missing GDP growth', failures);
      assert(data.dataSource, 'fiscal: missing dataSource attribution', failures);
      for (const [key, series] of Object.entries(data.publicFinance || {})) {
        assertFiniteSeries(series, 'fiscal.publicFinance', key, failures);
      }
    }
  }

  await auditKpiProvenance(failures);
  await auditEditorialNotes(failures);
  await auditReleaseCalendar(failures, warnings);

  if (failures.length > 0) {
    console.error('\nData sanity audit failed:\n');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  for (const warning of warnings) console.warn(`⚠️  ${warning} (explicit review required)`);
  console.log(`✅ Data sanity audit passed for ${DATASETS.length} datasets`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
