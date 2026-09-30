import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assessPublication, applyPublicationPolicy, hashContent, publicationContentHash,
  publicationEvidenceHash, validateReview, validateManualLocator, isOfficialDocumentUrl, hasNumericClaims, enforcePublicationPolicy,
} from '../lib/publication-policy.mjs';
import { extractExternalStock } from '../enforce-publication-policy.mjs';
import { extractMonthly } from '../update-fbr.mjs';
import { getDatasetFreshness } from '../data-catalog.mjs';

const receipt = {
  sourceKey: 'official-table.pdf', artifactId: 'official-table:receipt',
  sha256: 'a'.repeat(64), sourceUrl: 'https://www.sbp.org.pk/assets/document/example.pdf',
  responseUrl: 'https://www.sbp.org.pk/assets/document/example.pdf',
  retrievedAt: '2026-03-01T00:00:00Z',
  parserVersion: 'official-parser.mjs:sha256:verified',
};
const automated = { id: 'test', parser: 'official-parser.mjs' };
const manual = { id: 'test', parser: 'manual-curation' };
const options = { evidence: { [receipt.sourceKey]: receipt }, now: '2026-09-30T12:00:00Z' };

function evidenceFor(value, changes = {}) {
  return {
    sourceType: 'official-primary', sourceKey: receipt.sourceKey,
    sourceUrl: receipt.sourceUrl, artifactId: receipt.artifactId,
    evidenceHash: receipt.sha256, contentHash: hashContent(value),
    location: JSON.stringify({ page: 1, x: 2, y: 3 }), ...changes,
  };
}

function payload() {
  const series = [{ date: '2026-03', value: 1 }];
  return { title: 'Test data', series, publicationEvidence: { series: evidenceFor(series) } };
}

function reviewed(data) {
  const contentHash = publicationContentHash(data);
  const evidenceHash = publicationEvidenceHash(data.publicationEvidence);
  data.publication = {
    policy: 'official-only', status: 'published', reason: null, withheldFields: [],
    review: {
      contentHash,
      approvals: [
        { reviewer: 'alice@example.org', approvedAt: '2026-09-29T10:00:00Z', evidenceHash },
        { reviewer: 'bob@example.org', approvedAt: '2026-09-29T11:00:00Z', evidenceHash },
      ],
    },
  };
  return data;
}

test('official automated claims are allowed only with exact content and direct captured evidence', () => {
  assert.equal(assessPublication(automated, payload(), options).ok, true);
  const data = payload();
  data.series[0].value++;
  assert.equal(assessPublication(automated, data, options).ok, false);
  data.series[0].source = 'https://www.imf.org/en/News/Articles/example-release';
  data.publicationEvidence.series.contentHash = hashContent(data.series);
  assert.equal(assessPublication(automated, data, options).ok, false);
  assert.equal(assessPublication(automated, payload(), { evidence: {} }).ok, false);
});

test('a genuine historical artifact remains supported after its source key points at a newer receipt', () => {
  const data = payload();
  const latest = { ...receipt, artifactId: 'newer-official-receipt', sha256: 'd'.repeat(64) };
  assert.equal(assessPublication(automated, data, { evidence: { [receipt.sourceKey]: latest } }).ok, false);
  assert.equal(assessPublication(automated, data, {
    evidence: { [receipt.sourceKey]: latest, [receipt.artifactId]: receipt },
  }).ok, true);
});

test('press, unknown and legacy official labels fail closed', () => {
  for (const sourceType of ['secondary-attributed', 'official', 'unknown', null]) {
    const data = payload();
    data.publicationEvidence.series.sourceType = sourceType;
    assert.equal(assessPublication(automated, data, options).ok, false);
    const output = applyPublicationPolicy(automated, data, options);
    assert.equal(output.publication.status, 'withheld');
    assert.equal('series' in output, false);
  }
  const data = payload();
  data.sourceType = 'unregistered';
  assert.equal(applyPublicationPolicy(automated, data, options).publication.status, 'withheld');
});

test('institutional homepages and credentialed HTTP URLs are not publication evidence', () => {
  for (const url of [
    'https://www.sbp.org.pk', 'https://www.imf.org/en/Countries/PAK',
    'https://www.fbr.gov.pk', 'http://www.sbp.org.pk/assets/document/table.pdf',
    'https://www.sbp.org.pk/assets/document/table.pdf?token=secret',
    'https://www.sbp.org.pk.attacker.example/table.pdf',
    'https://user:password@www.sbp.org.pk/table.pdf',
  ]) assert.equal(isOfficialDocumentUrl(url), false, url);
  assert.equal(isOfficialDocumentUrl(receipt.sourceUrl), true);
});

