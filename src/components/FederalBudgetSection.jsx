import { useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, baseBarOptions, baseDoughnutOptions } from '../utils/chartConfig';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import ChartCard from './ChartCard';
import GoodBadUgly from './ui/GoodBadUgly';
import './ui/Budget.css';

/** Format a PKR-billion value as ₨ X,XXX bn (or ₨ X.XX tn when large). */
function fmtBn(val) {
  if (val == null || Number.isNaN(val)) return '—';
  if (Math.abs(val) >= 1000) return `₨${(val / 1000).toFixed(2)} tn`;
  return `₨${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} bn`;
}

function pct(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function deltaSub(cur, prev) {
  const p = pct(cur, prev);
  if (p == null) return {};
  return {
    sub: `${p >= 0 ? '+' : ''}${p.toFixed(1)}% vs prior FY`,
    direction: p > 0.5 ? 'up' : p < -0.5 ? 'down' : 'flat',
  };
}

export default function FederalBudgetSection() {
  const { data, loading, error } = useData('budget-federal.json');
  const [fyIndex, setFyIndex] = useState(0);

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading federal budget…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { years = [], source, dataSource, lastUpdated, lastVerified, methodologyNote } = data;
  if (years.length === 0) return <p>No budget data available.</p>;

  const year = years[fyIndex] || years[0];
  const prior = years[fyIndex + 1] || null;
  const h = year.headline || {};
  const ph = prior?.headline || {};

  const summaryItems = [
    { label: 'Total outlay', value: fmtBn(h.totalOutlay), ...deltaSub(h.totalOutlay, ph.totalOutlay), sentiment: 'neutral' },
    { label: 'FBR tax target', value: fmtBn(h.fbrTaxTarget), ...deltaSub(h.fbrTaxTarget, ph.fbrTaxTarget), sentiment: 'neutral' },
    {
      label: 'Fiscal deficit',
      value: fmtBn(h.fiscalDeficit),
      sub: h.fiscalDeficitPctGdp != null ? `${h.fiscalDeficitPctGdp}% of GDP` : undefined,
      sentiment: 'negative',
      color: COLORS.coral,
    },
    {
      label: 'Primary balance',
      value: h.primaryBalance != null
        ? fmtBn(h.primaryBalance)
        : (h.primaryBalancePctGdp != null ? `${h.primaryBalancePctGdp >= 0 ? '+' : ''}${h.primaryBalancePctGdp}% GDP` : '—'),
      sub: h.primaryBalancePctGdp != null
        ? `${h.primaryBalancePctGdp >= 0 ? 'Surplus' : 'Deficit'} · ${h.primaryBalancePctGdp}% of GDP`
        : undefined,
      sentiment: (h.primaryBalancePctGdp ?? 0) >= 0 ? 'positive' : 'negative',
      color: (h.primaryBalancePctGdp ?? 0) >= 0 ? COLORS.teal : COLORS.coral,
    },
    { label: 'Development (PSDP)', value: fmtBn(h.psdp), ...deltaSub(h.psdp, ph.psdp), sentiment: 'neutral' },
    {
      label: 'Targets',
      value: h.gdpGrowthTarget != null ? `${h.gdpGrowthTarget}% growth` : '—',
      sub: h.inflationTarget != null ? `${h.inflationTarget}% inflation` : undefined,
      sentiment: 'neutral',
    },
  ];

  // Where the rupee goes — current expenditure breakdown
  const exp = (year.currentExpenditure || []).filter((e) => typeof e.value === 'number');
  const expData = {
    labels: exp.map((e) => e.label),
    datasets: [{
      data: exp.map((e) => e.value),
      backgroundColor: exp.map((e, i) => e.color || COLOR_LIST[i % COLOR_LIST.length]),
      borderWidth: 0,
    }],
  };
  const expTotal = exp.reduce((s, e) => s + e.value, 0);
  const expOptions = {
    ...baseDoughnutOptions,
    plugins: {
      ...baseDoughnutOptions.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const share = expTotal ? ((ctx.raw / expTotal) * 100).toFixed(1) : '0';
            return `${ctx.label}: ${fmtBn(ctx.raw)} (${share}%)`;
          },
        },
      },
    },
  };

  // Where the rupee comes from — resources
  const res = (year.resources || []).filter((e) => typeof e.value === 'number');
  const resData = {
    labels: res.map((e) => e.label),
    datasets: [{
      data: res.map((e) => e.value),
      backgroundColor: res.map((e, i) => e.color || COLOR_LIST[i % COLOR_LIST.length]),
      borderWidth: 0,
    }],
  };
  const resTotal = res.reduce((s, e) => s + e.value, 0);
  const resOptions = {
    ...baseDoughnutOptions,
    plugins: {
      ...baseDoughnutOptions.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const share = resTotal ? ((ctx.raw / resTotal) * 100).toFixed(1) : '0';
            return `${ctx.label}: ${fmtBn(ctx.raw)} (${share}%)`;
          },
        },
      },
    },
  };

  // YoY headline comparison bars
  const compareKeys = [
    { key: 'totalOutlay', label: 'Outlay' },
    { key: 'fbrTaxTarget', label: 'FBR tax' },
    { key: 'psdp', label: 'PSDP' },
    { key: 'fiscalDeficit', label: 'Deficit' },
  ];
  const hasCompare = prior && compareKeys.some((k) => ph[k.key] != null && h[k.key] != null);
  const compareData = {
    labels: compareKeys.map((k) => k.label),
    datasets: [
      { label: prior?.label, data: compareKeys.map((k) => ph[k.key] ?? null), backgroundColor: COLORS.purple, borderRadius: 4 },
      { label: year.label, data: compareKeys.map((k) => h[k.key] ?? null), backgroundColor: COLORS.teal, borderRadius: 4 },
    ],
  };
  const compareOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: { ...baseBarOptions.plugins.tooltip, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtBn(ctx.raw)}` } },
    },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
  };

  // Debt servicing as a share of net revenue (computed from budget figures)
  const markup = (year.currentExpenditure || []).find((e) => e.key === 'markup')?.value ?? null;
  const debtToRevenue = markup != null && h.netRevenue ? (markup / h.netRevenue) * 100 : null;
  if (markup != null) {
    summaryItems.push({
      label: 'Debt servicing',
      value: fmtBn(markup),
      sub: debtToRevenue != null ? `${debtToRevenue.toFixed(0)}% of net revenue` : undefined,
      sentiment: 'negative',
      color: COLORS.coral,
    });
  }

  // ── Budget execution (actual vs prior-year, where available) ──
  const ex = year.execution;
  const exMetrics = ex?.metrics || [];
  const getM = (key) => exMetrics.find((m) => m.key === key);
  const exCompare = exMetrics.filter((m) => m.current != null && m.prior != null);
  const exCompareData = {
    labels: exCompare.map((m) => m.label),
    datasets: [
      { label: 'Prior year (9M)', data: exCompare.map((m) => m.prior), backgroundColor: COLORS.purple, borderRadius: 4 },
      { label: 'This year (9M)', data: exCompare.map((m) => m.current), backgroundColor: COLORS.teal, borderRadius: 4 },
    ],
  };
  const exCompareOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: {
        ...baseBarOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fmtBn(ctx.raw)}`,
          afterLabel: (ctx) => {
            const m = exCompare[ctx.dataIndex];
            if (ctx.datasetIndex === 1 && m?.currentPctGdp != null) return `${m.currentPctGdp}% of GDP`;
            return '';
          },
        },
      },
    },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
  };

  const gdpItem = (key, { betterWhen = 'lower' } = {}) => {
    const m = getM(key);
    if (!m) return null;
    const improved = m.priorPctGdp != null && m.currentPctGdp != null
      ? (betterWhen === 'lower' ? m.currentPctGdp < m.priorPctGdp : m.currentPctGdp > m.priorPctGdp)
      : null;
    return {
      label: m.label,
      value: m.currentPctGdp != null ? `${betterWhen === 'higher' && m.currentPctGdp >= 0 ? '+' : ''}${m.currentPctGdp}% of GDP` : fmtBn(m.current),
      sub: m.priorPctGdp != null ? `vs ${m.priorPctGdp}% last year${m.highlight ? ` · ${m.highlight}` : ''}` : (m.highlight || undefined),
      sentiment: improved == null ? 'neutral' : improved ? 'positive' : 'negative',
      color: improved == null ? undefined : improved ? COLORS.teal : COLORS.coral,
    };
  };
  const exItems = ex ? [
    gdpItem('fiscalDeficit', { betterWhen: 'lower' }),
    gdpItem('primarySurplus', { betterWhen: 'higher' }),
    {
      label: 'Interest (markup) paid',
      value: fmtBn(getM('interest')?.current),
      sub: getM('interest')?.prior != null ? `${fmtBn(getM('interest').prior)} a year earlier` : undefined,
      sentiment: 'positive',
      color: COLORS.teal,
    },
    gdpItem('totalExpenditure', { betterWhen: 'lower' }),
  ].filter(Boolean) : [];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Federal Budget"
        description="The Government of Pakistan's annual federal budget — total outlay, how money is raised (FBR taxes, non-tax revenue, borrowing), and how it is spent (debt servicing, defence, pensions, subsidies, development). Figures are the budgeted estimates from the Finance Division's 'Budget in Brief', in PKR billion. Pakistan's fiscal year runs July–June."
        sourceLinks={[
          { label: 'Finance Division — Budget', url: 'https://www.finance.gov.pk/budget_2026_27.html' },
          { label: 'Budget in Brief', url: 'https://www.finance.gov.pk/budget/Budget_in_Brief_2026_27.pdf' },
        ]}
      />

      <div className="budget-fy-toggle" role="tablist" aria-label="Fiscal year">
        {years.map((y, i) => (
          <button
            key={y.fy}
            role="tab"
            aria-selected={i === fyIndex}
            className={`budget-fy-btn ${i === fyIndex ? 'active' : ''}`}
            onClick={() => setFyIndex(i)}
          >
            {y.label}
            {y.status && <span className="budget-fy-status">{y.status}</span>}
          </button>
        ))}
      </div>

      <SummaryCard
        title={`Federal Budget — ${year.label}${year.presented ? ` (presented ${year.presented})` : ''}`}
        accent={COLORS.teal}
        items={summaryItems}
        footnote={`Source: ${source || dataSource}. Budgeted estimates; figures may be revised at year-end.`}
      />

      <div className="section-grid">
        {res.length > 0 && (
          <ChartCard
            title="Where the Rupee Comes From"
            description="Composition of gross federal revenue by source — FBR tax revenue versus non-tax revenue (SBP profits, petroleum levy, dividends and surcharges). The bulk of FBR collection is shared with the provinces under the NFC Award before the federal government spends what remains."
            source="Finance Division — Budget in Brief"
            dataSource={source || dataSource}
            lastUpdated={lastUpdated}
          >
            <div className="chart-container">
              <Doughnut data={resData} options={resOptions} />
            </div>
          </ChartCard>
        )}

        {exp.length > 0 && (
          <ChartCard
            title="Where the Rupee Goes"
            description="Composition of current (non-development) federal expenditure — markup/debt servicing, defence affairs, pensions, subsidies, grants and running of civil government — plus the development budget. The single largest line is almost always interest on debt."
            source="Finance Division — Budget in Brief"
            dataSource={source || dataSource}
            lastUpdated={lastUpdated}
          >
            <div className="chart-container">
              <Doughnut data={expData} options={expOptions} />
            </div>
          </ChartCard>
        )}

        {hasCompare && (
          <ChartCard
            title="This Year vs Last Year"
            description="Year-on-year comparison of the headline budget aggregates: total outlay, FBR tax target, development budget (PSDP) and the budgeted fiscal deficit, in PKR billion."
            source="Finance Division — Budget in Brief"
            dataSource={source || dataSource}
            lastUpdated={lastUpdated}
          >
            <div className="chart-container">
              <Bar data={compareData} options={compareOptions} />
            </div>
          </ChartCard>
        )}
      </div>

      {ex && (
        <div className="budget-exec">
          <div className="budget-exec-head card">
            <h3>📊 Budget Execution — {ex.period || 'Year-to-date actuals'}</h3>
            <p>How the government is <strong>actually</strong> performing against the budget it proposed. These are realised fiscal-operations figures (not budget estimates), so you can judge promises against delivery.</p>
          </div>

          {exItems.length > 0 && (
            <SummaryCard
              title={`Actuals — ${ex.period || year.label}`}
              accent={COLORS.purple}
              items={exItems}
              footnote={`Source: ${ex.publishedBy || 'Ministry of Finance — Fiscal Operations'}. Actual realised figures, ${ex.period || 'year-to-date'}.`}
            />
          )}

          {exCompare.length > 0 && (
            <ChartCard
              title="Actual Spend & Revenue — This Year vs Last Year"
              description="Realised federal fiscal aggregates compared with the same period a year earlier (PKR billion). A falling deficit and interest bill alongside a rising primary surplus indicates genuine consolidation; the % of GDP appears in the tooltip."
              source={ex.publishedBy || 'Ministry of Finance — Fiscal Operations'}
              dataSource={ex.publishedBy || source || dataSource}
              lastUpdated={ex.asOf || lastUpdated}
            >
              <div className="chart-container">
                <Bar data={exCompareData} options={exCompareOptions} />
              </div>
            </ChartCard>
          )}

          {ex.sources?.length > 0 && (
            <div className="budget-disclaimer card">
              <details className="budget-sources">
                <summary>Execution sources &amp; references ({ex.sources.length})</summary>
                <ul>
                  {ex.sources.map((src) => (
                    <li key={src.url || src.label}>
                      {src.url ? (
                        <a href={src.url} target="_blank" rel="noopener noreferrer">{src.label || src.url}</a>
                      ) : (src.label)}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {(year.taxMeasures?.length > 0) && (
        <div className="budget-measures card">
          <h3>🧾 Key Tax &amp; Policy Measures — {year.label}</h3>
          <ul>
            {year.taxMeasures.map((m, i) => <li key={i}>{typeof m === 'string' ? m : m.text}</li>)}
          </ul>
        </div>
      )}

      <GoodBadUgly
        commentary={year.commentary}
        title={`Budget ${year.label}: The Good, the Bad & the Ugly`}
      />

      <div className="budget-disclaimer card">
        <p>ⓘ {methodologyNote || 'Budget figures are budgeted estimates from official Finance Division documents. The commentary is editorial opinion, clearly labelled, and grounded in the official figures shown.'}{lastVerified && <> Last verified: {lastVerified}.</>}</p>
        {year.sources?.length > 0 && (
          <details className="budget-sources">
            <summary>Sources &amp; references ({year.sources.length})</summary>
            <ul>
              {year.sources.map((src) => (
                <li key={src.url || src.label}>
                  {src.url ? (
                    <a href={src.url} target="_blank" rel="noopener noreferrer">{src.label || src.url}</a>
                  ) : (src.label)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

