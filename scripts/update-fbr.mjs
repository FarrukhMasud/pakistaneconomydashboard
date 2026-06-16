#!/usr/bin/env node

/**
 * Pakistan Economic Dashboard — FBR Tax Collection Updater
 *
 * Refreshes the CLOSED-fiscal-year monthly rows in public/data/fbr-tax.json
 * directly from FBR's official "Month-wise / Tax-wise Net Collection" PDF
 * (download1.fbr.gov.pk). This is the single authoritative, internally
 * consistent source for monthly net collection with the four-way tax-head
 * breakdown (Direct/Income Tax, Sales Tax, FED, Customs).
 *
 * What it does:
 *   1. Downloads each configured FBR month-wise PDF.
 *   2. Parses the monthly table with pdfreader (no fabricated numbers).
 *   3. Replaces the monthly rows for the FYs the PDF covers, while PRESERVING
 *      any provisional current-FY rows (sourced from press releases) and all
 *      curated metadata (fytd, methodologyNote, verifiedFrom, etc.).
 *   4. Upserts the full-year total into fyTotals and recomputes fytd.priorNet
 *      from the freshly parsed rows so growth figures stay exact.
 *
 * If a download or parse fails, the existing data is left untouched (the
 * dashboard never shows partial or guessed figures).
 *
 * Updating for a new fiscal year:
 *   Add an entry to FBR_MONTHWISE_SOURCES below with the new PDF URL once FBR
 *   publishes it. Find the link on
 *   https://www.fbr.gov.pk/fbr-biannual-quarterly-reviews/131167/132077 or the
 *   FBR revenue/statistics downloads section.
 *
 * Usage:
 *   node scripts/update-fbr.mjs
 *   node scripts/update-fbr.mjs --skip-download   # parse an already-downloaded PDF
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PdfReader } from 'pdfreader';

// FBR's TLS chain occasionally trips up Node's verifier.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');
const RAW_DIR = resolve(__dirname, 'sbp-raw');
const FBR_FILE = resolve(DATA_DIR, 'fbr-tax.json');

// Official FBR month-wise / tax-wise net-collection PDFs, one per fiscal year.
// fyStartYear = the calendar year the FY starts in (FY2024-25 starts in 2024).
const FBR_MONTHWISE_SOURCES = [
  {
    fyLabel: 'FY2025',
    fyStartYear: 2024,
    file: 'fbr-monthwise-FY2024-25.pdf',
    url: 'https://download1.fbr.gov.pk/Docs/20261151114844602MONTHWISE-TAXWISENETCOLLECTIONDURINGFY2024-25.pdf',
  },
];

const MONTHS = {
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
};

const num = (s) => {
  const v = parseFloat(String(s).replace(/,/g, ''));
  return Number.isFinite(v) ? v : null;
};

async function downloadPdf(url, file) {
  const dest = resolve(RAW_DIR, file);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error(`response too small (${buf.length} bytes)`);
  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(dest, buf);
  return dest;
}

// Parse the PDF into ordered text lines: [{ text, nums:[...] }, ...]
function parsePdfLines(path) {
  return new Promise((resolvePromise, reject) => {
    let page = 0;
    const rows = {};
    new PdfReader().parseFileItems(path, (err, item) => {
      if (err) return reject(err instanceof Error ? err : new Error(String(err)));
      if (!item) {
        const keys = Object.keys(rows).sort((a, b) => {
          const [pa, ya] = a.split('|').map(Number);
          const [pb, yb] = b.split('|').map(Number);
          return pa - pb || ya - yb;
        });
        const lines = keys.map((k) => {
          const cells = rows[k].sort((c, d) => c.x - d.x);
          const nums = cells.map((c) => num(c.t)).filter((n) => n !== null);
          return { text: cells.map((c) => c.t).join(' ').trim(), nums };
        });
        return resolvePromise(lines);
      }
      if (item.page) { page = item.page; return; }
      if (item.text !== undefined) {
        const key = `${page}|${item.y.toFixed(2)}`;
        (rows[key] ||= []).push({ x: item.x, t: item.text });
      }
    });
  });
}

// Turn parsed lines into monthly rows for a given fiscal year.
function extractMonthly(lines, source) {
  const out = [];
  let fyTotal = null;
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i].text.replace(/[^A-Za-z]/g, '').toUpperCase();
    const next = lines[i + 1];
    if (MONTHS[label] && next && next.nums.length >= 5) {
      const [dt, st, fed, cus, total] = next.nums.slice(0, 5);
      const month = MONTHS[label];
      const year = month >= 7 ? source.fyStartYear : source.fyStartYear + 1;
      const date = `${year}-${String(month).padStart(2, '0')}`;
      out.push({
        date, fy: source.fyLabel,
        net: total,
        incomeTax: dt, salesTax: st, fed, customs: cus,
        provisional: false,
        source: source.url,
      });
    } else if (label === 'TOTAL' && next && next.nums.length >= 5) {
      fyTotal = next.nums.slice(0, 5)[4];
    }
  }
  // Validate: the 12 monthly nets must sum to the printed FY total.
  if (out.length !== 12) throw new Error(`expected 12 months, parsed ${out.length}`);
  const sum = Math.round(out.reduce((s, m) => s + m.net, 0) * 10) / 10;
  if (fyTotal != null && Math.abs(sum - fyTotal) > 0.5) {
    throw new Error(`monthly sum ${sum} != printed total ${fyTotal}`);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { monthly: out, fyTotal: fyTotal ?? sum };
}

// Recompute fytd.priorNet = prior-FY collection over the same Jul..N window.
function recomputePriorNet(fbr) {
  if (!fbr.fytd?.period) return;
  const m = fbr.fytd.period.match(/Jul[–-]([A-Za-z]{3})/);
  if (!m) return;
  const endName = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }[m[1].toUpperCase()];
  if (!endName) return;
  // Prior FY is one year before the fytd FY (e.g. FY2026 -> FY2025).
  const fyNum = parseInt(fbr.fytd.fyLabel.replace(/\D/g, ''), 10);
  const priorFyStart = 2000 + fyNum - 1 - 1; // FY2026 -> 2024
  const months = [];
  for (let mo = 7; mo <= 12; mo++) months.push(`${priorFyStart}-${String(mo).padStart(2, '0')}`);
  for (let mo = 1; mo <= endName; mo++) months.push(`${priorFyStart + 1}-${String(mo).padStart(2, '0')}`);
  const rows = fbr.monthly.filter((r) => months.includes(r.date) && typeof r.net === 'number');
  if (rows.length === months.length) {
    fbr.fytd.priorNet = Math.round(rows.reduce((s, r) => s + r.net, 0) * 10) / 10;
  }
}

async function main() {
  const skipDownload = process.argv.includes('--skip-download');
  console.log('\n🧾 Updating FBR tax collection from official month-wise PDFs...');

  const fbr = JSON.parse(await readFile(FBR_FILE, 'utf-8'));
  let updated = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const source of FBR_MONTHWISE_SOURCES) {
    try {
      let path = resolve(RAW_DIR, source.file);
      if (!skipDownload || !existsSync(path)) {
        path = await downloadPdf(source.url, source.file);
        console.log(`  ✅ Downloaded ${source.fyLabel} (${source.file})`);
      }
      const lines = await parsePdfLines(path);
      const { monthly, fyTotal } = extractMonthly(lines, source);

      // Replace this FY's monthly rows; keep all other rows (provisional current FY).
      fbr.monthly = fbr.monthly.filter((r) => r.fy !== source.fyLabel).concat(monthly);

      // Upsert the full-year total.
      fbr.fyTotals ||= [];
      const existing = fbr.fyTotals.find((t) => t.fy === source.fyLabel);
      if (existing) { existing.net = fyTotal; existing.source = source.url; existing.provisional = false; }
      else fbr.fyTotals.push({ fy: source.fyLabel, net: fyTotal, provisional: false, source: source.url });

      console.log(`  📊 ${source.fyLabel}: 12 months parsed, FY total ₨${fyTotal.toLocaleString()}bn`);
      updated++;
    } catch (err) {
      console.log(`  ⚠️  ${source.fyLabel}: ${err.message} — keeping existing data`);
    }
  }

  if (updated === 0) {
    console.log('  ⏭  No FBR PDFs updated; fbr-tax.json left unchanged.');
    return;
  }

  fbr.monthly.sort((a, b) => a.date.localeCompare(b.date));
  fbr.fyTotals?.sort((a, b) => a.fy.localeCompare(b.fy));
  recomputePriorNet(fbr);
  fbr.lastUpdated = today;
  fbr.lastVerified = today;

  await writeFile(FBR_FILE, JSON.stringify(fbr, null, 2) + '\n');
  console.log(`  ✅ Updated fbr-tax.json from ${updated} official source(s).`);
  console.log('  ℹ️  Current-FY provisional months + fytd remain curated from FBR press releases.');
}

main().catch((err) => {
  console.error(`\n❌ FBR update failed: ${err.message}`);
  process.exit(1);
});
