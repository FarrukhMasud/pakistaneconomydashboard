import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canonicalProvenanceFigure, classifyObservationChange, collectEvidenceRows, evidenceListOf, evidenceOf, fieldIsWithheld, finiteSum, freshnessStatus,
  freshnessWithCanonical, hasPublishedFigures, locatorLabel, prepareDataset, previewItemAllowed, publishedData,
  provenanceFigureAllowed, provenanceTarget, resolveFigureMetadata, resolveSourceTier, restrictIndicator, safeSourceUrl, sourceFigureStatus, validationStatus,
} from '../figureTrust.js';
import { resolveWatchlistItems } from '../watchlistModel.js';
import { avgField, currentCalendarYear, currentFiscalYear, deriveFiscalLabels, pctChange, sumField, toFYLabel } from '../periodHelpers.js';
import { buildSnapshotKpi, buildTradeKpi, trendArrow } from '../overviewModel.js';

const official = { sourceType: 'official-primary', sourceUrl: 'https://www.sbp.org.pk/data.xlsx' };
const partial = (withheldFields) => ({ policy: 'official-only', status: 'partial', reason: 'Unpublished inputs', withheldFields });
const artifact = { artifactId: 'sbp-one', sourceUrl: official.sourceUrl, path: '/source-evidence/sbp-one.xlsx', retrievedAt: '2026-08-01', locator: { sheet: 'Stock', row: 9, column: 'C' } };

test('persisted quality check outcomes use the trust UI contract', () => {
  const quality = JSON.parse(readFileSync(resolve('public', 'data', 'data-quality.json'), 'utf8'));
  for (const validation of Object.values(quality.datasets)) {
    assert.equal(validationStatus({ validation }), validation.status);
  }
});

test('nested source headers remain readable in exact locators', () => {
  assert.equal(locatorLabel({ periodHeader: { text: 'Jul-Aug', page: 1 } }), 'periodHeader: {"text":"Jul-Aug","page":1}');
});

test('source tiers do not equate freshness, unknown sources or press with official evidence', () => {
  assert.equal(resolveSourceTier({ sourceType: 'official' }), 'official-primary');
  assert.equal(resolveSourceTier({ authenticity: 'official-derived' }), 'official-derived');
  assert.equal(resolveSourceTier({ sourceType: 'secondary-attributed', status: 'fresh' }), 'unverified');
  assert.equal(resolveSourceTier({ status: 'fresh' }), 'unverified');
  assert.equal(resolveSourceTier({ ...official, publication: { status: 'withheld' } }), 'unavailable');
});

test('withheld datasets are normal unavailable results and the stricter policy wins', () => {
  const raw = { ...official, value: 9, publication: { policy: 'official-only', status: 'published' } };
  const metadata = { publication: { policy: 'official-only', status: 'withheld', reason: 'Awaiting official release' } };
  const result = prepareDataset(raw, metadata);
  assert.equal(result.data, null);
  assert.equal(result.unavailable.reason, metadata.publication.reason);
  assert.equal(result.publication.status, 'withheld');
  assert.equal(raw.value, 9);
});

test('canonical partial policy and metadata path restrictions are unioned', () => {
  const result = prepareDataset({ ...official, a: 1, b: 2, c: 3, publication: partial(['a']) }, { publication: partial(['b']) });
  assert.deepEqual(result.publication.withheldFields, ['a', 'b']);
  assert.deepEqual([result.data.a, result.data.b, result.data.c], [null, null, 3]);
});

test('numeric, wildcard, date, ID and nested selectors project without mutating source data', () => {
  const raw = {
    ...official, publication: partial(['monthly.2026-01', 'monthly.2026-02.target', 'fyTotals.FY2026',
      'weekly[*].sbp', '/items/0/value']),
    monthly: [{ date: '2025-12', net: 8, target: 10 }, { date: '2026-01', net: 9 }, { date: '2026-02', net: 7, target: 10 }],
    fyTotals: [{ fy: 'FY2025', value: 80 }, { fy: 'FY2026', value: 90 }],
    weekly: [{ date: '2026-01-01', sbp: 5, total: 10 }], items: [{ value: 4 }],
  };
  const before = structuredClone(raw);
  const projected = publishedData(raw);
  assert.deepEqual(projected.monthly.map((row) => row.date), ['2025-12', '2026-02']);
  assert.equal(projected.monthly[1].target, null);
  assert.deepEqual(projected.fyTotals, [{ fy: 'FY2025', value: 80 }]);
  assert.equal(projected.weekly[0].sbp, null);
  assert.equal(projected.weekly[0].total, 10);
  assert.equal(projected.items[0].value, null);
  assert.equal(fieldIsWithheld(raw, '/weekly/0/sbp'), true);
  assert.deepEqual(raw, before);
});

