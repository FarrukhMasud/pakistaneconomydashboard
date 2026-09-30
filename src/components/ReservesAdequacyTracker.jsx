import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseLineOptions } from '../utils/chartConfig';
import TrackerFooter from './ui/TrackerFooter';
import { LoadingCard, ErrorCard, PublicationNotice } from './ui/DataState';
import FigureTrust from './FigureTrust';
import './ui/Trackers.css';
import useI18n from '../i18n/useI18n';
import ChartCard from './ChartCard';

export default function ReservesAdequacyTracker() {
  const { t, tx } = useI18n();
  const { data, loading, error, retry, unavailable, dependencyErrors } = useData('reserves-adequacy.json');
  if (loading) return <LoadingCard label="Loading reserves adequacy…" />;
  if (error || !data) return <ErrorCard error={error} unavailable={unavailable} onRetry={retry} label="Could not load reserves adequacy" compact />;

  const { current, benchmark, imfTarget, trajectory = [], drivers = [], context, sourceUrl, lastVerified, verifiedFrom, methodologyNote } = data;

  const chart = {
    labels: trajectory.map((p) => p.label),
    datasets: [
      {
        label: `${current?.importCoverLabel || 'Import cover'} (months)`,
        data: trajectory.map((p) => p.importCoverMonths),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        fill: true,
      },
      {
        label: benchmark?.months != null ? `${benchmark?.label || 'Benchmark'} (${benchmark.months} months)` : 'Benchmark unavailable',
        isComparison: true,
        data: trajectory.map(() => benchmark?.months),
        borderColor: COLORS.amber,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
    ],
  };
  const chartOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      legend: { display: true, position: 'bottom', labels: { color: COLORS.text, boxWidth: 12, font: { size: 10 } } },
      tooltip: {
        ...baseLineOptions.plugins?.tooltip,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}` },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      y: { ...baseLineOptions.scales.y, title: { display: true, text: 'Months of goods imports', color: COLORS.text }, beginAtZero: true },
    },
  };

  const meetsBenchmark = Number.isFinite(current?.importCoverMonths) && Number.isFinite(benchmark?.months)
    ? current.importCoverMonths >= benchmark.months : null;
  const usd = (value) => Number.isFinite(value) ? `$${value}B` : '—';

  return (
    <div className="tracker card">
      <PublicationNotice data={data} />
      {dependencyErrors.map((result) => <ErrorCard key={result.id} error={result.error} onRetry={retry} compact />)}
      <div className="tracker__header">
        <h3>🏦 Reserves Adequacy Tracker</h3>
        <span className="tracker__badge">{Number.isFinite(current?.importCoverMonths) ? `${current.importCoverMonths} months` : '—'}</span>
      </div>
      <p className="tracker__subtitle">
        How many months of goods imports Pakistan's SBP-held reserves can cover — one gauge of external resilience. {context}
      </p>

      <div className="tracker__stats">
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("SBP reserves")}</span>
          <span className="tracker-stat__value">{usd(current?.sbpReserves)}</span>
          <span className="tracker-stat__sub">total {usd(current?.totalReserves)} · {current?.asOf}</span>
          <FigureTrust datasetId="reserves-adequacy" data={data} row={current} period={current?.asOf} compact />
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{current?.importCoverLabel || 'Import cover'}</span>
          <span className="tracker-stat__value" style={{ color: meetsBenchmark == null ? COLORS.text : meetsBenchmark ? COLORS.teal : COLORS.amber }}>{Number.isFinite(current?.importCoverMonths) ? `${current.importCoverMonths} mo` : '—'}</span>
          {meetsBenchmark != null && <span className="tracker-stat__sub">{meetsBenchmark ? 'meets' : 'below'} {benchmark.months}-month benchmark</span>}
          <FigureTrust datasetId="reserves-adequacy" data={data} row={current} field="current.importCoverMonths" period={current?.asOf} derivation={current?.importCoverFormula || data.derivation} compact />
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("IMF reserves target")}</span>
          <span className="tracker-stat__value">{usd(imfTarget?.value)}</span>
          <span className="tracker-stat__sub">{imfTarget?.label || imfTarget?.asOf}</span>
          <FigureTrust datasetId="reserves-adequacy" data={data} row={imfTarget} field="imfTarget" period={imfTarget?.asOf || imfTarget?.label} compact />
        </div>
      </div>

      {trajectory.length > 1 && (
        <ChartCard
          datasetId="reserves-adequacy"
          evidenceRows={trajectory}
          chartId="chart-goods-import-cover-history"
          title={t('chart.importCoverHistory', 'Goods-import cover history')}
          observationDates={trajectory.map((point) => point.date)}
          dataSource="SBP"
          dataCoverage={current?.asOf}
          lastUpdated={lastVerified}
        >
          <div className="tracker__chart">
            <Line data={chart} options={chartOptions} />
          </div>
        </ChartCard>
      )}

      {drivers.length > 0 && (
        <div className="tracker__list">
          <h4>{tx("What's driving the rebuild")}</h4>
          <ul>{drivers.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      )}

      <TrackerFooter
        methodologyNote={methodologyNote}
        lastVerified={lastVerified}
        sourceUrl={sourceUrl}
        sourceLabel="SBP Economic Data"
        verifiedFrom={verifiedFrom}
      />
    </div>
  );
}
