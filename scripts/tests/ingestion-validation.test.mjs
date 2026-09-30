import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  sourceNumber, publicationStatus, calendarDate, fiscalWindow, fiscalMonth,
  calendarMonthLabel, parseApiSeries, monthlyApiRows, mergeApiFields,
  sumComplete, assertReconciled, compareEquivalent, officialUrl, verifyReceipt,
  retainHistory, retainFieldHistory, consecutiveMonths, requireSourceUnit, fdiMonthlyComparison,
  automatedPublicationRecord,
} from '../lib/ingestion-validation.mjs';
import { hashContent, assessPublication } from '../lib/publication-policy.mjs';

const key = 'TS_GP_BOP_WR_M.WR0010';
const receipt = { artifactId: 'fixture-artifact', sourceKey: key, retrievedAt: '2026-08-01T00:00:00Z' };
const columns = ['Dataset Name', 'Series Key', 'Series Name', 'Observation Date', 'Observation Value', 'Unit', 'Status', 'Comments'];
const row = (date, value, status = null, comments = null, unit = 'Million US Dollar') => ['Workers Remittances', key, 'Total', date, value, unit, status, comments];
const parse = rows => parseApiSeries({ columns, rows }, key, receipt);

test('official leading-decimal values and status-comment headers parse without weakening numeric validation', () => {
  assert.equal(sourceNumber('.3'), 0.3);
  assert.equal(sourceNumber('-.222582329'), -0.222582329);
  for (const invalid of ['.', '-.', '1,23', '3percent', '1e3']) assert.throws(() => sourceNumber(invalid), /Invalid numeric/);
  const actualColumns = [...columns.slice(0, 6), 'Observation Status', 'Status Comments'];
  const result = parseApiSeries({ columns: actualColumns, rows: [row('2026-08-31', '.3', 'P', 'Provisional')] }, key, receipt);
  assert.equal(result[0].value, 0.3);
  assert.equal(result[0].comments, 'Provisional');
  assert.equal(result[0].status, 'provisional');
  assert.equal(result[0].evidence.locator.columns.comments, 8);
});

function publicationFixture() {
  const sourceBytes = Buffer.from('Archived official fixture with a parsed zero observation.');
  const sha256 = createHash('sha256').update(sourceBytes).digest('hex');
  const archived = {
    ...receipt, sourceKey: 'fixture.xls', sha256,
    sourceUrl: 'https://www.sbp.org.pk/ecodata/fixture.xls',
    responseUrl: 'https://www.sbp.org.pk/ecodata/fixture.xls',
    parserVersion: `parse-sbp-excel.mjs:sha256:${'a'.repeat(64)}:environment:${'b'.repeat(64)}`,
  };
  return {
    path: 'measure', value: 0, receipt: archived, sourceBytes,
    evidence: { ...receipt, sourceKey: archived.sourceKey, locator: { sheet: 'Annual', row: 6, column: 30, cell: 'AD6' } },
    status: 'revised',
  };
}

test('automated numeric envelope matches policy schema, binds original bytes and value, and preserves true zero/status', () => {
  const input = publicationFixture();
  const record = automatedPublicationRecord(input, { verifiedAutomatedClaims: { measure: hashContent(0) } });
  assert.deepEqual(record, {
    sourceType: 'official-primary', sourceKey: 'fixture.xls',
    artifactId: receipt.artifactId, evidenceHash: input.receipt.sha256,
    sourceUrl: input.receipt.sourceUrl, location: JSON.stringify(input.evidence.locator),
    method: 'automated', contentHash: hashContent(0), status: 'revised',
  });
  assert.equal(assessPublication(
    { id: 'fixture', parser: 'parse-sbp-excel.mjs' },
    { measure: 0, publicationEvidence: { measure: record } },
    { evidence: { [receipt.artifactId]: input.receipt } },
  ).ok, true);
  assert.equal(automatedPublicationRecord(
    { ...input, status: undefined }, { verifiedAutomatedClaims: { measure: hashContent(0) } },
  ).status, 'not-stated');
  const pdf = automatedPublicationRecord({
    ...input, evidence: { ...input.evidence, locator: { page: 1, x: 0, y: 12.5 } },
  }, { verifiedAutomatedClaims: { measure: hashContent(0) } });
  assert.equal(pdf.location, '{"page":1,"x":0,"y":12.5}');
});

