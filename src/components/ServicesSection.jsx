import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, baseBarOptions, baseDoughnutOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';

export default function ServicesSection() {
  const { data, loading, error } = useData('services.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { categories, itBreakdown, summary, comparison } = data;

  // Chart 1 — Service Categories by Credit (horizontal bar)
  const sortedCats = [...categories].sort((a, b) => b.credit - a.credit);
  const categoriesBarData = {
    labels: sortedCats.map((d) => d.name),
    datasets: [{
      label: 'Credit (USD M)',
      data: sortedCats.map((d) => d.credit),
      backgroundColor: sortedCats.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
      borderRadius: 4,
    }],
  };

  const categoriesBarOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: { ...baseBarOptions.plugins, legend: { display: false } },
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
  const compLabels = ['Total Services', 'IT & Telecom'];
  const comparisonBarData = {
    labels: compLabels,
    datasets: [
      {
        label: `Jul-Feb FY25`,
        data: [comparison.fy25.totalCredit, comparison.fy25.itCredit],
        backgroundColor: COLORS.blue,
        borderRadius: 4,
      },
      {
        label: `Jul-Feb FY26`,
        data: [comparison.fy26.totalCredit, comparison.fy26.itCredit],
        backgroundColor: COLORS.teal,
        borderRadius: 4,
      },
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
      {
        label: 'Credit (Exports)',
        data: topCatsForBalance.map((d) => d.credit),
        backgroundColor: COLORS.teal,
        borderRadius: 4,
      },
      {
        label: 'Debit (Imports)',
        data: topCatsForBalance.map((d) => Math.abs(d.debit)),
        backgroundColor: COLORS.coral,
        borderRadius: 4,
      },
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
        description="Pakistan's services trade classified by EBOPS (Extended Balance of Payments Services). IT & Telecom is the fastest-growing segment, with computer services (software consultancy, freelancing, and software exports) driving growth. Data from SBP's Balance of Payments detail tables."
      />

      <div className="section-grid">
        <ChartCard
          title="Service Categories (Exports)"
          description="Top service categories ranked by credit (export) value in Jul-Feb FY2026. IT & Telecom leads Pakistan's services exports, followed by Transport and Other Business services."
          source="SBP"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="Jul-Feb FY2026"
        >
          <div className="chart-container">
            <Bar data={categoriesBarData} options={categoriesBarOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="IT & Telecom Breakdown"
          description="Breakdown of IT & Telecom exports by sub-category. Computer services (including software consultancy, freelance IT, and software exports) are the dominant contributor."
          source="SBP"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="Jul-Feb FY2026"
        >
          <div className="chart-container">
            <Doughnut data={itDoughnutData} options={itDoughnutOptions} />
          </div>
        </ChartCard>
      </div>

      <div className="section-grid" style={{ marginTop: '1.5rem' }}>
        <ChartCard
          title="FY25 vs FY26 Comparison"
          description={`Year-over-year comparison of cumulative services exports (${comparison.period}). Shows growth in total services and IT & Telecom exports between fiscal years.`}
          source="SBP"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="Jul-Feb FY2025 vs FY2026"
        >
          <div className="chart-container">
            <Bar data={comparisonBarData} options={comparisonOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="Services Trade Balance"
          description="Credit (exports) vs Debit (imports) for top service categories. Categories where green exceeds red represent net services exports (surplus). Transport typically shows a deficit due to high shipping costs."
          source="SBP"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="Jul-Feb FY2026"
        >
          <div className="chart-container">
            <Bar data={balanceBarData} options={balanceBarOptions} />
          </div>
        </ChartCard>
      </div>

      {summary && (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>📊 Services Summary ({summary.period})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>${summary.totalServicesCredit}M</strong><br />Total Services Credit</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>${summary.totalServicesNet}M</strong><br />Total Services Net</div>
            <div><strong style={{ color: 'var(--accent-teal)' }}>${summary.itTelecomCredit}M</strong><br />IT & Telecom Credit</div>
            <div><strong style={{ color: 'var(--accent-teal)' }}>${summary.computerServicesCredit}M</strong><br />Computer Services Credit</div>
          </div>
        </div>
      )}
    </section>
  );
}
