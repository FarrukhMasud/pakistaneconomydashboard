export const LIVE_URL = 'https://economyofpakistan.com';

const MAX_AGE_DAYS = {
  Weekly: 45,
  Monthly: 150,
  'Monthly (provisional)': 75,
  'Monthly/FYTD': 180,
  'Weekly/Monthly': 75,
  'Quarterly/Annual': 540,
};

function observationAgeDays(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return null;
  const date = new Date(value.length === 7 ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function fiscalPeriodEndDate(value) {
  const match = String(value || '').match(/jul(?:y)?[-\s]+([a-z]+).*?fy\s*(\d{2,4})/i);
  if (!match) return null;

  const months = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const month = months[match[1].slice(0, 3).toLowerCase()];
  if (!month) return null;

  const rawFy = Number(match[2]);
  const fiscalYear = rawFy < 100 ? 2000 + rawFy : rawFy;
  const calendarYear = month >= 7 ? fiscalYear - 1 : fiscalYear;
  const end = new Date(Date.UTC(calendarYear, month, 0));
  return end.toISOString().slice(0, 10);
}

function fiscalYearEndDate(value) {
  const match = String(value || '').match(/fy\s*(\d{2,4})/i);
  if (!match) return null;
  const rawFy = Number(match[1]);
  const fiscalYear = rawFy < 100 ? 2000 + rawFy : rawFy;
  return `${fiscalYear}-06-30`;
}

export const DATASETS = [
  {
    id: 'reserves',
    label: 'Foreign Exchange Reserves',
    file: 'reserves.json',
    source: 'State Bank of Pakistan',
    sourceUrl: 'https://www.sbp.org.pk/assets/document/forex.pdf',
    sourceFile: 'forex.pdf',
    parser: 'parse-sbp-excel.mjs:updateReserves',
    cadence: 'Weekly',
    expectedLag: 'Usually published weekly; dashboard should advance after SBP updates forex.pdf.',
    critical: true,
    latest: data => data.weekly?.at(-1)?.date,
  },
  {
    id: 'exchange-rates',
    label: 'Monthly Average Exchange Rates',
    file: 'exchange-rates.json',
    source: 'State Bank of Pakistan',
    sourceUrl: 'https://www.sbp.org.pk/assets/document/IBF_Arch.xls',
    sourceFile: 'IBF_Arch.xls',
    parser: 'parse-sbp-excel.mjs:updateExchangeRates',
    cadence: 'Monthly',
    expectedLag: 'Monthly archive usually updates after month-end. Daily/current SBP rates are not used in this monthly chart.',
    critical: true,
    latest: data => data.monthly?.at(-1)?.date,
  },
  {
    id: 'remittances',
    label: "Workers' Remittances",
    file: 'remittances.json',
    source: 'SBP EasyData API',
    sourceUrl: 'https://easydata.sbp.org.pk',
    apiSeries: ['TS_GP_BOP_WR_M.WR0010', 'TS_GP_BOP_WR_M.WR0020', 'TS_GP_BOP_WR_M.WR0030', 'TS_GP_BOP_WR_M.WR0040', 'TS_GP_BOP_WR_M.WR0050', 'TS_GP_BOP_WR_M.WR0100', 'TS_GP_BOP_WR_M.WR0150'],
    parser: 'update-data.mjs:updateRemittances',
    cadence: 'Monthly',
    expectedLag: 'Usually published monthly; April data is not expected until SBP releases the next workers remittance update.',
    critical: true,
    latest: data => data.monthly?.at(-1)?.date,
  },
  {
    id: 'trade',
    label: 'Trade in Goods',
    file: 'trade.json',
    source: 'State Bank of Pakistan',
    sourceUrl: 'https://archive.sbp.org.pk/ecodata/exp_import_BOP.xls',
    sourceFile: 'exp_import_BOP.xls',
    parser: 'parse-sbp-excel.mjs:updateTrade',
    cadence: 'Monthly',
    expectedLag: 'Monthly BOP goods trade data.',
    critical: true,
    latest: data => data.monthly?.at(-1)?.date,
  },
  {
    id: 'fdi',
    label: 'Foreign Direct Investment',
    file: 'fdi.json',
    source: 'State Bank of Pakistan',
    sourceUrl: 'https://archive.sbp.org.pk/ecodata/NetinflowSummary.xls',
    sourceFile: 'NetinflowSummary.xls',
    parser: 'parse-sbp-excel.mjs:updateFdi',
    cadence: 'Monthly/FYTD',
    expectedLag: 'Monthly FDI tables are released after source files are updated by SBP.',
    critical: true,
    latest: data => data.sectorPeriod || data.fytdComparison?.current?.period || data.annual?.at(-1)?.year,
    latestDate: data => fiscalPeriodEndDate(data.sectorPeriod || `${data.fytdComparison?.period || ''} ${data.fytdComparison?.current?.label || ''}`),
  },
  {
    id: 'services',
    label: 'IT & Services Trade',
    file: 'services.json',
    source: 'State Bank of Pakistan',
    sourceUrl: 'https://archive.sbp.org.pk/ecodata/dt.xls',
    sourceFile: 'dt.xls',
    parser: 'parse-sbp-excel.mjs:updateServices',
    cadence: 'Monthly/FYTD',
    expectedLag: 'Detailed services trade data from SBP EBOPS file.',
    critical: true,
    latest: data => data.dataCoverage,
    latestDate: data => fiscalPeriodEndDate(data.dataCoverage),
  },
  {
    id: 'inflation',
    label: 'Inflation',
    file: 'inflation.json',
    source: 'SBP EasyData API / PBS',
    sourceUrl: 'https://easydata.sbp.org.pk',
    apiSeries: ['TS_GP_PT_CPI_M.*'],
    parser: 'update-data.mjs:updateInflation',
    cadence: 'Monthly',
    expectedLag: 'Monthly CPI/WPI series sourced through SBP EasyData.',
    critical: true,
    latest: data => data.national_cpi?.data?.at(-1)?.date,
  },
  {
    id: 'monetary',
    label: 'Monetary Sector',
    file: 'monetary.json',
    source: 'SBP EasyData API',
    sourceUrl: 'https://easydata.sbp.org.pk',
    apiSeries: ['TS_GP_BAM_M2_W.*', 'TS_GP_BAM_RM_W.*'],
    parser: 'update-data.mjs:updateMonetary',
    cadence: 'Weekly/Monthly',
    expectedLag: 'SBP monetary series include weekly/monthly observations depending on the indicator.',
    critical: true,
    latest: data => data.m2?.data?.at(-1)?.date || data.reserve_money?.data?.at(-1)?.date,
  },
  {
    id: 'fiscal',
    label: 'Public Finance & GDP',
    file: 'fiscal.json',
    source: 'SBP EasyData API / SBP GDP table',
    sourceUrl: 'https://www.sbp.org.pk/assets/document/GDP_table.xlsx',
    sourceFile: 'GDP_table.xlsx',
    parser: 'parse-sbp-excel.mjs:updateGdpFiscal + update-data.mjs:updatePublicFinance',
    cadence: 'Quarterly/Annual',
    expectedLag: 'GDP/fiscal data is lower frequency than external-sector data.',
    critical: true,
    latest: data => data.publicFinance?.fiscal_balance?.data?.at(-1)?.date || data.annual?.at(-1)?.year,
    latestDate: data => fiscalYearEndDate(
      data.publicFinance?.fiscal_balance?.data?.at(-1)?.date || data.annual?.at(-1)?.year,
    ),
  },
  {
    id: 'fbr-tax',
    label: 'FBR Tax Collection',
    file: 'fbr-tax.json',
    source: 'Federal Board of Revenue (FBR)',
    sourceUrl: 'https://www.fbr.gov.pk',
    parser: 'manual-curation',
    cadence: 'Monthly (provisional)',
    expectedLag: 'FBR publishes provisional monthly net collection in a press release shortly after each month-end; figures are finalised later in the FBR Year Book.',
    critical: false,
    latest: data => data.fytd?.asOf || [...(data.monthly || [])].reverse().find(row => typeof row.net === 'number')?.date,
  },
  {
    id: 'imf-tracker',
    label: 'IMF Program Tracker',
    file: 'imf-tracker.json',
    source: 'IMF / official program documents',
    sourceUrl: 'https://www.imf.org/en/Countries/PAK',
    parser: 'manual-curation',
    cadence: 'Event-driven',
    expectedLag: 'Update when IMF publishes Board decisions, press releases, staff reports, or official schedule changes.',
    critical: true,
    latest: data => data.upcomingDecision?.date || data.lastVerified,
  },
  {
    id: 'monetary-policy',
    label: 'SBP Policy Rate Tracker',
    file: 'monetary-policy.json',
    source: 'State Bank of Pakistan — Monetary Policy Committee',
    sourceUrl: 'https://www.sbp.org.pk/m_policy/index.asp',
    parser: 'manual-curation',
    cadence: 'Event-driven',
    expectedLag: 'Update after each SBP Monetary Policy Committee decision (roughly every 6 weeks).',
    critical: false,
    latest: data => data.asOf || data.lastVerified,
  },
  {
    id: 'circular-debt',
    label: 'Power Circular Debt Tracker',
    file: 'circular-debt.json',
    source: 'Ministry of Energy / Power Division, IMF',
    sourceUrl: 'https://www.imf.org/en/Countries/PAK',
    parser: 'manual-curation',
    cadence: 'Event-driven',
    expectedLag: 'Update when the Power Division / IMF publish new circular-debt figures (typically monthly/quarterly).',
    critical: false,
    latest: data => data.current?.asOf || data.lastVerified,
  },
  {
    id: 'external-debt',
    label: 'External Debt Repayment Tracker',
    file: 'external-debt.json',
    source: 'State Bank of Pakistan / IMF',
    sourceUrl: 'https://www.imf.org/en/Countries/PAK',
    parser: 'manual-curation',
    cadence: 'Event-driven',
    expectedLag: 'Update when SBP/MoF disclose revised external-debt servicing or stock figures.',
    critical: false,
    latest: data => data.lastVerified,
  },
  {
    id: 'reserves-adequacy',
    label: 'Reserves Adequacy Tracker',
    file: 'reserves-adequacy.json',
    source: 'State Bank of Pakistan',
    sourceUrl: 'https://www.sbp.org.pk/assets/document/forex.pdf',
    parser: 'parse-sbp-excel.mjs:updateReservesAdequacyFromData',
    cadence: 'Weekly',
    expectedLag: 'Derived from the latest SBP weekly reserves and trailing 12 months of official SBP goods imports.',
    critical: false,
    latest: data => data.current?.asOf || data.lastVerified,
  },
  {
    id: 'budget-federal',
    label: 'Federal Budget',
    file: 'budget-federal.json',
    source: 'Government of Pakistan, Finance Division — Budget in Brief',
    sourceUrl: 'https://www.finance.gov.pk',
    parser: 'manual-curation',
    cadence: 'Quarterly/Annual',
    expectedLag: 'Annual; the federal budget is presented each June for the July–June fiscal year. Update when the new budget is announced.',
    critical: false,
    latest: data => data.years?.[0]?.presented || data.lastUpdated,
  },
  {
    id: 'budget-provincial',
    label: 'Provincial Budgets',
    file: 'budget-provincial.json',
    source: 'Provincial Finance Departments — Budget White Papers',
    sourceUrl: 'https://www.finance.gov.pk',
    parser: 'manual-curation',
    cadence: 'Quarterly/Annual',
    expectedLag: 'Annual; provincial budgets are presented each June for the July–June fiscal year. Update as each province announces.',
    critical: false,
    latest: data => data.lastUpdated,
  },
  {
    id: 'peer-comparison',
    label: 'Peer Economy Comparison',
    file: 'peer-comparison.json',
    source: 'World Bank Open Data API',
    sourceUrl: 'https://data.worldbank.org',
    parser: 'update-peer-comparison.mjs',
    cadence: 'Annual',
    expectedLag: 'World Bank WDI annual indicators update after national accounts and balance-of-payments releases; years can differ by country and indicator.',
    critical: false,
    latest: data => data.latestObservation || data.lastUpdated,
  },
  {
    id: 'economic-events',
    label: 'Official Economic Timeline',
    file: 'economic-events.json',
    source: 'IMF / SBP / Finance Division / NDMA',
    sourceUrl: 'https://www.imf.org/en/Countries/PAK',
    parser: 'manual-curation',
    cadence: 'Event-driven',
    expectedLag: 'Update when an official institution publishes a major macroeconomic event, program decision, survey, or policy decision.',
    critical: false,
    latest: data => data.latestObservation || data.events?.at(-1)?.date || data.lastUpdated,
  },
  {
    id: 'explainers',
    label: 'Learning Center Explainers',
    file: 'explainers.json',
    source: 'Official methodology pages',
    sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    parser: 'manual-curation',
    cadence: 'Event-driven',
    expectedLag: 'Update when dashboard terminology changes or official methodology pages change.',
    critical: false,
    latest: data => data.lastVerified || data.lastUpdated,
  },
];

export function getDatasetFreshness(dataset, data) {
  const latestObservation = dataset.latest?.(data) || data.dataCoverage || data.lastUpdated || null;
  const freshnessDate = dataset.latestDate?.(data) || latestObservation;
  const maxAgeDays = MAX_AGE_DAYS[dataset.cadence];
  const observationAge = observationAgeDays(freshnessDate);
  const stale = maxAgeDays != null && observationAge != null && observationAge > maxAgeDays;
  const undated = maxAgeDays != null && observationAge == null;
  const reviewRequired = data.reviewRequired === true;
  return {
    id: dataset.id,
    label: dataset.label,
    file: dataset.file,
    source: dataset.source,
    sourceUrl: dataset.sourceUrl,
    sourceFile: dataset.sourceFile || null,
    apiSeries: dataset.apiSeries || null,
    parser: dataset.parser,
    cadence: dataset.cadence,
    expectedLag: dataset.expectedLag,
    critical: dataset.critical,
    latestObservation,
    freshnessDate: freshnessDate !== latestObservation ? freshnessDate : null,
    dataCoverage: data.dataCoverage || null,
    dashboardUpdated: data.lastUpdated || data.lastVerified || null,
    reviewReason: data.reviewReason || null,
    status: latestObservation && !stale && !undated && !reviewRequired ? 'fresh' : 'needs-review',
  };
}
