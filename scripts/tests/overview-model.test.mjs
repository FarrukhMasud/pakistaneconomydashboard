import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  applyYoYHeadline,
  buildOverviewClauses,
  buildOverviewIndicators,
  buildSnapshotKpi,
  buildTradeKpi,
  decorateOverviewKpis,
  joinClauses,
  kpiRoute,
  mergeOverviewIndicators,
  overviewFreshness,
  selectHeadlineKpis,
  tradeComparison,
  yoyMatch,
} from '../../src/utils/overviewModel.js';
import {
  formatCompareBasis,
  formatKpiChange,
  formatKpiDisplay,
  formatKpiPeriod,
  formatKpiUnit,
} from '../../src/utils/kpiFormat.js';

test('KPI periods and units use one display language', () => {
  assert.equal(formatKpiPeriod('2026-07-31'), '31 Jul 2026');
  assert.equal(formatKpiPeriod('2026-07'), 'Jul 2026');
  assert.equal(formatKpiUnit('T PKR'), 'Rs tn');
  assert.equal(formatKpiUnit('$ Billion'), 'USD bn');
  assert.equal(formatCompareBasis('vs 2026-06'), 'vs Jun 2026');
  assert.equal(formatCompareBasis('vs week ending 2026-07-24'), 'vs week ending 24 Jul 2026');
  assert.equal(formatKpiChange({ change: 0.03, changeUnit: '$B' }), '+0.03 USD bn');
  assert.equal(formatKpiDisplay({ value: 13, unit: 'T PKR' }), '13 Rs tn');
});

test('trade KPI uses YoY as the headline change', () => {
  const kpi = buildTradeKpi({
    monthly: [
      { date: '2025-06', imports: 5000, exports: 2500, balance: -2500 },
      { date: '2026-05', imports: 5800, exports: 2400, balance: -3400 },
      { date: '2026-06', imports: 6100, exports: 2550, balance: -3550 },
    ],
  });
  assert.equal(kpi.id, 'trade');
  assert.equal(kpi.value, -3.55);
  assert.equal(kpi.unit, 'USD bn');
  assert.equal(kpi.change, -42);
  assert.equal(kpi.changeUnit, '%');
  assert.match(kpi.changeBasis, /YoY/);
  assert.equal(kpi.sentiment, 'negative');
  assert.equal(kpiRoute('trade').sectionId, 'trade');
});

test('seasonal remittances headline is YoY, not MoM', () => {
  const rows = [
    { date: '2025-06', total: 3000 },
    { date: '2026-05', total: 4250 },
    { date: '2026-06', total: 3470 },
  ];
  assert.equal(yoyMatch(rows, '2026-06').total, 3000);
  const decorated = applyYoYHeadline({
    id: 'remittances',
    change: -0.78,
    changeUnit: '$B',
    changeBasis: 'vs 2026-05',
    trend: 'down',
    sentiment: 'negative',
  }, rows);
  assert.equal(decorated.headlineKind, 'yoy');
  assert.equal(decorated.change, 15.7);
  assert.equal(decorated.sentiment, 'positive');
  assert.equal(decorated.momChangeLabel, '-0.78 USD bn');
});

test('overview extras merge without duplicating summary IDs', () => {
  const merged = mergeOverviewIndicators(
    [{ id: 'reserves', label: 'Reserves' }],
    [
      buildSnapshotKpi({ id: 'public-debt', label: 'Total Public Debt', value: '₨83.3', unit: 'tn' }),
      { id: 'reserves', label: 'duplicate' },
    ],
  );
  assert.deepEqual(merged.map((row) => row.id), ['reserves', 'public-debt']);
  assert.equal(merged[1].displayValue, '₨83.3 tn');
});

