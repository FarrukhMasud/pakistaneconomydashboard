import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseBarOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import { formatMonthYear, pctChange } from '../utils/periodHelpers';
import './ui/FbrTax.css';

const TAX_HEADS = [
  { key: 'incomeTax', label: 'Income / Direct Tax', color: COLORS.teal },
  { key: 'salesTax', label: 'Sales Tax', color: COLORS.blue },
  { key: 'fed', label: 'Federal Excise (FED)', color: COLORS.amber },
  { key: 'customs', label: 'Customs Duty', color: COLORS.purple },
];

/** Format a PKR-billion value as ₨ X,XXX bn (or ₨ X.XX tn when large). */
function fmtBn(val) {
  if (val == null || Number.isNaN(val)) return '—';
  if (Math.abs(val) >= 1000) return `₨ ${(val / 1000).toFixed(2)} tn`;
  return `₨ ${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} bn`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : '-01T00:00:00'));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function provenanceLabel(row) {
  if (row?.sourceType === 'secondary-attributed') {
    return 'Secondary report citing provisional FBR data';
  }
  if (row?.sourceType === 'official') {
    return row.provisional ? 'Official FBR publication · provisional' : 'Official FBR publication';
  }
  return row?.provisional ? 'Provisional; see source link' : null;
}

export default function FbrTaxSection() {
  const { data, loading, error } = useData('fbr-tax.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading FBR tax data…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const {
    monthly = [],
    fyTotals = [],
    fytd,
    annualTargets = [],
    dataSource,
    lastUpdated,
    lastVerified,
    verifiedFrom = [],
    methodologyNote,
    sourceUrl,
  } = data;

  const sorted = [...monthly].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map((d) => formatMonthYear(d.date));
  const tickCallback = (_v, idx) => (idx % 2 === 0 || idx === labels.length - 1 ? labels[idx] : '');

  // ── Latest month summary ──
  const latest = sorted.at(-1);
  // Prior year same month (YoY)
  const latestYm = latest?.date;
  const priorYearYm = latestYm ? `${Number(latestYm.slice(0, 4)) - 1}${latestYm.slice(4)}` : null;
  const priorYearMonth = sorted.find((d) => d.date === priorYearYm);
  const latestYoY = latest && priorYearMonth ? pctChange(latest.net, priorYearMonth.net) : { pct: null, direction: 'flat' };
  const latestVsTarget = latest?.target ? latest.net - latest.target : null;

  // ── Monthly net collection (bars coloured by provisional status) ──
  const netData = {
    labels,
    datasets: [
      {
        label: 'Net collection',
        data: sorted.map((d) => d.net ?? null),
        backgroundColor: sorted.map((d) => (d.provisional ? COLORS.amber : COLORS.teal)),
        borderRadius: 4,
      },
    ],
  };

  const netOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...baseBarOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `Net collection: ${fmtBn(ctx.raw)}`,
          afterBody: (items) => {
            const row = sorted[items[0].dataIndex];
            const notes = [];
            const provenance = provenanceLabel(row);
            if (provenance) notes.push(provenance);
            if (row?.target != null) {
              const diff = row.net - row.target;
              notes.push(`Target: ${fmtBn(row.target)} (${diff >= 0 ? '+' : '−'}${fmtBn(Math.abs(diff))})`);
            }
            const heads = TAX_HEADS.filter((h) => typeof row?.[h.key] === 'number');
            if (heads.length === TAX_HEADS.length) {
              notes.push('—');
              heads.forEach((h) => notes.push(`${h.label}: ${fmtBn(row[h.key])}`));
            }
            return notes;
          },
        },
      },
    },
    scales: {
      ...baseBarOptions.scales,
      x: { ...baseBarOptions.scales.x, ticks: { ...baseBarOptions.scales.x.ticks, callback: tickCallback } },
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
  };

  // ── Breakdown by tax head (only months with a full 4-way split) ──
  const breakdownRows = sorted.filter((d) =>
    TAX_HEADS.every((h) => typeof d[h.key] === 'number'),
  );
  const hasBreakdown = breakdownRows.length > 0;
  const breakdownLabels = breakdownRows.map((d) => formatMonthYear(d.date));
  const breakdownTick = (_v, idx) => (idx % 2 === 0 || idx === breakdownLabels.length - 1 ? breakdownLabels[idx] : '');
  const breakdownData = {
    labels: breakdownLabels,
    datasets: TAX_HEADS.map((h) => ({
      label: h.label,
      data: breakdownRows.map((d) => d[h.key]),
      backgroundColor: h.color,
      stack: 'heads',
      borderRadius: 2,
    })),
  };
  const breakdownOptions = {
    ...baseBarOptions,
    scales: {
      x: { ...baseBarOptions.scales.x, stacked: true, ticks: { ...baseBarOptions.scales.x.ticks, callback: breakdownTick } },
      y: { ...baseBarOptions.scales.y, stacked: true, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: { ...baseBarOptions.plugins.tooltip, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtBn(ctx.raw)}` } },
    },
  };

  // ── Annual target vs revised vs reported collection ──
  const hasTargets = annualTargets.length > 0;
  const targetData = {
    labels: annualTargets.map((d) => d.fy),
    datasets: [
      {
        label: 'Budget target',
        data: annualTargets.map((d) => d.budgetTarget ?? null),
        backgroundColor: COLORS.blue,
        borderRadius: 4,
      },
      {
        label: 'Revised target',
        data: annualTargets.map((d) => d.revisedTarget ?? null),
        backgroundColor: COLORS.amber,
        borderRadius: 4,
      },
      {
        label: 'Actual / stated estimate',
        data: annualTargets.map((d) => d.actual ?? d.estimate ?? null),
        backgroundColor: COLORS.teal,
        borderRadius: 4,
      },
    ],
  };
  const targetOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: {
        ...baseBarOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => (ctx.raw == null ? `${ctx.dataset.label}: —` : `${ctx.dataset.label}: ${fmtBn(ctx.raw)}`),
          afterBody: (items) => {
            const row = annualTargets[items[0].dataIndex];
            if (!row) return [];
            const out = [];
            const reported = row.actual ?? row.estimate;
            if (reported != null && row.budgetTarget != null) {
              const miss = reported - row.budgetTarget;
              out.push(`vs budget: ${miss >= 0 ? '+' : '−'}${fmtBn(Math.abs(miss))}`);
            }
            if (reported != null && row.revisedTarget != null) {
              const miss = reported - row.revisedTarget;
              out.push(`vs revised: ${miss >= 0 ? '+' : '−'}${fmtBn(Math.abs(miss))}`);
            }
            if (row.status) out.push(`(${row.status})`);
            return out;
          },
        },
      },
    },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
  };

  // ── FYTD run-rate: actual collection vs the pace required to hit target ──
  const annualForFytd = fytd ? annualTargets.find((d) => d.fyLabel === fytd.fyLabel) : null;
  const hasRunRate = !!(fytd && fytd.target != null);
  const runRateData = {
    labels: [fytd?.period || 'Fiscal year to date'],
    datasets: [
      { label: 'Required run-rate (period target)', data: [fytd?.target ?? null], backgroundColor: COLORS.blue, borderRadius: 4 },
      { label: 'Actual collected', data: [fytd?.net ?? null], backgroundColor: (fytd && fytd.net >= fytd.target) ? COLORS.teal : COLORS.coral, borderRadius: 4 },
      { label: 'Prior year (same period)', data: [fytd?.priorNet ?? null], backgroundColor: COLORS.purple, borderRadius: 4 },
    ],
  };
  const runRateGap = fytd && fytd.target != null ? fytd.net - fytd.target : null;
  const runRateOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: {
        ...baseBarOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fmtBn(ctx.raw)}`,
          afterBody: () => (runRateGap != null ? [`Gap vs pace: ${runRateGap >= 0 ? '+' : '−'}${fmtBn(Math.abs(runRateGap))}`] : []),
        },
      },
    },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
  };

  // ── Annual FY totals ──
  const hasFyTotals = fyTotals.length > 0;
  const fyData = {
    labels: fyTotals.map((d) => d.fy),
    datasets: [
      {
        label: 'Net collection (full FY)',
        data: fyTotals.map((d) => d.net),
        backgroundColor: fyTotals.map((d) => (d.provisional ? COLORS.amber : COLORS.teal)),
        borderRadius: 4,
      },
    ],
  };
  const fyOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...baseBarOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => fmtBn(ctx.raw),
          afterLabel: (ctx) => (fyTotals[ctx.dataIndex]?.provisional ? 'Provisional' : 'Final'),
        },
      },
    },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
  };

  // ── Summary card items ──
  const summaryItems = [];
  if (latest) {
    summaryItems.push({
      label: `Net collection · ${fmtDate(latest.date)}${latest.provisional ? ' (P)' : ''}`,
      value: fmtBn(latest.net),
      sub: latestYoY.pct != null ? `${latestYoY.pct >= 0 ? '+' : ''}${latestYoY.pct}% YoY` : undefined,
      direction: latestYoY.direction,
      sentiment: latestYoY.direction === 'up' ? 'positive' : latestYoY.direction === 'down' ? 'negative' : 'neutral',
    });
    if (latestVsTarget != null) {
      summaryItems.push({
        label: 'Latest month vs target',
        value: `${latestVsTarget >= 0 ? '+' : '−'}${fmtBn(Math.abs(latestVsTarget))}`,
        sub: latestVsTarget >= 0 ? 'Target met' : 'Shortfall',
        sentiment: latestVsTarget >= 0 ? 'positive' : 'negative',
        color: latestVsTarget >= 0 ? COLORS.teal : COLORS.coral,
      });
    }
  }
  if (fytd) {
    const fytdGrowth = fytd.priorNet ? pctChange(fytd.net, fytd.priorNet) : { pct: null, direction: 'flat' };
    summaryItems.push({
      label: `FYTD · ${fytd.period}`,
      value: fmtBn(fytd.net),
      sub: fytdGrowth.pct != null ? `${fytdGrowth.pct >= 0 ? '+' : ''}${fytdGrowth.pct}% vs prior FY` : undefined,
      direction: fytdGrowth.direction,
      sentiment: fytdGrowth.direction === 'up' ? 'positive' : 'neutral',
    });
    if (fytd.target != null) {
      const diff = fytd.net - fytd.target;
      summaryItems.push({
        label: 'FYTD vs target',
        value: `${diff >= 0 ? '+' : '−'}${fmtBn(Math.abs(diff))}`,
        sub: diff >= 0 ? 'Ahead of target' : 'Behind target',
        sentiment: diff >= 0 ? 'positive' : 'negative',
        color: diff >= 0 ? COLORS.teal : COLORS.coral,
      });
    }
  }

  // ── Latest reported annual result (headline) ──
  const latestActual = [...annualTargets].reverse().find((d) => d.actual != null && d.budgetTarget != null);
  if (latestActual) {
    const miss = latestActual.actual - latestActual.budgetTarget;
    summaryItems.push({
      label: `${latestActual.fy} result vs budget target`,
      value: `${miss >= 0 ? '+' : '−'}${fmtBn(Math.abs(miss))}`,
      sub: miss >= 0 ? 'Target met' : `${latestActual.status} shortfall`,
      sentiment: miss >= 0 ? 'positive' : 'negative',
      color: miss >= 0 ? COLORS.teal : COLORS.coral,
    });
  }
  const latestEstimate = [...annualTargets].reverse().find((d) => d.estimate != null);
  if (latestEstimate) {
    summaryItems.push({
      label: `${latestEstimate.fy} stated estimate`,
      value: fmtBn(latestEstimate.estimate),
      sub: 'Budget-speech estimate; not an FBR year-end actual',
      sentiment: 'neutral',
      color: COLORS.amber,
    });
  }

  return (
    <section className="fade-in">
      <SectionHeader
        title="FBR Tax Collection"
        description="Federal tax collection reported by the Federal Board of Revenue (FBR), Pakistan's largest source of government revenue. Figures are net of refunds in PKR billion. Official FBR figures and secondary reports attributed to provisional FBR data are explicitly distinguished; missing months are never estimated or interpolated."
        sourceLinks={[
          { label: 'FBR Official Site', url: 'https://www.fbr.gov.pk' },
          { label: 'FBR Press Releases', url: 'https://www.fbr.gov.pk/categ/press-releases/51147/131163' },
          ...(fytd?.source ? [{ label: fytd.sourceLabel || 'FYTD source', url: fytd.source }] : []),
        ]}
      />

      {summaryItems.length > 0 && (
        <SummaryCard
          title={fytd ? `FBR Revenue — ${fytd.fyLabel}` : 'FBR Revenue'}
          accent={COLORS.teal}
          items={summaryItems}
          footnote={`Source: ${dataSource}. Latest official numeric monthly release: January 2026; later aggregates are explicitly marked provisional and secondary-attributed.`}
        />
      )}

      <div className="section-grid">
        {hasTargets && (
          <ChartCard
            title="Tax Targets vs Reported Collection"
            description="The original budget target (blue), revised target (amber), and reported collection (teal). FY2025-26's Rs12.983T is a pre-year-end budget-speech estimate, not an FBR year-end actual; the chart and notes label it accordingly."
            source="FBR / Finance Division; secondary references identified below"
            dataSource={dataSource}
            lastUpdated={lastUpdated}
          >
            <div className="chart-container">
              <Bar data={targetData} options={targetOptions} />
            </div>
            <ul className="fbr-target-notes">
              {annualTargets
                .filter((d) => (d.actual != null || d.estimate != null) && d.budgetTarget != null)
                .map((d) => {
                  return (
                    <li key={d.fy}>
                      <strong>{d.fy}:</strong> {d.note}{' '}
                      {d.sources?.length > 0 && (
                        <span className="fbr-target-srcs">
                          {d.sources.map((s, i) => (
                            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
                              [{i + 1}]
                            </a>
                          ))}
                        </span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </ChartCard>
        )}

        {hasRunRate && (
          <ChartCard
            title="Run-Rate Tracker — Is FBR On Pace?"
            description={`Cumulative collection so far this fiscal year (${fytd.period}) against the run-rate needed to hit its target by this point, with the same period a year earlier for context. ${runRateGap != null && runRateGap < 0 ? `Reported collection is ₨${Math.abs(runRateGap).toLocaleString()}bn behind the required pace` : 'Reported collection is ahead of the required pace'}${annualForFytd?.budgetTarget ? `; the full-year target is ₨${annualForFytd.budgetTarget.toLocaleString()}bn` : ''}.`}
            source={fytd.sourceLabel || 'Provisional FBR reporting'}
            dataSource={dataSource}
            dataCoverage={fytd.period}
            lastUpdated={lastUpdated}
          >
            <div className="chart-container">
              <Bar data={runRateData} options={runRateOptions} />
            </div>
          </ChartCard>
        )}

        <ChartCard
          title="Monthly Net Collection vs Target"
          description="Available monthly net FBR collection in PKR billion. FY2024-25 comes from FBR's official table; for FY2025-26 only July 2025 (secondary-attributed) and January 2026 (official FBR release) are shown. Missing months are intentionally left absent rather than estimated."
          source="FBR official publications / identified secondary-attributed reports"
          dataSource={dataSource}
          dataCoverage={latest ? fmtDate(latest.date) : undefined}
          lastUpdated={lastUpdated}
        >
          <div className="chart-container">
            <Bar data={netData} options={netOptions} />
          </div>
        </ChartCard>

        {hasBreakdown && (
          <ChartCard
            title="Collection by Tax Head"
            description="Monthly net collection split across the four federal tax heads: Income/Direct Tax, Sales Tax, Federal Excise Duty (FED) and Customs Duty. Only months for which FBR published a complete four-way breakdown are shown."
            source="Federal Board of Revenue (FBR)"
            dataSource={dataSource}
            dataCoverage={breakdownRows.length ? fmtDate(breakdownRows.at(-1).date) : undefined}
            lastUpdated={lastUpdated}
          >
            <div className="chart-container">
              <Bar data={breakdownData} options={breakdownOptions} />
            </div>
          </ChartCard>
        )}

        {hasFyTotals && (
          <ChartCard
            title="Full-Year Collection by Fiscal Year"
            description="Total net FBR collection for each completed fiscal year (July–June). Amber bars indicate a provisional full-year figure that has not yet been finalised in the FBR Year Book."
            source="Federal Board of Revenue (FBR)"
            dataSource={dataSource}
            lastUpdated={lastUpdated}
          >
            <div className="chart-container">
              <Bar data={fyData} options={fyOptions} />
            </div>
          </ChartCard>
        )}
      </div>

      <div className="fbr-disclaimer card">
        <p>
          ⓘ {methodologyNote}
          {lastVerified && <> Last verified: {fmtDate(lastVerified)}.</>}
        </p>
        {verifiedFrom.length > 0 && (
          <details className="fbr-sources">
            <summary>Source press releases &amp; references ({verifiedFrom.length})</summary>
            <ul>
              {verifiedFrom.map((src) => (
                <li key={src.url || src}>
                  <a href={src.url || src} target="_blank" rel="noopener noreferrer">
                    {src.label || src.url || src}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="source-link-pill">
            🔗 FBR Federal Board of Revenue
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    </section>
  );
}
