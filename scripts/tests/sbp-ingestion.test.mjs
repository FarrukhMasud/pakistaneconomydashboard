import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { __test__, countryTradeColumns, parseReserveTable } from '../parse-sbp-excel.mjs';
import { parseServicesHeadline } from '../lib/services-headline.mjs';
import { fetchSeries } from '../update-data.mjs';
import { parseFiscalYear, fiscalMonthToYearMonth, resolveFytdColumn } from '../lib/sheet-utils.mjs';

const receipt = { artifactId: 'official-fixture', sourceKey: 'fixture.xls', retrievedAt: '2026-08-01T00:00:00Z' };
const item = (x, y, text) => ({ page: 1, x, y, text });

test('workbook cells preserve exact original coordinates, raw comma value, zero and scale', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[null, null], ['Line', '1,250.50'], ['Zero', 0], ['Missing', null]]), 'Table');
  __test__.registerWorkbook(workbook, receipt);
  const rows = __test__.getSheet(workbook, 'Table');
  assert.equal(__test__.cellNumber(rows, 1, 1, { divisor: 1000 }), 1.2505);
  assert.equal(__test__.cellNumber(rows, 2, 1), 0);
  assert.throws(() => __test__.cellNumber(rows, 3, 1), /Missing required/);
  assert.equal(__test__.cellNumber(rows, 3, 1, { required: false }), null);
  assert.deepEqual(__test__.cellEvidence(rows, 1, 1, { scale: 0.001 }), {
    artifactId: receipt.artifactId, sourceKey: receipt.sourceKey, retrievedAt: receipt.retrievedAt,
    locator: { sheet: 'Table', row: 2, column: 2, cell: 'B2' }, rawValue: '1,250.50', scale: 0.001,
  });

});

test('a worksheet used range starting in column B retains absolute Excel locators', () => {
  const workbook = XLSX.utils.book_new();
  const sheet = { B2: { t: 's', v: 'Value' }, C2: { t: 'n', v: 1250 }, '!ref': 'B2:C2' };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Offset');
  __test__.registerWorkbook(workbook, receipt);
  const rows = __test__.getSheet(workbook, 'Offset');
  assert.equal(__test__.cellNumber(rows, 1, 1), 1250);
  assert.deepEqual(__test__.cellEvidence(rows, 1, 1).locator, { sheet: 'Offset', row: 2, column: 3, cell: 'C2' });
});

test('BOP printed periods have exact independent source scopes and issuer revision status', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['(Million US$)'], ['Items', 'Jul-Aug', null, 'Jul', 'Aug'],
    [null, 'FY26', 'FY27P', 'FY27R', 'FY27P'],
    ['Exports of Services', 100, 200, 90, 110],
  ]), 'BPM6_Summary');
  __test__.registerWorkbook(workbook, receipt);
  const rows = __test__.getSheet(workbook, 'BPM6_Summary');
  const blocks = __test__.bopSourceBlocks(rows, /^Exports of Services$/, 'BOP-services-credit');
  assert.equal(blocks[1].start, '2026-07');
  assert.equal(blocks[1].end, '2026-08');
  assert.equal(blocks[1].status, 'provisional');
  assert.equal(blocks[2].status, 'revised');
  assert.equal(blocks[2].evidence.locator.cell, 'D4');
  rows[3][2] = null;
  assert.throws(() => __test__.bopSourceBlocks(rows, /^Exports of Services$/, 'BOP-services-credit'), /Missing required/);
});

test('independently supplied BOP totals reconcile only complete matching windows and fail real contradictions', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['(Million US$)'], ['Items', 'Jul-Aug', null],
    [null, 'FY26', 'FY27P'], ['Workers Remittances', 90, 200],
  ]), 'BPM6_Summary');
  __test__.registerWorkbook(workbook, receipt);
  const rows = __test__.getSheet(workbook, 'BPM6_Summary');
  const fields = [['total', /^Workers Remittances$/, 'BOP-workers-remittances']];
  const observations = [
    { date: '2026-08', total: 110, evidence: { total: { artifactId: 'API-Aug' } } },
    { date: '2026-07', total: 90, evidence: { total: { artifactId: 'API-Jul' } } },
  ];
  assert.equal(__test__.reconcileBopRows(rows, observations, fields).at(-1).result, 'matched');
  assert.throws(() => __test__.reconcileBopRows(rows, observations.map(row => ({ ...row, total: row.total + 5 })), fields), /reconciliation failed/);
  assert.equal(__test__.reconcileBopRows(rows, observations.slice(0, 1), fields).at(-1).reason, 'different-coverage');
  assert.equal(__test__.reconcileBopRows(rows, observations.map(row => ({ ...row, total: null })), fields).at(-1).reason, 'missing-observations');
  assert.equal(__test__.reconcileBopRows(rows, observations.map(row => ({ ...row, evidence: {} })), fields).at(-1).reason, 'missing-source-evidence');
});