test('official-derived claims require supported inputs and formula, not primary masquerading', () => {
  const data = { coverage: { value: 3 } };
  data.publicationEvidence = {
    coverage: evidenceFor(data.coverage, {
      sourceType: 'official-derived', formula: 'reserves / monthly imports',
      inputs: ['reserves.current', 'trade.imports'],
    }),
  };
  for (const key of ['sourceKey', 'sourceUrl', 'artifactId', 'evidenceHash']) delete data.publicationEvidence.coverage[key];
  const input = { sourceType: 'official-primary', status: 'published', contentHash: 'b'.repeat(64), evidenceHash: 'c'.repeat(64) };
  const derivedInputs = { 'reserves.current': input, 'trade.imports': input };
  assert.equal(assessPublication(automated, data, { derivedInputs }).ok, true);
  data.publicationEvidence.coverage.artifactId = receipt.artifactId;
  assert.equal(assessPublication(automated, data, { derivedInputs }).ok, false);
  delete data.publicationEvidence.coverage.artifactId;
  derivedInputs['trade.imports'] = { ...input, sourceType: 'secondary-attributed' };
  assert.equal(assessPublication(automated, data, { derivedInputs }).ok, false);
  delete data.publicationEvidence.coverage.formula;
  assert.equal(assessPublication(automated, data, { derivedInputs }).ok, false);
  const mixed = payload();
  mixed.series[0].sourceType = 'secondary-attributed';
  mixed.publicationEvidence.series.contentHash = hashContent(mixed.series);
  assert.equal(assessPublication(automated, mixed, options).ok, false);
});

test('partial publication preserves official rows and withholds unsupported numbers and narrative', () => {
  const data = payload();
  data.current = { net: 13003, target: 12983, note: 'Tax collection reached Rs13,003bn.' };
  data.repaymentSplit = [{ value: 16, note: 'Expected rollover' }];
  data.methodologyNote = 'Reported net tax collection was 13003 billion.';
  const output = applyPublicationPolicy(automated, data, options);
  assert.deepEqual(output.series, data.series);
  assert.equal(output.publication.status, 'partial');
  assert.deepEqual(output.current, { net: null, target: null });
  assert.deepEqual(output.repaymentSplit, []);
  assert.equal(output.methodologyNote, null);
  assert.equal(JSON.stringify(output).includes('13003'), false);
  assert.equal(assessPublication(automated, output, options).ok, true);
  assert.deepEqual(applyPublicationPolicy(automated, output, options), output);
});

test('fully withheld payload contains metadata only, never unsupported numeric text', () => {
  const data = { title: 'External Debt', unit: 'US$ billion', value: '21.5', note: 'Due: $21.5bn', sourceUrl: receipt.sourceUrl };
  const output = applyPublicationPolicy(manual, data, options);
  assert.equal(output.publication.status, 'withheld');
  assert.equal('value' in output, false);
  assert.equal('note' in output, false);
  assert.equal(assessPublication(manual, output, options).ok, true);
});

test('official publication exposes receipt evidence without inventing validation or conflating trust states', () => {
  const data = payload();
  const output = applyPublicationPolicy(automated, data, options);
  assert.deepEqual(output.sourceEvidence[receipt.sourceKey], receipt);
  const metadata = getDatasetFreshness({
    ...automated, sourceType: 'official-primary', cadence: 'Monthly',
    latest: value => value.series.at(-1).date,
  }, output, { now: new Date('2026-03-31T00:00:00Z') });
  assert.equal(metadata.authenticity, 'official-primary');
  assert.equal(metadata.publication.status, 'published');
  assert.equal(metadata.validation.status, 'pending');
  assert.equal(metadata.verificationDate, null);
  const withheld = applyPublicationPolicy(manual, data, options);
  assert.equal('sourceEvidence' in withheld, false);
  const unavailable = getDatasetFreshness({
    ...manual, sourceType: 'official-primary', cadence: 'Monthly', latest: () => '2026-03',
  }, withheld, { now: new Date('2026-03-31T00:00:00Z') });
  assert.equal(unavailable.authenticity, 'unavailable');
  assert.equal(unavailable.observationDate, null);
  assert.equal(unavailable.validation.status, 'pending');
});

test('legacy verification timestamps are reported and removed without suppressing supported observations', () => {
  const data = { ...payload(), lastVerified: '2026-03-01', verificationDate: receipt.retrievedAt };
  const audit = assessPublication(automated, data, options);
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some(violation => violation.path === 'lastVerified'));
  assert.ok(audit.violations.some(violation => violation.path === 'verificationDate'));
  assert.equal(audit.violations.length, 2);
  const output = applyPublicationPolicy(automated, data, options);
  assert.equal('lastVerified' in output, false);
  assert.equal('verificationDate' in output, false);
  assert.deepEqual(output.series, data.series);
  assert.equal(output.publication.status, 'published');
  assert.equal(assessPublication(automated, output, options).ok, true);
  const withheld = applyPublicationPolicy(manual, data, options);
  assert.equal('lastVerified' in withheld, false);
  assert.equal('verificationDate' in withheld, false);
});

test('manual numbers require two content- and evidence-bound real independent approvals', () => {
  const data = payload();
  assert.equal(assessPublication(manual, data, options).ok, false);
  assert.equal(assessPublication({ id: 'fbr-tax', parser: 'update-fbr.mjs' }, data, options).ok, false);
  reviewed(data);
  assert.equal(assessPublication(manual, data, options).ok, true);
  data.series[0].value = 2;
  data.publicationEvidence.series.contentHash = hashContent(data.series);
  assert.equal(assessPublication(manual, data, options).ok, false);
});

