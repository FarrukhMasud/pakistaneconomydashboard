import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, baseBarOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { currentCalendarYear, currentFiscalYear, pctChange, fmtUSD, sumField, avgField } from '../utils/periodHelpers';

function formatDate(dateStr) {
  const [y, m] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function RemittancesSection() {
  const { data, loading, error } = useData('remittances.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  if (error) return <div className="card fade-in"><p>Error loading remittances: {error.message}</p></div>;

  const { monthly, sourceCountries, lastUpdated: remLU, dataCoverage: remDC } = data;
  const cy = currentCalendarYear(monthly);
  const fy = currentFiscalYear(monthly);

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
        description="Overseas worker remittances are Pakistan's single largest source of foreign exchange — typically exceeding goods export earnings. Over 9 million Pakistanis abroad (primarily in Gulf states, UK, and US) send money home through formal banking channels. Remittances directly support household consumption, reduce poverty, and stabilize the current account. Seasonal spikes occur during Ramadan/Eid and December holidays."
      />

      {(cy || fy) && (() => {
        const buildItems = (period, priorLabel) => {
          if (!period) return [];
          const total = sumField(period.rows, 'total');
          const priorTotal = sumField(period.prior, 'total');
          const chg = pctChange(total, priorTotal);
          const avg = avgField(period.rows, 'total');
          return [
            { label: 'Total', value: fmtUSD(total), sub: priorTotal ? `${chg.pct > 0 ? '+' : ''}${chg.pct}% ${priorLabel}` : '', direction: chg.direction, sentiment: chg.direction === 'up' ? 'positive' : 'negative', color: COLORS.teal },
            { label: 'Monthly Avg', value: fmtUSD(avg), color: COLORS.blue },
          ];
        };
        return (
          <div className="summary-pair">
            {cy && (
              <SummaryCard
                title={`${cy.rangeLabel} — Calendar YTD`}
                accent={COLORS.teal}
                items={buildItems(cy, 'YoY')}
                footnote={`${cy.months} month${cy.months > 1 ? 's' : ''} · Source: SBP EasyData API`}
              />
            )}
            {fy && (
              <SummaryCard
                title={`${fy.fyLabel} (${fy.rangeLabel}) — Fiscal YTD`}
                accent={COLORS.blue}
                items={buildItems(fy, `vs ${fy.priorLabel}`)}
                footnote={`${fy.months} month${fy.months > 1 ? 's' : ''} · Source: SBP EasyData API`}
              />
            )}
          </div>
        );
      })()}

      <div className="section-grid">
        <ChartCard
          title="Monthly Total"
          description="Monthly remittance inflows in USD millions. Seasonal spikes typically occur during Ramadan, Eid, and the winter holiday period. Consistent growth reflects expanding diaspora and improved formal banking channels."
          source="State Bank of Pakistan"
          dataSource="SBP EasyData API"
          lastUpdated={remLU}
          dataCoverage={remDC}
        >
          <div className="chart-container">
            <Bar data={monthlyData} options={monthlyOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="Source Countries (Last 12 Months)"
          description="Remittances by source country over the trailing 12 months. Saudi Arabia and UAE together account for nearly half of all inflows, reflecting Pakistan's large workforce in GCC states. The UK and US are the leading Western corridors."
          source="State Bank of Pakistan"
          dataSource="SBP EasyData API"
          lastUpdated={remLU}
          dataCoverage={remDC}
        >
          <div className="chart-container">
            <Bar data={sourceData} options={sourceOptions} />
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
