import { createContext } from 'react';

export const TrustContext = createContext({ datasetId: null, data: null });

export const SECTION_DATASETS = {
  trade: 'trade', reserves: 'reserves', exchange: 'exchange-rates',
  remittances: 'remittances', fdi: 'fdi', services: 'services', inflation: 'inflation',
  monetary: 'monetary', fiscal: 'fiscal', fbr: 'fbr-tax',
  'federal-budget': 'budget-federal', 'provincial-budget': 'budget-provincial',
  'revenue-meter': 'fbr-tax', 'it-deep-dive': 'services', peers: 'peer-comparison',
  timeline: 'economic-events', learning: 'explainers',
};