test('restricted scalars preserve null gaps and restricted collections remain empty, not zero', () => {
  const projected = publishedData({
    ...official, publication: partial(['monthly', 'seriesNode', 'values.1']),
    monthly: [{ value: 9 }], values: [1, 2, null, 4],
    seriesNode: { label: 'Revenue', unit: 'PKR', data: [1, 2], numericSummary: 999 }, fyTotals: null,
  });
  assert.deepEqual(projected.monthly, []);
  assert.deepEqual(projected.values, [1, null, null, 4]);
  assert.equal(projected.seriesNode.numericSummary, undefined);
  assert.deepEqual(projected.fyTotals, []);
});

test('row evidence attaches before restricted rows are removed, preserving original locator indexes', () => {
  const raw = { ...official, monthly: [{ date: '2026-01', net: 9 }, { date: '2025-06', net: 8 }],
    publication: partial(['monthly.0']), publicationEvidence: {
      'monthly.1': { ...artifact, sourceType: 'official-primary', status: 'final' },
    } };
  const [row] = publishedData(raw).monthly;
  assert.equal(row.date, '2025-06');
  assert.equal(row.evidence.artifactId, artifact.artifactId);
  assert.equal(row.evidence.locator.row, 9);
  assert.equal(row.status, 'final');
  assert.equal(raw.monthly[1].evidence, undefined);
});

test('certified canonical stock/history survives stale legacy press classification', () => {
  const raw = {
    stock: { value: 138.85, asOf: '2026-06-30', status: 'provisional' }, repayments: { value: 30 },
    publication: partial(['repayments']),
    publicationEvidence: { stock: { ...artifact, sourceType: 'official-primary', status: 'provisional' } },
  };
  const result = prepareDataset(raw, { sourceType: 'secondary-attributed', sourceLabel: 'Unsupported press claim' });
  assert.equal(result.unavailable, null);
  assert.equal(result.data.stock.value, 138.85);
  assert.equal(result.data.repayments, null);
  assert.equal(resolveSourceTier(result.data), 'official-primary');
  assert.equal(result.data.sourceLabel, null);
  assert.equal(resolveFigureMetadata(result.data, result.data.stock, { field: 'stock' }).evidence.artifactId, artifact.artifactId);
  assert.equal(prepareDataset(raw, { authenticity: 'unverified' }).data, null);
});

test('publication proofs resolve their immutable receipt by artifact ID, retaining the exact field locator', () => {
  const receipt = { ...artifact, locator: undefined, parserVersion: 'actual-parser-sha' };
  const proof = { artifactId: artifact.artifactId, sourceUrl: official.sourceUrl,
    sourceType: 'official-primary', status: 'provisional', location: 'Outstanding table; total row; June 2026 column' };
  const raw = {
    stock: { totalExternalDebtAndLiabilities: 138.85, imfOutstanding: 11.05, asOf: '2026-06-30', status: 'provisional' },
    fy26: { grossRepayment: null }, fy27: { grossRepayment: null }, repaymentSplit: [], eurobonds: [],
    publication: partial(['fy26', 'fy27', 'repaymentSplit', 'eurobonds']),
    publicationEvidence: { stock: proof }, sourceEvidence: { 'pakdebt.pdf': receipt },
  };
  const data = prepareDataset(raw, { sourceType: 'secondary-attributed' }).data;
  const evidence = evidenceOf(data.stock);
  assert.equal(evidence.artifactUrl, receipt.path);
  assert.equal(evidence.retrievedAt, receipt.retrievedAt);
  assert.equal(evidence.parserVersion, receipt.parserVersion);
  assert.equal(evidence.locator, proof.location);
  assert.equal(data.stock.status, 'provisional');
  assert.equal(data.stock.totalExternalDebtAndLiabilities, 138.85);
  assert.equal(data.fy26, null);
  assert.equal(data.fy27, null);
  assert.equal(evidenceOf(resolveFigureMetadata(raw, raw.stock, { field: 'stock.imfOutstanding' })).artifactUrl, receipt.path);
  assert.equal(raw.stock.evidence, undefined);
  assert.equal(raw.publicationEvidence.stock.path, undefined);
});

