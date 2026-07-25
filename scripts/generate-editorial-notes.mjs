#!/usr/bin/env node
/**
 * Generates public/data/editorial-notes.json.
 *
 * The dashboard used to hardcode narrative claims like "CPI peaked at 38% in
 * May 2023" and "FY2025 was the strongest FDI year since FY2018" directly in
 * JSX. Those claims were unsourced, unverifiable and silently went stale as new
 * data arrived.
 *
 * Every note here is instead COMPUTED from the same canonical JSON the charts
 * render, and carries the source documents behind it. If the underlying data
 * moves, the sentence moves with it — a claim can never contradict the chart
 * printed directly beneath it.
 */

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveSource } from './lib/source-docs.mjs';
import { writeDataFile } from './lib/data-writer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

async function readJson(file) {
  return JSON.parse(await readFile(resolve(DATA_DIR, file), 'utf-8'));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(isoMonth) {
  const [year, month] = String(isoMonth).split('-').map(Number);
  if (!year || !month) return String(isoMonth);
  return `${MONTHS[month - 1]} ${year}`;
}

/**
 * The reserves series mixes month-end observations (YYYY-MM) with true weekly
 * ones (YYYY-MM-DD), so a fixed "week ending …" phrasing would misdescribe half
 * the points.
 */
function pointLabel(date) {
  return /^\d{4}-\d{2}$/.test(String(date)) ? `end-${monthLabel(date)}` : `the week ending ${date}`;
}

function num(value, decimals = 1) {  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function cite(...keys) {
  return keys.map((key) => {
    const source = resolveSource(key);
    return {
      id: source.id,
      institution: source.institution,
      label: source.title,
      url: source.url,
      sourceType: source.sourceType,
    };
  });
}

function note({ text, derivation, sources, asOf }) {
  return { text, basis: 'derived', derivation, sources, asOf };
}

function extremum(rows, valueOf, compare) {
  let best = null;
  for (const row of rows) {
    const value = valueOf(row);
    if (!Number.isFinite(value)) continue;
    if (best === null || compare(value, valueOf(best))) best = row;
  }
  return best;
}

async function buildNotes() {
  const notes = {};

  // ── Inflation ──────────────────────────────────────────────
  const inflation = await readJson('inflation.json');
  const cpi = inflation.national_cpi?.data || [];
  if (cpi.length > 0) {
    const peak = extremum(cpi, (r) => r.value, (a, b) => a > b);
    const latest = cpi[cpi.length - 1];
    notes['inflation.cpiPath'] = note({
      text: `Headline CPI inflation peaked at ${num(peak.value)}% year-on-year in ${monthLabel(peak.date)} and stood at ${num(latest.value)}% in ${monthLabel(latest.date)}. This is the most widely tracked inflation measure in Pakistan.`,
      derivation: `Maximum and latest observation of the national CPI year-on-year series across ${cpi.length} months from ${monthLabel(cpi[0].date)}.`,
      sources: cite('pbs-cpi', 'sbp-easydata'),
      asOf: latest.date,
    });
  }

  // ── Exchange rate ──────────────────────────────────────────
  const exchange = await readJson('exchange-rates.json');
  const usd = (exchange.monthly || []).filter((row) => Number.isFinite(row.USD));
  if (usd.length > 1) {
    const weakest = extremum(usd, (r) => r.USD, (a, b) => a > b);
    const strongest = extremum(
      usd.filter((row) => row.date <= weakest.date),
      (r) => r.USD,
      (a, b) => a < b,
    );
    const latest = usd[usd.length - 1];
    const depreciation = ((weakest.USD - strongest.USD) / weakest.USD) * 100;
    const sinceWeakest = ((weakest.USD - latest.USD) / weakest.USD) * 100;
    notes['exchange-rate.depreciation'] = note({
      text: `The rupee's monthly average moved from ₨${num(strongest.USD, 2)}/USD in ${monthLabel(strongest.date)} to its weakest monthly average of ₨${num(weakest.USD, 2)} in ${monthLabel(weakest.date)} — a ${num(depreciation)}% loss of value against the dollar. It averaged ₨${num(latest.USD, 2)} in ${monthLabel(latest.date)}, ${sinceWeakest >= 0 ? `${num(Math.abs(sinceWeakest))}% stronger than` : `${num(Math.abs(sinceWeakest))}% weaker than`} that low.`,
      derivation: `Strongest and weakest monthly average PKR/USD interbank rates in the published archive from ${monthLabel(usd[0].date)}; depreciation measured as the fall in dollar value of the rupee.`,
      sources: cite('IBF_Arch.xls'),
      asOf: latest.date,
    });
  }

  // ── Reserves ───────────────────────────────────────────────
  const reserves = await readJson('reserves.json');
  const weekly = reserves.weekly || [];
  if (weekly.length > 1) {
    const trough = extremum(weekly, (r) => r.total, (a, b) => a < b);
    const latest = weekly[weekly.length - 1];
    notes['reserves.recovery'] = note({
      text: `Across the published window, total liquid reserves were lowest at $${num(trough.total / 1000, 2)}bn at ${pointLabel(trough.date)} and stood at $${num(latest.total / 1000, 2)}bn at ${pointLabel(latest.date)}, of which $${num(latest.sbp / 1000, 2)}bn is held by the SBP.`,
      derivation: `Minimum and latest total (SBP plus commercial banks) across the ${weekly.length} published observations from ${pointLabel(weekly[0].date)}.`,
      sources: cite('forex.pdf'),
      asOf: latest.date,
    });
  }

  // ── Trade ──────────────────────────────────────────────────
  const trade = await readJson('trade.json');
  const tradeMonthly = trade.monthly || [];
  if (tradeMonthly.length > 1) {
    const widest = extremum(tradeMonthly, (r) => r.balance, (a, b) => a < b);
    const latest = tradeMonthly[tradeMonthly.length - 1];
    notes['trade.deficit'] = note({
      text: `The monthly goods trade deficit was widest at $${num(Math.abs(widest.balance) / 1000, 2)}bn in ${monthLabel(widest.date)}. In ${monthLabel(latest.date)} exports of $${num(latest.exports / 1000, 2)}bn against imports of $${num(latest.imports / 1000, 2)}bn left a deficit of $${num(Math.abs(latest.balance) / 1000, 2)}bn.`,
      derivation: `Largest and latest monthly balance in the SBP balance-of-payments goods series covering ${tradeMonthly.length} months.`,
      sources: cite('exp_import_BOP.xls'),
      asOf: latest.date,
    });
  }

  // ── FDI ────────────────────────────────────────────────────
  const fdi = await readJson('fdi.json');
  const annual = fdi.annual || [];
  if (annual.length > 1) {
    const latest = annual[annual.length - 1];
    const best = extremum(annual, (r) => r.net_fdi, (a, b) => a > b);
    const earlierBetter = annual
      .slice(0, -1)
      .filter((row) => row.net_fdi > latest.net_fdi)
      .map((row) => row.year);
    const ranking = earlierBetter.length === 0
      ? `the strongest year in the published series (from ${annual[0].year})`
      : `below the series peak of $${num(best.net_fdi / 1000, 2)}bn in ${best.year}, and the strongest since ${earlierBetter[earlierBetter.length - 1]}`;
    notes['fdi.annualContext'] = note({
      text: `Net FDI in ${latest.year} was $${num(latest.net_fdi / 1000, 2)}bn ($${num(latest.inflow / 1000, 2)}bn of inflows against $${num(latest.outflow / 1000, 2)}bn of outflows) — ${ranking}.`,
      derivation: `Latest completed fiscal year compared against every other year in the annual net FDI series from ${annual[0].year}.`,
      sources: cite('NetinflowSummary.xls'),
      asOf: latest.year,
    });
  }

  // ── Services / IT ──────────────────────────────────────────
  const services = await readJson('services.json');
  const summary = services.summary;
  const comparison = services.comparison;
  if (summary && comparison?.current && comparison?.prior) {
    const share = (summary.itTelecomCredit / summary.totalServicesCredit) * 100;
    const growth = ((comparison.current.itCredit - comparison.prior.itCredit) / comparison.prior.itCredit) * 100;
    notes['services.itShare'] = note({
      text: `IT & telecom exports of $${num(summary.itTelecomCredit / 1000, 2)}bn in ${summary.period} were ${num(share)}% of all services exports and ${growth >= 0 ? 'up' : 'down'} ${num(Math.abs(growth))}% on ${comparison.period} ${comparison.priorLabel}.`,
      derivation: 'IT & telecom credit as a share of total services credit for the same fiscal-year-to-date window, compared with the same window a year earlier.',
      sources: cite('dt.xls'),
      asOf: summary.period,
    });
  }

  // ── Fiscal ─────────────────────────────────────────────────
  const fiscal = await readJson('fiscal.json');
  const pf = fiscal.publicFinance || {};
  const revenue = pf.total_revenue?.data?.at(-1);
  const expenditure = pf.total_expenditure?.data?.at(-1);
  const primary = pf.primary_balance?.data?.at(-1);
  if (revenue && expenditure && primary && revenue.fy === expenditure.fy && revenue.fy === primary.fy) {
    const coverage = (revenue.value / expenditure.value) * 100;
    notes['fiscal.revenueGap'] = note({
      text: `In ${revenue.fy} total revenue of ₨${num(revenue.value / 1_000_000, 1)}tn covered ${num(coverage)}% of total expenditure of ₨${num(expenditure.value / 1_000_000, 1)}tn, leaving a primary ${primary.value >= 0 ? 'surplus' : 'deficit'} of ₨${num(Math.abs(primary.value) / 1_000_000, 2)}tn. All fiscal figures are for Pakistan's July–June fiscal year.`,
      derivation: 'Total revenue divided by total expenditure for the latest fiscal year in the SBP summary of public finance, with the reported primary balance for the same year.',
      sources: cite('sbp-easydata', 'finance-division'),
      asOf: revenue.fy,
    });
  }

  // ── Debt servicing (replaces the hardcoded "35–40% of revenue") ──
  const budget = await readJson('budget-federal.json');
  const currentYear = budget.years?.[0];
  const markup = currentYear?.currentExpenditure?.find((row) => row.key === 'markup');
  if (currentYear && markup && currentYear.headline?.netRevenue && currentYear.headline?.grossRevenue) {
    const netShare = (markup.value / currentYear.headline.netRevenue) * 100;
    const grossShare = (markup.value / currentYear.headline.grossRevenue) * 100;
    notes['fiscal.debtService'] = note({
      text: `Debt servicing alone is budgeted at ₨${num(markup.value / 1000, 2)}tn in ${currentYear.label} — ${num(grossShare)}% of gross federal revenue and ${num(netShare)}% of the net revenue the federal government actually keeps after transfers to the provinces.`,
      derivation: `Budgeted interest ("markup") payments divided by budgeted gross and net federal revenue, as presented on ${currentYear.presented}.`,
      sources: cite('finance-division'),
      asOf: currentYear.fy,
    });
  }

  return notes;
}

async function main() {
  const notes = await buildNotes();
  await writeDataFile('editorial-notes.json', {
    description: 'Narrative claims shown alongside charts. Every note is computed from the canonical dashboard data files listed in its sources, so no editorial number is hand-typed.',
    dataSource: 'Derived from official SBP, PBS, FBR and Finance Division data',
    notes,
  });
  console.log(`  ✅ editorial-notes.json now carries ${Object.keys(notes).length} sourced claims`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
