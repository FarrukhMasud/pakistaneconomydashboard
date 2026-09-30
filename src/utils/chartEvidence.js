import { resolveFigureMetadata, rowsForObservation, sourceFigureStatus } from './figureTrust.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function pointEvidenceRow(row, valueKey, period) {
  return {
    label: row.name || row.label, period, sourceUrl: row.sourceUrl,
    evidence: row[`${valueKey}Evidence`] || row.figureEvidence?.[valueKey] || row.evidence?.[valueKey] || (valueKey === 'latest' ? row.evidence : undefined),
    status: row[`${valueKey}Status`] || row.statuses?.[valueKey] || (valueKey === 'latest' ? sourceFigureStatus(row) : 'unknown'),
  };
}

export function chartEvidenceFor(series, index, { evidenceRows, observationDates, label } = {}) {
  const selectRows = (rows) => series.valueField
    ? rows.map((row) => resolveFigureMetadata(null, row, { field: series.valueField })) : rows;
  const explicit = series.evidenceRows?.[index];
  if (explicit) {
    const rows = Array.isArray(explicit) ? explicit : [explicit];
    const endpoint = rows.at(-1);
    return { period: series.observationDates?.[index] || endpoint?.observationDate || endpoint?.date || endpoint?.month
      || endpoint?.period || endpoint?.fy || endpoint?.year || observationDates?.[index] || label, rows: selectRows(rows) };
  }
  let period = series.observationDates?.[index] || observationDates?.[index];
  const monthLabel = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2}|\d{4})$/i.exec(String(label));
  if (!series.observationDates && monthLabel) {
    period = `${monthLabel[2].length === 2 ? `20${monthLabel[2]}` : monthLabel[2]}-${String(MONTHS.indexOf(monthLabel[1].toLowerCase()) + 1).padStart(2, '0')}`;
  }
  const fiscal = /FY(20\d{2}|\d{2})\b/.exec(series.label || '');
  const month = monthLabel ? MONTHS.indexOf(monthLabel[1].toLowerCase()) + 1 : MONTHS.indexOf(String(label).slice(0, 3).toLowerCase()) + 1;
  if (!series.observationDates && fiscal && month) {
    const year = Number(fiscal[1].length === 2 ? `20${fiscal[1]}` : fiscal[1]);
    period = `${month >= 7 ? year - 1 : year}-${String(month).padStart(2, '0')}`;
  } else if (!series.observationDates && series.isComparison && /^\d{4}-\d{2}(?:-\d{2})?$/.test(period || '')) {
    period = `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`;
  }
  const annualFiscal = /^FY(20\d{2}|\d{2})$/i.exec(String(label));
  const annualCategory = annualFiscal
    ? `FY${Number(annualFiscal[1].length === 2 ? `20${annualFiscal[1]}` : annualFiscal[1]) - (series.isComparison ? 1 : 0)}`
    : /^\d{4}$/.test(String(label)) ? String(Number(label) - (series.isComparison ? 1 : 0)) : undefined;
  const matches = rowsForObservation(evidenceRows, period, period ? annualCategory : label);
  return { period, rows: selectRows(matches.filter((row) => !series.sourceField || row.evidencePath === series.sourceField || row.seriesId === series.sourceField)) };
}
