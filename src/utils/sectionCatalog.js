export const SECTION_DESCRIPTIONS = {
  overview: 'Start with the headline indicators and what changed.',
  trade: 'See what Pakistan buys, sells, and the trade gap.',
  'country-trends': 'Explore trade partners and money sent from abroad.',
  reserves: 'Track foreign currency reserves and import cover.',
  exchange: 'See how the rupee compares with major currencies.',
  remittances: 'Follow money sent home by overseas Pakistanis.',
  fdi: 'Explore foreign investment by country and industry.',
  services: 'Track IT, freelance, and other services exports.',
  inflation: 'Understand changes in food prices and the cost of living.',
  monetary: 'Explore money supply, bank deposits, and private credit.',
  fiscal: 'Compare economic growth, government revenue, and spending.',
  fbr: 'Check tax collections against government targets.',
  'federal-budget': 'See where federal money comes from and goes.',
  'provincial-budget': 'Compare budgets, transfers, and spending across provinces.',
  briefing: 'Read a short explanation of the latest economic signals.',
  'macro-risk': 'Review pressure points in debt, prices, and public finances.',
  'good-bad-watch': 'See what improved, worsened, or needs watching.',
  'imf-compliance': 'Track progress against IMF program commitments.',
  'financing-wall': 'Understand external debt repayments and funding needs.',
  'revenue-meter': 'See how far tax collections are from annual targets.',
  'it-deep-dive': 'Look closer at software, telecom, and freelance exports.',
  'risk-outlook': 'Connect economic risks with household impact.',
  peers: 'Compare Pakistan with other economies.',
  timeline: 'Place major economic decisions and events in context.',
  learning: 'Learn common economic terms in plain language.',
  'source-trust': 'Check official sources, methods, and data confidence.',
  'release-calendar': 'Find when official economic data is due.',
  'data-api': 'Download datasets or use the public data API.',
  feedback: 'Report a problem or suggest an improvement.',
};

export function sectionDescription(sectionId, t) {
  return t(`nav.description.${sectionId}`, SECTION_DESCRIPTIONS[sectionId] || '');
}

export function isPlainNavigation(event) {
  return !event.defaultPrevented && event.button === 0
    && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Fixed event names only: never queries, pins, URL parameters, or other user text. */
export function trackDiscovery(kind) {
  const event = {
    indicator: 'Indicator search selection',
    section: 'Section search selection',
    browse: 'Browse section navigation',
    csv: 'Chart CSV download',
  }[kind];
  if (event && typeof window !== 'undefined') {
    window.plausible?.(event, { u: `${window.location.origin}/` });
  }
}
