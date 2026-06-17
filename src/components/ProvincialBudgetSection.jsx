import { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, COLOR_LIST, baseBarOptions, baseDoughnutOptions } from '../utils/chartConfig';
import SectionHeader from './SectionHeader';
import SummaryCard from './ui/SummaryCard';
import ChartCard from './ChartCard';
import GoodBadUgly from './ui/GoodBadUgly';
import './ui/Budget.css';

function fmtBn(val) {
  if (val == null || Number.isNaN(val)) return '—';
  if (val < 0) return `−${fmtBn(-val)}`;
  if (Math.abs(val) >= 1000) return `₨${(val / 1000).toFixed(2)} tn`;
  return `₨${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} bn`;
}

const PROVINCE_COLORS = {
  punjab: COLORS.teal,
  sindh: COLORS.blue,
  kp: COLORS.amber,
  balochistan: COLORS.purple,
};

// 2023 Digital Census (PBS) — used only for per-capita budget context.
const CENSUS_2023_POP = {
  punjab: 127688922,
  sindh: 55696147,
  kp: 40856097,
  balochistan: 14894402,
};
const PROVINCE_NAME = { punjab: 'Punjab', sindh: 'Sindh', kp: 'KP', balochistan: 'Balochistan' };

export default function ProvincialBudgetSection() {
  const { data, loading, error } = useData('budget-provincial.json');
  const [fy, setFy] = useState(null);
  const [activeProvince, setActiveProvince] = useState(null);

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading provincial budgets…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { provinces = [], fiscalYears = [], lastUpdated, lastVerified, methodologyNote } = data;
  if (provinces.length === 0) return <p>No provincial budget data available.</p>;

  const selectedFy = fy || fiscalYears[0];
  const provinceId = activeProvince || provinces[0].id;

  // Row for each province for the selected FY
  const rows = provinces.map((p) => ({
    province: p,
    yr: (p.years || []).find((y) => y.fy === selectedFy),
  }));

  // ── NFC transfers across ALL provinces — pin to the most recent fiscal year for
  //    which EVERY province records a federalTransfers figure (avoids mixing years). ──
  const nfcFy = fiscalYears
    .find((y) => provinces.every((p) => (p.years || []).some((yr) => yr.fy === y && yr.federalTransfers != null)))
    || null;
  const nfcRows = nfcFy
    ? provinces.map((p) => {
        const yr = (p.years || []).find((y) => y.fy === nfcFy);
        return { name: p.name, id: p.id, value: yr.federalTransfers };
      })
    : [];
  const hasNfc = nfcRows.length > 0;
  const nfcTotal = nfcRows.reduce((s, r) => s + r.value, 0);
  const nfcData = {
    labels: nfcRows.map((r) => r.name),
    datasets: [
      {
        label: 'Federal NFC transfer',
        data: nfcRows.map((r) => r.value),
        backgroundColor: nfcRows.map((r) => PROVINCE_COLORS[r.id] || COLORS.teal),
        borderWidth: 0,
      },
    ],
  };
  const nfcOptions = {
    ...baseDoughnutOptions,
    plugins: {
      ...baseDoughnutOptions.plugins,
      tooltip: {
        ...baseDoughnutOptions.plugins?.tooltip,
        callbacks: {
          label: (ctx) => {
            const share = nfcTotal ? ((ctx.raw / nfcTotal) * 100).toFixed(1) : '0';
            return `${ctx.label}: ${fmtBn(ctx.raw)} (${share}%)`;
          },
        },
      },
    },
  };

  // Comparison chart — outlay, development & federal transfers across provinces (selected FY)
  const labels = rows.map((r) => r.province.name);
  const compareData = {
    labels,
    datasets: [
      { label: 'Total outlay', data: rows.map((r) => r.yr?.totalOutlay ?? null), backgroundColor: COLORS.teal, borderRadius: 4 },
      { label: 'Development (ADP)', data: rows.map((r) => r.yr?.adp ?? null), backgroundColor: COLORS.amber, borderRadius: 4 },
      { label: 'Federal transfers', data: rows.map((r) => r.yr?.federalTransfers ?? null), backgroundColor: COLORS.blue, borderRadius: 4 },
    ],
  };
  const compareHasData = compareData.datasets.some((ds) => ds.data.some((v) => v != null));
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

  // Selected province deep-dive
  const prov = provinces.find((p) => p.id === provinceId) || provinces[0];
  const py = (prov.years || []).find((y) => y.fy === selectedFy) || null;
  const accent = PROVINCE_COLORS[prov.id] || COLORS.teal;

  // Per-province key allocations chart from numeric highlights
  const numericHl = (py?.highlights || []).filter((hl) => hl && typeof hl === 'object' && typeof hl.value === 'number');
  const hasAllocChart = numericHl.length >= 2;
  const allocData = {
    labels: numericHl.map((hl) => hl.label),
    datasets: [
      {
        label: 'Allocation',
        data: numericHl.map((hl) => hl.value),
        backgroundColor: numericHl.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
        borderRadius: 4,
      },
    ],
  };
  const allocOptions = {
    ...baseBarOptions,
    indexAxis: 'y',
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...baseBarOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.label}: ${fmtBn(ctx.raw)}`,
          afterLabel: (ctx) => (numericHl[ctx.dataIndex]?.note ? numericHl[ctx.dataIndex].note : ''),
        },
      },
    },
    scales: {
      x: { ...baseBarOptions.scales.x, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
      y: { ...baseBarOptions.scales.y, grid: { display: false } },
    },
  };

  const provItems = py ? [
    { label: 'Total outlay', value: fmtBn(py.totalOutlay), sentiment: 'neutral' },
    { label: 'Federal transfers', value: fmtBn(py.federalTransfers), sub: 'NFC + straight transfers', sentiment: 'neutral' },
    { label: 'Own-source tax', value: fmtBn(py.ownTaxRevenue), sentiment: 'neutral' },
    { label: 'Development (ADP)', value: fmtBn(py.adp), sentiment: 'neutral' },
    {
      label: 'Surplus / (deficit)',
      value: fmtBn(py.surplus),
      sentiment: (py.surplus ?? 0) >= 0 ? 'positive' : 'negative',
      color: (py.surplus ?? 0) >= 0 ? COLORS.teal : COLORS.coral,
    },
  ] : [];

  // ── Provincial cash surplus: actual delivered vs full-year target ──
  const ps = data.provincialSurplus;
  const psRows = ps ? provinces
    .map((p) => ({ id: p.id, name: p.name, value: ps.byProvince?.[p.id] }))
    .filter((r) => r.value != null) : [];
  const hasSurplus = psRows.length > 0;
  const surplusData = {
    labels: psRows.map((r) => r.name),
    datasets: [{
      label: 'Cash surplus delivered',
      data: psRows.map((r) => r.value),
      backgroundColor: psRows.map((r) => PROVINCE_COLORS[r.id] || COLORS.teal),
      borderRadius: 4,
    }],
  };
  const surplusOptions = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
      tooltip: { ...baseBarOptions.plugins.tooltip, callbacks: { label: (ctx) => `${ctx.label}: ${fmtBn(ctx.raw)}` } },
    },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR Billion', color: COLORS.text } },
    },
  };

  // ── Computed comparative insights for the selected province / FY ──
  const devShare = py?.adp != null && py?.totalOutlay ? (py.adp / py.totalOutlay) * 100 : null;
  const autonomy = py?.ownTaxRevenue != null && py?.totalOutlay ? (py.ownTaxRevenue / py.totalOutlay) * 100 : null;
  const pop = CENSUS_2023_POP[prov.id];
  const perCapita = py?.totalOutlay != null && pop ? (py.totalOutlay * 1e9) / pop : null; // PKR per person
  const insightItems = py ? [
    devShare != null && {
      label: 'Development share',
      value: `${devShare.toFixed(1)}%`,
      sub: 'ADP ÷ total outlay — how much is for new development vs running costs',
      sentiment: devShare >= 25 ? 'positive' : devShare >= 15 ? 'neutral' : 'negative',
      color: devShare >= 25 ? COLORS.teal : devShare >= 15 ? undefined : COLORS.coral,
    },
    autonomy != null && {
      label: 'Fiscal autonomy',
      value: `${autonomy.toFixed(1)}%`,
      sub: 'Own-tax ÷ outlay — the rest depends on federal transfers',
      sentiment: autonomy >= 20 ? 'positive' : autonomy >= 10 ? 'neutral' : 'negative',
      color: autonomy >= 20 ? COLORS.teal : autonomy >= 10 ? undefined : COLORS.coral,
    },
    perCapita != null && {
      label: 'Budget per person',
      value: `₨${Math.round(perCapita).toLocaleString()}`,
      sub: 'Total outlay ÷ 2023 census population',
      sentiment: 'neutral',
    },
  ].filter(Boolean) : [];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Provincial Budgets"
        description="Annual budgets of Pakistan's four provinces — Punjab, Sindh, Khyber Pakhtunkhwa and Balochistan. Provinces receive the bulk of their resources as federal transfers under the NFC Award, raise their own taxes, and are expected to run cash surpluses to help the consolidated national fiscal position. Figures are budgeted estimates from each province's Finance Department White Paper, in PKR billion."
        sourceLinks={[
          { label: 'Punjab Finance', url: 'https://finance.punjab.gov.pk' },
          { label: 'Sindh Finance', url: 'https://www.finance.gos.pk' },
          { label: 'KP Finance', url: 'https://finance.kp.gov.pk' },
          { label: 'Balochistan Finance', url: 'https://balochistan.gov.pk' },
        ]}
      />

      {fiscalYears.length > 1 && (
        <div className="budget-fy-toggle" role="tablist" aria-label="Fiscal year">
          {fiscalYears.map((y) => (
            <button
              key={y}
              role="tab"
              aria-selected={y === selectedFy}
              className={`budget-fy-btn ${y === selectedFy ? 'active' : ''}`}
              onClick={() => setFy(y)}
            >
              FY{y}
            </button>
          ))}
        </div>
      )}

      <div className="section-grid">
        {hasNfc && (
          <ChartCard
            title="Federal NFC Transfers by Province"
            description={`How the federal divisible pool is shared among the four provinces under the NFC Award (FY${nfcFy}). Punjab takes the largest share, broadly tracking population. These transfers are the dominant resource for every province — which is exactly why a federal tax shortfall squeezes all of them.`}
            source="Provincial Finance Departments / Dawn — NFC transfers"
            dataSource="Provincial Finance Departments"
            dataCoverage={`FY${nfcFy}`}
            lastUpdated={lastUpdated}
          >
            <div className="chart-container">
              <Doughnut data={nfcData} options={nfcOptions} />
            </div>
          </ChartCard>
        )}

        <ChartCard
          title="Provinces Compared — Outlay, Development & Transfers"
          description="Total budget outlay, development (Annual Development Programme) allocation and federal transfers for each province in the selected fiscal year, in PKR billion. Only provinces whose budget for this year could be independently sourced show bars; blanks are data we deliberately did not estimate."
          source="Provincial Finance Departments — White Papers"
          dataSource="Provincial Finance Departments"
          dataCoverage={`FY${selectedFy}`}
          lastUpdated={lastUpdated}
        >
          {compareHasData ? (
            <div className="chart-container">
              <Bar data={compareData} options={compareOptions} />
            </div>
          ) : (
            <p className="budget-empty">No independently-sourced outlay/ADP/transfer figures for FY{selectedFy}. See the NFC transfers chart and per-province detail below.</p>
          )}
        </ChartCard>
      </div>

      {hasSurplus && (
        <div className="budget-exec">
          <div className="budget-exec-head card">
            <h3>📊 Budget Execution — Provincial Cash Surpluses ({ps.period})</h3>
            <p>Provinces are required (under the IMF programme) to run combined cash surpluses to support the national fiscal position. This tracks what they <strong>actually</strong> delivered against the full-year target — a rare window into provincial budget performance, not just promises.</p>
          </div>

          <SummaryCard
            title={`Provincial cash surpluses — ${ps.period}`}
            accent={COLORS.purple}
            items={[
              { label: 'Combined surplus delivered', value: fmtBn(ps.actualTotal), sub: '9-month actual', sentiment: 'positive', color: COLORS.teal },
              { label: 'Full-year IMF target', value: fmtBn(ps.fullYearTarget), sub: 'required for the whole year', sentiment: 'neutral' },
              {
                label: 'Target met?',
                value: ps.actualTotal != null && ps.fullYearTarget ? `${((ps.actualTotal / ps.fullYearTarget) * 100).toFixed(0)}%` : '—',
                sub: ps.actualTotal > ps.fullYearTarget ? 'already beat the annual target in 9 months' : 'of the annual target so far',
                sentiment: ps.actualTotal > ps.fullYearTarget ? 'positive' : 'neutral',
                color: ps.actualTotal > ps.fullYearTarget ? COLORS.teal : undefined,
              },
            ]}
            footnote={`Source: ${ps.sources?.[0]?.label || 'Ministry of Finance — Fiscal Operations'}. ${ps.note || ''}`}
          />

          <ChartCard
            title="Cash Surplus Delivered by Province"
            description={`Cash surplus each province actually ran in the first nine months of FY2025-26, in PKR billion. The combined Rs${ps.actualTotal?.toLocaleString()}bn already exceeded the full-year IMF target of Rs${ps.fullYearTarget?.toLocaleString()}bn — though this partly reflects provinces under-spending their development budgets early in the year, which typically accelerates in the final quarter.`}
            source={ps.sources?.[0]?.label || 'Ministry of Finance — Fiscal Operations'}
            dataSource="Ministry of Finance — Fiscal Operations"
            dataCoverage={ps.period}
            lastUpdated={ps.asOf || lastUpdated}
          >
            <div className="chart-container">
              <Bar data={surplusData} options={surplusOptions} />
            </div>
          </ChartCard>

          {ps.sources?.length > 0 && (
            <div className="budget-disclaimer card">
              <details className="budget-sources">
                <summary>Execution sources &amp; references ({ps.sources.length})</summary>
                <ul>
                  {ps.sources.map((src) => (
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

      <div className="budget-province-tabs" role="tablist" aria-label="Province">
        {provinces.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === provinceId}
            className={`budget-province-btn ${p.id === provinceId ? 'active' : ''}`}
            style={p.id === provinceId ? { '--prov-accent': PROVINCE_COLORS[p.id] || COLORS.teal } : undefined}
            onClick={() => setActiveProvince(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {py ? (
        <>
          <SummaryCard
            title={`${prov.name} — FY${selectedFy}${py.status ? ` (${py.status})` : ''}`}
            accent={accent}
            items={provItems}
            footnote={`Source: ${prov.source || 'Provincial Finance Department White Paper'}. Budgeted estimates.`}
          />

          {insightItems.length > 0 && (
            <SummaryCard
              title={`${prov.name} — Computed Insights (FY${selectedFy})`}
              accent={accent}
              items={insightItems}
              footnote="Computed from the figures shown. Note: the scope of provincial ADP varies (some provinces quote total development including foreign-funded and federal PSDP), so development-share comparisons are indicative."
            />
          )}

          {hasAllocChart && (
            <div className="section-grid">
              <ChartCard
                title={`${prov.name} — Key Allocations`}
                description={`Major budgeted allocations for ${prov.name} in FY${selectedFy}, in PKR billion. Only line items the province published a specific rupee figure for are charted; see the full list below for qualitative measures.`}
                source={prov.source || 'Provincial Finance Department White Paper'}
                dataSource="Provincial Finance Departments"
                dataCoverage={`FY${selectedFy}`}
                lastUpdated={lastUpdated}
              >
                <div className="chart-container">
                  <Bar data={allocData} options={allocOptions} />
                </div>
              </ChartCard>
            </div>
          )}

          {py.highlights?.length > 0 && (
            <div className="budget-measures card">
              <h3>📌 {prov.name} — Key Allocations &amp; Measures</h3>
              <ul>
                {py.highlights.map((hl, i) => (
                  <li key={i}>
                    {typeof hl === 'string' ? hl : (
                      <>
                        {hl.label && <strong>{hl.label}: </strong>}
                        {hl.value != null ? fmtBn(hl.value) : ''}{hl.note ? ` — ${hl.note}` : ''}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <GoodBadUgly
            commentary={py.commentary}
            title={`${prov.name} Budget FY${selectedFy}: The Good, the Bad & the Ugly`}
          />

          {py.sources?.length > 0 && (
            <div className="budget-disclaimer card">
              <details className="budget-sources">
                <summary>{prov.name} sources &amp; references ({py.sources.length})</summary>
                <ul>
                  {py.sources.map((src) => (
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
        </>
      ) : (
        <p className="budget-empty">
          No FY{selectedFy} budget recorded for {prov.name}
          {(prov.years || []).length > 0 && (
            <> — available year{prov.years.length > 1 ? 's' : ''}: {prov.years.map((y) => `FY${y.fy}`).join(', ')}. Use the year toggle above to view it.</>
          )}
        </p>
      )}

      <div className="budget-disclaimer card">
        <p>ⓘ {methodologyNote || 'Provincial budget figures are budgeted estimates from official Finance Department White Papers. Commentary is editorial opinion, clearly labelled, grounded in the official figures shown.'}{lastVerified && <> Last verified: {lastVerified}.</>}</p>
      </div>
    </section>
  );
}
