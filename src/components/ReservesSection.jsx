import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import {
  COLORS,
  baseLineOptions,
  formatCurrency,
} from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function ReservesSection() {
  const { data, loading, error } = useData('reserves.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { weekly } = data;

  const labels = weekly.map((d) => formatDate(d.date));
  const tickCallback = (_val, idx) => (idx % 4 === 0 ? labels[idx] : '');

  const chartData = {
    labels,
    datasets: [
      {
        label: 'SBP Reserves',
        data: weekly.map((d) => d.sbp),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        fill: true,
        order: 2,
      },
      {
        label: 'Commercial Banks',
        data: weekly.map((d) => d.banks),
        borderColor: COLORS.blue,
        backgroundColor: COLORS.blueAlpha,
        fill: true,
        order: 1,
      },
    ],
  };

  const options = {
    ...baseLineOptions,
    scales: {
      x: {
        ...baseLineOptions.scales.x,
        stacked: true,
        ticks: { ...baseLineOptions.scales.x.ticks, callback: tickCallback },
      },
      y: {
        ...baseLineOptions.scales.y,
        stacked: true,
        title: { display: true, text: 'USD Millions', color: COLORS.text },
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

  return (
    <section className="fade-in">
      <SectionHeader
        title="Foreign Exchange Reserves"
        description="Pakistan's foreign currency reserves held by the State Bank and commercial banks. Adequate reserves (typically 3+ months of import cover) provide economic stability and exchange rate defense. Pakistan's reserves hit critically low levels in early 2023 before recovering with IMF program support."
      />
      <ChartCard
        title="Foreign Exchange Reserves"
        description="Stacked area showing SBP-held reserves (teal) and commercial bank reserves (blue). The total height represents combined reserves. Rising trend indicates improving external buffers; sharp declines signal balance of payments stress."
        source="State Bank of Pakistan"
        dataSource="SBP"
        lastUpdated="Apr 2026"
        dataCoverage="FY2021 – Apr 2026"
      >
        <div className="chart-container">
          <Line data={chartData} options={options} />
        </div>
      </ChartCard>
    </section>
  );
}
