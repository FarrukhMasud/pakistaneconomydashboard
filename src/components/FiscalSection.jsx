import { Line, Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseAreaOptions, baseBarOptions, baseLineOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import ImfTracker from './ImfTracker';
import CircularDebtTracker from './CircularDebtTracker';
import ExternalDebtTracker from './ExternalDebtTracker';
import { LoadingCard, SectionState } from './ui/DataState';
import { fmtPKR, fmtPct } from '../utils/periodHelpers';
import { fiscalYearEndDate, valuesByDate } from '../utils/chartTimeRange';

function formatTrillion(val) {
  return Number.isFinite(val) ? (val / 1e6).toFixed(1) + 'T' : '—';
}

export default function FiscalSection() {
  const state = useData('fiscal.json');
  const { data, loading } = state;

  if (loading) return <LoadingCard label="Loading fiscal data…" />;
  if (!data) return <><SectionState state={state} label="Could not load fiscal data" /><ImfTracker /><CircularDebtTracker /><ExternalDebtTracker /></>;

  const { annual = [], publicFinance, dataSource, lastUpdated, dataCoverage: fiscDC } = data;

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
  const hasPF = Object.values(pf).some((series) => series?.data?.length);

  let revenueExpLabels, revenueExpData, revenueExpOptions;
  let revenueBreakdownData, revenueBreakdownOptions;
  let balanceData, balanceOptions;

  if (hasPF) {
    const revData = pf.total_revenue?.data || [];
    const axes = (first, second) => [...new Set([...first, ...second].map((row) => row.fy))].sort();
    revenueExpLabels = axes(revData, pf.total_expenditure?.data || []);

    // Chart 2 — Revenue vs Expenditure
    revenueExpData = {
      labels: revenueExpLabels,
      datasets: [
        {
          label: 'Total Revenue',
          data: valuesByDate(revenueExpLabels, revData, 'value', 'fy'),
          evidenceRows: revenueExpLabels.map((fy) => revData.filter((row) => row.fy === fy)),
          borderColor: COLORS.teal,
          backgroundColor: COLORS.tealAlpha,
          fill: false,
          pointRadius: 3,
        },
        {
          label: 'Total Expenditure',
          data: valuesByDate(revenueExpLabels, pf.total_expenditure?.data || [], 'value', 'fy'),
          evidenceRows: revenueExpLabels.map((fy) => (pf.total_expenditure?.data || []).filter((row) => row.fy === fy)),
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
    const taxData = pf.tax_revenue?.data || [];
    const taxLabels = axes(taxData, pf.nontax_revenue?.data || []);
    revenueBreakdownData = {
      labels: taxLabels,
      datasets: [
        {
          label: 'Tax Revenue',
          data: valuesByDate(taxLabels, taxData, 'value', 'fy'),
          evidenceRows: taxLabels.map((fy) => taxData.filter((row) => row.fy === fy)),
          backgroundColor: COLORS.blue,
          borderRadius: 4,
        },
        {
          label: 'Non-Tax Revenue',
          data: valuesByDate(taxLabels, pf.nontax_revenue?.data || [], 'value', 'fy'),
          evidenceRows: taxLabels.map((fy) => (pf.nontax_revenue?.data || []).filter((row) => row.fy === fy)),
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
    const fiscalBal = pf.fiscal_balance?.data || [];
    const balanceLabels = axes(fiscalBal, pf.primary_balance?.data || []);
    const fiscalValues = valuesByDate(balanceLabels, fiscalBal, 'value', 'fy');
    balanceData = {
      labels: balanceLabels,
      datasets: [
        {
          label: 'Fiscal Balance',
          data: fiscalValues,
          evidenceRows: balanceLabels.map((fy) => fiscalBal.filter((row) => row.fy === fy)),
          backgroundColor: fiscalValues.map((value) => value == null ? COLORS.text : value < 0 ? COLORS.coral : COLORS.teal),
          borderRadius: 4,
        },
        {
          label: 'Primary Balance',
          data: valuesByDate(balanceLabels, pf.primary_balance?.data || [], 'value', 'fy'),
          evidenceRows: balanceLabels.map((fy) => (pf.primary_balance?.data || []).filter((row) => row.fy === fy)),
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

  const pfCoverage = pf.total_revenue?.data?.length
    ? `${pf.total_revenue.data[0].fy} – ${pf.total_revenue.data.at(-1).fy} (${pf.total_revenue.data.length} years)`
    : '';

  return (
    <section className="fade-in">
      <SectionHeader
        title="Fiscal Overview"
        datasetId="fiscal"
        description="Pakistan's fiscal health — GDP growth, government revenue, expenditure, and budget deficits. Pakistan's tax-to-GDP ratio is among the lowest in Asia, creating chronic revenue shortfalls, and the IMF program targets a positive primary balance (revenue minus non-interest spending) as a condition for continued support."
        noteKey="fiscal.revenueGap"
        sourceLinks={[
          { label: 'Ministry of Finance', url: 'https://www.finance.gov.pk' },
          { label: 'SBP GDP & Fiscal Data', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
          { label: 'SBP EasyData Portal', url: 'https://easydata.sbp.org.pk' },
        ]}
      />

      {/* Fiscal Summary Card */}
      {(() => {
        const latestGDP = annual[annual.length - 1];
        const gdpTrend = latestGDP?.gdpGrowth >= 0 ? 'up' : 'down';
        const items = latestGDP ? [
          { label: `GDP Growth (${latestGDP.year})`, value: fmtPct(latestGDP.gdpGrowth), row: latestGDP, period: latestGDP.year, direction: gdpTrend, sentiment: gdpTrend === 'up' ? 'positive' : 'negative', color: COLORS.teal },
        ] : [];
        if (hasPF) {
          const latestRev = pf.total_revenue?.data?.at(-1);
          const latestExp = pf.total_expenditure?.data?.at(-1);
          const latestFB = pf.fiscal_balance?.data?.at(-1);
          if (latestRev) items.push({ label: `Revenue (${latestRev.fy})`, value: fmtPKR(latestRev.value), color: COLORS.teal, row: latestRev, period: latestRev.fy });
          if (latestExp) items.push({ label: `Expenditure (${latestExp.fy})`, value: fmtPKR(latestExp.value), color: COLORS.coral, row: latestExp, period: latestExp.fy });
          if (latestFB) items.push({ label: `Fiscal Balance (${latestFB.fy})`, value: fmtPKR(latestFB.value), sentiment: latestFB.value >= 0 ? 'positive' : 'negative', color: latestFB.value >= 0 ? COLORS.teal : COLORS.coral, row: latestFB, period: latestFB.fy });
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
          evidenceRows={annual}
          observationDates={labels.map(fiscalYearEndDate)}
          description="Annual real GDP growth rate. Values below the zero line indicate economic contraction, as seen in FY2020 (COVID-19 pandemic) and FY2023 (political and economic crisis)."
          dataSource="SBP / PBS"
          lastUpdated={lastUpdated}
          dataCoverage={fiscDC || (annual.length ? `${annual[0].year} – ${annual.at(-1).year}` : undefined)}
          provenanceKeys={['fiscal.gdpGrowth.latest']}
        >
          <div style={{ height: 300 }}>
            <Line data={growthData} options={growthOptions} />
          </div>
        </ChartCard>

        {hasPF && (
          <ChartCard
            title="Revenue vs Expenditure"
            evidenceRows={[...(pf.total_revenue?.data || []), ...(pf.total_expenditure?.data || [])]}
            observationDates={revenueExpData.labels.map(fiscalYearEndDate)}
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
            evidenceRows={[...(pf.tax_revenue?.data || []), ...(pf.nontax_revenue?.data || [])]}
            observationDates={revenueBreakdownData.labels.map(fiscalYearEndDate)}
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
            evidenceRows={[...(pf.fiscal_balance?.data || []), ...(pf.primary_balance?.data || [])]}
            observationDates={balanceData.labels.map(fiscalYearEndDate)}
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

      <ImfTracker />
      <CircularDebtTracker />
      <ExternalDebtTracker />
    </section>
  );
}
