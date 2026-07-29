import { Doughnut } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseDoughnutOptions } from '../utils/chartConfig';
import TrackerFooter from './ui/TrackerFooter';
import { LoadingCard, ErrorCard } from './ui/DataState';
import './ui/Trackers.css';
import useI18n from '../i18n/useI18n';

const fmtUsd = (v) => (v == null ? '—' : `$${v}B`);

export default function ExternalDebtTracker() {
  const { tx } = useI18n();
  const { data, loading, error, retry } = useData('external-debt.json');
  if (loading) return <LoadingCard label="Loading external debt tracker…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load external debt tracker" compact />;

  const { fy26, stock, repaymentSplit = [], fy27, riskNote, sourceUrl, lastVerified, verifiedFrom, methodologyNote } = data;

  const splitTotal = repaymentSplit.reduce((s, r) => s + r.value, 0);
  const chart = {
    labels: repaymentSplit.map((r) => r.label),
    datasets: [{
      data: repaymentSplit.map((r) => r.value),
      backgroundColor: repaymentSplit.map((r) => r.color),
      borderWidth: 0,
    }],
  };
  const chartOptions = {
    ...baseDoughnutOptions,
    plugins: {
      ...baseDoughnutOptions.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const share = splitTotal ? ((ctx.raw / splitTotal) * 100).toFixed(0) : '0';
            return `${ctx.label}: $${ctx.raw}B (${share}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="tracker card">
      <div className="tracker__header">
        <h3>🌐 External Debt Repayment Tracker</h3>
        <span className="tracker__badge">{fmtUsd(fy26?.grossRepayment)} due FY26</span>
      </div>
      <p className="tracker__subtitle">
        Pakistan's external debt servicing for the fiscal year, and how much depends on rollovers from friendly creditors versus hard cash. This is the single biggest source of pressure on foreign-exchange reserves.
      </p>

      <div className="tracker__stats">
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("FY26 gross repayment")}</span>
          <span className="tracker-stat__value">{fmtUsd(fy26?.grossRepayment)}</span>
          <span className="tracker-stat__sub">range ${fy26?.grossRange}B</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("Expected rollovers")}</span>
          <span className="tracker-stat__value" style={{ color: COLORS.purple }}>~{fmtUsd(fy26?.expectedRollovers)}</span>
          <span className="tracker-stat__sub">re-financed by creditors</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("Hard-cash outflow")}</span>
          <span className="tracker-stat__value" style={{ color: COLORS.coral }}>~{fmtUsd(fy26?.hardRepayment)}</span>
          <span className="tracker-stat__sub">${fy26?.interest}B interest + ${fy26?.principalNonRolled}B principal</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("Total external debt")}</span>
          <span className="tracker-stat__value">{fmtUsd(stock?.totalExternalDebtAndLiabilities)}</span>
          <span className="tracker-stat__sub">{stock?.asOf} · IMF {fmtUsd(stock?.imfOutstanding)}</span>
        </div>
      </div>

      {repaymentSplit.length > 0 && (
        <div className="tracker__chart">
          <Doughnut data={chart} options={chartOptions} />
        </div>
      )}

      {riskNote && <p className="tracker__callout">⚠️ {riskNote}</p>}

      {fy27 && (
        <div className="tracker__list">
          <h4>Looking ahead — {fy27.label}</h4>
          <ul><li>{fy27.note}</li></ul>
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