test('trade preserves prior history and published balance, and rejects malformed populated date cells before publication', async () => {
  const rows = [
    ['(Million US$)'],
    [null, 'Period', null, 'Exports (BOP)', null, null, null, 'Imports (BOP)', null, null, null, 'Balance of Trade'],
    [null, null, null, 'Value', null, null, null, 'Value'],
    [null, Date.UTC(2026, 7, 1) / 86400000 + 25569, 'P', 10, null, null, null, 12, null, null, null, -2],
    [null, '2025-26', null, 100, null, null, null, 120, null, null, null, -20],
  ];
  const previous = { date: '2020-12', exports: 3, imports: 4, balance: -1, evidence: { balance: { artifactId: 'older' } } };
  let output;
  const run = async sourceRows => {
    const trade = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(trade, XLSX.utils.aoa_to_sheet(sourceRows), 'Exp.Imp.(BOP)Arch');
    const bop = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(bop, XLSX.utils.aoa_to_sheet([
      ['(Million US$)'], ['Items', 'Aug'], [null, 'FY27P'],
      ['Exports of Goods FOB', 10], ['Imports of Goods FOB', 12],
    ]), 'BPM6_Summary');
    await __test__.updateTrade({
      loadWorkbook: async filename => {
        const workbook = filename === 'exp_import_BOP.xls' ? trade : bop;
        __test__.registerWorkbook(workbook, { ...receipt, sourceKey: filename });
        return workbook;
      },
      readData: async () => ({ monthly: [previous] }),
      writeData: async (filename, data) => { assert.equal(filename, 'trade.json'); output = data; },
    });
  };
  await run(rows);
  assert.equal(output.monthly[0], previous);
  assert.equal(output.monthly.at(-1).date, '2026-08');
  assert.equal(output.monthly.at(-1).balance, -2);
  assert.equal(output.monthly.at(-1).status, 'provisional');
  assert.equal(output.monthly.at(-1).evidence.balance.locator.cell, 'L4');
  for (const period of [null, 'Aug-26junk', '2026-08-32', '2025-27']) {
    output = null;
    const invalid = rows.map(row => [...row]);
    invalid[3][1] = period;
    await assert.rejects(run(invalid), /Malformed fiscal year range/);
    assert.equal(output, null);
  }
});

function fdiFixtures() {
  const detailed = XLSX.utils.book_new();
  const sector = [[], ['(Million US$)'], [], [], [],
    [null, null, null, 'July-August FY27 (P)', null, null, 'July-August FY26'],
    [null, null, 'Sector', 'Inflow', 'Outflow', 'Net FDI', 'Inflow', 'Outflow', 'Net FDI'],
    [1, null, 'Power', 10, 2, 8, 6, 1, 5],
    [2, null, 'IT & Telecom', 0, 0, 0, 0, 0, 0],
    [null, 'TOTAL', null, 10, 2, 8, 6, 1, 5],
  ];
  const country = [[], ['(Million US$)'], [],
    [null, null, 'July-August FY27 (P)', null, null, 'July-August FY26'],
    [null, null, 'FDI', null, null, 'FDI'],
    [null, 'Country', 'Inflow', 'Outflow', 'Net', 'Inflow', 'Outflow', 'Net'],
    [1, 'China', 10, 2, 8, 6, 1, 5],
    [2, 'Others', 0, 0, 0, 0, 0, 0],
    ['TOTAL', null, 10, 2, 8, 6, 1, 5],
  ];
  XLSX.utils.book_append_sheet(detailed, XLSX.utils.aoa_to_sheet(sector), 'Sector');
  XLSX.utils.book_append_sheet(detailed, XLSX.utils.aoa_to_sheet(country), 'Country');
  const summary = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(summary, XLSX.utils.aoa_to_sheet([
    [], ['(Million US$)'], [], [],
    [null, null, null, null, 'FY25', 'May', null, 'Jul-May'],
    [null, null, null, null, null, 'FY25', 'FY26 (P)', 'FY26 (P)', 'FY25'],
    [], [], [null, 'Direct Investment', null, null, 12, 4, 3, 30, 29],
    [null, null, null, 'Inflow', 14, 6, 5, 35, 34],
    [null, null, null, 'Outflow', 2, 2, 2, 5, 5],
  ]), 'Summary');
  return { 'Netinflow.xls': detailed, 'NetinflowSummary.xls': summary };
}