test('API automated envelope uses actual independently parsed archived value and rejects invalid dates or zero-based columns', () => {
  const raw = { columns, rows: [row('2026-08-01', 0, 'R')] };
  const sourceBytes = Buffer.from(JSON.stringify(raw));
  const apiReceipt = {
    ...publicationFixture().receipt, sourceKey: key,
    sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    sourceUrl: `https://easydata.sbp.org.pk/api/series/${key}/data`,
    responseUrl: `https://easydata.sbp.org.pk/api/series/${key}/data`,
    parserVersion: `update-data.mjs:sha256:${'a'.repeat(64)}:environment:${'b'.repeat(64)}`,
  };
  const independentlyParsed = parseApiSeries(JSON.parse(sourceBytes.toString('utf8')), key, apiReceipt)[0];
  const claim = { path: 'monthly.0.total', value: 0, evidence: independentlyParsed.evidence, receipt: apiReceipt, sourceBytes, status: independentlyParsed.status };
  const options = { verifiedAutomatedClaims: { [claim.path]: hashContent(independentlyParsed.value) } };
  const record = automatedPublicationRecord(claim, options);
  assert.equal(record.status, 'revised');
  const data = {
    monthly: [{
      date: '2026-08', total: 0, evidence: { total: claim.evidence },
      observations: { total: { observationDate: independentlyParsed.observationDate, status: independentlyParsed.status } },
    }],
    publicationEvidence: { [claim.path]: record },
  };
  const policyOptions = { ...options, evidence: { [apiReceipt.artifactId]: apiReceipt } };
  const dataset = { id: 'fixture', parser: 'update-data.mjs' };
  assert.equal(assessPublication(dataset, data, policyOptions).ok, true);
  assert.equal(assessPublication(dataset, data, { evidence: policyOptions.evidence }).ok, false);
  const locator = claim.evidence.locator;
  assert.throws(() => automatedPublicationRecord({
    ...claim, evidence: { ...claim.evidence, locator: { ...locator, observationDate: '2026-02-30' } },
  }, options), /Invalid calendar/);
  assert.throws(() => automatedPublicationRecord({
    ...claim, evidence: { ...claim.evidence, locator: { ...locator, columns: { ...locator.columns, date: 0 } } },
  }, options), /exact source observation locator/);
});

test('official-page receipts and automated labels cannot promote manual text, stale values, missing archives or broad scopes', () => {
  const input = publicationFixture();
  const verified = { verifiedAutomatedClaims: { measure: hashContent(0) } };
  assert.throws(() => automatedPublicationRecord(input), /independently reparsed/);
  assert.throws(() => automatedPublicationRecord({ ...input, value: 1 }, verified), /independently reparsed/);
  for (const value of ['Growth will improve', { value: 0 }, [0], null, NaN, Infinity]) {
    assert.throws(() => automatedPublicationRecord({ ...input, value }, verified));
  }
  for (const path of ['', 'monthly.*.total', 'monthly..total']) {
    assert.throws(() => automatedPublicationRecord({ ...input, path }, verified), /concrete field path/);
  }
  assert.throws(() => automatedPublicationRecord({ ...input, sourceBytes: undefined }, verified), /archived source bytes/);
  assert.throws(() => automatedPublicationRecord({ ...input, sourceBytes: Buffer.from('different bytes') }, verified), /do not match/);
  assert.throws(() => automatedPublicationRecord({ ...input, receipt: { ...input.receipt, artifactId: 'different' } }, verified), /original parser-backed artifact/);
  assert.throws(() => automatedPublicationRecord({ ...input, evidence: { ...input.evidence, locator: {} } }, verified), /exact source observation locator/);
  assert.throws(() => automatedPublicationRecord({ ...input, status: 'approved' }, verified), /Unknown issuer publication status/);
  assert.throws(() => automatedPublicationRecord({
    ...input, receipt: { ...input.receipt, sourceUrl: `${input.receipt.sourceUrl}?api_key=secret` },
  }, verified), /credential-free/);
});

