import { periodEndDate } from './release-calendar.mjs';
import { validateNumericValues } from './data-writer.mjs';

export function validPeriod(value) {
  if (typeof value !== 'string' || !value.trim() || /\b(?:null|undefined|nan)\b/i.test(value)) return false;
  if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return Boolean(periodEndDate(value));
  return /^(?:FY\s*\d{2,4}(?:\s*\([^)]*\))?|\d{4}|Jul(?:y)?[-–\s].*\bFY\s*\d{2,4}(?:\s*\([^)]*\))?)$/i.test(value);
}

function assertRows(rows, label, requiredFields, { nullable = [], now = new Date() } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${label}: required observations are missing`);
  const dates = new Set();
  let previous = null;
  for (const row of rows) {
    const date = String(row.date || row.month || row.fy || row.year || '');
    if (!validPeriod(date)) throw new Error(`${label}: invalid observation period "${date}"`);
    const today = now.toISOString().slice(0, date.length === 7 ? 7 : 10);
    if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(date) && date > today && row.status !== 'estimate') throw new Error(`${label}: future observation ${date} is not labelled as an official estimate`);
    if (dates.has(date)) throw new Error(`${label}: duplicate observation ${date}`);
    if (previous && date < previous) throw new Error(`${label}: observations are not ordered`);
    dates.add(date);
    previous = date;
    for (const field of requiredFields) {
      if (row[field] === null && nullable.includes(field)) continue;
      if (!Number.isFinite(row[field])) throw new Error(`${label}.${date}.${field}: missing or non-finite required value`);
    }
  }
}

export function validateDataset(dataset, data, { now = new Date() } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${dataset.id}: expected a dataset object`);
  validateNumericValues(data, dataset.id);
  if (data.publication?.status === 'withheld') return;
  if (dataset.id === 'reserves') assertRows(data.weekly, dataset.id, ['sbp', 'banks', 'total'], { now });
  if (dataset.id === 'trade') assertRows(data.monthly, dataset.id, ['exports', 'imports', 'balance'], { now });
  if (dataset.id === 'exchange-rates') assertRows(data.monthly, dataset.id, ['USD', 'EUR', 'GBP', 'CNY'], { now, nullable: ['EUR', 'GBP', 'CNY'] });
  if (dataset.id === 'fdi') assertRows(data.monthly, dataset.id, ['net_fdi', 'equity', 'debt'], { now, nullable: ['equity', 'debt'] });
  if (dataset.id === 'remittances') assertRows(data.monthly, dataset.id, ['total', 'saudiArabia', 'uae', 'uk', 'usa', 'otherGcc', 'eu'], { now, nullable: ['saudiArabia', 'uae', 'uk', 'usa', 'otherGcc', 'eu'] });
  if (dataset.id === 'inflation' || dataset.id === 'monetary') {
    let count = 0;
    for (const [id, series] of Object.entries(data)) {
      if (!series || typeof series !== 'object' || !Array.isArray(series.data)) continue;
      if (!series.seriesKey) throw new Error(`${dataset.id}.${id}: official series identifier is missing`);
      assertRows(series.data, `${dataset.id}.${id}`, ['value'], { now, nullable: ['value'] });
      if (!series.data.some(row => Number.isFinite(row.value))) throw new Error(`${dataset.id}.${id}: no numeric observation`);
      count++;
    }
    if (!count) throw new Error(`${dataset.id}: no official series`);
  }
  if (dataset.id === 'fiscal') {
    assertRows(data.annual, dataset.id, ['gdpGrowth'], { now });
    for (const [id, series] of Object.entries(data.publicFinance || {})) {
      assertRows(series.data, `${dataset.id}.${id}`, ['value'], { now, nullable: ['value'] });
      if (series.data.some(row => !row.unit)) throw new Error(`${dataset.id}.${id}: source unit is missing`);
    }
  }
  if (dataset.id === 'services' && data.itHeadline && !validPeriod(data.itHeadline.fytdLabel)) throw new Error('services: IT headline fiscal reporting period is malformed');
  if (dataset.id === 'fbr-tax' && data.monthly?.length) {
    assertRows(data.monthly, dataset.id, ['net'], { now, nullable: ['net'] });
  }
}
