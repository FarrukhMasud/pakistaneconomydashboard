import { slugify } from './download.js';

/**
 * Original English titles are stable chart identities, not translated labels.
 * Entries without a chart title intentionally lead to an explanatory section.
 */
export const INDICATOR_CATALOG = [
  { id: 'ind-reserves', terms: ['foreign reserves', 'import cover', 'SBP reserves', 'forex', 'زر مبادلہ', 'زرمبادلہ کے ذخائر', 'ڈالر کے ذخائر', 'درآمدی ضروریات'], label: 'Foreign reserves & import cover', groupId: 'external', sectionId: 'reserves', chartTitle: 'Foreign Exchange Reserves' },
  { id: 'ind-exchange', terms: ['PKR', 'USD', 'exchange rate', 'rupee', 'currency', 'dollar rate', 'ڈالر', 'روپیہ', 'روپے کی قدر', 'شرح مبادلہ'], label: 'PKR exchange rate', groupId: 'external', sectionId: 'exchange', chartTitle: 'Exchange Rates (PKR)' },
  { id: 'ind-trade', terms: ['imports', 'exports', 'trade balance', 'trade deficit', 'goods', 'درآمدات', 'برآمدات', 'تجارتی خسارہ', 'تجارت'], label: 'Trade balance & goods', groupId: 'external', sectionId: 'trade', chartTitle: 'Trade Balance' },
  { id: 'ind-country', terms: ['country trends', 'trading partner', 'China', 'USA', 'UAE', 'Saudi', 'تجارتی شراکت دار', 'چین', 'سعودی عرب'], label: 'Country trade & remittance corridors', groupId: 'external', sectionId: 'country-trends', chartTitle: 'Remittance Corridors — Monthly Trend' },
  { id: 'ind-remit', terms: ['remittances', 'workers remittances', 'diaspora', 'ترسیلات', 'ترسیلات زر', 'بیرون ملک پاکستانی', 'بھیجی گئی رقم'], label: 'Workers’ remittances', groupId: 'external', sectionId: 'remittances', chartTitle: 'Monthly Total' },
  { id: 'ind-fdi', terms: ['FDI', 'foreign investment', 'net inflow', 'غیر ملکی سرمایہ کاری', 'براہ راست سرمایہ کاری'], label: 'Foreign direct investment', groupId: 'external', sectionId: 'fdi', chartTitle: 'Annual Net FDI' },
  { id: 'ind-it', terms: ['IT exports', 'freelance', 'software', 'services', 'EBOPS', 'آئی ٹی', 'فری لانس', 'سافٹ ویئر', 'خدمات کی برآمدات'], label: 'IT & services exports', groupId: 'external', sectionId: 'services', chartTitle: 'IT & Telecom Breakdown' },
  { id: 'ind-cpi', terms: ['inflation', 'CPI', 'SPI', 'WPI', 'prices', 'مہنگائی', 'افراط زر', 'قیمتیں'], label: 'Inflation (CPI / SPI / WPI)', groupId: 'prices', sectionId: 'inflation', chartTitle: 'National CPI — Year-over-Year' },
  { id: 'ind-food', terms: ['food inflation', 'food prices', 'grocery', 'کھانے پینے کی قیمتیں', 'خوراک', 'اشیائے خوردونوش', 'غذائی مہنگائی'], label: 'Food vs non-food inflation', groupId: 'prices', sectionId: 'inflation', chartTitle: 'Food vs Non-Food Inflation' },
  { id: 'ind-m2', terms: ['M2', 'broad money', 'money supply', 'monetary', 'زر کی رسد', 'رقم کی رسد'], label: 'Monetary aggregates (M2, credit)', groupId: 'prices', sectionId: 'monetary', chartTitle: 'M2 Money Supply Growth' },
  { id: 'ind-credit', terms: ['private credit', 'deposits', 'bank lending', 'نجی شعبے کے قرضے', 'بینک ڈپازٹس', 'قرضوں کی نمو'], label: 'Private credit & deposit growth', groupId: 'prices', sectionId: 'monetary', chartTitle: 'Credit & Deposit Growth' },
  { id: 'ind-policy', terms: ['policy rate', 'interest rate', 'MPC', 'real rate', 'شرح سود', 'پالیسی ریٹ'], label: 'Monetary policy rate', groupId: 'prices', sectionId: 'monetary', chartTitle: 'Policy rate history', chartId: 'chart-policy-rate-history' },
  { id: 'ind-gdp', terms: ['GDP', 'growth', 'economic growth', 'جی ڈی پی', 'معاشی ترقی', 'شرح نمو', 'مجموعی ملکی پیداوار'], label: 'GDP growth', groupId: 'fiscal', sectionId: 'fiscal', chartTitle: 'GDP Growth Rate' },
  { id: 'ind-deficit', terms: ['fiscal deficit', 'primary balance', 'budget deficit', 'مالی خسارہ', 'بجٹ خسارہ', 'بنیادی توازن'], label: 'Fiscal & primary balance', groupId: 'fiscal', sectionId: 'fiscal', chartTitle: 'Fiscal & Primary Balance' },
  { id: 'ind-fbr', terms: ['FBR', 'tax collection', 'tax target', 'revenue target', 'ٹیکس', 'محصولات', 'ایف بی آر', 'ٹیکس وصولی'], label: 'FBR tax collection', groupId: 'fiscal', sectionId: 'fbr', chartTitle: 'Monthly Net Collection vs Target' },
  { id: 'ind-fed-budget', terms: ['federal budget', 'PSDP', 'outlay', 'expenditure', 'وفاقی بجٹ', 'اخراجات', 'ترقیاتی بجٹ'], label: 'Federal budget', groupId: 'fiscal', sectionId: 'federal-budget', chartTitle: 'Where the Rupee Goes' },
  { id: 'ind-prov-budget', terms: ['provincial budget', 'Punjab', 'Sindh', 'KP', 'Balochistan', 'NFC', 'صوبائی بجٹ', 'پنجاب', 'سندھ', 'بلوچستان', 'خیبر پختونخوا'], label: 'Provincial budgets', groupId: 'fiscal', sectionId: 'provincial-budget', chartTitle: 'Provinces Compared — Outlay, Development & Transfers' },
  { id: 'ind-imf', terms: ['IMF', 'EFF', 'program', 'compliance', 'review', 'آئی ایم ایف', 'عالمی مالیاتی فنڈ'], label: 'IMF program compliance', groupId: 'insights', sectionId: 'imf-compliance' },
  { id: 'ind-debt', terms: ['external debt', 'financing wall', 'rollover', 'repayment', 'repayments', 'بیرونی قرضہ', 'بیرونی قرضے', 'قرضوں کی ادائیگی', 'بیرونی قرضوں کی ادائیگی'], label: 'External financing wall', groupId: 'insights', sectionId: 'financing-wall' },
  { id: 'ind-circular', terms: ['circular debt', 'power sector', 'energy', 'گردشی قرضہ', 'گردشی قرضے', 'بجلی', 'توانائی'], label: 'Power circular debt', groupId: 'fiscal', sectionId: 'fiscal', chartTitle: 'Power circular debt stock', chartId: 'chart-power-circular-debt-stock' },
  { id: 'ind-peers', terms: ['peer comparison', 'World Bank', 'South Asia', 'benchmark', 'ملکی موازنہ', 'جنوبی ایشیا', 'عالمی بینک'], label: 'Peer country comparison', groupId: 'insights', sectionId: 'peers' },
  { id: 'ind-briefing', terms: ['briefing', 'overview', 'monthly brief', 'good bad watch', 'معاشی خلاصہ', 'ماہانہ جائزہ'], label: 'Monthly economic briefing', groupId: 'insights', sectionId: 'briefing' },
  { id: 'ind-api', terms: ['API', 'download', 'CSV', 'open data', 'JSON', 'ڈیٹا', 'ڈاؤن لوڈ'], label: 'Open data API & downloads', groupId: 'insights', sectionId: 'data-api' },
  { id: 'ind-calendar', terms: ['release calendar', 'publication schedule', 'next release', 'اشاعت', 'اعدادوشمار کا شیڈول'], label: 'Data release calendar', groupId: 'insights', sectionId: 'release-calendar' },
  { id: 'ind-rss', terms: ['RSS', 'alerts', 'feed', 'subscribe', 'اطلاعات', 'سبسکرائب'], label: 'Critical series RSS feed', groupId: 'insights', sectionId: 'data-api' },
].map((item) => ({
  ...item,
  chartId: item.chartId || (item.chartTitle ? `chart-${slugify(item.chartTitle)}` : null),
}));