test('FDI whole stage preserves exact multi-workbook scopes, historical evidence, zero sectors and lagging FY coverage', async () => {
  const workbooks = fdiFixtures();
  let output;
  const previous = { year: 'FY2018', net_fdi: 2, evidence: { net_fdi: { artifactId: 'old', retrievedAt: '2019-01-01' } } };
  await __test__.updateFdi({
    loadWorkbook: async filename => {
      const workbook = workbooks[filename];
      __test__.registerWorkbook(workbook, { ...receipt, sourceKey: filename, artifactId: filename });
      return workbook;
    },
    readData: async () => ({ annual: [previous], monthly: [] }),
    writeData: async (filename, data) => { assert.equal(filename, 'fdi.json'); output = data; },
  });
  assert.equal(output.fytdComparison.current.label, 'FY2027');
  assert.equal(output.fytdComparison.period, 'Jul-Aug');
  assert.equal(output.fytdComparison.current.net_fdi, 8);
  assert.equal(output.fytdComparison.prior.status, 'not-stated');
  assert.equal(output.fytdComparison.current.evidence.net_fdi.sourceKey, 'Netinflow.xls');
  assert.equal(output.fytdComparison.current.evidence.net_fdi.locator.cell, 'E9');
  assert.equal(output.annual.at(-1).evidence.net_fdi.sourceKey, 'NetinflowSummary.xls');
  assert.equal(output.annual[0], previous);
  assert.equal(output.by_sector.find(row => row.sector === 'IT & Telecom').amount, 0);
  assert.ok(output.reconciliation.some(check => check.result === 'not-comparable' && check.reason === 'different-coverage'));
});

test('FDI inconsistent independently supplied totals abort the stage before publication', async () => {
  const workbooks = fdiFixtures();
  const table = workbooks['Netinflow.xls'].Sheets.Country;
  table.E9.v = 9;
  let wrote = false;
  await assert.rejects(__test__.updateFdi({
    loadWorkbook: async filename => {
      const workbook = workbooks[filename];
      __test__.registerWorkbook(workbook, { ...receipt, sourceKey: filename });
      return workbook;
    },
    readData: async () => ({}),
    writeData: async () => { wrote = true; },
  }), /reconciliation failed/);
  assert.equal(wrote, false);
});

test('EBOPS period headers include explicitly unflagged months and sort unordered FY-rollover observations', () => {
  const cols = __test__.servicesSourceColumns([null, 'Jan-27', null, null, 'Dec-26 (R)', null, null, 'Jul-Jan, FY26', null, null, 'Jul-Jan, FY27 (P)']);
  assert.equal(cols.current.fy, 2027);
  assert.equal(cols.current.status, 'provisional');
  assert.equal(cols.prior.status, 'not-stated');
  assert.equal(cols.month1.month, '2026-12');
  assert.equal(cols.month2.month, '2027-01');
  assert.equal(cols.month2.status, 'not-stated');
  assert.throws(() => __test__.servicesSourceColumns([null, 'Janblah-27', null, null, 'Jul-Jan FY27', null, null, 'Jul-Jan FY26']), /month/);
  assert.throws(() => __test__.servicesSourceColumns([null, 'Jan-27', null, null, 'Jan-27 (P)', null, null, 'Jul-Jan FY27', null, null, 'Jul-Jan FY26']), /Duplicate/);
});

