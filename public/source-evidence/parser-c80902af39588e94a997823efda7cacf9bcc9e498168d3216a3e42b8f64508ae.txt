import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { officialDomain, validateOfficialUrl, getSourceEvidence, auditSourceArtifacts } from './source-evidence.mjs';
import { sourceMissingReason, publicationStatus } from './ingestion-validation.mjs';

export const PUBLICATION_POLICY = 'official-only';
export const CURATED_FILES = [
  'fbr-tax.json', 'circular-debt.json', 'external-debt.json',
  'budget-provincial.json', 'budget-federal.json', 'imf-tracker.json',
  'monetary-policy.json', 'economic-events.json', 'explainers.json', 'indicators.json',
];
const SHA256 = /^[a-f0-9]{64}$/;
const ALLOWED_TYPES = new Set(['official-primary', 'official-derived']);
const CURATED_IDS = new Set(CURATED_FILES.map(file => file.replace(/\.json$/, '')));
const METADATA = new Set([
  'title', 'unit', 'basis', 'source', 'sourceUrl', 'sourceLinks', 'dataSource',
  'lastUpdated', 'lastChecked',
  'publication', 'publicationEvidence', 'reviewRequired', 'reviewReason',
]);
const TECHNICAL_KEYS = new Set([
  'publication', 'publicationEvidence', 'sourceEvidence', 'reviewRequired', 'reviewReason',
  'lastVerified', 'verificationDate',
]);
const EVIDENCE_KEYS = new Set([
  'sourceType', 'sourceKey', 'sourceUrl', 'artifactId', 'evidenceHash',
  'contentHash', 'location', 'method', 'status', 'formula', 'inputs',
]);
const ROW_CONTEXT_KEYS = new Set([
  'date', 'observationDate', 'asOf', 'period', 'fy', 'fyLabel', 'year',
  'id', 'label', 'name', 'country', 'countryCode', 'countryName', 'unit', 'basis',
  'status', 'sourceStatus', 'sourceType', 'source', 'sourceUrl', 'provisional', 'revised',
  'missingReason', 'missingReasons', 'evidence', 'observations',
  'statuses', 'sourceStatuses', 'latestMonth', 'prevMonth', 'yearAgoMonth',
  'fytdLabel', 'fytdPriorLabel', 'fiscalYear', 'start', 'end', 'priorPeriod',
]);
const CLAIM_ARRAYS = new Set(['monthly', 'fyTotals', 'annualTargets', 'indicators', 'events']);
const FORBIDDEN_PATH_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ISSUER_STATUSES = new Set(['provisional', 'revised', 'final', 'estimate', 'budgeted', 'not-stated']);
const NATIVE_EVIDENCE_KEYS = new Set([
  'artifactId', 'sourceKey', 'retrievedAt', 'locator', 'rawValue', 'scale', 'sourceUnit', 'unit',
  'periodHeader', 'unitHeader', 'derivation', 'inputs', 'complete', 'status', 'sourceStatus',
  'comments', 'missingReason', 'missingReasons',
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function hashContent(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

/** The reviewed payload excludes policy/evidence envelopes, never its claims. */
export function publicationContentHash(data) {
  return hashContent(Object.fromEntries(Object.entries(data).filter(([key]) => !TECHNICAL_KEYS.has(key))));
}

export function publicationEvidenceHash(evidence) {
  return hashContent(evidence);
}

/**
 * Review format: { contentHash, approvals: [
 *   { reviewer: "<real identity>", approvedAt: "<ISO timestamp>", evidenceHash },
 *   { reviewer: "<different real identity>", approvedAt: "<ISO timestamp>", evidenceHash }
 * ] }. Obtain hashes with --review-hashes after attaching exact official evidence.
 * Changes invalidate approvals. This validates binding, not identity authentication;
 * reviewer identities must be checked through the repository's human review process.
 */
export function validateReview(review, { contentHash, evidenceHash, now = new Date().toISOString() }) {
  const errors = [];
  if (!review || review.contentHash !== contentHash || !SHA256.test(contentHash || '')) {
    errors.push('Review content hash is absent or stale.');
  }
  const approvals = review?.approvals;
  if (review && Object.keys(review).some(key => !['contentHash', 'approvals'].includes(key))) {
    errors.push('Unknown review metadata is not permitted.');
  }
  if (!Array.isArray(approvals) || approvals.length < 2) {
    errors.push('Two distinct real reviewer approvals are required.');
  }
  const reviewers = new Set();
  for (const approval of Array.isArray(approvals) ? approvals : []) {
    if (!approval || typeof approval !== 'object'
      || Object.keys(approval).some(key => !['reviewer', 'approvedAt', 'evidenceHash'].includes(key))) {
      errors.push('Unknown approval metadata is not permitted.');
    }
    const reviewer = typeof approval?.reviewer === 'string' ? approval.reviewer.trim().toLowerCase() : '';
    if (!reviewer || /^(?:pending|placeholder|reviewer[- ]?\d*|copilot|ai|unknown)$/.test(reviewer)) {
      errors.push('Reviewer identity must identify a real reviewer.');
    } else if (reviewers.has(reviewer)) {
      errors.push('Reviewer approvals must be distinct.');
    }
    reviewers.add(reviewer);
    if (approval?.evidenceHash !== evidenceHash || !SHA256.test(evidenceHash || '')) {
      errors.push('Approval evidence hash is absent or stale.');
    }
    const timestamp = approval?.approvedAt;
    if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp)
      || !Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) > Date.parse(now)) {
      errors.push('Approval timestamp must be a valid non-future timestamp.');
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Manual location is JSON for an exact cell or passage, not a document/topic
 * label. For example: {page: 1, paragraph: 2, quote: "<source passage>"} or
 * {selector: "#official-statement", paragraph: 2, quote: "<source passage>"}.
 * This checks the locator format; genuine reviewers must confirm the passage
 * against the archived bytes and approve the bound content/evidence hashes.
 */
export function validateManualLocator(location, { inputs, sourceKey, sourceUrl, contentType } = {}) {
  const errors = [];
  let locator;
  try {
    locator = typeof location === 'string' ? JSON.parse(location) : null;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  const positive = value => Number.isInteger(value) && value >= 1;
  const quote = typeof locator?.quote === 'string' && locator.quote.trim().length > 0;
  const coordinates = Number.isFinite(locator?.x) && locator.x >= 0 && Number.isFinite(locator?.y) && locator.y >= 0;
  const pdf = positive(locator?.page) && (coordinates || (positive(locator.paragraph) && quote));
  const cell = typeof locator?.cell === 'string' ? /^([A-Z]+)([1-9]\d*)$/.exec(locator.cell) : null;
  const column = cell?.[1].split('').reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0);
  const workbook = typeof locator?.sheet === 'string' && locator.sheet.trim()
    && positive(locator.row) && positive(locator.column) && Number(cell?.[2]) === locator.row && column === locator.column;
  const api = typeof locator?.seriesKey === 'string' && locator.seriesKey.trim()
    && typeof locator.observationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(locator.observationDate)
    && positive(locator.row) && positive(locator.column) && locator.columns?.value === locator.column
    && Object.values(locator.columns).every(positive);
  const html = typeof locator?.selector === 'string' && /^(?:#|\.|\[)/.test(locator.selector.trim())
    && positive(locator.paragraph) && quote;
  const derived = Array.isArray(inputs) && inputs.length > 0
    && Array.isArray(locator?.inputs) && hashContent(locator.inputs) === hashContent(inputs);
  const allowed = pdf ? ['page', 'x', 'y', 'paragraph', 'quote']
    : workbook ? ['sheet', 'row', 'column', 'cell']
      : api ? ['seriesKey', 'observationDate', 'row', 'column', 'columns']
        : html ? ['selector', 'paragraph', 'quote'] : derived ? ['inputs'] : [];
  if (!locator || typeof locator !== 'object' || Array.isArray(locator)
    || !allowed.length || Object.keys(locator).some(key => !allowed.includes(key))) {
    errors.push('Manual claims require an exact structured cell or passage locator; generic page/topic labels do not qualify.');
  }
  if (locator && typeof locator === 'object' && !Array.isArray(locator)) {
    if (pdf && ((Object.hasOwn(locator, 'x') || Object.hasOwn(locator, 'y')) && !coordinates
      || (Object.hasOwn(locator, 'paragraph') && !positive(locator.paragraph))
      || (Object.hasOwn(locator, 'quote') && !quote))) {
      errors.push('Every supplied manual PDF coordinate, paragraph and quotation must be valid.');
    }
    const type = typeof contentType === 'string' ? contentType.split(';')[0].toLowerCase() : '';
    if ((type === 'application/pdf' || /\.pdf(?:$|\?)/i.test(sourceUrl || '')) && !pdf) {
      errors.push('A manual PDF claim requires an exact PDF locator.');
    } else if ((type === 'text/html' || /\.(?:html?|aspx?|php)(?:$|\?)/i.test(sourceUrl || '')) && !html) {
      errors.push('A manual webpage claim requires an exact archived HTML passage locator.');
    } else if ((/spreadsheet|ms-excel/i.test(type) || /\.xlsx?(?:$|\?)/i.test(sourceUrl || '')) && !workbook) {
      errors.push('A manual workbook claim requires an exact sheet and cell locator.');
    }
    if (api && sourceKey && locator.seriesKey !== sourceKey) errors.push('A manual API locator must identify its original exact source series.');
  }
  return { ok: errors.length === 0, errors };
}

export function isOfficialDocumentUrl(value) {
  if (!officialDomain(value)) return false;
  try {
    const url = new URL(validateOfficialUrl(value));
    return !/^\/?$/.test(url.pathname)
      && !/\/(?:countries\/pak|ecodata\/index2\.asp|m_policy\/index\.asp|our-operations\/monetary-policy)\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function hasNumericClaims(value, key = '') {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return true;
  if (typeof value === 'string') {
    if (/^(?:date|asOf|period|fy|fyLabel|label|id|color|source|sourceUrl|sourceType|title|unit|basis)$/.test(key)
      && /^(?:\d{4}(?:-\d{2}){0,2}|FY\d{4}(?:-\d{2})?|#[a-f0-9]{3,8})$/i.test(value)) return false;
    if (/^(?:sourceUrl|source|sourceKey|artifactId|evidenceHash|contentHash|path|retrievedAt|parserVersion)$/.test(key)) return false;
    return /(?:\d|[£$%₨])/.test(value) || /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(value);
  }
  if (Array.isArray(value)) return value.some(item => hasNumericClaims(item, key));
  return Object.entries(value).some(([name, item]) => !TECHNICAL_KEYS.has(name) && hasNumericClaims(item, name));
}

function getPath(data, path) {
  return path ? path.split('.').reduce((value, key) => value != null && !FORBIDDEN_PATH_KEYS.has(key)
    && Object.hasOwn(value, key) ? value[key] : undefined, data) : data;
}

function isUnavailableValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object') return false;
  return Object.values(value).every(isUnavailableValue);
}

function fieldScopedRoots(data) {
  const selectors = [...Object.keys(data.publicationEvidence || {}), ...(data.publication?.withheldFields || [])];
  return new Set(Object.keys(data).filter(key => !METADATA.has(key) && !TECHNICAL_KEYS.has(key)
    && selectors.some(path => typeof path === 'string' && path.startsWith(`${key}.`)
      && path.split('.').length >= (Array.isArray(data[key]) ? 3 : 2))));
}

function isRowContext(key, value) {
  if (!ROW_CONTEXT_KEYS.has(key)) return false;
  if (['missingReasons', 'statuses'].includes(key)) {
    return value === null || (value && typeof value === 'object' && !Array.isArray(value)
      && Object.values(value).every(item => item === null || (typeof item === 'string'
        && (key === 'statuses' ? ISSUER_STATUSES.has(item) : !hasNumericClaims(item)))));
  }
  if (['evidence', 'observations', 'sourceStatuses'].includes(key)) {
    return value === null || (typeof value === 'object' && !Array.isArray(value));
  }
  if (['period', 'priorPeriod'].includes(key) && value && typeof value === 'object') {
    return !Array.isArray(value) && Object.entries(value).every(([name, item]) =>
      ['start', 'end', 'fiscalYear'].includes(name) && isRowContext(name, item));
  }
  if (['provisional', 'revised'].includes(key)) return value === null || typeof value === 'boolean';
  if (['fy', 'year', 'fiscalYear'].includes(key) && Number.isInteger(value)) return value >= 1900 && value <= 2100;
  if (['id', 'label', 'name', 'country', 'countryCode', 'countryName'].includes(key) && hasNumericClaims(value, key)) return false;
  if (['basis', 'unit', 'missingReason'].includes(key) && typeof value === 'string' && /\d/.test(value)) return false;
  if (['date', 'observationDate', 'asOf', 'latestMonth', 'prevMonth', 'yearAgoMonth', 'start', 'end'].includes(key)) {
    return value === null || (typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/.test(value));
  }
  return value === null || typeof value === 'string';
}

/** Explicit nested scopes select fields; uncovered siblings remain independent claims. */
function claims(data, roots = fieldScopedRoots(data)) {
  const paths = [];
  const records = data.publicationEvidence || {};
  const walk = (value, path) => {
    if (isUnavailableValue(value)) return;
    if (path.split('.').some(key => FORBIDDEN_PATH_KEYS.has(key))) {
      paths.push(path);
      return;
    }
    if (Object.hasOwn(records, path) || !value || typeof value !== 'object') {
      paths.push(path);
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (key === 'observations' && item && typeof item === 'object' && !Array.isArray(item)) {
        for (const [field, observation] of Object.entries(item)) {
          if (!observation || typeof observation !== 'object') {
            walk(observation, `${path}.observations.${field}`);
            continue;
          }
          for (const [name, entry] of Object.entries(observation)) {
            if (!['observationDate', 'unit', 'status', 'sourceStatus', 'comments', 'missingReason'].includes(name)
              || (name === 'comments' && hasNumericClaims(entry))
              || (['unit', 'missingReason'].includes(name) && !isRowContext(name, entry))) {
              walk(entry, `${path}.observations.${field}.${name}`);
            }
          }
        }
        continue;
      }
      if (isRowContext(key, item)) continue;
      walk(item, `${path}.${key}`);
    }
  };
  for (const [key, value] of Object.entries(data)) {
    if (METADATA.has(key) || TECHNICAL_KEYS.has(key) || key === 'sourceType') continue;
    if (isUnavailableValue(value)) continue;
    if (FORBIDDEN_PATH_KEYS.has(key)) {
      paths.push(key);
    } else if (roots.has(key) && !Object.hasOwn(records, key) && !Object.hasOwn(records, '')) {
      walk(value, key);
    } else if (CLAIM_ARRAYS.has(key) && Array.isArray(value)) {
      value.forEach((item, index) => { if (item !== null) paths.push(`${key}.${index}`); });
    } else {
      paths.push(key);
    }

  }
  return paths;
}

function fieldContext(data, path) {
  const parts = path.split('.');
  const field = parts.pop();
  const row = getPath(data, parts.join('.'));
  return { row, field, observation: row?.observations?.[field] };
}

function nativeEvidenceFor(data, path) {
  const parts = path.split('.');
  for (let index = parts.length - 1; index >= 0; index--) {
    const context = getPath(data, parts.slice(0, index).join('.'));
    const field = parts.slice(index).join('.');
    const evidence = context?.evidence;
    const direct = getPath(evidence, field);
    if (direct) return direct;
    if (field === 'value' && (evidence?.artifactId || evidence?.derivation)) return evidence;
  }
  return null;
}

function nativeLeaves(ref, errors) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push('Native evidence lineage is missing or malformed.');
    return [];
  }
  if (Object.keys(ref).some(key => !NATIVE_EVIDENCE_KEYS.has(key))) {
    errors.push('Unknown native evidence fields are not publication proof.');
  }
  if (ref.complete === false) errors.push('Incomplete native observation coverage cannot support a published derivation.');
  if (ref.derivation || ref.inputs) {
    if (typeof ref.derivation !== 'string' || !ref.derivation.trim()
      || !Array.isArray(ref.inputs) || !ref.inputs.length) {
      errors.push('Derived native evidence requires an explicit method and complete inputs.');
      return [];
    }
    return ref.inputs.flatMap(input => nativeLeaves(input, errors));
  }
  if (!ref.artifactId || !ref.sourceKey || !ref.locator || typeof ref.locator !== 'object' || Array.isArray(ref.locator)) {
    errors.push('Every native evidence leaf requires an original receipt and structured locator.');
    return [];
  }
  return [ref];
}

function validateNativeLeaf(ref, options, errors) {
  const receipt = receiptFor(ref, options);
  if (!receipt || receipt.artifactId !== ref.artifactId || receipt.sourceKey !== ref.sourceKey
    || !SHA256.test(receipt.sha256 || '') || !isOfficialDocumentUrl(receipt.sourceUrl)
    || !isOfficialDocumentUrl(receipt.responseUrl) || !receipt.parserVersion) {
    errors.push('Native evidence requires its exact original official receipt, not the latest source-key receipt.');
  }
  if (typeof ref.retrievedAt !== 'string' || !Number.isFinite(Date.parse(ref.retrievedAt))
    || ref.retrievedAt !== receipt?.retrievedAt) {
    errors.push('Native evidence retrieval time differs from its original receipt.');
  }
  const locator = ref.locator;
  const located = (typeof locator.sheet === 'string' && locator.sheet && locator.row && locator.column && locator.cell)
    || (locator.seriesKey === ref.sourceKey && typeof locator.observationDate === 'string' && locator.row && locator.column)
    || (locator.page && Number.isFinite(locator.x) && Number.isFinite(locator.y));
  if (!located) errors.push('Native evidence must identify an exact workbook cell, API observation or PDF coordinate.');
  if (locator.sheet) {
    const cell = typeof locator.cell === 'string' ? /^([A-Z]+)([1-9]\d*)$/.exec(locator.cell) : null;
    const column = cell?.[1].split('').reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0);
    if (!cell || Number(cell[2]) !== locator.row || column !== locator.column) {
      errors.push('Native workbook cell reference must match its one-based row and column.');
    }
  }
  if (locator.seriesKey && (!locator.columns || locator.columns.value !== locator.column)) {
    errors.push('Native API value column must match its explicit header mapping.');
  }
  if (locator.page && (locator.x < 0 || locator.y < 0)) errors.push('Native PDF coordinates must be nonnegative.');
  const checkLocator = locator => {
    for (const [key, value] of Object.entries(locator)) {
      if (['row', 'column', 'page'].includes(key) && (!Number.isInteger(value) || value < 1)) {
        errors.push('Native locator rows, columns and pages must be one-based integers.');
      }
      if (key === 'columns' && value && typeof value === 'object'
        && Object.values(value).some(column => column != null && (!Number.isInteger(column) || column < 1))) {
        errors.push('Native API locator column indexes must be one-based integers.');
      }
      if (value && typeof value === 'object') checkLocator(value);
    }
  };
  checkLocator(ref.locator);
  return receipt;
}

function validateFieldEvidence(record, path, dataset, options) {
  const errors = [];
  const parts = path.split('.');
  for (let index = 1; index < parts.length; index++) {
    const context = getPath(options.data, parts.slice(0, index).join('.'));
    if (context?.sourceType && !ALLOWED_TYPES.has(context.sourceType)) {
      errors.push('A forbidden inherited source class cannot be overridden by a field descriptor.');
    }
    for (const key of ['source', 'sourceUrl']) {
      if (typeof context?.[key] === 'string' && /^https?:/i.test(context[key]) && !officialDomain(context[key])) {
        errors.push('A secondary source citation cannot be overridden by a primary field descriptor.');
      }
    }
  }
  const ref = nativeEvidenceFor(options.data, path);
  const manual = CURATED_IDS.has(dataset.id) || dataset.parser === 'manual-curation' || dataset.manual === true;
  if (!manual && (record.method !== 'automated'
    || options.verifiedAutomatedClaims?.[path] !== hashContent(getPath(options.data, path)))) {
    errors.push('An automated field requires independently reparsed archived-source confirmation, not a calculated hash alone.');
  }
  if (!manual && !ISSUER_STATUSES.has(record.status)) errors.push('An automated field must explicitly retain the issuer status, including not-stated.');
  if (!ref) {
    if (!manual) errors.push('An exact automated field requires original native evidence, not only a content hash.');
    return errors;
  }
  const leaves = nativeLeaves(ref, errors);
  const receipts = leaves.map(leaf => validateNativeLeaf(leaf, options, errors));
  if (record.sourceType === 'official-primary') {
    if (ref.derivation || ref.inputs || leaves.length !== 1 || ref.artifactId !== record.artifactId
      || ref.sourceKey !== record.sourceKey) {
      errors.push('A derived or different-source field cannot masquerade as one primary observation.');
    }
    const { row, field, observation } = fieldContext(options.data, path);
    const expectedPeriod = observation?.observationDate || row?.[`${field}Month`] || row?.observationDate || row?.date || row?.asOf;
    const sourcePeriod = ref.locator?.observationDate || ref.locator?.date;
    if (expectedPeriod && sourcePeriod && expectedPeriod !== sourcePeriod) {
      errors.push('Native locator observation date does not match the containing field period.');
    }
    const sourceStatus = observation?.status || row?.statuses?.[field] || row?.status || (row?.provisional === true ? 'provisional'
      : row?.revised === true ? 'revised' : 'not-stated');
    if (record.status && record.status !== sourceStatus) errors.push(`Issuer status is not supported for ${field}.`);
    const rawStatus = observation?.sourceStatus || row?.sourceStatuses?.[field] || row?.sourceStatus || ref.sourceStatus;
    if (rawStatus && publicationStatus(rawStatus) !== 'not-stated' && publicationStatus(rawStatus) !== record.status) {
      errors.push('The normalized field status differs from its original issuer marker.');
    }
    if (record.status === 'final' && publicationStatus(rawStatus) !== 'final') {
      errors.push('Final status requires an explicit original issuer final marker, not an unflagged header.');
    }
  } else if (record.sourceType === 'official-derived') {
    if (ref.derivation !== record.formula || !Array.isArray(ref.inputs)
      || ref.inputs.length !== record.inputs?.length) {
      errors.push('Derived policy scope must retain its actual method and complete native input references.');
    }
    const supported = (Array.isArray(record.inputs) ? record.inputs : []).map(input => options.derivedInputs?.[input]);
    for (const [index, input] of supported.entries()) {
      if (!input?.evidence || !Object.hasOwn(input, 'value') || input.contentHash !== hashContent(input.value)
        || hashContent(input.evidence) !== hashContent(ref.inputs?.[index])) {
        errors.push('Derived input identity or observation coverage differs from its assessed native evidence.');
      }
      if (input?.sourceType === 'official-primary') {
        const receipt = receipts.find(item => item?.artifactId === input.evidence?.artifactId);
        if (!receipt || input.evidenceHash !== receipt.sha256 || input.evidence?.derivation) {
          errors.push('An assessed primary input must identify its own original direct receipt.');
        }
      }
    }
  }
  return errors;
}

function declaredSources(value, path = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const field = path ? `${path}.${key}` : key;
    if (key === 'publication' || key === 'publicationEvidence' || key === 'sourceEvidence') return [];
    if (key === 'sourceType') return [{ path: field, value: item }];
    return declaredSources(item, field);
  });
}

function declaredSourceUrls(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    if (['publication', 'publicationEvidence', 'sourceEvidence'].includes(key)) return [];
    if (['source', 'sourceUrl', 'url'].includes(key) && typeof item === 'string' && /^https?:/i.test(item)) return [item];
    return declaredSourceUrls(item);
  });
}