test('an unrelated source receipt cannot supply an artifact, retrieval date or parser for a figure', () => {
  const context = { sourceEvidence: { sameSource: { ...artifact, artifactId: 'other-capture' } } };
  const resolved = evidenceOf({ evidence: { artifactId: artifact.artifactId, sourceUrl: official.sourceUrl } }, context);
  assert.equal(resolved.artifactUrl, null);
  assert.equal(resolved.retrievedAt, null);
  assert.equal(resolved.parserVersion, undefined);
  assert.equal(resolved.sourceUrl, official.sourceUrl);
});

test('archived source bytes and parser metadata are not financial figures or plotted observations', () => {
  const metadataOnly = { ...official, sourceEvidence: { workbook: { ...artifact, bytes: 344625, locator: { row: 2026 } } },
    monthly: [{ date: '2026-06', total: null }] };
  assert.equal(hasPublishedFigures(metadataOnly), false);
  assert.deepEqual(collectEvidenceRows(metadataOnly), []);
  assert.equal(hasPublishedFigures({ ...metadataOnly, monthly: [{ date: '2026-06', total: 0 }] }), true);
});

test('native API evidence maps select the exact value and its recorded status/comments, never a sibling series', () => {
  const row = { date: '2026-07', total: 9000, usa: 0, evidence: { total: artifact,
    usa: { ...artifact, artifactId: 'usa-series', locator: { seriesKey: 'remit-usa', observationDate: '2026-07-31' } } },
    observations: { total: { status: 'revised', sourceStatus: 'R', comments: 'Revised by source', observationDate: '2026-07-31' },
      usa: { status: 'provisional', sourceStatus: 'P', comments: 'Provisional observation' } } };
  const total = resolveFigureMetadata(null, row, { field: 'monthly.total' });
  const usa = resolveFigureMetadata(null, row, { field: 'usa' });
  assert.equal(evidenceOf(total).artifactId, artifact.artifactId);
  assert.equal(total.status, 'revised');
  assert.equal(total.observationDate, '2026-07-31');
  assert.equal(total.comments, 'Revised by source');
  assert.equal(evidenceOf(usa).artifactId, 'usa-series');
  assert.equal(usa.status, 'provisional');
  assert.equal(usa.usa, 0);
  assert.equal(sourceFigureStatus(row), 'unknown');
  assert.equal(evidenceListOf(row).length, 2);
  assert.equal(evidenceListOf(row)[1].sourceStatus, 'P');
});

test('withheld native value evidence is removed rather than re-exporting its raw numeric observation', () => {
  const row = { date: '2026-07', total: 9000, usa: 80,
    evidence: { total: artifact, usa: { ...artifact, artifactId: 'restricted-series', rawValue: 80 } } };
  const data = publishedData({ ...official, monthly: [row], publication: partial(['monthly.0.usa']) });
  assert.equal(data.monthly[0].usa, null);
  assert.equal(data.monthly[0].evidence.usa, undefined);
  assert.equal(evidenceOf(resolveFigureMetadata(data, data.monthly[0], { field: 'monthly.total' })).artifactId, artifact.artifactId);
  assert.equal(row.evidence.usa.rawValue, 80);
});

test('derived evidence inputs preserve every contributing artifact, locator and real retrieval date', () => {
  const row = { period: 'Trailing 12 months', value: 10, evidence: {
    derivation: 'sum', complete: true, inputs: [artifact, { ...artifact, artifactId: 'second-month', locator: { seriesKey: 'remit', observationDate: '2026-07-31' } }],
  } };
  const inputs = evidenceListOf(row);
  assert.equal(inputs.length, 2);
  assert.equal(inputs[1].locator.observationDate, '2026-07-31');
  assert.equal(inputs[1].retrievedAt, artifact.retrievedAt);
  assert.equal(resolveFigureMetadata(null, row).derivation, 'sum');
  assert.equal(evidenceListOf({ evidence: { derivation: 'sum', complete: false, inputs: [] } })[0].artifactUrl, null);
});