test('manual narratives, forecasts and full-text methodologies need reviews even without numerical claims', () => {
  for (const [id, claim] of [
    ['test', 'Growth will improve.'],
    ['explainers', { title: 'Reserve cover', body: 'Divide reserve stock by average imports.' }],
    ['economic-events', [{ description: 'The committee expects inflation to ease.' }]],
  ]) {
    assert.equal(hasNumericClaims(claim), false);
    const data = {
      title: 'Official source claim', text: claim,
      publicationEvidence: {
        text: evidenceFor(claim, {
          method: 'automated', status: 'estimate',
          location: JSON.stringify({ page: 1, paragraph: 2, quote: 'Growth will improve.' }),
        }),
      },
    };
    const dataset = { id, parser: 'manual-curation' };
    const confirmed = { ...options, verifiedAutomatedClaims: { text: hashContent(claim) } };
    const audit = assessPublication(dataset, data, confirmed);
    assert.ok(audit.violations.some(item => item.path === 'text'
      && item.reasons.includes('Two distinct real reviewer approvals are required.')));
    const output = applyPublicationPolicy(dataset, data, confirmed);
    assert.equal(output.publication.status, 'withheld');
    assert.equal('text' in output, false);
    assert.equal('sourceEvidence' in output, false);
    assert.equal(assessPublication(dataset, output, confirmed).ok, true);
  }
});

test('manual plain-text approvals bind the current text and exact source evidence, not document retrieval alone', () => {
  const data = {
    forecast: 'Growth will improve.',
    publicationEvidence: {
      forecast: evidenceFor('Growth will improve.', {
        status: 'estimate', location: JSON.stringify({ page: 1, paragraph: 2, quote: 'Growth will improve.' }),
      }),
    },
  };
  reviewed(data);
  assert.equal(assessPublication(manual, data, options).ok, true);
  data.forecast = 'Growth will weaken.';
  data.publicationEvidence.forecast.contentHash = hashContent(data.forecast);
  assert.equal(assessPublication(manual, data, options).ok, false);
  reviewed(data);
  data.publicationEvidence.forecast.location = JSON.stringify({ page: 2, paragraph: 1, quote: 'Growth will weaken.' });
  assert.equal(assessPublication(manual, data, options).ok, false);
});

test('generic topic labels and malformed manual locators fail even with bound reviewer approvals', () => {
  for (const location of [
    'Economic outlook', 'Official methodology', 'Page 1', '{}',
    JSON.stringify({ page: 1 }), JSON.stringify({ page: 0, paragraph: 2, quote: 'Growth will improve.' }),
    JSON.stringify({ page: 1, paragraph: 0, quote: 'Growth will improve.' }),
    JSON.stringify({ page: 1, x: -1, y: 2 }),
    JSON.stringify({ page: 1, paragraph: 2, quote: 'Growth will improve.', x: -1 }),
    JSON.stringify({ sheet: 'Table', row: 2, column: 2, cell: 'B3' }),
    JSON.stringify({ selector: 'body', paragraph: 2, quote: 'Growth will improve.' }),
    JSON.stringify({ page: 1, x: 2, y: 3, unsupportedEstimate: 13003 }),
  ]) {
    const data = reviewed({
      narrative: 'Growth will improve.',
      publicationEvidence: { narrative: evidenceFor('Growth will improve.', { location }) },
    });
    const audit = assessPublication(manual, data, options);
    assert.ok(audit.violations.some(item => item.path === 'narrative'
      && item.reasons.some(reason => /locator|coordinate/.test(reason))), location);
  }
  assert.equal(validateManualLocator(JSON.stringify({ sheet: 'Table', row: 2, column: 2, cell: 'B2' })).ok, true);
});

test('a retrieved official webpage requires both an exact archived passage locator and manual reviews', () => {
  const htmlReceipt = {
    ...receipt, sourceKey: 'official-outlook.html', artifactId: 'official-outlook:receipt',
    sourceUrl: 'https://www.sbp.org.pk/publications/official-outlook.html',
    responseUrl: 'https://www.sbp.org.pk/publications/official-outlook.html', contentType: 'text/html',
  };
  const data = {
    narrative: 'Growth will improve.',
    publicationEvidence: {
      narrative: evidenceFor('Growth will improve.', {
        sourceKey: htmlReceipt.sourceKey, artifactId: htmlReceipt.artifactId, sourceUrl: htmlReceipt.sourceUrl,
        location: JSON.stringify({ selector: '#official-outlook', paragraph: 2, quote: 'Growth will improve.' }),
      }),
    },
  };
  const proof = { ...options, evidence: { [htmlReceipt.artifactId]: htmlReceipt } };
  assert.equal(assessPublication(manual, data, proof).ok, false);
  reviewed(data);
  assert.equal(assessPublication(manual, data, proof).ok, true);
  data.publicationEvidence.narrative.location = JSON.stringify({ page: 1, paragraph: 2, quote: 'Growth will improve.' });
  reviewed(data);
  assert.equal(assessPublication(manual, data, proof).ok, false);
});

