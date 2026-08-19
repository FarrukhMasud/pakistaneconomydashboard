import { LIVE_URL } from '../data-catalog.mjs';

export const SITE_URL = LIVE_URL;
export const OG_IMAGE_PATH = '/og-image.png';
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const HOME_DESCRIPTION =
  "Track Pakistan's economy with authentic, officially-sourced data: foreign reserves, PKR exchange rate, inflation (CPI), workers' remittances, imports & exports by country, FBR tax collection, IT & freelancing exports, GDP, and federal & provincial budgets — updated from the State Bank of Pakistan (SBP), PBS, FBR and the Finance Division.";

/** SEO metadata for every public dashboard path. Keep in sync with NAV_GROUPS in src/App.jsx. */
export const SEO_ROUTES = [
  {
    path: '/',
    groupId: null,
    sectionId: null,
    title: 'Pakistan Economic Dashboard — Reserves, Inflation, Trade, FBR & Budget',
    description: HOME_DESCRIPTION,
    heading: 'Pakistan Economic Dashboard',
    summary:
      "An interactive dashboard of Pakistan's key economic indicators, built entirely from official government data — the State Bank of Pakistan (SBP), Pakistan Bureau of Statistics (PBS), the Federal Board of Revenue (FBR) and the Finance Division.",
    changefreq: 'weekly',
    priority: 1.0,
    datasets: [],
  },
  {
    path: '/overview/overview',
    groupId: 'overview',
    sectionId: 'overview',
    title: "State of Pakistan's Economy — Latest KPIs, Reserves, Inflation & Trade",
    description:
      "Headline Pakistan economic indicators at a glance: foreign reserves, inflation, trade, remittances, FBR tax and GDP, sourced from SBP, PBS, FBR and the Finance Division.",
    heading: 'State of the Economy',
    summary:
      "A briefing view of Pakistan's economy with unique KPI cards spanning trade, the current account, reserves, inflation, remittances, tax collection and public debt.",
    changefreq: 'weekly',
    priority: 0.9,
    datasets: ['reserves', 'inflation', 'trade', 'remittances', 'fbr-tax', 'fiscal'],
  },
  {
    path: '/external/trade',
    groupId: 'external',
    sectionId: 'trade',
    title: 'Pakistan Imports, Exports & Trade Balance — Monthly SBP Data',
    description:
      "Monthly Pakistan imports, exports and trade balance, including the top 15 partner countries, from official State Bank of Pakistan balance-of-payments data.",
    heading: 'Pakistan Trade in Goods',
    summary:
      'Monthly goods imports, exports and the trade balance from the State Bank of Pakistan, with a country-level breakdown of the largest partners.',
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['trade'],
  },
  {
    path: '/external/country-trends',
    groupId: 'external',
    sectionId: 'country-trends',
    title: 'Pakistan Trade & Remittance Trends by Country',
    description:
      'Per-partner Pakistan exports, imports and remittance corridors with month-on-month, year-on-year and fiscal-year-to-date momentum from SBP data.',
    heading: 'Country Trends',
    summary:
      'Exports, imports and remittance corridors by partner country, with MoM, YoY and FYTD momentum from official SBP series.',
    changefreq: 'weekly',
    priority: 0.7,
    datasets: ['trade', 'remittances'],
  },
  {
    path: '/external/reserves',
    groupId: 'external',
    sectionId: 'reserves',
    title: 'Pakistan Foreign Exchange Reserves — Weekly SBP Data',
    description:
      "Weekly Pakistan foreign exchange reserves held by the SBP and commercial banks, plus import cover, from the State Bank of Pakistan's official forex statement.",
    heading: 'Pakistan Foreign Exchange Reserves',
    summary:
      'Weekly SBP and bank reserves with import-cover context, taken from the State Bank of Pakistan forex statement.',
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['reserves', 'reserves-adequacy'],
  },
  {
    path: '/external/exchange',
    groupId: 'external',
    sectionId: 'exchange',
    title: 'PKR Exchange Rate vs USD, EUR, GBP & CNY — Monthly Averages',
    description:
      'Monthly average Pakistan rupee exchange rates against the US dollar, euro, British pound and Chinese yuan from official State Bank of Pakistan data.',
    heading: 'PKR Exchange Rate',
    summary:
      'Monthly average PKR rates versus USD, EUR, GBP and CNY from the State Bank of Pakistan exchange-rate archive.',
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['exchange-rates'],
  },
  {
    path: '/external/remittances',
    groupId: 'external',
    sectionId: 'remittances',
    title: "Pakistan Workers' Remittances by Source Country",
    description:
      "Monthly workers' remittances to Pakistan by source country, from the State Bank of Pakistan EasyData series.",
    heading: "Workers' Remittances",
    summary:
      "Monthly workers' remittances and corridor breakdown from the State Bank of Pakistan EasyData API.",
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['remittances'],
  },
  {
    path: '/external/fdi',
    groupId: 'external',
    sectionId: 'fdi',
    title: 'Pakistan FDI by Sector & Country — Official SBP Data',
    description:
      'Net foreign direct investment into Pakistan by sector and source country, with fiscal-year-to-date comparison, from State Bank of Pakistan data.',
    heading: 'Foreign Direct Investment',
    summary:
      'Net FDI by sector and country, including FYTD comparison, from official State Bank of Pakistan workbooks.',
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['fdi'],
  },
  {
    path: '/external/services',
    groupId: 'external',
    sectionId: 'services',
    title: 'Pakistan IT & Services Exports — Software and Freelancing',
    description:
      'Pakistan IT, software and freelancing exports plus broader services trade (EBOPS), from official State Bank of Pakistan data.',
    heading: 'IT & Services Exports',
    summary:
      'Services exports by EBOPS category, IT sub-sectors, and monthly IT and freelance export headlines from the State Bank of Pakistan.',
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['services'],
  },
  {
    path: '/prices/inflation',
    groupId: 'prices',
    sectionId: 'inflation',
    title: 'Pakistan Inflation (CPI, SPI, WPI) — Latest Official Data',
    description:
      'Pakistan national, urban and rural CPI, plus food inflation, SPI and WPI, from PBS via the State Bank of Pakistan EasyData API.',
    heading: 'Pakistan Inflation',
    summary:
      'National, urban and rural CPI, food inflation, SPI and WPI from PBS series published through SBP EasyData.',
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['inflation'],
  },
  {
    path: '/prices/monetary',
    groupId: 'prices',
    sectionId: 'monetary',
    title: 'Pakistan Money Supply, Private Credit & Deposits',
    description:
      'Pakistan M2, private sector credit, deposits and net foreign assets from official State Bank of Pakistan monetary statistics.',
    heading: 'Monetary Sector',
    summary:
      'Money supply (M2), private credit, deposits and net foreign assets from SBP monetary statistics.',
    changefreq: 'weekly',
    priority: 0.7,
    datasets: ['monetary', 'monetary-policy'],
  },
  {
    path: '/fiscal/fiscal',
    groupId: 'fiscal',
    sectionId: 'fiscal',
    title: 'Pakistan GDP Growth, Fiscal Balance & Public Finance',
    description:
      'Pakistan GDP growth, fiscal balance, revenue and expenditure from State Bank of Pakistan public-finance and national-accounts data.',
    heading: 'Fiscal & GDP',
    summary:
      'GDP growth, the fiscal balance, and revenue versus expenditure from SBP public-finance and national-accounts tables.',
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['fiscal'],
  },
  {
    path: '/fiscal/fbr',
    groupId: 'fiscal',
    sectionId: 'fbr',
    title: 'FBR Tax Collection — Monthly Net Collection & Tax Heads',
    description:
      'Monthly Federal Board of Revenue net tax collection and tax-head breakdown for Pakistan, with source-tier labelling when only provisional figures exist.',
    heading: 'FBR Tax Collection',
    summary:
      'Monthly FBR net tax collection and tax-head breakdown from official FBR tables and identified secondary reporting when a machine-readable release is not yet out.',
    changefreq: 'weekly',
    priority: 0.8,
    datasets: ['fbr-tax'],
  },
  {
    path: '/fiscal/federal-budget',
    groupId: 'fiscal',
    sectionId: 'federal-budget',
    title: 'Pakistan Federal Budget — Outlay, Revenue, Deficit & Spending Mix',
    description:
      'Pakistan federal budget outlay, revenue, deficit and spending mix from the Finance Division Budget in Brief, with sourced commentary.',
    heading: 'Federal Budget',
    summary:
      'Federal outlay, revenue, deficit and spending mix from the Finance Division Budget in Brief.',
    changefreq: 'monthly',
    priority: 0.8,
    datasets: ['budget-federal'],
  },
  {
    path: '/fiscal/provincial-budget',
    groupId: 'fiscal',
    sectionId: 'provincial-budget',
    title: 'Pakistan Provincial Budgets — Punjab, Sindh, KP & Balochistan',
    description:
      'Provincial budget outlays, Annual Development Programmes and federal transfers for Punjab, Sindh, Khyber Pakhtunkhwa and Balochistan.',
    heading: 'Provincial Budgets',
    summary:
      'Punjab, Sindh, Khyber Pakhtunkhwa and Balochistan budget outlays, ADP and transfers from provincial finance departments.',
    changefreq: 'monthly',
    priority: 0.8,
    datasets: ['budget-provincial'],
  },
  {
    path: '/insights/briefing',
    groupId: 'insights',
    sectionId: 'briefing',
    title: 'Pakistan Economy Briefing — What Moved and Why',
    description:
      'A sourced briefing on what moved in Pakistan’s economy, generated from the same official series the dashboard charts.',
    heading: 'Economic Briefing',
    summary:
      'What moved across the latest official releases, with narrative claims computed from the same JSON the charts render.',
    changefreq: 'weekly',
    priority: 0.7,
    datasets: ['reserves', 'inflation', 'trade', 'remittances', 'fbr-tax'],
  },
  {
    path: '/insights/macro-risk',
    groupId: 'insights',
    sectionId: 'macro-risk',
    title: 'Pakistan Macro Risk Scorecard',
    description:
      'A scorecard of Pakistan macroeconomic risk across reserves, inflation, the external account, fiscal stress and financing pressure.',
    heading: 'Macro Risk Scorecard',
    summary:
      'Cross-cutting macroeconomic risk across reserves adequacy, inflation, the external account, fiscal stress and financing pressure.',
    changefreq: 'weekly',
    priority: 0.6,
    datasets: ['reserves-adequacy', 'inflation', 'fiscal', 'external-debt'],
  },
  {
    path: '/insights/good-bad-watch',
    groupId: 'insights',
    sectionId: 'good-bad-watch',
    title: 'Pakistan Economy Watchlist — Good, Bad & Watch',
    description:
      'A good / bad / watch list of Pakistan economic developments, tied to official data rather than unsourced commentary.',
    heading: 'Good / Bad / Watch',
    summary:
      'A sourced watchlist of constructive, deteriorating and items to monitor in the latest official releases.',
    changefreq: 'weekly',
    priority: 0.6,
    datasets: ['reserves', 'inflation', 'trade', 'fbr-tax'],
  },
  {
    path: '/insights/imf-compliance',
    groupId: 'insights',
    sectionId: 'imf-compliance',
    title: 'IMF Pakistan Program Tracker & Compliance',
    description:
      'IMF programme reviews, Board decisions and compliance tracking for Pakistan, from official IMF documents.',
    heading: 'IMF Program Tracker',
    summary:
      'Programme reviews, Board decisions and compliance items drawn from official IMF documents on Pakistan.',
    changefreq: 'weekly',
    priority: 0.6,
    datasets: ['imf-tracker'],
  },
  {
    path: '/insights/financing-wall',
    groupId: 'insights',
    sectionId: 'financing-wall',
    title: 'Pakistan External Financing Wall',
    description:
      'Pakistan’s upcoming external debt repayments and financing needs, compiled from SBP and IMF sources.',
    heading: 'External Financing Wall',
    summary:
      'Upcoming external repayments and financing needs compiled from State Bank of Pakistan and IMF sources.',
    changefreq: 'weekly',
    priority: 0.6,
    datasets: ['external-debt'],
  },
  {
    path: '/insights/revenue-meter',
    groupId: 'insights',
    sectionId: 'revenue-meter',
    title: 'Pakistan Revenue Target Meter — FBR vs Budget',
    description:
      'How Federal Board of Revenue collection is tracking against the full-year budget target, using official FBR figures.',
    heading: 'Revenue Target Meter',
    summary:
      'FBR net collection versus the full-year budget target, using official monthly tax figures.',
    changefreq: 'weekly',
    priority: 0.6,
    datasets: ['fbr-tax', 'budget-federal'],
  },
  {
    path: '/insights/it-deep-dive',
    groupId: 'insights',
    sectionId: 'it-deep-dive',
    title: 'Pakistan IT Export Deep Dive',
    description:
      'A deeper look at Pakistan IT, software and freelance exports from official State Bank of Pakistan services data.',
    heading: 'IT Export Deep Dive',
    summary:
      'IT, software and freelance export performance from official SBP services statistics.',
    changefreq: 'weekly',
    priority: 0.6,
    datasets: ['services'],
  },
  {
    path: '/insights/risk-outlook',
    groupId: 'insights',
    sectionId: 'risk-outlook',
    title: 'Pakistan Economic Risk & Outlook',
    description:
      'Forward-looking Pakistan economic risks and outlook, grounded in official reserves, inflation, fiscal and external data.',
    heading: 'Risk & Outlook',
    summary:
      'Forward-looking risks grounded in official reserves, inflation, fiscal and external-account data.',
    changefreq: 'weekly',
    priority: 0.6,
    datasets: ['reserves', 'inflation', 'fiscal', 'external-debt'],
  },
  {
    path: '/insights/peers',
    groupId: 'insights',
    sectionId: 'peers',
    title: 'Pakistan vs Peer Economies — World Bank Comparison',
    description:
      'Pakistan compared with peer economies on growth, inflation, reserves and external indicators from World Bank Open Data.',
    heading: 'Peer Economy Comparison',
    summary:
      'Pakistan versus peer economies on growth, inflation, reserves and external indicators from the World Bank Open Data API.',
    changefreq: 'monthly',
    priority: 0.6,
    datasets: ['peer-comparison'],
  },
  {
    path: '/insights/timeline',
    groupId: 'insights',
    sectionId: 'timeline',
    title: 'Pakistan Economic Timeline — Official Events',
    description:
      'A timeline of official Pakistan macroeconomic events, IMF decisions, surveys and policy actions.',
    heading: 'Economic Timeline',
    summary:
      'Official macroeconomic events, IMF decisions, surveys and policy actions in chronological order.',
    changefreq: 'weekly',
    priority: 0.5,
    datasets: ['economic-events'],
  },
  {
    path: '/insights/learning',
    groupId: 'insights',
    sectionId: 'learning',
    title: 'Pakistan Economy Learning Center',
    description:
      'Plain-language explainers of Pakistan economic indicators — reserves, CPI, remittances, the fiscal deficit — tied to official methodology.',
    heading: 'Learning Center',
    summary:
      'Plain-language explainers of dashboard indicators, tied to official methodology pages rather than unsourced definitions.',
    changefreq: 'monthly',
    priority: 0.5,
    datasets: ['explainers'],
  },
  {
    path: '/insights/source-trust',
    groupId: 'insights',
    sectionId: 'source-trust',
    title: 'Pakistan Economic Data Sources & Trust Tiers',
    description:
      'How this dashboard labels official primary, derived and secondary-reported Pakistan economic data, with provenance for every headline figure.',
    heading: 'Source Trust',
    summary:
      'Trust tiers for every dataset — official primary, derived on this dashboard, or secondary reporting — with provenance for headline figures.',
    changefreq: 'monthly',
    priority: 0.4,
    datasets: [],
  },
  {
    path: '/insights/release-calendar',
    groupId: 'insights',
    sectionId: 'release-calendar',
    title: 'Pakistan Economic Data Release Calendar',
    description:
      'When Pakistan economic data is due: announced source dates versus dates estimated from observed SBP, PBS and FBR publication history.',
    heading: 'Release Calendar',
    summary:
      'Expected publication dates for critical series, labelled as announced by the source or estimated from observed publication history.',
    changefreq: 'weekly',
    priority: 0.5,
    datasets: [],
  },
  {
    path: '/insights/data-api',
    groupId: 'insights',
    sectionId: 'data-api',
    title: 'Pakistan Economy Open Data API — JSON & CSV',
    description:
      'Free, no-key JSON and CSV API for Pakistan economic indicators used by this dashboard, with the same source attribution shown in the UI.',
    heading: 'Open Data API',
    summary:
      'Versioned JSON and CSV endpoints for every dashboard dataset, with source attribution and trust tiers. No API key and no rate limit.',
    changefreq: 'weekly',
    priority: 0.5,
    datasets: [],
  },
  {
    path: '/insights/feedback',
    groupId: 'insights',
    sectionId: 'feedback',
    title: 'Feedback — Pakistan Economic Dashboard',
    description:
      'Send corrections, data issues or feature requests for the Pakistan Economic Dashboard.',
    heading: 'Feedback',
    summary:
      'Send corrections, data issues or feature requests to the dashboard maintainers.',
    changefreq: 'yearly',
    priority: 0.3,
    datasets: [],
  },
];

export function absoluteUrl(path) {
  if (!path || path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path}`;
}

export function getSeoRoute(pathname) {
  const raw = String(pathname || '/').split('?')[0].split('#')[0];
  const normalized = raw.length > 1 ? raw.replace(/\/+$/, '') : '/';
  return SEO_ROUTES.find((route) => route.path === normalized) || SEO_ROUTES[0];
}

export function toIsoDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function lastmodForRoute(route, freshness) {
  const generated = toIsoDate(freshness?.generatedAt);
  const datasets = freshness?.datasets || [];
  const byId = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  const ids = route.datasets?.length
    ? route.datasets
    : datasets.map((dataset) => dataset.id);
  const dates = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .flatMap((dataset) => [
      toIsoDate(dataset.dashboardUpdated),
      toIsoDate(dataset.observationDate),
    ])
    .filter(Boolean)
    .sort();
  return dates.at(-1) || generated;
}