test('required source cells reject missing, suppressed, coercible non-numbers and malformed numeric text', () => {
  for (const value of [null, undefined, '', ' ', '-', '...', 'suppressed', false, true, {}, [], '12abc', '1,20', '1,000,00', NaN, Infinity]) {
    assert.throws(() => sourceNumber(value));
  }
  assert.equal(sourceNumber(0), 0);
  assert.equal(sourceNumber('0'), 0);
  assert.equal(sourceNumber('1,234.50'), 1234.5);
  assert.equal(sourceNumber('-12,345.60'), -12345.6);
  assert.equal(sourceNumber(null, { required: false }), null);
  assert.equal(sourceNumber('confidential', { required: false }), null);
  assert.throws(() => sourceNumber('invalid', { required: false }));
});

test('API explicit schema preserves zero, missing/suppressed values, issuer status, comments and exact evidence', () => {
  const parsed = parse([
    row('2026-08-01', null, 'P', 'not reported'),
    row('2026-07-01', '0', 'R', 'revision'),
    row('2026-09-01', '...', null, 'suppressed'),
    row('2026-06-01', '1,000.25'),
  ]);
  assert.deepEqual(parsed.map(item => item.value), [1000.25, 0, null, null]);
  assert.equal(parsed[1].status, 'revised');
  assert.equal(parsed[1].sourceStatus, 'R');
  assert.equal(parsed[1].comments, 'revision');
  assert.equal(parsed[0].status, 'not-stated');
  assert.equal(parsed[2].missingReason, 'not-reported');
  assert.equal(parsed[3].missingReason, 'source-unavailable');
  assert.equal(parsed[1].evidence.artifactId, receipt.artifactId);
  assert.equal(parsed[1].evidence.locator.observationDate, '2026-07-01');
  assert.equal(parsed[1].evidence.locator.row, 2);
  assert.equal(parsed[1].evidence.locator.column, 5);
  assert.equal(parsed[1].evidence.locator.columns.status, 7);
  assert.equal(parsed[1].evidence.rawValue, '0');
});

test('API maps reordered headers and rejects positional/ambiguous schemas and malformed observations', () => {
  const order = [4, 3, 7, 1, 6, 5, 0, 2];
  const sample = row('2026-07-01', 3);
  assert.equal(parseApiSeries({ columns: order.map(index => columns[index]), rows: [order.map(index => sample[index])] }, key, receipt)[0].value, 3);
  assert.throws(() => parseApiSeries({ rows: [sample] }, key, receipt), /explicit columns/);
  assert.throws(() => parseApiSeries({ columns: [...columns, 'Observation Value'], rows: [[...sample, 3]] }, key, receipt), /ambiguous/);
  assert.throws(() => parse([row('2026-02-30', 3)]), /calendar/);
  assert.throws(() => parse([row('2026-01-01', 'invalid')]), /numeric/);
  assert.throws(() => parse([row('2026-01-01', 3, null, null, '')]), /unit/);
  assert.throws(() => parse([sample, sample]), /Duplicate/);
  assert.throws(() => parse([sample, row('2026-08-01', 4, null, null, 'Thousand US Dollar')]), /unit changes/);
  assert.throws(() => parseApiSeries({ columns, rows: [[...sample.slice(0, 1), 'another-series', ...sample.slice(2)]] }, key, receipt), /series/);
  assert.throws(() => parseApiSeries({ columns, rows: [[...sample, 'extra']] }, key, receipt), /schema/);
});

test('monetary monthly observations select actual latest weekly date irrespective of response order', () => {
  const parsed = parse([row('2026-07-31', 11, 'P'), row('2026-07-03', 3, 'R'), row('2026-08-07', 12), row('2026-07-17', 7)]);
  const monthly = monthlyApiRows(parsed, { weekly: true });
  assert.equal(monthly[0].value, 11);
  assert.equal(monthly[0].date, '2026-07');
  assert.equal(monthly[0].observationDate, '2026-07-31');
  assert.equal(monthly[0].evidence.locator.observationDate, '2026-07-31');
  assert.equal(monthly[0].status, 'provisional');
  assert.throws(() => monthlyApiRows(parsed), /Duplicate source month/);
  assert.equal(monthlyApiRows(parse([row('2026-07-31', null), row('2026-07-03', 3)]), { weekly: true })[0].value, null);
});

