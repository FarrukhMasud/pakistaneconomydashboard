import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBriefingHtml, certifiedProvenance, extractCsvs, publicationExportSummary, publicationManifest, seriesToCsv } from '../exportTrust.js';

const evidence = { artifactId: 'one', path: '/source-evidence/one.xlsx', sourceUrl: 'https://www.sbp.org.pk/one.xlsx',
  responseUrl: 'https://cdn.sbp.org.pk/one.xlsx', retrievedAt: '2026-08-01', locator: { sheet: 'Reserves', row: 9 } };
const published = { sourceType: 'official-primary', publication: { policy: 'official-only', status: 'published' } };
const bundle = {
  'reserves.json': { data: { ...published, weekly: [{ date: '2026-07-31', total: 9000, status: 'provisional', evidence }],
    monthly: [{ date: '2026-07', total: 8000, evidence }] } },
  'fbr-tax.json': { data: null, publication: { policy: 'official-only', status: 'withheld', reason: 'Awaiting official release' }, unavailable: { reason: 'Awaiting official release' } },
  'kpi-summary.json': { data: { sourceType: 'official-derived', indicators: [{ id: 'fbr-tax', label: '<Tax>', value: null, unavailable: true, period: 'FY2026' }] } },
  'data-freshness.json': { data: { datasets: [{ id: 'reserves', ...published }, { id: 'fbr-tax', ...published }] } },
  'provenance.json': { data: { figures: { 'fbr.fytd.net': { value: 999 }, 'reserves.weekly.total': { value: 9000 } } } },
};

test('ZIP contains separate reserves series, policy manifest and withheld tombstones', () => {
  const files = extractCsvs(bundle);
  assert.ok(files.some((file) => file.name === 'reserves-weekly.csv'));
  assert.ok(files.some((file) => file.name === 'reserves-monthly.csv'));
  const tombstone = JSON.parse(files.find((file) => file.name === 'fbr-tax.json').content);
  assert.equal(tombstone.authenticity, 'unavailable');
  assert.equal(tombstone.publication.status, 'withheld');
  assert.equal(tombstone.value, undefined);
  assert.ok(files.some((file) => file.name === 'publication-manifest.json'));
});

test('financial exports distinguish unavailable from metadata-only success', () => {
  assert.equal(publicationManifest(bundle).find((item) => item.id === 'fbr-tax').authenticity, 'unavailable');
  assert.deepEqual(publicationExportSummary(bundle), { available: 1, partial: 0, withheld: 2 });
  assert.equal(publicationExportSummary({ 'trade.json': { data: { ...published, monthly: [] } } }).available, 0);
});

test('CSV includes all evidence, original vs downloaded source, actual status and null labels', () => {
  const csv = seriesToCsv('Reserves', [{ date: '2026-07-31', total: null, status: 'revised',
    evidence: [evidence, { ...evidence, artifactId: 'two', path: '/source-evidence/two.xlsx' }] }]);
  for (const text of ['Unavailable', 'Revised', 'one.xlsx', 'two.xlsx', 'cdn.sbp.org.pk', '2026-08-01', 'Reserves']) assert.ok(csv.includes(text), text);
  assert.ok(!csv.includes('[object Object]'));
  assert.ok(csv.includes('Observation period'));
});

test('CSV and briefing resolve canonical publication receipts without requiring a separate artifact catalog', () => {
  const proof = { artifactId: evidence.artifactId, sourceUrl: evidence.sourceUrl, sourceType: 'official-primary',
    status: 'provisional', location: 'Reserves table; 31 July 2026 column' };
  const dataset = { ...published, weekly: [{ date: '2026-07-31', total: 9000 }],
    publicationEvidence: { 'weekly.0': proof }, sourceEvidence: { 'source.xlsx': evidence } };
  const csv = seriesToCsv('Reserves', dataset.weekly, { dataset, field: 'weekly' });
  const html = buildBriefingHtml({ 'reserves.json': { data: dataset } });
  for (const text of [evidence.path, evidence.retrievedAt, 'Provisional', 'cdn.sbp.org.pk']) {
    assert.ok(csv.includes(text), text);
    assert.ok(html.includes(text), text);
  }
});

test('provenance download cannot leak withheld figures retained in an old headline catalog', () => {
  assert.deepEqual(Object.keys(certifiedProvenance(bundle['provenance.json'].data, bundle).figures), ['reserves.weekly.total']);
  const json = JSON.parse(extractCsvs(bundle).find((file) => file.name === 'provenance.json').content);
  assert.equal(json.figures['fbr.fytd.net'], undefined);
});

test('printable briefing is escaped, truthful about missing figures, and themed with independent statuses', () => {
  const html = buildBriefingHtml(bundle, { themeCss: ':root{--cp-bg:white}', origin: 'https://dashboard.example' });
  assert.ok(html.includes('&lt;Tax&gt;'));
  assert.ok(!html.includes('<Tax>'));
  assert.ok(html.includes('Official figure not yet published / verified'));
  assert.ok(html.includes('Authenticity: Unavailable'));
  assert.ok(html.includes('Calculation validation: Checks pending'));
  assert.ok(html.includes('https://dashboard.example/source-evidence/one.xlsx'));
  assert.ok(html.includes('Downloaded from'));
  assert.ok(html.includes('not a source retrieval or verification date'));
  assert.ok(html.includes('scoutTheme'));
  assert.ok(html.includes('var(--cp-bg)'));
  assert.ok(!html.includes('999'));
});

test('briefing source URL fallback cannot become an executable link', () => {
  const fixture = structuredClone(bundle);
  fixture['data-freshness.json'].data.datasets[0].sourceUrl = 'javascript:alert(1)';
  fixture['reserves.json'].data.weekly[0].evidence.sourceUrl = 'javascript:alert(2)';
  assert.ok(!buildBriefingHtml(fixture).includes('href="javascript:'));
});