function servicesFixtures() {
  const rows = Array.from({ length: 8 }, () => []);
  rows[1] = ['(Thousand US$)'];
  rows[6] = [null, 'Aug-26 (P)', null, null, 'Jul-26', null, null, 'Jul-Aug FY26', null, null, 'Jul-Aug FY27 (P)'];
  rows[7] = [null, 'Credit', 'Debit', 'Net', 'Credit', 'Debit', 'Net', 'Credit', 'Debit', 'Net', 'Credit', 'Debit', 'Net'];
  const append = (label, credit) => rows.push([label, credit, 0, credit, credit, 0, credit, credit * 2, 0, credit * 2, credit * 2, 0, credit * 2]);
  append('Services', 31000);
  for (const label of [
    '1. Manufacturing services', '2. Maintenance and repair', '3. Transport', '4. Travel', '5. Construction',
    '6. Insurance', '7. Financial', '8. Charges for the use of intellectual property',
  ]) append(label, 1000);
  append('9. Telecommunications, Computer and information services', 20000);
  append('9.1 Telecommunications', 1000);
  append('9.2 Computer services', 18000);
  append('9.2.2 Software Consultancy', 6000);
  append('9.2.4 Computer Software Exports', 8000);
  append('9.2.5 Freelance', 0);
  append('9.3 Information services', 1000);
  append('10. Other business', 1000);
  append('11. Personal, cultural', 1000);
  append('12. Government goods and services', 1000);
  rows.push(['1. Credit means exports (footnote, not a category)']);
  const ebops = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(ebops, XLSX.utils.aoa_to_sheet(rows), 'EBOPS ');
  const bop = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(bop, XLSX.utils.aoa_to_sheet([
    ['(Million US$)'], ['Items', 'Jul-Aug', null, 'Jul', 'Aug'],
    [null, 'FY26', 'FY27P', 'FY27', 'FY27P'],
    ['Exports of Services', 62, 62, 31, 31],
  ]), 'BPM6_Summary');
  return { 'dt.xls': ebops, 'Balancepayment_BPM6.xls': bop };
}

test('EBOPS whole stage keeps historical receipts, exact scaling and true zero, excludes footnotes and reconciles independent BOP', async () => {
  const workbooks = servicesFixtures();
  const previous = { month: '2025-01', totalCredit: 7, itCredit: 1, evidence: {
    totalCredit: { artifactId: 'older', retrievedAt: '2025-02-01' },
    itCredit: { artifactId: 'older', retrievedAt: '2025-02-01' },
  } };
  let output;
  await __test__.updateServices({
    loadWorkbook: async filename => {
      const workbook = workbooks[filename];
      __test__.registerWorkbook(workbook, { ...receipt, sourceKey: filename });
      return workbook;
    },
    readData: async () => ({ monthlySeries: [previous, { month: '2025-02', totalCredit: 8, itCredit: 2 }] }),
    writeData: async (filename, data) => { assert.equal(filename, 'services.json'); output = data; },
  });
  assert.equal(output.monthlySeries[0], previous);
  assert.equal(output.monthlySeries.some(row => row.month === '2025-02'), false);
  assert.equal(output.itMonthly.latestMonth, '2026-08');
  assert.equal(output.itMonthly.prevMonth, '2026-07');
  assert.equal(output.itMonthly.components.find(component => component.key === 'freelance').latest, 0);
  assert.equal(output.itMonthly.components.find(component => component.key === 'freelance').evidence.latest.scale, 0.001);
  assert.equal(output.comparison.current.fy, 2027);
  assert.equal(output.comparison.fy27.itCredit, 40);
  assert.equal(output.comparison.fy25, undefined);
  assert.ok(output.reconciliation.some(check => check.check === 'Independent SBP BOP totalCredit' && check.result === 'matched'));
});

test('EBOPS rejects inconsistent prior computer components before publication', async () => {
  const workbooks = servicesFixtures();
  workbooks['dt.xls'].Sheets['EBOPS '].H20.v = 1000;
  let wrote = false;
  await assert.rejects(__test__.updateServices({
    loadWorkbook: async filename => {
      const workbook = workbooks[filename];
      __test__.registerWorkbook(workbook, { ...receipt, sourceKey: filename });
      return workbook;
    },
    readData: async () => ({}),
    writeData: async () => { wrote = true; },
  }), /prior named computer-service components exceed/);
  assert.equal(wrote, false);
});

