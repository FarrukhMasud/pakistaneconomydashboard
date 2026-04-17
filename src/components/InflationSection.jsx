import { Line, Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import {
  COLORS,
  baseLineOptions,
  baseBarOptions,
} from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { currentCalendarYear, currentFiscalYear, pctChange, fmtPct, avgField } from '../utils/periodHelpers';

function formatDate(dateStr) {
  const d = new Date(dateStr + '-01');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function InflationSection() {
  const { data, loading, error } = useData('inflation.json');

  if (loading || !data)
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <span>Loading data…</span>
      </div>
    );
  if (error)
    return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { national_cpi, urban_cpi, rural_cpi, spi, urban_food, rural_food, urban_nonfood, rural_nonfood, wpi, dataSource, lastUpdated } = data;

  const latestCpi = national_cpi.data[national_cpi.data.length - 1];
  const latestUrban = urban_cpi.data[urban_cpi.data.length - 1];
  const latestRural = rural_cpi.data[rural_cpi.data.length - 1];
  const latestSpi = spi.data[spi.data.length - 1];

  const cy = currentCalendarYear(national_cpi.data);
  const fy = currentFiscalYear(national_cpi.data);

  const cpiLabels = national_cpi.data.map((d) => formatDate(d.date));
  const tickCallback = (_val, idx) => (idx % 6 === 0 ? cpiLabels[idx] : '');

  // --- Chart 1: National CPI Headline ---
  const cpiLineData = {
    labels: cpiLabels,
    datasets: [
      {
        label: 'National CPI YoY (%)',
        data: national_cpi.data.map((d) => d.value),
        borderColor: COLORS.coral,
        backgroundColor: COLORS.coralAlpha,
        fill: true,
        pointRadius: 1,
        pointHoverRadius: 5,
      },
    ],
  };

  const cpiLineOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      x: {
        ...baseLineOptions.scales.x,
        ticks: { ...baseLineOptions.scales.x.ticks, callback: tickCallback },
      },
      y: {
        ...baseLineOptions.scales.y,
        ticks: {
          ...baseLineOptions.scales.y.ticks,
          callback: (v) => v + '%',
        },
      },
    },
  };

  // --- Chart 2: Urban vs Rural CPI ---
  const urbanLabels = urban_cpi.data.map((d) => formatDate(d.date));
  const urbanRuralData = {
    labels: urbanLabels,
    datasets: [
      {
        label: 'Urban CPI YoY',
        data: urban_cpi.data.map((d) => d.value),
        borderColor: COLORS.blue,
        backgroundColor: COLORS.blueAlpha,
        fill: false,
        pointRadius: 2,
      },
      {
        label: 'Rural CPI YoY',
        data: rural_cpi.data.map((d) => d.value),
        borderColor: COLORS.amber,
        backgroundColor: COLORS.amberAlpha,
        fill: false,
        pointRadius: 2,
      },
    ],
  };

  const urbanRuralOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      x: {
        ...baseLineOptions.scales.x,
        ticks: {
          ...baseLineOptions.scales.x.ticks,
          callback: (_v, idx) => (idx % 3 === 0 ? urbanLabels[idx] : ''),
        },
      },
      y: {
        ...baseLineOptions.scales.y,
        ticks: {
          ...baseLineOptions.scales.y.ticks,
          callback: (v) => v + '%',
        },
      },
    },
  };

  // --- Chart 3: Food vs Non-Food (Urban) ---
  const foodLabels = urban_food.data.map((d) => formatDate(d.date));
  const foodNonFoodData = {
    labels: foodLabels,
    datasets: [
      {
        label: 'Urban Food',
        data: urban_food.data.map((d) => d.value),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        fill: false,
        pointRadius: 2,
      },
      {
        label: 'Urban Non-Food',
        data: urban_nonfood.data.map((d) => d.value),
        borderColor: COLORS.purple,
        backgroundColor: COLORS.purpleAlpha,
        fill: false,
        pointRadius: 2,
      },
      {
        label: 'Rural Food',
        data: rural_food.data.map((d) => d.value),
        borderColor: COLORS.amber,
        backgroundColor: COLORS.amberAlpha,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 2,
      },
      {
        label: 'Rural Non-Food',
        data: rural_nonfood.data.map((d) => d.value),
        borderColor: COLORS.blue,
        backgroundColor: COLORS.blueAlpha,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 2,
      },
    ],
  };

  const foodNonFoodOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      x: {
        ...baseLineOptions.scales.x,
        ticks: {
          ...baseLineOptions.scales.x.ticks,
          callback: (_v, idx) => (idx % 2 === 0 ? foodLabels[idx] : ''),
        },
      },
      y: {
        ...baseLineOptions.scales.y,
        ticks: {
          ...baseLineOptions.scales.y.ticks,
          callback: (v) => v + '%',
        },
      },
    },
  };

  // --- Chart 4: CPI vs SPI vs WPI ---
  // Align to the shorter common range (SPI/WPI have 75 months now)
  const minLen = Math.min(national_cpi.data.length, spi.data.length, wpi.data.length);
  const cpiSlice = national_cpi.data.slice(-minLen);
  const spiSlice = spi.data.slice(-minLen);
  const wpiSlice = wpi.data.slice(-minLen);
  const compLabels = cpiSlice.map((d) => formatDate(d.date));

  const compData = {
    labels: compLabels,
    datasets: [
      {
        label: 'CPI (National)',
        data: cpiSlice.map((d) => d.value),
        borderColor: COLORS.coral,
        backgroundColor: COLORS.coralAlpha,
        fill: false,
        pointRadius: 1,
      },
      {
        label: 'SPI (Sensitive Price)',
        data: spiSlice.map((d) => d.value),
        borderColor: COLORS.teal,
        backgroundColor: COLORS.tealAlpha,
        fill: false,
        pointRadius: 1,
      },
      {
        label: 'WPI (Wholesale)',
        data: wpiSlice.map((d) => d.value),
        borderColor: COLORS.amber,
        backgroundColor: COLORS.amberAlpha,
        fill: false,
        pointRadius: 1,
      },
    ],
  };

  const compOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      ...baseLineOptions.scales,
      x: {
        ...baseLineOptions.scales.x,
        ticks: {
          ...baseLineOptions.scales.x.ticks,
          callback: (_v, idx) => (idx % 6 === 0 ? compLabels[idx] : ''),
        },
      },
      y: {
        ...baseLineOptions.scales.y,
        ticks: {
          ...baseLineOptions.scales.y.ticks,
          callback: (v) => v + '%',
        },
      },
    },
  };

  // Latest values summary card
  const firstDate = formatDate(national_cpi.data[0].date);
  const lastDate = formatDate(latestCpi.date);

  return (
    <>
      <SectionHeader
        title="Inflation"
        description="Inflation measured Year-over-Year (base year 2015–16). SBP's medium-term inflation target is 5–7%. The CPI is the primary policy target — when CPI exceeds the target, SBP raises the policy rate to cool demand. Food prices (40%+ of CPI basket) disproportionately affect lower-income households. SPI tracks weekly-priced essentials; WPI measures wholesale/producer prices and often leads CPI trends."
      />

      {/* Combined Summary Cards — CY and FY */}
      {(() => {
        const avgCpi = cy ? avgField(cy.rows, 'value') : null;
        const fyAvgCpi = fy ? avgField(fy.rows, 'value') : null;
        return (
          <div className="summary-pair">
            <SummaryCard
              title={cy ? `${cy.rangeLabel} — Calendar YTD` : 'Latest Inflation'}
              accent={COLORS.coral}
              items={[
                { label: 'National CPI', value: fmtPct(latestCpi.value), sub: formatDate(latestCpi.date), color: COLORS.coral },
                { label: 'Urban CPI', value: fmtPct(latestUrban.value), color: COLORS.blue },
                { label: 'Rural CPI', value: fmtPct(latestRural.value), color: COLORS.amber },
                ...(avgCpi != null ? [{ label: `CY ${cy.label} Avg`, value: fmtPct(avgCpi), color: COLORS.purple }] : []),
              ]}
              footnote={cy ? `${cy.months} month${cy.months > 1 ? 's' : ''} · Source: ${dataSource || 'SBP'}` : `Source: ${dataSource || 'SBP'}`}
            />
            {fy && (
              <SummaryCard
                title={`${fy.fyLabel} (${fy.rangeLabel}) — Fiscal YTD`}
                accent={COLORS.blue}
                items={[
                  { label: 'SPI', value: fmtPct(latestSpi.value), sub: formatDate(latestSpi.date), color: COLORS.teal },
                  ...(fyAvgCpi != null ? [{ label: `${fy.fyLabel} Avg CPI`, value: fmtPct(fyAvgCpi), color: COLORS.coral }] : []),
                  ...(fy.prior.length > 0 ? [{ label: `${fy.priorLabel} Same Period Avg`, value: fmtPct(avgField(fy.prior, 'value')), color: COLORS.amber }] : []),
                ]}
                footnote={`${fy.months} month${fy.months > 1 ? 's' : ''} · Last updated: ${lastUpdated || 'N/A'}`}
              />
            )}
          </div>
        );
      })()}

      <div className="chart-grid">
        <ChartCard
          title="National CPI — Year-over-Year"
          description="Month-by-month headline inflation rate. CPI peaked at 38% in May 2023 during the economic crisis and has since fallen to single digits. This is the most widely tracked inflation measure in Pakistan."
          dataSource={dataSource}
          dataCoverage={`${firstDate} – ${lastDate} (${national_cpi.data.length} months)`}
          lastUpdated={lastUpdated}
        >
          <div style={{ height: 320 }}>
            <Line data={cpiLineData} options={cpiLineOptions} />
          </div>
        </ChartCard>

        <ChartCard
          title="Urban vs Rural Inflation"
          description="Compares CPI inflation in urban and rural areas. Urban inflation tends to be slightly higher due to housing and energy costs, while rural inflation is more sensitive to food prices."
          dataSource={dataSource}
          dataCoverage={`${formatDate(urban_cpi.data[0].date)} – ${formatDate(urban_cpi.data[urban_cpi.data.length - 1].date)} (${urban_cpi.data.length} months)`}
          lastUpdated={lastUpdated}
        >
          <div style={{ height: 300 }}>
            <Line data={urbanRuralData} options={urbanRuralOptions} />
          </div>
        </ChartCard>

        <ChartCard
          title="Food vs Non-Food Inflation"
          description="Breaks down inflation by food and non-food categories for both urban and rural areas. Food inflation is a major driver of headline CPI in Pakistan, directly affecting household budgets."
          dataSource={dataSource}
          dataCoverage={`${formatDate(urban_food.data[0].date)} – ${formatDate(urban_food.data[urban_food.data.length - 1].date)} (${urban_food.data.length} months)`}
          lastUpdated={lastUpdated}
        >
          <div style={{ height: 300 }}>
            <Line data={foodNonFoodData} options={foodNonFoodOptions} />
          </div>
        </ChartCard>

        <ChartCard
          title="CPI vs SPI vs WPI"
          description="Compares three key price indices: CPI (consumer prices), SPI (weekly sensitive items like food/fuel), and WPI (wholesale prices). SPI tends to be more volatile as it tracks frequently-changing items."
          dataSource={dataSource}
          dataCoverage={`${formatDate(cpiSlice[0].date)} – ${formatDate(cpiSlice[cpiSlice.length - 1].date)} (${cpiSlice.length} months)`}
          lastUpdated={lastUpdated}
        >
          <div style={{ height: 320 }}>
            <Line data={compData} options={compOptions} />
          </div>
        </ChartCard>
      </div>
    </>
  );
}
