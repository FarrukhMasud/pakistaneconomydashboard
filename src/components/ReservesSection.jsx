import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import {
  COLORS,
  baseLineOptions,
  formatCurrency,
} from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { currentCalendarYear, currentFiscalYear, pctChange, fmtUSD } from '../utils/periodHelpers';

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Handle both YYYY-MM (monthly) and YYYY-MM-DD (weekly) formats
  if (dateStr.length <= 7) {
    const d = new Date(dateStr + '-01');
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function ReservesSection() {
  const { data, loading, error } = useData('reserves.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const timeSeries = data.weekly || data.monthly || [];
  const { dataSource, lastUpdated, dataCoverage } = data;

  const labels = timeSeries.map((d) => formatDate(d.date));
  const tickInterval = Math.max(1, Math.floor(timeSeries.length / 12));
  const tickCallback = (_val, idx) => (idx % tickInterval === 0 ? labels[idx] : '');

  const chartData = {
    labels,
    datasets: [
      {
        label: 'SBP Reserves (USD M)',
        data: timeSeries.map((d) => d.sbp),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        fill: true,
        pointRadius: 1,
        pointHoverRadius: 5,
      },
      {
        label: 'Total (SBP + Banks)',
        data: timeSeries.map((d) => d.total),
        borderColor: COLORS.blue,
        backgroundColor: 'transparent',
        borderDash: [5, 3],
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  const options = {
    ...baseLineOptions,
    scales: {
      x: {
        ...baseLineOptions.scales.x,
        ticks: { ...baseLineOptions.scales.x.ticks, callback: tickCallback },
      },
      y: {
        ...baseLineOptions.scales.y,
        title: { display: true, text: 'USD Millions', color: COLORS.text },
        ticks: {
          ...baseLineOptions.scales.y?.ticks,
          callback: (v) => '$' + (v / 1000).toFixed(0) + 'B',
        },
      },
    },
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw * 1e6)}`,
        },
      },
    },
  };

  const latest = timeSeries[timeSeries.length - 1];
  const lowest = timeSeries.reduce((min, d) => d.sbp < min.sbp ? d : min, timeSeries[0]);
  const cy = currentCalendarYear(timeSeries);
  const fy = currentFiscalYear(timeSeries);

  // Import cover estimate (rough: latest monthly imports ~$5-6B)
  const importCoverMonths = latest ? Math.round((latest.total / 5500) * 10) / 10 : null;

  // Build summary items for CY
  const cyItems = [];
  if (cy) {
    const startVal = cy.rows[0]?.sbp;
    const endVal = cy.rows[cy.rows.length - 1]?.sbp;
    const chg = pctChange(endVal, startVal);
    cyItems.push(
      { label: 'SBP Reserves', value: fmtUSD(latest.sbp), sub: formatDate(latest.date), color: COLORS.teal },
      { label: 'Total (SBP + Banks)', value: fmtUSD(latest.total), sub: importCoverMonths ? `≈ ${importCoverMonths} months import cover` : '', color: COLORS.blue },
      { label: 'CY Change', value: `${(endVal - startVal) >= 0 ? '+' : ''}${fmtUSD(endVal - startVal)}`, direction: chg.direction, sentiment: chg.direction === 'up' ? 'positive' : 'negative', sub: `${chg.pct > 0 ? '+' : ''}${chg.pct}%` },
    );
  }

  // Build summary items for FY
  const fyItems = [];
  if (fy && fy.rows.length > 0) {
    const fyStart = fy.rows[0]?.sbp;
    const fyEnd = fy.rows[fy.rows.length - 1]?.sbp;
    const fyChg = pctChange(fyEnd, fyStart);
    fyItems.push(
      { label: `Start of ${fy.fyLabel}`, value: fmtUSD(fyStart), sub: formatDate(fy.rows[0].date), color: COLORS.blue },
      { label: 'FYTD Change', value: `${(fyEnd - fyStart) >= 0 ? '+' : ''}${fmtUSD(fyEnd - fyStart)}`, direction: fyChg.direction, sentiment: fyChg.direction === 'up' ? 'positive' : 'negative', sub: `${fyChg.pct > 0 ? '+' : ''}${fyChg.pct}%` },
      { label: 'Lowest in Period', value: fmtUSD(lowest.sbp), sub: formatDate(lowest.date), color: COLORS.coral },
    );
  }

  return (
    <section className="fade-in">
      <SectionHeader
        title="Foreign Exchange Reserves"
        description="Pakistan's foreign currency reserves held by the State Bank of Pakistan and commercial banks. Adequate reserves (3+ months of import cover, or roughly $18–20B at current import levels) provide a buffer for exchange rate stability and debt repayments. Reserves hit critically low levels (~$3B SBP) in early 2023 before recovering under the IMF Extended Fund Facility."
        sourceLinks={[
          { label: 'SBP Reserves', url: 'https://www.sbp.org.pk/ecodata/forex.pdf' },
          { label: 'SBP EasyData', url: 'https://easydata.sbp.org.pk/apex/f?p=10:301' },
        ]}
      />

      {(cyItems.length > 0 || fyItems.length > 0) && (
        <div className="summary-pair">
          {cyItems.length > 0 && (
            <SummaryCard
              title={`${cy.rangeLabel} — Calendar YTD`}
              accent={COLORS.teal}
              items={cyItems}
              footnote={`${cy.months} data points · Source: ${dataSource || 'SBP'}`}
            />
          )}
          {fyItems.length > 0 && (
            <SummaryCard
              title={`${fy.fyLabel} (${fy.rangeLabel}) — Fiscal YTD`}
              accent={COLORS.blue}
              items={fyItems}
              footnote={`${fy.months} data points · ${dataCoverage || 'Available period'}`}
            />
          )}
        </div>
      )}

      <ChartCard
        title="Foreign Exchange Reserves"
        description="SBP gross reserves (solid) and total reserves including commercial banks (dashed). The sharp decline in 2022–23 reflects the balance of payments crisis when Pakistan's import cover fell below 1 month. Recovery since mid-2023 is supported by the $3B IMF Extended Fund Facility, bilateral rollovers, and improved current account."
        dataSource={dataSource}
        lastUpdated={lastUpdated}
        dataCoverage={dataCoverage}
      >
        <div style={{ height: 350 }}>
          <Line data={chartData} options={options} />
        </div>
      </ChartCard>
    </section>
  );
}
