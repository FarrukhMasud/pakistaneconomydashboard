/**
 * Pure header/row resolvers for the SBP workbooks.
 *
 * These are deliberately kept free of file I/O so they can be exercised
 * directly against captured header fixtures - including synthetic "next fiscal
 * year" fixtures that prove the parsers keep working after SBP rolls over to a
 * new FY. Every resolver either returns a fully resolved answer or throws;
 * none of them fall back to a guessed column index.
 */

import { SheetParseError, parseFiscalYear, latestFiscalYear, requireColumn } from './sheet-utils.mjs';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Convert a "month name + fiscal year" pair to a calendar YYYY-MM string.
 * Pakistan fiscal year FYxx runs Jul (xx-1) to Jun (xx).
 */
export function fyMonthToYearMonth(monthName, fy) {
  const idx = MONTH_NAMES.findIndex((m) => new RegExp(`^${m}`, 'i').test(String(monthName)));
  const fullFy = parseFiscalYear(fy);
  if (idx < 0 || !fullFy) return null;
  const monthNum = idx + 1;
  const calYear = monthNum >= 7 ? fullFy - 1 : fullFy;
  return `${calYear}-${String(monthNum).padStart(2, '0')}`;
}

/**
 * SBP by-country export/import sheets: row 4 holds period labels (possibly
 * merged), row 5 holds the fiscal year. Classify which physical column holds
 * the latest provisional month, the prior revised month, the year-ago month and
 * the fiscal-year-to-date totals for the current and prior fiscal years.
 */
export function classifyCountryColumns(rows) {
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

  const maxFull = latestFiscalYear(r5);
  if (maxFull === null) {
    throw new SheetParseError('No fiscal year found in by-country header row 5', {
      headerRow: r5.map((v) => (v == null ? '' : String(v))).join('|'),
    });
  }
  const curFY = maxFull % 100;
  const priorFY = curFY - 1;

  const cols = { curFY, priorFY, curFullFY: maxFull };
  for (let c = 1; c < maxc; c++) {
    const p4 = periods[c] || '';
    const f5 = (r5[c] || '').toString().trim();
    const fy = parseFiscalYear(f5);
    if (fy === null) continue;
    const fy2 = fy % 100;

    // Skip full fiscal-year (annual) columns - "Jul-Jun".
    if (/jul\s*-\s*jun/i.test(p4)) continue;

    const isFytd = /jul\s*-/i.test(p4);
    const isProv = /\(\s*P\s*\)/i.test(p4) || /\(\s*P\s*\)/i.test(f5);
    const isRev = /\(\s*R\s*\)/i.test(p4);
    const monthMatch = p4.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);

    if (isFytd) {
      if (fy2 === curFY && cols.fytdCur === undefined) {
        cols.fytdCur = c;
        cols.fytdLabel = p4.replace(/\s*\(.*$/, '').trim();
      } else if (fy2 === priorFY && cols.fytdPrior === undefined) {
        cols.fytdPrior = c;
      }
    } else if (monthMatch) {
      const monthName = monthMatch[1];
      if (isProv && fy2 === curFY && cols.latest === undefined) {
        cols.latest = c;
        cols.latestMonth = fyMonthToYearMonth(monthName, fy2);
      } else if (isRev && fy2 === curFY && cols.prev === undefined) {
        cols.prev = c;
        cols.prevMonth = fyMonthToYearMonth(monthName, fy2);
      } else if (fy2 === priorFY && cols.yearAgo === undefined) {
        cols.yearAgo = c;
        cols.yearAgoMonth = fyMonthToYearMonth(monthName, fy2);
      }
    }
  }
  return cols;
}

/**
 * Foreign_Dir.xls / BS_M: header row 2 carries "July-May FY26 (P)" style labels
 * over [Inflow, Outflow, Net FDI] triplets.
 */
export function resolveFdiSectorColumns(headerRow, context = {}) {
  const hdr = headerRow || [];
  const maxFy = latestFiscalYear(hdr);
  if (maxFy === null) {
    throw new SheetParseError('No fiscal year found in FDI sector header row', {
      ...context,
      headerRow: hdr.filter(Boolean).join(' | '),
    });
  }

  let current = null;
  let prior = null;
  for (let c = 0; c < hdr.length; c++) {
    const h = (hdr[c] || '').toString().trim();
    if (!/^july/i.test(h)) continue;
    const fy = parseFiscalYear(h);
    if (fy === null) continue;
    const group = {
      inflow: c,
      outflow: c + 1,
      net: c + 2,
      period: h.replace(/\s*\(P\)\s*/i, '').trim(),
      fiscalYear: fy,
      status: /\(\s*P\s*\)/i.test(h) ? 'provisional' : 'final',
    };
    if (fy === maxFy && !current) current = group;
    else if (fy === maxFy - 1 && !prior) prior = group;
  }

  requireColumn(current?.net, { ...context, want: `current FYTD (FY${maxFy}) net FDI column`, headerRow: hdr.filter(Boolean).join(' | ') });
  requireColumn(prior?.net, { ...context, want: `prior FYTD (FY${maxFy - 1}) net FDI column`, headerRow: hdr.filter(Boolean).join(' | ') });
  return { current, prior, fiscalYear: maxFy };
}

