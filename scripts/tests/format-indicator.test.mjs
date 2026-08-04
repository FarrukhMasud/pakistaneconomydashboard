import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatIndicatorChange,
  formatIndicatorPeriod,
  formatIndicatorValue,
  indicatorDecimals,
} from '../../src/utils/formatIndicator.js';

test('formatIndicatorValue puts currency symbols before headline values', () => {
  assert.equal(formatIndicatorValue({ value: 22.44, decimals: 2, unit: '$ Billion' }), '$22.44B');
  assert.equal(formatIndicatorValue({ value: 11.23, decimals: 2, unit: 'T PKR' }), 'Rs 11.23T');
  assert.equal(formatIndicatorValue({ value: 278.6, decimals: 1, unit: 'PKR' }), 'Rs 278.6');
});

test('indicatorDecimals preserves source precision when metadata is absent', () => {
  assert.equal(indicatorDecimals({ value: 11.5 }), 1);
  assert.equal(indicatorDecimals({ value: 22.44 }), 2);
  assert.equal(indicatorDecimals({ value: 4 }), 0);
  assert.equal(indicatorDecimals({ value: 1.234, decimals: 1 }), 1);
});

test('formatIndicatorChange preserves direction and normalizes units', () => {
  assert.equal(formatIndicatorChange({ change: -0.23, changeUnit: '$B' }), '-$0.23B');
  assert.equal(formatIndicatorChange({ change: 9.7, changeUnit: '%' }), '+9.7%');
  assert.equal(formatIndicatorChange({ change: -1.9, changeUnit: 'pp' }), '-1.9pp');
});

test('formatIndicatorPeriod normalizes ISO periods', () => {
  assert.equal(formatIndicatorPeriod('2026-07-24'), 'Jul 24, 26');
  assert.equal(formatIndicatorPeriod('2026-07'), 'Jul 26');
  assert.equal(formatIndicatorPeriod('Jul-May FY2026'), 'Jul-May FY2026');
});
