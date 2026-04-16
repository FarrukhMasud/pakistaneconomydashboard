import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseLineOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';

function formatDate(dateStr) {
  const [y, m] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function ExchangeRateSection() {
  const { data, loading, error } = useData('exchange-rates.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <div className="card fade-in"><p>Error loading exchange rates: {error.message}</p></div>;

  const monthly = data.monthly;
  const labels = monthly.map((d) => formatDate(d.date));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'USD',
        data: monthly.map((d) => d.USD),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        yAxisID: 'y',
      },
      {
        label: 'EUR',
        data: monthly.map((d) => d.EUR),
        borderColor: COLORS.amber,
        backgroundColor: COLORS.amberAlpha,
        yAxisID: 'y',
      },
      {
        label: 'GBP',
        data: monthly.map((d) => d.GBP),
        borderColor: COLORS.coral,
        backgroundColor: COLORS.coralAlpha,
        yAxisID: 'y',
      },
      {
        label: 'CNY',
        data: monthly.map((d) => d.CNY),
        borderColor: COLORS.purple,
        backgroundColor: COLORS.purpleAlpha,
        borderDash: [5, 3],
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    ...baseLineOptions,
    scales: {
      x: {
        ...baseLineOptions.scales.x,
        ticks: { ...baseLineOptions.scales.x.ticks, maxTicksLimit: 12 },
      },
      y: {
        position: 'left',
        title: { display: true, text: 'PKR (USD/EUR/GBP)', color: COLORS.text },
        grid: { color: COLORS.grid, drawBorder: false },
        ticks: { color: COLORS.text },
      },
      y1: {
        position: 'right',
        title: { display: true, text: 'PKR (CNY)', color: COLORS.text },
        grid: { drawOnChartArea: false },
        ticks: { color: COLORS.text },
      },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Exchange Rates"
        description="Pakistani Rupee (PKR) exchange rates against major currencies. A rising line indicates the rupee is weakening (more PKR needed per unit of foreign currency). Exchange rate stability is crucial for import costs, debt servicing, and investor confidence."
      />
      <ChartCard
        title="Exchange Rates (PKR)"
        description="PKR per unit of foreign currency — USD, EUR, GBP on left axis; CNY on right axis (different scale). The sharp rise in 2022–2023 reflects significant rupee depreciation during the economic crisis. The dashed purple line shows the Chinese Yuan rate."
        source="State Bank of Pakistan"
        dataSource="SBP"
        lastUpdated="Apr 2026"
        dataCoverage="Jan 2021 – Mar 2026"
      >
        <div className="chart-container">
          <Line data={chartData} options={options} />
        </div>
      </ChartCard>
    </section>
  );
}