test('services headline columns use their own evidence and source status rather than borrowing latest', () => {
  const headline = { latestMonth: '2026-07', latest: 394, fytd: 4183,
    evidence: { latest: artifact, fytd: { ...artifact, locator: { column: 'Jul–Jun FY2026' } } },
    statuses: { latest: 'provisional', fytd: 'revised' }, sourceStatuses: { latest: 'P', fytd: 'R' } };
  const figure = resolveFigureMetadata(null, headline, { field: 'itHeadline.fytd' });
  assert.equal(sourceFigureStatus(figure), 'revised');
  assert.equal(figure.sourceStatus, 'R');
  assert.equal(evidenceOf(figure).locator.column, 'Jul–Jun FY2026');
});

test('numeric sidecar reconciliation inputs and per-value receipt bytes are not economic observations', () => {
  assert.equal(hasPublishedFigures({ ...official, monthly: [{ value: null, totalEvidence: { ...artifact, bytes: 400 } }],
    reconciliation: [{ left: 10, right: 10 }], derivedInputs: [{ value: 10 }], observations: { value: 20 } }), false);
});

test('retained closed-year FBR rows preserve their original proof and receipt while FYTD remains unavailable', () => {
  const raw = { monthly: [{ date: '2025-06', net: 1589, status: 'provisional' }, { date: '2026-06', net: 999 }],
    fytd: { net: null, target: null, priorNet: null }, annualTargets: [],
    publication: partial(['monthly.1', 'fytd', 'annualTargets']),
    publicationEvidence: { 'monthly.0': { artifactId: artifact.artifactId, sourceUrl: official.sourceUrl,
      sourceType: 'official-primary', status: 'provisional', location: 'Month-wise net collection; June FY2025 row' } },
    sourceEvidence: { 'fbr-monthwise-FY2024-25.pdf': artifact } };
  const data = prepareDataset(raw, { sourceType: 'secondary-attributed' }).data;
  assert.equal(data.monthly.length, 1);
  assert.equal(data.monthly[0].net, 1589);
  assert.equal(data.monthly[0].status, 'provisional');
  assert.equal(evidenceOf(data.monthly[0]).artifactUrl, artifact.path);
  assert.equal(evidenceOf(data.monthly[0]).locator, raw.publicationEvidence['monthly.0'].location);
  assert.equal(data.fytd, null);
  assert.deepEqual(data.annualTargets, []);
});

test('legacy aggregates keep certified KPIs but block canonical withheld, partial and missing dependencies', () => {
  const freshness = { datasets: [{ ...official, id: 'reserves' }, { ...official, id: 'fbr-tax' }, { ...official, id: 'monetary-policy' }] };
  const inputs = {
    'fbr-tax': { data: { ...official, publication: partial(['fytd']) } },
    'monetary-policy': { data: { ...official, publication: { policy: 'official-only', status: 'withheld', reason: 'No official evidence' } } },
  };
  const result = prepareDataset({ indicators: [
    { id: 'reserves', value: 5 }, { id: 'fbr-tax', value: 10, change: 3, note: 'A stale claim' },
    { id: 'policy-rate', value: 11 }, { id: 'public-debt', value: 99 }, { id: 'unknown', value: 88 },
  ] }, undefined, freshness, 'kpi-summary', inputs);
  assert.deepEqual(result.data.indicators.map((row) => row.id), ['reserves', 'public-debt', 'unknown']);
  assert.equal(result.data.indicators[0].value, 5);
  for (const row of result.data.indicators.slice(1)) {
    assert.equal(row.value, null);
    assert.ok(row.unavailable);
    assert.equal(row.note, null);
    assert.equal(row.sentiment, 'neutral');
  }
});

test('canonical freshness merge never copies financial values into the metadata export', () => {
  const merged = freshnessWithCanonical({ datasets: [{ id: 'trade', ...official }] }, {
    trade: { data: { ...official, monthly: [{ balance: -90 }], publication: partial(['monthly']) } },
    reserves: { data: null, error: new Error('HTTP 503') },
  });
  assert.equal(merged.datasets[0].monthly, undefined);
  assert.equal(resolveSourceTier(merged.datasets[1]), 'unavailable');
  assert.equal(merged.datasets[1].freshnessStatus, 'fetch-failed');
});