test('briefing sentence is assembled from verified clauses', () => {
  const indicators = decorateOverviewKpis([
    { id: 'inflation', value: 9.2, change: -1.9, period: '2026-06' },
    { id: 'remittances', value: 3.47, change: -0.78, changeUnit: '$B', period: '2026-06' },
  ], {
    remittances: {
      monthly: [
        { date: '2025-06', total: 3000 },
        { date: '2026-06', total: 3470 },
      ],
    },
  });
  const clauses = buildOverviewClauses({
    inflation: indicators.find((row) => row.id === 'inflation'),
    remittances: indicators.find((row) => row.id === 'remittances'),
    trade: { value: -3.55, period: '2026-05' },
    fbrGap: 20,
    fbrPeriod: 'Jul–Jun FY2026',
  });
  const sentence = joinClauses(clauses.map((clause) => (
    clause.fallback.replace('{value}', clause.value).replace('{period}', clause.period)
  )));
  assert.match(sentence, /Inflation cooled to 9\.2%/);
  assert.match(sentence, /15\.7% higher than a year earlier/);
  assert.match(sentence, /goods deficit in May 2026 was 3\.55 USD bn/);
  assert.match(sentence, /20 Rs bn ahead/);
  assert.match(sentence, /FBR ended Jul–Jun FY2026.*full-year target/);
  assert.doesNotMatch(sentence, /FYTD/);
  assert.ok(clauses.every((clause) => clause.period && !clause.period.includes('undefined')));
});

test('headline selection is intentionally ordered and includes inflation regardless of summary order', () => {
  const indicators = ['fdi', 'public-debt', 'trade', 'policy-rate', 'remittances', 'exchange-rate', 'reserves', 'inflation']
    .map((id) => ({ id }));
  assert.deepEqual(selectHeadlineKpis(indicators).map((row) => row.id), [
    'inflation', 'reserves', 'exchange-rate', 'remittances', 'trade', 'policy-rate',
  ]);
  assert.equal(indicators.length, 8);
  assert.deepEqual(selectHeadlineKpis([{ id: 'fdi' }, { id: 'inflation' }]), [{ id: 'inflation' }]);
});

test('negative trade balances describe deficit size but retain signed balance changes and exact periods', () => {
  const widened = tradeComparison(-3550, -2500, '2025-06', 'YoY');
  assert.equal(widened.change, -42);
  assert.equal(widened.sentiment, 'negative');
  assert.equal(widened.trend, 'down');
  assert.equal(formatKpiChange(widened), 'Deficit widened 42%');
  assert.equal(widened.changeBasis, 'vs Jun 2025 (YoY)');

  const narrowed = tradeComparison(-2000, -2500, '2025-07', 'YoY');
  assert.equal(narrowed.change, 20);
  assert.equal(narrowed.sentiment, 'positive');
  assert.equal(narrowed.trend, 'up');
  assert.equal(formatKpiChange(narrowed), 'Deficit narrowed 20%');
  assert.equal(narrowed.changeBasis, 'vs Jul 2025 (YoY)');
  assert.equal(formatKpiChange(tradeComparison(-2500, -2500, '2025-07', 'YoY')), 'Balance unchanged');
});

test('trade crossing zero or a zero baseline uses absolute balance change, never a misleading percentage', () => {
  const crossed = tradeComparison(500, -2500, '2025-07', 'YoY');
  assert.equal(crossed.change, 3);
  assert.equal(crossed.changeUnit, 'USD bn');
  assert.equal(crossed.sentiment, 'positive');
  assert.equal(formatKpiChange(crossed), 'Balance improved 3 USD bn');
  const zero = tradeComparison(-30, 0, '2026-06', 'MoM');
  assert.equal(zero.change, -0.03);
  assert.equal(formatKpiChange(zero), 'Balance deteriorated 0.03 USD bn');
  assert.equal(tradeComparison(-500, null, '2026-06', 'MoM'), null);
});

