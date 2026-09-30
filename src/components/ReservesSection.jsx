import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { useShareableChartState } from '../hooks/useShareableChartState';
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
import { LoadingCard, SectionState } from './ui/DataState';
import {
  currentCalendarYear,
  currentFiscalYear,
  pctChange,
  fmtUSD,
  formatMonthYear,
  formatDayMonthYear,
  buildYoYOverlay,
  buildFytdSeries,
  formatFySummaryTitle,
  fytdViewReady,
  resolveCompareMode,
  fytdDisabledReason,
} from '../utils/periodHelpers';

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.length <= 7) return formatMonthYear(dateStr);
  return formatDayMonthYear(dateStr);
}

export default function ReservesSection() {
  const { compareMode, focus, setCompareMode, setFocus } = useShareableChartState('yoy');
  const state = useData('reserves.json');
  const { data, loading } = state;
  const adequacy = useData('reserves-adequacy.json');

  if (loading) return <LoadingCard label="Loading reserves data…" />;
  if (!data) return <><SectionState state={state} label="Could not load reserves data" /><ReservesAdequacyTracker /></>;

  const timeSeries = data.weekly || data.monthly || [];
  const { dataSource, lastUpdated, dataCoverage } = data;

  const cy = currentCalendarYear(timeSeries);
  const fy = currentFiscalYear(timeSeries);
  const fyReady = fytdViewReady(fy);
  const fytdReason = fytdDisabledReason(fy);
  const effectiveCompare = resolveCompareMode(compareMode, fy);
  const showYoY = effectiveCompare === 'yoy';
  const showFytd = effectiveCompare === 'fytd';
  const fytdSbp = buildFytdSeries(timeSeries, 'sbp');
  const fytdTotal = buildFytdSeries(timeSeries, 'total');
  const { priorData: sbpPrior, priorLabel: sbpPriorLabel } = buildYoYOverlay(timeSeries, 'sbp', { matchGrain: true });

  const labels = showFytd && fytdSbp ? fytdSbp.labels : timeSeries.map((d) => formatDate(d.date));
  const tickInterval = Math.max(1, Math.floor(labels.length / 12));
  const tickCallback = (_val, idx) => (idx % tickInterval === 0 ? labels[idx] : '');

  const baseDatasets = showFytd && fytdSbp && fytdTotal
    ? [
        {
          label: `${fytdSbp.currentLabel} SBP reserves`,
          valueField: 'sbp',
          data: fytdSbp.current,
          borderColor: COLORS.teal,
          backgroundColor: COLORS.tealAlpha,
          fill: true,
          pointRadius: 1,
          pointHoverRadius: 5,
        },
        {
          label: `${fytdTotal.currentLabel} total`,
          valueField: 'total',
          data: fytdTotal.current,
          borderColor: COLORS.blue,
          backgroundColor: 'transparent',
          borderDash: [5, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        ...(fytdSbp.prior.some((v) => v != null) ? [{
          label: `${fytdSbp.priorLabel} SBP (same months)`,
          valueField: 'sbp',
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
          valueField: 'sbp',
          data: timeSeries.map((d) => d.sbp),
          borderColor: COLORS.teal,
          backgroundColor: COLORS.tealAlpha,
          fill: true,
          pointRadius: 1,
          pointHoverRadius: 5,
        },
        {
          label: 'Total (SBP + Banks)',
          valueField: 'total',
          data: timeSeries.map((d) => d.total),
          borderColor: COLORS.blue,
          backgroundColor: 'transparent',
          borderDash: [5, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        ...(showYoY && sbpPrior.some((v) => v != null) ? [{
          isComparison: true,
          label: sbpPriorLabel || 'Prior year SBP',
          valueField: 'sbp',
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
          label: (ctx) => `${ctx.dataset.label}: ${Number.isFinite(ctx.raw) ? formatCurrency(ctx.raw * 1e6) : 'Unavailable'}`,
        },
      },
    },
  };

  const latest = timeSeries[timeSeries.length - 1];
  const lowest = timeSeries.filter((row) => Number.isFinite(row.sbp)).reduce((min, row) => !min || row.sbp < min.sbp ? row : min, null);

  const importCoverMonths = adequacy.data?.current?.importCoverMonths;
  const importCoverLabel = adequacy.data?.current?.importCoverLabel || 'Goods-import cover';

  const cyItems = [];
  if (cy) {
    const startVal = cy.rows[0]?.sbp;
    const endVal = cy.rows[cy.rows.length - 1]?.sbp;
    const chg = pctChange(endVal, startVal);
    const delta = Number.isFinite(startVal) && Number.isFinite(endVal) ? endVal - startVal : null;
    cyItems.push(
      { label: 'SBP Reserves', row: latest, field: 'sbp', period: latest.date, value: fmtUSD(latest.sbp), sub: `${formatDate(latest.date)}${importCoverMonths != null ? ` · ${importCoverMonths} months ${importCoverLabel.toLowerCase()}` : ''}`, color: COLORS.teal },
      { label: 'Total (SBP + Banks)', row: latest, field: 'total', period: latest.date, value: fmtUSD(latest.total), sub: 'Includes commercial-bank reserves', color: COLORS.blue },
      { label: 'CY Change', value: delta == null ? '—' : `${delta >= 0 ? '+' : ''}${fmtUSD(delta)}`, direction: chg.direction, sentiment: delta == null ? 'neutral' : chg.direction === 'up' ? 'positive' : 'negative', sub: chg.pct == null ? null : `${chg.pct > 0 ? '+' : ''}${chg.pct}%`, row: { evidence: [latest.evidence?.sbp || latest.evidence, cy.rows[0]?.evidence?.sbp || cy.rows[0]?.evidence] }, period: cy.rangeLabel, derivation: 'Latest SBP reserves − first published SBP reserves in selected calendar year' },
    );
  }

  const fyItems = [];
  if (fy && fy.rows.length > 0) {
    const fyStart = fy.rows[0]?.sbp;
    const fyEnd = fy.rows[fy.rows.length - 1]?.sbp;
    const canCompare = fy.rows.length >= 2 && Number.isFinite(fyStart) && Number.isFinite(fyEnd);
    const fyChg = canCompare ? pctChange(fyEnd, fyStart) : { pct: null, direction: 'unavailable' };
    fyItems.push(
      { label: canCompare ? `Start of ${fy.fyLabel}` : `Latest · ${fy.fyLabel}`, row: canCompare ? fy.rows[0] : fy.rows.at(-1), field: 'sbp', value: fmtUSD(canCompare ? fyStart : fyEnd), sub: formatDate(canCompare ? fy.rows[0].date : fy.rows[fy.rows.length - 1].date), color: COLORS.blue },
    );
    if (canCompare) {
      fyItems.push(
        { label: 'FY change', row: { evidence: [fy.rows.at(-1)?.evidence?.sbp || fy.rows.at(-1)?.evidence, fy.rows[0]?.evidence?.sbp || fy.rows[0]?.evidence] }, period: fy.rangeLabel, derivation: 'Latest SBP reserves − first published SBP reserves in selected fiscal year', value: `${(fyEnd - fyStart) >= 0 ? '+' : ''}${fmtUSD(fyEnd - fyStart)}`, direction: fyChg.direction, sentiment: fyChg.direction === 'up' ? 'positive' : fyChg.direction === 'down' ? 'negative' : 'neutral', sub: fyChg.pct == null ? null : `${fyChg.pct > 0 ? '+' : ''}${fyChg.pct}%` },
      );
    }
    fyItems.push(
      { label: 'Lowest published observation', value: fmtUSD(lowest?.sbp), sub: formatDate(lowest?.date), color: COLORS.coral, row: lowest, field: 'sbp', period: lowest?.date, derivation: 'Minimum of available published SBP observations; gaps excluded' },
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
              row={latest}
              period={latest?.date}
              footnote={`${cy.months} data points · Source: ${dataSource || 'SBP'}`}
              provenanceKeys={['reserves.weekly.total']}
            />
          )}
          {fyItems.length > 0 && (
            <SummaryCard
              title={formatFySummaryTitle(fy)}
              accent={COLORS.blue}
              items={fyItems}
              period={fy.fyLabel}
              footnote={`${fy.months} data points · ${dataCoverage || 'Available period'}`}
            />
          )}
        </div>
      )}

      <ChartCard
        title="Foreign Exchange Reserves"
        evidenceRows={timeSeries}
        observationDates={timeSeries.map((row) => row.date)}
        rangeMode={showFytd ? 'fiscal' : 'chronological'}
        description="SBP gross reserves (solid) and total reserves including commercial banks (dashed). Use YoY overlay or FYTD vs prior FY to compare the recovery path. Reserve cover is the single most-watched measure of Pakistan's ability to meet external obligations."
        noteKey="reserves.recovery"
        dataSource={dataSource}
        lastUpdated={lastUpdated}
        dataCoverage={dataCoverage}
        provenanceKeys={['reserves.weekly.total']}
      >
        <PeriodCompare
          mode={effectiveCompare}
          onChange={setCompareMode}
          modes={['yoy', 'fytd']}
          disabledModes={fytdReason ? { fytd: fytdReason } : {}}
          note={!fyReady && compareMode === 'fytd' ? fytdReason : null}
        />
        <SeriesFocus labels={seriesLabels.slice(0, 2)} focus={focus} onChange={setFocus} />
        <div style={{ height: 350 }}>
          <Line data={chartData} options={options} />
        </div>
      </ChartCard>

      <ReservesAdequacyTracker />
    </section>
  );
}
