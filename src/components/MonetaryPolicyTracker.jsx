import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseLineOptions } from '../utils/chartConfig';
import TrackerFooter from './ui/TrackerFooter';
import './ui/Trackers.css';

function fmtMonth(dateStr, opts = { month: 'short', year: 'numeric' }) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 7 ? `${dateStr}-01T00:00:00` : `${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', opts);
}

export default function MonetaryPolicyTracker() {
  const { data, loading, error } = useData('monetary-policy.json');
  if (loading || !data || error) return null;

  const { currentRate, asOf, lastDecision, nextMeeting, context = {}, decisions = [], sourceUrl, lastVerified, verifiedFrom, methodologyNote } = data;

  const chart = {
    labels: decisions.map((d) => fmtMonth(d.date)),
    datasets: [{
      label: 'Policy rate (%)',
      data: decisions.map((d) => d.rate),
      borderColor: COLORS.blue,
      backgroundColor: COLORS.blueAlpha,
      borderWidth: 2,
      pointRadius: decisions.map((d) => (d.changeBps !== 0 ? 4 : 2)),
      pointBackgroundColor: decisions.map((d) => (d.changeBps < 0 ? COLORS.teal : d.changeBps > 0 ? COLORS.coral : COLORS.text)),
      tension: 0.1,
      fill: true,
      stepped: true,
    }],
  };
  const chartOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...baseLineOptions.plugins?.tooltip,
        callbacks: {
          label: (ctx) => {
            const d = decisions[ctx.dataIndex];
            const move = d.changeBps === 0 ? 'held' : `${d.changeBps > 0 ? '+' : ''}${d.changeBps} bps`;
            return `${d.rate}%  (${move})`;
          },
        },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      y: { ...baseLineOptions.scales.y, title: { display: true, text: '%', color: COLORS.text } },
    },
  };

  const recent = [...decisions].reverse().slice(0, 6);
  const actionWord = lastDecision?.action === 'cut' ? 'Cut' : lastDecision?.action === 'hike' ? 'Hiked' : 'Held';

  return (
    <div className="tracker card">
      <div className="tracker__header">
        <h3>🏛️ SBP Policy Rate Tracker</h3>
        <span className="tracker__badge">{currentRate}%</span>
      </div>
      <p className="tracker__subtitle">
        The State Bank of Pakistan's headline policy (target) rate — the main lever for taming inflation and defending the rupee. {context.easingNote}
      </p>

      <div className="tracker__stats">
        <div className="tracker-stat">
          <span className="tracker-stat__label">Current rate</span>
          <span className="tracker-stat__value">{currentRate}%</span>
          <span className="tracker-stat__sub">as of {fmtMonth(asOf, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">Real policy rate</span>
          <span className="tracker-stat__value" style={{ color: (context.realRate ?? 0) < 0 ? COLORS.coral : COLORS.teal }}>
            {context.realRate > 0 ? '+' : ''}{context.realRate}%
          </span>
          <span className="tracker-stat__sub">vs {context.inflationYoY}% CPI ({context.inflationPeriod})</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">Last decision</span>
          <span className="tracker-stat__value" style={{ color: lastDecision?.action === 'hike' ? COLORS.coral : lastDecision?.action === 'cut' ? COLORS.teal : COLORS.textPrimary }}>{actionWord}</span>
          <span className="tracker-stat__sub">{fmtMonth(lastDecision?.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">Cycle peak → trough</span>
          <span className="tracker-stat__value">{context.peak?.rate}% → {context.trough?.rate}%</span>
          <span className="tracker-stat__sub">{fmtMonth(context.peak?.date)} → {fmtMonth(context.trough?.date)}</span>
        </div>
      </div>

      {nextMeeting && (
        <div className="tracker__next">
          <div>
            <span className="tracker__next-label">Next MPC decision</span>
            <strong>{nextMeeting.dateText || fmtMonth(nextMeeting.date, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </div>
          <p>{nextMeeting.note}</p>
        </div>
      )}

      <div className="tracker__chart">
        <Line data={chart} options={chartOptions} />
      </div>

      <div className="tracker__decisions">
        {recent.map((d) => (
          <div key={d.date} className="tracker-decision">
            <span className="tracker-decision__date">{fmtMonth(d.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="tracker-decision__rate">{d.rate}%</span>
            <span className={`tracker-decision__chip tracker-decision__chip--${d.action}`}>
              {d.changeBps === 0 ? 'HOLD' : `${d.changeBps > 0 ? '+' : ''}${d.changeBps} bps`}
            </span>
            {d.note && <span className="tracker-decision__note">{d.note}</span>}
          </div>
        ))}
      </div>

      <TrackerFooter
        methodologyNote={methodologyNote}
        lastVerified={lastVerified}
        sourceUrl={sourceUrl}
        sourceLabel="SBP Monetary Policy"
        verifiedFrom={verifiedFrom}
      />
    </div>
  );
}
