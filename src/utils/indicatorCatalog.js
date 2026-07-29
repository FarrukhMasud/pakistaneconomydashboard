/**
 * Searchable indicator catalog for the command palette.
 * Maps common economic terms to dashboard deep links.
 */
export const INDICATOR_CATALOG = [
  { id: 'ind-reserves', terms: ['foreign reserves', 'import cover', 'SBP reserves', 'forex'], label: 'Foreign reserves & import cover', groupId: 'external', sectionId: 'reserves' },
  { id: 'ind-exchange', terms: ['PKR', 'USD', 'exchange rate', 'rupee', 'currency'], label: 'PKR exchange rate', groupId: 'external', sectionId: 'exchange' },
  { id: 'ind-trade', terms: ['imports', 'exports', 'trade balance', 'trade deficit', 'goods'], label: 'Trade balance & goods', groupId: 'external', sectionId: 'trade' },
  { id: 'ind-country', terms: ['country trends', 'trading partner', 'China', 'USA', 'UAE', 'Saudi'], label: 'Country trade & remittance corridors', groupId: 'external', sectionId: 'country-trends' },
  { id: 'ind-remit', terms: ['remittances', 'workers remittances', 'diaspora'], label: 'Workers’ remittances', groupId: 'external', sectionId: 'remittances' },
  { id: 'ind-fdi', terms: ['FDI', 'foreign investment', 'net inflow'], label: 'Foreign direct investment', groupId: 'external', sectionId: 'fdi' },
  { id: 'ind-it', terms: ['IT exports', 'freelance', 'software', 'services', 'EBOPS'], label: 'IT & services exports', groupId: 'external', sectionId: 'services' },
  { id: 'ind-cpi', terms: ['inflation', 'CPI', 'SPI', 'WPI', 'food inflation', 'prices'], label: 'Inflation (CPI / SPI / WPI)', groupId: 'prices', sectionId: 'inflation' },
  { id: 'ind-m2', terms: ['M2', 'broad money', 'private credit', 'deposits', 'monetary'], label: 'Monetary aggregates (M2, credit)', groupId: 'prices', sectionId: 'monetary' },
  { id: 'ind-policy', terms: ['policy rate', 'interest rate', 'MPC', 'real rate'], label: 'Monetary policy rate', groupId: 'prices', sectionId: 'monetary' },
  { id: 'ind-gdp', terms: ['GDP', 'growth', 'fiscal deficit', 'revenue', 'expenditure'], label: 'GDP & fiscal balance', groupId: 'fiscal', sectionId: 'fiscal' },
  { id: 'ind-fbr', terms: ['FBR', 'tax collection', 'tax target', 'revenue target'], label: 'FBR tax collection', groupId: 'fiscal', sectionId: 'fbr' },
  { id: 'ind-fed-budget', terms: ['federal budget', 'PSDP', 'outlay', 'primary balance'], label: 'Federal budget', groupId: 'fiscal', sectionId: 'federal-budget' },
  { id: 'ind-prov-budget', terms: ['provincial budget', 'Punjab', 'Sindh', 'KP', 'Balochistan', 'NFC'], label: 'Provincial budgets', groupId: 'fiscal', sectionId: 'provincial-budget' },
  { id: 'ind-imf', terms: ['IMF', 'EFF', 'program', 'compliance', 'review'], label: 'IMF program compliance', groupId: 'insights', sectionId: 'imf-compliance' },
  { id: 'ind-debt', terms: ['external debt', 'financing wall', 'rollover', 'repayment'], label: 'External financing wall', groupId: 'insights', sectionId: 'financing-wall' },
  { id: 'ind-circular', terms: ['circular debt', 'power sector', 'energy'], label: 'Power circular debt', groupId: 'insights', sectionId: 'macro-risk' },
  { id: 'ind-peers', terms: ['peer comparison', 'World Bank', 'South Asia', 'benchmark'], label: 'Peer country comparison', groupId: 'insights', sectionId: 'peers' },
  { id: 'ind-briefing', terms: ['briefing', 'overview', 'monthly brief', 'good bad watch'], label: 'Monthly economic briefing', groupId: 'insights', sectionId: 'briefing' },
  { id: 'ind-api', terms: ['API', 'download', 'CSV', 'open data', 'JSON'], label: 'Open data API & downloads', groupId: 'insights', sectionId: 'data-api' },
  { id: 'ind-calendar', terms: ['release calendar', 'publication schedule', 'next release'], label: 'Data release calendar', groupId: 'insights', sectionId: 'release-calendar' },
  { id: 'ind-rss', terms: ['RSS', 'alerts', 'feed', 'subscribe'], label: 'Critical series RSS feed', groupId: 'insights', sectionId: 'data-api' },
];

export function searchIndicators(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return INDICATOR_CATALOG;
  return INDICATOR_CATALOG.filter((item) => {
    const hay = [item.label, item.id, ...(item.terms || [])].join(' ').toLowerCase();
    if (hay.includes(q)) return true;
    // loose subsequence
    let cursor = 0;
    for (const ch of q) {
      cursor = hay.indexOf(ch, cursor);
      if (cursor === -1) return false;
      cursor += 1;
    }
    return true;
  });
}
