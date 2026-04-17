import { Line, Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseAreaOptions, baseBarOptions, baseLineOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { pctChange, fmtPKR, fmtPct } from '../utils/periodHelpers';

function formatTrillion(val) {
  return (val / 1e6).toFixed(1) + 'T';
}

export default function FiscalSection() {
  const { data, loading, error } = useData('fiscal.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <div className="card fade-in"><p>Error loading fiscal data: {error.message}</p></div>;

  const { annual, publicFinance, dataSource, lastUpdated, dataCoverage: fiscDC } = data;

  // Chart 1 — GDP Growth Rate
  const labels = annual.map((d) => d.year);
  const growthData = {
    labels,
    datasets: [{
      label: 'GDP Growth %',
      data: annual.map((d) => d.gdpGrowth),
      borderColor: COLORS.teal,
      backgroundColor: COLORS.tealAlpha,
      fill: true,
      pointRadius: 4,
    }],
  };

  const growthOptions = {
    ...baseAreaOptions,
    plugins: { ...baseAreaOptions.plugins, legend: { display: false } },
    scales: {
      ...baseAreaOptions.scales,
      y: { ...baseAreaOptions.scales.y, title: { display: true, text: 'Growth %', color: COLORS.text } },
    },
  };

  // Public finance charts (if available)
  const pf = publicFinance || {};
  const hasPF = pf.total_revenue && pf.total_revenue.data?.length > 0;

  let revenueExpLabels, revenueExpData, revenueExpOptions;
  let revenueBreakdownData, revenueBreakdownOptions;
  let balanceData, balanceOptions;

  if (hasPF) {
    // Use last 10 years for cleaner charts
    const revData = pf.total_revenue.data.slice(-10);
    const expData = pf.total_expenditure.data.slice(-10);
    revenueExpLabels = revData.map((d) => d.fy);

    // Chart 2 — Revenue vs Expenditure
    revenueExpData = {
      labels: revenueExpLabels,
      datasets: [
        {
          label: 'Total Revenue',
          data: revData.map((d) => d.value),
          borderColor: COLORS.teal,
          backgroundColor: COLORS.tealAlpha,
          fill: false,
          pointRadius: 3,
        },
        {
          label: 'Total Expenditure',
          data: expData.map((d) => d.value),
          borderColor: COLORS.coral,
          backgroundColor: COLORS.coralAlpha,
          fill: false,
          pointRadius: 3,
        },
      ],
    };

    revenueExpOptions = {
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
        y: {
          ...baseLineOptions.scales.y,
          title: { display: true, text: 'PKR (Million)', color: COLORS.text },
          ticks: { ...baseLineOptions.scales.y?.ticks, callback: (v) => formatTrillion(v) },
        },
      },
    };

    // Chart 3 — Revenue Breakdown (Tax vs Non-Tax)
    const taxData = pf.tax_revenue.data.slice(-10);
    const nonTaxData = pf.nontax_revenue.data.slice(-10);
    revenueBreakdownData = {
      labels: taxData.map((d) => d.fy),
      datasets: [
        {
          label: 'Tax Revenue',
          data: taxData.map((d) => d.value),
          backgroundColor: COLORS.blue,
          borderRadius: 4,
        },
        {
          label: 'Non-Tax Revenue',
          data: nonTaxData.map((d) => d.value),
          backgroundColor: COLORS.amber,
          borderRadius: 4,
        },
      ],
    };

    revenueBreakdownOptions = {
      ...baseBarOptions,
      plugins: {
        ...baseBarOptions.plugins,
        tooltip: {
          ...baseBarOptions.plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: PKR ${formatTrillion(ctx.parsed.y)}` },
        },
      },
      scales: {
        ...baseBarOptions.scales,
        x: { ...baseBarOptions.scales.x, stacked: true },
        y: {
          ...baseBarOptions.scales.y,
          stacked: true,
          title: { display: true, text: 'PKR (Million)', color: COLORS.text },
          ticks: { ...baseBarOptions.scales.y?.ticks, callback: (v) => formatTrillion(v) },
        },
      },
    };

    // Chart 4 — Fiscal & Primary Balance
    const fiscalBal = pf.fiscal_balance.data.slice(-10);
    const primaryBal = pf.primary_balance.data.slice(-10);
    balanceData = {
      labels: fiscalBal.map((d) => d.fy),
      datasets: [
        {
          label: 'Fiscal Balance',
          data: fiscalBal.map((d) => d.value),
          backgroundColor: fiscalBal.map((d) => d.value < 0 ? COLORS.coral : COLORS.teal),
          borderRadius: 4,
        },
        {
          label: 'Primary Balance',
          data: primaryBal.map((d) => d.value),
          borderColor: COLORS.purple,
          backgroundColor: COLORS.purpleAlpha,
          type: 'line',
          fill: false,
          pointRadius: 3,
          order: 0,
        },
      ],
    };

    balanceOptions = {
      ...baseBarOptions,
      plugins: {
        ...baseBarOptions.plugins,
        tooltip: {
          ...baseBarOptions.plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: PKR ${formatTrillion(ctx.parsed.y)}` },
        },
      },
      scales: {
        ...baseBarOptions.scales,
        y: {
          ...baseBarOptions.scales.y,
          title: { display: true, text: 'PKR (Million)', color: COLORS.text },
          ticks: { ...baseBarOptions.scales.y?.ticks, callback: (v) => formatTrillion(v) },
          beginAtZero: false,
        },
      },
    };
  }

  const pfCoverage = hasPF
    ? `${pf.total_revenue.data[0].fy} – ${pf.total_revenue.data.at(-1).fy} (${pf.total_revenue.data.length} years)`
    : '';

  return (
    <section className="fade-in">
      <SectionHeader
        title="Fiscal Overview"
        description="Pakistan's fiscal health — GDP growth, government revenue, expenditure, and budget deficits. Pakistan's tax-to-GDP ratio (~10%) is among the lowest in Asia, creating chronic revenue shortfalls. About 35–40% of revenue goes to debt servicing. The IMF program targets a positive primary balance (revenue minus non-interest spending) as a condition for continued support. All fiscal figures are for Pakistan's fiscal year (July–June)."
      />

      {/* Fiscal Summary Card */}
      {(() => {
        const latestGDP = annual[annual.length - 1];
        const prevGDP = annual.length >= 2 ? annual[annual.length - 2] : null;
        const gdpTrend = latestGDP.gdpGrowth >= 0 ? 'up' : 'down';
        const items = [
          { label: `GDP Growth (${latestGDP.year})`, value: fmtPct(latestGDP.gdpGrowth), direction: gdpTrend, sentiment: gdpTrend === 'up' ? 'positive' : 'negative', color: COLORS.teal },
        ];
        if (hasPF) {
          const latestRev = pf.total_revenue.data.at(-1);
          const latestExp = pf.total_expenditure.data.at(-1);
          const latestFB = pf.fiscal_balance.data.at(-1);
          if (latestRev) items.push({ label: `Revenue (${latestRev.fy})`, value: fmtPKR(latestRev.value), color: COLORS.teal });
          if (latestExp) items.push({ label: `Expenditure (${latestExp.fy})`, value: fmtPKR(latestExp.value), color: COLORS.coral });
          if (latestFB) items.push({ label: `Fiscal Balance (${latestFB.fy})`, value: fmtPKR(latestFB.value), sentiment: latestFB.value >= 0 ? 'positive' : 'negative', color: latestFB.value >= 0 ? COLORS.teal : COLORS.coral });
        }
        return (
          <SummaryCard
            title="Fiscal Summary — Latest Available"
            accent={COLORS.teal}
            items={items}
            footnote={`Source: ${dataSource || 'SBP / PBS'} · Note: GDP and public finance may cover different fiscal years`}
          />
        );
      })()}

      <div className="chart-grid">
        <ChartCard
          title="GDP Growth Rate"
          description="Annual real GDP growth rate. Values below the zero line indicate economic contraction, as seen in FY2020 (COVID-19 pandemic) and FY2023 (political and economic crisis)."
          dataSource="SBP / PBS"
          lastUpdated={lastUpdated}
          dataCoverage={fiscDC || `${annual[0]?.year} – ${annual[annual.length-1]?.year}`}
        >
          <div style={{ height: 300 }}>
            <Line data={growthData} options={growthOptions} />
          </div>
        </ChartCard>

        {hasPF && (
          <ChartCard
            title="Revenue vs Expenditure"
            description="Total government revenue vs total expenditure. The persistent gap between the two lines represents the fiscal deficit — a structural challenge Pakistan has faced for decades."
            dataSource={dataSource}
            lastUpdated={lastUpdated}
            dataCoverage={pfCoverage}
          >
            <div style={{ height: 300 }}>
              <Line data={revenueExpData} options={revenueExpOptions} />
            </div>
          </ChartCard>
        )}

        {hasPF && (
          <ChartCard
            title="Revenue Breakdown — Tax vs Non-Tax"
            description="Stacked composition of government revenue. Tax revenue (FBR collections) is the backbone of fiscal capacity. Non-tax revenue includes dividends, profits, and grants."
            dataSource={dataSource}
            lastUpdated={lastUpdated}
            dataCoverage={pfCoverage}
          >
            <div style={{ height: 300 }}>
              <Bar data={revenueBreakdownData} options={revenueBreakdownOptions} />
            </div>
          </ChartCard>
        )}

        {hasPF && (
          <ChartCard
            title="Fiscal & Primary Balance"
            description="Fiscal balance (revenue minus total expenditure) and primary balance (fiscal balance excluding interest payments). A positive primary balance indicates the government can service debt from current revenue — a key IMF reform target."
            dataSource={dataSource}
            lastUpdated={lastUpdated}
            dataCoverage={pfCoverage}
          >
            <div style={{ height: 300 }}>
              <Bar data={balanceData} options={balanceOptions} />
            </div>
          </ChartCard>
        )}
      </div>
    </section>
  );
}