test('trade fallback is explicitly MoM and never treats a nonadjacent observation as the previous month', () => {
  const kpi = buildTradeKpi({ monthly: [
    { date: '2026-07', balance: -2000 },
    { date: '2026-06', balance: -3000 },
  ] });
  assert.equal(kpi.period, '2026-07');
  assert.equal(kpi.headlineKind, 'mom');
  assert.equal(kpi.changeBasis, 'vs Jun 2026 (MoM)');
  assert.equal(kpi.sentiment, 'positive');
  const gap = buildTradeKpi({ monthly: [
    { date: '2026-05', balance: -3000 }, { date: '2026-07', balance: -2000 },
  ] });
  assert.equal(gap.change, undefined);
  assert.equal(gap.sentiment, 'neutral');
});

test('remittances comparison is aligned with the displayed observation rather than a newer source month', () => {
  const kpi = { id: 'remittances', value: 3, period: '2026-06', change: 0.2, changeBasis: 'vs 2026-05' };
  const row = applyYoYHeadline(kpi, [
    { date: '2025-06', total: 2000 }, { date: '2025-07', total: 3000 },
    { date: '2026-06', total: 3000 }, { date: '2026-07', total: 6000 },
  ]);
  assert.equal(row.change, 50);
  assert.equal(row.period, '2026-06');
  assert.equal(row.comparisonPeriod, '2025-06');
  assert.equal(row.momChangeBasis, 'vs 2026-05');
});

test('briefing omits undated claims, does not invent a flat change, and distinguishes in-progress FBR periods', () => {
  assert.deepEqual(buildOverviewClauses({ inflation: { value: 9 }, trade: { value: -3 }, fbrGap: 1 }), []);
  const clauses = buildOverviewClauses({
    inflation: { value: 9, period: '2026-08' }, fbrGap: -30, fbrPeriod: 'Jul–Aug FY2027',
  });
  assert.equal(clauses[0].key, 'overview.picture.inflationAt');
  assert.equal(clauses[1].key, 'overview.picture.fbrShort');
  assert.match(clauses[1].fallback, /FYTD/);
});

test('enriched list preserves snapshot values and removes completed current-account FYTD wording', () => {
  const indicators = buildOverviewIndicators({
    summary: { indicators: [{ id: 'inflation', value: 9 }] },
    snapshot: { indicators: [{
      id: 'current-account', label: 'Current Account (FYTD)', value: '−$139', unit: 'M', asOf: 'Jul–Jun FY2026',
    }] },
  });
  assert.equal(indicators[1].displayValue, '−$139 M');
  assert.equal(indicators[1].label, 'Current Account (Full year)');
});

test('source checks and content-change dates remain separate and do not use build generation time', () => {
  const result = overviewFreshness([{ id: 'trade' }, { id: 'exchange-rate' }], {
    generatedAt: '2026-09-20',
    datasets: [
      { id: 'trade', verificationDate: '2026-09-14', dashboardUpdated: '2026-08-18', observationDate: '2026-07' },
      { id: 'exchange-rates', verificationDate: '2026-09-13', dashboardUpdated: '2026-09-08', observationDate: '2026-08' },
      { id: 'unrelated', verificationDate: '2026-09-20', dashboardUpdated: '2026-09-20' },
    ],
  });
  assert.equal(result.checked, '2026-09-14');
  assert.equal(result.changed, '2026-09-08');
  assert.equal(result.datasets.get('trade').observationDate, '2026-07');
});

test('KPI link markup retains natural value, period and comparison context without an overriding name', () => {
  const source = readFileSync(new URL('../../src/components/KpiCards.jsx', import.meta.url), 'utf8');
  const link = source.match(/<a\s+className="kpi-section-link"[\s\S]*?<\/a>/)?.[0];
  assert.ok(link, 'KPI content must remain inside a real section link');
  assert.doesNotMatch(link, /\baria-label(?:ledby)?=/);
  for (const className of ['kpi-label', 'kpi-value', 'kpi-period', 'kpi-change-value', 'kpi-change-basis', 'kpi-open-section']) {
    assert.ok(link.includes(`className="${className}"`), `Link must include ${className}`);
  }
});
