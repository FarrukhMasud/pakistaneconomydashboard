import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseLineOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { currentCalendarYear, currentFiscalYear, pctChange, fmtRate } from '../utils/periodHelpers';

function formatDate(dateStr) {
  const [y, m] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function ExchangeRateSection() {
  const { data, loading, error } = useData('exchange-rates.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <div className="card fade-in"><p>Error loading exchange rates: {error.message}</p></div>;

  const { monthly, dataSource: exDS, lastUpdated: exLU, dataCoverage: exDC } = data;
  const cy = currentCalendarYear(monthly);
  const fy = currentFiscalYear(monthly);
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
        description="Pakistani Rupee (PKR) exchange rates against major currencies. A rising line = weaker rupee (more PKR per foreign unit). The PKR lost ~45% against USD between 2022–2023 due to balance of payments pressures, depleted reserves, and political uncertainty. Stability since mid-2024 reflects IMF program discipline and improved reserves. Exchange rate directly affects import costs, inflation pass-through, and external debt servicing burden."
      />

      {(cy || fy) && (() => {
        const currencies = ['USD', 'EUR', 'GBP', 'CNY'];
        const colorMap = { USD: COLORS.teal, EUR: COLORS.amber, GBP: COLORS.coral, CNY: COLORS.purple };
        const buildItems = (period, suffix) => {
          if (!period || !period.rows.length) return [];
          const start = period.rows[0];
          const end = period.rows[period.rows.length - 1];
          return currencies.map(c => {
            const chg = pctChange(end[c], start[c]);
            return {
              label: `PKR / ${c}`,
              value: fmtRate(end[c]),
              sub: chg.pct != null ? `${chg.pct > 0 ? '+' : ''}${chg.pct}% ${suffix}` : '',
              direction: chg.direction,
              sentiment: chg.direction === 'up' ? 'negative' : chg.direction === 'down' ? 'positive' : 'neutral',
              color: colorMap[c],
            };
          });
        };
        const cyItems = buildItems(cy, 'CY YTD');
        const fyItems = buildItems(fy, 'FY YTD');
        const latestDate = cy?.rows?.length ? formatDate(cy.rows[cy.rows.length - 1].date) : '';
        return (
          <div className="summary-pair">
            {cyItems.length > 0 && (
              <SummaryCard
                title={`${cy.rangeLabel} — Calendar YTD`}
                accent={COLORS.teal}
                items={cyItems}
                footnote={`Latest: ${latestDate} · Source: SBP`}
              />
            )}
            {fyItems.length > 0 && (
              <SummaryCard
                title={`${fy.fyLabel} (${fy.rangeLabel}) — Fiscal YTD`}
                accent={COLORS.blue}
                items={fyItems}
                footnote={`${fy.months} month${fy.months > 1 ? 's' : ''} · Source: SBP`}
              />
            )}
          </div>
        );
      })()}

      <ChartCard
        title="Exchange Rates (PKR)"
        description="PKR per unit of foreign currency — USD, EUR, GBP on left axis; CNY on right axis (different scale). The sharp rise in 2022–2023 reflects significant rupee depreciation during the economic crisis. The dashed purple line shows the Chinese Yuan rate."
        source="State Bank of Pakistan"
        dataSource="SBP"
        lastUpdated={exLU}
        dataCoverage={exDC}
      >
        <div className="chart-container">
          <Line data={chartData} options={options} />
        </div>
      </ChartCard>
    </section>
  );
}
