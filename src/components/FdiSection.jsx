import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, formatCurrency, baseBarOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { pctChange, fmtUSD } from '../utils/periodHelpers';
import { countryFlagPlugin, countryLabel } from '../utils/countryLabels';

export default function FdiSection() {
  const { data, loading, error } = useData('fdi.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { annual, by_sector, by_country, fytdComparison, sectorPeriod, sectorPriorPeriod, lastUpdated: fdiLU } = data;

  // Latest full-year summary
  const latest = annual[annual.length - 1];
  const prev = annual.length >= 2 ? annual[annual.length - 2] : null;
  const chg = prev ? pctChange(latest.net_fdi, prev.net_fdi) : { pct: null, direction: 'flat' };

  // FYTD comparison
  const fytd = fytdComparison;
  const fytdChg = fytd?.prior ? pctChange(fytd.current.net_fdi, fytd.prior.net_fdi) : null;

  // ── Chart 1: Annual Net FDI (full fiscal years only) ──
  const annualBarData = {
    labels: annual.map((d) => d.year),
    datasets: [{
      label: 'Net FDI (USD M)',
      data: annual.map((d) => d.net_fdi),
      backgroundColor: COLORS.teal,
      borderColor: COLORS.teal,
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const annualBarOptions = {
    ...baseBarOptions,
    plugins: { ...baseBarOptions.plugins, legend: { display: false } },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text } },
    },
  };

  // ── Chart 2: Inflow vs Outflow ──
  const flowYears = annual.filter(d => d.inflow && d.outflow);
  const flowBarData = {
    labels: flowYears.map(d => d.year),
    datasets: [
      { label: 'Inflow', data: flowYears.map(d => d.inflow), backgroundColor: COLORS.teal, borderRadius: 4 },
      { label: 'Outflow', data: flowYears.map(d => d.outflow), backgroundColor: COLORS.coral, borderRadius: 4 },
    ],
  };

  const flowBarOptions = {
    ...baseBarOptions,
    plugins: { ...baseBarOptions.plugins },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text } },
    },
  };

  // ── Chart 3: FDI by Sector — diverging horizontal bar ──
  const sectorChartData = {
    labels: by_sector.map((d) => d.sector),
    datasets: [{
      label: sectorPeriod || 'Current FYTD',
      data: by_sector.map((d) => d.amount),
      backgroundColor: by_sector.map((d) => d.amount >= 0 ? COLORS.teal : COLORS.coral),
      borderRadius: 4,
    }],
  };
  if (by_sector.some(d => d.priorAmount != null)) {
    sectorChartData.datasets.push({
      label: sectorPriorPeriod || 'Prior FYTD',
      data: by_sector.map((d) => d.priorAmount ?? 0),
      backgroundColor: by_sector.map((d) => (d.priorAmount ?? 0) >= 0 ? 'rgba(45, 212, 191, 0.35)' : 'rgba(255, 107, 107, 0.35)'),
      borderRadius: 4,
    });
  }

  const sectorOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: {
        ...baseBarOptions.plugins?.tooltip,
        callbacks: {
          label: (ctx) => {
            const val = ctx.raw;
            const prefix = val < 0 ? 'Disinvestment' : 'Net FDI';
            return `${ctx.dataset.label} — ${prefix}: ${formatCurrency(Math.abs(val) * 1e6)}`;
          },
        },
      },
    },
    scales: {
      x: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions (negative = disinvestment)', color: COLORS.text } },
      y: {
        ...baseBarOptions.scales.x,
        grid: { display: false },
        ticks: { ...baseBarOptions.scales.x.ticks, padding: 24 },
      },
    },
  };

  // ── Chart 4: FDI by Country — diverging horizontal bar ──
  const countryBarData = {
    labels: by_country.map((d) => countryLabel(d.country)),
    datasets: [{
      label: data.countryPeriod || 'Current FYTD',
      data: by_country.map((d) => d.amount),
      backgroundColor: by_country.map((d) => d.amount >= 0 ? COLOR_LIST[0] : COLORS.coral),
      borderRadius: 4,
    }],
  };
  if (by_country.some(d => d.priorAmount != null)) {
    countryBarData.datasets.push({
      label: data.countryPriorPeriod || 'Prior FYTD',
      data: by_country.map((d) => d.priorAmount ?? 0),
      backgroundColor: by_country.map((d) => (d.priorAmount ?? 0) >= 0 ? 'rgba(45, 212, 191, 0.35)' : 'rgba(255, 107, 107, 0.35)'),
      borderRadius: 4,
    });
  }

  const countryBarOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: {
        ...baseBarOptions.plugins?.tooltip,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw * 1e6)}` },
      },
    },
    scales: {
      x: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text } },
      y: { ...baseBarOptions.scales.x, grid: { display: false } },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Foreign Direct Investment"
        description="FDI measures long-term international investment into Pakistan. Unlike portfolio flows, FDI involves lasting ownership interest (≥10% stake) — bringing capital, technology transfer, and jobs. CPEC-era power and infrastructure projects drove FDI to $2.8B (FY2018), but declining since. Key concerns: high concentration risk (China ~38%), rising disinvestment in some sectors (profit repatriation), and limited diversification beyond power/energy."
        sourceLinks={[
          { label: 'Board of Investment', url: 'https://invest.gov.pk' },
          { label: 'SBP FDI Data', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
        ]}
      />

      <div className="summary-pair">
        <SummaryCard
          title={`${latest.year}${latest.status ? ` (${latest.status[0].toUpperCase()})` : ''} — Annual FDI`}
          accent={COLORS.teal}
          items={[
            { label: 'Net FDI', value: fmtUSD(latest.net_fdi), sub: prev ? `${chg.pct > 0 ? '+' : ''}${chg.pct}% vs ${prev.year}` : '', direction: chg.direction, sentiment: chg.direction === 'up' ? 'positive' : 'negative', color: COLORS.teal },
            ...(latest.inflow ? [{ label: 'Gross Inflow', value: fmtUSD(latest.inflow), color: COLORS.blue }] : []),
            ...(latest.outflow ? [{ label: 'Outflow', value: fmtUSD(latest.outflow), color: COLORS.coral }] : []),
          ]}
          footnote={`Source: SBP / Board of Investment${latest.status === 'revised' ? ' · Revised figures' : ''}`}
        />
        {fytd && (
          <SummaryCard
            title={`${fytd.current.label} (${fytd.period}) — Fiscal YTD`}
            accent={COLORS.blue}
            items={[
              { label: 'Net FDI', value: fmtUSD(fytd.current.net_fdi), sub: fytdChg ? `${fytdChg.pct > 0 ? '+' : ''}${fytdChg.pct}% vs ${fytd.prior.label}` : '', direction: fytdChg?.direction, sentiment: fytdChg?.direction === 'up' ? 'positive' : 'negative', color: COLORS.teal },
              ...(fytd.current.inflow ? [{ label: 'Gross Inflow', value: fmtUSD(fytd.current.inflow), color: COLORS.blue }] : []),
              ...(fytd.current.outflow ? [{ label: 'Outflow', value: fmtUSD(fytd.current.outflow), color: COLORS.coral }] : []),
            ]}
            footnote={`Provisional · ${fytd.prior ? `Prior: ${fytd.prior.label} ${fytd.period} $${Math.round(fytd.prior.net_fdi)}M` : ''}`}
          />
        )}
      </div>

      <div className="section-grid">
        <ChartCard
          title="Annual Net FDI"
          description="Annual net FDI in USD millions by completed fiscal year. Pakistan's FDI has been recovering since the 2023 economic crisis, with FY2025 showing the strongest performance since FY2018."
          source="SBP / Board of Investment"
          dataSource="SBP"
          lastUpdated={fdiLU}
          dataCoverage={`${annual[0].year} – ${latest.year}`}
        >
          <div className="chart-container">
            <Bar data={annualBarData} options={annualBarOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="FDI Inflow vs Outflow"
          description="Gross FDI inflows (new capital entering) versus outflows (disinvestment, profit repatriation). Net FDI = Inflow − Outflow. High outflow years indicate existing investors extracting profits rather than reinvesting — a concern for long-term capital formation."
          source="SBP"
          dataSource="SBP"
          lastUpdated={fdiLU}
          dataCoverage={flowYears.length ? `${flowYears[0].year} – ${flowYears[flowYears.length - 1].year}` : ''}
        >
          <div className="chart-container">
            <Bar data={flowBarData} options={flowBarOptions} />
          </div>
        </ChartCard>
      </div>

      <div className="section-grid" style={{ marginTop: '1.5rem' }}>
        <ChartCard
          title="FDI by Sector"
          description={`Sector-level FDI for ${sectorPeriod || 'current FYTD'}${sectorPriorPeriod ? ` compared with ${sectorPriorPeriod}` : ''}. Negative values indicate net disinvestment (outflow > inflow). Power & Energy dominates due to CPEC-era projects; IT disinvestment may reflect profit repatriation.`}
          source="SBP / Board of Investment"
          dataSource="SBP"
          lastUpdated={fdiLU}
          dataCoverage={sectorPeriod}
        >
          <div className="chart-container">
            <Bar data={sectorChartData} options={sectorOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="FDI by Country"
          description={`Source countries of FDI for ${data.countryPeriod || 'current FYTD'}${data.countryPriorPeriod ? ` vs ${data.countryPriorPeriod}` : ''}. China leads through CPEC. Concentration risk: ~38% of FDI comes from a single country. Negative values = net capital outflow.`}
          source="SBP / Board of Investment"
          dataSource="SBP"
          lastUpdated={fdiLU}
          dataCoverage={data.countryPeriod}
        >
          <div className="chart-container">
            <Bar data={countryBarData} options={countryBarOptions} plugins={[countryFlagPlugin(by_country.map((d) => d.country), 'fdi-countries')]} />
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
