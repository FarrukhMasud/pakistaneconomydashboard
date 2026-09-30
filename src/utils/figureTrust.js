export const OFFICIAL_UNAVAILABLE = 'Official figure not yet published / verified';

export const TRUST_LABELS = {
  authenticity: {
    'official-primary': 'Official primary',
    'official-derived': 'Derived from official inputs',
    unavailable: 'Unavailable',
    unverified: 'Not verified',
  },
  freshness: {
    'latest-available': 'Latest available release',
    overdue: 'Release overdue',
    'fetch-failed': 'Source fetch failed',
    'needs-review': 'Needs review',
    missing: 'Missing',
    withheld: 'Withheld',
  },
  validation: { passed: 'Checks passed', pending: 'Checks pending', failed: 'Checks failed' },
  status: {
    final: 'Final (source stated)',
    provisional: 'Provisional',
    revised: 'Revised',
    estimate: 'Estimate',
    derived: 'Dashboard calculation',
    unknown: 'Source status not stated',
  },
};

export function safeSourceUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value, value.startsWith('/source-evidence/') ? 'https://evidence.invalid' : undefined);
    if ([...url.searchParams.keys()].some((key) => /^(?:api[_-]?key|token|access_token|password|secret|authorization)$/i.test(key))) return null;
    if (/^\/source-evidence\/[^\s]*$/.test(value) && !value.includes('\\')) {
      const path = url.pathname;
      if (path.startsWith('/source-evidence/') && !decodeURIComponent(path).split('/').includes('..')) return value;
      return null;
    }
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function publicationOf(data) {
  return data?.publication || data?.metadata?.publication || null;
}

export function resolveSourceTier(data, fallback) {
  if (publicationOf(data)?.status === 'withheld' || data?.publicationStatus === 'withheld') return 'unavailable';
  const tier = data?.authenticity || data?.sourceType || fallback;
  if (tier === 'official') return 'official-primary';
  if (['official-primary', 'official-derived', 'unavailable'].includes(tier)) return tier;
  return 'unverified';
}

export function freshnessStatus(data) {
  if (publicationOf(data)?.status === 'withheld') return 'withheld';
  return TRUST_LABELS.freshness[data?.freshnessStatus] ? data.freshnessStatus
    : data?.status === 'fresh' ? 'latest-available' : data?.status === 'missing' ? 'missing' : 'needs-review';
}

export function validationStatus(data) {
  const validation = data?.validation;
  const checks = Array.isArray(validation?.checks) ? validation.checks : [];
  if (validation?.status === 'failed' || checks.some((check) =>
    check?.status === 'failed' || check?.passed === false || check?.ok === false)) return 'failed';
  // A headline generation date or a "fresh" flag is not calculation evidence.
  if (validation?.status === 'passed' && validation.checkedAt && checks.length
    && checks.every((check) => check?.status === 'passed' || check?.passed === true || check?.ok === true)) {
    return 'passed';
  }
  return 'pending';
}

export function sourceFigureStatus(row) {
  const status = row?.figureStatus || row?.revisionStatus || row?.status;
  if (TRUST_LABELS.status[status]) return status;
  if (row?.provisional === true) return 'provisional';
  if (row?.revised === true) return 'revised';
  if (row?.estimate === true) return 'estimate';
  if (row?.derivedFrom || row?.derivation) return 'derived';
  if (status == null && row?.observations) {
    const statuses = [...new Set(Object.values(row.observations).map((item) => sourceFigureStatus(item)))];
    if (statuses.length === 1) return statuses[0];
  }
  return 'unknown';
}

export function classifyObservationChange(before, after) {
  const prior = before?.observationDate || before?.period || before?.date;
  const current = after?.observationDate || after?.period || after?.date;
  const beforePeriod = observationKey(prior);
  const afterPeriod = observationKey(current);
  if (!prior && afterPeriod) return 'new-observation';
  if (!beforePeriod || !afterPeriod || beforePeriod.kind !== afterPeriod.kind) return 'needs-review';
  if (afterPeriod.value > beforePeriod.value) return 'new-observation';
  if (afterPeriod.value < beforePeriod.value) return 'needs-review';
  if (sourceFigureStatus(after) === 'revised' || before?.value !== after?.value) return 'revision';
  return 'source-check';
}