test('GDP growth uses its printed percent unit, preserves zero and historical evidence, and rejects invalid periods or cells', async () => {
  const previous = { year: 'FY2017', gdpGrowth: 4, evidence: { gdpGrowth: { artifactId: 'older' } } };
  const validRows = [
    ['(Rs. Million)'],
    [null, null, 'Sector/Industry', '2024-25', '2025-26 (P)'],
    [null, null, 'GDP Growth Rate (%)', 0, 3.75],
  ];
  let output;
  const run = async rows => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Annual');
    __test__.registerWorkbook(workbook, { ...receipt, sourceKey: 'GDP_table.xlsx' });
    await __test__.updateGdpFiscal({
      loadWorkbook: async () => workbook,
      readData: async () => ({ annual: [previous], publicFinance: { retained: true } }),
      writeData: async (filename, data) => { assert.equal(filename, 'fiscal.json'); output = data; },
    });
  };
  await run(validRows);
  assert.equal(output.annual[0].evidence.gdpGrowth.artifactId, 'older');
  assert.equal(output.publicFinance.retained, true);
  assert.equal(output.annual[1].gdpGrowth, 0);
  assert.equal(output.annual[1].gdpGrowthStatus, 'not-stated');
  assert.equal(output.annual.at(-1).gdpGrowthStatus, 'provisional');
  assert.equal(output.annual.at(-1).evidence.gdpGrowth.locator.cell, 'E3');
  assert.equal(output.annual.at(-1).evidence.gdpGrowth.periodHeader.cell, 'E2');
  assert.equal(output.annual.at(-1).evidence.gdpGrowth.unitHeader.cell, 'C3');
  assert.equal(output.annual.at(-1).evidence.gdpGrowth.unit, '%');
  for (const [row, column, value, error] of [
    [1, 4, '2025-27', /Malformed fiscal year/],
    [1, 4, '2024-25', /duplicate fiscal year/],
    [1, 4, null, /missing\/malformed fiscal period/],
    [2, 4, null, /Missing required numeric/],
    [2, 4, '3.75junk', /Invalid numeric/],
    [2, 2, 'GDP Growth Rate', /Missing printed source unit/],
  ]) {
    output = null;
    const invalid = validRows.map(cells => [...cells]);
    invalid[row][column] = value;
    await assert.rejects(run(invalid), error);
    assert.equal(output, null);
  }
});

function kpiFixtures() {
  const withheld = { publication: { policy: 'official-only', status: 'withheld', reason: 'Official evidence unavailable', withheldFields: [] } };
  return {
    'reserves.json': { weekly: [{ date: '2026-08-01', sbp: 10000, banks: 5000, total: 15000 }] },
    'exchange-rates.json': { monthly: [{ date: '2026-08', USD: 281 }] },
    'remittances.json': { monthly: [{ date: '2026-08', total: null }] },
    'fdi.json': { fytdComparison: { period: 'Jul-Aug', current: { label: 'FY2027', net_fdi: 1000 }, prior: { label: 'FY2026', net_fdi: 0 } } },
    'services.json': { itHeadline: {
      fiscalYear: 2027, fytdLabel: 'Jul-Aug FY27', fytdPriorLabel: 'Jul-Aug FY26', fytd: 811, fytdPrior: 691,
      statuses: { fytd: 'provisional' }, evidence: { fytd: { ...receipt, locator: { page: 1, x: 32.8, y: 16.5 }, scale: 1 } },
    } },
    'fiscal.json': { annual: [{ year: 'FY2026', gdpGrowth: 2.5 }] },
    'inflation.json': { national_cpi: { data: [{ date: '2026-08', value: null }] } },
    'fbr-tax.json': withheld, 'monetary-policy.json': withheld,
  };
}

test('KPI stage intentionally omits policy-withheld data, retains missing values and scales lineage without inventing comparisons', async () => {
  const inputs = kpiFixtures();
  let output;
  await __test__.generateKpiFromData({
    readData: async filename => inputs[filename],
    writeData: async (filename, data) => { assert.equal(filename, 'kpi-summary.json'); output = data; },
    recordCitations: async () => {},
  });
  assert.equal(output.indicators.length, 7);
  assert.deepEqual(output.withheldIndicators.map(indicator => indicator.id), ['fbr-tax', 'policy-rate']);
  assert.equal(output.indicators.find(indicator => indicator.id === 'remittances').value, null);
  assert.equal(output.indicators.find(indicator => indicator.id === 'inflation').trend, 'unavailable');
  assert.equal(output.indicators.find(indicator => indicator.id === 'fdi').change, null);
  assert.equal(output.indicators.find(indicator => indicator.id === 'reserves').change, null);
  const it = output.indicators.find(indicator => indicator.id === 'it_exports');
  assert.equal(it.value, 0.81);
  assert.equal(it.change, 17.37);
  assert.equal(it.status, 'provisional');
  assert.equal(it.evidence.inputs[0], inputs['services.json'].itHeadline.evidence.fytd);
  assert.match(it.evidence.derivation, /divided by 1000/);
});

