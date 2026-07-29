import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import {
  COLORS,
  baseLineOptions,
  formatCurrency,
} from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import PeriodCompare from './ui/PeriodCompare';
import SeriesFocus from './ui/SeriesFocus';
import { applySeriesFocus } from '../utils/seriesFocus';
import ReservesAdequacyTracker from './ReservesAdequacyTracker';
import { LoadingCard, ErrorCard, UnavailableCard } from './ui/DataState';
import {
  currentCalendarYear,
  currentFiscalYear,
  pctChange,
  fmtUSD,
  formatMonthYear,
  formatDayMonthYear,
  buildYoYOverlay,
  buildFytdSeries,
} from '../utils/periodHelpers';

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.length <= 7) return formatMonthYear(dateStr);
  return formatDayMonthYear(dateStr);
}

export default function ReservesSection() {
  const [compareMode, setCompareMode] = useState('off');
  const [focus, setFocus] = useState(null);
  const showYoY = compareMode === 'yoy';
  const showFytd = compareMode === 'fytd';
  const { data, loading, error, retry } = useData('reserves.json');
  const adequacy = useData('reserves-adequacy.json');

  if (loading) return <LoadingCard label="Loading reserves data…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load reserves data" />;

  const timeSeries = data.weekly || data.monthly || [];
  const { dataSource, lastUpdated, dataCoverage } = data;

  if (!timeSeries.length) {
    return <UnavailableCard label="Could not load reserves data" reason="Reserves series is empty." />;
  }

  const cy = currentCalendarYear(timeSeries);
  const fy = currentFiscalYear(timeSeries);
  const fytdSbp = buildFytdSeries(timeSeries, 'sbp');
  const fytdTotal = buildFytdSeries(timeSeries, 'total');
  const { priorData: sbpPrior, priorLabel: sbpPriorLabel } = buildYoYOverlay(timeSeries, 'sbp');

  const labels = showFytd && fytdSbp ? fytdSbp.labels : timeSeries.map((d) => formatDate(d.date));
  const tickInterval = Math.max(1, Math.floor(labels.length / 12));
  const tickCallback = (_val, idx) => (idx % tickInterval === 0 ? labels[idx] : '');

  const baseDatasets = showFytd && fytdSbp && fytdTotal
    ? [
        {
          label: `${fytdSbp.currentLabel} SBP reserves`,
          data: fytdSbp.current,
          borderColor: COLORS.teal,
          backgroundColor: COLORS.tealAlpha,
          fill: true,
          pointRadius: 1,
          pointHoverRadius: 5,
        },
        {
          label: `${fytdTotal.currentLabel} total`,
          data: fytdTotal.current,
          borderColor: COLORS.blue,
          backgroundColor: 'transparent',
          borderDash: [5, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        ...(fytdSbp.prior.some((v) => v != null) ? [{
          label: `${fytdSbp.priorLabel} SBP (same months)`,
          data: fytdSbp.prior,
          borderColor: COLORS.amber,
          backgroundColor: 'transparent',
          borderDash: [4, 3],
          pointRadius: 0,
          pointHoverRadius: 3,
        }] : []),
      ]
    : [
        {
          label: 'SBP Reserves (USD M)',
          data: timeSeries.map((d) => d.sbp),
          borderColor: COLORS.teal,
          backgroundColor: COLORS.tealAlpha,
          fill: true,
          pointRadius: 1,
          pointHoverRadius: 5,
        },
        {
          label: 'Total (SBP + Banks)',
          data: timeSeries.map((d) => d.total),
          borderColor: COLORS.blue,
          backgroundColor: 'transparent',
          borderDash: [5, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        ...(showYoY && sbpPrior.some((v) => v != null) ? [{
          label: sbpPriorLabel || 'Prior year SBP',
          data: sbpPrior,
          borderColor: COLORS.amber,
          backgroundColor: 'transparent',
          borderDash: [4, 3],
          pointRadius: 0,
          pointHoverRadius: 3,
        }] : []),
      ];

  const chartData = {
    labels,
    datasets: applySeriesFocus(baseDatasets, focus),
  };

  const options = {
    ...baseLineOptions,
    scales: {
      x: {
        ...baseLineOptions.scales.x,
        ticks: { ...baseLineOptions.scales.x.ticks, callback: tickCallback },
      },
      y: {
        ...baseLineOptions.scales.y,
        title: { display: true, text: 'USD Millions', color: COLORS.text },
        ticks: {
          ...baseLineOptions.scales.y?.ticks,
          callback: (v) => '$' + (v / 1000).toFixed(0) + 'B',
        },
      },
    },
    plugins: {
      ...baseLineOptions.plugins,
      tooltip: {
        ...baseLineOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw * 1e6)}`,
        },
      },
    },
  };

  const latest = timeSeries[timeSeries.length - 1];
  const lowest = timeSeries.reduce((min, d) => (d.sbp < min.sbp ? d : min), timeSeries[0]);

  const importCoverMonths = adequacy.data?.current?.importCoverMonths;
  const importCoverLabel = adequacy.data?.current?.importCoverLabel || 'Goods-import cover';

  const cyItems = [];
  if (cy) {
    const startVal = cy.rows[0]?.sbp;
    const endVal = cy.rows[cy.rows.length - 1]?.sbp;
    const chg = pctChange(endVal, startVal);
    cyItems.push(
      { label: 'SBP Reserves', value: fmtUSD(latest.sbp), sub: `${formatDate(latest.date)}${importCoverMonths != null ? ` · ${importCoverMonths} months ${importCoverLabel.toLowerCase()}` : ''}`, color: COLORS.teal },
      { label: 'Total (SBP + Banks)', value: fmtUSD(latest.total), sub: 'Includes commercial-bank reserves', color: COLORS.blue },
      { label: 'CY Change', value: `${(endVal - startVal) >= 0 ? '+' : ''}${fmtUSD(endVal - startVal)}`, direction: chg.direction, sentiment: chg.direction === 'up' ? 'positive' : 'negative', sub: `${chg.pct > 0 ? '+' : ''}${chg.pct}%` },
    );
  }

  const fyItems = [];
  if (fy && fy.rows.length > 0) {
    const fyStart = fy.rows[0]?.sbp;
    const fyEnd = fy.rows[fy.rows.length - 1]?.sbp;
    const fyChg = pctChange(fyEnd, fyStart);
    fyItems.push(
      { label: `Start of ${fy.fyLabel}`, value: fmtUSD(fyStart), sub: formatDate(fy.rows[0].date), color: COLORS.blue },
      { label: 'FYTD Change', value: `${(fyEnd - fyStart) >= 0 ? '+' : ''}${fmtUSD(fyEnd - fyStart)}`, direction: fyChg.direction, sentiment: fyChg.direction === 'up' ? 'positive' : 'negative', sub: `${fyChg.pct > 0 ? '+' : ''}${fyChg.pct}%` },
      { label: 'Lowest in Period', value: fmtUSD(lowest.sbp), sub: formatDate(lowest.date), color: COLORS.coral },
    );
  }

  const seriesLabels = baseDatasets.map((d) => d.label);

  return (
    <section className="fade-in">
      <SectionHeader
        title="Foreign Exchange Reserves"
        datasetId="reserves"
        description="Pakistan's foreign currency reserves held by the State Bank of Pakistan and commercial banks. The canonical goods-import-cover measure below uses SBP-held reserves and trailing official goods imports. Reserves hit critically low levels in early 2023 before recovering under successive IMF-supported programs."
        sourceLinks={[
          { label: 'SBP Reserves Data', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
        ]}
      />

      {(cyItems.length > 0 || fyItems.length > 0) && (
        <div className="summary-pair">
          {cyItems.length > 0 && (
            <SummaryCard
              title={`${cy.rangeLabel} — Calendar YTD`}
              accent={COLORS.teal}
              items={cyItems}
              footnote={`${cy.months} data points · Source: ${dataSource || 'SBP'}`}
              provenanceKeys={['reserves.weekly.total']}
            />
          )}
          {fyItems.length > 0 && (
            <SummaryCard
              title={`${fy.fyLabel} (${fy.rangeLabel}) — Fiscal YTD`}
              accent={COLORS.blue}
              items={fyItems}
              footnote={`${fy.months} data points · ${dataCoverage || 'Available period'}`}
            />
          )}
        </div>
      )}

      <ChartCard
        title="Foreign Exchange Reserves"
        description="SBP gross reserves (solid) and total reserves including commercial banks (dashed). Use YoY overlay or FYTD vs prior FY to compare the recovery path. Reserve cover is the single most-watched measure of Pakistan's ability to meet external obligations."
        noteKey="reserves.recovery"
        dataSource={dataSource}
        lastUpdated={lastUpdated}
        dataCoverage={dataCoverage}
        provenanceKeys={['reserves.weekly.total']}
      >
        <PeriodCompare mode={compareMode} onChange={setCompareMode} modes={['yoy', 'fytd']} />
        <SeriesFocus labels={seriesLabels.slice(0, 2)} focus={focus} onChange={setFocus} />
        <div style={{ height: 350 }}>
          <Line data={chartData} options={options} />
        </div>
      </ChartCard>

      <ReservesAdequacyTracker />
    </section>
  );
}