function observationKey(value) {
  if (typeof value !== 'string') return null;
  if (/^FY\s*\d{2}$/i.test(value)) return { kind: 'fiscal', value: 2000 + Number(value.slice(-2)) };
  const fiscal = /^FY\s*(\d{4})(?:[-/](\d{2}|\d{4}))?$/i.exec(value);
  if (fiscal) return { kind: 'fiscal', value: fiscal[2] ? Number(fiscal[2].length === 2 ? fiscal[1].slice(0, 2) + fiscal[2] : fiscal[2]) : Number(fiscal[1]) };
  if (/^\d{4}$/.test(value)) return { kind: 'year', value: Number(value) };
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return null;
  const date = new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !date.toISOString().startsWith(value)) return null;
  return { kind: value.length === 7 ? 'month' : 'day', value: date.getTime() };
}

function isEvidenceLeaf(evidence) {
  return evidence && typeof evidence === 'object' && (evidence.artifactId || evidence.path || evidence.artifactPath || evidence.locator || evidence.sourceUrl || evidence.responseUrl);
}

function evidenceForField(evidence, field) {
  if (Array.isArray(evidence)) return evidence.map((item) => evidenceForField(item, field)).filter(Boolean);
  if (isEvidenceLeaf(evidence)) return evidence;
  if (Array.isArray(evidence?.inputs)) return { ...evidence, inputs: evidenceForField(evidence.inputs, field) };
  return evidence?.[field];
}

function resolveRecordedEvidence(evidence, context) {
  if (Array.isArray(evidence)) return evidence.map((item) => resolveRecordedEvidence(item, context));
  if (!evidence || typeof evidence !== 'object') return evidence;
  if (Array.isArray(evidence.inputs)) return { ...evidence, inputs: resolveRecordedEvidence(evidence.inputs, context) };
  if (!isEvidenceLeaf(evidence)) return Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, resolveRecordedEvidence(value, context)]));
  const artifactId = evidence.artifactId;
  let artifact;
  if (artifactId) {
    for (const collection of [context?.artifacts, context?.sourceEvidence]) {
      const indexed = collection?.[artifactId];
      if (indexed && (!indexed.artifactId || indexed.artifactId === artifactId)) {
        artifact = indexed;
        break;
      }
      const items = Array.isArray(collection) ? collection
        : collection?.artifactId ? [collection] : Object.values(collection || {});
      artifact = items.find((item) => item?.artifactId === artifactId || item?.id === artifactId);
      if (artifact) break;
    }
  }
  const resolved = { ...artifact, ...evidence };
  resolved.locator = evidence.locator || evidence.location || artifact?.locator || artifact?.location;
  return resolved;
}

export function evidenceOf(row, provenance) {
  let evidence = row?.evidence;
  if (evidence && !isEvidenceLeaf(evidence)) return evidenceListOf(row, provenance)[0];
  const artifactId = evidence?.artifactId || row?.artifactId;
  const resolved = resolveRecordedEvidence({ artifactId, ...evidence }, provenance);
  return {
    artifactId,
    artifactUrl: safeSourceUrl(resolved.path || resolved.artifactPath),
    sourceUrl: safeSourceUrl(resolved.sourceUrl || row?.sourceUrl),
    responseUrl: safeSourceUrl(resolved.responseUrl),
    retrievedAt: resolved.retrievedAt || null,
    parserVersion: resolved.parserVersion,
    locator: resolved.locator || row?.locator || row?.location || provenance?.locators?.[row?.provenanceKey],
  };
}