test('logical citation aliases use canonical fields and cannot leak partial unavailable fields', () => {
  assert.equal(provenanceTarget('exchange-rates.monthly.usd').field, 'monthly.USD');
  assert.equal(provenanceFigureAllowed('exchange-rates.monthly.usd', { value: 277.92 }, { ...official, monthly: [{ USD: 277.9154 }] }), true);
  assert.deepEqual(provenanceTarget('monetaryPolicy.currentRate'), { datasetId: 'monetary-policy', field: 'currentRate' });
  assert.equal(provenanceTarget('inflation.nationalCpi.latest').field, 'national_cpi');
  assert.equal(provenanceTarget('fiscal.gdpGrowth.latest').field, 'annual');
  const source = { ...official, publication: partial(['itHeadline.fytd']), summary: { itTelecomCredit: 4183 },
    itHeadline: { latest: 394, fytd: null }, bopSummary: { cumulative: { net: -562 } } };
  assert.equal(provenanceFigureAllowed('services.itTelecom.credit', { value: 4.18 }, source), true);
  assert.equal(provenanceFigureAllowed('services.bop.cumulative', { value: -562 }, source), true);
  assert.equal(provenanceFigureAllowed('services.itHeadline.fytd', { value: 0.811 }, source), false);
  assert.equal(provenanceFigureAllowed('services.unknownPath', { value: 999 }, source), false);
  assert.equal(provenanceFigureAllowed('services.itTelecom.credit', { value: null }, source), false);
});

test('legacy citation defaults and headline timestamps cannot impersonate source status or retrieval', () => {
  const raw = { value: 9, period: '2026-07', status: 'final', retrievedAt: '2026-09-30' };
  const legacy = canonicalProvenanceFigure('reserves.weekly.total', raw, official);
  assert.equal(legacy.status, 'unknown');
  assert.equal(legacy.retrievedAt, undefined);
  const certified = canonicalProvenanceFigure('reserves.weekly.total', raw, {
    ...official, series: [{ id: 'weekly', observationDate: raw.period, status: 'provisional', evidence: artifact }],
  });
  assert.equal(certified.status, 'provisional');
  assert.equal(certified.retrievedAt, artifact.retrievedAt);
  assert.equal(certified.value, 9);
  assert.equal(raw.status, 'final');
  assert.equal(canonicalProvenanceFigure('reserves.weekly.total', { ...raw, evidence: artifact }, {
    ...official, series: [{ id: 'weekly', observationDate: raw.period, status: 'not-stated', evidence: artifact }],
  }).status, 'unknown');
});

test('derived adequacy withholds dependent claims when canonical imports or reserves become unavailable', () => {
  const raw = { ...official, current: { sbpReserves: 20, importCoverMonths: 4 }, trajectory: [{ importCoverMonths: 3 }],
    benchmark: { months: 3 }, imfTarget: { value: 22 }, drivers: ['Unsupported claim'], context: 'Stale derived claim' };
  const freshness = { datasets: [{ id: 'reserves', ...official }, { id: 'trade', ...official }] };
  const sources = { reserves: { data: { ...official, weekly: [{ sbp: 20000 }] } },
    trade: { data: { ...official, monthly: [{ imports: null }] } } };
  const result = prepareDataset(raw, undefined, freshness, 'reserves-adequacy', sources);
  assert.equal(result.data.current.sbpReserves, 20);
  assert.equal(result.data.current.importCoverMonths, null);
  assert.deepEqual(result.data.trajectory, []);
  assert.deepEqual(result.data.drivers, []);
  assert.equal(result.data.context, null);
  assert.equal(result.data.imfTarget.value, 22);
  assert.equal(result.data.benchmark.months, 3);
  sources.reserves.data.publication = { policy: 'official-only', status: 'withheld' };
  const withheld = prepareDataset(raw, undefined, freshness, 'reserves-adequacy', sources);
  assert.equal(withheld.data.current, null);
  assert.equal(withheld.data.imfTarget.value, 22);
});

test('two-digit fiscal observations normalize without mixing calendar and fiscal years', () => {
  assert.equal(classifyObservationChange(null, { period: '2026-08' }), 'new-observation');
  assert.equal(classifyObservationChange({ period: 'FY25' }, { period: 'FY2026' }), 'new-observation');
  assert.equal(classifyObservationChange({ period: 'FY26', value: 3 }, { period: 'FY2026', value: 4 }), 'revision');
  assert.equal(classifyObservationChange({ period: '2026' }, { period: 'FY26' }), 'needs-review');
});