test('manual derived methodology cannot use hash-only input labels instead of reviewed original lineage', () => {
  const formula = 'reserve stock / mean monthly imports';
  const data = {
    methodology: 'Divide reserve stock by average imports.',
    publicationEvidence: {
      methodology: {
        sourceType: 'official-derived', contentHash: hashContent('Divide reserve stock by average imports.'),
        formula, inputs: ['stock', 'imports'], location: JSON.stringify({ inputs: ['stock', 'imports'] }),
      },
    },
  };
  const input = { sourceType: 'official-primary', status: 'published', contentHash: 'b'.repeat(64), evidenceHash: receipt.sha256 };
  reviewed(data);
  const audit = assessPublication(manual, data, { ...options, derivedInputs: { stock: input, imports: input } });
  assert.ok(audit.violations.some(item => item.path === 'methodology'
    && item.reasons.some(reason => /original input lineage/.test(reason))));
});

test('invalid, duplicate, stale, fabricated placeholder and future approvals fail', () => {
  const data = reviewed(payload());
  const contentHash = publicationContentHash(data);
  const evidenceHash = publicationEvidenceHash(data.publicationEvidence);
  const base = data.publication.review;
  for (const alter of [
    review => { review.contentHash = 'f'.repeat(64); },
    review => { review.approvals.pop(); },
    review => { review.approvals[1].reviewer = ' ALICE@EXAMPLE.ORG '; },
    review => { review.approvals[0].approvedAt = 'tomorrow'; },
    review => { review.approvals[0].approvedAt = '2027-01-01T00:00:00Z'; },
    review => { review.approvals[0].evidenceHash = 'e'.repeat(64); },
    review => { review.approvals[0].reviewer = 'Copilot'; },
    review => { review.approvals[0].reviewer = 'Reviewer 1'; },
  ]) {
    const review = structuredClone(base);
    alter(review);
    assert.equal(validateReview(review, { contentHash, evidenceHash, now: options.now }).ok, false);
  }
});

test('legitimate null unavailable values remain null and do not require fabricated evidence', () => {
  const data = payload();
  data.current = { net: null, target: null };
  data.annual = null;
  assert.equal(assessPublication(automated, data, options).ok, true);
  const output = applyPublicationPolicy(automated, data, options);
  assert.equal(output.annual, null);
  assert.deepEqual(output.current, { net: null, target: null });
  data.current.note = 'Actual collection was about 13003bn';
  assert.equal(assessPublication(automated, data, options).ok, false);
});

test('publication preserves missing corridor and component fields separately from authentic zeros', () => {
  const row = {
    date: '2026-03',
    saudiArabia: null,
    uae: 0,
    uk: 12,
    otherGcc: null,
    total: null,
    components: { goods: 0, services: null },
  };
  const data = {
    title: 'Incomplete official components',
    monthly: [row],
    publicationEvidence: { 'monthly.0': evidenceFor(row) },
  };
  const output = applyPublicationPolicy(automated, data, options);
  const persisted = JSON.parse(JSON.stringify(output));
  assert.deepEqual(persisted.monthly, [row]);
  assert.equal(persisted.monthly[0].saudiArabia, null);
  assert.equal(persisted.monthly[0].uae, 0);
  assert.equal('usa' in persisted.monthly[0], false);
  assert.equal(persisted.monthly[0].total, null);
  assert.equal(persisted.monthly[0].components.services, null);
  assert.equal(assessPublication(automated, persisted, options).ok, true);
});

test('numeric strings and written numeric economic claims count as manual numeric content', () => {
  for (const value of ['9.2', '$1bn', 'three months', 'Zero net addition', { net: null, note: 'around $1bn' }]) {
    assert.equal(hasNumericClaims(value), true);
  }
  assert.equal(hasNumericClaims(null), false);
  assert.equal(hasNumericClaims({ date: '2026-03-31', net: null }), false);
});

test('FBR automated historical exception requires exact trusted parser receipt, not a method label', () => {
  const row = { date: '2024-07', fy: 'FY2025', net: 659.8, sourceType: 'official-primary' };
  const fbrReceipt = { ...receipt, sourceKey: 'fbr-monthwise-FY2024-25.pdf', parserVersion: 'update-fbr.mjs:sha256:verified' };
  const data = { monthly: [row], publicationEvidence: { 'monthly.0': evidenceFor(row, { sourceKey: fbrReceipt.sourceKey, method: 'automated' }) } };
  const fbr = { id: 'fbr-tax', parser: 'manual-curation' };
  assert.equal(assessPublication(fbr, data, {
    evidence: { [fbrReceipt.sourceKey]: fbrReceipt },
    verifiedAutomatedClaims: { 'monthly.0': hashContent(row) },
  }).ok, true);
  assert.equal(assessPublication(fbr, data, { evidence: { [fbrReceipt.sourceKey]: fbrReceipt } }).ok, false);
  fbrReceipt.parserVersion = 'pdf-text.mjs:sha256:verified';
  assert.equal(assessPublication(fbr, data, { evidence: { [fbrReceipt.sourceKey]: fbrReceipt } }).ok, false);
});

