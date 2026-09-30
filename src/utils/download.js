import { visibleChartData } from './chartTimeRange.js';
import { evidenceListOf, sourceFigureStatus } from './figureTrust.js';
import { chartEvidenceFor } from './chartEvidence.js';

/** Escapes a single CSV cell, quoting only when necessary. */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('y' in value) return csvCell(value.y);
    if ('x' in value) return csvCell(value.x);
    return csvCell(JSON.stringify(value));
  }
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Converts a Chart.js data object into CSV with one row per label and one
 * column per visible dataset, so what a reader downloads is exactly what they see.
 */
export function chartToCsv(chartData, { title, evidenceRows, observationDates, derivation } = {}) {
  if (!chartData?.labels?.length) return '';
  const datasets = visibleChartData(chartData).datasets.filter((dataset) => Array.isArray(dataset.data));
  const includeEvidence = Array.isArray(evidenceRows);
  const header = ['Period', ...datasets.map((dataset, index) => dataset.label || `Series ${index + 1}`),
    ...(includeEvidence ? ['Source status', 'Evidence observation periods', 'Original source', 'Source artifact', 'Artifact retrieved', 'Source locator', 'Downloaded from', 'Parser version', 'Derivation'] : [])];
  const lines = [header.map(csvCell).join(',')];
  chartData.labels.forEach((label, rowIndex) => {
    const sources = datasets.map((series) => ({ series, ...chartEvidenceFor(series, rowIndex, { evidenceRows, observationDates, label }) }));
    const join = (key) => sources.map(({ series, rows }) => `${series.label}: ${rows.flatMap((row) => evidenceListOf(row)).map((item) =>
      typeof item[key] === 'object' && item[key] ? JSON.stringify(item[key]) : item[key]).filter(Boolean).join(' | ') || 'Not recorded'}`).join(' ; ');
    lines.push([label, ...datasets.map((dataset) => dataset.data[rowIndex] ?? 'Unavailable'),
      ...(includeEvidence ? [
        sources.map(({ series, period, rows }) => `${series.label} (${period || 'Period not stated'}): ${rows.map(sourceFigureStatus).join(' | ') || 'Source status not stated'}`).join(' ; '),
        sources.map(({ series, rows }) => `${series.label}: ${rows.map((row) => row.observationDate || row.date || row.month || row.period || row.fy || row.year || 'Period not stated').join(' | ') || 'Not recorded'}`).join(' ; '),
        join('sourceUrl'), join('artifactUrl'), join('retrievedAt'),
        join('locator'),
        join('responseUrl'), join('parserVersion'),
        sources.map(({ series, rows }) => `${series.label}: ${series.derivation || derivation || rows.map((row) => row.derivation || row.derivedFrom).filter(Boolean).join(' | ') || 'No derivation documented; see source'}`).join(' ; '),
      ] : []),
    ].map(csvCell).join(','));
  });
  const preamble = title
    ? `# ${title}\n# Export generated ${new Date().toISOString().slice(0, 10)}; not source retrieval time.\n`
    : '';
  return `${preamble}${lines.join('\n')}\n`;
}

export function slugify(text) {
  return String(text || 'chart')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function downloadTextFile(filename, mimeType, contents) {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
