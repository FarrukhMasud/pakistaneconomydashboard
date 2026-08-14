import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyYoYHeadline,
  buildOverviewClauses,
  buildSnapshotKpi,
  buildTradeKpi,
  decorateOverviewKpis,
  joinClauses,
  kpiRoute,
  mergeOverviewIndicators,
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
    { id: 'inflation', value: 9.2, change: -1.9 },
    { id: 'remittances', value: 3.47, change: -0.78, changeUnit: '$B' },
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
    trade: { value: -3.55 },
    fbrGap: 20,
  });
  const sentence = joinClauses(clauses.map((clause) => (
    clause.fallback.replace('{value}', clause.value)
  )));
  assert.match(sentence, /Inflation cooled to 9\.2%/);
  assert.match(sentence, /15\.7% higher than a year earlier/);
  assert.match(sentence, /goods deficit is 3\.55 USD bn/);
  assert.match(sentence, /20 Rs bn ahead/);
});