export function evidenceListOf(row, provenance) {
  const inputs = [];
  const visit = (evidence, field) => {
    if (Array.isArray(evidence)) return evidence.forEach((item) => visit(item, field));
    if (Array.isArray(evidence?.inputs)) return visit(evidence.inputs, field);
    if (isEvidenceLeaf(evidence)) return inputs.push({ evidence, field });
    if (evidence && typeof evidence === 'object') Object.entries(evidence).forEach(([key, value]) => {
      if (value && typeof value === 'object') visit(value, field || key);
    });
  };
  visit(row?.evidence);
  return (inputs.length ? inputs : [{ evidence: undefined }]).map(({ evidence, field }) => ({
    ...evidenceOf({ ...row, evidence }, provenance),
    ...(field ? { field, ...row?.observations?.[field] } : {}),
  }));
}

export function locatorLabel(locator) {
  if (!locator) return null;
  if (typeof locator === 'string') return locator;
  return Object.entries(locator).filter(([, value]) => value != null)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ');
}

export function withheldPaths(data) {
  const fields = publicationOf(data)?.withheldFields || [];
  return fields.map((field) => typeof field === 'string' ? field : field?.path || field?.field || field?.id)
    .filter(Boolean).map((path) => String(path).replace(/^\//, '').replaceAll('/', '.').replace(/\[(\d+|\*)\]/g, '.$1'));
}

export function fieldIsWithheld(data, path) {
  if (publicationOf(data)?.status === 'withheld') return true;
  const parts = String(path).replace(/^\//, '').replaceAll('/', '.').replace(/\[(\d+|\*)\]/g, '.$1').split('.');
  return withheldPaths(data).some((field) => {
    const restricted = field.split('.');
    return restricted.every((part, index) => part === '*' || part === parts[index]);
  });
}

const PROVENANCE_ALIASES = { fbr: 'fbr-tax', exchange: 'exchange-rates', exchangeRates: 'exchange-rates', monetaryPolicy: 'monetary-policy', imf: 'imf-tracker' };
const PROVENANCE_FIELDS = {
  'exchange-rates.monthly.usd': 'monthly.USD',
  'fiscal.gdpGrowth.latest': 'annual',
  'inflation.nationalCpi.latest': 'national_cpi',
  'fdi.fytd.current': 'fytdComparison',
  'services.bop.cumulative': 'bopSummary.cumulative',
  'services.bop.latestMonth': 'bopSummary.latestMonth',
  'services.itTelecom.credit': 'summary.itTelecomCredit',
  'services.itTelecom.headline': 'itHeadline.latest',
};

export function provenanceTarget(key) {
  const [prefix, ...parts] = String(key || '').split('.');
  return { datasetId: PROVENANCE_ALIASES[prefix] || prefix, field: PROVENANCE_FIELDS[key] || parts.join('.') };
}

export function provenanceFigureAllowed(key, figure, dataset) {
  if (!dataset || !Number.isFinite(figure?.value) || unavailableInfo(dataset) || unavailableInfo(figure)
    || resolveSourceTier(dataset) === 'unverified') return false;
  const { field } = provenanceTarget(key);
  const parts = field.split('.');
  if (fieldIsWithheld(dataset, field) || withheldPaths(dataset).some((path) => path.startsWith(`${parts[0]}.`))) return false;
  const read = (node, remaining) => {
    if (!remaining.length) return [node];
    if (Array.isArray(node)) return node.flatMap((item) => read(item, remaining));
    return node && typeof node === 'object' ? read(node[remaining[0]], remaining.slice(1)) : [];
  };
  return hasPublishedFigures(read(dataset, parts));
}

export function canonicalProvenanceFigure(key, figure, dataset, provenance) {
  const { field } = provenanceTarget(key);
  const recorded = resolveFigureMetadata(dataset, null, { field: field.split('.')[0], period: figure?.period });
  const result = { ...figure, ...(recorded.evidence ? { evidence: recorded.evidence } : {}),
    status: recorded.status != null || sourceFigureStatus(recorded) !== 'unknown' ? sourceFigureStatus(recorded)
      : figure?.evidence || figure?.artifactId ? sourceFigureStatus(figure) : 'unknown',
  };
  const retrievedAt = evidenceOf(result, provenance).retrievedAt;
  delete result.retrievedAt;
  if (retrievedAt) result.retrievedAt = retrievedAt;
  return result;
}

export function unavailableInfo(data) {
  if (!data) return null;
  const publication = publicationOf(data);
  const tier = resolveSourceTier(data);
  const unsupported = ['unverified', 'unavailable'].includes(data.authenticity)
    || ['secondary-attributed', 'unverified', 'unavailable'].includes(data.sourceType);
  if (publication?.status !== 'withheld' && data.publicationStatus !== 'withheld' && !unsupported) return null;
  return {
    label: OFFICIAL_UNAVAILABLE,
    reason: publication?.reason || data.reason || (tier === 'unverified' ? 'Verifiable official evidence is not available.' : OFFICIAL_UNAVAILABLE),
    sourceUrl: safeSourceUrl(data.sourceUrl || data.source),
    publication: publication || { policy: 'official-only', status: 'withheld' },
  };
}

const META_KEYS = new Set(['publication', 'publicationEvidence', 'metadata', 'evidence', 'sourceEvidence', 'figureEvidence', 'provenance',
  'validation', 'series', 'sources', 'artifacts', 'locators', 'observations', 'statuses', 'sourceStatuses', 'missingReasons', 'reconciliation', 'derivedInputs']);
const isMetadataKey = (key) => META_KEYS.has(key) || key.endsWith('Evidence');
const ARRAY_FIELDS = new Set([
  'data', 'monthly', 'weekly', 'annual', 'indicators', 'topExportCountries', 'topImportCountries',
  'sourceCountries', 'by_country', 'by_sector', 'decisions', 'reviews', 'relatedFacilities',
  'repaymentSplit', 'trajectory', 'stockTrend', 'targets', 'reforms', 'drivers', 'years', 'provinces',
  'fiscalYears', 'categories', 'itBreakdown', 'monthlySeries', 'recentMonths', 'components', 'annualTargets',
  'fyTotals', 'highlights', 'metrics', 'taxMeasures', 'values', 'countries', 'events', 'eurobonds',
]);

/** Remove restricted values, retaining source metadata and null gaps, never synthetic zeroes. */
export function publishedData(data) {
  if (unavailableInfo(data)) return null;
  if (!data || typeof data !== 'object') return data;
  const visit = (node, paths = ['']) => {
    if (paths.some((path) => fieldIsWithheld(data, path))) {
      if (Array.isArray(node)) return [];
      if (node && typeof node === 'object' && Array.isArray(node.data)) return { data: [], label: node.label, unit: node.unit, sourceUrl: node.sourceUrl };
      return null;
    }
    if (!node || typeof node !== 'object') return node;
    if (unavailableInfo(node)) return null;
    if (Array.isArray(node)) return node.flatMap((row, index) => {
      const selectors = [index, ...[row?.id, row?.key, row?.date, row?.month, row?.fy, row?.year, row?.fyLabel].filter((value) => value != null)];
      const rowPaths = paths.flatMap((path) => selectors.map((selector) => path ? `${path}.${selector}` : String(selector)));
      const result = visit(row, rowPaths);
      return row && typeof row === 'object' && result === null ? [] : [result];
    });
    const result = Object.fromEntries(Object.entries(node).map(([key, value]) => [
      key, isMetadataKey(key) ? value : value == null && ARRAY_FIELDS.has(key) ? [] : visit(value, paths.map((path) => path ? `${path}.${key}` : key)),
    ]));
    const certified = paths.map((path) => data.publicationEvidence?.[path]).find((item) =>
      ['official-primary', 'official-derived'].includes(item?.sourceType) && item.artifactId && safeSourceUrl(item.sourceUrl));
    if (certified) {
      result.evidence ||= certified;
      result.status ||= certified.status;
      result.sourceType ||= certified.sourceType;
    }
    if (result.evidence && !isEvidenceLeaf(result.evidence) && !Array.isArray(result.evidence) && !result.evidence.inputs) {
      result.evidence = Object.fromEntries(Object.entries(result.evidence).filter(([field]) =>
        !paths.some((path) => fieldIsWithheld(data, path ? `${path}.${field}` : field))));
    }
    if (result.evidence) result.evidence = resolveRecordedEvidence(result.evidence, data);
    return result;
  };
  return visit(data);
}

export const KPI_DATASETS = {
  reserves: ['reserves', 'weekly'],
  'exchange-rate': ['exchange-rates', 'monthly'],
  remittances: ['remittances', 'monthly'],
  fdi: ['fdi', 'monthly'],
  it_exports: ['services', 'itHeadline'],
  'gdp-growth': ['fiscal', 'annual'],
  inflation: ['inflation', 'national_cpi'],
  'fbr-tax': ['fbr-tax', 'fytd'],
  'policy-rate': ['monetary-policy', 'currentRate'],
  trade: ['trade', 'monthly'],
  'circular-debt': ['circular-debt', 'current'],
  'current-account': ['indicators', 'indicators'],
  'public-debt': ['indicators', 'indicators'],
};

export const DATASET_INPUTS = {
  'kpi-summary': [...new Set(Object.values(KPI_DATASETS).map(([id]) => id))],
  'reserves-adequacy': ['reserves', 'trade'],
};

export function restrictIndicator(row, freshness) {
  const [id, field] = KPI_DATASETS[row.id] || [row.datasetId];
  const dataset = freshness?.datasets?.find((item) => item.id === id);
  const missingSource = freshness && (!dataset || resolveSourceTier(dataset) === 'unverified');
  const blocked = missingSource || unavailableInfo(row) || unavailableInfo(dataset)
    || fieldIsWithheld(dataset, field || row.id)
    || withheldPaths(dataset).some((path) => path.startsWith(`${field}.`));
  if (!blocked) return row.change == null && row.trend === 'stable'
    ? { ...row, trend: 'unavailable', sentiment: 'neutral' } : row;
  return {
    ...row, value: null, displayValue: null, change: null, changeLabel: null, changeBasis: null,
    comparisonPeriod: null, momComparison: null, momChangeLabel: null, sub: null,
    changeDescription: null, note: null,
    sentiment: 'neutral', trend: null, unavailable: unavailableInfo(row) || unavailableInfo(dataset) || {
      label: OFFICIAL_UNAVAILABLE, reason: publicationOf(dataset)?.reason || OFFICIAL_UNAVAILABLE,
      sourceUrl: safeSourceUrl(dataset?.sourceUrl),
    },
  };
}

export function previewItemAllowed(item, freshness) {
  const id = item.dataset || item.datasetId || KPI_DATASETS[item.id]?.[0];
  const source = freshness?.datasets?.find((dataset) => dataset.id === id);
  if (!source || unavailableInfo(source) || resolveSourceTier(source) === 'unverified') return false;
  const path = item.path || item.field || KPI_DATASETS[item.id]?.[1];
  if (publicationOf(source)?.status === 'partial' && !path) return false;
  return !fieldIsWithheld(source, path || '')
    && !withheldPaths(source).some((restricted) => restricted.startsWith(`${path}.`));
}

export function prepareDataset(raw, metadata, freshness, datasetId = metadata?.id, sourceDatasets) {
  if (!raw) return { data: null, unavailable: null, publication: null };
  const canonical = publicationOf(raw);
  const metaPolicy = publicationOf(metadata);
  const rank = { published: 0, partial: 1, withheld: 2 };
  const publication = (rank[metaPolicy?.status] ?? -1) > (rank[canonical?.status] ?? -1) ? metaPolicy : canonical || metaPolicy;
  const combined = {
    ...metadata, ...raw,
    ...(publication ? { publication: {
      ...publication,
      withheldFields: [...new Set([...withheldPaths(raw), ...withheldPaths(metadata)])],
    } } : {}),
  };
  const certifiedPolicy = canonical?.policy === 'official-only' && ['partial', 'published'].includes(canonical.status);
  const certifiedEvidence = Object.values(raw.publicationEvidence || {}).filter((item) =>
    ['official-primary', 'official-derived'].includes(item.sourceType) && item.artifactId && safeSourceUrl(item.sourceUrl));
  if (certifiedPolicy && certifiedEvidence.length && !raw.sourceType) {
    combined.sourceType = certifiedEvidence.every((item) => item.sourceType === 'official-derived') ? 'official-derived' : 'official-primary';
    combined.sourceLabel = raw.sourceLabel || null;
  }
  if (datasetId === 'kpi-summary' && !raw.sourceType && !raw.authenticity) combined.sourceType = 'official-derived';
  if (resolveSourceTier(combined) === 'unverified') {
    combined.authenticity = 'unverified';
    combined.reason ||= 'Official source metadata is not available for this dataset.';
  }
  if (datasetId === 'reserves-adequacy' && sourceDatasets) {
    const effective = freshnessWithCanonical(freshness, sourceDatasets);
    const reservesAvailable = previewItemAllowed({ dataset: 'reserves', field: 'weekly' }, effective)
      && Number.isFinite(sourceDatasets.reserves?.data?.weekly?.at(-1)?.sbp);
    const importsAvailable = previewItemAllowed({ dataset: 'trade', field: 'monthly' }, effective)
      && Number.isFinite(sourceDatasets.trade?.data?.monthly?.at(-1)?.imports);
    const blockedFields = !reservesAvailable ? ['current', 'trajectory', 'drivers', 'context']
      : !importsAvailable ? ['current.importCoverMonths', 'trajectory', 'drivers', 'context'] : [];
    if (blockedFields.length && publicationOf(combined)?.status !== 'withheld') {
      combined.publication = {
        ...publicationOf(combined), policy: 'official-only', status: 'partial',
        reason: 'Required official reserves or imports inputs are unavailable; dependent calculations are withheld.',
        withheldFields: [...new Set([...withheldPaths(combined), ...blockedFields])],
      };
    }
  }
  const unavailable = unavailableInfo(combined);
  const data = unavailable ? null : publishedData(combined);
  if (data?.indicators && ['kpi-summary', 'indicators'].includes(datasetId)) {
    const effective = freshnessWithCanonical(freshness, sourceDatasets);
    data.indicators = data.indicators.map((row) => restrictIndicator(row, effective))
      .filter((row) => !(['fbr-tax', 'policy-rate'].includes(row.id) && row.unavailable));
  }
  return { data, unavailable, publication: publicationOf(combined) };
}

export function freshnessWithCanonical(freshness, sources = {}) {
  const datasets = new Map((freshness?.datasets || []).map((item) => [item.id, item]));
  for (const [id, result] of Object.entries(sources)) {
    const metadata = datasets.get(id);
    const prepared = prepareDataset(result.data, metadata, freshness, id);
    const source = prepared.data || result.data;
    const fields = ['authenticity', 'sourceType', 'sourceUrl', 'sourceLabel', 'freshnessStatus', 'verificationDate',
      'validation', 'observationDate', 'latestObservation', 'series', 'evidence'];
    datasets.set(id, {
      ...metadata, ...Object.fromEntries(fields.filter((key) => source?.[key] != null).map((key) => [key, source[key]])), id,
      ...(prepared.publication ? { publication: prepared.publication } : {}),
      ...(prepared.unavailable || result.error || !result.data ? {
        authenticity: 'unavailable', reason: prepared.unavailable?.reason || result.error?.message || OFFICIAL_UNAVAILABLE,
      } : {}),
      ...(result.error ? { freshnessStatus: 'fetch-failed' } : {}),
    });
  }
  return { ...freshness, datasets: [...datasets.values()] };
}

export function resolveFigureMetadata(dataset, row, { field, period } = {}) {
  const observation = row?.observationDate || row?.date || row?.month || row?.period || row?.asOf || row?.latestMonth || row?.fyLabel || row?.fy || row?.year || period;
  const key = field || row?.seriesId || row?.key || row?.id;
  const candidates = (dataset?.series || []).filter((series) => {
    const matchesKey = key && (series.id === key || key.startsWith(`${series.id}.`));
    const matchesDate = observation && series.observationDate === observation;
    return matchesKey ? !observation || !series.observationDate || matchesDate : !key && matchesDate;
  });
  const series = candidates.length === 1 ? candidates[0] : null;
  const policies = Object.entries(dataset?.publicationEvidence || {});
  const publishedEvidence = field && policies.filter(([path]) => field === path || field.startsWith(`${path}.`))
    .sort(([a], [b]) => b.length - a.length)[0]?.[1];
  const result = { ...(publishedEvidence ? { evidence: publishedEvidence, status: publishedEvidence.status } : {}), ...series, ...row };
  if (!result.derivation && typeof row?.evidence?.derivation === 'string') result.derivation = row.evidence.derivation;
  const valueField = field?.split('.').at(-1);
  const selectedEvidence = valueField && (row?.figureEvidence?.[valueField] || row?.[`${valueField}Evidence`]
    || (!isEvidenceLeaf(row?.evidence) ? evidenceForField(row?.evidence, valueField) : null));
  if (selectedEvidence) {
    const observation = row?.observations?.[valueField];
    Object.assign(result, observation, {
      evidence: selectedEvidence,
      status: observation?.status ?? row?.statuses?.[valueField] ?? 'not-stated',
      sourceStatus: observation?.sourceStatus ?? row?.sourceStatuses?.[valueField] ?? null,
    });
    if (!result.derivation && typeof selectedEvidence.derivation === 'string') result.derivation = selectedEvidence.derivation;
  }
  if (result.evidence) result.evidence = resolveRecordedEvidence(result.evidence, dataset);
  if (!result.evidence && !result.artifactId && observation) {
    const match = collectEvidenceRows(dataset).filter((item) =>
      (item.observationDate || item.date || item.month || item.period || item.fyLabel || item.fy || item.year) === observation
      && (!field || item.evidencePath === field || item.evidencePath.startsWith(`${field}.`)
        || item.evidencePath.replace(/\.\d+(?=\.|$)/g, '') === field
        || field.startsWith(`${item.evidencePath.replace(/\.\d+(?=\.|$)/g, '')}.`)));
    if (match.length === 1) return { ...match[0], ...result };
  }
  return result;
}

export function finiteSum(values) {
  return values?.length && values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null;
}

export function hasPublishedFigures(data) {
  if (!data || unavailableInfo(data)) return false;
  const visit = (node) => {
    if (Number.isFinite(node)) return true;
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) return node.some(visit);
    return Object.entries(node).some(([key, value]) =>
      !isMetadataKey(key) && !['year', 'fy', 'decimals', 'decimal', 'row', 'column', 'count'].includes(key) && visit(value));
  };
  return visit(data);
}

export function chartHasFigures(data) {
  return Boolean(data?.labels?.length && data?.datasets?.some((series) => series.data?.some((point) =>
    Number.isFinite(typeof point === 'object' && point !== null ? point.y : point))));
}

export function collectEvidenceRows(data) {
  const rows = [];
  const visit = (node, path = '') => {
    if (!node || typeof node !== 'object') return;
    const proof = data?.publicationEvidence?.[path];
    const evidence = node.evidence || (['official-primary', 'official-derived'].includes(proof?.sourceType)
      && proof.artifactId && safeSourceUrl(proof.sourceUrl) ? proof : null);
    if (evidence || node.locator || node.artifactId) rows.push({
      ...node, ...(evidence ? { evidence: resolveRecordedEvidence(evidence, data), status: node.status || proof?.status } : {}), evidencePath: path,
    });
    Object.entries(node).filter(([key]) => !isMetadataKey(key)).forEach(([key, value]) =>
      visit(value, path ? `${path}.${key}` : key));
  };
  visit(data);
  return rows;
}

export function rowsForObservation(rows, period, category) {
  const samePeriod = (value, target) => {
    if (value === target && target != null) return true;
    const left = observationKey(String(value));
    const right = observationKey(String(target));
    return left && right && left.kind === right.kind && left.value === right.value;
  };
  return (rows || []).filter((row) =>
    (period && [row.date, row.month, row.period, row.observationDate, row.fy, row.year].some((value) => samePeriod(value, period)))
    || (category && [row.label, row.name, row.country, row.countryName, row.category, row.fy, row.year].some((value) => samePeriod(value, category))));
}