function receiptFor(record, options) {
  const evidence = options.evidence || {};
  if (Array.isArray(evidence)) return evidence.find(item => item.artifactId === record.artifactId);
  return evidence[record.artifactId] || evidence[record.sourceKey];
}

function validateEvidence(record, value, path, dataset, options) {
  const errors = [];
  if (!record || !ALLOWED_TYPES.has(record.sourceType)
    || Object.keys(record).some(key => !EVIDENCE_KEYS.has(key))) return ['Missing or forbidden source class or evidence fields.'];
  if (record.contentHash !== hashContent(value)) errors.push('Evidence is not tied to this exact content.');
  if (typeof value === 'number' && !Number.isFinite(value)) errors.push('An economic observation must be finite or explicitly unavailable.');
  if (!record.location || typeof record.location !== 'string') errors.push('Exact document location is required.');
  if (record.status && !ISSUER_STATUSES.has(record.status)) errors.push('Unknown issuer publication status.');
  if (record.sourceType === 'official-derived') {
    if (['sourceKey', 'sourceUrl', 'artifactId', 'evidenceHash'].some(key => Object.hasOwn(record, key))) {
      errors.push('A multi-input derivation must not advertise one direct primary receipt.');
    }
    if (typeof record.formula !== 'string' || !record.formula.trim() || !Array.isArray(record.inputs) || record.inputs.length === 0) {
      errors.push('Derived claims require a formula and official input references.');
    } else {
      for (const input of record.inputs) {
        const supported = options.derivedInputs?.[input];
        if (!supported || !ALLOWED_TYPES.has(supported.sourceType) || supported.status !== 'published'
          || !SHA256.test(supported.contentHash || '') || !SHA256.test(supported.evidenceHash || '')) {
          errors.push(`Derived input is not an independently supported official claim: ${input}`);
        }
        if (record.status === 'final' && supported?.issuerStatus !== 'final') {
          errors.push('A derived final status requires explicit final issuer status for every assessed input.');
        }
      }
    }
  } else {
    const receipt = receiptFor(record, options);
    if (!isOfficialDocumentUrl(record.sourceUrl)) errors.push('A direct official HTTPS publication is required, not an institutional homepage.');
    if (!receipt || receipt.sourceKey !== record.sourceKey || receipt.artifactId !== record.artifactId || receipt.sha256 !== record.evidenceHash
      || receipt.sourceUrl !== record.sourceUrl || !isOfficialDocumentUrl(receipt.responseUrl)
      || officialDomain(receipt.responseUrl) !== officialDomain(record.sourceUrl)
      || !receipt.parserVersion || !SHA256.test(receipt.sha256 || '')) {
      errors.push('An authentic matching archived source receipt is required.');
    }
  }
  for (const declaration of declaredSources(value)) {
    if (!ALLOWED_TYPES.has(declaration.value) || declaration.value !== record.sourceType) {
      errors.push(`Mixed or unsupported source classification at ${path}.${declaration.path}.`);
    }
  }
  if (declaredSourceUrls(value).some(url => !isOfficialDocumentUrl(url))) {
    errors.push('Claim contains a secondary or generic source URL; it cannot be relabelled as primary.');
  }
  if (options.fieldRoots.has(path.split('.')[0]) && path.includes('.')
    && (typeof value !== 'object' || value === null)) {
    errors.push(...validateFieldEvidence(record, path, dataset, options));
  }
  if (record.sourceType === 'official-primary' && value && typeof value === 'object') {
    const inspect = node => {
      if (!node || typeof node !== 'object') return;
      if (node.evidence) {
        const check = ref => {
          if (!ref || typeof ref !== 'object') return;
          if (ref.derivation || ref.inputs || (ref.artifactId && ref.artifactId !== record.artifactId)) {
            errors.push('Mixed native receipts or derived fields require separate exact scopes, not a primary blanket.');
          }
          for (const child of Object.values(ref)) if (child && typeof child === 'object') check(child);
        };
        check(node.evidence);
      }
      for (const [key, child] of Object.entries(node)) if (key !== 'evidence') inspect(child);
    };
    inspect(value);
  }
  if (record.sourceType === 'official-primary' && isOfficialDocumentUrl(record.sourceUrl)
    && declaredSourceUrls(value).some(url => isOfficialDocumentUrl(url)
      && validateOfficialUrl(url) !== validateOfficialUrl(record.sourceUrl))) {
    errors.push('Mixed primary documents require separate figure-level evidence, not one receipt for the whole scope.');
  }
  const manual = CURATED_IDS.has(dataset.id) || dataset.parser === 'manual-curation' || dataset.manual === true;
  const automatedException = (dataset.id === 'fbr-tax' && /^(?:monthly|fyTotals)\.\d+$/.test(path)
    && record.method === 'automated'
    && receiptFor(record, options)?.parserVersion?.startsWith('update-fbr.mjs:sha256:'))
    || (dataset.id === 'external-debt' && ['stock', 'observationDate'].includes(path)
      && record.sourceKey === 'pakdebt.pdf'
      && receiptFor(record, options)?.parserVersion?.startsWith('enforce-publication-policy.mjs:sha256:'));
  const independentlyParsed = options.verifiedAutomatedClaims?.[path] === hashContent(value);
  if (automatedException && !independentlyParsed) {
    errors.push('Automated content does not match an independently reparsed archived official source.');
  }
  if (manual && !(automatedException && independentlyParsed)) {
    const receipt = record.sourceType === 'official-primary' ? receiptFor(record, options) : null;
    errors.push(...validateManualLocator(record.location, {
      inputs: record.sourceType === 'official-derived' ? record.inputs : undefined,
      sourceKey: receipt?.sourceKey, sourceUrl: receipt?.sourceUrl, contentType: receipt?.contentType,
    }).errors);
    if (record.sourceType === 'official-derived') {
      const native = nativeEvidenceFor(options.data, path) || value?.evidence;
      if (!native || native.derivation !== record.formula || !Array.isArray(native.inputs)
        || native.inputs.length !== record.inputs?.length) {
        errors.push('Manual derivations require original input lineage in the reviewed payload, not hash-only input labels.');
      } else {
        const leaves = nativeLeaves(native, errors);
        for (const leaf of leaves) validateNativeLeaf(leaf, options, errors);
        for (const [index, input] of record.inputs.entries()) {
          const supported = options.derivedInputs?.[input];
          if (!supported?.evidence || hashContent(supported.evidence) !== hashContent(native.inputs[index])) {
            errors.push('Manual derived input evidence must match the original reviewed input reference.');
          }
        }
      }
    }
    const review = validateReview(options.review || options.data?.publication?.review, {
      contentHash: publicationContentHash(options.data),
      evidenceHash: publicationEvidenceHash(options.data.publicationEvidence || {}),
      now: options.now,
    });
    errors.push(...review.errors);
  }
  return errors;
}

