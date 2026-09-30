import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseBarOptions } from '../utils/chartConfig';
import TrackerFooter from './ui/TrackerFooter';
import { LoadingCard, ErrorCard, PublicationNotice } from './ui/DataState';
import FigureTrust from './FigureTrust';
import './ui/Trackers.css';
import useI18n from '../i18n/useI18n';
import ChartCard from './ChartCard';

function fmtPkr(bn) {
  if (bn == null) return '—';
  if (Math.abs(bn) >= 1000) return `₨${(bn / 1000).toFixed(2)} tn`;
  return `₨${bn.toLocaleString()} bn`;
}

export default function CircularDebtTracker() {
  const { t, tx } = useI18n();
  const { data, loading, error, retry, unavailable } = useData('circular-debt.json');
  if (loading) return <LoadingCard label="Loading circular debt tracker…" />;
  if (error || !data) return <ErrorCard error={error} unavailable={unavailable} onRetry={retry} label="Could not load circular debt tracker" compact />;

  const { current, yoy, fytdBuildup, powerVsGas, stockTrend = [], targets = [], reforms = [], sourceUrl, lastVerified, verifiedFrom, methodologyNote } = data;

  const chart = {
    labels: stockTrend.map((p) => p.label),
    datasets: [{
      label: 'Circular debt stock',
      data: stockTrend.map((p) => p.value),
      backgroundColor: stockTrend.map((_, i) => (i === stockTrend.length - 1 ? COLORS.teal : COLORS.coral)),
      borderRadius: 4,
    }],
  };
  const chartOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
      tooltip: { ...baseBarOptions.plugins.tooltip, callbacks: { label: (ctx) => fmtPkr(ctx.raw) } },
    },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
  };

  return (
    <div className="tracker card">
      <PublicationNotice data={data} />
      <div className="tracker__header">
        <h3>⚡ Power Circular Debt Tracker</h3>
        <span className="tracker__badge">{fmtPkr(current?.stock)}</span>
      </div>
      <p className="tracker__subtitle">
        Circular debt is the unpaid stock cascading through the power supply chain. Stock, annual change and new additions are separate measures; unavailable figures are not inferred.
      </p>

      <div className="tracker__stats">
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("Current stock")}</span>
          <span className="tracker-stat__value">{fmtPkr(current?.stock)}</span>
          <span className="tracker-stat__sub">{current?.asOf}</span>
          <FigureTrust datasetId="circular-debt" data={data} row={current} period={current?.asOf} compact />
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("Year-on-year")}</span>
          <span className="tracker-stat__value">{Number.isFinite(yoy?.changePct) ? `${yoy.changePct}%` : '—'}</span>
          <span className="tracker-stat__sub">from {fmtPkr(yoy?.priorStock)} · {yoy?.priorAsOf}</span>
          <FigureTrust datasetId="circular-debt" data={data} row={yoy} period={current?.asOf} field="yoy" compact />
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{fytdBuildup?.period ? `Buildup · ${fytdBuildup.period}` : tx("FYTD buildup")}</span>
          <span className="tracker-stat__value">{fmtPkr(fytdBuildup?.value)}</span>
          <span className="tracker-stat__sub">vs {fmtPkr(fytdBuildup?.priorValue)} same period a year earlier</span>
          <FigureTrust datasetId="circular-debt" data={data} row={fytdBuildup} period={fytdBuildup?.period} field="fytdBuildup" compact />
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">Power + gas combined</span>
          <span className="tracker-stat__value">{fmtPkr(powerVsGas?.combined)}</span>
          <span className="tracker-stat__sub">incl. gas {fmtPkr(powerVsGas?.gas)}</span>
          <FigureTrust datasetId="circular-debt" data={data} row={powerVsGas} period={powerVsGas?.asOf} field="powerVsGas" compact />
        </div>
      </div>

      {stockTrend.length > 1 && (
        <ChartCard
          datasetId="circular-debt"
          evidenceRows={stockTrend}
          chartId="chart-power-circular-debt-stock"
          title={t('chart.circularDebtStock', 'Power circular debt stock')}
          rangeMode="comparison"
          dataSource="Power Division / IMF"
          dataCoverage={stockTrend.at(-1)?.label}
          lastUpdated={lastVerified}
        >
          <div className="tracker__chart">
            <Bar data={chart} options={chartOptions} />
          </div>
        </ChartCard>
      )}

      {targets.length > 0 && (
        <div className="tracker__targets">
          {targets.map((t) => (
            <div key={t.label} className={`tracker-target tracker-target--${t.status === 'at risk' ? 'risk' : t.status === 'met' ? 'met' : 'target'}`}>
              <span className="tracker-target__badge">{t.label}</span>
              <div className="tracker-target__body">
                <span className="tracker-target__title">{t.goal}{t.statusNote ? ` — ${t.statusNote}` : ''}</span>
                <span className="tracker-target__detail">{t.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {reforms.length > 0 && (
        <div className="tracker__list">
          <h4>{tx("Reform levers")}</h4>
          <ul>{reforms.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      <TrackerFooter
        methodologyNote={methodologyNote}
        lastVerified={lastVerified}
        sourceUrl={sourceUrl}
        sourceLabel="IMF Pakistan"
        verifiedFrom={verifiedFrom}
      />
    </div>
  );
}
