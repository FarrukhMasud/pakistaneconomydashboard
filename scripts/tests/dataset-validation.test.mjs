import test from 'node:test';
import assert from 'node:assert/strict';
import { validPeriod, validateDataset } from '../lib/dataset-validation.mjs';

test('reporting periods reject null fiscal labels and invalid real dates', () => {
  for (const value of ['null FY27', 'undefined FY26', '2026-13', '2026-02-30', '']) assert.equal(validPeriod(value), false);
  for (const value of ['FY2026', 'FY26 (P)', 'Jul-Aug FY27', '2026-08', '2024-02-29']) assert.equal(validPeriod(value), true);
});

test('missing required values are not silently coerced to zeros', () => {
  assert.throws(() => validateDataset({ id: 'trade' }, { monthly: [{ date: '2026-08', exports: null, imports: 1, balance: -1 }] }), /missing/);
});

test('missing optional corridors remain null, and duplicate months fail', () => {
  const row = { date: '2026-08', total: 1, saudiArabia: null, uae: null, uk: null, usa: null, otherGcc: null, eu: null };
  assert.doesNotThrow(() => validateDataset({ id: 'remittances' }, { monthly: [row] }));
  assert.throws(() => validateDataset({ id: 'remittances' }, { monthly: [row, row] }), /duplicate/);
});

test('explicitly withheld datasets do not need invented observations', () => {
  assert.doesNotThrow(() => validateDataset({ id: 'trade' }, { publication: { status: 'withheld' } }));
});

test('future actual observations cannot be published as already observed', () => {
  const data = { monthly: [{ date: '2027-01', exports: 1, imports: 2, balance: -1 }] };
  const options = { now: new Date('2026-09-30') };
  assert.throws(() => validateDataset({ id: 'trade' }, data, options), /future observation/);
  data.monthly[0].status = 'estimate';
  assert.doesNotThrow(() => validateDataset({ id: 'trade' }, data, options));
});