/**
 * Read-only audit: no I/O, mutations, source inference, or silent skips.
 * Exact automated fields require original native proof and a confirmation map
 * from independent archived-source replay (including period/status checks).
 * Exact derivedInputs additionally bind {value, evidence} to contentHash and the
 * original input reference; issuerStatus is required before declaring final.
 * Manual scopes, including text/estimates/methodology without digits, require
 * exact structured locators and genuine content/evidence-bound human reviews.
 * Neither confirmation nor published input status may be inferred from a hash.
 */
export function assessPublication(dataset, data, options = {}) {
  const violations = [];
  const fieldRoots = fieldScopedRoots(data);
  const paths = claims(data, fieldRoots);
  const records = data.publicationEvidence || {};
  const existing = data.publication;
  for (const [path, record] of Object.entries(records)) {
    if (!record || typeof record !== 'object' || Array.isArray(record)
      || !ALLOWED_TYPES.has(record.sourceType)
      || Object.keys(record).some(key => !EVIDENCE_KEYS.has(key))
      || (path !== '' && !paths.includes(path))) {
      violations.push({ path: `publicationEvidence.${path}`, reasons: ['Unknown, unused or forbidden scoped publication evidence.'] });
    }
  }
  for (const key of ['title', 'basis', 'dataSource', 'source']) {
    if (typeof data[key] === 'string' && hasNumericClaims(data[key], key)) {
      violations.push({ path: key, reasons: ['Economic numeric claims cannot be hidden in metadata.'] });
    }
  }
  for (const key of ['lastVerified', 'verificationDate']) {
    if (data[key] != null) {
      violations.push({ path: key, reasons: ['Legacy verification timestamps cannot establish content-hash-bound validation.'] });
    }
  }
  if (Object.hasOwn(data, 'sourceType') && !ALLOWED_TYPES.has(data.sourceType)) {
    violations.push({ path: 'sourceType', reasons: ['Unknown or forbidden dataset source class.'] });
  }
  for (const path of paths) {
    const record = records[path] || records[''];
    const value = records[path] ? getPath(data, path)
      : records[''] ? Object.fromEntries(paths.map(key => [key, getPath(data, key)])) : getPath(data, path);
    const reasons = value === undefined ? ['Claim paths must target an existing, safe own property.']
      : validateEvidence(record, value, path, dataset, { ...options, data, fieldRoots });
    if (Object.keys(records).some(other => other !== path && (other === '' || other.startsWith(`${path}.`)))) {
      reasons.push('Overlapping publication scopes cannot hide a conflicting child descriptor.');
    }
    if ((existing?.withheldFields || []).some(field => typeof field === 'string'
      && (field === path || path.startsWith(`${field}.`) || field.startsWith(`${path}.`)))) {
      reasons.push('An explicitly withheld scope still contains a claim.');
    }
    if (reasons.length) violations.push({ path, reasons });
  }
  if (existing?.status === 'withheld' && paths.length) {
    violations.push({ path: '', reasons: ['A wholly withheld payload must not contain claim sections.'] });
  }
  if (existing && (existing.policy !== PUBLICATION_POLICY || !['published', 'partial', 'withheld'].includes(existing.status)
    || Object.keys(existing).some(key => !['policy', 'status', 'reason', 'withheldFields', 'review'].includes(key))
    || !Array.isArray(existing.withheldFields) || existing.withheldFields.some(path => typeof path !== 'string')
    || !('reason' in existing) || (existing.status !== 'published' && typeof existing.reason !== 'string')
    || (existing.status !== 'published' && !existing.reason)
    || (existing.status === 'published' && (existing.reason !== null || existing.withheldFields.length)))) {
    violations.push({ path: 'publication', reasons: ['Invalid publication metadata contract.'] });
  }
  const rejected = violations.filter(item => paths.includes(item.path)).map(item => item.path);
  const withheldFields = [...new Set([...(existing?.withheldFields || []), ...rejected])];
  const status = paths.length === 0 ? 'withheld'
    : rejected.length === paths.length || violations.some(item => item.path === 'sourceType' || METADATA.has(item.path)) ? 'withheld'
      : withheldFields.length ? 'partial' : 'published';
  if (existing && existing.status !== status) {
    violations.push({ path: 'publication', reasons: ['Declared publication status does not match supported content.'] });
  }
  return {
    ok: violations.length === 0,
    publication: {
      policy: PUBLICATION_POLICY,
      status,
      reason: status === 'published' ? null : existing?.reason
        || 'Publication withheld until exact official evidence and required independent review approvals are available.',
      withheldFields,
      ...(existing?.review ? { review: {
        contentHash: existing.review.contentHash,
        approvals: Array.isArray(existing.review.approvals) ? existing.review.approvals.map(approval => ({
          reviewer: approval?.reviewer, approvedAt: approval?.approvedAt, evidenceHash: approval?.evidenceHash,
        })) : [],
      } } : {}),
    },
    violations,
  };
}

