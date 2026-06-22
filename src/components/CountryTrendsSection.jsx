import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseLineOptions } from '../utils/chartConfig';
import ChartCard from './ChartCard';
import SectionHeader from './SectionHeader';
import { fmtUSD, formatMonthYear } from '../utils/periodHelpers';
import './ui/CountryTrends.css';

// Map a country card to its monthly remittance bucket in remittances.json (only
// these four corridors are published as discrete country series by SBP).
const REMIT_FIELD = {
  'Saudi Arabia': 'saudiArabia',
  'U.A.E.': 'uae',
  'United Kingdom': 'uk',
  'United States': 'usa',
};

const CORRIDORS = [
  { field: 'saudiArabia', label: 'Saudi Arabia', color: COLORS.teal },
  { field: 'uae', label: 'U.A.E.', color: COLORS.amber },
  { field: 'uk', label: 'United Kingdom', color: COLORS.blue },
  { field: 'usa', label: 'United States', color: COLORS.purple },
];

function pct(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function TrendChip({ value, caption, goodWhenUp = true }) {
  if (value == null) return <span className="trend-chip flat"><span className="trend-chip__cap">{caption}</span> —</span>;
  const rounded = Math.round(value * 10) / 10;
  const flat = Math.abs(rounded) < 0.05;
  const up = rounded > 0;
  const good = flat ? null : up === goodWhenUp;
  const cls = flat ? 'flat' : good ? 'pos' : 'neg';
  const arrow = flat ? '→' : up ? '▲' : '▼';
  return (
    <span className={`trend-chip ${cls}`}>
      <span className="trend-chip__cap">{caption}</span>
      {arrow} {Math.abs(rounded).toFixed(1)}%
    </span>
  );
}

function FlowRow({ icon, label, snap, latestMonth, goodWhenUp }) {
  if (!snap || snap.latest == null) return null;
  return (
    <div className="country-row">
      <span className="country-row__icon">{icon}</span>
      <span className="country-row__main">
        <span className="country-row__label">{label}</span>
        <span className="country-row__value">
          ${fmtUSD(snap.latest)}
          {latestMonth && <span className="month-tag">{formatMonthYear(latestMonth)}</span>}
        </span>
      </span>
      <span className="country-row__chips">
        <TrendChip value={pct(snap.latest, snap.prev)} caption="MoM" goodWhenUp={goodWhenUp} />
        <TrendChip value={pct(snap.latest, snap.yearAgo)} caption="YoY" goodWhenUp={goodWhenUp} />
      </span>
    </div>
  );
}

export default function CountryTrendsSection() {
  const { data: trade, loading: tLoading } = useData('trade.json');
  const { data: remit, loading: rLoading } = useData('remittances.json');

  const remitByCountry = useMemo(() => {
    const out = {};
    if (!remit?.monthly?.length) return out;
    const last = remit.monthly[remit.monthly.length - 1];
    const prev = remit.monthly[remit.monthly.length - 2];
    const yearAgo = remit.monthly[remit.monthly.length - 13];
    for (const [name, field] of Object.entries(REMIT_FIELD)) {
      out[name] = {
        latest: last?.[field] ?? null,
        prev: prev?.[field] ?? null,
        yearAgo: yearAgo?.[field] ?? null,
        month: last?.date ?? null,
      };
    }
    return out;
  }, [remit]);

  const corridorChart = useMemo(() => {
    if (!remit?.monthly?.length) return null;
    const rows = remit.monthly.slice(-36);
    return {
      labels: rows.map((d) => formatMonthYear(d.date)),
      datasets: CORRIDORS.map((c) => ({
        label: c.label,
        data: rows.map((d) => d[c.field]),
        borderColor: c.color,
        backgroundColor: c.color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
      })),
    };
  }, [remit]);

  if (tLoading || rLoading || !trade) {
    return <div className="card loading-card"><div className="spinner" /><span>Loading data…</span></div>;
  }

  const cm = trade.countryMonthly;
  if (!cm || !cm.countries?.length) {
    return (
      <section className="fade-in">
        <SectionHeader title="Country Trends" description="Per-country trade & remittance data is not available in the current dataset." />
      </section>
    );
  }

  const corridorOptions = {
    ...baseLineOptions,
    plugins: {
      ...baseLineOptions.plugins,
      legend: { display: true, position: 'top' },
    },
    scales: {
      ...baseLineOptions.scales,
      x: { ...baseLineOptions.scales.x, ticks: { ...baseLineOptions.scales.x.ticks, maxTicksLimit: 12 } },
      y: { ...baseLineOptions.scales.y, title: { display: true, text: 'USD Millions / month', color: COLORS.text } },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Country Trends"
        description="A partner-by-partner view of Pakistan's external sector — exports, imports and (where available) workers' remittances — for its most important trading and remittance partners. Each card shows the latest month with month-on-month (MoM) and year-on-year (YoY) momentum, plus fiscal-year-to-date totals versus the prior year. Watch for rising imports (red) outpacing exports, or softening remittances, as early signs of external-account pressure."
        sourceLinks={[{ label: 'SBP EasyData Portal', url: 'https://easydata.sbp.org.pk' }]}
      />

      <p className="country-trends__intro">
        Trade figures are SBP by-country export receipts and import payments (US$ million):
        latest month <b>{cm.latestMonth ? formatMonthYear(cm.latestMonth) : '—'}</b>, prior month{' '}
        <b>{cm.prevMonth ? formatMonthYear(cm.prevMonth) : '—'}</b>, year-ago{' '}
        <b>{cm.yearAgoMonth ? formatMonthYear(cm.yearAgoMonth) : '—'}</b>. Remittance corridors are
        monthly SBP workers'-remittance series. For exports and remittances, green ▲ is favourable;
        for imports, red ▲ flags a widening trade gap.
      </p>

      {corridorChart && (
        <div className="section-grid" style={{ marginBottom: '1.25rem' }}>
          <ChartCard
            title="Remittance Corridors — Monthly Trend"
            description="Monthly workers' remittances from Pakistan's four largest single-country corridors over the last 36 months. Saudi Arabia and the UAE dominate; sustained declines here are an early warning for the current account, while Ramadan/Eid and December typically bring seasonal spikes."
            source="State Bank of Pakistan"
            dataSource="SBP EasyData API"
            lastUpdated={remit?.lastUpdated}
            dataCoverage={remit?.dataCoverage}
          >
            <div className="chart-container">
              <Line data={corridorChart} options={corridorOptions} />
            </div>
          </ChartCard>
        </div>
      )}

      <div className="country-cards">
        {cm.countries.map((c) => {
          const balance = (c.exports?.fytd || 0) - (c.imports?.fytd || 0);
          const surplus = balance >= 0;
          const rem = remitByCountry[c.country];
          const expGrowth = pct(c.exports?.fytd, c.exports?.fytdPrior);
          const impGrowth = pct(c.imports?.fytd, c.imports?.fytdPrior);
          return (
            <div className="country-card" key={c.country}>
              <div className="country-card__head">
                <span className="country-card__flag">{c.flag}</span>
                <h3 className="country-card__name">{c.country}</h3>
                <span className={`balance-badge ${surplus ? 'surplus' : 'deficit'}`}>
                  {surplus ? 'Surplus' : 'Deficit'} ${fmtUSD(Math.abs(balance))}
                </span>
              </div>

              <FlowRow icon="🚢" label="Exports to" snap={c.exports} latestMonth={cm.latestMonth} goodWhenUp />
              <FlowRow icon="📦" label="Imports from" snap={c.imports} latestMonth={cm.latestMonth} goodWhenUp={false} />
              {rem && rem.latest != null && (
                <FlowRow icon="💸" label="Remittances from" snap={rem} latestMonth={rem.month} goodWhenUp />
              )}

              <div className="country-card__fytd">
                <span>Exports <b>${fmtUSD(c.exports?.fytd)}</b> {expGrowth != null && <em style={{ fontStyle: 'normal', color: expGrowth >= 0 ? COLORS.teal : COLORS.coral }}>({expGrowth >= 0 ? '+' : ''}{expGrowth.toFixed(1)}%)</em>}</span>
                <span>Imports <b>${fmtUSD(c.imports?.fytd)}</b> {impGrowth != null && <em style={{ fontStyle: 'normal', color: impGrowth >= 0 ? COLORS.coral : COLORS.teal }}>({impGrowth >= 0 ? '+' : ''}{impGrowth.toFixed(1)}%)</em>}</span>
              </div>
              <div className="country-card__fytd" style={{ borderTop: 'none', paddingTop: 0, marginTop: '-0.3rem' }}>
                <span style={{ fontSize: '0.68rem' }}>{cm.fytdLabel} vs {cm.fytdPriorLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="country-trends__note">
        {cm.note} Cards are ranked by total two-way trade (export receipts + import payments,
        fiscal-year-to-date). Remittance rows appear only for the four corridors SBP reports as
        discrete country series (Saudi Arabia, U.A.E., U.K., U.S.A.). Source: State Bank of Pakistan.
      </p>
    </section>
  );
}
