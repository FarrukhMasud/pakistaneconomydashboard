import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { useShareableChartState } from '../hooks/useShareableChartState';
import { COLORS, COLOR_LIST, baseBarOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import PeriodCompare from './ui/PeriodCompare';
import { LoadingCard, ErrorCard, UnavailableCard } from './ui/DataState';
import { currentCalendarYear, currentFiscalYear, pctChange, fmtUSD, sumField, avgField, buildYoYOverlay, buildFytdSeries } from '../utils/periodHelpers';

const CORRIDORS = [
  { field: 'saudiArabia', label: 'Saudi Arabia', color: COLORS.teal },
  { field: 'uae', label: 'UAE', color: COLORS.amber },
  { field: 'uk', label: 'United Kingdom', color: COLORS.blue },
  { field: 'usa', label: 'United States', color: COLORS.purple },
  { field: 'otherGcc', label: 'Other GCC', color: '#26c6da' },
  { field: 'eu', label: 'EU Countries', color: '#66bb6a' },
  { field: 'otherCountries', label: 'Other countries', color: '#78909c' },
];

function formatDate(dateStr) {
  const [y, m] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function withOtherCountries(row) {
  const known = ['saudiArabia', 'uae', 'uk', 'usa', 'otherGcc', 'eu']
    .reduce((sum, field) => sum + (Number(row[field]) || 0), 0);
  return {
    ...row,
    otherCountries: Math.max(0, (Number(row.total) || 0) - known),
  };
}

export default function RemittancesSection() {
  const { compareMode, setCompareMode } = useShareableChartState();
    const showYoY = compareMode === 'yoy';
    const showFytd = compareMode === 'fytd';
    const { data, loading, error, retry } = useData('remittances.json');

    if (loading) return <LoadingCard label="Loading remittances…" />;
    if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load remittances" />;

    const { monthly, sourceCountries, lastUpdated: remLU, dataCoverage: remDC } = data;
    if (!monthly?.length) {
      return <UnavailableCard label="Could not load remittances" reason="Remittance series is empty." />;
    }

    const cy = currentCalendarYear(monthly);
    const fy = currentFiscalYear(monthly);
    const fytdTotal = buildFytdSeries(monthly, 'total');
    const corridorRows = monthly.slice(-36).map(withOtherCountries);
    const latestCorridor = corridorRows.at(-1);
    const corridorSummary = latestCorridor ? CORRIDORS
      .map((corridor) => ({
        label: corridor.label,
        value: latestCorridor[corridor.field],
        share: latestCorridor.total ? (latestCorridor[corridor.field] / latestCorridor.total) * 100 : null,
        color: corridor.color,
      }))
      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)) : [];

    // Chart 1 — Monthly total remittances (vertical bar)
    const { priorData: remPrior, priorLabel: remPriorLabel } = buildYoYOverlay(monthly, 'total');
    const remLabels = showFytd && fytdTotal ? fytdTotal.labels : monthly.map((d) => formatDate(d.date));
    const remValues = showFytd && fytdTotal ? fytdTotal.current : monthly.map((d) => d.total);
    const remCompare = showFytd && fytdTotal ? fytdTotal.prior : remPrior;
    const remCompareLabel = showFytd && fytdTotal ? `${fytdTotal.priorLabel} same months` : remPriorLabel;
    const showRemCompare = showYoY || (showFytd && remCompare.some((v) => v != null));

    const monthlyData = {
      labels: remLabels,
      datasets: [
        {
          label: showFytd && fytdTotal ? `${fytdTotal.currentLabel} remittances` : 'Total Remittances',
          data: remValues,
          backgroundColor: COLORS.teal,
          borderColor: COLORS.teal,
          borderWidth: 1,
          borderRadius: 4,
        },
        ...(showRemCompare ? [{
          label: remCompareLabel,
          data: remCompare,
          backgroundColor: 'rgba(255, 167, 38, 0.25)',
          borderColor: COLORS.amber,
          borderWidth: 1,
          borderRadius: 4,
          borderDash: [4, 3],
        }] : []),
      ],
    };

    const monthlyOptions = {
      ...baseBarOptions,
      plugins: {
        ...baseBarOptions.plugins,
        legend: { display: showRemCompare },
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

  // Chart 1b — Monthly remittances by official corridor bucket
  const corridorData = {
    labels: corridorRows.map((d) => formatDate(d.date)),
    datasets: CORRIDORS.map((corridor) => ({
      label: corridor.label,
      data: corridorRows.map((d) => d[corridor.field]),
      backgroundColor: corridor.color,
      borderRadius: 3,
      stack: 'remittances',
    })),
  };
  const corridorOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: {
        display: true,
        position: 'top',
        labels: { ...baseBarOptions.plugins.legend?.labels, boxWidth: 10 },
      },
      tooltip: {
        ...baseBarOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`,
        },
      },
    },
    scales: {
      x: {
        ...baseBarOptions.scales.x,
        stacked: true,
        ticks: { ...baseBarOptions.scales.x.ticks, maxTicksLimit: 12 },
      },
      y: {
        ...baseBarOptions.scales.y,
        stacked: true,
        title: { display: true, text: 'USD Millions / month', color: COLORS.text },
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
        datasetId="remittances"
        description="Overseas worker remittances are Pakistan's single largest source of foreign exchange — typically exceeding goods export earnings. Over 9 million Pakistanis abroad (primarily in Gulf states, UK, and US) send money home through formal banking channels. Remittances directly support household consumption, reduce poverty, and stabilize the current account. Seasonal spikes occur during Ramadan/Eid and December holidays."
        sourceLinks={[
          { label: 'SBP EasyData Portal', url: 'https://easydata.sbp.org.pk' },
        ]}
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
          title="Monthly Remittances by Corridor"
          description="Monthly workers' remittances split by SBP's published corridor buckets. SBP exposes major single-country corridors (Saudi Arabia, UAE, UK, USA), grouped Other GCC and EU buckets, plus the residual shown here as Other countries."
          source="State Bank of Pakistan"
          dataSource="SBP EasyData API"
          lastUpdated={remLU}
          dataCoverage={`${formatDate(corridorRows[0]?.date)} – ${formatDate(corridorRows.at(-1)?.date)}`}
        >
          <div className="chart-container tall">
            <Bar data={corridorData} options={corridorOptions} />
          </div>
        </ChartCard>
        {latestCorridor && (
          <SummaryCard
            title={`${formatDate(latestCorridor.date)} — Corridor Split`}
            accent={COLORS.teal}
            items={corridorSummary.map((corridor) => ({
              label: corridor.label,
              value: fmtUSD(corridor.value),
              sub: corridor.share != null ? `${corridor.share.toFixed(1)}% of total` : '',
              color: corridor.color,
            }))}
            footnote="Official SBP country/corridor buckets; Other countries is total remittances minus the published corridor buckets."
          />
        )}
      </div>

      <div className="section-grid">
        <ChartCard
          title="Monthly Total"
          description="Monthly remittance inflows in USD millions. Seasonal spikes typically occur during Ramadan, Eid, and the winter holiday period. Consistent growth reflects expanding diaspora and improved formal banking channels."
          source="State Bank of Pakistan"
          dataSource="SBP EasyData API"
          lastUpdated={remLU}
          dataCoverage={remDC}
          provenanceKeys={['remittances.monthly.total']}
        >
          <PeriodCompare mode={compareMode} onChange={setCompareMode} modes={['yoy', 'fytd']} />
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
