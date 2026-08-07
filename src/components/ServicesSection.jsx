import { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, baseBarOptions, baseDoughnutOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import PeriodCompare from './ui/PeriodCompare';
import SeriesFocus from './ui/SeriesFocus';
import { applySeriesFocus } from '../utils/seriesFocus';
import { LoadingCard, ErrorCard, UnavailableCard } from './ui/DataState';
import { pctChange, formatMonthYear, buildYoYOverlay, buildFytdSeries } from '../utils/periodHelpers';

// SBP publishes the cumulative EBOPS services table later in the month than the
// monthly trade and reserves releases, so this section can sit one month behind
// the rest of the dashboard. Say so rather than leaving readers to guess.
const SERVICES_COVERAGE_NOTE =
  'This is the latest period SBP has published in its EBOPS services table. SBP releases this table after the monthly trade and reserves data, so it can lag the rest of the dashboard by a month. The headline totals at the top of this section come from the Balance of Payments summary, which SBP publishes one release earlier.';

export default function ServicesSection() {
  const [compareMode, setCompareMode] = useState('off');
  const [focus, setFocus] = useState(null);
  const showYoY = compareMode === 'yoy';
  const showFytd = compareMode === 'fytd';
  const { data, loading, error, retry } = useData('services.json');

  const setCompare = (mode) => {
    setCompareMode(mode);
    setFocus(null);
  };

  if (loading) return <LoadingCard label="Loading services data…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load services data" />;

  const { categories, itBreakdown, summary, comparison, recentMonths, itMonthly, monthlySeries, bopSummary } = data;

  if (!Array.isArray(categories) || !categories.length) {
    return <UnavailableCard label="Could not load services data" reason="Services category breakdown is empty." />;
  }

  // SBP's Balance of Payments summary carries the headline services aggregate a
  // release ahead of the detailed EBOPS table, so it can cover a later month
  // than every other chart in this section. Show it, and say where it came from.
  const bopCumulative = bopSummary?.cumulative || null;
  const bopMonth = bopSummary?.latestMonth || null;

  // ── Monthly IT & Freelance exports (accumulating series + momentum snapshot) ──
  // SBP EBOPS only accumulates a short monthly series in our pipeline; YoY/FYTD
  // overlays need prior-year months that are often missing. When the series is
  // too thin, fall back to itMonthly point comparisons (latest vs year-ago /
  // FYTD vs prior FY) so PeriodCompare still changes the chart.
  const mseries = monthlySeries || [];
  const mseriesRows = mseries.map((m) => ({ date: m.month, itCredit: m.itCredit, freelanceCredit: m.freelanceCredit }));
  const fytdIt = buildFytdSeries(mseriesRows, 'itCredit');
  const fytdFreelance = buildFytdSeries(mseriesRows, 'freelanceCredit');
  const { priorData: itPrior, priorLabel: itPriorLabel } = buildYoYOverlay(mseriesRows, 'itCredit');
  const { priorData: freelancePrior, priorLabel: freelancePriorLabel } = buildYoYOverlay(mseriesRows, 'freelanceCredit');
  const seriesHasYoY = itPrior.some((v) => v != null) || freelancePrior.some((v) => v != null);
  const seriesHasFytdPrior = Boolean(
    fytdIt?.prior?.some((v) => v != null) || fytdFreelance?.prior?.some((v) => v != null),
  );

  const detailItComp = itMonthly?.components?.find((c) => c.key === 'itTotal') || null;
  const itComp = data.itHeadline
    ? {
        key: 'itTotal',
        name: 'IT & Telecom (total)',
        latest: data.itHeadline.latest,
        prev: data.itHeadline.prev,
        yearAgo: data.itHeadline.yearAgo,
        fytd: data.itHeadline.fytd,
        fytdPrior: data.itHeadline.fytdPrior,
        latestMonth: data.itHeadline.latestMonth,
        yearAgoMonth: data.itHeadline.yearAgoMonth,
        fytdLabel: data.itHeadline.fytdLabel,
        fytdPriorLabel: data.itHeadline.fytdPriorLabel,
      }
    : detailItComp;
  const freelanceComp = itMonthly?.components?.find((c) => c.key === 'freelance') || null;
  const componentMonth = (component) => component?.latestMonth || itMonthly?.detailLatestMonth || itMonthly?.latestMonth;
  const componentYearAgoMonth = (component) => component?.yearAgoMonth || itMonthly?.detailYearAgoMonth || itMonthly?.yearAgoMonth;
  const componentFytdLabel = (component) => component?.fytdLabel || itMonthly?.detailFytdLabel || itMonthly?.fytdLabel;
  const componentFytdPriorLabel = (component) => component?.fytdPriorLabel || itMonthly?.detailFytdPriorLabel || itMonthly?.fytdPriorLabel;
  const pointComponents = [itComp, freelanceComp].filter((component) => (
    component?.latest != null
    && component?.yearAgo != null
    && componentMonth(component) === componentMonth(itComp)
    && componentYearAgoMonth(component) === componentYearAgoMonth(itComp)
  ));
  const fytdComponents = [itComp, freelanceComp].filter((component) => (
    component?.fytd != null
    && component?.fytdPrior != null
    && componentFytdLabel(component) === componentFytdLabel(itComp)
    && componentFytdPriorLabel(component) === componentFytdPriorLabel(itComp)
  ));
  const pointYoYReady = Boolean(
    itComp?.latest != null && itComp?.yearAgo != null,
  );
  const pointFytdReady = Boolean(
    itComp?.fytd != null && itComp?.fytdPrior != null,
  );

  let monthlyItData = null;
  let monthlyItYTitle = 'USD Millions / month';
  let monthlyItCompareNote = null;

  if (showYoY && !seriesHasYoY && pointYoYReady) {
    const labels = pointComponents.map((component) => component.name);
    const latestVals = pointComponents.map((component) => component.latest);
    const priorVals = pointComponents.map((component) => component.yearAgo);
    const latestLabel = componentMonth(itComp)
      ? formatMonthYear(componentMonth(itComp))
      : 'Latest month';
    const priorLabel = componentYearAgoMonth(itComp)
      ? formatMonthYear(componentYearAgoMonth(itComp))
      : 'Year ago';
    monthlyItData = {
      labels,
      datasets: applySeriesFocus([
        {
          label: priorLabel,
          data: priorVals,
          backgroundColor: 'rgba(66, 165, 245, 0.45)',
          borderRadius: 4,
        },
        {
          label: latestLabel,
          data: latestVals,
          backgroundColor: COLORS.teal,
          borderRadius: 4,
        },
      ], focus),
    };
    monthlyItYTitle = 'USD Millions';
    monthlyItCompareNote = `YoY uses SBP’s published same-month-last-year headline (${priorLabel} vs ${latestLabel}). Lagging EBOPS subcomponents are excluded when their coverage period differs.`;
  } else if (showFytd && !seriesHasFytdPrior && pointFytdReady) {
    const labels = fytdComponents.map((component) => component.name);
    const currentVals = fytdComponents.map((component) => component.fytd);
    const priorVals = fytdComponents.map((component) => component.fytdPrior);
    monthlyItData = {
      labels,
      datasets: applySeriesFocus([
        {
          label: componentFytdPriorLabel(itComp) || 'Prior FYTD',
          data: priorVals,
          backgroundColor: 'rgba(66, 165, 245, 0.45)',
          borderRadius: 4,
        },
        {
          label: componentFytdLabel(itComp) || 'Current FYTD',
          data: currentVals,
          backgroundColor: COLORS.teal,
          borderRadius: 4,
        },
      ], focus),
    };
    monthlyItYTitle = 'USD Millions (cumulative)';
    monthlyItCompareNote = `FYTD compares SBP’s cumulative headline totals (${componentFytdLabel(itComp) || 'current'} vs ${componentFytdPriorLabel(itComp) || 'prior'}). Lagging detailed components are excluded.`;
  } else if (mseries.length) {
    monthlyItData = {
      labels: showFytd && fytdIt ? fytdIt.labels : mseries.map((m) => formatMonthYear(m.month)),
      datasets: applySeriesFocus(
        showFytd && fytdIt && fytdFreelance
          ? [
              {
                label: `${fytdIt.currentLabel} IT & Telecom`,
                data: fytdIt.current,
                backgroundColor: COLORS.teal,
                borderRadius: 4,
              },
              {
                label: `${fytdFreelance.currentLabel} Freelance IT`,
                data: fytdFreelance.current,
                backgroundColor: COLORS.amber,
                borderRadius: 4,
              },
              ...(fytdIt.prior.some((v) => v != null) ? [{
                label: `${fytdIt.priorLabel} IT (same months)`,
                data: fytdIt.prior,
                backgroundColor: 'rgba(66, 165, 245, 0.35)',
                borderRadius: 4,
              }] : []),
              ...(fytdFreelance.prior.some((v) => v != null) ? [{
                label: `${fytdFreelance.priorLabel} Freelance (same months)`,
                data: fytdFreelance.prior,
                backgroundColor: 'rgba(255, 167, 38, 0.35)',
                borderRadius: 4,
              }] : []),
            ]
          : [
              {
                label: 'IT & Telecom',
                data: mseries.map((m) => m.itCredit),
                backgroundColor: COLORS.teal,
                borderRadius: 4,
              },
              {
                label: 'Freelance IT',
                data: mseries.map((m) => m.freelanceCredit),
                backgroundColor: COLORS.amber,
                borderRadius: 4,
              },
              ...(showYoY && itPrior.some((v) => v != null) ? [{
                label: itPriorLabel || 'Prior year IT',
                data: itPrior,
                backgroundColor: 'rgba(66, 165, 245, 0.35)',
                borderRadius: 4,
              }] : []),
              ...(showYoY && freelancePrior.some((v) => v != null) ? [{
                label: freelancePriorLabel || 'Prior year Freelance',
                data: freelancePrior,
                backgroundColor: 'rgba(255, 167, 38, 0.35)',
                borderRadius: 4,
              }] : []),
            ],
        focus,
      ),
    };
    if (showYoY && !seriesHasYoY) {
      monthlyItCompareNote = 'YoY overlay needs a prior-year month in the series; only the latest months are published so far.';
    } else if (showFytd && !seriesHasFytdPrior && !pointFytdReady) {
      monthlyItCompareNote = 'FYTD prior-year months are not yet available in the accumulating series.';
    }
  }

  const monthlyItOptions = {
    ...baseBarOptions,
    plugins: { ...baseBarOptions.plugins },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: monthlyItYTitle, color: COLORS.text } },
    },
  };

  // SeriesFocus labels differ between monthly trend and point-compare modes.
  const monthlyFocusLabels = (showYoY && !seriesHasYoY && pointYoYReady)
    || (showFytd && !seriesHasFytdPrior && pointFytdReady)
    ? (monthlyItData?.datasets || []).map((d) => d.label).filter(Boolean)
    : ['IT & Telecom', 'Freelance IT'];
  const momentumComponents = [
    itComp,
    ...(itMonthly?.components || []).filter((component) => component.key !== 'itTotal'),
  ].filter((component) => component?.latest != null);
  const itMomentum = itMonthly ? momentumComponents.map((c) => {
    const yoy = c.yearAgo ? pctChange(c.latest, c.yearAgo) : { pct: null, direction: 'flat' };
    const fy = c.fytdPrior ? pctChange(c.fytd, c.fytdPrior) : { pct: null };
    const sub = [
      componentMonth(c) ? `as of ${formatMonthYear(componentMonth(c))}` : null,
      yoy.pct != null ? `${yoy.pct >= 0 ? '+' : ''}${yoy.pct}% YoY` : null,
      fy.pct != null ? `FYTD ${fy.pct >= 0 ? '+' : ''}${fy.pct}%` : null,
    ].filter(Boolean).join(' · ');
    return {
      label: c.name,
      value: `$${c.latest}M`,
      sub,
      direction: yoy.direction,
      sentiment: yoy.direction === 'up' ? 'positive' : yoy.direction === 'down' ? 'negative' : 'neutral',
      color: c.key === 'freelance' ? COLORS.amber : c.key === 'itTotal' ? COLORS.teal : undefined,
    };
  }) : [];

  // Chart 1 — Service Categories by Credit (horizontal bar) with YoY comparison
    const sortedCats = [...categories].sort((a, b) => (b.credit ?? -Infinity) - (a.credit ?? -Infinity));
  const categoriesBarData = {
    labels: sortedCats.map((d) => d.name),
    datasets: [
      {
          label: comparison?.currentLabel || 'Current FYTD',
        data: sortedCats.map((d) => d.credit),
        backgroundColor: sortedCats.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
        borderRadius: 4,
      },
    ],
  };
    // Add prior year comparison bars if available (keep nulls so gaps stay visible)
    if (sortedCats.some((d) => d.priorCredit != null && d.priorCredit !== 0)) {
    categoriesBarData.datasets.push({
        label: comparison?.priorLabel || 'Prior FYTD',
        data: sortedCats.map((d) => (d.priorCredit == null ? null : d.priorCredit)),
      backgroundColor: sortedCats.map((_, i) => {
        const hex = COLOR_LIST[i % COLOR_LIST.length];
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},0.35)`;
      }),
      borderRadius: 4,
    });
  }

  const categoriesBarOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: { ...baseBarOptions.plugins },
    scales: {
      x: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text }, beginAtZero: true },
      y: { ...baseBarOptions.scales.x, grid: { display: false } },
    },
  };

  // Chart 2 — IT & Telecom Breakdown (doughnut)
    const itRows = Array.isArray(itBreakdown) ? itBreakdown : [];
    const itDoughnutData = itRows.length ? {
      labels: itRows.map((d) => d.name),
      datasets: [{
        data: itRows.map((d) => d.credit),
        backgroundColor: COLOR_LIST.concat(COLOR_LIST).slice(0, itRows.length),
        borderWidth: 0,
      }],
    } : null;

    const itDoughnutOptions = {
      ...baseDoughnutOptions,
      plugins: {
        ...baseDoughnutOptions.plugins,
        tooltip: {
          ...baseDoughnutOptions.plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.label}: $${ctx.raw}M` },
        },
      },
    };

    // Chart 3 — current vs prior fiscal-year-to-date comparison (grouped bar).
    // Prefer neutral current/prior keys; accept legacy fyXX only if both sides exist.
    const curLabel = comparison?.currentLabel || 'Current FYTD';
    const priorLabel = comparison?.priorLabel || 'Prior FYTD';
    const compPeriod = comparison?.period || 'FYTD';
    const legacyKeys = Object.keys(comparison || {}).filter((k) => /^fy\d{2}$/i.test(k)).sort();
    const legacyCurrent = legacyKeys.length ? comparison[legacyKeys[legacyKeys.length - 1]] : null;
    const legacyPrior = legacyKeys.length > 1 ? comparison[legacyKeys[legacyKeys.length - 2]] : null;
    const compCurrent = comparison?.current || legacyCurrent;
    const compPrior = comparison?.prior || legacyPrior;
    const hasComparison = Boolean(
      compCurrent
      && compPrior
      && compCurrent.totalCredit != null
      && compPrior.totalCredit != null
      && compCurrent.itCredit != null
      && compPrior.itCredit != null,
    );
    const comparisonBarData = hasComparison ? {
      labels: ['Total Services', 'IT & Telecom'],
      datasets: [
        { label: `${compPeriod} ${priorLabel}`, data: [compPrior.totalCredit, compPrior.itCredit], backgroundColor: COLORS.blue, borderRadius: 4 },
        { label: `${compPeriod} ${curLabel}`, data: [compCurrent.totalCredit, compCurrent.itCredit], backgroundColor: COLORS.teal, borderRadius: 4 },
      ],
    } : null;

  const comparisonOptions = {
    ...baseBarOptions,
    plugins: { ...baseBarOptions.plugins },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text } },
    },
  };

  // Chart 4 — Services Balance: Credit vs Debit (grouped horizontal bar)
  const topCatsForBalance = [...categories].sort((a, b) => (b.credit + Math.abs(b.debit)) - (a.credit + Math.abs(a.debit))).slice(0, 6);
  const balanceBarData = {
    labels: topCatsForBalance.map((d) => d.name),
    datasets: [
      { label: 'Credit (Exports)', data: topCatsForBalance.map((d) => d.credit), backgroundColor: COLORS.teal, borderRadius: 4 },
      { label: 'Debit (Imports)', data: topCatsForBalance.map((d) => Math.abs(d.debit)), backgroundColor: COLORS.coral, borderRadius: 4 },
    ],
  };

  const balanceBarOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: { ...baseBarOptions.plugins },
    scales: {
      x: { ...baseBarOptions.scales.y, title: { display: true, text: 'USD Millions', color: COLORS.text }, beginAtZero: true },
      y: { ...baseBarOptions.scales.x, grid: { display: false } },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="IT & Services Exports"
        datasetId="services"
        description="Pakistan's services trade classified by EBOPS (Extended Balance of Payments Services). IT & Telecom is the fastest-growing segment, with computer services (software consultancy, freelancing, and software exports) driving growth. This section includes a month-by-month view of IT and freelance exports with year-on-year momentum. Data from SBP's Balance of Payments detail tables."
        sourceLinks={[
          { label: 'SBP BOP Detail', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
          { label: 'PSEB', url: 'https://www.pseb.org.pk' },
        ]}
      />

      {bopCumulative && (
        <SummaryCard
          title={`Services trade headline — ${bopCumulative.period} ${bopCumulative.fiscalYear}`}
          accent={COLORS.purple}
          items={[
            { label: 'Exports of services (credit)', value: `$${bopCumulative.credit}M`, color: COLORS.teal },
            { label: 'Imports of services (debit)', value: `$${bopCumulative.debit}M`, color: COLORS.coral },
            {
              label: 'Balance on trade in services',
              value: `$${bopCumulative.net}M`,
              sentiment: bopCumulative.net >= 0 ? 'positive' : 'negative',
              color: bopCumulative.net >= 0 ? COLORS.teal : COLORS.coral,
            },
            ...(bopMonth ? [{
              label: `${bopMonth.period} ${bopMonth.fiscalYear} exports`,
              value: `$${bopMonth.credit}M`,
              sub: `Net $${bopMonth.net}M`,
              color: COLORS.blue,
            }] : []),
          ]}
          footnote={`SBP Balance of Payments (BPM6) summary, "Exports/Imports of Services" and "Balance on Trade in Services" rows${bopCumulative.status ? ` · ${bopCumulative.status}` : ''}. SBP publishes this aggregate a release ahead of the detailed EBOPS table, so it covers ${bopMonth ? `${bopMonth.period} ${bopMonth.fiscalYear}` : 'a later month'} while the category and IT breakdowns below stop at ${summary?.period || 'the previous month'}.`}
          provenanceKeys={['services.bop.cumulative', 'services.bop.latestMonth']}
        />
      )}

      {itMonthly && (
        <div className="monthly-it-spotlight">
          <ChartCard
            title="Monthly IT & Freelance Exports"
            description={`Monthly IT & Telecom export earnings use SBP’s latest headline table; Freelance IT uses the detailed EBOPS release and can lag by one month. ${mseries.length < 4 ? 'This series accumulates a new month with every SBP release and will lengthen into a fuller trend over time. ' : ''}Missing freelance bars indicate that SBP has not yet published that month’s detailed breakdown.`}
            source="SBP — services headline and EBOPS detail"
            dataSource="SBP"
            lastUpdated={data.lastUpdated}
            dataCoverage={componentMonth(itComp) ? `latest ${formatMonthYear(componentMonth(itComp))}` : data.dataCoverage}
          >
                      <PeriodCompare mode={compareMode} onChange={setCompare} modes={['yoy', 'fytd']} />
                      <SeriesFocus
                        labels={monthlyFocusLabels}
                        focus={focus}
                        onChange={setFocus}
                      />
                      {monthlyItCompareNote && (
                        <p className="muted-note" style={{ margin: '0.35rem 0 0.65rem', fontSize: '0.78rem' }}>
                          {monthlyItCompareNote}
                        </p>
                      )}
                      <div className="chart-container tall">
                        {monthlyItData
                          ? (
                            <Bar
                              key={`monthly-it-${compareMode}-${focus || 'all'}`}
                              data={monthlyItData}
                              options={monthlyItOptions}
                            />
                          )
                          : (
                            <p className="muted-note">No monthly IT series available for this release.</p>
                          )}
                      </div>
                    </ChartCard>
          <SummaryCard
            title="IT Export Momentum"
            accent={COLORS.teal}
            items={itMomentum}
            footnote={`IT & Telecom headline: ${componentFytdLabel(itComp)} vs ${componentFytdPriorLabel(itComp)} from SBP’s Exports and Imports of Goods & Services table. Subcomponents retain the latest available EBOPS coverage shown on each item.`}
          />
        </div>
      )}

      {summary && (() => {
              const totalGrowth = hasComparison ? pctChange(compCurrent.totalCredit, compPrior.totalCredit) : null;
              const itGrowth = hasComparison ? pctChange(compCurrent.itCredit, compPrior.itCredit) : null;
        return (
          <div className="summary-pair">
            <SummaryCard
              title={`${summary.period} — Services Summary`}
              accent={COLORS.teal}
              items={[
                { label: 'Total Services Credit', value: `$${summary.totalServicesCredit}M`, sub: totalGrowth ? `${totalGrowth.pct > 0 ? '+' : ''}${totalGrowth.pct}% YoY` : '', direction: totalGrowth?.direction, sentiment: totalGrowth?.direction === 'up' ? 'positive' : 'negative', color: COLORS.teal },
                { label: 'Services Net Balance', value: `$${summary.totalServicesNet}M`, sentiment: summary.totalServicesNet >= 0 ? 'positive' : 'negative', color: summary.totalServicesNet >= 0 ? COLORS.teal : COLORS.coral },
                { label: 'IT & Telecom Credit', value: `$${summary.itTelecomCredit}M`, sub: itGrowth ? `${itGrowth.pct > 0 ? '+' : ''}${itGrowth.pct}% YoY` : '', direction: itGrowth?.direction, sentiment: itGrowth?.direction === 'up' ? 'positive' : 'negative', color: COLORS.blue },
                { label: 'Computer Services', value: `$${summary.computerServicesCredit}M`, color: COLORS.amber },
              ]}
              footnote={`Source: SBP Balance of Payments · Last updated: ${data.lastUpdated || 'N/A'}`}
            />
            {recentMonths && recentMonths.length > 0 && (
              <SummaryCard
                title="Recent Monthly Performance"
                accent={COLORS.blue}
                items={recentMonths.map((m, i) => ({
                  label: m.month,
                  value: `$${m.totalCredit}M`,
                  sub: `IT: $${m.itCredit}M`,
                  color: i === 0 ? COLORS.blue : COLORS.purple,
                }))}
                footnote="Monthly services exports · Source: SBP"
              />
            )}
          </div>
        );
      })()}

      <div className="section-grid">
        <ChartCard
          title="Service Categories (Exports)"
          description={`Service categories ranked by credit (export) value, comparing ${curLabel} vs ${priorLabel}. IT & Telecom leads Pakistan's services exports.`}
          source="SBP"
          dataSource="SBP"
          lastUpdated={data.lastUpdated}
          dataCoverage={data.dataCoverage}
          coverageNote={SERVICES_COVERAGE_NOTE}
          provenanceKeys={['services.itTelecom.credit']}
        >
          <div className="chart-container">
            <Bar data={categoriesBarData} options={categoriesBarOptions} />
          </div>
        </ChartCard>
        <ChartCard
          title="IT & Telecom Breakdown"
          description="Breakdown of IT & Telecom exports by sub-category. Computer services (software consultancy, freelance IT, software exports) are the dominant contributor."
          source="SBP"
          dataSource="SBP"
          lastUpdated={data.lastUpdated}
          dataCoverage={data.dataCoverage}
          coverageNote={SERVICES_COVERAGE_NOTE}
        >
          <div className="chart-container">
                      {itDoughnutData
                        ? <Doughnut data={itDoughnutData} options={itDoughnutOptions} />
                        : <p className="muted-note">IT breakdown unavailable for this release.</p>}
                    </div>
                  </ChartCard>
                </div>

                <div className="section-grid" style={{ marginTop: '1.5rem' }}>
                  {hasComparison && comparisonBarData && (
                  <ChartCard
                    title={`${priorLabel} vs ${curLabel} Comparison`}
                    description={`Year-over-year comparison of cumulative services exports (${compPeriod}). Shows growth in total services and IT & Telecom exports.`}
                    source="SBP"
                    dataSource="SBP"
                    lastUpdated={data.lastUpdated}
                    dataCoverage={`${compPeriod} ${priorLabel} vs ${curLabel}`}
                    coverageNote={SERVICES_COVERAGE_NOTE}
                  >
                    <div className="chart-container">
                      <Bar data={comparisonBarData} options={comparisonOptions} />
                    </div>
                  </ChartCard>
                  )}
        <ChartCard
          title="Services Trade Balance"
          description="Credit (exports) vs Debit (imports) for top service categories. Green exceeding red = surplus. Transport shows a deficit due to high shipping costs."
          source="SBP"
          dataSource="SBP"
          lastUpdated={data.lastUpdated}
          dataCoverage={data.dataCoverage}
          coverageNote={SERVICES_COVERAGE_NOTE}
        >
          <div className="chart-container">
            <Bar data={balanceBarData} options={balanceBarOptions} />
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
