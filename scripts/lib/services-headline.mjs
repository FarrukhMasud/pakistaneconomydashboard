const MONTH_NUMBERS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function parseValue(text) {
  const normalized = String(text || '').replace(/,/g, '').trim();
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

function parseFiscalYear(text) {
  const match = String(text || '').match(/^FY(\d{2})$/i);
  return match ? 2000 + Number(match[1]) : null;
}

function monthForFiscalYear(month, fiscalYear) {
  const monthNumber = MONTH_NUMBERS[month.toLowerCase()];
  if (!monthNumber || !fiscalYear) return null;
  const year = monthNumber >= 7 ? fiscalYear - 1 : fiscalYear;
  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

function nearest(items, x, maxDistance = 2) {
  let best = null;
  let distance = Infinity;
  for (const item of items) {
    const candidateDistance = Math.abs(item.x - x);
    if (candidateDistance < distance) {
      best = item;
      distance = candidateDistance;
    }
  }
  return distance <= maxDistance ? best : null;
}

function rowCells(items, labelPattern, occurrence = 0) {
  const labels = items
    .filter((item) => labelPattern.test(String(item.text || '').trim()))
    .sort((a, b) => a.page - b.page || a.y - b.y);
  const label = labels[occurrence];
  if (!label) return [];
  return items
    .filter((item) => item.page === label.page && Math.abs(item.y - label.y) < 0.12)
    .sort((a, b) => a.x - b.x);
}

function parseColumns(items, cells) {
  const periodHeaders = items.filter((item) => (
    item.y < 8
    && /^(?:[A-Z][a-z]{2}|[A-Z][a-z]{2}-[A-Z][a-z]{2})$/.test(String(item.text || '').trim())
  ));
  const fiscalYearHeaders = items
    .filter((item) => item.y < 8)
    .map((item) => ({ ...item, fiscalYear: parseFiscalYear(item.text) }))
    .filter((item) => item.fiscalYear);

  return cells
    .map((cell) => {
      const value = parseValue(cell.text);
      if (value === null) return null;
      const period = nearest(periodHeaders, cell.x)?.text?.trim() || null;
      const fiscalYear = nearest(fiscalYearHeaders, cell.x)?.fiscalYear || null;
      const month = period && /^[A-Z][a-z]{2}$/.test(period)
        ? monthForFiscalYear(period, fiscalYear)
        : null;
      return { x: cell.x, value, period, fiscalYear, month };
    })
    .filter(Boolean);
}

/**
 * Parse SBP's ExportsImports-Goods.pdf headline table. The PDF publishes
 * monthly and fiscal-year totals for service categories before the detailed
 * EBOPS workbook is refreshed.
 */
export function parseServicesHeadline(items) {
  const itCells = rowCells(
    items,
    /^9\.\s*Telecommunications,\s*Computer,\s*and Information Services$/i,
    0,
  );
  const totalCells = rowCells(items, /^2\.\s*Exports of Services$/i, 0);
  if (!itCells.length || !totalCells.length) {
    throw new Error('Could not locate exports-of-services headline rows');
  }

  const itColumns = parseColumns(items, itCells);
  const totalColumns = parseColumns(items, totalCells);
  const currentFiscalYear = Math.max(...itColumns.map((column) => column.fiscalYear || 0));
  const monthly = itColumns
    .filter((column) => column.month && column.fiscalYear === currentFiscalYear)
    .sort((a, b) => a.month.localeCompare(b.month));
  const latest = monthly.at(-1);
  const previous = monthly.at(-2) || null;
  const yearAgo = itColumns.find((column) => (
    column.month
    && latest
    && column.month === `${Number(latest.month.slice(0, 4)) - 1}${latest.month.slice(4)}`
  ));
  // SBP places the comparable current/prior FYTD totals in the two rightmost
  // columns. The label advances from Jul to Jul-Aug ... to Jul-Jun during the
  // fiscal year, so selecting a hard-coded Jul-Jun column would break in July.
  const currentFytd = itColumns
    .filter((column) => column.fiscalYear === currentFiscalYear)
    .sort((a, b) => a.x - b.x)
    .at(-1);
  const priorFytd = itColumns
    .filter((column) => column.fiscalYear === currentFiscalYear - 1)
    .sort((a, b) => a.x - b.x)
    .at(-1);
  const totalLatest = totalColumns.find((column) => column.month === latest?.month);

  if (!latest || !yearAgo || !currentFytd || !priorFytd || !totalLatest) {
    throw new Error('Services headline table is missing required monthly or fiscal-year columns');
  }

  return {
    latestMonth: latest.month,
    latest: latest.value,
    prevMonth: previous?.month || null,
    prev: previous?.value ?? null,
    yearAgoMonth: yearAgo.month,
    yearAgo: yearAgo.value,
    fytd: currentFytd.value,
    fytdPrior: priorFytd.value,
    fytdLabel: `${currentFytd.period} FY${String(currentFiscalYear).slice(-2)}`,
    fytdPriorLabel: `${priorFytd.period} FY${String(currentFiscalYear - 1).slice(-2)}`,
    totalServicesLatest: totalLatest.value,
    fiscalYear: currentFiscalYear,
  };
}