function unavailable(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [];
  if (typeof value !== 'object') return null;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null) result[key] = null;
    else if (typeof item === 'number' || ['net', 'value', 'target', 'actual', 'budgetTarget', 'revisedTarget'].includes(key)) result[key] = null;
  }
  return result;
}

/** Fail closed by removing rejected claims while retaining independently supported scopes. */
export function applyPublicationPolicy(dataset, data, options = {}) {
  const audit = assessPublication(dataset, data, options);
  const output = structuredClone(data);
  if (audit.publication.status === 'withheld') {
    const metadata = Object.fromEntries(Object.entries(output).filter(([key]) => METADATA.has(key)
      && !['publicationEvidence', 'publication', 'dataSource', 'source', 'reviewReason'].includes(key)
      && !audit.violations.some(violation => violation.path === key)));
    metadata.publication = audit.publication;
    metadata.reviewRequired = true;
    metadata.reviewReason = audit.publication.reason;
    return metadata;
  }
  const retainedPaths = claims(data).filter(path => !audit.violations.some(item => item.path === path));
  const removedRows = new Map();
  for (const violation of audit.violations) {
    if (!violation.path || violation.path === 'publication') continue;
    if (['lastVerified', 'verificationDate'].includes(violation.path)) {
      delete output[violation.path];
      continue;
    }
    if (violation.path.startsWith('publicationEvidence.')) {
      delete output.publicationEvidence?.[violation.path.slice('publicationEvidence.'.length)];
      continue;
    }
    const parts = violation.path.split('.');
    const key = parts.pop();
    const parent = getPath(output, parts.join('.'));
    if (parent && Object.hasOwn(parent, key)) {
      if (Array.isArray(parent)) {
        const identity = parent[key]?.date || parent[key]?.fy || parent[key]?.id || `removed-${key}`;
        // Stable identities avoid pointing a withheld index at a retained row after compaction.
        const stablePath = [...parts, identity].join('.');
        removedRows.set(violation.path, stablePath);
        parent[key] = null;
      } else Object.defineProperty(parent, key, { value: unavailable(parent[key]), writable: true, enumerable: true, configurable: true });
    }
    delete output.publicationEvidence?.[violation.path];
  }
  const pruneSidecars = (node, path) => {
    if (!node || typeof node !== 'object') return;
    const hasSupport = field => retainedPaths.some(scope => scope === `${path}.${field}`
      || scope.startsWith(`${path}.${field}.`) || path === scope || path.startsWith(`${scope}.`));
    const rejected = field => audit.violations.some(item => item.path === `${path}.${field}`
      || `${path}.${field}`.startsWith(`${item.path}.`));
    const missingProof = field => {
      const ref = node.evidence?.[field];
      if (getPath(node, field) !== null || rejected(field) || !ref || !Object.hasOwn(ref, 'rawValue')
        || !sourceMissingReason(ref.rawValue)) return false;
      const errors = [];
      const leaves = nativeLeaves(ref, errors);
      for (const leaf of leaves) validateNativeLeaf(leaf, options, errors);
      return leaves.length === 1 && !errors.length;
    };
    if (node.evidence) {
      if (node.evidence.artifactId || node.evidence.derivation) {
        if (!hasSupport('value')) delete node.evidence;
      } else {
        for (const field of Object.keys(node.evidence)) if (!hasSupport(field) && !missingProof(field)) delete node.evidence[field];
        if (!Object.keys(node.evidence).length) delete node.evidence;
      }
    }
    for (const key of ['observations', 'missingReasons']) {
      if (!node[key] || typeof node[key] !== 'object') continue;
      for (const field of Object.keys(node[key])) {
        if (rejected(field)) node[key][field] = key === 'observations'
          ? { missingReason: 'publication-withheld' } : 'publication-withheld';
        else if (!hasSupport(field) && key === 'observations') {
          node[key][field] = Object.fromEntries(Object.entries(node[key][field] || {}).filter(([name, value]) =>
            ['observationDate', 'unit', 'status', 'sourceStatus', 'missingReason'].includes(name)
            || (name === 'comments' && !hasNumericClaims(value))));
        }
      }
    }
    for (const key of ['statuses', 'sourceStatuses']) {
      for (const field of Object.keys(node[key] || {})) if (rejected(field)) delete node[key][field];
    }
    for (const field of Object.keys(node.observations || {})) {
      const observation = node.observations[field];
      if (!observation || typeof observation !== 'object') continue;
      for (const name of Object.keys(observation)) {
        if (!['observationDate', 'unit', 'status', 'sourceStatus', 'comments', 'missingReason'].includes(name)
          || (name === 'comments' && hasNumericClaims(observation[name]))) delete observation[name];
      }
    }
    for (const [key, child] of Object.entries(node)) {
      if (!['evidence', 'observations', 'missingReasons', 'statuses', 'sourceStatuses'].includes(key)) pruneSidecars(child, `${path}.${key}`);
    }
  };
  for (const root of fieldScopedRoots(data)) pruneSidecars(output[root], root);
  const rowMaps = new Map();
  for (const key of CLAIM_ARRAYS) {
    if (!Array.isArray(output[key])) continue;
    const original = output[key];
    if (original.some(item => item !== null && (typeof item !== 'object' || Array.isArray(item)))) continue;
    const evidence = output.publicationEvidence || {};
    const kept = [];
    const indexes = new Map();
    original.forEach((item, index) => {
      if (item === null) return;
      indexes.set(index, kept.length);
      kept.push(item);
    });
    const remapped = {};
    for (const [path, record] of Object.entries(evidence)) {
      const [root, index, ...tail] = path.split('.');
      if (root !== key || !/^\d+$/.test(index || '')) continue;
      delete evidence[path];
      if (indexes.has(Number(index))) remapped[[key, indexes.get(Number(index)), ...tail].join('.')] = record;
    }
    Object.assign(evidence, remapped);
    rowMaps.set(key, indexes);
    output[key] = kept;
  }
  audit.publication.withheldFields = audit.publication.withheldFields.map(path => {
    for (const [removed, stable] of removedRows) {
      if (path === removed || path.startsWith(`${removed}.`)) return stable + path.slice(removed.length);
    }
    const [root, index, ...tail] = path.split('.');
    if (rowMaps.get(root)?.has(Number(index)) && /^\d+$/.test(index || '')) {
      return [root, rowMaps.get(root).get(Number(index)), ...tail].join('.');
    }
    return path;
  });
  output.publication = audit.publication;
  const sourceEvidence = {};
  for (const [path, record] of Object.entries(output.publicationEvidence || {})) {
    const refs = record.sourceType === 'official-primary' ? [record]
      : nativeLeaves(nativeEvidenceFor(output, path), []);
    for (const ref of refs) {
      const receipt = receiptFor(ref, options);
      if (!receipt || receipt.artifactId !== ref.artifactId) continue;
      const key = sourceEvidence[receipt.sourceKey]?.artifactId
        && sourceEvidence[receipt.sourceKey].artifactId !== receipt.artifactId ? receipt.artifactId : receipt.sourceKey;
      sourceEvidence[key] = structuredClone(receipt);
    }
  }
  if (Object.keys(sourceEvidence).length) output.sourceEvidence = sourceEvidence;
  else delete output.sourceEvidence;
  output.reviewRequired = audit.publication.status !== 'published';
  if (output.reviewRequired) output.reviewReason = audit.publication.reason;
  return output;
}

