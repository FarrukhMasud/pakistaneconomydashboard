import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseAreaOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';

export default function FiscalSection() {
  const { data, loading, error } = useData('fiscal.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <div className="card fade-in"><p>Error loading fiscal data: {error.message}</p></div>;

  const { annual } = data;
  const labels = annual.map((d) => d.year);

  const growthData = {
    labels,
    datasets: [
      {
        label: 'GDP Growth %',
        data: annual.map((d) => d.gdpGrowth),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        fill: true,
        pointRadius: 4,
      },
    ],
  };

  const growthOptions = {
    ...baseAreaOptions,
    plugins: {
      ...baseAreaOptions.plugins,
      legend: { display: false },
    },
    scales: {
      ...baseAreaOptions.scales,
      y: {
        ...baseAreaOptions.scales.y,
        title: { display: true, text: 'Growth %', color: COLORS.text },
      },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Fiscal Overview"
        description="GDP growth rate sourced from Pakistan Bureau of Statistics. This metric reflects the annual change in real economic output and is a key indicator of economic health."
      />

      <ChartCard
        title="GDP Growth Rate"
        description="Annual real GDP growth rate. Values below the zero line indicate economic contraction, as seen in FY2020 (COVID-19 pandemic) and FY2023 (political and economic crisis). Recovery since FY2024 reflects stabilization efforts."
        source="Ministry of Finance / SBP"
        dataSource="SBP / PBS"
        lastUpdated="Apr 2026"
        dataCoverage="FY2017 – FY2026"
      >
        <div className="chart-container">
          <Line data={growthData} options={growthOptions} />
        </div>
      </ChartCard>
    </section>
  );
}
