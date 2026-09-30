import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { useShareableChartState } from '../hooks/useShareableChartState';
import { COLORS, COLOR_LIST, baseBarOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import PeriodCompare from './ui/PeriodCompare';
import { LoadingCard, ErrorCard } from './ui/DataState';
import { finiteSum } from '../utils/figureTrust';
import { currentCalendarYear, currentFiscalYear, pctChange, fmtUSD, sumField, avgField, buildYoYOverlay, buildFytdSeries, formatFySummaryTitle, fytdViewReady, resolveCompareMode, fytdDisabledReason } from '../utils/periodHelpers';

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
  if (!dateStr) return 'Period not stated';
  const [y, m] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function withOtherCountries(row) {
  const fields = ['saudiArabia', 'uae', 'uk', 'usa', 'otherGcc', 'eu'];
  const known = finiteSum(fields.map((field) => row[field]));
  const otherCountries = Number.isFinite(row.total) && known != null && row.total >= known ? row.total - known : null;
  return {
    ...row,
    otherCountries,
    evidence: { ...row.evidence, otherCountries: { derivation: 'Published total remittances − sum of all displayed published corridor values',
      complete: otherCountries != null && ['total', ...fields].every((field) => row.evidence?.[field]),
      inputs: ['total', ...fields].map((field) => row.evidence?.[field]).filter(Boolean) } },
    observations: { ...row.observations, otherCountries: { observationDate: row.date, status: 'derived' } },
  };
}

export default function RemittancesSection() {
  const { compareMode, setCompareMode } = useShareableChartState('yoy');
    const { data, loading, error, retry } = useData('remittances.json');

    if (loading) return <LoadingCard label="Loading remittances…" />;
    if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load remittances" />;

    const { monthly = [], sourceCountries = [], lastUpdated: remLU, dataCoverage: remDC } = data;

    const cy = currentCalendarYear(monthly);
    const fy = currentFiscalYear(monthly);
    const fyReady = fytdViewReady(fy);
    const fytdReason = fytdDisabledReason(fy);
    const effectiveCompare = resolveCompareMode(compareMode, fy);
    const showYoY = effectiveCompare === 'yoy';
    const showFytd = effectiveCompare === 'fytd';
    const fytdTotal = buildFytdSeries(monthly, 'total');
    const corridorRows = monthly.map(withOtherCountries);
    const latestCorridor = corridorRows.at(-1);
    const corridorSummary = latestCorridor ? CORRIDORS
      .map((corridor) => ({
        label: corridor.label,
        field: corridor.field,
        value: latestCorridor[corridor.field],
        share: Number.isFinite(latestCorridor[corridor.field]) && latestCorridor.total > 0 ? (latestCorridor[corridor.field] / latestCorridor.total) * 100 : null,
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
          valueField: 'total',
          data: remValues,
          backgroundColor: COLORS.teal,
          borderColor: COLORS.teal,
          borderWidth: 1,
          borderRadius: 4,
        },
        ...(showRemCompare ? [{
          isComparison: true,
          label: remCompareLabel,
          valueField: 'total',
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
      valueField: corridor.field,
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
          label: (ctx) => `${ctx.dataset.label}: ${fmtUSD(ctx.raw)}`,
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
        valueField: 'value',
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
            { label: 'Total', value: fmtUSD(total), sub: chg.pct != null ? `${chg.pct > 0 ? '+' : ''}${chg.pct}% ${priorLabel}` : '', direction: chg.direction, sentiment: chg.direction === 'up' ? 'positive' : chg.direction === 'down' ? 'negative' : 'neutral', color: COLORS.teal,
              row: { evidence: period.rows.map((row) => row.evidence?.total || row.evidence) }, field: 'total', period: period.rangeLabel, derivation: 'Sum of published monthly remittances in the stated period' },
            { label: 'Monthly Avg', value: fmtUSD(avg), color: COLORS.blue,
              row: { evidence: period.rows.map((row) => row.evidence?.total || row.evidence) }, field: 'total', period: period.rangeLabel, derivation: 'Sum of published monthly remittances ÷ number of published months in the stated period' },
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
                title={formatFySummaryTitle(fy)}
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
          observationDates={corridorRows.map((row) => row.date)}
          evidenceRows={corridorRows}
          defaultRange="3y"
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
              row: latestCorridor, field: corridor.field, period: latestCorridor.date,
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
          observationDates={monthly.map((row) => row.date)}
          rangeMode={showFytd ? 'fiscal' : 'chronological'}
          description="Monthly remittance inflows in USD millions. Seasonal spikes typically occur during Ramadan, Eid, and the winter holiday period. Consistent growth reflects expanding diaspora and improved formal banking channels."
          source="State Bank of Pakistan"
          dataSource="SBP EasyData API"
          lastUpdated={remLU}
          dataCoverage={remDC}
          provenanceKeys={['remittances.monthly.total']}
        >
          <PeriodCompare
            mode={effectiveCompare}
            onChange={setCompareMode}
            modes={['yoy', 'fytd']}
            disabledModes={fytdReason ? { fytd: fytdReason } : {}}
            note={!fyReady && compareMode === 'fytd' ? fytdReason : null}
          />
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
