import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseLineOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { currentCalendarYear, currentFiscalYear, fmtPKR, fmtPct, formatMonthYear } from '../utils/periodHelpers';

const formatDate = formatMonthYear;

function formatTrillion(val) {
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + 'T';
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(0) + 'B';
  return val.toFixed(0) + 'M';
}

export default function MonetarySection() {
  const { data, loading, error } = useData('monetary.json');

  if (loading || !data)
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <span>Loading data…</span>
      </div>
    );
  if (error)
    return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { m2, m2_yoy, credit_private, credit_pvt_yoy, deposits, deposits_yoy, dataSource, lastUpdated } = data;

  const latestM2 = m2.data[m2.data.length - 1];
  const latestCredit = credit_private.data[credit_private.data.length - 1];
  const latestDeposits = deposits.data[deposits.data.length - 1];
  const latestM2Yoy = m2_yoy.data[m2_yoy.data.length - 1];
  const latestCreditYoy = credit_pvt_yoy.data[credit_pvt_yoy.data.length - 1];
  const latestDepYoy = deposits_yoy.data[deposits_yoy.data.length - 1];
  const cy = currentCalendarYear(m2.data);
  const fy = currentFiscalYear(m2.data);

  // Chart 1 — M2 Growth Rate (line)
  const m2Labels = m2_yoy.data.map((d) => formatDate(d.date));
  const m2GrowthData = {
    labels: m2Labels,
    datasets: [
      {
        label: 'M2 Growth YoY (%)',
        data: m2_yoy.data.map((d) => d.value),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        fill: true,
        pointRadius: 1,
      },
    ],
  };

  const m2GrowthOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `M2 Growth: ${ctx.parsed.y.toFixed(1)}%` },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      x: {
        ...baseLineOptions.scales.x,
        ticks: { ...baseLineOptions.scales.x.ticks, callback: (_v, idx) => (idx % 6 === 0 ? m2Labels[idx] : '') },
      },
      y: {
        ...baseLineOptions.scales.y,
        title: { display: true, text: 'YoY Growth (%)', color: COLORS.text },
        ticks: { ...baseLineOptions.scales.y?.ticks, callback: (v) => v.toFixed(0) + '%' },
      },
    },
  };

  // Chart 2 — Credit to Private Sector vs Deposits (dual axis)
  const creditLabels = credit_pvt_yoy.data.map((d) => formatDate(d.date));
  const creditDepositsData = {
    labels: creditLabels,
    datasets: [
      {
        label: 'Private Sector Credit YoY (%)',
        data: credit_pvt_yoy.data.map((d) => d.value),
        borderColor: COLORS.blue,
        backgroundColor: COLORS.blueAlpha,
        fill: false,
        pointRadius: 1,
      },
      {
        label: 'Deposits YoY Growth (%)',
        data: deposits_yoy.data.map((d) => d.value),
        borderColor: COLORS.amber,
        backgroundColor: COLORS.amberAlpha,
        fill: false,
        pointRadius: 1,
      },
    ],
  };

  const creditDepositsOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      x: {
        ...baseLineOptions.scales.x,
        ticks: { ...baseLineOptions.scales.x.ticks, callback: (_v, idx) => (idx % 6 === 0 ? creditLabels[idx] : '') },
      },
      y: {
        ...baseLineOptions.scales.y,
        title: { display: true, text: 'YoY Growth (%)', color: COLORS.text },
        ticks: { ...baseLineOptions.scales.y?.ticks, callback: (v) => v.toFixed(0) + '%' },
      },
    },
  };

  // Chart 3 — Broad Money (M2) absolute levels
  const m2AbsLabels = m2.data.map((d) => formatDate(d.date));
  const m2AbsData = {
    labels: m2AbsLabels,
    datasets: [
      {
        label: 'Broad Money M2',
        data: m2.data.map((d) => d.value),
        borderColor: COLORS.purple,
        backgroundColor: COLORS.purpleAlpha,
        fill: true,
        pointRadius: 1,
      },
      {
        label: 'Credit to Private Sector',
        data: credit_private.data.map((d) => d.value),
        borderColor: COLORS.blue,
        backgroundColor: COLORS.blueAlpha,
        fill: false,
        pointRadius: 1,
      },
      {
        label: 'Total Deposits',
        data: deposits.data.map((d) => d.value),
        borderColor: COLORS.amber,
        backgroundColor: COLORS.amberAlpha,
        fill: false,
        pointRadius: 1,
      },
    ],
  };

  const m2AbsOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: PKR ${formatTrillion(ctx.parsed.y)}` },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      x: {
        ...baseLineOptions.scales.x,
        ticks: { ...baseLineOptions.scales.x.ticks, callback: (_v, idx) => (idx % 6 === 0 ? m2AbsLabels[idx] : '') },
      },
      y: {
        ...baseLineOptions.scales.y,
        title: { display: true, text: 'PKR (Million)', color: COLORS.text },
        ticks: { ...baseLineOptions.scales.y?.ticks, callback: (v) => formatTrillion(v) },
      },
    },
  };

  const firstDate = formatDate(m2.data[0].date);
  const lastDate = formatDate(m2.data[m2.data.length - 1].date);

  return (
    <>
      <SectionHeader
        title="Monetary & Financial Sector"
        description="Key monetary aggregates tracked by SBP. M2 (broad money) growth that exceeds nominal GDP growth is typically inflationary. Credit to private sector reflects business investment demand — when government 'crowds out' private borrowing through heavy deficit financing, private sector growth suffers. The widening gap between M2 and credit is a classic indicator of government fiscal dominance over monetary policy."
        sourceLinks={[
          { label: 'SBP EasyData Portal', url: 'https://easydata.sbp.org.pk' },
          { label: 'SBP Monetary Data', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
        ]}
      />

      <div className="summary-pair">
        <SummaryCard
          title={cy ? `${cy.rangeLabel} — Calendar YTD` : 'Latest Monetary Indicators'}
          accent={COLORS.purple}
          items={[
            { label: 'Broad Money (M2)', value: fmtPKR(latestM2.value), sub: formatDate(latestM2.date), color: COLORS.purple },
            { label: 'M2 Growth', value: fmtPct(latestM2Yoy.value), sub: `YoY`, direction: latestM2Yoy.value > 0 ? 'up' : 'down', sentiment: 'neutral', color: COLORS.teal },
          ]}
          footnote={`Source: ${dataSource || 'SBP EasyData API'}`}
        />
        {fy && (
          <SummaryCard
            title={`${fy.fyLabel} (${fy.rangeLabel}) — Fiscal YTD`}
            accent={COLORS.blue}
            items={[
              { label: 'Private Credit', value: fmtPKR(latestCredit.value), sub: `${fmtPct(latestCreditYoy?.value)} YoY`, color: COLORS.blue },
              { label: 'Bank Deposits', value: fmtPKR(latestDeposits.value), sub: `${fmtPct(latestDepYoy?.value)} YoY`, color: COLORS.amber },
            ]}
            footnote={`${fy.months} month${fy.months > 1 ? 's' : ''} · Last updated: ${lastUpdated || 'N/A'}`}
          />
        )}
      </div>

      <div className="chart-grid">
        <ChartCard
          title="M2 Money Supply Growth"
          description="Year-over-year growth in broad money (M2). M2 includes currency in circulation, demand deposits, and time deposits. High M2 growth can be inflationary; SBP targets M2 growth consistent with GDP and inflation objectives."
          dataSource={dataSource}
          dataCoverage={`${firstDate} – ${lastDate} (${m2_yoy.data.length} months)`}
          lastUpdated={lastUpdated}
        >
          <div style={{ height: 300 }}>
            <Line data={m2GrowthData} options={m2GrowthOptions} />
          </div>
        </ChartCard>

        <ChartCard
          title="Credit & Deposit Growth"
          description="YoY growth rates for private sector credit and bank deposits. Rising credit growth signals economic expansion and business confidence. Deposit growth reflects savings mobilization and banking sector health."
          dataSource={dataSource}
          dataCoverage={`${firstDate} – ${lastDate} (${credit_pvt_yoy.data.length} months)`}
          lastUpdated={lastUpdated}
        >
          <div style={{ height: 300 }}>
            <Line data={creditDepositsData} options={creditDepositsOptions} />
          </div>
        </ChartCard>

        <ChartCard
          title="Monetary Aggregates"
          description="Absolute levels of M2, private sector credit, and total bank deposits in PKR. The growing gap between M2 and credit reflects government borrowing absorbing a large share of money supply."
          dataSource={dataSource}
          dataCoverage={`${firstDate} – ${lastDate} (${m2.data.length} months)`}
          lastUpdated={lastUpdated}
        >
          <div style={{ height: 320 }}>
            <Line data={m2AbsData} options={m2AbsOptions} />
          </div>
        </ChartCard>
      </div>
    </>
  );
}