/**
 * Netinflow.xls / Country: row 3 = period block, row 4 = instrument
 * (FDI / FPI / Total), row 5 = FDI sub-column (Inflow / Outflow / Net).
 */
export function resolveFdiCountryColumns(hdr3 = [], hdr4 = [], hdr5 = [], context = {}) {
  const maxFy = latestFiscalYear(hdr3);
  if (maxFy === null) {
    throw new SheetParseError('No fiscal year found in FDI country header row', {
      ...context,
      headerRow: hdr3.filter(Boolean).join(' | '),
    });
  }

  const findNetSubCol = (start) => {
    const limit = Math.max(hdr4.length, hdr5.length);
    for (let sc = start; sc < start + 6 && sc < limit; sc++) {
      if (/^net(\s*fdi)?$/i.test((hdr5[sc] || '').toString().trim())) return sc;
      if (/^net(\s*fdi)?$/i.test((hdr4[sc] || '').toString().trim())) return sc;
    }
    return -1;
  };

  let current = null;
  let prior = null;
  for (let c = 2; c < hdr3.length; c++) {
    const h3 = (hdr3[c] || '').toString().trim();
    if (!/^july/i.test(h3)) continue;
    const fy = parseFiscalYear(h3);
    if (fy === null) continue;
    const group = {
      net: findNetSubCol(c),
      period: h3.replace(/\s*\(P\)\s*/i, '').trim(),
      fiscalYear: fy,
      status: /\(\s*P\s*\)/i.test(h3) ? 'provisional' : 'final',
    };
    if (fy === maxFy && !current) current = group;
    else if (fy === maxFy - 1 && !prior) prior = group;
  }

  const ctx = { ...context, headerRow: hdr3.filter(Boolean).join(' | ') };
  requireColumn(current?.net, { ...ctx, want: `current FYTD (FY${maxFy}) net FDI column` });
  requireColumn(prior?.net, { ...ctx, want: `prior FYTD (FY${maxFy - 1}) net FDI column` });
  return { current, prior, fiscalYear: maxFy };
}

/**
 * dt.xls / EBOPS: header row 6 carries named months ("Apr-26 (R)") and
 * cumulative periods ("Jul-May, FY26 (P)") over [Credit, Debit, Net] triplets.
 * Current vs prior is decided by fiscal year, never by the (P) marker alone.
 */
export function resolveServicesColumns(hdr6 = [], context = {}) {
  const months = [];
  const cumulative = [];

  for (let c = 0; c < hdr6.length; c++) {
    const raw = hdr6[c];
    if (raw === null || raw === undefined || raw === '') continue;
    // Skip Excel date serials - only named months are trustworthy here.
    if (typeof raw === 'number' && raw > 40000 && raw < 50000) continue;
    const h = raw.toString().trim();

    const monthMatch = h.match(/^(\w{3})-(\d{2})\s*\(([RP])\)/i);
    if (monthMatch) {
      months.push({
        credit: c, debit: c + 1, net: c + 2,
        label: `${monthMatch[1]}-${monthMatch[2]}`,
        status: monthMatch[3].toUpperCase() === 'P' ? 'provisional' : 'revised',
      });
    }

    const cumMatch = h.match(/^(Jul-\w+),?\s*FY(\d{2})\s*(\(P\))?/i);
    if (cumMatch) {
      cumulative.push({
        credit: c, debit: c + 1, net: c + 2,
        fy: parseFiscalYear(cumMatch[2]),
        label: `Jul-${cumMatch[1].split('-')[1]} FY${cumMatch[2]}`,
        status: cumMatch[3] ? 'provisional' : 'final',
      });
    }
  }

  cumulative.sort((a, b) => (b.fy || 0) - (a.fy || 0));
  const current = cumulative[0];
  const prior = cumulative.find((x) => x.fy === (current?.fy ?? 0) - 1);
  if (!current || !prior) {
    throw new SheetParseError('Could not resolve current/prior fiscal-year-to-date service columns', {
      ...context,
      headerRow: hdr6.filter(Boolean).join(' | '),
    });
  }
  return { current, prior, month1: months[0] || null, month2: months[1] || null };
}

/** Labels used to locate EBOPS rows. Keys are stable; patterns follow SBP's numbering. */
export const EBOPS_ROW_PATTERNS = {
  totalServices: /^Services$/i,
  transport: /^3\.\s*Transport/i,
  travel: /^4\.\s*Travel/i,
  insurance: /^6\.\s*Insurance/i,
  financial: /^7\.\s*Financial/i,
  ipCharges: /^8\.\s*Charges for the use of intellectual property/i,
  itTelecom: /^9\.\s*Telecommunications,\s*Computer and information/i,
  telecom: /^9\.1\b/,
  computerServices: /^9\.2\s+Computer services/i,
  softwareConsultancy: /^9\.2\.2\b/,
  softwareExportImport: /^9\.2\.4\b/,
  freelance: /^9\.2\.5\b/,
  informationServices: /^9\.3\b/,
  otherBusiness: /^10\.\s*Other business/i,
  personalCultural: /^11\.\s*Personal, cultural/i,
};