test('KPI stage still fails unexplained missing required data instead of manufacturing an official withholding reason', async () => {
  const inputs = kpiFixtures();
  inputs['fbr-tax.json'] = {};
  let wrote = false;
  await assert.rejects(__test__.generateKpiFromData({
    readData: async filename => inputs[filename],
    writeData: async () => { wrote = true; },
    recordCitations: async () => {},
  }), /KPI generation incomplete; missing: fbr-tax/);
  assert.equal(wrote, false);
});

test('KPI stage distinguishes supported historical rows from partially withheld current FBR and policy-rate headlines', async () => {
  const inputs = kpiFixtures();
  inputs['fbr-tax.json'] = {
    monthly: [{ date: '2025-06', net: 100 }], fyTotals: [{ fy: 'FY2025', net: 1000 }],
    fytd: { net: null, target: null, priorNet: null },
    publication: { policy: 'official-only', status: 'partial', reason: 'Current fiscal-year headline is unreviewed', withheldFields: ['fytd'] },
  };
  inputs['monetary-policy.json'] = {
    currentRate: null, decisions: [{ date: '2025-06-01', rate: 10 }],
    publication: { policy: 'official-only', status: 'partial', reason: 'Current rate is unreviewed', withheldFields: ['currentRate'] },
  };
  let output;
  await __test__.generateKpiFromData({
    readData: async filename => inputs[filename],
    writeData: async (_filename, data) => { output = data; },
    recordCitations: async () => {},
  });
  assert.equal(output.indicators.length, 7);
  assert.deepEqual(output.withheldIndicators, [
    { id: 'fbr-tax', dataset: 'fbr-tax.json', reason: 'Current fiscal-year headline is unreviewed' },
    { id: 'policy-rate', dataset: 'monetary-policy.json', reason: 'Current rate is unreviewed' },
  ]);
});

test('KPI partial target withholding preserves supported FBR value and never converts missing monthly collection to zero', async () => {
  const inputs = kpiFixtures();
  inputs['fbr-tax.json'] = {
    monthly: [{ date: '2026-08', net: null }],
    fytd: { net: 2500, target: null, priorNet: null, period: 'Jul-Aug FY27', sourceType: 'official-primary' },
    publication: { policy: 'official-only', status: 'partial', reason: 'Target is unavailable', withheldFields: ['fytd.target'] },
  };
  let output;
  const run = () => __test__.generateKpiFromData({
    readData: async filename => inputs[filename],
    writeData: async (_filename, data) => { output = data; },
    recordCitations: async () => {},
  });
  await run();
  const fbr = output.indicators.find(indicator => indicator.id === 'fbr-tax');
  assert.equal(fbr.value, 2.5);
  assert.equal(fbr.change, null);
  assert.equal(fbr.sub, 'Latest monthly collection unavailable');
  assert.equal(output.withheldIndicators.some(indicator => indicator.id === 'fbr-tax'), false);
  inputs['fbr-tax.json'].fytd.target = 0;
  inputs['fbr-tax.json'].publication = { policy: 'official-only', status: 'published', reason: null, withheldFields: [] };
  await run();
  assert.match(output.indicators.find(indicator => indicator.id === 'fbr-tax').sub, /Target.*0\.00T/);
});

test('KPI stage rejects malformed partial withholding metadata before publication', async () => {
  const inputs = kpiFixtures();
  let wrote = false;
  for (const withheldFields of [undefined, [], [false]]) {
    inputs['fbr-tax.json'] = {
      publication: { policy: 'official-only', status: 'partial', reason: 'Unreviewed', withheldFields },
    };
    await assert.rejects(__test__.generateKpiFromData({
      readData: async filename => inputs[filename],
      writeData: async () => { wrote = true; },
      recordCitations: async () => {},
    }), /Invalid withholding metadata/);
    assert.equal(wrote, false);
  }
});

