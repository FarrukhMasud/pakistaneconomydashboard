const MONTH_NAMES_SHORT = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

export function parseReservesDate(raw) {
  if (!raw) return null;
  const value = raw.replace(/\s*\(?\s*[RP]\s*\)?\s*$/i, '').replace(/^1\/\s*/, '').trim();

  if (/^\d{4}-\d{2}$/.test(value)) {
    const fy = Number(value.split('-')[1]);
    const year = fy >= 90 ? 1900 + fy : 2000 + fy;
    return { type: 'annual', date: `FY${year}` };
  }

  const weekly = value.match(/^(\d{1,2})-(\w{3})-(\d{2})$/);
  if (weekly) {
    const month = MONTH_NAMES_SHORT[weekly[2].toLowerCase()];
    const yearPart = Number(weekly[3]);
    const year = yearPart >= 90 ? 1900 + yearPart : 2000 + yearPart;
    if (month) return { type: 'weekly', date: `${year}-${month}-${String(weekly[1]).padStart(2, '0')}` };
  }

  const monthly = value.match(/^(\w{3})\s+(\d{2})$/);
  if (monthly) {
    const month = MONTH_NAMES_SHORT[monthly[1].toLowerCase()];
    const yearPart = Number(monthly[2]);
    const year = yearPart >= 90 ? 1900 + yearPart : 2000 + yearPart;
    if (month) return { type: 'monthly', date: `${year}-${month}` };
  }

  return null;
}

function numericValue(text) {
  const cleaned = String(text || '').replace(/,/g, '').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Anchor each observation on its date label, then collect nearby numeric cells.
 * This tolerates SBP PDFs where a date and its values render on baselines that
 * differ by a few hundredths of a PDF unit.
 */
export function parseReserveObservations(items) {
  const byDate = new Map();
  const anchors = items
    .map((item) => ({ item, parsed: parseReservesDate(String(item.text || '').trim()) }))
    .filter(({ parsed }) => parsed && parsed.type !== 'annual');

  for (const { item: anchor, parsed } of anchors) {
    const values = items
      .filter((item) => (
        item.page === anchor.page
        && item.x > anchor.x
        && Math.abs(item.y - anchor.y) <= 0.18
      ))
      .sort((a, b) => a.x - b.x)
      .map((item) => numericValue(item.text))
      .filter((value) => value !== null);
    if (values.length < 2) continue;

    const sbp = Math.round(values[0] * 100) / 100;
    const banks = Math.round(values[1] * 100) / 100;
    const total = Math.round((values[2] ?? sbp + banks) * 100) / 100;
    const observation = { date: parsed.date, sbp, banks, total };
    const existing = byDate.get(parsed.date);
    if (!existing || values.length >= 3) byDate.set(parsed.date, observation);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
