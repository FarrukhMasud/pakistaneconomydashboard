import { useEffect, useState } from 'react';
import SectionHeader from './SectionHeader';
import SourceBadge from './SourceBadge';
import ExportPackSection from './ExportPackSection';
import useI18n from '../i18n/useI18n';
import { loadMany, useSourcePolicies } from '../hooks/useData';
import { LoadingCard, ErrorCard } from './ui/DataState';
import FigureTrust from './FigureTrust';
import { publicationOf, unavailableInfo } from '../utils/figureTrust';
import { downloadTextFile } from '../utils/download';
import { seriesToCsv } from '../utils/exportTrust';

const SOURCE_LINKS = [
  { label: 'SBP EasyData', url: 'https://easydata.sbp.org.pk' },
  { label: 'PBS Statistics', url: 'https://www.pbs.gov.pk' },
];

function useApiIndex() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/index.json', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`Endpoint index request failed (${res.status})`);
        return res.json();
      })
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (!cancelled) setState({ data: null, loading: false, error }); });
    return () => { cancelled = true; };
  }, [attempt]);
  return { ...state, retry: () => { setState({ data: null, loading: true, error: null }); setAttempt((value) => value + 1); } };
}

function CopyButton({ value }) {
  const { tx } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={tx('Copy this URL:')}
      className="api-copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt(tx('Copy this URL:'), value);
        }
      }}
    >
      {copied ? '✅' : '📋'}
    </button>
  );
}

/**
 * Documents the static data API. Everything the dashboard renders is already a
 * static file, so publishing it under stable URLs lets anyone reuse the numbers
 * without scraping — and keeps the attribution attached to the data.
 */
export default function DataApiSection() {
  const { t, tx } = useI18n();
  const { data, loading, error, retry } = useApiIndex();
  const endpoints = data?.endpoints || [];
  const freshness = useSourcePolicies(endpoints.map((endpoint) => endpoint.id));
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(false);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const downloadCertified = async (endpoint, csv) => {
    setDownloadBusy(true);
    setDownloadStatus('');
    try {
      if (!/^[a-z0-9-]+$/.test(endpoint.id)) throw new Error('Invalid dataset identifier');
      const name = `${endpoint.id}.json`;
      const bundle = await loadMany([name]);
      const result = bundle[name];
      const payload = result.data || { publication: result.publication, authenticity: 'unavailable', reason: result.unavailable?.reason };
      if (csv) {
        const series = String(endpoint.seriesKey || '').split('.').reduce((value, key) => value?.[key], result.data);
        if (!Array.isArray(series) || !series.length) throw new Error(t('trust.noExport', 'No official figures are available to export.'));
        downloadTextFile(`${endpoint.id}.csv`, 'text/csv', seriesToCsv(endpoint.label, series, { dataset: result.data, field: endpoint.seriesKey }));
      } else {
        downloadTextFile(name, 'application/json', JSON.stringify(payload, null, 2));
      }
      setDownloadStatus(result.unavailable ? t('trust.unavailable', 'Official figure not yet published / verified') : t('trust.certifiedDownload', 'Download started; publication limits and evidence are included.'));
    } catch (failure) {
      setDownloadStatus(failure.message || t('trust.exportFailed', 'Export failed'));
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Download the Data & API"
        description={t('trust.apiDescription', 'Official datasets use stable JSON and CSV URLs. Publication limits apply to all formats. Until a static endpoint carries the official-only policy, use the certified download here.')}
        sourceLinks={SOURCE_LINKS}
      />

      <ExportPackSection />
      {downloadStatus && <p className="publication-notice" role="status">{downloadStatus}</p>}
      {error && <ErrorCard error={error} onRetry={retry} />}
      {freshness.error && <ErrorCard error={freshness.error} onRetry={freshness.retry} />}
      {freshness.dependencyErrors.map((result) => <ErrorCard key={result.id} error={result.error} onRetry={freshness.retry} compact />)}

      {(loading || freshness.loading) && <LoadingCard label="Loading endpoint index…" />}

      {!loading && !error && endpoints.length === 0 && (
        <p className="insight-note">
          {tx('The static API has not been generated for this build. Run')} <code>npm run generate:api</code>.
        </p>
      )}

      {!loading && !freshness.loading && !freshness.error && endpoints.length > 0 && (
        <>
          <div className="card api-intro">
            <p>{t('trust.officialOnly', 'Only verifiable official figures are published. Unsupported press numbers are unavailable, not estimates.')}</p>
            <p className="api-attribution">{data.attribution}</p>
            <div className="api-endpoint-row">
              <code>{origin}/api/index.json</code>
              <CopyButton value={`${origin}/api/index.json`} />
              <a href="/api/index.json" target="_blank" rel="noreferrer">{tx("Open")}</a>
            </div>
          </div>

          <div className="api-table-wrap card">
            <table className="api-table">
              <thead>
                <tr>
                  <th>{tx("Dataset")}</th>
                  <th>{tx("Trust")}</th>
                  <th>{tx("Latest")}</th>
                  <th>{tx("Rows")}</th>
                  <th>JSON</th>
                  <th>CSV</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((endpoint) => {
                  const metadata = freshness.data?.datasets?.find((item) => item.id === endpoint.id);
                  const policy = publicationOf(metadata);
                  const blocked = unavailableInfo(metadata) || unavailableInfo(endpoint);
                  const certified = !blocked && policy?.policy === 'official-only'
                    && policy.status === 'published'
                    && publicationOf(endpoint)?.policy === 'official-only'
                    && publicationOf(endpoint)?.status === policy.status;
                  return (
                  <tr key={endpoint.id}>
                    <td>
                      <strong>{endpoint.label}</strong>
                      <small>
                        <a href={endpoint.sourceUrl} target="_blank" rel="noreferrer">{endpoint.source}</a>
                        {' · '}{endpoint.cadence}
                      </small>
                    </td>
                    <td><SourceBadge datasetId={endpoint.id} compact /><FigureTrust datasetId={endpoint.id} compact /></td>
                    <td>{blocked ? t('trust.unavailableShort', 'Unavailable') : metadata?.observationDate || metadata?.latestObservation || '—'}</td>
                    <td>{!blocked && policy?.status === 'published' && endpoint.rows ? endpoint.rows.toLocaleString() : '—'}</td>
                    <td>
                      {certified ? <><a href={endpoint.json} target="_blank" rel="noreferrer">JSON</a><CopyButton value={`${origin}${endpoint.json}`} /></>
                        : <button type="button" className="source-link-pill" disabled={downloadBusy} onClick={() => downloadCertified(endpoint, false)}>JSON</button>}
                    </td>
                    <td>
                      {endpoint.csv && !blocked ? certified ? (
                        <>
                          <a href={endpoint.csv} download>CSV</a>
                          <CopyButton value={`${origin}${endpoint.csv}`} />
                        </>
                      ) : <button type="button" className="source-link-pill" disabled={downloadBusy} onClick={() => downloadCertified(endpoint, true)}>CSV</button> : t('trust.unavailableShort', 'Unavailable')}
                    </td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>

          <p className="insight-note">
            {tx('Individual charts also carry a')} <strong>CSV</strong> {tx('button that exports exactly the series drawn on screen.')}
            {' '}{tx('Generated')} {data.generatedAt?.slice(0, 10)}.
          </p>
        </>
      )}
    </section>
  );
}
