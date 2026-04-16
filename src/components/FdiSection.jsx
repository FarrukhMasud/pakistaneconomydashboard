import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, formatCurrency, baseBarOptions, baseDoughnutOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';

export default function FdiSection() {
  const { data, loading, error } = useData('fdi.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { annual, by_sector, by_country } = data;

  // Chart 1 — Annual Net FDI (bar)
  const annualBarData = {
    labels: annual.map((d) => d.year),
    datasets: [
      {
        label: 'Net FDI (USD M)',
        data: annual.map((d) => d.net_fdi),
        backgroundColor: COLORS.teal,
        borderColor: COLORS.teal,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const annualBarOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
    },
    scales: {
      ...baseBarOptions.scales,
      y: {
        ...baseBarOptions.scales.y,
        title: { display: true, text: 'USD Millions', color: COLORS.text },
      },
    },
  };

  // Chart 2 — FDI by Sector (horizontal bar)
  const sectorData = {
    labels: by_sector.map((d) => d.sector),
    datasets: [
      {
        label: 'FDI (USD M)',
        data: by_sector.map((d) => d.amount),
        backgroundColor: by_sector.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
        borderRadius: 4,
      },
    ],
  };

  const sectorOptions = {
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

  // Chart 3 — FDI by Country (doughnut)
  const countryData = {
    labels: by_country.map((d) => `${d.flag} ${d.country}`),
    datasets: [
      {
        data: by_country.map((d) => d.amount),
        backgroundColor: COLOR_LIST.concat(COLOR_LIST).slice(0, by_country.length),
        borderWidth: 0,
      },
    ],
  };

  const countryDoughnutOptions = {
    ...baseDoughnutOptions,
    plugins: {
      ...baseDoughnutOptions.plugins,
      tooltip: {
        ...baseDoughnutOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw * 1e6)}` },
      },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Foreign Direct Investment"
        description="Foreign Direct Investment (FDI) tracks international capital flowing into Pakistan's economy. FDI brings not just capital but technology transfer, job creation, and integration with global supply chains. China's Belt & Road Initiative (CPEC) has been the dominant driver, with diversification into IT, fintech, and manufacturing gaining momentum."
      />

      <div className="section-grid">
        <ChartCard
          title="Annual Net FDI"
          description="Annual net FDI in USD millions by fiscal year. Pakistan's FDI peaked in FY2020 driven by CPEC-related investments and has been gradually recovering after the 2023 economic crisis. Sustained FDI above $2B signals growing foreign investor confidence."
          source="SBP / Board of Investment"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="FY2017 – FY2025"
        >
          <div className="chart-container">
            <Bar data={annualBarData} options={annualBarOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="FDI by Sector"
          description="FDI distribution across major economic sectors. Power and oil & gas dominate due to ongoing CPEC energy projects. Growing IT sector FDI reflects Pakistan's emerging tech ecosystem and startup activity."
          source="SBP / Board of Investment"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="Jul-Mar FY2026"
        >
          <div className="chart-container">
            <Bar data={sectorData} options={sectorOptions} />
          </div>
        </ChartCard>
      </div>

      <div className="section-grid" style={{ marginTop: '1.5rem' }}>
        <ChartCard
          title="FDI by Country"
          description="Source countries of FDI inflows. China leads as the largest investor through CPEC infrastructure projects. UK, UAE, and Netherlands are significant due to financial services and telecom investments."
          source="SBP / Board of Investment"
          dataSource="SBP"
          lastUpdated="Apr 2026"
          dataCoverage="Jul-Mar FY2026"
        >
          <div className="chart-container">
            <Doughnut data={countryData} options={countryDoughnutOptions} />
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
