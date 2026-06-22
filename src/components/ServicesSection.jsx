import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, baseBarOptions, baseDoughnutOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { pctChange, formatMonthYear } from '../utils/periodHelpers';

export default function ServicesSection() {
  const { data, loading, error } = useData('services.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { categories, itBreakdown, summary, comparison, recentMonths, itMonthly, monthlySeries } = data;

  // ── Monthly IT & Freelance exports (accumulating series + momentum snapshot) ──
  const mseries = monthlySeries || [];
  const monthlyItData = mseries.length ? {
    labels: mseries.map((m) => formatMonthYear(m.month)),
    datasets: [
      { label: 'IT & Telecom', data: mseries.map((m) => m.itCredit), backgroundColor: COLORS.teal, borderRadius: 4 },
      { label: 'Freelance IT', data: mseries.map((m) => m.freelanceCredit), backgroundColor: COLORS.amber, borderRadius: 4 },
    ],
  } : null;
  const monthlyItOptions = {
    ...baseBarOptions,
    plugins: { ...baseBarOptions.plugins },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions / month', color: COLORS.text } },
    },
  };
  const itMomentum = itMonthly ? itMonthly.components.filter((c) => c.latest != null).map((c) => {
    const yoy = c.yearAgo ? pctChange(c.latest, c.yearAgo) : { pct: null, direction: 'flat' };
    const fy = c.fytdPrior ? pctChange(c.fytd, c.fytdPrior) : { pct: null };
    const sub = [
      yoy.pct != null ? `${yoy.pct >= 0 ? '+' : ''}${yoy.pct}% YoY` : null,
      fy.pct != null ? `FYTD ${fy.pct >= 0 ? '+' : ''}${fy.pct}%` : null,
    ].filter(Boolean).join(' · ');
    return {
      label: c.name,
      value: `$${c.latest}M`,
      sub,
      direction: yoy.direction,
      sentiment: yoy.direction === 'up' ? 'positive' : yoy.direction === 'down' ? 'negative' : 'neutral',
      color: c.key === 'freelance' ? COLORS.amber : c.key === 'itTotal' ? COLORS.teal : undefined,
    };
  }) : [];

  // Chart 1 — Service Categories by Credit (horizontal bar) with YoY comparison
  const sortedCats = [...categories].sort((a, b) => b.credit - a.credit);
  const categoriesBarData = {
    labels: sortedCats.map((d) => d.name),
    datasets: [
      {
        label: comparison?.currentLabel || 'FY26',
        data: sortedCats.map((d) => d.credit),
        backgroundColor: sortedCats.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
        borderRadius: 4,
      },
    ],
  };
  // Add prior year comparison bars if available
  if (sortedCats.some(d => d.priorCredit > 0)) {
    categoriesBarData.datasets.push({
      label: comparison?.priorLabel || 'FY25',
      data: sortedCats.map((d) => d.priorCredit || 0),
      backgroundColor: sortedCats.map((_, i) => {
        const hex = COLOR_LIST[i % COLOR_LIST.length];
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},0.35)`;
      }),
      borderRadius: 4,
    });
  }

  const categoriesBarOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: { ...baseBarOptions.plugins },
    scales: {
      x: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text }, beginAtZero: true },
      y: { ...baseBarOptions.scales.x, grid: { display: false } },
    },
  };

  // Chart 2 — IT & Telecom Breakdown (doughnut)
  const itDoughnutData = {
    labels: itBreakdown.map((d) => d.name),
    datasets: [{
      data: itBreakdown.map((d) => d.credit),
      backgroundColor: COLOR_LIST.concat(COLOR_LIST).slice(0, itBreakdown.length),
      borderWidth: 0,
    }],
  };

  const itDoughnutOptions = {
    ...baseDoughnutOptions,
    plugins: {
      ...baseDoughnutOptions.plugins,
      tooltip: {
        ...baseDoughnutOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `${ctx.label}: $${ctx.raw}M` },
      },
    },
  };

  // Chart 3 — FY25 vs FY26 Comparison (grouped bar)
  const curLabel = comparison?.currentLabel || 'FY26';
  const priorLabel = comparison?.priorLabel || 'FY25';
  const compPeriod = comparison?.period || 'Jul-Feb';
  const comparisonBarData = {
    labels: ['Total Services', 'IT & Telecom'],
    datasets: [
      { label: `${compPeriod} ${priorLabel}`, data: [comparison.fy25.totalCredit, comparison.fy25.itCredit], backgroundColor: COLORS.blue, borderRadius: 4 },
      { label: `${compPeriod} ${curLabel}`, data: [comparison.fy26.totalCredit, comparison.fy26.itCredit], backgroundColor: COLORS.teal, borderRadius: 4 },
    ],
  };

  const comparisonOptions = {
    ...baseBarOptions,
    plugins: { ...baseBarOptions.plugins },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text } },
    },
  };

  // Chart 4 — Services Balance: Credit vs Debit (grouped horizontal bar)
  const topCatsForBalance = [...categories].sort((a, b) => (b.credit + Math.abs(b.debit)) - (a.credit + Math.abs(a.debit))).slice(0, 6);
  const balanceBarData = {
    labels: topCatsForBalance.map((d) => d.name),
    datasets: [
      { label: 'Credit (Exports)', data: topCatsForBalance.map((d) => d.credit), backgroundColor: COLORS.teal, borderRadius: 4 },
      { label: 'Debit (Imports)', data: topCatsForBalance.map((d) => Math.abs(d.debit)), backgroundColor: COLORS.coral, borderRadius: 4 },
    ],
  };

  const balanceBarOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: { ...baseBarOptions.plugins },
    scales: {
      x: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text }, beginAtZero: true },
      y: { ...baseBarOptions.scales.x, grid: { display: false } },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="IT & Services Exports"
        description="Pakistan's services trade classified by EBOPS (Extended Balance of Payments Services). IT & Telecom is the fastest-growing segment, with computer services (software consultancy, freelancing, and software exports) driving growth. This section includes a month-by-month view of IT and freelance exports with year-on-year momentum. Data from SBP's Balance of Payments detail tables."
        sourceLinks={[
          { label: 'SBP BOP Detail', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
          { label: 'PSEB', url: 'https://www.pseb.org.pk' },
        ]}
      />

      {summary && (() => {
        const totalGrowth = comparison ? pctChange(comparison.fy26.totalCredit, comparison.fy25.totalCredit) : null;
        const itGrowth = comparison ? pctChange(comparison.fy26.itCredit, comparison.fy25.itCredit) : null;
        return (
          <div className="summary-pair">
            <SummaryCard
              title={`${summary.period} — Services Summary`}
              accent={COLORS.teal}
              items={[
                { label: 'Total Services Credit', value: `$${summary.totalServicesCredit}M`, sub: totalGrowth ? `${totalGrowth.pct > 0 ? '+' : ''}${totalGrowth.pct}% YoY` : '', direction: totalGrowth?.direction, sentiment: totalGrowth?.direction === 'up' ? 'positive' : 'negative', color: COLORS.teal },
                { label: 'Services Net Balance', value: `$${summary.totalServicesNet}M`, sentiment: summary.totalServicesNet >= 0 ? 'positive' : 'negative', color: summary.totalServicesNet >= 0 ? COLORS.teal : COLORS.coral },
                { label: 'IT & Telecom Credit', value: `$${summary.itTelecomCredit}M`, sub: itGrowth ? `${itGrowth.pct > 0 ? '+' : ''}${itGrowth.pct}% YoY` : '', direction: itGrowth?.direction, sentiment: itGrowth?.direction === 'up' ? 'positive' : 'negative', color: COLORS.blue },
                { label: 'Computer Services', value: `$${summary.computerServicesCredit}M`, color: COLORS.amber },
              ]}
              footnote={`Source: SBP Balance of Payments · Last updated: ${data.lastUpdated || 'N/A'}`}
            />
            {recentMonths && recentMonths.length > 0 && (
              <SummaryCard
                title="Recent Monthly Performance"
                accent={COLORS.blue}
                items={recentMonths.map((m, i) => ({
                  label: m.month,
                  value: `$${m.totalCredit}M`,
                  sub: `IT: $${m.itCredit}M`,
                  color: i === 0 ? COLORS.blue : COLORS.purple,
                }))}
                footnote="Monthly services exports · Source: SBP"
              />
            )}
          </div>
        );
      })()}

      {itMonthly && (
        <div className="section-grid" style={{ marginTop: '1.5rem' }}>
          <ChartCard
            title="Monthly IT & Freelance Exports"
            description={`Monthly IT & Telecom and Freelance IT export earnings (US$ million), as SBP releases each month. ${mseries.length < 4 ? 'This series accumulates a new month with every SBP release and will lengthen into a fuller trend over time. ' : ''}Freelance IT is SBP's dedicated line for individual freelancer earnings repatriated through formal channels.`}
            source="SBP — EBOPS services detail"
            dataSource="SBP"
            lastUpdated={data.lastUpdated}
            dataCoverage={itMonthly.latestMonth ? `latest ${formatMonthYear(itMonthly.latestMonth)}` : data.dataCoverage}
          >
            <div className="chart-container">
              {monthlyItData && <Bar data={monthlyItData} options={monthlyItOptions} />}
            </div>
          </ChartCard>
          <SummaryCard
            title={`IT Exports — ${itMonthly.latestMonth ? formatMonthYear(itMonthly.latestMonth) : 'Latest month'} (vs a year ago)`}
            accent={COLORS.teal}
            items={itMomentum}
            footnote={`Latest-month export value with year-on-year change and fiscal-year-to-date growth (${itMonthly.fytdLabel} vs ${itMonthly.fytdPriorLabel}). Source: SBP EBOPS services detail.`}
          />
        </div>
      )}

      <div className="section-grid">
        <ChartCard
          title="Service Categories (Exports)"
          description={`Service categories ranked by credit (export) value, comparing ${curLabel} vs ${priorLabel}. IT & Telecom leads Pakistan's services exports.`}
          source="SBP"
          dataSource="SBP"
          lastUpdated={data.lastUpdated}
          dataCoverage={data.dataCoverage}
        >
          <div className="chart-container">
            <Bar data={categoriesBarData} options={categoriesBarOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="IT & Telecom Breakdown"
          description="Breakdown of IT & Telecom exports by sub-category. Computer services (software consultancy, freelance IT, software exports) are the dominant contributor."
          source="SBP"
          dataSource="SBP"
          lastUpdated={data.lastUpdated}
          dataCoverage={data.dataCoverage}
        >
          <div className="chart-container">
            <Doughnut data={itDoughnutData} options={itDoughnutOptions} />
          </div>
        </ChartCard>
      </div>

      <div className="section-grid" style={{ marginTop: '1.5rem' }}>
        <ChartCard
          title={`${priorLabel} vs ${curLabel} Comparison`}
          description={`Year-over-year comparison of cumulative services exports (${compPeriod}). Shows growth in total services and IT & Telecom exports.`}
          source="SBP"
          dataSource="SBP"
          lastUpdated={data.lastUpdated}
          dataCoverage={`${compPeriod} ${priorLabel} vs ${curLabel}`}
        >
          <div className="chart-container">
            <Bar data={comparisonBarData} options={comparisonOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="Services Trade Balance"
          description="Credit (exports) vs Debit (imports) for top service categories. Green exceeding red = surplus. Transport shows a deficit due to high shipping costs."
          source="SBP"
          dataSource="SBP"
          lastUpdated={data.lastUpdated}
          dataCoverage={data.dataCoverage}
        >
          <div className="chart-container">
            <Bar data={balanceBarData} options={balanceBarOptions} />
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
