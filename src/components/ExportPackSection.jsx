import { useState } from 'react';
import { loadMany, useSourcePolicies } from '../hooks/useData';
import { publicationOf, resolveSourceTier } from '../utils/figureTrust';
import { buildZip, downloadBlob } from '../utils/zip';
import { buildBriefingHtml, extractCsvs, publicationExportSummary } from '../utils/exportTrust';
import trustCss from '../styles/trust.css?inline';
import useI18n from '../i18n/useI18n';
import { ErrorCard } from './ui/DataState';

const PACK_FILES = [
  'kpi-summary.json', 'trade.json', 'reserves.json', 'remittances.json',
  'inflation.json', 'fbr-tax.json', 'exchange-rates.json', 'services.json',
  'fiscal.json', 'data-freshness.json', 'provenance.json',
];
const RSS_INPUTS = ['trade', 'reserves', 'remittances', 'inflation', 'fbr-tax'];

export default function ExportPackSection() {
  const { t, tx } = useI18n();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const rssPolicies = useSourcePolicies(RSS_INPUTS);
  const rssAvailable = !rssPolicies.loading && !rssPolicies.error && !rssPolicies.dependencyErrors.length && RSS_INPUTS.every((id) => {
    const source = rssPolicies.data?.datasets?.find((item) => item.id === id);
    return publicationOf(source)?.policy === 'official-only' && publicationOf(source)?.status === 'published'
      && ['official-primary', 'official-derived'].includes(resolveSourceTier(source));
  });

  const runExport = async (briefing) => {
    setBusy(true);
    setFailed(false);
    setStatus(t('export.building', 'Building pack…'));
    try {
      const bundle = await loadMany(PACK_FILES);
      const counts = publicationExportSummary(bundle);
      if (!counts.available) throw new Error(t('trust.noExport', 'No official figures are available to export.'));
      if (briefing) {
        // Download rather than opening a popup after an asynchronous fetch.
        downloadBlob(`pakistan-economic-briefing-${new Date().toISOString().slice(0, 10)}.html`,
          new Blob([buildBriefingHtml(bundle, { themeCss: trustCss, origin: window.location.origin })], { type: 'text/html;charset=utf-8' }));
      } else {
        downloadBlob(`pakistan-economy-pack-${new Date().toISOString().slice(0, 10)}.zip`, buildZip(extractCsvs(bundle)));
      }
      setStatus(t('trust.exportLimits', 'Download started: {withheld} withheld and {partial} partial datasets. Publication limits and evidence are included.')
        .replace('{withheld}', counts.withheld).replace('{partial}', counts.partial));
    } catch (error) {
      setFailed(true);
      setStatus(error.message || t('trust.exportFailed', 'Export failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card export-pack">
      <h3>{tx('Export pack & printable briefing')}</h3>
      <p>{t('trust.exportDescription', 'Download certified data with publication limits, source evidence and a trust manifest. Withheld figures are not exported as numbers.')}</p>
      <div className="export-pack__actions">
        <button type="button" className="export-pack__btn" disabled={busy} onClick={() => runExport(false)}>{tx('Download data pack (ZIP)')}</button>
        <button type="button" className="export-pack__btn export-pack__btn--secondary" disabled={busy} onClick={() => runExport(true)}>
          {t('trust.downloadBriefing', 'Download printable briefing')}
        </button>
        {rssAvailable ? <a className="export-pack__btn export-pack__btn--secondary" href="/feed.xml" target="_blank" rel="noreferrer">{tx('Critical series RSS')}</a>
          : <span className="figure-trust">{t('trust.rssUnavailable', 'RSS download unavailable until all critical source inputs are certified for publication.')}</span>}
      </div>
      {status && <p className="export-pack__status" role={failed ? 'alert' : 'status'}>{status}</p>}
      {rssPolicies.error && <ErrorCard error={rssPolicies.error} onRetry={rssPolicies.retry} compact />}
      {rssPolicies.dependencyErrors.map((result) => <ErrorCard key={result.id} error={result.error} onRetry={rssPolicies.retry} compact />)}
    </div>
  );
}