test('remittance date union retains real zeros and leaves absent corridors and totals null', () => {
  const monthly = mergeApiFields({
    total: parse([row('2026-07-01', 100), row('2026-08-01', 0)]),
    usa: parse([row('2026-08-01', 0), row('2026-09-01', 3)]),
  }, ['total', 'usa', 'uk']);
  assert.deepEqual(monthly.map(item => [item.total, item.usa, item.uk]), [[100, null, null], [0, 0, null], [null, 3, null]]);
  assert.equal(monthly[0].evidence.usa, undefined);
  assert.equal(monthly[1].observations.usa.sourceStatus, null);
  assert.equal(sumComplete(monthly.map(item => item.usa)), null);
  assert.equal(sumComplete([0, 0]), 0);
});

test('no guessed publication status or units', () => {
  assert.equal(publicationStatus('FY27'), 'not-stated');
  assert.equal(publicationStatus('FY27R'), 'revised');
  assert.equal(publicationStatus('Jul-Aug FY27 (P)'), 'provisional');
  assert.equal(publicationStatus('FY27 (F)'), 'final');
  assert.equal(publicationStatus('Unknown issuer flag'), 'not-stated');
  assert.equal(publicationStatus(null), 'not-stated');
  assert.doesNotThrow(() => requireSourceUnit(parse([row('2026-07-01', 1)]), 'US$ million'));
  assert.throws(() => requireSourceUnit(parse([row('2026-07-01', 1, null, null, 'US Dollar')]), 'US$ million'));
  assert.throws(() => requireSourceUnit(parse([row('2026-07-01', 1, null, null, 'Million PKR')]), 'US$ million'));
});

test('calendar and Pakistani FY periods are validated through rollover without guessing', () => {
  assert.equal(calendarDate('2024-02-29'), '2024-02-29');
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '2026:05- 08', '2026-02', null]) assert.throws(() => calendarDate(value));
  assert.equal(fiscalMonth('Jul', 'FY27'), '2026-07');
  assert.equal(fiscalMonth('Jan', 'FY27'), '2027-01');
  assert.deepEqual(fiscalWindow('Jul-Aug FY27', 'FY27'), { start: '2026-07', end: '2026-08', fiscalYear: 2027 });
  assert.deepEqual(fiscalWindow('Jul FY27', 'FY27'), { start: '2026-07', end: '2026-07', fiscalYear: 2027 });
  assert.equal(calendarMonthLabel('Dec-99 (R)'), '1999-12');
  for (const value of ['null FY27', 'Jul-Blah FY27', 'Jul-Aug FY270', 'Jan-Mar FY27', 'Jul-Aug nonsense', 'Jul-Aug']) assert.throws(() => fiscalWindow(value));
  assert.throws(() => fiscalMonth('Julyblah', 'FY27'));
  assert.throws(() => fiscalWindow('Jul-Aug FY26', 'FY27'), /Conflicting fiscal years/);
  assert.throws(() => fiscalWindow('Jul-Aug FY270', 'FY27'));
});

test('independent reconciliation fails discrepancies and rejects statistical basis/unit mixing', () => {
  assert.equal(assertReconciled('net FDI', 4, [10, -6]).result, 'matched');
  assert.throws(() => assertReconciled('missing component', 4, [10, null]), /reconciliation failed/);
  assert.throws(() => assertReconciled('wrong total', 4, [10, -5]), /reconciliation failed/);
  const left = { start: '2026-07', end: '2026-08', basis: 'BOP', unit: 'US$ million', value: 10 };
  assert.equal(compareEquivalent('matching', left, { ...left, value: 10.1 }).result, 'matched');
  assert.throws(() => compareEquivalent('contradiction', left, { ...left, value: 13 }), /reconciliation/);
  assert.equal(compareEquivalent('lagging summary', left, { ...left, end: '2026-07' }).result, 'not-comparable');
  assert.equal(compareEquivalent('suppressed', left, { ...left, value: null }).reason, 'missing-observations');
  assert.throws(() => compareEquivalent('customs is not BOP', left, { ...left, basis: 'PBS-customs' }), /bases/);
  assert.throws(() => compareEquivalent('no unit fallback', left, { ...left, unit: 'US$ thousand' }), /units/);
});