test('unavailable watchlist rows never retain stale display strings or arrows', () => {
  const row = restrictIndicator({ id: 'fbr-tax', displayValue: '999 bn', value: 999, trend: 'up', note: 'Record' },
    { datasets: [{ id: 'fbr-tax', ...official, publication: partial(['fytd']) }] });
  const [item] = resolveWatchlistItems(['fbr-tax'], [row]);
  assert.equal(item.value, null);
  assert.equal(item.sentiment, 'neutral');
  assert.ok(item.unavailable);
});

test('freshness stays independent of source tier and validation', () => {
  assert.equal(freshnessStatus({ status: 'fresh' }), 'latest-available');
  assert.equal(freshnessStatus({ ...official, freshnessStatus: 'fetch-failed' }), 'fetch-failed');
  assert.equal(freshnessStatus({ ...official, publication: { status: 'withheld' }, status: 'fresh' }), 'withheld');
  assert.equal(validationStatus({ status: 'fresh', lastUpdated: '2026-08-01' }), 'pending');
});

test('passed calculation validation requires actual explicit check results and timestamp', () => {
  for (const checks of [undefined, {}, [], [{ name: 'Sum check' }]]) {
    assert.equal(validationStatus({ validation: { status: 'passed', checkedAt: '2026-08-01', checks } }), 'pending');
  }
  assert.equal(validationStatus({ validation: { status: 'passed', checks: [{ ok: true }] } }), 'pending');
  assert.equal(validationStatus({ validation: { status: 'passed', checkedAt: '2026-08-01', checks: [{ ok: true }] } }), 'passed');
  assert.equal(validationStatus({ validation: { status: 'passed', checkedAt: '2026-08-01', checks: [{ ok: false }] } }), 'failed');
});

test('source status is recorded, never inferred as final or provisional from a date', () => {
  assert.equal(sourceFigureStatus({ date: '2026-08-01' }), 'unknown');
  assert.equal(sourceFigureStatus({ status: 'not-stated' }), 'unknown');
  for (const status of ['final', 'provisional', 'revised', 'estimate']) assert.equal(sourceFigureStatus({ status }), status);
  assert.equal(sourceFigureStatus({ derivation: 'a − b' }), 'derived');
});

test('observation advances, revisions and source checks are distinct, including fiscal labels', () => {
  const before = { period: '2026-01', value: 5 };
  assert.equal(classifyObservationChange(before, { period: '2026-02', value: 5 }), 'new-observation');
  assert.equal(classifyObservationChange(before, { period: '2026-01', value: 6 }), 'revision');
  assert.equal(classifyObservationChange(before, { ...before, retrievedAt: '2026-08-01' }), 'source-check');
  assert.equal(classifyObservationChange({ period: 'FY2025' }, { period: 'FY2026' }), 'new-observation');
  assert.equal(classifyObservationChange({ period: 'Latest' }, { period: 'Latest' }), 'needs-review');
  assert.equal(classifyObservationChange(before, { period: '2026-13', value: 5 }), 'needs-review');
  assert.equal(classifyObservationChange(before, { period: '2026-01-01', value: 5 }), 'needs-review');
});

test('evidence separates issuer, downloaded-from, artifact retrieval and generation timestamps', () => {
  const evidence = evidenceOf({ artifactId: artifact.artifactId, retrievedAt: '2099-01-01' },
    { generatedAt: '2099-02-01', artifacts: { [artifact.artifactId]: { ...artifact, responseUrl: 'https://cdn.sbp.org.pk/workbook.xlsx' } } });
  assert.equal(evidence.retrievedAt, artifact.retrievedAt);
  assert.equal(evidence.sourceUrl, official.sourceUrl);
  assert.equal(evidence.responseUrl, 'https://cdn.sbp.org.pk/workbook.xlsx');
  assert.equal(evidence.artifactUrl, artifact.path);
  assert.equal(evidenceOf({ retrievedAt: '2099-01-01' }).retrievedAt, null);
  assert.equal(evidenceListOf({ evidence: [artifact, [{ ...artifact, artifactId: 'two' }]] }).length, 2);
  assert.equal(evidenceListOf({ evidence: [] })[0].artifactUrl, null);
});

