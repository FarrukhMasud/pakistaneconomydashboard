/** Escapes a single CSV cell, quoting only when necessary. */
function csvCell(value) {
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
 * column per dataset, so what a reader downloads is exactly what they see.
 */
export function chartToCsv(chartData, { title } = {}) {
  if (!chartData?.labels?.length) return '';
  const datasets = (chartData.datasets || []).filter((dataset) => Array.isArray(dataset.data));
  const header = ['Period', ...datasets.map((dataset, index) => dataset.label || `Series ${index + 1}`)];
  const lines = [header.map(csvCell).join(',')];
  chartData.labels.forEach((label, rowIndex) => {
    lines.push([label, ...datasets.map((dataset) => dataset.data[rowIndex])].map(csvCell).join(','));
  });
  const preamble = title
    ? `# ${title}\n# Downloaded from economyofpakistan.com on ${new Date().toISOString().slice(0, 10)}\n`
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