test('partial row removal retains and correctly remaps independently sourced historical evidence', () => {
  const unsupported = { date: '2025-07', net: 754, sourceType: 'secondary-attributed' };
  const official = { date: '2024-07', net: 659.8, sourceType: 'official-primary' };
  const data = { monthly: [unsupported, official], publicationEvidence: { 'monthly.1': evidenceFor(official) } };
  const output = applyPublicationPolicy(automated, data, options);
  assert.deepEqual(output.monthly, [official]);
  assert.ok(output.publicationEvidence['monthly.0']);
  assert.equal(assessPublication(automated, output, options).ok, true);
});

test('a source-class label cannot mask absent document receipts, stale content or secondary nested claims', () => {
  const data = reviewed(payload());
  data.series[0].sourceType = 'secondary-attributed';
  data.publicationEvidence.series.contentHash = hashContent(data.series);
  assert.equal(assessPublication(manual, data, options).ok, false);
  data.series[0].sourceType = 'official-primary';
  data.publicationEvidence.series.contentHash = hashContent(data.series);
  data.publicationEvidence.series.sourceUrl = 'https://www.dawn.com/news/1';
  assert.equal(assessPublication(manual, data, options).ok, false);
});

test('secondary URLs inside a primary-labelled scope and numeric metadata cannot escape policy', () => {
  const data = payload();
  data.series[0].source = 'https://www.dawn.com/news/1';
  data.publicationEvidence.series.contentHash = hashContent(data.series);
  assert.equal(assessPublication(automated, data, options).ok, false);
  const hidden = payload();
  hidden.title = 'External debt reached $21.5bn';
  const output = applyPublicationPolicy(automated, hidden, options);
  assert.equal(output.publication.status, 'withheld');
  assert.equal('title' in output, false);
});

test('unused or unknown evidence cannot silently publish hidden economic claims', () => {
  const data = payload();
  data.publicationEvidence.hidden = { sourceType: 'secondary-attributed', value: 13003 };
  const audit = assessPublication(automated, data, options);
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some(item => item.path === 'publicationEvidence.hidden'));
  const output = applyPublicationPolicy(automated, data, options);
  assert.equal('hidden' in output.publicationEvidence, false);
  assert.equal(JSON.stringify(output).includes('13003'), false);
  assert.equal(assessPublication(automated, output, options).ok, true);
});

test('claimed publication status cannot contradict an unavailable payload', () => {
  const data = {
    value: null, publication: { policy: 'official-only', status: 'published', reason: null, withheldFields: [] },
  };
  assert.equal(assessPublication(automated, data, options).ok, false);
  const output = applyPublicationPolicy(automated, data, options);
  assert.equal(output.publication.status, 'withheld');
  assert.equal(assessPublication(automated, output, options).ok, true);
});

