export const CHART_RANGES = ['1y', '3y', '5y', 'all'];

export function normalizeChartRange(value, fallback = 'all') {
  return CHART_RANGES.includes(value) ? value : (CHART_RANGES.includes(fallback) ? fallback : 'all');
}

export function observationTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return null;
  const iso = value.length === 7 ? `${value}-01` : value;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso ? time : null;
}

// Only explicitly annual callers opt into this conversion. A fiscal-month
// overlay (Jul...Jun) remains categorical and must never be range-filtered.
export function fiscalYearEndDate(value) {
  const match = /^FY(20\d{2}|\d{2})$/.exec(String(value));
  if (!match) return null;
  const year = match[1].length === 2 ? `20${match[1]}` : match[1];
  return `${year}-06-30`;
}

export function chartValue(value) {
  const numeric = typeof value === 'object' && value !== null ? value.y : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null;
}

export function visibleChartData(data) {
  return { ...data, datasets: (data.datasets || []).filter((dataset) => !dataset.hidden) };
}

const POINT_OPTIONS = [
  'backgroundColor', 'borderColor', 'borderWidth', 'borderRadius',
  'pointBackgroundColor', 'pointBorderColor', 'pointBorderWidth', 'pointRadius',
  'pointHoverRadius', 'pointStyle', 'pointRotation', 'hoverBackgroundColor', 'hoverBorderColor',
];

/**
 * Windows are calendar intervals (anniversary, latest], never N observations.
 * Dates are explicit: fiscal-month curves and country labels are not dates.
 */
export function selectChartRange(data, dates, range = 'all', mode = 'chronological') {
  const unchanged = { data, dates: [], indices: [], applicable: false, range: 'all' };
  if (mode !== 'chronological' || !data?.labels?.length || !Array.isArray(dates)
    || dates.length !== data.labels.length) return unchanged;
  const times = dates.map(observationTime);
  if (times.some((time, index) => time == null || (index > 0 && time <= times[index - 1]))) return unchanged;
  const actualDatasets = data.datasets.filter((dataset) => !dataset.isComparison);
  const latestIndex = times.findLastIndex((_, index) => actualDatasets.some(
    (dataset) => chartValue(dataset.data[index]) != null,
  ));
  if (latestIndex < 0) return unchanged;

  const selectedRange = normalizeChartRange(range);
  const latest = times[latestIndex];
  let cutoff = -Infinity;
  if (selectedRange !== 'all') {
    const end = new Date(latest);
    const year = end.getUTCFullYear() - Number(selectedRange[0]);
    const month = end.getUTCMonth();
    const day = Math.min(end.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
    cutoff = Date.UTC(year, month, day);
  }
  const indices = times.flatMap((time, index) => time > cutoff && time <= latest ? [index] : []);
  return {
    applicable: true,
    range: selectedRange,
    dates: indices.map((index) => dates[index]),
    indices,
    data: {
      ...data,
      labels: indices.map((index) => data.labels[index]),
      datasets: data.datasets.map((dataset) => {
        const result = { ...dataset, data: indices.map((index) => dataset.data[index] ?? null) };
        for (const key of POINT_OPTIONS) {
          if (Array.isArray(dataset[key]) && dataset[key].length) {
            result[key] = indices.map((index) => dataset[key][index % dataset[key].length]);
          }
        }
        return result;
      }),
    },
  };
}

// Match independent series by period, rather than assigning values to another
// series' dates just because their arrays happen to have the same length.
export function valuesByDate(dates, rows, field = 'value', dateKey = 'date') {
  const values = new Map((rows || []).map((row) => [row[dateKey], row[field]]));
  return dates.map((date) => values.get(date) ?? null);
}

export function mergeObservationDates(...series) {
  return [...new Set(series.flatMap((rows) => (rows || []).map((row) => row.date)))].sort();
}

export function chartSummary(data, { t, tx = (value) => value, coverage, unit, categorical = false } = {}) {
  if (!data?.labels?.length) return t('chart.noObservations', 'No observations in this view.');
  const visible = (data.datasets || []).filter((dataset) => !dataset.hidden && Array.isArray(dataset.data));
  const observations = visible.map((dataset, index) => {
    const lastIndex = categorical
      ? dataset.data.reduce((best, value, index) => (
        chartValue(value) != null && (best < 0 || Math.abs(chartValue(value)) > Math.abs(chartValue(dataset.data[best])))
          ? index : best
      ), -1)
      : dataset.data.findLastIndex((value) => chartValue(value) != null);
    const label = dataset.label ? tx(dataset.label) : `${t('chart.series', 'Series')} ${index + 1}`;
    if (lastIndex < 0) return `${label}: ${t('chart.noObservations', 'No observations in this view.')}`;
    const value = chartValue(dataset.data[lastIndex]).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const observation = `${label}: ${value} (${data.labels[lastIndex]})`;
    return categorical ? `${t('chart.largestMagnitude', 'Largest magnitude:')} ${observation}` : observation;
  });
  return [
    categorical
      ? t('chart.summaryCategories', '{count} categories shown.').replace('{count}', data.labels.length)
      : t('chart.summaryPeriod', 'Shown: {start} to {end}.')
        .replace('{start}', data.labels[0]).replace('{end}', data.labels.at(-1)),
    coverage ? `${t('chart.latestPeriodLabel', 'Latest available period:')} ${coverage}.` : '',
    unit ? `${t('chart.units', 'Units:')} ${tx(unit)}.` : '',
    observations.join('; '),
    t('chart.summaryTable', 'Open Data & sources for the data table and CSV.'),
  ].filter(Boolean).join(' ');
}
