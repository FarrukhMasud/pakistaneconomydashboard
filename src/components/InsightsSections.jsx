import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseBarOptions } from '../utils/chartConfig';
import DataFreshnessPanel from './DataFreshnessPanel';
import SectionHeader from './SectionHeader';
import './ui/Insights.css';

const SOURCE_LINKS = [
  { label: 'SBP', url: 'https://www.sbp.org.pk' },
  { label: 'PBS', url: 'https://www.pbs.gov.pk' },
  { label: 'Finance Division', url: 'https://www.finance.gov.pk' },
  { label: 'FBR', url: 'https://www.fbr.gov.pk' },
  { label: 'World Bank Data', url: 'https://data.worldbank.org' },
  { label: 'IMF Pakistan', url: 'https://www.imf.org/en/Countries/PAK' },
];

function LoadingCard({ label = 'Loading official data…' }) {
  return <div className="card loading-card"><div className="spinner" /><span>{label}</span></div>;
}

function fmt(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function signed(value, suffix = '', digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${fmt(value, digits)}${suffix}`;
}

function latest(rows = []) {
  return rows.at(-1) || null;
}

function previous(rows = []) {
  return rows.length > 1 ? rows.at(-2) : null;
}

function yoyRow(rows = [], date) {
  if (!date) return null;
  const [year, month] = date.split('-');
  return rows.find((row) => row.date === `${Number(year) - 1}-${month}`);
}

function pctChange(current, prior) {
  if (current == null || prior == null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function trendClass(value, positiveWhenUp = true) {
  if (value == null || Math.abs(value) < 0.05) return 'neutral';
  const positive = positiveWhenUp ? value > 0 : value < 0;
  return positive ? 'positive' : 'negative';
}

function InsightCard({ title, value, meta, body, source, sourceUrl, tone = 'neutral' }) {
  return (
    <article className={`insight-card insight-card--${tone}`}>
      <div className="insight-card__top">
        <h3>{title}</h3>
        <span className="official-badge">Official data</span>
      </div>
      <div className="insight-card__value">{value}</div>
      {meta && <div className="insight-card__meta">{meta}</div>}
      <p>{body}</p>
      {sourceUrl ? (
        <a className="insight-card__source" href={sourceUrl} target="_blank" rel="noreferrer">{source} ↗</a>
      ) : (
        <span className="insight-card__source">{source}</span>
      )}
    </article>
  );
}

export function EconomicBriefingSection() {
  const kpi = useData('kpi-summary.json');
  const trade = useData('trade.json');
  const remittances = useData('remittances.json');
  const inflation = useData('inflation.json');
  const reserves = useData('reserves.json');
  const fbr = useData('fbr-tax.json');

  const loading = [kpi, trade, remittances, inflation, reserves, fbr].some((r) => r.loading);
  if (loading) return <LoadingCard label="Building the latest official-data briefing…" />;

  const t = latest(trade.data?.monthly);
  const tPrev = previous(trade.data?.monthly);
  const r = latest(remittances.data?.monthly);
  const rYoy = yoyRow(remittances.data?.monthly, r?.date);
  const inf = latest(inflation.data?.national_cpi?.data);
  const infPrev = previous(inflation.data?.national_cpi?.data);
  const res = latest(reserves.data?.weekly);
  const resPrev = previous(reserves.data?.weekly);
  const fbrGap = fbr.data?.fytd ? fbr.data.fytd.net - fbr.data.fytd.target : null;

  const cards = [
    {
      title: 'External buffer',
      value: `$${fmt((res?.total || 0) / 1000, 2)}B`,
      meta: `${res?.date || 'Latest'} · ${signed(((res?.total || 0) - (resPrev?.total || 0)) / 1000, 'B', 2)} vs prior week`,
      tone: trendClass((res?.total || 0) - (resPrev?.total || 0)),
      body: 'Reserves are the first line of defense against import and external-debt pressure. Watch both the level and import-cover months.',
      source: 'State Bank of Pakistan',
      sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    },
    {
      title: 'Remittance support',
      value: `$${fmt((r?.total || 0) / 1000, 2)}B`,
      meta: `${r?.date || 'Latest'} · ${signed(pctChange(r?.total, rYoy?.total), '% YoY')}`,
      tone: trendClass(pctChange(r?.total, rYoy?.total)),
      body: 'Remittances are one of Pakistan’s most important recurring foreign-exchange inflows and can offset part of the trade gap.',
      source: 'SBP EasyData',
      sourceUrl: 'https://easydata.sbp.org.pk',
    },
    {
      title: 'Trade gap',
      value: `$${fmt(Math.abs(t?.balance || 0) / 1000, 2)}B deficit`,
      meta: `${t?.date || 'Latest'} · ${signed((t?.balance || 0) - (tPrev?.balance || 0), 'M', 0)} vs prior month`,
      tone: trendClass((t?.balance || 0) - (tPrev?.balance || 0)),
      body: 'A smaller negative balance eases pressure on reserves. Imports, exports, and remittances should be read together.',
      source: 'State Bank of Pakistan',
      sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    },
    {
      title: 'Inflation pulse',
      value: `${fmt(inf?.value)}%`,
      meta: `${inf?.date || 'Latest'} · ${signed((inf?.value || 0) - (infPrev?.value || 0), ' pp')}`,
      tone: trendClass((inf?.value || 0) - (infPrev?.value || 0), false),
      body: 'Inflation determines household purchasing power and guides SBP policy-rate decisions.',
      source: 'PBS via SBP EasyData',
      sourceUrl: 'https://easydata.sbp.org.pk',
    },
    {
      title: 'Tax target pressure',
      value: `₨${fmt(Math.abs(fbrGap || 0), 0)}B ${fbrGap >= 0 ? 'ahead' : 'short'}`,
      meta: fbr.data?.fytd?.period,
      tone: fbrGap >= 0 ? 'positive' : 'negative',
      body: 'Tax collection relative to target indicates how much fiscal adjustment may be needed through revenue measures or spending control.',
      source: 'Federal Board of Revenue',
      sourceUrl: 'https://www.fbr.gov.pk',
    },
  ];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Monthly Economic Briefing"
        description="A plain-English briefing generated from the same official datasets that power the dashboard. It highlights what changed, why it matters, and which source backs each statement."
        sourceLinks={SOURCE_LINKS}
      />
      <div className="insight-grid">
        {cards.map((card) => <InsightCard key={card.title} {...card} />)}
      </div>
      <p className="insight-note">Interpretation is rule-based and limited to official data already shown in the dashboard; it does not infer unpublished values.</p>
    </section>
  );
}

export function PeerComparisonSection() {
  const { data, loading, error } = useData('peer-comparison.json');
  const [activeId, setActiveId] = useState('gdp-growth');

  const active = useMemo(
    () => data?.indicators?.find((indicator) => indicator.id === activeId) || data?.indicators?.[0],
    [data, activeId],
  );

  if (loading || !data) return <LoadingCard label="Loading World Bank peer data…" />;
  if (error) return <div className="card"><p>Error loading peer comparison: {error.message}</p></div>;

  const chart = {
    labels: active.values.map((row) => row.countryName),
    datasets: [{
      label: `${active.label} (${active.unit})`,
      data: active.values.map((row) => row.value),
      backgroundColor: active.values.map((row) => row.countryCode === 'PAK' ? COLORS.teal : COLORS.blue),
      borderRadius: 6,
    }],
  };
  const options = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const row = active.values[ctx.dataIndex];
            return `${ctx.raw} ${active.unit} · ${row.year || 'N/A'}`;
          },
        },
      },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Pakistan vs Peer Economies"
        description="Annual peer-country comparisons from the World Bank's official World Development Indicators. The latest available official year can vary by indicator and country."
        sourceLinks={[{ label: 'World Bank Open Data', url: data.sourceUrl }]}
      />
      <div className="metric-switcher" role="tablist" aria-label="Peer comparison metric">
        {data.indicators.map((indicator) => (
          <button
            key={indicator.id}
            className={`metric-chip ${indicator.id === active.id ? 'active' : ''}`}
            onClick={() => setActiveId(indicator.id)}
          >
            {indicator.label}
          </button>
        ))}
      </div>
      <div className="insight-panel">
        <div>
          <h3>{active.label}</h3>
          <p>{active.whyItMatters}</p>
          <span className="source-pill">World Bank indicator {active.code}</span>
        </div>
        <a href={active.sourceUrl} target="_blank" rel="noreferrer">API source ↗</a>
      </div>
      <div className="chart-card card">
        <div style={{ height: 340 }}>
          <Bar data={chart} options={options} />
        </div>
      </div>
      <div className="insight-table-wrap">
        <table className="insight-table">
          <thead><tr><th>Country</th><th>Value</th><th>Official year</th></tr></thead>
          <tbody>
            {active.values.map((row) => (
              <tr key={row.countryCode}>
                <td>{row.countryName}</td>
                <td>{row.value == null ? 'Not available' : `${fmt(row.value, 2)} ${active.unit}`}</td>
                <td>{row.year || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">{data.methodologyNote}</p>
    </section>
  );
}

export function RiskOutlookSection() {
  const fiscal = useData('fiscal.json');
  const fbr = useData('fbr-tax.json');
  const reservesAdequacy = useData('reserves-adequacy.json');
  const externalDebt = useData('external-debt.json');
  const inflation = useData('inflation.json');
  const remittances = useData('remittances.json');
  const trade = useData('trade.json');
  const indicators = useData('indicators.json');

  const loading = [fiscal, fbr, reservesAdequacy, externalDebt, inflation, remittances, trade, indicators].some((r) => r.loading);
  if (loading) return <LoadingCard label="Assembling risk, household, and trend-watch panels…" />;

  const pf = fiscal.data?.publicFinance || {};
  const latestFiscal = latest(pf.fiscal_balance?.data);
  const latestPrimary = latest(pf.primary_balance?.data);
  const latestInf = latest(inflation.data?.national_cpi?.data);
  const priorInf = previous(inflation.data?.national_cpi?.data);
  const latestRemit = latest(remittances.data?.monthly);
  const remit3m = (remittances.data?.monthly || []).slice(-3);
  const remitAvg = remit3m.reduce((sum, row) => sum + row.total, 0) / Math.max(remit3m.length, 1);
  const latestTrade = latest(trade.data?.monthly);
  const trade3m = (trade.data?.monthly || []).slice(-3);
  const tradeAvg = trade3m.reduce((sum, row) => sum + row.balance, 0) / Math.max(trade3m.length, 1);
  const petrol = indicators.data?.indicators?.find((row) => row.id === 'petrol-price');
  const policy = indicators.data?.indicators?.find((row) => row.id === 'policy-rate');
  const publicDebt = indicators.data?.indicators?.find((row) => row.id === 'public-debt');
  const circularDebt = indicators.data?.indicators?.find((row) => row.id === 'circular-debt');
  const fbrGap = fbr.data?.fytd ? fbr.data.fytd.net - fbr.data.fytd.target : null;

  return (
    <section className="fade-in">
      <SectionHeader
        title="Risk, Outlook & Household Impact"
        description="Official-data panels that connect macro indicators to fiscal pressure, external vulnerability, and everyday household impact. Forward-looking labels are trend math only, not forecasts."
        sourceLinks={SOURCE_LINKS}
      />

      <div className="insight-two-col">
        <div className="context-block card">
          <h3>Fiscal stress monitor</h3>
          <div className="context-list">
            <div><span>Fiscal balance</span><strong>{latestFiscal ? `₨${fmt(latestFiscal.value / 1e6, 2)}T` : '—'}</strong><small>{latestFiscal?.fy}</small></div>
            <div><span>Primary balance</span><strong>{latestPrimary ? `₨${fmt(latestPrimary.value / 1e6, 2)}T` : '—'}</strong><small>{latestPrimary?.fy}</small></div>
            <div><span>FBR target gap</span><strong>₨{fmt(Math.abs(fbrGap || 0), 0)}B {fbrGap >= 0 ? 'ahead' : 'short'}</strong><small>{fbr.data?.fytd?.period}</small></div>
            <div><span>Public debt</span><strong>{publicDebt?.value}{publicDebt?.unit}</strong><small>{publicDebt?.change}</small></div>
            <div><span>Power circular debt</span><strong>{circularDebt?.value}{circularDebt?.unit}</strong><small>{circularDebt?.asOf}</small></div>
          </div>
        </div>

        <div className="context-block card">
          <h3>External vulnerability scorecard</h3>
          <div className="context-list">
            <div><span>Import cover</span><strong>{reservesAdequacy.data?.current?.importCoverMonths} months</strong><small>{reservesAdequacy.data?.benchmark?.label}</small></div>
            <div><span>SBP reserves</span><strong>${reservesAdequacy.data?.current?.sbpReserves}B</strong><small>{reservesAdequacy.data?.current?.asOf}</small></div>
            <div><span>FY26 gross external repayment</span><strong>${externalDebt.data?.fy26?.grossRepayment}B</strong><small>rollovers remain critical</small></div>
            <div><span>Hard-cash repayment</span><strong>${externalDebt.data?.fy26?.hardRepayment}B</strong><small>interest + non-rolled principal</small></div>
            <div><span>Latest trade deficit</span><strong>${fmt(Math.abs(latestTrade?.balance || 0) / 1000, 2)}B</strong><small>{latestTrade?.date}</small></div>
          </div>
        </div>
      </div>

      <div className="insight-two-col">
        <div className="context-block card">
          <h3>Household impact view</h3>
          <div className="context-list">
            <div><span>CPI inflation</span><strong>{fmt(latestInf?.value)}%</strong><small>{latestInf?.date}</small></div>
            <div><span>Inflation momentum</span><strong>{signed((latestInf?.value || 0) - (priorInf?.value || 0), ' pp')}</strong><small>latest vs prior month</small></div>
            <div><span>Policy rate</span><strong>{policy?.value}{policy?.unit}</strong><small>{policy?.asOf}</small></div>
            <div><span>Petrol price</span><strong>{petrol?.value}{petrol?.unit}</strong><small>{petrol?.asOf}</small></div>
          </div>
        </div>

        <div className="context-block card">
          <h3>Trend watch, not a forecast</h3>
          <div className="context-list">
            <div><span>Remittances vs 3-month average</span><strong>{signed(pctChange(latestRemit?.total, remitAvg), '%')}</strong><small>{latestRemit?.date}</small></div>
            <div><span>Trade balance vs 3-month average</span><strong>{signed((latestTrade?.balance || 0) - tradeAvg, 'M', 0)}</strong><small>less negative is better</small></div>
            <div><span>Inflation direction</span><strong>{(latestInf?.value || 0) >= (priorInf?.value || 0) ? 'Rising' : 'Cooling'}</strong><small>latest official CPI print</small></div>
            <div><span>Tax collection vs FYTD target</span><strong>{fbrGap >= 0 ? 'Ahead' : 'Behind'}</strong><small>official FBR target comparison</small></div>
          </div>
        </div>
      </div>

      <p className="insight-note">No synthetic estimates are introduced here. Every value is either directly sourced from the dashboard datasets or a transparent arithmetic comparison of those official values.</p>
    </section>
  );
}

export function EconomicTimelineSection() {
  const { data, loading, error } = useData('economic-events.json');
  if (loading || !data) return <LoadingCard label="Loading official economic timeline…" />;
  if (error) return <div className="card"><p>Error loading timeline: {error.message}</p></div>;

  return (
    <section className="fade-in">
      <SectionHeader
        title="Official Economic Timeline"
        description="Context markers for charts and indicators. Events are included only when tied to an official or primary institutional source."
        sourceLinks={[{ label: 'IMF Pakistan', url: 'https://www.imf.org/en/Countries/PAK' }, { label: 'SBP', url: 'https://www.sbp.org.pk' }]}
      />
      <div className="timeline">
        {data.events.map((event) => (
          <article key={`${event.date}-${event.title}`} className="timeline-event card">
            <div className="timeline-event__date">{event.date}</div>
            <div>
              <span className="source-pill">{event.category}</span>
              <h3>{event.title}</h3>
              <p>{event.whyItMatters}</p>
              <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.officialSource} ↗</a>
            </div>
          </article>
        ))}
      </div>
      <p className="insight-note">{data.methodologyNote}</p>
    </section>
  );
}

export function LearningCenterSection() {
  const { data, loading, error } = useData('explainers.json');
  if (loading || !data) return <LoadingCard label="Loading learning center…" />;
  if (error) return <div className="card"><p>Error loading explainers: {error.message}</p></div>;

  return (
    <section className="fade-in">
      <SectionHeader
        title="Learning Center & Glossary"
        description="Plain-English explainers for the dashboard's core macroeconomic concepts, with official methodology links for deeper reading."
        sourceLinks={SOURCE_LINKS}
      />
      {data.sections.map((section) => (
        <div key={section.id} className="learning-section">
          <h3>{section.title}</h3>
          <div className="learning-grid">
            {section.terms.map((term) => (
              <article key={term.term} className="learning-card card">
                <h4>{term.term}</h4>
                <p>{term.plainEnglish}</p>
                <div className="learning-card__read">
                  <strong>How to read it:</strong> {term.howToRead}
                </div>
                <a href={term.sourceUrl} target="_blank" rel="noreferrer">{term.officialSource} ↗</a>
              </article>
            ))}
          </div>
        </div>
      ))}
      <p className="insight-note">{data.methodologyNote}</p>
    </section>
  );
}

export function SourceTrustSection() {
  const { data, loading } = useData('data-freshness.json');
  const datasets = data?.datasets || [];
  const counts = datasets.reduce((acc, dataset) => {
    if (dataset.apiSeries?.length) acc.api += 1;
    else if (dataset.sourceFile) acc.files += 1;
    else acc.curated += 1;
    if (dataset.critical) acc.critical += 1;
    return acc;
  }, { api: 0, files: 0, curated: 0, critical: 0 });

  return (
    <section className="fade-in">
      <SectionHeader
        title="Source Confidence & Audit Trail"
        description="A trust layer that shows which datasets come from official APIs, official files, or manually curated official documents, plus freshness metadata."
        sourceLinks={SOURCE_LINKS}
      />
      {!loading && (
        <div className="trust-grid">
          <InsightCard title="Official APIs" value={counts.api} meta="machine-readable series" body="Fetched from SBP EasyData or other official APIs where available." source="Generated source manifest" tone="positive" />
          <InsightCard title="Official files" value={counts.files} meta="Excel/PDF source files" body="Parsed from official SBP/FBR/Finance Division files with source-file metadata." source="Generated source manifest" tone="positive" />
          <InsightCard title="Curated official documents" value={counts.curated} meta="event-driven datasets" body="Used only where no stable machine-readable feed exists; each card links to primary sources." source="Generated source manifest" tone="neutral" />
          <InsightCard title="Critical datasets" value={counts.critical} meta="freshness-monitored" body="Core indicators are checked by the audit script before build/deploy." source="Generated source manifest" tone="positive" />
        </div>
      )}
      <DataFreshnessPanel />
    </section>
  );
}
