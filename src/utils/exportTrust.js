import { escapeHtml } from './escapeHtml.js';
import { csvCell } from './download.js';
import {
  canonicalProvenanceFigure, evidenceListOf, freshnessStatus, hasPublishedFigures, locatorLabel, OFFICIAL_UNAVAILABLE, publicationOf, provenanceFigureAllowed, provenanceTarget,
  resolveFigureMetadata, resolveSourceTier, safeSourceUrl, sourceFigureStatus, TRUST_LABELS, unavailableInfo, validationStatus,
} from './figureTrust.js';
import { kpiRoute } from './overviewModel.js';

const SERIES = {
  trade: [['monthly']], reserves: [['weekly'], ['monthly']], remittances: [['monthly']],
  inflation: [['national_cpi', 'data']], 'fbr-tax': [['monthly']], 'exchange-rates': [['monthly']],
  'kpi-summary': [['indicators']],
};

export function publicationManifest(bundle) {
  const metadata = bundle['data-freshness.json']?.data;
  return Object.entries(bundle).filter(([name]) => !['data-freshness.json', 'provenance.json'].includes(name))
    .map(([name, result]) => {
      const id = name.replace(/\.json$/, '');
      const source = result.data || metadata?.datasets?.find((item) => item.id === id) || {};
      return {
        id, publication: result.publication || publicationOf(source),
        unavailable: result.unavailable || (!hasPublishedFigures(result.data) ? { reason: OFFICIAL_UNAVAILABLE } : null), sourceUrl: safeSourceUrl(source.sourceUrl),
        authenticity: result.unavailable || !hasPublishedFigures(result.data) ? 'unavailable' : resolveSourceTier(source),
        freshnessStatus: freshnessStatus(source), validationStatus: validationStatus(source),
      };
    });
}

export function publicationExportSummary(bundle) {
  const manifest = publicationManifest(bundle);
  return {
    withheld: manifest.filter((item) => item.unavailable || item.publication?.status === 'withheld').length,
    partial: manifest.filter((item) => item.publication?.status === 'partial').length,
    available: manifest.filter((item) => !item.unavailable && item.publication?.status !== 'withheld').length,
  };
}

