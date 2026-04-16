import { Line, Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import {
  COLORS,
  COLOR_LIST,
  baseLineOptions,
  baseBarOptions,
  formatCurrency,
} from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';

function formatDate(dateStr) {
  const d = new Date(dateStr + '-01');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function TradeSection() {
  const { data, loading, error } = useData('trade.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { monthly, topExportCountries, topImportCountries } = data;

  const labels = monthly.map((d) => formatDate(d.date));
  const tickCallback = (_val, idx) => (idx % 3 === 0 ? labels[idx] : '');

  // --- Imports vs Exports Line ---
  const lineData = {
    labels,
    datasets: [
      {
        label: 'Imports',
        data: monthly.map((d) => d.imports),
        borderColor: COLORS.coral,
        backgroundColor: COLORS.coralAlpha,
        fill: true,
      },
      {
        label: 'Exports',
        data: monthly.map((d) => d.exports),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        fill: true,
      },
    ],
  };

  const lineOptions = {
    ...baseLineOptions,
    scales: {
      ...baseLineOptions.scales,
      x: { ...baseLineOptions.scales.x, ticks: { ...baseLineOptions.scales.x.ticks, callback: tickCallback } },
      y: { ...baseLineOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text } },
    },
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw * 1e6)}` },
      },
    },
  };

  // --- Trade Balance Bar ---
  const balanceColors = monthly.map((d) => (d.balance >= 0 ? COLORS.teal : COLORS.coral));

  const barData = {
    labels,
    datasets: [
      {
        label: 'Trade Balance',
        data: monthly.map((d) => d.balance),
        backgroundColor: balanceColors,
        borderColor: balanceColors,
        borderWidth: 1,
      },
    ],
  };

  const barOptions = {
    ...baseBarOptions,
    scales: {
      ...baseBarOptions.scales,
      x: { ...baseBarOptions.scales.x, ticks: { ...baseBarOptions.scales.x.ticks, callback: tickCallback } },
      y: {
        ...baseBarOptions.scales.y,
        beginAtZero: false,
        title: { display: true, text: 'USD Millions', color: COLORS.text },
      },
    },
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: {
        ...baseBarOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `Balance: ${formatCurrency(ctx.raw * 1e6)}` },
      },
    },
  };

  // --- Country horizontal bar chart options ---
  const countryBarOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: { ...baseBarOptions.plugins, legend: { display: false } },
    scales: {
      x: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text }, beginAtZero: true },
      y: { ...baseBarOptions.scales.x, grid: { display: false } },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Trade Overview"
        description="Pakistan's international trade performance showing monthly imports, exports, and trade balance. Pakistan typically runs a trade deficit, importing more than it exports. Trade data is a key indicator of external economic health and foreign exchange pressure."
      />

      <div className="section-grid">
        <ChartCard
          title="Imports vs Exports"
          description="Monthly trade flows in USD millions. The gap between imports (red) and exports (green) shows the trade deficit. Import compression in 2023 was due to government restrictions to preserve foreign exchange."
          source="PBS / SBP"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="Jan 2021 – Mar 2026"
        >
          <div className="chart-container">
            <Line data={lineData} options={lineOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="Trade Balance"
          description="Monthly trade surplus or deficit. Red bars indicate deficit months (imports exceeded exports). A narrowing deficit signals improving external balance."
          source="PBS / SBP"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="Jan 2021 – Mar 2026"
        >
          <div className="chart-container">
            <Bar data={barData} options={barOptions} />
          </div>
        </ChartCard>
      </div>

      {topExportCountries?.length > 0 && topImportCountries?.length > 0 && (
        <div className="section-grid" style={{ marginTop: '1.5rem' }}>
          <ChartCard
            title="Top Export Destinations"
            description="Top 15 countries by export receipts in Jul-Mar FY2026. Shows where Pakistan sends its goods."
            source="SBP"
            dataSource="SBP"
            lastUpdated="Apr 2026"
            dataCoverage="Jul-Mar FY2026"
          >
            <div className="chart-container tall">
              <Bar
                data={{
                  labels: topExportCountries.map((d) => `${d.flag} ${d.country}`),
                  datasets: [{
                    label: 'Exports (USD M)',
                    data: topExportCountries.map((d) => d.value),
                    backgroundColor: topExportCountries.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
                    borderRadius: 4,
                  }],
                }}
                options={countryBarOptions}
              />
            </div>
          </ChartCard>
          <ChartCard
            title="Top Import Sources"
            description="Top 15 countries by import payments in Jul-Mar FY2026. Shows where Pakistan buys its goods from."
            source="SBP"
            dataSource="SBP"
            lastUpdated="Apr 2026"
            dataCoverage="Jul-Mar FY2026"
          >
            <div className="chart-container tall">
              <Bar
                data={{
                  labels: topImportCountries.map((d) => `${d.flag} ${d.country}`),
                  datasets: [{
                    label: 'Imports (USD M)',
                    data: topImportCountries.map((d) => d.value),
                    backgroundColor: topImportCountries.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
                    borderRadius: 4,
                  }],
                }}
                options={countryBarOptions}
              />
            </div>
          </ChartCard>
        </div>
      )}
    </section>
  );
}
