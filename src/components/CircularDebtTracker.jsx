import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseBarOptions } from '../utils/chartConfig';
import TrackerFooter from './ui/TrackerFooter';
import './ui/Trackers.css';

function fmtPkr(bn) {
  if (bn == null) return '—';
  if (Math.abs(bn) >= 1000) return `₨${(bn / 1000).toFixed(2)} tn`;
  return `₨${bn.toLocaleString()} bn`;
}

export default function CircularDebtTracker() {
  const { data, loading, error } = useData('circular-debt.json');
  if (loading || !data || error) return null;

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
      <div className="tracker__header">
        <h3>⚡ Power Circular Debt Tracker</h3>
        <span className="tracker__badge">{fmtPkr(current?.stock)}</span>
      </div>
      <p className="tracker__subtitle">
        Circular debt is the unpaid stock cascading through the power supply chain — a core IMF structural benchmark. The stock is falling year-on-year, but fresh debt is still being added, so the IMF's "zero net addition" goal is under pressure.
      </p>

      <div className="tracker__stats">
        <div className="tracker-stat">
          <span className="tracker-stat__label">Current stock</span>
          <span className="tracker-stat__value">{fmtPkr(current?.stock)}</span>
          <span className="tracker-stat__sub">end-Apr 2026 · IMF est. {fmtPkr(current?.imfEstimate)}</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">Year-on-year</span>
          <span className="tracker-stat__value" style={{ color: COLORS.teal }}>{yoy?.changePct}%</span>
          <span className="tracker-stat__sub">from {fmtPkr(yoy?.priorStock)} (Apr 2025)</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">FYTD buildup</span>
          <span className="tracker-stat__value" style={{ color: COLORS.coral }}>+{fmtPkr(fytdBuildup?.value)}</span>
          <span className="tracker-stat__sub">vs +{fmtPkr(fytdBuildup?.priorValue)} a year earlier</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">Power + gas combined</span>
          <span className="tracker-stat__value">{fmtPkr(powerVsGas?.combined)}</span>
          <span className="tracker-stat__sub">incl. gas {fmtPkr(powerVsGas?.gas)}</span>
        </div>
      </div>

      {stockTrend.length > 1 && (
        <div className="tracker__chart">
          <Bar data={chart} options={chartOptions} />
        </div>
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
          <h4>Reform levers</h4>
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
