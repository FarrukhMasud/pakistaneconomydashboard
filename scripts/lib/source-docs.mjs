/**
 * Canonical registry of every upstream source document the pipeline reads.
 *
 * This is the single place that maps a raw file (or API series) to the
 * publishing institution, its human title, and the public URL a reader can open
 * to verify any number we display. `provenance.json` and the "cite this figure"
 * UI both resolve through here, so a number can never be shown with a source we
 * cannot link.
 *
 * sourceType:
 *   official-primary    - published directly by the issuing institution
 *   official-derived    - computed by this project from official-primary inputs
 *   secondary-attributed- press/other reporting of official figures (lower trust)
 */

export const SOURCE_DOCS = {
  'exp_import_BOP.xls': {
    id: 'sbp-exp-import-bop',
    institution: 'State Bank of Pakistan',
    title: 'Exports and Imports (BOP basis) - archive series',
    url: 'https://www.sbp.org.pk/assets/document/exp_import_BOP_Arch.xls',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'Foreign_Dir.xls': {
    id: 'sbp-foreign-dir',
    institution: 'State Bank of Pakistan',
    title: 'Foreign Direct Investment by Sector',
    url: 'https://archive.sbp.org.pk/ecodata/Foreign_Dir.xls',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'Netinflow.xls': {
    id: 'sbp-netinflow-country',
    institution: 'State Bank of Pakistan',
    title: 'Foreign Investment Net Inflows by Country',
    url: 'https://www.sbp.org.pk/assets/document/Netinflow.xls',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'NetinflowSummary.xls': {
    id: 'sbp-netinflow-summary',
    institution: 'State Bank of Pakistan',
    title: 'Foreign Investment Net Inflows - Summary',
    url: 'https://archive.sbp.org.pk/ecodata/NetinflowSummary.xls',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'GDP_table.xlsx': {
    id: 'sbp-gdp-table',
    institution: 'State Bank of Pakistan / Pakistan Bureau of Statistics',
    title: 'GDP and National Accounts Table',
    url: 'https://www.sbp.org.pk/assets/document/GDP_table.xlsx',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'annual',
  },
  'Balancepayment_BPM6.xls': {
    id: 'sbp-bop-bpm6',
    institution: 'State Bank of Pakistan',
    title: 'Balance of Payments (BPM6)',
    url: 'https://www.sbp.org.pk/assets/document/Balancepayment_BPM6.xls',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'forex.pdf': {
    id: 'sbp-forex-reserves',
    institution: 'State Bank of Pakistan',
    title: 'Foreign Exchange Reserves (weekly)',
    url: 'https://www.sbp.org.pk/assets/document/forex.pdf',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'weekly',
  },
  'IBF_Arch.xls': {
    id: 'sbp-ibf-arch',
    institution: 'State Bank of Pakistan',
    title: 'Interbank Exchange Rates - archive',
    url: 'https://www.sbp.org.pk/assets/document/IBF_Arch.xls',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'dt.xls': {
    id: 'sbp-ebops-services',
    institution: 'State Bank of Pakistan',
    title: 'Trade in Services (EBOPS classification)',
    url: 'https://archive.sbp.org.pk/ecodata/dt.xls',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'ExportsImports-Goods.pdf': {
    id: 'sbp-services-headline',
    institution: 'State Bank of Pakistan',
    title: 'Exports and Imports of Goods & Services',
    url: 'https://www.sbp.org.pk/assets/document/ExportsImports-Goods.pdf',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'Export_Receipts_by_all_Countries.xls': {
    id: 'sbp-export-by-country',
    institution: 'State Bank of Pakistan',
    title: 'Export Receipts by All Countries',
    url: 'https://archive.sbp.org.pk/ecodata/Export_Receipts_by_all_Countries.xls',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'Import-Payments-by-All-Countries.xlsx': {
    id: 'sbp-import-by-country',
    institution: 'State Bank of Pakistan',
    title: 'Import Payments by All Countries',
    url: 'https://archive.sbp.org.pk/ecodata/Import-Payments-by-All-Countries.xlsx',
    landingUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
};

/** Non-file sources: live APIs and manually verified publications. */
export const SOURCE_FEEDS = {
  'sbp-easydata': {
    id: 'sbp-easydata',
    institution: 'State Bank of Pakistan',
    title: 'SBP EasyData statistical API',
    url: 'https://easydata.sbp.org.pk/',
    landingUrl: 'https://easydata.sbp.org.pk/',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'pbs-cpi': {
    id: 'pbs-cpi',
    institution: 'Pakistan Bureau of Statistics',
    title: 'Consumer Price Index monthly review',
    url: 'https://www.pbs.gov.pk/cpi',
    landingUrl: 'https://www.pbs.gov.pk/',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'fbr-collection': {
    id: 'fbr-collection',
    institution: 'Federal Board of Revenue',
    title: 'FBR revenue collection statements',
    url: 'https://www.fbr.gov.pk/',
    landingUrl: 'https://www.fbr.gov.pk/',
    sourceType: 'official-primary',
    cadence: 'monthly',
  },
  'sbp-monetary-policy': {
    id: 'sbp-monetary-policy',
    institution: 'State Bank of Pakistan',
    title: 'Monetary Policy Statements and decisions',
    url: 'https://www.sbp.org.pk/m_policy/index.asp',
    landingUrl: 'https://www.sbp.org.pk/m_policy/index.asp',
    sourceType: 'official-primary',
    cadence: 'per-meeting',
  },
  'finance-division': {
    id: 'finance-division',
    institution: 'Ministry of Finance, Government of Pakistan',
    title: 'Federal Budget and Fiscal Operations',
    url: 'https://www.finance.gov.pk/',
    landingUrl: 'https://www.finance.gov.pk/',
    sourceType: 'official-primary',
    cadence: 'annual',
  },
  'imf-pakistan': {
    id: 'imf-pakistan',
    institution: 'International Monetary Fund',
    title: 'IMF Pakistan country page and programme reviews',
    url: 'https://www.imf.org/en/Countries/PAK',
    landingUrl: 'https://www.imf.org/en/Countries/PAK',
    sourceType: 'official-primary',
    cadence: 'per-review',
  },
  'derived-dashboard': {
    id: 'derived-dashboard',
    institution: 'economyofpakistan.com',
    title: 'Derived metric computed from official inputs',
    url: 'https://github.com/FarrukhMasud/pakistaneconomydashboard',
    landingUrl: 'https://economyofpakistan.com/',
    sourceType: 'official-derived',
    cadence: 'per-update',
  },
};

/** Resolve a document or feed descriptor by key. Throws on unknown keys. */
export function resolveSource(key) {
  const doc = SOURCE_DOCS[key] || SOURCE_FEEDS[key];
  if (!doc) {
    throw new Error(
      `Unknown source key "${key}". Register it in scripts/lib/source-docs.mjs before citing it.`,
    );
  }
  return doc;
}

export function allSources() {
  return { ...SOURCE_FEEDS, ...SOURCE_DOCS };
}