export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640\u200c\u200d]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ه/g, 'ہ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function scoreSearch(terms, query) {
  const needle = normalizeSearch(query);
  if (!needle) return 0;
  const fields = terms.filter(Boolean).map(normalizeSearch);
  if (fields.some((field) => field === needle)) return 5;
  if (fields.some((field) => field.startsWith(needle))) return 4;
  if (fields.some((field) => field.includes(needle))) return 3;
  if (needle.split(' ').every((word) => fields.some((field) => field.includes(word)))) return 2;
  // Keep English abbreviation matching, without fuzzy cross-word Urdu matches.
  if (/^[a-z]{3,}$/.test(needle) && fields.some((field) => {
    let cursor = 0;
    for (const char of needle) {
      cursor = field.indexOf(char, cursor);
      if (cursor < 0) return false;
      cursor += 1;
    }
    return true;
  })) return 1;
  return 0;
}

const CHART_VARIANTS = {
  'ind-reserves': [
    { terms: ['import cover', 'درآمدی ضروریات'], chartTitle: 'Goods-import cover history', chartId: 'chart-goods-import-cover-history' },
  ],
  'ind-trade': [
    { terms: ['imports', 'exports', 'درآمدات', 'برآمدات'], chartTitle: 'Imports vs Exports' },
  ],
  'ind-country': [
    { terms: ['country trends', 'trading partner', 'China', 'USA', 'UAE', 'Saudi', 'چین', 'سعودی عرب'], chartTitle: null },
  ],
  'ind-cpi': [
    { terms: ['SPI', 'WPI', 'wholesale prices'], chartTitle: 'CPI vs SPI vs WPI' },
  ],
  'ind-debt': [
    {
      terms: ['repayment', 'repayments', 'debt repayment', 'debt repayments', 'external debt repayment', 'قرضوں کی ادائیگی', 'بیرونی قرضوں کی ادائیگی'],
      requiredTerms: ['repay', 'ادائیگی'],
      groupId: 'fiscal', sectionId: 'fiscal',
      label: 'External debt repayment split', labelKey: 'chart.debtRepaymentSplit',
      chartTitle: 'External debt repayment split', chartId: 'chart-external-debt-repayment-split',
    },
  ],
};

/** A broad catalog label can cover several charts; only target an actual match. */
export function indicatorForQuery(item, query) {
  const normalized = normalizeSearch(query);
  const variant = CHART_VARIANTS[item.id]?.find((candidate) => (
    (!candidate.requiredTerms || candidate.requiredTerms.some((term) => normalized.includes(normalizeSearch(term))))
    && scoreSearch(candidate.terms, query) >= 3
  ));
  if (!variant) return item;
  return {
    ...item,
    ...variant,
    terms: item.terms,
    chartId: variant.chartId || (variant.chartTitle ? `chart-${slugify(variant.chartTitle)}` : null),
  };
}

export function searchIndicators(query) {
  if (!normalizeSearch(query)) return INDICATOR_CATALOG;
  return INDICATOR_CATALOG.map((item) => ({
    item,
    rank: scoreSearch([item.label, item.id, ...item.terms], query),
  })).filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .map(({ item }) => indicatorForQuery(item, query));
}