test('trade-country period/header resolution works with unordered months and July rollover', () => {
  const rows = [
    [], [], [], ['(Thousand US Dollar)'],
    ['Country', 'Aug (P)', 'Jul-Aug', null, 'Jul (R)', 'Aug'],
    [null, 'FY27', 'FY26', 'FY27 (P)', 'FY27', 'FY26'],
  ];
  const cols = countryTradeColumns(rows);
  assert.equal(cols.latest, 1);
  assert.equal(cols.prev, 4);
  assert.equal(cols.latestMonth, '2026-08');
  assert.equal(cols.prevMonth, '2026-07');
  assert.equal(cols.yearAgoMonth, '2025-08');
  assert.equal(cols.fytdCur, 3);
  assert.equal(cols.coverage.fytd.end, '2026-08');
  rows[4][2] = 'Jul-Unknown';
  assert.throws(() => countryTradeColumns(rows), /Invalid fiscal cumulative period/);
});

test('strict FY parsing rejects malformed tokens instead of silently truncating a year', () => {
  assert.equal(parseFiscalYear('FY27P'), 2027);
  assert.equal(parseFiscalYear('FY2027 (R)'), 2027);
  for (const value of ['FY270', 'FY20270', 'FY27junk', 'FY2', 'FY0000']) assert.equal(parseFiscalYear(value), null);
  assert.equal(fiscalMonthToYearMonth('Julblah', 'FY27'), null);
  assert.equal(resolveFytdColumn([null, 'Jul-Aug (P)'], [null, 'FY27'], 2027).status, 'provisional');
  assert.equal(resolveFytdColumn([null, 'Jul-Aug'], [null, 'FY27R'], 2027).status, 'revised');
  assert.equal(resolveFytdColumn([null, 'Jul-Aug'], [null, 'FY27'], 2027).status, 'not-stated');
});

const reserveItems = values => [
  item(16, 6, '(MILLION US$)'),
  item(14, 8, 'SBP'), item(21, 8, 'BANKS'), item(27, 8, 'TOTAL LIQUID'),
  item(5, 10, '18-Sep-26 (P)'),
  ...values.map((value, index) => item([15, 23, 29][index], 10, value)),
  item(11, 10, ' '),
];

test('reserve rows require the independent published total, distinguish zero, and retain exact PDF cells', () => {
  const parsed = parseReserveTable(reserveItems(['1,000.0', '0', '1,000.0']), receipt);
  assert.equal(parsed[0].banks, 0);
  assert.equal(parsed[0].total, 1000);
  assert.equal(parsed[0].status, 'provisional');
  assert.equal(parsed[0].evidence.total.locator.x, 29);
  assert.equal(parsed[0].evidence.total.locator.page, 1);
  assert.throws(() => parseReserveTable(reserveItems(['1,000.0', '0']), receipt), /all three/);
  assert.throws(() => parseReserveTable(reserveItems(['1,000.0', '...', '1,000.0']), receipt), /required numeric/);
  assert.throws(() => parseReserveTable(reserveItems(['1,000.0', '10', '1,020.0']), receipt), /reconciliation/);
  const invalidDate = reserveItems(['1', '1', '2']);
  invalidDate[4].text = '31-Feb-26';
  assert.throws(() => parseReserveTable(invalidDate, receipt), /calendar/);
});

const headlineItems = () => [
  item(2, 4, '(Million US $ )'),
  item(16.8, 5.6, 'Jul-Jun'), item(19.6, 5.6, 'Aug'), item(21.8, 5.6, 'Jul-Jun'),
  item(24.7, 5.6, 'Jul'), item(27.1, 5.6, 'Aug'), item(30.45, 5.6, 'Jul-Aug'),
  item(17.1, 6.3, 'FY25'), item(19.55, 6.3, 'FY26'), item(22.0, 6.3, 'FY26'),
  item(24.4, 6.3, 'FY27'), item(26.9, 6.3, 'FY27'), item(29.45, 6.3, 'FY26'), item(31.85, 6.3, 'FY27'),
  item(25.3, 6.1, 'R'), item(27.8, 6.1, 'P'), item(32.74, 6.1, 'P'),
  item(2.65, 9.9, '2. Exports of Services'),
  ...[8450, 677, 10020, 939, 872, 1405, 1811].map((value, i) => item([17.9, 20.4, 22.8, 25.4, 27.86, 30.34, 32.82][i], 9.9, String(value))),
  item(3.6, 16.5, '9. Telecommunications, Computer, and Information Services'),
  ...[3814, 337, 4600, 417, 394, 691, 811].map((value, i) => item([17.9, 20.4, 22.8, 25.4, 27.86, 30.34, 32.82][i], 16.5, String(value))),
];

