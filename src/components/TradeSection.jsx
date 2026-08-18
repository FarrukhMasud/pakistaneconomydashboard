import { Line, Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { useShareableChartState } from '../hooks/useShareableChartState';
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
import PeriodCompare from './ui/PeriodCompare';
import { LoadingCard, ErrorCard } from './ui/DataState';
import { currentCalendarYear, currentFiscalYear, pctChange, fmtUSD, sumField, buildYoYOverlay, buildFytdSeries, formatMonthYear, formatFySummaryTitle, fytdViewReady, resolveCompareMode, fytdDisabledReason } from '../utils/periodHelpers';
import { countryFlagPlugin, countryLabel } from '../utils/countryLabels';
import SeriesCoverageNote from './ui/SeriesCoverageNote';

// SBP's country-level export receipt and import payment tables are published
// after the headline monthly trade figures, so these two charts can stop one
// month short of the trade balance chart above.
const COUNTRY_COVERAGE_NOTE =
  'This is the latest period SBP has published in its country-level trade tables. They are released after the headline monthly trade figures, so this chart can stop one month short of the totals above.';

export default function TradeSection() {
  const { compareMode, setCompareMode } = useShareableChartState('yoy');
    const { data, loading, error, retry } = useData('trade.json');

    if (loading) return <LoadingCard label="Loading trade data…" />;
    if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load trade data" />;

    const {
      monthly,
      topExportCountries,
      topImportCountries,
      exportCountryPeriod,
      importCountryPeriod,
      lastUpdated: tradeLU,
      dataCoverage: tradeDC,
    } = data;

    if (!monthly?.length) {
      return <ErrorCard error={new Error('Trade series is empty')} onRetry={retry} label="Could not load trade data" />;
    }

    // Current year summary
    const cy = currentCalendarYear(monthly);
    const fy = currentFiscalYear(monthly);
    const fyReady = fytdViewReady(fy);
    const fytdReason = fytdDisabledReason(fy);
    const effectiveCompare = resolveCompareMode(compareMode, fy);
    const showYoY = effectiveCompare === 'yoy';
    const showFytd = effectiveCompare === 'fytd';
    const fytdBalance = buildFytdSeries(monthly, 'balance');
    const fytdImports = buildFytdSeries(monthly, 'imports');
    const fytdExports = buildFytdSeries(monthly, 'exports');

    const labels = showFytd && fytdBalance
      ? fytdBalance.labels
      : monthly.map((d) => formatMonthYear(d.date));
    const tickCallback = (_val, idx) => (idx % 3 === 0 || idx === labels.length - 1 ? labels[idx] : '');

    // --- Imports vs Exports Line ---
    const lineData = {
      labels,
      datasets: showFytd && fytdImports && fytdExports
        ? [
            {
              label: `${fytdImports.currentLabel} imports`,
              data: fytdImports.current,
              borderColor: COLORS.coral,
              backgroundColor: COLORS.coralAlpha,
              fill: true,
            },
            {
              label: `${fytdExports.currentLabel} exports`,
              data: fytdExports.current,
              borderColor: COLORS.teal,
              backgroundColor: COLORS.tealAlpha,
              fill: true,
            },
            ...(fytdImports.prior.some((v) => v != null) ? [{
              label: `${fytdImports.priorLabel} imports`,
              data: fytdImports.prior,
              borderColor: COLORS.coral,
              backgroundColor: 'transparent',
              borderDash: [6, 3],
              pointRadius: 2,
              fill: false,
            }] : []),
            ...(fytdExports.prior.some((v) => v != null) ? [{
              label: `${fytdExports.priorLabel} exports`,
              data: fytdExports.prior,
              borderColor: COLORS.teal,
              backgroundColor: 'transparent',
              borderDash: [6, 3],
              pointRadius: 2,
              fill: false,
            }] : []),
          ]
        : [
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
    const balanceValues = showFytd && fytdBalance ? fytdBalance.current : monthly.map((d) => d.balance);
    const balanceColors = balanceValues.map((v) => (v == null ? COLORS.text : v >= 0 ? COLORS.teal : COLORS.coral));
    const { priorData: balPrior, priorLabel: balPriorLabel } = buildYoYOverlay(monthly, 'balance');
    const balancePrior = showFytd && fytdBalance ? fytdBalance.prior : balPrior;
    const balancePriorLabel = showFytd && fytdBalance
      ? `${fytdBalance.priorLabel} same months`
      : balPriorLabel;
    const showBalancePrior = showYoY || (showFytd && balancePrior.some((v) => v != null));

    const barData = {
      labels,
      datasets: [
        {
          label: showFytd && fytdBalance ? `${fytdBalance.currentLabel} trade balance` : 'Trade Balance',
          data: balanceValues,
          backgroundColor: balanceColors,
          borderColor: balanceColors,
          borderWidth: 1,
        },
        ...(showBalancePrior ? [{
          label: balancePriorLabel,
          data: balancePrior,
          type: 'line',
          borderColor: COLORS.amber,
          backgroundColor: COLORS.amber,
          pointBackgroundColor: COLORS.amber,
          pointBorderColor: '#1a1d27',
          pointBorderWidth: 2,
          borderWidth: 3,
          borderDash: [6, 3],
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: false,
          spanGaps: true,
          order: -10,
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
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw * 1e6)}` },
      },
    },
  };

  const cumulative = (rows, field) => {
    let total = 0;
    return rows.map((row) => {
      total += Number(row[field]) || 0;
      return Math.round(total * 100) / 100;
    });
  };

  const fyRows = fy?.rows || [];
  const priorFyRows = fy?.prior || [];
  const fyLabels = fyRows.map((d) => formatMonthYear(d.date));
  const cumulativeFlowData = fyRows.length ? {
    labels: fyLabels,
    datasets: [
      {
        label: `${fy.fyLabel} cumulative imports`,
        data: cumulative(fyRows, 'imports'),
        borderColor: COLORS.coral,
        backgroundColor: COLORS.coralAlpha,
        fill: false,
        borderWidth: 3,
      },
      {
        label: `${fy.fyLabel} cumulative exports`,
        data: cumulative(fyRows, 'exports'),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        fill: false,
        borderWidth: 3,
      },
      ...(priorFyRows.length ? [
        {
          label: `${fy.priorLabel} same-period imports`,
          data: cumulative(priorFyRows, 'imports').slice(0, fyRows.length),
          borderColor: COLORS.coral,
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          pointRadius: 2,
          fill: false,
        },
        {
          label: `${fy.priorLabel} same-period exports`,
          data: cumulative(priorFyRows, 'exports').slice(0, fyRows.length),
          borderColor: COLORS.teal,
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          pointRadius: 2,
          fill: false,
        },
      ] : []),
    ],
  } : null;

  const cumulativeBalanceData = fyRows.length ? {
    labels: fyLabels,
    datasets: [
      {
        label: `${fy.fyLabel} cumulative trade balance`,
        data: cumulative(fyRows, 'balance'),
        borderColor: COLORS.amber,
        backgroundColor: COLORS.amberAlpha,
        fill: true,
        borderWidth: 3,
      },
      ...(priorFyRows.length ? [{
        label: `${fy.priorLabel} same-period balance`,
        data: cumulative(priorFyRows, 'balance').slice(0, fyRows.length),
        borderColor: COLORS.blue,
        backgroundColor: 'transparent',
        borderDash: [6, 3],
        borderWidth: 3,
        pointRadius: 2,
        fill: false,
      }] : []),
    ],
  } : null;

  const cumulativeOptions = {
    ...baseLineOptions,
    scales: {
      ...baseLineOptions.scales,
      y: {
        ...baseLineOptions.scales.y,
        title: { display: true, text: 'Cumulative USD Millions', color: COLORS.text },
      },
    },
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw * 1e6)}` },
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
      y: {
        ...baseBarOptions.scales.x,
        grid: { display: false },
        ticks: { ...baseBarOptions.scales.x.ticks, autoSkip: false, padding: 24 },
      },
    },
  };

  const exportCountries = topExportCountries?.map((d) => d.country) || [];
  const importCountries = topImportCountries?.map((d) => d.country) || [];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Trade Overview"
        datasetId="trade"
        description="Pakistan's goods trade flows (excluding services). Pakistan structurally imports more than it exports — primarily energy, machinery, and consumer goods — creating a persistent trade deficit. This deficit is a key driver of foreign exchange pressure and a major focus of IMF program conditionality. Export growth, especially in textiles and food, is critical for reducing external vulnerability."
        sourceLinks={[
          { label: 'SBP BOP Data', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
          { label: 'PBS Statistics', url: 'https://www.pbs.gov.pk' },
        ]}
      />

      <SeriesCoverageNote
        items={[
          { label: 'Headline goods trade', period: tradeDC, source: 'SBP BOP goods' },
          { label: 'Export destinations', period: exportCountryPeriod, source: 'SBP country tables' },
          { label: 'Import sources', period: importCountryPeriod, source: 'SBP country tables' },
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
              title={formatFySummaryTitle(fy)}
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
          description="Monthly trade flows in USD millions. The gap between imports (red) and exports (green) shows the trade deficit."
          noteKey="trade.deficit"
          source="PBS / SBP"
          dataSource="SBP"
          lastUpdated={tradeLU}
          dataCoverage={tradeDC}
          provenanceKeys={['trade.monthly.balance']}
        >
          <div className="chart-container">
            <Line data={lineData} options={lineOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="Trade Balance"
          description="Monthly trade surplus or deficit. Red bars indicate deficit months (imports exceeded exports). The amber dashed line compares each month with the same month in the previous year, making seasonality easier to interpret."
          source="PBS / SBP"
          dataSource="SBP"
          lastUpdated={tradeLU}
          dataCoverage={tradeDC}
        >
          <PeriodCompare
            mode={effectiveCompare}
            onChange={setCompareMode}
            modes={['yoy', 'fytd']}
            disabledModes={fytdReason ? { fytd: fytdReason } : {}}
            note={!fyReady && compareMode === 'fytd' ? fytdReason : null}
          />
          <div className="chart-container">
            <Bar data={barData} options={barOptions} />
          </div>
        </ChartCard>
      </div>

      {fyReady && cumulativeFlowData && cumulativeBalanceData && (
        <div className="section-grid" style={{ marginTop: '1.5rem' }}>
          <ChartCard
            title="Cumulative Imports & Exports (FYTD)"
            description={`Running fiscal-year-to-date imports and exports for ${fy.fyLabel}, compared with the same months of ${fy.priorLabel}. This shows whether trade flows are accumulating faster or slower than last year, not just what happened in one month.`}
            source="SBP"
            dataSource="SBP"
            lastUpdated={tradeLU}
            dataCoverage={`${fy.fyLabel}: ${fy.rangeLabel}`}
          >
            <div className="chart-container">
              <Line data={cumulativeFlowData} options={cumulativeOptions} />
            </div>
          </ChartCard>
          <ChartCard
            title="Cumulative Trade Balance (FYTD)"
            description={`Running trade balance for ${fy.fyLabel} compared with ${fy.priorLabel}. A more negative line means the external financing gap is widening; a less negative line means imports and exports are moving toward better balance.`}
            source="SBP"
            dataSource="SBP"
            lastUpdated={tradeLU}
            dataCoverage={`${fy.fyLabel}: ${fy.rangeLabel}`}
          >
            <div className="chart-container">
              <Line data={cumulativeBalanceData} options={cumulativeOptions} />
            </div>
          </ChartCard>
        </div>
      )}

      {topExportCountries?.length > 0 && topImportCountries?.length > 0 && (
        <div className="section-grid" style={{ marginTop: '1.5rem' }}>
          <ChartCard
            title="Top Export Destinations"
            description={`Top 15 countries by export receipts${exportCountryPeriod ? ` for ${exportCountryPeriod}` : ''}. The US, UK, and China are dominant buyers of Pakistani textiles and food products.`}
            source="SBP"
            dataSource="SBP"
            lastUpdated={tradeLU}
            dataCoverage={exportCountryPeriod || tradeDC}
            coverageNote={COUNTRY_COVERAGE_NOTE}
          >
            <div className="chart-container tall">
              <Bar
                data={{
                  labels: topExportCountries.map((d) => countryLabel(d.country)),
                  datasets: [{
                    label: 'Exports (USD M)',
                    data: topExportCountries.map((d) => d.value),
                    backgroundColor: topExportCountries.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
                    borderRadius: 4,
                  }],
                }}
                options={countryBarOptions}
                plugins={[countryFlagPlugin(exportCountries, 'trade-exports')]}
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
            coverageNote={COUNTRY_COVERAGE_NOTE}
          >
            <div className="chart-container tall">
              <Bar
                data={{
                  labels: topImportCountries.map((d) => countryLabel(d.country)),
                  datasets: [{
                    label: 'Imports (USD M)',
                    data: topImportCountries.map((d) => d.value),
                    backgroundColor: topImportCountries.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
                    borderRadius: 4,
                  }],
                }}
                options={countryBarOptions}
                plugins={[countryFlagPlugin(importCountries, 'trade-imports')]}
              />
            </div>
          </ChartCard>
        </div>
      )}
    </section>
  );
}
