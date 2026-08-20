import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyShareableChartState,
  parseShareableChartState,
} from '../../src/hooks/useShareableChartState.js';
import { embedSnippet, sectionUrl } from '../../src/utils/shareLinks.js';
import {
  formatKpiNumber,
  formatKpiPeriod,
  formatKpiUnit,
  getKpiDecimals,
  isProvisionalPeriod,
} from '../../src/utils/kpiFormat.js';

test('shareable chart state round-trips while preserving unrelated query parameters', () => {
  const search = applyShareableChartState('?lang=ur', { compare: 'fytd', focus: 1 }, 'off');
  assert.equal(search, '?lang=ur&compare=fytd&series=1');
  assert.deepEqual(parseShareableChartState(search, 'off'), { compare: 'fytd', focus: 1 });
});

test('embed snippet is a titled iframe of the section URL', () => {
  const html = embedSnippet('https://economyofpakistan.com/external/reserves?embed=1', 'Reserves');
  assert.match(html, /<iframe src="https:\/\/economyofpakistan.com\/external\/reserves\?embed=1"/);
  assert.match(html, /title="Reserves — Pakistan Economic Dashboard"/);
});

test('sectionUrl keeps chart state and can add an embed flag', () => {
  const url = sectionUrl('external', 'reserves', {
    embed: true,
    origin: 'https://economyofpakistan.com',
    pathname: '/external/reserves',
    search: '?compare=yoy',
  });
  assert.equal(url, 'https://economyofpakistan.com/external/reserves?compare=yoy&embed=1');
});

test('default chart state is omitted from the URL', () => {
  assert.equal(
    applyShareableChartState('?compare=yoy&series=2', { compare: 'yoy', focus: null }, 'yoy'),
    '',
  );
});

test('KPI presentation standardizes periods, units, and provisional labels', () => {
  assert.equal(formatKpiPeriod('2026-07'), 'Jul 2026');
  assert.equal(formatKpiPeriod('2026-07-31'), '31 Jul 2026');
  assert.equal(formatKpiPeriod('Jul-Jun FY26 (P)'), 'Jul-Jun FY2026 (P)');
  assert.equal(formatKpiUnit('$B'), 'USD bn');
  assert.equal(formatKpiUnit('T PKR'), 'Rs tn');
  assert.equal(isProvisionalPeriod('Jul-Jun FY26 (P)'), true);
  assert.equal(getKpiDecimals({ value: 22.47 }), 2);
  assert.equal(getKpiDecimals({ value: 3.7 }), 1);
  assert.equal(formatKpiNumber({ value: 11.5, unit: '%' }), '11.5');
});