test('headline resolves merged FYTD via header anchors even when a value is more than two units from its label', () => {
  const headline = parseServicesHeadline(headlineItems(), { receipt });
  assert.equal(headline.latestMonth, '2026-08');
  assert.equal(headline.fytdLabel, 'Jul-Aug FY27');
  assert.equal(headline.fytdPriorLabel, 'Jul-Aug FY26');
  assert.equal(headline.fytd, 811);
  assert.equal(headline.statuses.prev, 'revised');
  assert.equal(headline.status, 'provisional');
  assert.equal(headline.evidence.fytd.artifactId, receipt.artifactId);
  assert.equal(headline.evidence.fytd.locator.periodHeader.text, 'Jul-Aug');
  assert.equal(headline.evidence.fytd.locator.x, 32.82);
  assert.ok(!headline.fytdLabel.includes('null'));
  assert.equal(headline.reconciliation[0].result, 'matched');
  const contradiction = headlineItems().map(item => item.text === '811' ? { ...item, text: '900' } : item);
  assert.throws(() => parseServicesHeadline(contradiction), /reconciliation failed/);
  const zero = headlineItems().map(item => item.text === '394' ? { ...item, text: '0' } : item.text === '811' ? { ...item, text: '417' } : item);
  assert.equal(parseServicesHeadline(zero).latest, 0);
});

test('headline rejects missing/malformed period, numeric cells, units and duplicate column values', () => {
  const missing = headlineItems().filter(item => item.text !== 'Jul-Aug');
  assert.throws(() => parseServicesHeadline(missing), /header/);
  const malformed = headlineItems().map(item => item.text === 'Jul-Aug' ? { ...item, text: 'Jul-Unknown' } : item);
  assert.throws(() => parseServicesHeadline(malformed), /Invalid fiscal cumulative period/);
  const invalidValue = headlineItems().map(item => item.text === '811' ? { ...item, text: '8xx' } : item);
  assert.throws(() => parseServicesHeadline(invalidValue), /numeric/);
  assert.throws(() => parseServicesHeadline(headlineItems().filter(item => !item.text.includes('Million'))), /unit/);
  const duplicates = headlineItems();
  duplicates.push(item(32.82, 16.5, '811'));
  assert.throws(() => parseServicesHeadline(duplicates), /duplicate/);
});

test('API capture receives the exact raw response bytes and canonical URLs without credentials', async () => {
  const bytes = Buffer.from('{"columns":[],"rows":[]}');
  let captured;
  let options;
  const result = await fetchSeries('series', 'secret-do-not-archive', '2026-01-01', '2026-09-01', {
    fetchImpl: async (url, input) => {
      assert.ok(url.includes('api_key=secret-do-not-archive'));
      options = input;
      return new Response(bytes, { headers: { 'content-type': 'application/json' } });
    },
    captureArtifact: async input => { captured = input; return receipt; },
  });

  assert.equal(options.redirect, 'error');
  assert.equal(captured.body.equals(bytes), true);
  assert.equal(captured.sourceKey, 'series');
  assert.ok(!captured.sourceUrl.includes('secret'));
  assert.ok(!captured.responseUrl.includes('api_key'));
  assert.equal(new URL(captured.sourceUrl).searchParams.get('start_date'), '2026-01-01');
  assert.equal(result.receipt, receipt);
});

test('API failures are recorded against the exact series before being rethrown', async () => {
  const failures = [];
  await assert.rejects(fetchSeries('official-series', 'private-key', null, null, {
    fetchImpl: async () => new Response('', { status: 429 }),
    recordFailure: async (...args) => failures.push(args),
  }), /SBP API 429/);
  assert.deepEqual(failures, [['official-series', 'SBP API 429 for official-series']]);
});