export function seriesToCsv(name, rows, { dataset, field, provenance } = {}) {
  if (!rows?.length) return '';
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const trustKeys = ['Observation period', 'Source status', 'Original source', 'Source artifact', 'Artifact retrieved', 'Downloaded from', 'Source locator', 'Parser version', 'Derivation'];
  const lines = [`# ${name}`, '# Null means unavailable; export time is not source retrieval time.', [...keys, ...trustKeys].map(csvCell).join(',')];
  for (const row of rows) {
    const figure = resolveFigureMetadata(dataset, row, { field });
    const evidence = evidenceListOf(figure, provenance);
    const join = (key) => evidence.map((item) => item[key]).filter(Boolean).join(' | ');
    lines.push([
      ...keys.map((key) => row[key] == null ? 'Unavailable' : typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key]),
      row.observationDate || row.date || row.month || row.period || row.asOf || 'Period not stated',
      TRUST_LABELS.status[sourceFigureStatus(figure)], join('sourceUrl'), join('artifactUrl'),
      join('retrievedAt'), join('responseUrl'), evidence.map((item) => locatorLabel(item.locator)).filter(Boolean).join(' | '),
      join('parserVersion'), figure.derivedFrom || figure.derivation || 'No derivation documented; see source',
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function extractCsvs(bundle) {
  const files = [];
  for (const [name, result] of Object.entries(bundle)) {
    const id = name.replace(/\.json$/, '');
    for (const path of SERIES[id] || []) {
      const rows = path.reduce((value, key) => value?.[key], result.data);
      if (Array.isArray(rows) && rows.length && hasPublishedFigures(rows)) {
        files.push({ name: `${id}-${path.join('-')}.csv`, content: seriesToCsv(id, rows, {
          dataset: result.data, field: path[0], provenance: bundle['provenance.json']?.data,
        }) });
      }
    }
    const payload = name === 'provenance.json' ? certifiedProvenance(result.data, bundle)
      : ['data-freshness.json'].includes(name) || hasPublishedFigures(result.data) ? result.data : {
      publication: result.publication || result.unavailable?.publication || { policy: 'official-only', status: 'withheld' },
      authenticity: 'unavailable', reason: result.unavailable?.reason || OFFICIAL_UNAVAILABLE,
      sourceUrl: result.unavailable?.sourceUrl,
    };
    files.push({ name, content: `${JSON.stringify(payload, null, 2)}\n` });
  }
  files.push({ name: 'publication-manifest.json', content: `${JSON.stringify(publicationManifest(bundle), null, 2)}\n` });
  return files;
}

export function certifiedProvenance(provenance, bundle) {
  const figures = Object.fromEntries(Object.entries(provenance?.figures || {}).filter(([key, figure]) => {
    const { datasetId } = provenanceTarget(key);
    return provenanceFigureAllowed(key, figure, bundle[`${datasetId}.json`]?.data);
  }).map(([key, figure]) => [key, canonicalProvenanceFigure(key, figure, bundle[`${provenanceTarget(key).datasetId}.json`]?.data, provenance)]));
  return { ...provenance, figures };
}

function trustHtml(row, metadata, provenance, origin) {
  const evidence = evidenceListOf(row, provenance);
  const link = (url, label) => {
    const safe = safeSourceUrl(url);
    if (!safe) return '';
    const target = safe.startsWith('/') ? safeSourceUrl(`${origin}${safe}`) : safe;
    return target ? `<a href="${escapeHtml(target)}">${escapeHtml(label)}</a>` : '';
  };
  const blocked = row?.unavailable || unavailableInfo(row) || !row;
  const details = [
    TRUST_LABELS.status[sourceFigureStatus(row)],
    `Authenticity: ${TRUST_LABELS.authenticity[blocked ? 'unavailable' : resolveSourceTier(row, resolveSourceTier(metadata))]}`,
    `Freshness: ${TRUST_LABELS.freshness[freshnessStatus(metadata)]}`,
    `Calculation validation: ${TRUST_LABELS.validation[validationStatus(metadata)]}`,
    row?.derivedFrom || row?.derivation ? `Derivation: ${row.derivedFrom || row.derivation}` : 'No derivation documented; see source',
  ].filter(Boolean).map(escapeHtml);
  if (!evidence.some((item) => item.sourceUrl)) details.push(link(metadata?.sourceUrl, 'Original source'));
  details.push(...evidence.flatMap((item) => [
    link(item.sourceUrl, 'Original source'), link(item.artifactUrl, 'Source artifact') || escapeHtml('Exact source evidence not available'),
    link(item.responseUrl, 'Downloaded from'), escapeHtml(locatorLabel(item.locator) || ''),
    item.retrievedAt ? escapeHtml(`Artifact retrieved: ${item.retrievedAt}`) : '',
  ]));
  return details.filter(Boolean).join(' · ');
}

export function buildBriefingHtml(bundle, { themeCss = '', origin = 'https://economyofpakistan.com' } = {}) {
  const freshness = bundle['data-freshness.json']?.data;
  const provenance = bundle['provenance.json']?.data;
  const metadataFor = (id) => freshness?.datasets?.find((item) => item.id === id);
  const generatedAt = new Date().toISOString();
  const rows = (bundle['kpi-summary.json']?.data?.indicators || []).map((row) =>
    `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${row.unavailable || !Number.isFinite(row.value) ? escapeHtml(OFFICIAL_UNAVAILABLE) : `${escapeHtml(row.value)} ${escapeHtml(row.unit || '')}`}</td><td>${escapeHtml(row.period || 'Period not stated')}</td><td>${trustHtml(row, metadataFor(kpiRoute(row.id).datasetId), provenance, origin)}</td></tr>`,
  ).join('');
  const snapshots = [
    ['Reserves (total)', 'reserves', 'weekly', 'total', 1000, 'USD billion'],
    ['Trade balance', 'trade', 'monthly', 'balance', 1000, 'USD billion'],
    ['Remittances', 'remittances', 'monthly', 'total', 1000, 'USD billion'],
    ['National CPI', 'inflation', 'national_cpi', 'value', 1, '%'],
  ].map(([label, id, key, field, divisor, unit]) => {
    const dataset = bundle[`${id}.json`]?.data;
    const series = dataset?.[key];
    const row = (Array.isArray(series) ? series : series?.data)?.at(-1);
    const value = Number.isFinite(row?.[field]) ? `${(row[field] / divisor).toFixed(2)} ${unit}` : OFFICIAL_UNAVAILABLE;
    const figure = resolveFigureMetadata(dataset, row, { field: `${key}.${field}` });
    return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)} · ${escapeHtml(row?.date || 'Period not stated')}<div class="figure-trust">${trustHtml(Number.isFinite(row?.[field]) ? figure : { ...figure, authenticity: 'unavailable' }, dataset || metadataFor(id), provenance, origin)}</div></li>`;
  }).join('');
  const limits = publicationManifest(bundle).filter((item) => item.unavailable || item.publication?.status === 'partial')
    .map((item) => `<li>${escapeHtml(item.id)}: ${escapeHtml(item.unavailable?.reason || item.publication?.reason || OFFICIAL_UNAVAILABLE)}${item.publication?.withheldFields?.length ? ` · Unavailable fields: ${escapeHtml(item.publication.withheldFields.join(', '))}` : ''}</li>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pakistan Economic Briefing</title>
<script>(()=>{const p=new URLSearchParams(location.search).get('scoutTheme');document.documentElement.dataset.theme=['light','dark'].includes(p)?p:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';})();</script>
<style>${themeCss}
body{font-family:"Segoe UI",Aptos,Calibri,sans-serif;max-width:960px;margin:2rem auto;padding:1rem;color:var(--cp-text);background:var(--cp-bg)}
table{width:100%;border-collapse:collapse}th,td{padding:.5rem;border-bottom:1px solid var(--cp-border);text-align:start;vertical-align:top;overflow-wrap:anywhere}
a{color:var(--cp-link)}button{font:inherit;padding:.5rem;color:var(--cp-accent-fg);background:var(--cp-accent);border:1px solid var(--cp-border);border-radius:.4rem}
.meta{color:var(--cp-text-muted)}:focus-visible{outline:2px solid var(--cp-accent);outline-offset:3px}
@media print{body{margin:0;padding:.3in;background:var(--cp-surface)}.no-print{display:none}}
</style></head><body><p class="no-print"><button onclick="window.print()">Print / Save as PDF</button></p>
<h1>Pakistan Economic Briefing</h1><p class="meta">Export generated ${escapeHtml(generatedAt)}. This is not a source retrieval or verification date.</p>
<p>Only verifiable official figures are published. Unsupported press numbers and unpublished figures are unavailable; missing values are never zero.</p>
${limits ? `<section class="publication-notice"><h2>Publication limits</h2><ul>${limits}</ul></section>` : ''}
<h2>Headline KPIs</h2><table><thead><tr><th>Indicator</th><th>Value</th><th>Period</th><th>Trust &amp; exact source evidence</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Official figures unavailable</td></tr>'}</tbody></table>
<h2>Snapshot</h2><ul>${snapshots}</ul><p class="meta">Authenticity, freshness and calculation validation are independent. Verify decisions against the original source release.</p>
</body></html>`;
}
