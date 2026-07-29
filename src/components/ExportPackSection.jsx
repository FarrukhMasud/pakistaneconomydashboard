import { useState } from 'react';
import { loadMany } from '../hooks/useData';
import { buildZip, downloadBlob } from '../utils/zip';
import { escapeHtml } from '../utils/escapeHtml';
import useI18n from '../i18n/useI18n';

const PACK_FILES = [
  'kpi-summary.json',
  'trade.json',
  'reserves.json',
  'remittances.json',
  'inflation.json',
  'fbr-tax.json',
  'exchange-rates.json',
  'services.json',
  'fiscal.json',
  'data-freshness.json',
];

function seriesToCsv(name, rows, fields) {
  if (!rows?.length) return '';
  const keys = fields || Object.keys(rows[0]);
  const header = keys.join(',');
  const body = rows.map((row) => keys.map((k) => {
    const v = row[k];
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  return `# ${name}\n# Downloaded from economyofpakistan.com on ${new Date().toISOString().slice(0, 10)}\n${header}\n${body}\n`;
}

function extractCsvs(bundle) {
  const files = [];
  const trade = bundle['trade.json']?.data;
  if (trade?.monthly) {
    files.push({ name: 'trade-monthly.csv', content: seriesToCsv('Trade monthly', trade.monthly) });
  }
  const reserves = bundle['reserves.json']?.data;
  if (reserves?.weekly) {
    files.push({ name: 'reserves-weekly.csv', content: seriesToCsv('Reserves weekly', reserves.weekly) });
  }
  const remit = bundle['remittances.json']?.data;
  if (remit?.monthly) {
    files.push({ name: 'remittances-monthly.csv', content: seriesToCsv('Remittances monthly', remit.monthly) });
  }
  const inflation = bundle['inflation.json']?.data;
  if (inflation?.national_cpi?.data) {
    files.push({
      name: 'inflation-national-cpi.csv',
      content: seriesToCsv('National CPI', inflation.national_cpi.data),
    });
  }
  const fbr = bundle['fbr-tax.json']?.data;
  if (fbr?.monthly) {
    files.push({ name: 'fbr-monthly.csv', content: seriesToCsv('FBR monthly', fbr.monthly) });
  }
  const fx = bundle['exchange-rates.json']?.data;
  if (fx?.monthly) {
    files.push({ name: 'exchange-rates-monthly.csv', content: seriesToCsv('Exchange rates', fx.monthly) });
  }
  const kpi = bundle['kpi-summary.json']?.data;
  if (kpi?.indicators) {
    files.push({ name: 'kpi-summary.csv', content: seriesToCsv('KPI summary', kpi.indicators, ['id', 'label', 'value', 'unit', 'period', 'change', 'changeUnit', 'source']) });
  }
  // Always include raw JSON for full fidelity
  for (const name of PACK_FILES) {
    const payload = bundle[name]?.data;
    if (payload) {
      files.push({ name: name, content: `${JSON.stringify(payload, null, 2)}\n` });
    }
  }
  return files;
}

function buildBriefingHtml(bundle) {
  const kpi = bundle['kpi-summary.json']?.data;
  const trade = bundle['trade.json']?.data;
  const reserves = bundle['reserves.json']?.data;
  const remit = bundle['remittances.json']?.data;
  const inflation = bundle['inflation.json']?.data;
  const latest = (rows) => (rows?.length ? rows[rows.length - 1] : null);
  const t = latest(trade?.monthly);
  const r = latest(reserves?.weekly);
  const m = latest(remit?.monthly);
  const cpi = latest(inflation?.national_cpi?.data);

  const rows = (kpi?.indicators || []).map((ind) => (
      `<tr><td>${escapeHtml(ind.label)}</td><td>${escapeHtml(ind.value)}${ind.unit ? ` ${escapeHtml(ind.unit)}` : ''}</td><td>${escapeHtml(ind.period || '')}</td><td>${escapeHtml(ind.source || '')}</td></tr>`
  )).join('');
    const generatedAt = new Date().toISOString();
    const day = escapeHtml(generatedAt.slice(0, 10));

    return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="utf-8"/>
  <title>Pakistan Economic Briefing — ${day}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 2rem auto; color: #111; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid #ccc; padding: 0.4rem 0.3rem; text-align: left; }
    .meta { color: #555; font-size: 0.85rem; }
    @media print { body { margin: 0.5in; } .no-print { display: none; } }
  </style>
  </head>
  <body>
    <p class="no-print"><button onclick="window.print()">Print / Save as PDF</button></p>
    <h1>Pakistan Economic Briefing</h1>
    <p class="meta">Generated ${escapeHtml(generatedAt)} · economyofpakistan.com · Official-source dashboard extract</p>
    <h2>Headline KPIs</h2>
    <table>
      <thead><tr><th>Indicator</th><th>Value</th><th>Period</th><th>Source</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">KPI data unavailable</td></tr>'}</tbody>
    </table>
    <h2>Snapshot</h2>
    <ul>
      <li>Reserves (total): ${r ? `$${escapeHtml((r.total / 1000).toFixed(2))}B as of ${escapeHtml(r.date)}` : '—'}</li>
      <li>Trade balance: ${t ? `$${escapeHtml((t.balance / 1000).toFixed(2))}B in ${escapeHtml(t.date)}` : '—'}</li>
      <li>Remittances: ${m ? `$${escapeHtml((m.total / 1000).toFixed(2))}B in ${escapeHtml(m.date)}` : '—'}</li>
      <li>National CPI: ${cpi ? `${escapeHtml(cpi.value)}% in ${escapeHtml(cpi.date)}` : '—'}</li>
    </ul>
    <p class="meta">Figures stay in the units published by the issuing institution. Always verify critical decisions against the original source release.</p>
  </body>
  </html>`;
  }

export default function ExportPackSection() {
  const { t, tx } = useI18n();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const runPack = async () => {
    setBusy(true);
    setStatus(t('export.building', 'Building pack…'));
    try {
      const bundle = await loadMany(PACK_FILES);
      const files = extractCsvs(bundle);
      if (!files.length) throw new Error('No datasets available to export');
      const zip = buildZip(files);
      downloadBlob(`pakistan-economy-pack-${new Date().toISOString().slice(0, 10)}.zip`, zip);
      setStatus(t('export.ready', 'Download started'));
    } catch (err) {
      setStatus(err.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const runBriefing = async () => {
    setBusy(true);
    setStatus(t('export.buildingBrief', 'Building briefing…'));
    try {
      const bundle = await loadMany(PACK_FILES);
      const html = buildBriefingHtml(bundle);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus(t('export.briefReady', 'Briefing opened — use Print to save PDF'));
    } catch (err) {
      setStatus(err.message || 'Briefing failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card export-pack">
      <h3>{tx('Export pack & printable briefing')}</h3>
      <p>
        {tx('Download a ZIP of headline CSVs and source JSON, or open a one-page briefing you can print to PDF.')}
      </p>
      <div className="export-pack__actions">
        <button type="button" className="export-pack__btn" disabled={busy} onClick={runPack}>
          {tx('Download data pack (ZIP)')}
        </button>
        <button type="button" className="export-pack__btn export-pack__btn--secondary" disabled={busy} onClick={runBriefing}>
          {tx('Open printable briefing')}
        </button>
        <a className="export-pack__btn export-pack__btn--secondary" href="/feed.xml" target="_blank" rel="noreferrer">
          {tx('Critical series RSS')}
        </a>
      </div>
      {status && <p className="export-pack__status" role="status">{status}</p>}
    </div>
  );
}