test('async enforcement persists fail-closed output, reports violations and remains idempotent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pak-publication-test-'));
  const dataset = { ...automated, file: 'test.json' };
  try {
    const data = payload();
    data.latest = { value: 13003, note: 'Reported Rs13,003bn' };
    await writeFile(join(directory, dataset.file), JSON.stringify(data));
    const reports = await enforcePublicationPolicy({ datasets: [dataset], dataDir: directory, evidence: options.evidence });
    assert.equal(reports[0].publication.status, 'partial');
    assert.equal(reports[0].violations.length, 1);
    const raw = await readFile(join(directory, dataset.file), 'utf8');
    assert.equal(raw.includes('13003'), false);
    const second = await enforcePublicationPolicy({ datasets: [dataset], dataDir: directory, evidence: options.evidence });
    assert.deepEqual(second[0].violations, []);
    assert.equal(await readFile(join(directory, dataset.file), 'utf8'), raw);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('official SBP parser reads exact dated stock columns and refuses ambiguous table shapes', () => {
  const rows = [
    '(Million US$)', 'R P', 'ITEM 31-Mar-26 30-Jun-26',
    '2. From IMF 9,891 11,050',
    'Total external debt and liabilities (A+B+C+D+E) 136,918 138,850',
  ];
  const items = rows.map((text, index) => ({ text, page: 1, x: 0, y: index }));
  const stock = extractExternalStock(items);
  assert.equal(stock.asOf, '2026-06-30');
  assert.equal(stock.totalExternalDebtAndLiabilities, 138.85);
  assert.equal(stock.imfOutstanding, 11.05);
  assert.throws(() => extractExternalStock(items.slice(1)), /units/);
  assert.throws(() => extractExternalStock(items.slice(0, 4)), /columns/);
  assert.throws(() => extractExternalStock(items.filter(item => item.text !== 'R P')), /revision markers/);
});

test('FBR parser refuses incomplete monthly tables and preserves reported numeric values', () => {
  const names = ['JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE'];
  const headers = [
    { text: '(Rs. in Billion)', nums: [] },
    { text: 'DT ST FED CUS TOTAL', nums: [] },
    { text: 'MONTH WISE / TAX WISE NET COLLECTION DURING FY: 2024-25', nums: [] },
  ];
  const lines = [...headers, ...names.flatMap(name => [{ text: name, nums: [] }, { text: '1 2 3 4 10', nums: [1, 2, 3, 4, 10] }])];
  lines.push({ text: 'TOTAL', nums: [] }, { text: '12 24 36 48 120', nums: [12, 24, 36, 48, 120] });
  const source = { fyStartYear: 2024, fyLabel: 'FY2025', provisional: true, url: receipt.sourceUrl };
  const parsed = extractMonthly(lines, source);
  assert.equal(parsed.monthly.length, 12);
  assert.equal(parsed.monthly[0].net, 10);
  assert.equal(parsed.monthly[0].sourceType, 'official-primary');
  assert.equal(parsed.monthly[0].date, '2024-07');
  assert.equal(parsed.monthly[11].date, '2025-06');
  assert.throws(() => extractMonthly([...headers, ...lines.slice(5)], source), /12 months/);
  assert.throws(() => extractMonthly(lines.slice(0, -2), source), /printed fiscal-year total/);
  assert.throws(() => extractMonthly(lines, { ...source, fyStartYear: 2025 }), /fiscal year/);
});

function nativeRef(value, changes = {}) {
  return {
    artifactId: receipt.artifactId, sourceKey: receipt.sourceKey, retrievedAt: receipt.retrievedAt,
    locator: { sheet: 'Table', row: 2, column: 2, cell: 'B2', observationDate: '2026-03' },
    rawValue: value, scale: 1, unit: 'US$ million', ...changes,
  };
}

function fieldPayload(value = 5) {
  return {
    monthly: [{
      date: '2026-03', unit: 'US$ million', imports: value, exports: 13003, optional: null,
      evidence: {
        imports: nativeRef(value), exports: nativeRef(13003),
        optional: nativeRef(null), unused: nativeRef(13003),
      },
      observations: {
        imports: { observationDate: '2026-03', status: 'not-stated', unit: 'US$ million' },
        exports: { status: 'final' },
        optional: { missingReason: 'not-reported', status: 'not-stated', comments: 'No observation reported.' },
      },
    }],
    publicationEvidence: { 'monthly.0.imports': evidenceFor(value, { method: 'automated', status: 'not-stated' }) },
  };
}

function fieldOptions(value = 5) {
  return { ...options, verifiedAutomatedClaims: { 'monthly.0.imports': hashContent(value) } };
}

test('exact field scopes retain official values, genuine missing proof and zeros while withholding uncovered siblings', () => {
  for (const value of [5, 0]) {
    const data = fieldPayload(value);
    const audit = assessPublication(automated, data, fieldOptions(value));
    assert.deepEqual(audit.violations.map(item => item.path), ['monthly.0.exports']);
    const output = applyPublicationPolicy(automated, data, fieldOptions(value));
    assert.equal(output.publication.status, 'partial');
    assert.equal(output.monthly[0].imports, value);
    assert.equal(output.monthly[0].exports, null);
    assert.equal(output.monthly[0].optional, null);
    assert.deepEqual(output.monthly[0].evidence.imports, data.monthly[0].evidence.imports);
    assert.deepEqual(output.monthly[0].evidence.optional, data.monthly[0].evidence.optional);
    assert.deepEqual(output.monthly[0].observations.optional, data.monthly[0].observations.optional);
    assert.deepEqual(output.monthly[0].observations.exports, { missingReason: 'publication-withheld' });
    assert.equal(JSON.stringify(output).includes('13003'), false);
    assert.equal(assessPublication(automated, output, fieldOptions(value)).ok, true);
    assert.deepEqual(applyPublicationPolicy(automated, output, fieldOptions(value)), output);
  }
});

test('exact automated scopes reject hash-only assertions, missing proof and malformed native receipt context', () => {
  for (const alter of [
    data => { delete data.monthly[0].evidence.imports; },
    data => { data.monthly[0].evidence.imports.artifactId = 'latest-receipt'; },
    data => { data.monthly[0].evidence.imports.sourceKey = 'different-series'; },
    data => { data.monthly[0].evidence.imports.retrievedAt = '2026-04-01T00:00:00Z'; },
    data => { data.monthly[0].evidence.imports.locator.row = 0; },
    data => { data.monthly[0].evidence.imports.locator.cell = 'B3'; },
    data => { data.monthly[0].evidence.imports.locator.observationDate = '2026-04'; },
    data => { data.monthly[0].evidence.imports.locator = {}; },
    data => { data.monthly[0].evidence.imports.unsupportedForecast = 13003; },
    data => { data.publicationEvidence['monthly.0.imports'].status = 'final'; },
    data => {
      data.publicationEvidence['monthly.0.imports'].status = 'final';
      data.monthly[0].observations.imports.status = 'final';
      data.monthly[0].observations.imports.sourceStatus = 'P';
    },
    data => { data.monthly[0].sourceType = 'secondary-attributed'; },
    data => { data.monthly[0].source = 'https://www.dawn.com/news/1'; },
  ]) {
    const data = fieldPayload();
    alter(data);
    assert.ok(assessPublication(automated, data, fieldOptions()).violations.some(item => item.path === 'monthly.0.imports'));
  }
  assert.ok(assessPublication(automated, fieldPayload(), options).violations.some(item => item.path === 'monthly.0.imports'));
  const guessed = fieldPayload();
  guessed.monthly[0].imports = 9;
  guessed.publicationEvidence['monthly.0.imports'].contentHash = hashContent(9);
  assert.ok(assessPublication(automated, guessed, fieldOptions()).violations.some(item => item.path === 'monthly.0.imports'));
});

test('one-based API column maps and scoped issuer statuses are enforced', () => {
  const data = fieldPayload();
  data.monthly[0].evidence.imports.locator = {
    seriesKey: receipt.sourceKey, observationDate: '2026-03', row: 2, column: 3,
    columns: { seriesKey: 1, date: 2, value: 3, unit: 4, status: 5, comments: 6 },
  };
  data.monthly[0].observations.imports.status = 'provisional';
  data.publicationEvidence['monthly.0.imports'].status = 'provisional';
  assert.equal(assessPublication(automated, applyPublicationPolicy(automated, data, fieldOptions()), fieldOptions()).ok, true);
  data.monthly[0].evidence.imports.locator.columns.comments = 0;
  assert.ok(assessPublication(automated, data, fieldOptions()).violations.some(item => item.path === 'monthly.0.imports'));
});

test('multiple direct sources in one row need separate field descriptors, never one primary receipt blanket', () => {
  const second = { ...receipt, artifactId: 'another-official-receipt', sourceKey: 'another-table.pdf', sha256: 'b'.repeat(64) };
  const data = fieldPayload();
  data.monthly[0].exports = 8;
  data.monthly[0].evidence.exports = nativeRef(8, { artifactId: second.artifactId, sourceKey: second.sourceKey });
  data.monthly[0].observations.exports = { status: 'not-stated' };
  data.publicationEvidence['monthly.0.exports'] = evidenceFor(8, {
    sourceKey: second.sourceKey, artifactId: second.artifactId, evidenceHash: second.sha256,
    method: 'automated', status: 'not-stated',
  });
  const proof = {
    ...fieldOptions(), evidence: { ...options.evidence, [second.artifactId]: second },
    verifiedAutomatedClaims: { ...fieldOptions().verifiedAutomatedClaims, 'monthly.0.exports': hashContent(8) },
  };
  assert.equal(assessPublication(automated, data, proof).ok, true);
  const blanket = structuredClone(data);
  blanket.publicationEvidence = { 'monthly.0': evidenceFor(blanket.monthly[0]) };
  assert.equal(assessPublication(automated, blanket, proof).ok, false);
  data.publicationEvidence['monthly.0'] = evidenceFor(data.monthly[0]);
  assert.equal(assessPublication(automated, data, proof).ok, false);
});

test('annual scalar fields remain manual even if their descriptor says automated', () => {
  const data = {
    annual: [{ fy: 'FY2026', gdpGrowth: 5 }],
    publicationEvidence: { 'annual.0.gdpGrowth': evidenceFor(5, { method: 'automated', status: 'estimate' }) },
  };
  assert.equal(assessPublication(manual, data, options).ok, false);
  reviewed(data);
  assert.equal(assessPublication(manual, data, options).ok, true);
  data.annual[0].gdpGrowth++;
  data.publicationEvidence['annual.0.gdpGrowth'].contentHash = hashContent(6);
  assert.equal(assessPublication(manual, data, options).ok, false);
});

test('exact derived scopes bind complete nested lineage and canonical input values, not just shared artifact hashes', () => {
  const direct = nativeRef(6);
  const nested = {
    derivation: 'mean of two complete consecutive monthly imports',
    inputs: [
      nativeRef(2, { locator: { sheet: 'Table', row: 3, column: 2, cell: 'B3', observationDate: '2026-01' } }),
      nativeRef(2, { locator: { sheet: 'Table', row: 4, column: 2, cell: 'B4', observationDate: '2026-02' } }),
    ],
  };
  const formula = 'reserve stock / independently supported mean monthly imports';
  const data = {
    current: { importCoverMonths: 3, evidence: { importCoverMonths: { derivation: formula, inputs: [direct, nested] } } },
    publicationEvidence: {
      'current.importCoverMonths': {
        sourceType: 'official-derived', method: 'automated', status: 'not-stated',
        formula, inputs: ['stock', 'imports'], location: 'Exact stock and imports input scopes', contentHash: hashContent(3),
      },
    },
  };
  const input = { sourceType: 'official-primary', status: 'published', value: 6, contentHash: hashContent(6), evidenceHash: receipt.sha256, evidence: direct };
  const proof = {
    ...options, verifiedAutomatedClaims: { 'current.importCoverMonths': hashContent(3) },
    derivedInputs: {
      stock: input,
      imports: { ...input, sourceType: 'official-derived', value: 2, contentHash: hashContent(2), evidence: nested },
    },
  };
  assert.equal(assessPublication(automated, data, proof).ok, true);
  for (const alter of [
    (value, args) => { delete args.derivedInputs.imports.evidence; },
    (value, args) => { args.derivedInputs.imports.value = 8; },
    (value, args) => { args.derivedInputs.imports.evidence.inputs[0].locator.observationDate = '2026-02'; },
    value => { value.current.evidence.importCoverMonths.inputs[1].complete = false; },
    value => { value.current.evidence.importCoverMonths.inputs[1].inputs = []; },
    value => { value.publicationEvidence['current.importCoverMonths'].sourceType = 'official-primary'; },
    value => { value.publicationEvidence['current.importCoverMonths'].status = 'final'; },
  ]) {
    const value = structuredClone(data);
    const args = structuredClone(proof);
    alter(value, args);
    assert.equal(assessPublication(automated, value, args).ok, false);
  }
});

test('field mode cannot hide unsupported economic claims in context labels, ranges or observation sidecars', () => {
  const data = fieldPayload();
  data.monthly[0].unit = 'Reported total 13003';
  data.monthly[0].period = { start: '2026-03', value: 13003 };
  data.monthly[0].observations.imports.comments = 'Latest total is 13003 million.';
  data.monthly[0].observations.imports.unsupportedEstimate = 13003;
  const audit = assessPublication(automated, data, fieldOptions());
  for (const path of [
    'monthly.0.unit', 'monthly.0.period.value',
    'monthly.0.observations.imports.comments', 'monthly.0.observations.imports.unsupportedEstimate',
  ]) assert.ok(audit.violations.some(item => item.path === path), path);
  const output = applyPublicationPolicy(automated, data, fieldOptions());
  assert.equal(output.monthly[0].imports, 5);
  assert.equal(JSON.stringify(output).includes('13003'), false);
  assert.equal(assessPublication(automated, output, fieldOptions()).ok, true);
});

test('unsafe own-property paths cannot access prototypes or leave unsupported figures in sanitized output', () => {
  const data = fieldPayload();
  data.monthly[0] = { ...data.monthly[0], ...JSON.parse('{"constructor":13003,"__proto__":{"hidden":13003}}') };
  const audit = assessPublication(automated, data, fieldOptions());
  assert.ok(audit.violations.some(item => item.path === 'monthly.0.constructor'));
  assert.ok(audit.violations.some(item => item.path === 'monthly.0.__proto__'));
  const output = applyPublicationPolicy(automated, data, fieldOptions());
  assert.equal(output.monthly[0].imports, 5);
  assert.equal(JSON.stringify(output).includes('13003'), false);
  assert.equal(Object.hasOwn(Object.prototype, 'hidden'), false);
  assert.equal(assessPublication(automated, output, fieldOptions()).ok, true);
});

test('removed rows remap surviving descendant descriptors and withheld child paths without collapsing unrelated null gaps', () => {
  const data = fieldPayload();
  data.monthly.unshift(13003);
  data.publicationEvidence = { unused: null, 'monthly.1.imports': data.publicationEvidence['monthly.0.imports'] };
  data.gaps = [null, 0, null];
  data.publicationEvidence.gaps = evidenceFor(data.gaps);
  const proof = { ...options, verifiedAutomatedClaims: { 'monthly.1.imports': hashContent(5) } };
  const output = applyPublicationPolicy(automated, data, proof);
  assert.equal(output.monthly.length, 1);
  assert.ok(output.publicationEvidence['monthly.0.imports']);
  assert.ok(output.publication.withheldFields.includes('monthly.0.exports'));
  assert.deepEqual(output.gaps, [null, 0, null]);
  assert.equal(assessPublication(automated, output, fieldOptions()).ok, true);
  assert.deepEqual(applyPublicationPolicy(automated, output, fieldOptions()), output);
});

test('exact-field async enforcement and audit preserve explicit independent confirmation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pak-field-publication-test-'));
  const dataset = { ...automated, file: 'test.json' };
  try {
    const data = fieldPayload();
    data.monthly.unshift(13003);
    data.publicationEvidence = { 'monthly.1.imports': data.publicationEvidence['monthly.0.imports'] };
    await writeFile(join(directory, dataset.file), JSON.stringify(data));
    const proof = { ...options, verifiedAutomatedClaims: { test: { 'monthly.1.imports': hashContent(5) } } };
    const reports = await enforcePublicationPolicy({ datasets: [dataset], dataDir: directory, ...proof });
    assert.equal(reports[0].publication.status, 'partial');
    const saved = await readFile(join(directory, dataset.file), 'utf8');
    assert.equal(saved.includes('13003'), false);
    const confirmed = { ...options, verifiedAutomatedClaims: { test: { 'monthly.0.imports': hashContent(5) } } };
    const { auditPublication } = await import('../audit-publication.mjs');
    assert.equal((await auditPublication({ datasets: [dataset], dataDir: directory, ...confirmed })).ok, true);
    await enforcePublicationPolicy({ datasets: [dataset], dataDir: directory, ...confirmed });
    assert.equal(await readFile(join(directory, dataset.file), 'utf8'), saved);
  } finally {
    await rm(directory, { recursive: true });
  }
});
