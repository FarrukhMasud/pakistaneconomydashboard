import { useEffect, useState } from 'react';
import SectionHeader from './SectionHeader';
import SourceBadge from './SourceBadge';
import ExportPackSection from './ExportPackSection';
import useI18n from '../i18n/useI18n';

const SOURCE_LINKS = [
  { label: 'SBP EasyData', url: 'https://easydata.sbp.org.pk' },
  { label: 'PBS Statistics', url: 'https://www.pbs.gov.pk' },
];

function useApiIndex() {
  const [state, setState] = useState({ data: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    fetch('/api/index.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setState({ data, loading: false }); })
      .catch(() => { if (!cancelled) setState({ data: null, loading: false }); });
    return () => { cancelled = true; };
  }, []);
  return state;
}

function CopyButton({ value }) {
  const { tx } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
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
  const { tx } = useI18n();
  const { data, loading } = useApiIndex();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const endpoints = data?.endpoints || [];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Download the Data & API"
        description="Every dataset behind these charts is published as JSON and CSV at a stable URL. No API key, no rate limit, no scraping. Each endpoint carries the issuing institution, its trust tier and the latest observation it contains, so a downloaded file can always be traced back to the official release it came from."
        sourceLinks={SOURCE_LINKS}
      />

      <ExportPackSection />

            {loading && <div className="card loading-card"><div className="spinner" /><span>{tx('Loading endpoint index\u2026')}</span></div>}

            {!loading && endpoints.length === 0 && (
        <p className="insight-note">
          {tx('The static API has not been generated for this build. Run')} <code>npm run generate:api</code>.
        </p>
      )}

      {!loading && endpoints.length > 0 && (
        <>
          <div className="card api-intro">
            <p>{data.description}</p>
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
                {endpoints.map((endpoint) => (
                  <tr key={endpoint.id}>
                    <td>
                      <strong>{endpoint.label}</strong>
                      <small>
                        <a href={endpoint.sourceUrl} target="_blank" rel="noreferrer">{endpoint.source}</a>
                        {' · '}{endpoint.cadence}
                      </small>
                    </td>
                    <td><SourceBadge sourceType={endpoint.sourceType} compact /></td>
                    <td>{endpoint.latestObservation || '—'}</td>
                    <td>{endpoint.rows ? endpoint.rows.toLocaleString() : '—'}</td>
                    <td>
                      <a href={endpoint.json} target="_blank" rel="noreferrer">JSON</a>
                      <CopyButton value={`${origin}${endpoint.json}`} />
                    </td>
                    <td>
                      {endpoint.csv ? (
                        <>
                          <a href={endpoint.csv} download>CSV</a>
                          <CopyButton value={`${origin}${endpoint.csv}`} />
                        </>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
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
