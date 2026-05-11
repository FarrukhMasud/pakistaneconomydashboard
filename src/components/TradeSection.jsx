import { useState } from 'react';
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
import SummaryCard from './ui/SummaryCard';
import YoYToggle from './ui/YoYToggle';
import { currentCalendarYear, currentFiscalYear, pctChange, fmtUSD, sumField, buildYoYOverlay, formatMonthYear } from '../utils/periodHelpers';

export default function TradeSection() {
  const [showYoY, setShowYoY] = useState(false);
  const { data, loading, error } = useData('trade.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const {
    monthly,
    topExportCountries,
    topImportCountries,
    exportCountryPeriod,
    importCountryPeriod,
    lastUpdated: tradeLU,
    dataCoverage: tradeDC,
  } = data;

  // Current year summary
  const cy = currentCalendarYear(monthly);
  const fy = currentFiscalYear(monthly);

  const labels = monthly.map((d) => formatMonthYear(d.date));
  const tickCallback = (_val, idx) => (idx % 3 === 0 || idx === labels.length - 1 ? labels[idx] : '');

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
  const { priorData: balPrior, priorLabel: balPriorLabel } = buildYoYOverlay(monthly, 'balance');

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
      ...(showYoY ? [{
        label: balPriorLabel,
        data: balPrior,
        type: 'line',
        borderColor: COLORS.amber,
        backgroundColor: 'transparent',
        borderDash: [6, 3],
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: false,
        order: 0,
      }] : []),
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
        description="Pakistan's goods trade flows (excluding services). Pakistan structurally imports more than it exports — primarily energy, machinery, and consumer goods — creating a persistent trade deficit. This deficit is a key driver of foreign exchange pressure and a major focus of IMF program conditionality. Export growth, especially in textiles and food, is critical for reducing external vulnerability."
        sourceLinks={[
          { label: 'SBP BOP Data', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
          { label: 'PBS Statistics', url: 'https://www.pbs.gov.pk' },
        ]}
      />

      {(cy || fy) && (
        <div className="summary-pair">
          {cy && (
            <SummaryCard
              title={`${cy.rangeLabel} — Calendar YTD`}
              accent={COLORS.teal}
              items={(() => {
                const ytdExports = sumField(cy.rows, 'exports');
                const ytdImports = sumField(cy.rows, 'imports');
                const ytdBalance = sumField(cy.rows, 'balance');
                const priorExports = sumField(cy.prior, 'exports');
                const priorImports = sumField(cy.prior, 'imports');
                const expChg = pctChange(ytdExports, priorExports);
                const impChg = pctChange(ytdImports, priorImports);
                return [
                  { label: 'Exports', value: fmtUSD(ytdExports), sub: priorExports ? `${expChg.pct > 0 ? '+' : ''}${expChg.pct}% YoY` : '', direction: expChg.direction, sentiment: expChg.direction === 'up' ? 'positive' : 'negative', color: COLORS.teal },
                  { label: 'Imports', value: fmtUSD(ytdImports), sub: priorImports ? `${impChg.pct > 0 ? '+' : ''}${impChg.pct}% YoY` : '', direction: impChg.direction, sentiment: impChg.direction === 'up' ? 'negative' : 'positive', color: COLORS.coral },
                  { label: 'Trade Balance', value: fmtUSD(ytdBalance), sentiment: ytdBalance >= 0 ? 'positive' : 'negative', color: ytdBalance >= 0 ? COLORS.teal : COLORS.coral },
                ];
              })()}
              footnote={`${cy.months} month${cy.months > 1 ? 's' : ''} · Source: SBP`}
            />
          )}
          {fy && (
            <SummaryCard
              title={`${fy.fyLabel} (${fy.rangeLabel}) — Fiscal YTD`}
              accent={COLORS.blue}
              items={(() => {
                const fytdExports = sumField(fy.rows, 'exports');
                const fytdImports = sumField(fy.rows, 'imports');
                const fytdBalance = sumField(fy.rows, 'balance');
                const priorExports = sumField(fy.prior, 'exports');
                const priorImports = sumField(fy.prior, 'imports');
                const expChg = pctChange(fytdExports, priorExports);
                const impChg = pctChange(fytdImports, priorImports);
                return [
                  { label: 'Exports', value: fmtUSD(fytdExports), sub: priorExports ? `${expChg.pct > 0 ? '+' : ''}${expChg.pct}% vs ${fy.priorLabel}` : '', direction: expChg.direction, sentiment: expChg.direction === 'up' ? 'positive' : 'negative', color: COLORS.teal },
                  { label: 'Imports', value: fmtUSD(fytdImports), sub: priorImports ? `${impChg.pct > 0 ? '+' : ''}${impChg.pct}% vs ${fy.priorLabel}` : '', direction: impChg.direction, sentiment: impChg.direction === 'up' ? 'negative' : 'positive', color: COLORS.coral },
                  { label: 'Trade Balance', value: fmtUSD(fytdBalance), sentiment: fytdBalance >= 0 ? 'positive' : 'negative', color: fytdBalance >= 0 ? COLORS.teal : COLORS.coral },
                ];
              })()}
              footnote={`${fy.months} month${fy.months > 1 ? 's' : ''} · Source: SBP`}
            />
          )}
        </div>
      )}

      <div className="section-grid">
        <ChartCard
          title="Imports vs Exports"
          description="Monthly trade flows in USD millions. The gap between imports (red) and exports (green) shows the trade deficit. Import compression in 2023 was due to government restrictions to preserve foreign exchange."
          source="PBS / SBP"
          dataSource="SBP"
          lastUpdated={tradeLU}
          dataCoverage={tradeDC}
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
          lastUpdated={tradeLU}
          dataCoverage={tradeDC}
        >
          <YoYToggle enabled={showYoY} onToggle={() => setShowYoY(v => !v)} />
          <div className="chart-container">
            <Bar data={barData} options={barOptions} />
          </div>
        </ChartCard>
      </div>

      {topExportCountries?.length > 0 && topImportCountries?.length > 0 && (
        <div className="section-grid" style={{ marginTop: '1.5rem' }}>
          <ChartCard
            title="Top Export Destinations"
            description={`Top 15 countries by export receipts${exportCountryPeriod ? ` for ${exportCountryPeriod}` : ''}. The US, UK, and China are dominant buyers of Pakistani textiles and food products.`}
            source="SBP"
            dataSource="SBP"
            lastUpdated={tradeLU}
            dataCoverage={exportCountryPeriod || tradeDC}
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
            description={`Top 15 countries by import payments${importCountryPeriod ? ` for ${importCountryPeriod}` : ''}. China, UAE (oil), and Saudi Arabia dominate Pakistan's import bill.`}
            source="SBP"
            dataSource="SBP"
            lastUpdated={tradeLU}
            dataCoverage={importCountryPeriod || tradeDC}
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