test('links reject script schemes, traversal, credentials and protocol-relative URLs', () => {
  for (const url of ['javascript:alert(1)', '//other.example/path', '/source-evidence/../data/secret',
    '/source-evidence/%2e%2e/data/secret', '/source-evidence/%2e%2e%2fsecret', 'https://user:password@example.com']) {
    assert.equal(safeSourceUrl(url), null, url);
  }
  assert.equal(safeSourceUrl(artifact.path), artifact.path);
});

test('math and periods never turn missing inputs into zero or an invented year', () => {
  assert.equal(finiteSum([]), null);
  assert.equal(finiteSum([1, null]), null);
  assert.equal(finiteSum([0, 2]), 2);
  assert.equal(sumField([{ value: 1 }, { value: null }], 'value'), null);
  assert.equal(avgField([], 'value'), null);
  for (const fn of [currentCalendarYear, currentFiscalYear, deriveFiscalLabels]) assert.equal(fn([{ date: null, value: 1 }]), null);
  assert.equal(toFYLabel(null), null);
  assert.equal(hasPublishedFigures({ ...official, monthly: [{ year: 2026, value: null }] }), false);
  assert.equal(hasPublishedFigures({ ...official, monthly: [{ value: 0 }] }), true);
});

test('preview changes cannot republish a withheld or unidentified partial field', () => {
  const freshness = { datasets: [{ id: 'trade', ...official, publication: partial(['monthly.2026-01']) }] };
  assert.equal(previewItemAllowed({ datasetId: 'trade', field: 'monthly.2026-01.balance' }, freshness), false);
  assert.equal(previewItemAllowed({ datasetId: 'trade' }, freshness), false);
  assert.equal(previewItemAllowed({ datasetId: 'trade', field: 'monthly.2025-12.balance' }, freshness), true);
});

test('true zero is preserved while missing or zero-baseline growth is unavailable, never flat', () => {
  assert.deepEqual(pctChange(null, 10), { pct: null, direction: 'unavailable' });
  assert.deepEqual(pctChange(10, null), { pct: null, direction: 'unavailable' });
  assert.deepEqual(pctChange(10, 0), { pct: null, direction: 'unavailable' });
  assert.deepEqual(pctChange(0, 10), { pct: -100, direction: 'down' });
  assert.deepEqual(pctChange(10, 10), { pct: 0, direction: 'flat' });
  assert.equal(sumField([{ value: 0 }], 'value'), 0);
  assert.equal(avgField([{ value: 0 }], 'value'), 0);
});

test('overview and snapshot helpers do not invent a stable trend when no comparison is known', () => {
  const trade = buildTradeKpi({ monthly: [{ date: '2026-08', balance: 0, exports: 0, imports: 0 }] });
  assert.equal(trade.value, 0);
  assert.equal(trade.trend, 'unavailable');
  const snapshot = buildSnapshotKpi({ id: 'current-account', value: 0, change: 0, trend: 'stable' });
  assert.equal(snapshot.changeLabel, 0);
  assert.equal(snapshot.displayValue, '0');
  assert.equal(snapshot.trend, 'stable');
  assert.equal(buildSnapshotKpi({ id: 'current-account', value: 0 }).trend, 'unavailable');
  assert.equal(restrictIndicator({ id: 'reserves', value: 0, change: null, trend: 'stable' }).trend, 'unavailable');
  assert.equal(restrictIndicator({ id: 'reserves', value: 0, change: 0, trend: 'stable' }).trend, 'stable');
  assert.equal(trendArrow('unavailable'), '');
  assert.equal(trendArrow(null), '');
  assert.equal(trendArrow('stable'), '►');
});

test('source and downloaded-from links reject credential query parameters', () => {
  for (const key of ['api_key', 'apiKey', 'API-KEY', 'access_token', 'token', 'secret', 'password', 'authorization']) {
    const url = `https://easydata.sbp.org.pk/api/series?${key}=dummy-test-value`;
    assert.equal(safeSourceUrl(url), null);
    const evidence = evidenceOf({ evidence: { sourceUrl: url, responseUrl: url } });
    assert.equal(evidence.sourceUrl, null);
    assert.equal(evidence.responseUrl, null);
  }
  assert.equal(safeSourceUrl('https://easydata.sbp.org.pk/api/series?seriesKey=remittances'),
    'https://easydata.sbp.org.pk/api/series?seriesKey=remittances');
  assert.equal(safeSourceUrl('/source-evidence/workbook.xlsx?api_key=dummy-test-value'), null);
});