test('immutable receipt must match exact source key and bytes and official HTTPS domain', () => {
  const body = Buffer.from('official data fixture');
  const artifact = { ...receipt, sha256: createHash('sha256').update(body).digest('hex'), sourceUrl: 'https://www.sbp.org.pk/data.xls', responseUrl: 'https://archive.sbp.org.pk/data.xls' };
  assert.equal(verifyReceipt(artifact, body, key), artifact);
  assert.throws(() => verifyReceipt(null, body, key), /receipt/);
  assert.throws(() => verifyReceipt(artifact, Buffer.from('changed bytes'), key), /do not match/);
  assert.throws(() => verifyReceipt(artifact, body, 'another key'), /receipt/);
  assert.throws(() => verifyReceipt({ ...artifact, sourceUrl: 'https://sbp.org.pk.example.com/data.xls' }, body, key), /official/);
  assert.equal(officialUrl('https://easydata.sbp.org.pk/api?api_key=secret&format=json&token=secret'), 'https://easydata.sbp.org.pk/api?format=json');
  for (const url of ['http://sbp.org.pk/a', 'https://example.com/a', 'https://user:pass@sbp.org.pk/a']) assert.throws(() => officialUrl(url));
});

test('historical observations retain their original evidence when no new matching source row exists', () => {
  const older = { date: '2025-01', value: 7, evidence: { artifactId: 'old', retrievedAt: '2025-02-01' } };
  const current = { date: '2026-07', value: 8, evidence: { artifactId: 'new', retrievedAt: '2026-08-01' } };
  assert.equal(retainHistory([older], [current])[0], older);
  const previous = [{ date: '2026-07', total: 7, usa: 1, evidence: { total: older.evidence, usa: older.evidence } }];
  const incoming = mergeApiFields({ total: parse([row('2026-07-01', 10)]) }, ['total', 'usa']);
  const merged = retainFieldHistory(previous, incoming, ['total', 'usa'])[0];
  assert.equal(merged.total, 10);
  assert.equal(merged.usa, 1);
  assert.equal(merged.evidence.usa, older.evidence);
  const explicitlyMissing = mergeApiFields({ total: parse([row('2026-07-01', null)]) }, ['total', 'usa']);
  assert.equal(retainFieldHistory(previous, explicitlyMissing, ['total', 'usa'])[0].total, null);
});

test('FDI monthly comparisons preserve null and evidence and advance correctly from December to January within one FY', () => {
  const existing = { month: 'Dec', current: { label: 'FY2027', net_fdi: 9 } };
  const rows = [
    { date: '2027-01', net_fdi: null, observations: { net_fdi: { status: 'provisional', sourceStatus: 'P' } }, evidence: { net_fdi: receipt } },
    { date: '2026-01', net_fdi: 0, evidence: { net_fdi: { artifactId: 'old' } } },
  ];
  const compared = fdiMonthlyComparison(rows, existing);
  assert.equal(compared.month, 'Jan');
  assert.equal(compared.current.label, 'FY2027');
  assert.equal(compared.current.net_fdi, null);
  assert.equal(compared.current.status, 'provisional');
  assert.equal(compared.current.evidence.net_fdi, receipt);
  assert.equal(compared.prior.net_fdi, 0);
  assert.equal(fdiMonthlyComparison([rows[0]]).prior, null);
  assert.equal(fdiMonthlyComparison([{ date: '2026-11', net_fdi: 0 }], existing), existing);
});

test('trailing totals require continuous month coverage, including December/January', () => {
  assert.equal(consecutiveMonths([{ date: '2026-12' }, { date: '2027-01' }]).length, 2);
  assert.throws(() => consecutiveMonths([{ date: '2026-12' }, { date: '2027-02' }]), /Non-contiguous/);
  assert.equal(consecutiveMonths([{ date: '2026-12' }, { date: '2027-02' }], 'date', { allowGaps: true }), null);
  assert.throws(() => consecutiveMonths([{ date: '2026-19' }], 'date', { allowGaps: true }), /calendar/);
});
