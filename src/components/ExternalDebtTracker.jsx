import { Doughnut } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseDoughnutOptions } from '../utils/chartConfig';
import TrackerFooter from './ui/TrackerFooter';
import { LoadingCard, ErrorCard, PublicationNotice, UnavailableCard } from './ui/DataState';
import FigureTrust from './FigureTrust';
import { finiteSum } from '../utils/figureTrust';
import './ui/Trackers.css';
import useI18n from '../i18n/useI18n';
import ChartCard from './ChartCard';

const fmtUsd = (v) => (v == null ? '—' : `$${v}B`);

export default function ExternalDebtTracker() {
  const { t, tx } = useI18n();
  const { data, loading, error, retry, unavailable } = useData('external-debt.json');
  if (loading) return <LoadingCard label="Loading external debt tracker…" />;
  if (error || !data) return <ErrorCard error={error} unavailable={unavailable} onRetry={retry} label="Could not load external debt tracker" compact />;

  const { fy26, stock, repaymentSplit = [], fy27, riskNote, sourceUrl, lastVerified, verifiedFrom, methodologyNote } = data;
  const stockSourceLabel = stock?.sourceLabel || t('source.sbp', 'State Bank of Pakistan');

  const splitTotal = finiteSum(repaymentSplit.map((r) => r.value));
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
            const share = Number.isFinite(ctx.raw) && splitTotal > 0 ? ((ctx.raw / splitTotal) * 100).toFixed(0) : '—';
            return `${ctx.label}: $${ctx.raw}B (${share}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="tracker card">
      <PublicationNotice data={data} />
      <FigureTrust datasetId="external-debt" data={data} row={stock} period={stock?.asOf} />
      <div className="tracker__header">
        <h3>🌐 External Debt Repayment Tracker</h3>
        {Number.isFinite(fy26?.grossRepayment) && <span className="tracker__badge">{fmtUsd(fy26.grossRepayment)} · {fy26.label}</span>}
      </div>
      <p className="tracker__subtitle">
        Pakistan's external debt servicing for the fiscal year, and how much depends on rollovers from friendly creditors versus hard cash. This is the single biggest source of pressure on foreign-exchange reserves.
      </p>

      {!Number.isFinite(fy26?.grossRepayment) && <UnavailableCard reason={data.publication?.reason} sourceUrl={sourceUrl} compact />}
      <div className="tracker__stats">
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("FY26 gross repayment")}</span>
          <span className="tracker-stat__value">{fmtUsd(fy26?.grossRepayment)}</span>
          {fy26?.grossRange && <span className="tracker-stat__sub">range ${fy26.grossRange}B</span>}
          <FigureTrust datasetId="external-debt" data={data} row={fy26} period={fy26?.label} field="fy26.grossRepayment" compact />
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("Expected rollovers")}</span>
          <span className="tracker-stat__value" style={{ color: COLORS.purple }}>{fmtUsd(fy26?.expectedRollovers)}</span>
          <FigureTrust datasetId="external-debt" data={data} row={fy26} field="fy26.expectedRollovers" period={fy26?.label} compact />
          <span className="tracker-stat__sub">re-financed by creditors</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("Hard-cash outflow")}</span>
          <span className="tracker-stat__value" style={{ color: COLORS.coral }}>{fmtUsd(fy26?.hardRepayment)}</span>
          {Number.isFinite(fy26?.interest) && Number.isFinite(fy26?.principalNonRolled) && <span className="tracker-stat__sub">${fy26.interest}B interest + ${fy26.principalNonRolled}B principal</span>}
          <FigureTrust datasetId="external-debt" data={data} row={fy26} field="fy26.hardRepayment" period={fy26?.label} compact />
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat__label">{tx("Total external debt")}</span>
          <span className="tracker-stat__value">{fmtUsd(stock?.totalExternalDebtAndLiabilities)}</span>
          <span className="tracker-stat__sub">{stock?.asOf} · IMF {fmtUsd(stock?.imfOutstanding)}</span>
          <FigureTrust datasetId="external-debt" data={data} row={stock} period={stock?.asOf} compact />
        </div>
      </div>

      {repaymentSplit.length > 0 && (
        <ChartCard
          datasetId="external-debt"
          evidenceRows={repaymentSplit}
          chartId="chart-external-debt-repayment-split"
          title={t('chart.debtRepaymentSplit', 'External debt repayment split')}
          dataSource={repaymentSplit[0]?.sourceLabel || t('trust.originalSource', 'Original source')}
          dataCoverage={fy26?.label}
          lastUpdated={lastVerified}
        >
          <div className="tracker__chart">
            <Doughnut data={chart} options={chartOptions} />
          </div>
        </ChartCard>
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
        sourceLabel={stockSourceLabel}
        verifiedFrom={verifiedFrom}
      />
    </div>
  );
}
