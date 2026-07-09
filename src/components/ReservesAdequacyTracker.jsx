import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseLineOptions } from '../utils/chartConfig';
import TrackerFooter from './ui/TrackerFooter';
import './ui/Trackers.css';

export default function ReservesAdequacyTracker() {
  const { data, loading, error } = useData('reserves-adequacy.json');
  if (loading || !data || error) return null;

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
        label: `${benchmark?.label || 'Benchmark'} (${benchmark?.months} months)`,
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

  const meetsBenchmark = (current?.importCoverMonths ?? 0) >= (benchmark?.months ?? 3);

  return (
    <div className="tracker card">
      <div className="tracker__header">
        <h3>🏦 Reserves Adequacy Tracker</h3>
        <span className="tracker__badge">~{current?.importCoverMonths} months</span>
      </div>
      <p className="tracker__subtitle">
        How many months of goods imports Pakistan's SBP-held reserves can cover — one gauge of external resilience. {context}
      </p>

      <div className="tracker__stats">
        <div className="tracker-stat">
          <span className="tracker-stat__label">SBP reserves</span>
          <span className="tracker-stat__value">${current?.sbpReserves}B</span>
          <span className="tracker-stat__sub">total ${current?.totalReserves}B · {current?.asOf}</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{current?.importCoverLabel || 'Import cover'}</span>
          <span className="tracker-stat__value" style={{ color: meetsBenchmark ? COLORS.teal : COLORS.amber }}>~{current?.importCoverMonths} mo</span>
          <span className="tracker-stat__sub">{meetsBenchmark ? 'meets' : 'below'} common 3-month rule</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">IMF reserves target</span>
          <span className="tracker-stat__value" style={{ color: COLORS.teal }}>${imfTarget?.value}B ✓</span>
          <span className="tracker-stat__sub">end-FY25 target — exceeded</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">vs early 2023</span>
          <span className="tracker-stat__value">~2 wks → ~3 mo</span>
          <span className="tracker-stat__sub">major external-buffer rebuild</span>
        </div>
      </div>

      {trajectory.length > 1 && (
        <div className="tracker__chart">
          <Line data={chart} options={chartOptions} />
        </div>
      )}

      {drivers.length > 0 && (
        <div className="tracker__list">
          <h4>What's driving the rebuild</h4>
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