/** Reparse archived official PDFs before granting narrow manual-review exceptions. */
export async function verifyAutomatedPublicationClaims(dataset, data, { evidence, dataDir } = {}) {
  const verified = {};
  const publicDir = resolve(dataDir || resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data'), '..');
  if (dataset.id === 'fbr-tax') {
    const { parsePdfLines, extractMonthly, FBR_MONTHWISE_SOURCES } = await import('../update-fbr.mjs');
    for (const source of FBR_MONTHWISE_SOURCES) {
      const candidates = [...new Map(Object.values(evidence || {}).filter(receipt => receipt?.sourceKey === source.sourceKey
        && receipt.sourceUrl === source.url).map(receipt => [receipt.artifactId, receipt])).values()];
      for (const receipt of candidates) {
        const parsed = extractMonthly(await parsePdfLines(resolve(publicDir, 'source-evidence', basename(receipt.path))), source);
        for (const [index, row] of (data.monthly || []).entries()) {
          const official = parsed.monthly.find(item => item.date === row?.date);
          if (data.publicationEvidence?.[`monthly.${index}`]?.artifactId === receipt.artifactId
            && official && hashContent(row) === hashContent(official)) verified[`monthly.${index}`] = hashContent(row);
        }
        for (const [index, row] of (data.fyTotals || []).entries()) {
          const official = {
            fy: source.fyLabel, net: parsed.fyTotal, provisional: source.provisional,
            sourceType: 'official-primary', source: source.url,
          };
          if (data.publicationEvidence?.[`fyTotals.${index}`]?.artifactId === receipt.artifactId
            && hashContent(row) === hashContent(official)) verified[`fyTotals.${index}`] = hashContent(row);
        }
      }
    }
  } else if (dataset.id === 'external-debt') {
    const record = data.publicationEvidence?.stock;
    const receipt = record ? receiptFor(record, { evidence }) : null;
    if (!receipt) return verified;
    const { parsePdfTextItems } = await import('../pdf-text.mjs');
    const { extractExternalStock } = await import('../enforce-publication-policy.mjs');
    const stock = extractExternalStock(await parsePdfTextItems(resolve(publicDir, 'source-evidence', basename(receipt.path))));
    if (hashContent(stock) === hashContent(data.stock)) verified.stock = hashContent(stock);
    if (data.observationDate === stock.asOf
      && data.publicationEvidence?.observationDate?.artifactId === receipt.artifactId) {
      verified.observationDate = hashContent(stock.asOf);
    }
  }
  return verified;
}

/** Resolve immutable receipts, including an older authentic artifact for the same source key. */
export async function loadPublicationEvidence(data, { dataDir, evidence } = {}) {
  const receipts = { ...evidence };
  for (const receipt of Object.values(evidence || {})) {
    if (receipt?.artifactId) receipts[receipt.artifactId] = receipt;
  }
  const rootDir = dataDir ? resolve(dataDir, '..', '..') : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  let catalog;
  const native = [];
  const gather = node => {
    if (!node || typeof node !== 'object') return;
    if (node.artifactId && node.sourceKey) native.push(node);
    for (const item of Object.values(node)) if (item && typeof item === 'object') gather(item);
  };
  gather(data.evidence);
  for (const path of claims(data)) gather(nativeEvidenceFor(data, path));
  for (const record of [...Object.values(data.publicationEvidence || {}), ...native]) {
    if (!record?.sourceKey || record.sourceType === 'official-derived') continue;
    const provided = receiptFor(record, { evidence: receipts });
    if (provided?.artifactId === record.artifactId) continue;
    const latest = await getSourceEvidence(record.sourceKey, { rootDir });
    let receipt = latest;
    if (latest?.artifactId !== record.artifactId) {
      catalog ||= await auditSourceArtifacts({ rootDir });
      receipt = catalog.artifacts.find(item => item.artifactId === record.artifactId);
    }
    receipts[record.sourceKey] = receipt || null;
    if (receipt) receipts[receipt.artifactId] = receipt;
  }
  return receipts;
}

function remapVerifiedClaims(before, after, verified) {
  const result = {};
  const identity = path => {
    const parts = path.split('.');
    if (CLAIM_ARRAYS.has(parts[0]) && /^\d+$/.test(parts[1] || '')) parts[1] = '<row>';
    return parts.join('.');
  };
  for (const [path, record] of Object.entries(after.publicationEvidence || {})) {
    const original = Object.entries(before.publicationEvidence || {}).find(([oldPath, oldRecord]) =>
      oldRecord && verified[oldPath] === oldRecord.contentHash && identity(path) === identity(oldPath)
      && hashContent(record) === hashContent(oldRecord)
      && hashContent(nativeEvidenceFor(before, oldPath)) === hashContent(nativeEvidenceFor(after, path)));
    if (original) result[path] = record.contentHash;
  }
  return result;
}

/**
 * Exact automated fields require native references and verifiedAutomatedClaims
 * from independently reparsing archived bytes, never hashing cached values.
 * Async verification maps may be keyed by dataset ID; array compaction retains
 * confirmation only for the same field, descriptor and original native proof.
 */
export async function enforcePublicationPolicy({
  dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data'),
  datasets, evidence, derivedInputs, verifiedAutomatedClaims = {}, write = true,
} = {}) {
  if (!Array.isArray(datasets)) throw new Error('Publication enforcement requires explicit dataset descriptors.');
  const reports = [];
  for (const dataset of datasets) {
    const file = resolve(dataDir, dataset.file);
    const data = JSON.parse(await readFile(file, 'utf8'));
    const receipts = await loadPublicationEvidence(data, { evidence, dataDir });
    const supplied = verifiedAutomatedClaims[dataset.id] || verifiedAutomatedClaims;
    const verified = { ...supplied, ...await verifyAutomatedPublicationClaims(dataset, data, { evidence: receipts, dataDir }) };
    const options = { evidence: receipts, derivedInputs, verifiedAutomatedClaims: verified };
    const before = assessPublication(dataset, data, options);
    const output = applyPublicationPolicy(dataset, data, options);
    const afterVerified = { ...remapVerifiedClaims(data, output, verified),
      ...await verifyAutomatedPublicationClaims(dataset, output, { evidence: receipts, dataDir }) };
    const after = assessPublication(dataset, output, { ...options, verifiedAutomatedClaims: afterVerified });
    if (!after.ok) throw new Error(`Publication enforcement failed for ${dataset.id}: ${JSON.stringify(after.violations)}`);
    if (write && JSON.stringify(data) !== JSON.stringify(output)) {
      await writeFile(file, `${JSON.stringify(output, null, 2)}\n`);
    }
    reports.push({ id: dataset.id, publication: output.publication, violations: before.violations });
  }
  return reports;
}
