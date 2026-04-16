import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, baseBarOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';

function formatDate(dateStr) {
  const [y, m] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function RemittancesSection() {
  const { data, loading, error } = useData('remittances.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <div className="card fade-in"><p>Error loading remittances: {error.message}</p></div>;

  const { monthly, sourceCountries } = data;

  // Chart 1 — Monthly total remittances (vertical bar)
  const monthlyData = {
    labels: monthly.map((d) => formatDate(d.date)),
    datasets: [
      {
        label: 'Total Remittances',
        data: monthly.map((d) => d.total),
        backgroundColor: COLORS.teal,
        borderColor: COLORS.teal,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const monthlyOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
    },
    scales: {
      ...baseBarOptions.scales,
      x: {
        ...baseBarOptions.scales.x,
        ticks: { ...baseBarOptions.scales.x.ticks, maxTicksLimit: 12 },
      },
      y: {
        ...baseBarOptions.scales.y,
        title: { display: true, text: 'USD Millions', color: COLORS.text },
      },
    },
  };

  // Chart 2 — Source countries (horizontal bar)
  const sourceData = {
    labels: sourceCountries.map((d) => d.country),
    datasets: [
      {
        label: 'Remittances (USD M)',
        data: sourceCountries.map((d) => d.value),
        backgroundColor: sourceCountries.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
        borderRadius: 4,
      },
    ],
  };

  const sourceOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
    },
    scales: {
      x: {
        ...baseBarOptions.scales.y,
        title: { display: true, text: 'USD Millions', color: COLORS.text },
        beginAtZero: true,
      },
      y: {
        ...baseBarOptions.scales.x,
        grid: { display: false },
      },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Workers' Remittances"
        description="Overseas worker remittances are Pakistan's largest source of foreign exchange, exceeding export earnings. Over 9 million Pakistanis working abroad regularly send money home, supporting both household incomes and the national balance of payments."
      />
      <div className="section-grid">
        <ChartCard
          title="Monthly Total"
          description="Monthly remittance inflows in USD millions. Seasonal spikes typically occur during Ramadan, Eid, and the winter holiday period. Consistent growth reflects expanding diaspora and improved formal banking channels."
          source="State Bank of Pakistan"
          dataSource="SBP EasyData API"
          lastUpdated="Apr 2026"
          dataCoverage="Apr 2021 – Mar 2026"
        >
          <div className="chart-container">
            <Bar data={monthlyData} options={monthlyOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="Source Countries"
          description="Annual remittances by source country. Saudi Arabia and UAE together account for nearly half of all inflows, reflecting Pakistan's large workforce in the Gulf Cooperation Council (GCC) states."
          source="State Bank of Pakistan"
          dataSource="SBP EasyData API"
          lastUpdated="Apr 2026"
          dataCoverage="Apr 2021 – Mar 2026"
        >
          <div className="chart-container">
            <Bar data={sourceData} options={sourceOptions} />
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
