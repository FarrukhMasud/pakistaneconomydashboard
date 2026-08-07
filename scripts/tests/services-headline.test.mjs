import test from 'node:test';
import assert from 'node:assert/strict';

import { parseServicesHeadline } from '../lib/services-headline.mjs';

const item = (x, y, text) => ({ page: 1, x, y, text });

test('services headline resolves the latest IT month and full-year totals', () => {
  const items = [
    item(13.951, 5.049, 'Jul-Jun'),
    item(16.193, 5.049, 'Jun'),
    item(24.032, 5.049, 'May'),
    item(26.094, 5.049, 'Jun'),
    item(30.784, 5.049, 'Jul-Jun'),
    item(14.108, 5.559, 'FY24'),
    item(16.088, 5.559, 'FY25'),
    item(23.942, 5.559, 'FY26'),
    item(25.929, 5.559, 'FY26'),
    item(29.951, 5.559, 'FY25'),
    item(31.871, 5.559, 'FY26'),
    item(2.57, 8.424, '2. Exports of Services'),
    item(16.793, 8.424, '698'),
    item(24.714, 8.424, '838'),
    item(26.694, 8.424, '956'),
    item(30.386, 8.424, '8,450'),
    item(32.186, 8.424, '10,034'),
    item(3.515, 13.689, '9. Telecommunications, Computer, and Information Services'),
    item(14.543, 13.689, '3,223'),
    item(16.793, 13.689, '339'),
    item(24.714, 13.689, '373'),
    item(26.694, 13.689, '416'),
    item(30.386, 13.689, '3,814'),
    item(32.366, 13.689, '4,600'),
  ];

  assert.deepEqual(parseServicesHeadline(items), {
    latestMonth: '2026-06',
    latest: 416,
    prevMonth: '2026-05',
    prev: 373,
    yearAgoMonth: '2025-06',
    yearAgo: 339,
    fytd: 4600,
    fytdPrior: 3814,
    fytdLabel: 'Jul-Jun FY26',
    fytdPriorLabel: 'Jul-Jun FY25',
    totalServicesLatest: 956,
    fiscalYear: 2026,
  });
});

test('services headline follows the FYTD columns after the July rollover', () => {
  const items = [
    item(13.951, 5.049, 'Jul-Jun'),
    item(16.193, 5.049, 'Jul'),
    item(26.094, 5.049, 'Jul'),
    item(30.784, 5.049, 'Jul'),
    item(14.108, 5.559, 'FY25'),
    item(16.088, 5.559, 'FY26'),
    item(25.929, 5.559, 'FY27'),
    item(29.951, 5.559, 'FY26'),
    item(31.871, 5.559, 'FY27'),
    item(2.57, 8.424, '2. Exports of Services'),
    item(16.793, 8.424, '845'),
    item(26.694, 8.424, '990'),
    item(30.386, 8.424, '845'),
    item(32.186, 8.424, '990'),
    item(3.515, 13.689, '9. Telecommunications, Computer, and Information Services'),
    item(14.543, 13.689, '3,814'),
    item(16.793, 13.689, '350'),
    item(26.694, 13.689, '430'),
    item(30.386, 13.689, '350'),
    item(32.366, 13.689, '430'),
  ];

  const headline = parseServicesHeadline(items);
  assert.equal(headline.latestMonth, '2026-07');
  assert.equal(headline.latest, 430);
  assert.equal(headline.yearAgoMonth, '2025-07');
  assert.equal(headline.yearAgo, 350);
  assert.equal(headline.fytd, 430);
  assert.equal(headline.fytdPrior, 350);
  assert.equal(headline.fytdLabel, 'Jul FY27');
  assert.equal(headline.fytdPriorLabel, 'Jul FY26');
});
