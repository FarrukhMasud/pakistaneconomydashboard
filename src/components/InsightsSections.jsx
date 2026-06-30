import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useData } from '../hooks/useData';
import { COLORS, baseBarOptions } from '../utils/chartConfig';
import DataFreshnessPanel from './DataFreshnessPanel';
import SectionHeader from './SectionHeader';
import './ui/Insights.css';

const SOURCE_LINKS = [
  { label: 'SBP', url: 'https://www.sbp.org.pk' },
  { label: 'PBS', url: 'https://www.pbs.gov.pk' },
  { label: 'Finance Division', url: 'https://www.finance.gov.pk' },
  { label: 'FBR', url: 'https://www.fbr.gov.pk' },
  { label: 'World Bank Data', url: 'https://data.worldbank.org' },
  { label: 'IMF Pakistan', url: 'https://www.imf.org/en/Countries/PAK' },
];

function LoadingCard({ label = 'Loading official data…' }) {
  return <div className="card loading-card"><div className="spinner" /><span>{label}</span></div>;
}

function fmt(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function signed(value, suffix = '', digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${fmt(value, digits)}${suffix}`;
}

function latest(rows = []) {
  return rows.at(-1) || null;
}

function previous(rows = []) {
  return rows.length > 1 ? rows.at(-2) : null;
}

function yoyRow(rows = [], date) {
  if (!date) return null;
  const [year, month] = date.split('-');
  return rows.find((row) => row.date === `${Number(year) - 1}-${month}`);
}

function pctChange(current, prior) {
  if (current == null || prior == null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function trendClass(value, positiveWhenUp = true) {
  if (value == null || Math.abs(value) < 0.05) return 'neutral';
  const positive = positiveWhenUp ? value > 0 : value < 0;
  return positive ? 'positive' : 'negative';
}

function toneFromStatus(status) {
  if (['met', 'strong', 'positive', 'ok'].includes(status)) return 'positive';
  if (['at risk', 'behind', 'pressure', 'negative'].includes(status)) return 'negative';
  return 'neutral';
}

function fmtPct(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${fmt(value)}%`;
}

function fmtPkrBn(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `₨${fmt(value, 0)}B`;
}

function ProgressMeter({ label, value, max, color = COLORS.teal, detail }) {
  const pct = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress-meter">
      <div className="progress-meter__top">
        <span>{label}</span>
        <strong>{fmt(value, 0)} / {fmt(max, 0)}</strong>
      </div>
      <div className="progress-meter__track">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function InsightCard({ title, value, meta, body, source, sourceUrl, tone = 'neutral' }) {
  return (
    <article className={`insight-card insight-card--${tone}`}>
      <div className="insight-card__top">
        <h3>{title}</h3>
        <span className="official-badge">Official data</span>
      </div>
      <div className="insight-card__value">{value}</div>
      {meta && <div className="insight-card__meta">{meta}</div>}
      <p>{body}</p>
      {sourceUrl ? (
        <a className="insight-card__source" href={sourceUrl} target="_blank" rel="noreferrer">{source} ↗</a>
      ) : (
        <span className="insight-card__source">{source}</span>
      )}
    </article>
  );
}

export function MacroRiskScorecardSection() {
  const reservesAdequacy = useData('reserves-adequacy.json');
  const fbr = useData('fbr-tax.json');
  const policy = useData('monetary-policy.json');
  const circularDebt = useData('circular-debt.json');
  const externalDebt = useData('external-debt.json');
  const trade = useData('trade.json');
  const remittances = useData('remittances.json');

  const loading = [reservesAdequacy, fbr, policy, circularDebt, externalDebt, trade, remittances].some((r) => r.loading);
  if (loading) return <LoadingCard label="Building macro risk scorecard from verified data…" />;

  const latestTrade = latest(trade.data?.monthly);
  const latestRemit = latest(remittances.data?.monthly);
  const remitYoy = yoyRow(remittances.data?.monthly, latestRemit?.date);
  const fbrGap = fbr.data?.fytd ? fbr.data.fytd.net - fbr.data.fytd.target : null;
  const importCover = reservesAdequacy.data?.current?.importCoverMonths;
  const hardRepayment = externalDebt.data?.fy26?.hardRepayment;
  const sbpReserves = reservesAdequacy.data?.current?.sbpReserves;
  const hardRepaymentShare = hardRepayment && sbpReserves ? (hardRepayment / sbpReserves) * 100 : null;
  const realRate = policy.data?.context?.realRate;
  const circularTarget = circularDebt.data?.targets?.find((target) => target.label === 'FY2026');

  const rows = [
    importCover != null && {
      area: 'External buffer',
      signal: `${fmt(importCover)} months import cover`,
      status: importCover >= 3 ? 'ok' : 'pressure',
      detail: `${reservesAdequacy.data.current.asOf}; IMF benchmark ${reservesAdequacy.data.benchmark?.months} months.`,
      source: 'SBP / IMF',
    },
    fbrGap != null && {
      area: 'Fiscal revenue',
      signal: `${fmtPkrBn(Math.abs(fbrGap))} ${fbrGap >= 0 ? 'ahead' : 'short'}`,
      status: fbrGap >= 0 ? 'ok' : 'behind',
      detail: `${fbr.data.fytd.period}; actual ${fmtPkrBn(fbr.data.fytd.net)} vs target ${fmtPkrBn(fbr.data.fytd.target)}.`,
      source: 'FBR',
    },
    realRate != null && {
      area: 'Inflation / monetary',
      signal: `${fmt(realRate)} pp real policy rate`,
      status: realRate >= 0 ? 'ok' : 'pressure',
      detail: `${policy.data.currentRate}% policy rate vs ${policy.data.context?.inflationYoY}% CPI (${policy.data.context?.inflationPeriod}).`,
      source: 'SBP / PBS',
    },
    circularTarget && {
      area: 'Energy sector',
      signal: circularTarget.status,
      status: circularTarget.status === 'at risk' ? 'at risk' : 'watch',
      detail: circularTarget.statusNote || circularTarget.detail,
      source: 'Power Division / IMF',
    },
    hardRepaymentShare != null && {
      area: 'External financing',
      signal: `Hard repayments ≈ ${fmt(hardRepaymentShare, 0)}% of SBP reserves`,
      status: hardRepaymentShare > 50 ? 'pressure' : 'watch',
      detail: `$${hardRepayment}B hard-cash FY26 repayment vs $${sbpReserves}B SBP reserves.`,
      source: 'SBP / IMF',
    },
    latestTrade && {
      area: 'Trade pressure',
      signal: `$${fmt(Math.abs(latestTrade.balance) / 1000, 2)}B monthly deficit`,
      status: latestTrade.balance < 0 ? 'watch' : 'ok',
      detail: `${latestTrade.date}; exports $${fmt(latestTrade.exports / 1000, 2)}B vs imports $${fmt(latestTrade.imports / 1000, 2)}B.`,
      source: 'SBP',
    },
    latestRemit && remitYoy && {
      area: 'Remittance support',
      signal: `${fmtPct(pctChange(latestRemit.total, remitYoy.total))} YoY`,
      status: pctChange(latestRemit.total, remitYoy.total) >= 0 ? 'ok' : 'watch',
      detail: `${latestRemit.date}; $${fmt(latestRemit.total / 1000, 2)}B monthly inflow.`,
      source: 'SBP EasyData',
    },
  ].filter(Boolean);

  return (
    <section className="fade-in">
      <SectionHeader
        title="Macro Risk Scorecard"
        description="A compact risk dashboard built only from verified dashboard datasets. It labels pressure points without adding estimates or unpublished figures."
        sourceLinks={SOURCE_LINKS}
      />
      <div className="risk-scorecard card">
        {rows.map((row) => (
          <div key={row.area} className={`risk-row risk-row--${toneFromStatus(row.status)}`}>
            <div>
              <span className="risk-row__area">{row.area}</span>
              <strong>{row.signal}</strong>
              <small>{row.detail}</small>
            </div>
            <span className="risk-row__status">{row.status}</span>
            <span className="risk-row__source">{row.source}</span>
          </div>
        ))}
      </div>
      <p className="insight-note">Rows are omitted automatically if a verified source value is missing.</p>
    </section>
  );
}

export function ImfComplianceSection() {
  const imf = useData('imf-tracker.json');
  const fbr = useData('fbr-tax.json');
  const reservesAdequacy = useData('reserves-adequacy.json');
  const circularDebt = useData('circular-debt.json');
  const policy = useData('monetary-policy.json');

  const loading = [imf, fbr, reservesAdequacy, circularDebt, policy].some((r) => r.loading);
  if (loading) return <LoadingCard label="Loading IMF compliance tracker…" />;

  const fbrFy26 = fbr.data?.annualTargets?.find((row) => row.fyLabel === 'FY2026');
  const fbrFy27 = fbr.data?.annualTargets?.find((row) => row.fyLabel === 'FY2027');
  const circularTarget = circularDebt.data?.targets?.find((target) => target.label === 'FY2026');
  const scoreItems = imf.data?.programScorecard?.items || [];
  const watchItems = [
    fbrFy26?.actual != null && fbrFy26?.budgetTarget != null && {
      label: 'FBR FY26 collection',
      target: `Budget target ${fmtPkrBn(fbrFy26.budgetTarget)}`,
      actual: `Provisional actual ${fmtPkrBn(fbrFy26.actual)}`,
      met: fbrFy26.actual >= fbrFy26.budgetTarget,
      source: 'FBR / budget documents',
    },
    fbrFy27?.budgetTarget != null && fbrFy26?.actual != null && {
      label: 'FY27 tax effort',
      target: `Budget target ${fmtPkrBn(fbrFy27.budgetTarget)}`,
      actual: `${fmtPct(pctChange(fbrFy27.budgetTarget, fbrFy26.actual))} above FY26 provisional actual`,
      met: null,
      source: 'Finance Division / FBR',
    },
    reservesAdequacy.data?.current && {
      label: 'Import-cover buffer',
      target: `${reservesAdequacy.data.benchmark?.months} months benchmark`,
      actual: `${reservesAdequacy.data.current.importCoverMonths} months as of ${reservesAdequacy.data.current.asOf}`,
      met: reservesAdequacy.data.current.importCoverMonths >= reservesAdequacy.data.benchmark?.months,
      source: 'SBP / IMF',
    },
    circularTarget && {
      label: 'Power circular debt',
      target: circularTarget.goal,
      actual: circularTarget.statusNote,
      met: circularTarget.status === 'met' ? true : circularTarget.status === 'at risk' ? false : null,
      source: 'Power Division / IMF',
    },
    policy.data?.context && {
      label: 'Inflation vs target',
      target: 'SBP medium-term target 5–7%',
      actual: `${policy.data.context.inflationYoY}% CPI in ${policy.data.context.inflationPeriod}`,
      met: policy.data.context.inflationYoY <= 7,
      source: 'SBP / PBS',
    },
  ].filter(Boolean);

  const renderItem = (item, index, source) => (
    <div key={`${item.label}-${index}`} className={`compliance-item compliance-item--${item.met === true ? 'met' : item.met === false ? 'risk' : 'watch'}`}>
      <span className="compliance-item__icon">{item.met === true ? '✓' : item.met === false ? '!' : '≈'}</span>
      <div>
        <strong>{item.label}</strong>
        <span>{item.actual}</span>
        <small>Target: {item.target} · Source: {item.source || source}</small>
      </div>
    </div>
  );

  return (
    <section className="fade-in">
      <SectionHeader
        title="IMF Program Compliance Tracker"
        description="Verified IMF-program scorecard plus live watch items from official dashboard data. Items marked watch are not declared met or missed unless the source data supports that label."
        sourceLinks={[{ label: 'IMF Pakistan', url: imf.data?.sourceUrl || 'https://www.imf.org/en/Countries/PAK' }, { label: 'FBR', url: 'https://www.fbr.gov.pk' }, { label: 'SBP', url: 'https://www.sbp.org.pk' }]}
      />
      <div className="insight-panel">
        <div>
          <h3>{imf.data?.program}</h3>
          <p>{imf.data?.upcomingDecision?.note}</p>
          <span className="source-pill">Last verified {imf.data?.lastVerified}</span>
        </div>
        <strong>{imf.data?.upcomingDecision?.dateText || 'Schedule pending'}</strong>
      </div>
      <div className="compliance-grid">
        <div className="card">
          <h3>IMF-published scorecard</h3>
          {scoreItems.map((item, index) => renderItem(item, index, imf.data?.programScorecard?.source))}
        </div>
        <div className="card">
          <h3>Live watch items</h3>
          {watchItems.map((item, index) => renderItem(item, index))}
        </div>
      </div>
      <p className="insight-note">{imf.data?.methodologyNote}</p>
    </section>
  );
}

export function ExternalFinancingWallSection() {
  const externalDebt = useData('external-debt.json');
  const reservesAdequacy = useData('reserves-adequacy.json');
  const reserves = useData('reserves.json');

  const loading = [externalDebt, reservesAdequacy, reserves].some((r) => r.loading);
  if (loading) return <LoadingCard label="Loading external financing wall…" />;

  const fy26 = externalDebt.data?.fy26;
  const latestReserve = latest(reserves.data?.weekly);
  const chart = {
    labels: ['FY26 external servicing'],
    datasets: (externalDebt.data?.repaymentSplit || []).map((part) => ({
      label: part.label,
      data: [part.value],
      backgroundColor: part.color,
      borderRadius: 6,
      stack: 'repayment',
    })),
  };
  const options = {
    ...baseBarOptions,
    indexAxis: 'y',
    scales: {
      x: { ...baseBarOptions.scales.y, stacked: true, title: { display: true, text: 'US$ billion', color: COLORS.text } },
      y: { ...baseBarOptions.scales.x, stacked: true, grid: { display: false } },
    },
    plugins: {
      ...baseBarOptions.plugins,
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: $${ctx.raw}B` } },
    },
  };

  const cards = [
    fy26?.grossRepayment != null && {
      title: 'Gross FY26 servicing',
      value: `$${fy26.grossRepayment}B`,
      meta: `range ${fy26.grossRange}B`,
      body: fy26.note,
      tone: 'neutral',
      source: 'SBP briefings / financial media',
      sourceUrl: externalDebt.data?.sourceUrl,
    },
    fy26?.expectedRollovers != null && {
      title: 'Rollover dependency',
      value: `$${fy26.expectedRollovers}B`,
      meta: `${fmt((fy26.expectedRollovers / fy26.grossRepayment) * 100, 0)}% of gross servicing`,
      body: 'This portion is expected to be refinanced or rolled over rather than paid in hard cash.',
      tone: 'neutral',
      source: 'External debt tracker',
      sourceUrl: externalDebt.data?.sourceUrl,
    },
    fy26?.hardRepayment != null && {
      title: 'Hard-cash burden',
      value: `$${fy26.hardRepayment}B`,
      meta: `$${fy26.interest}B interest + $${fy26.principalNonRolled}B principal`,
      body: 'This is the portion that directly pressures foreign-exchange reserves if not offset by inflows.',
      tone: 'negative',
      source: 'External debt tracker',
      sourceUrl: externalDebt.data?.sourceUrl,
    },
    latestReserve && {
      title: 'Reserve cushion',
      value: `$${fmt(latestReserve.sbp / 1000, 2)}B`,
      meta: `${latestReserve.date}; total reserves $${fmt(latestReserve.total / 1000, 2)}B`,
      body: reservesAdequacy.data?.current?.importCoverNote,
      tone: reservesAdequacy.data?.current?.importCoverMonths >= 3 ? 'positive' : 'neutral',
      source: 'State Bank of Pakistan',
      sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    },
  ].filter(Boolean);

  return (
    <section className="fade-in">
      <SectionHeader
        title="External Financing Wall"
        description="A source-backed view of the repayment wall, expected rollovers, hard-cash burden, and reserve cushion. FY27 is shown only as a public range because detailed maturities are not fully public."
        sourceLinks={[{ label: 'IMF Pakistan', url: externalDebt.data?.sourceUrl || 'https://www.imf.org/en/Countries/PAK' }, { label: 'SBP reserves', url: 'https://www.sbp.org.pk/ecodata/index2.asp' }]}
      />
      <div className="insight-grid">
        {cards.map((card) => <InsightCard key={card.title} {...card} />)}
      </div>
      <div className="card chart-card">
        <div className="chart-card-header"><h3>FY26 repayment split</h3></div>
        <div className="chart-container short"><Bar data={chart} options={options} /></div>
      </div>
      {externalDebt.data?.fy27?.note && <p className="insight-note">{externalDebt.data.fy27.note}</p>}
    </section>
  );
}

export function GoodBadWatchSection() {
  const remittances = useData('remittances.json');
  const services = useData('services.json');
  const reserves = useData('reserves.json');
  const fbr = useData('fbr-tax.json');
  const policy = useData('monetary-policy.json');
  const circularDebt = useData('circular-debt.json');
  const imf = useData('imf-tracker.json');
  const trade = useData('trade.json');

  const loading = [remittances, services, reserves, fbr, policy, circularDebt, imf, trade].some((r) => r.loading);
  if (loading) return <LoadingCard label="Writing verified Good / Bad / Watch brief…" />;

  const latestRemit = latest(remittances.data?.monthly);
  const remitYoy = yoyRow(remittances.data?.monthly, latestRemit?.date);
  const remitGrowth = pctChange(latestRemit?.total, remitYoy?.total);
  const latestReserve = latest(reserves.data?.weekly);
  const prevReserve = previous(reserves.data?.weekly);
  const reserveChange = latestReserve && prevReserve ? latestReserve.sbp - prevReserve.sbp : null;
  const fbrGap = fbr.data?.fytd ? fbr.data.fytd.net - fbr.data.fytd.target : null;
  const latestTrade = latest(trade.data?.monthly);
  const itTotal = services.data?.itMonthly?.components?.find((item) => item.key === 'itTotal');
  const freelance = services.data?.itMonthly?.components?.find((item) => item.key === 'freelance');
  const circularTarget = circularDebt.data?.targets?.find((target) => target.label === 'FY2026');

  const columns = [
    {
      title: 'Good',
      tone: 'positive',
      items: [
        remitGrowth != null && remitGrowth > 0 && `Remittances rose ${fmtPct(remitGrowth)} YoY in ${latestRemit.date}.`,
        itTotal?.fytd != null && itTotal?.fytdPrior != null && `IT & Telecom exports are ${fmtPct(pctChange(itTotal.fytd, itTotal.fytdPrior))} higher FYTD (${services.data.itMonthly.fytdLabel}).`,
        freelance?.fytd != null && freelance?.fytdPrior != null && `Freelance IT exports are ${fmtPct(pctChange(freelance.fytd, freelance.fytdPrior))} higher FYTD.`,
        circularDebt.data?.yoy?.changePct < 0 && `Power circular debt stock is down ${Math.abs(circularDebt.data.yoy.changePct)}% YoY as of ${circularDebt.data.current.asOf}.`,
      ].filter(Boolean),
    },
    {
      title: 'Bad',
      tone: 'negative',
      items: [
        fbrGap != null && fbrGap < 0 && `FBR collection is ${fmtPkrBn(Math.abs(fbrGap))} below FYTD target (${fbr.data.fytd.period}).`,
        reserveChange != null && reserveChange < 0 && `SBP reserves fell $${fmt(Math.abs(reserveChange) / 1000, 2)}B in the latest week.`,
        policy.data?.context?.inflationYoY > 7 && `Inflation at ${policy.data.context.inflationYoY}% remains above SBP's 5–7% medium-term target.`,
        latestTrade?.balance < 0 && `Latest goods trade balance is a $${fmt(Math.abs(latestTrade.balance) / 1000, 2)}B deficit.`,
      ].filter(Boolean),
    },
    {
      title: 'Watch',
      tone: 'neutral',
      items: [
        imf.data?.upcomingDecision?.dateText && `${imf.data.upcomingDecision.label}: ${imf.data.upcomingDecision.dateText}.`,
        circularTarget?.status === 'at risk' && `Circular-debt FY26 target is at risk: ${circularTarget.statusNote}`,
        fbr.data?.annualTargets?.find((row) => row.fyLabel === 'FY2027') && `FY27 FBR target is ${fmtPkrBn(fbr.data.annualTargets.find((row) => row.fyLabel === 'FY2027').budgetTarget)}.`,
        services.data?.itMonthly?.latestMonth && `Track whether IT/freelance exports extend the latest monthly trend after ${services.data.itMonthly.latestMonth}.`,
      ].filter(Boolean),
    },
  ];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Good / Bad / Watch Brief"
        description="A rule-based monthly brief from verified dashboard data. It intentionally avoids adding unverified claims, forecasts, or figures not present in source-backed datasets."
        sourceLinks={SOURCE_LINKS}
      />
      <div className="brief-columns">
        {columns.map((column) => (
          <div key={column.title} className={`brief-column brief-column--${column.tone}`}>
            <h3>{column.title}</h3>
            <ul>
              {column.items.length ? column.items.map((item) => <li key={item}>{item}</li>) : <li>No verified item currently qualifies.</li>}
            </ul>
          </div>
        ))}
      </div>
      <p className="insight-note">This brief is generated from source-backed dashboard JSON only; if a datapoint is incomplete, it is not shown.</p>
    </section>
  );
}

export function RevenueTargetMeterSection() {
  const fbr = useData('fbr-tax.json');
  if (fbr.loading || !fbr.data) return <LoadingCard label="Loading revenue target meter…" />;

  const fy26 = fbr.data.annualTargets?.find((row) => row.fyLabel === 'FY2026');
  const fy27 = fbr.data.annualTargets?.find((row) => row.fyLabel === 'FY2027');
  const fytd = fbr.data.fytd;
  const fy26BudgetGap = fy26?.actual != null && fy26?.budgetTarget != null ? fy26.actual - fy26.budgetTarget : null;
  const fy26RevisedGap = fy26?.actual != null && fy26?.revisedTarget != null ? fy26.actual - fy26.revisedTarget : null;
  const fy27Increase = fy27?.budgetTarget != null && fy26?.actual != null ? pctChange(fy27.budgetTarget, fy26.actual) : null;

  const chart = {
    labels: ['FY26 budget', 'FY26 revised', 'FY26 actual (P)', 'FY27 target'],
    datasets: [{
      label: 'FBR net collection / target',
      data: [fy26?.budgetTarget, fy26?.revisedTarget, fy26?.actual, fy27?.budgetTarget],
      backgroundColor: [COLORS.blue, COLORS.amber, fy26BudgetGap >= 0 ? COLORS.teal : COLORS.coral, COLORS.purple],
      borderRadius: 6,
    }],
  };
  const options = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => fmtPkrBn(ctx.raw) } },
    },
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'PKR billion', color: COLORS.text } },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Revenue Target Meter"
        description="FBR actuals versus official targets. The meter only uses FBR/Finance Division target and collection figures already present in the dashboard source file."
        sourceLinks={[{ label: 'FBR', url: fbr.data.sourceUrl || 'https://www.fbr.gov.pk' }]}
      />
      <div className="insight-grid">
        {fytd && <InsightCard title="FYTD pace" value={`${fmtPkrBn(fytd.net)} collected`} meta={`${fmtPkrBn(Math.abs(fytd.net - fytd.target))} ${fytd.net >= fytd.target ? 'ahead' : 'short'} vs target`} body={`${fytd.period}; prior-year same-period collection was ${fmtPkrBn(fytd.priorNet)}.`} source="FBR" sourceUrl={fytd.source} tone={fytd.net >= fytd.target ? 'positive' : 'negative'} />}
        {fy26BudgetGap != null && <InsightCard title="FY26 budget target gap" value={`${fmtPkrBn(Math.abs(fy26BudgetGap))} ${fy26BudgetGap >= 0 ? 'ahead' : 'short'}`} meta={`Actual ${fmtPkrBn(fy26.actual)} vs budget ${fmtPkrBn(fy26.budgetTarget)}`} body={fy26.note} source="FBR / budget documents" sourceUrl={fy26.sources?.[0]?.url} tone={fy26BudgetGap >= 0 ? 'positive' : 'negative'} />}
        {fy26RevisedGap != null && <InsightCard title="FY26 revised target gap" value={`${fmtPkrBn(Math.abs(fy26RevisedGap))} ${fy26RevisedGap >= 0 ? 'ahead' : 'short'}`} meta={`Revised target ${fmtPkrBn(fy26.revisedTarget)}`} body="Shows whether the year ended above or below the revised IMF/FBR target in the source data." source="FBR / IMF reporting" sourceUrl={fy26.sources?.[0]?.url} tone={fy26RevisedGap >= 0 ? 'positive' : 'negative'} />}
        {fy27Increase != null && <InsightCard title="FY27 required uplift" value={fmtPct(fy27Increase)} meta={`${fmtPkrBn(fy27.budgetTarget)} target`} body="Increase implied by the FY27 budget target compared with FY26 provisional actual collection." source="Finance Division / FBR" sourceUrl={fy27.sources?.[0]?.url} tone="neutral" />}
      </div>
      <div className="card chart-card">
        <div className="chart-container"><Bar data={chart} options={options} /></div>
      </div>
      {fy26?.actual != null && fy26?.budgetTarget != null && <ProgressMeter label="FY26 actual vs budget target" value={fy26.actual} max={fy26.budgetTarget} color={fy26.actual >= fy26.budgetTarget ? COLORS.teal : COLORS.coral} detail={`${fmt((fy26.actual / fy26.budgetTarget) * 100, 1)}% of budget target achieved`} />}
      <p className="insight-note">{fbr.data.methodologyNote}</p>
    </section>
  );
}

export function ItExportDeepDiveSection() {
  const services = useData('services.json');
  if (services.loading || !services.data) return <LoadingCard label="Loading IT export deep dive…" />;

  const itMonthly = services.data.itMonthly;
  const components = itMonthly?.components || [];
  const itTotal = components.find((item) => item.key === 'itTotal');
  const freelance = components.find((item) => item.key === 'freelance');
  const softwareConsultancy = components.find((item) => item.key === 'softwareConsultancy');
  const softwareExports = components.find((item) => item.key === 'softwareExports');
  const monthly = services.data.monthlySeries || [];
  const chart = {
    labels: monthly.map((row) => row.month),
    datasets: [
      { label: 'IT & Telecom exports', data: monthly.map((row) => row.itCredit), backgroundColor: COLORS.teal, borderRadius: 6 },
      { label: 'Freelance IT exports', data: monthly.map((row) => row.freelanceCredit), backgroundColor: COLORS.amber, borderRadius: 6 },
      { label: 'Non-freelance IT exports', data: monthly.map((row) => Math.max(0, row.itCredit - row.freelanceCredit)), backgroundColor: COLORS.blue, borderRadius: 6 },
    ],
  };
  const options = {
    ...baseBarOptions,
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'US$ million', color: COLORS.text } },
    },
  };
  const freelanceShare = itTotal?.latest ? (freelance?.latest / itTotal.latest) * 100 : null;
  const fytdFreelanceShare = itTotal?.fytd ? (freelance?.fytd / itTotal.fytd) * 100 : null;

  return (
    <section className="fade-in">
      <SectionHeader
        title="IT Export Deep Dive"
        description="A focused view of monthly IT & Telecom exports, formal freelance receipts, and the composition of computer-services exports from SBP EBOPS data."
        sourceLinks={[{ label: 'SBP BOP Detail', url: 'https://www.sbp.org.pk/ecodata/index2.asp' }]}
      />
      <div className="insight-grid">
        {itTotal && <InsightCard title="Latest IT & Telecom exports" value={`$${fmt(itTotal.latest)}M`} meta={itMonthly.latestMonth} body={`FYTD exports are $${fmt(itTotal.fytd)}M, ${fmtPct(pctChange(itTotal.fytd, itTotal.fytdPrior))} versus ${itMonthly.fytdPriorLabel}.`} source="SBP EBOPS" sourceUrl="https://www.sbp.org.pk/ecodata/index2.asp" tone="positive" />}
        {freelance && <InsightCard title="Latest Freelance IT exports" value={`$${fmt(freelance.latest)}M`} meta={`${fmt(freelanceShare)}% of latest IT exports`} body={`FYTD freelance IT exports are $${fmt(freelance.fytd)}M, ${fmt(fytdFreelanceShare)}% of IT & Telecom exports.`} source="SBP EBOPS" sourceUrl="https://www.sbp.org.pk/ecodata/index2.asp" tone="positive" />}
        {softwareConsultancy && <InsightCard title="Software consultancy" value={`$${fmt(softwareConsultancy.latest)}M`} meta={`${fmtPct(pctChange(softwareConsultancy.latest, softwareConsultancy.yearAgo))} YoY`} body={`FYTD software consultancy exports are $${fmt(softwareConsultancy.fytd)}M.`} source="SBP EBOPS" sourceUrl="https://www.sbp.org.pk/ecodata/index2.asp" tone="neutral" />}
        {softwareExports && <InsightCard title="Computer software exports" value={`$${fmt(softwareExports.latest)}M`} meta={`${fmtPct(pctChange(softwareExports.latest, softwareExports.yearAgo))} YoY`} body={`FYTD computer software exports are $${fmt(softwareExports.fytd)}M.`} source="SBP EBOPS" sourceUrl="https://www.sbp.org.pk/ecodata/index2.asp" tone="neutral" />}
      </div>
      <div className="card chart-card">
        <div className="chart-card-header"><h3>Monthly IT and freelance export receipts</h3></div>
        <div className="chart-container tall"><Bar data={chart} options={options} /></div>
      </div>
      <p className="insight-note">{itMonthly?.note}</p>
    </section>
  );
}

export function EconomicBriefingSection() {
  const kpi = useData('kpi-summary.json');
  const trade = useData('trade.json');
  const remittances = useData('remittances.json');
  const inflation = useData('inflation.json');
  const reserves = useData('reserves.json');
  const fbr = useData('fbr-tax.json');

  const loading = [kpi, trade, remittances, inflation, reserves, fbr].some((r) => r.loading);
  if (loading) return <LoadingCard label="Building the latest official-data briefing…" />;

  const t = latest(trade.data?.monthly);
  const tPrev = previous(trade.data?.monthly);
  const r = latest(remittances.data?.monthly);
  const rYoy = yoyRow(remittances.data?.monthly, r?.date);
  const inf = latest(inflation.data?.national_cpi?.data);
  const infPrev = previous(inflation.data?.national_cpi?.data);
  const res = latest(reserves.data?.weekly);
  const resPrev = previous(reserves.data?.weekly);
  const fbrGap = fbr.data?.fytd ? fbr.data.fytd.net - fbr.data.fytd.target : null;

  const cards = [
    {
      title: 'External buffer',
      value: `$${fmt((res?.total || 0) / 1000, 2)}B`,
      meta: `${res?.date || 'Latest'} · ${signed(((res?.total || 0) - (resPrev?.total || 0)) / 1000, 'B', 2)} vs prior week`,
      tone: trendClass((res?.total || 0) - (resPrev?.total || 0)),
      body: 'Reserves are the first line of defense against import and external-debt pressure. Watch both the level and import-cover months.',
      source: 'State Bank of Pakistan',
      sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    },
    {
      title: 'Remittance support',
      value: `$${fmt((r?.total || 0) / 1000, 2)}B`,
      meta: `${r?.date || 'Latest'} · ${signed(pctChange(r?.total, rYoy?.total), '% YoY')}`,
      tone: trendClass(pctChange(r?.total, rYoy?.total)),
      body: 'Remittances are one of Pakistan’s most important recurring foreign-exchange inflows and can offset part of the trade gap.',
      source: 'SBP EasyData',
      sourceUrl: 'https://easydata.sbp.org.pk',
    },
    {
      title: 'Trade gap',
      value: `$${fmt(Math.abs(t?.balance || 0) / 1000, 2)}B deficit`,
      meta: `${t?.date || 'Latest'} · ${signed((t?.balance || 0) - (tPrev?.balance || 0), 'M', 0)} vs prior month`,
      tone: trendClass((t?.balance || 0) - (tPrev?.balance || 0)),
      body: 'A smaller negative balance eases pressure on reserves. Imports, exports, and remittances should be read together.',
      source: 'State Bank of Pakistan',
      sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    },
    {
      title: 'Inflation pulse',
      value: `${fmt(inf?.value)}%`,
      meta: `${inf?.date || 'Latest'} · ${signed((inf?.value || 0) - (infPrev?.value || 0), ' pp')}`,
      tone: trendClass((inf?.value || 0) - (infPrev?.value || 0), false),
      body: 'Inflation determines household purchasing power and guides SBP policy-rate decisions.',
      source: 'PBS via SBP EasyData',
      sourceUrl: 'https://easydata.sbp.org.pk',
    },
    {
      title: 'Tax target pressure',
      value: `₨${fmt(Math.abs(fbrGap || 0), 0)}B ${fbrGap >= 0 ? 'ahead' : 'short'}`,
      meta: fbr.data?.fytd?.period,
      tone: fbrGap >= 0 ? 'positive' : 'negative',
      body: 'Tax collection relative to target indicates how much fiscal adjustment may be needed through revenue measures or spending control.',
      source: 'Federal Board of Revenue',
      sourceUrl: 'https://www.fbr.gov.pk',
    },
  ];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Monthly Economic Briefing"
        description="A plain-English briefing generated from the same official datasets that power the dashboard. It highlights what changed, why it matters, and which source backs each statement."
        sourceLinks={SOURCE_LINKS}
      />
      <div className="insight-grid">
        {cards.map((card) => <InsightCard key={card.title} {...card} />)}
      </div>
      <p className="insight-note">Interpretation is rule-based and limited to official data already shown in the dashboard; it does not infer unpublished values.</p>
    </section>
  );
}

export function PeerComparisonSection() {
  const { data, loading, error } = useData('peer-comparison.json');
  const [activeId, setActiveId] = useState('gdp-growth');

  const active = useMemo(
    () => data?.indicators?.find((indicator) => indicator.id === activeId) || data?.indicators?.[0],
    [data, activeId],
  );

  if (loading || !data) return <LoadingCard label="Loading World Bank peer data…" />;
  if (error) return <div className="card"><p>Error loading peer comparison: {error.message}</p></div>;

  const chart = {
    labels: active.values.map((row) => row.countryName),
    datasets: [{
      label: `${active.label} (${active.unit})`,
      data: active.values.map((row) => row.value),
      backgroundColor: active.values.map((row) => row.countryCode === 'PAK' ? COLORS.teal : COLORS.blue),
      borderRadius: 6,
    }],
  };
  const options = {
    ...baseBarOptions,
    plugins: {
      ...baseBarOptions.plugins,
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const row = active.values[ctx.dataIndex];
            return `${ctx.raw} ${active.unit} · ${row.year || 'N/A'}`;
          },
        },
      },
    },
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Pakistan vs Peer Economies"
        description="Annual peer-country comparisons from the World Bank's official World Development Indicators. The latest available official year can vary by indicator and country."
        sourceLinks={[{ label: 'World Bank Open Data', url: data.sourceUrl }]}
      />
      <div className="metric-switcher" role="tablist" aria-label="Peer comparison metric">
        {data.indicators.map((indicator) => (
          <button
            key={indicator.id}
            className={`metric-chip ${indicator.id === active.id ? 'active' : ''}`}
            onClick={() => setActiveId(indicator.id)}
          >
            {indicator.label}
          </button>
        ))}
      </div>
      <div className="insight-panel">
        <div>
          <h3>{active.label}</h3>
          <p>{active.whyItMatters}</p>
          <span className="source-pill">World Bank indicator {active.code}</span>
        </div>
        <a href={active.sourceUrl} target="_blank" rel="noreferrer">API source ↗</a>
      </div>
      <div className="chart-card card">
        <div style={{ height: 340 }}>
          <Bar data={chart} options={options} />
        </div>
      </div>
      <div className="insight-table-wrap">
        <table className="insight-table">
          <thead><tr><th>Country</th><th>Value</th><th>Official year</th></tr></thead>
          <tbody>
            {active.values.map((row) => (
              <tr key={row.countryCode}>
                <td>{row.countryName}</td>
                <td>{row.value == null ? 'Not available' : `${fmt(row.value, 2)} ${active.unit}`}</td>
                <td>{row.year || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">{data.methodologyNote}</p>
    </section>
  );
}

export function RiskOutlookSection() {
  const fiscal = useData('fiscal.json');
  const fbr = useData('fbr-tax.json');
  const reservesAdequacy = useData('reserves-adequacy.json');
  const externalDebt = useData('external-debt.json');
  const inflation = useData('inflation.json');
  const remittances = useData('remittances.json');
  const trade = useData('trade.json');
  const indicators = useData('indicators.json');

  const loading = [fiscal, fbr, reservesAdequacy, externalDebt, inflation, remittances, trade, indicators].some((r) => r.loading);
  if (loading) return <LoadingCard label="Assembling risk, household, and trend-watch panels…" />;

  const pf = fiscal.data?.publicFinance || {};
  const latestFiscal = latest(pf.fiscal_balance?.data);
  const latestPrimary = latest(pf.primary_balance?.data);
  const latestInf = latest(inflation.data?.national_cpi?.data);
  const priorInf = previous(inflation.data?.national_cpi?.data);
  const latestRemit = latest(remittances.data?.monthly);
  const remit3m = (remittances.data?.monthly || []).slice(-3);
  const remitAvg = remit3m.reduce((sum, row) => sum + row.total, 0) / Math.max(remit3m.length, 1);
  const latestTrade = latest(trade.data?.monthly);
  const trade3m = (trade.data?.monthly || []).slice(-3);
  const tradeAvg = trade3m.reduce((sum, row) => sum + row.balance, 0) / Math.max(trade3m.length, 1);
  const petrol = indicators.data?.indicators?.find((row) => row.id === 'petrol-price');
  const policy = indicators.data?.indicators?.find((row) => row.id === 'policy-rate');
  const publicDebt = indicators.data?.indicators?.find((row) => row.id === 'public-debt');
  const circularDebt = indicators.data?.indicators?.find((row) => row.id === 'circular-debt');
  const fbrGap = fbr.data?.fytd ? fbr.data.fytd.net - fbr.data.fytd.target : null;

  return (
    <section className="fade-in">
      <SectionHeader
        title="Risk, Outlook & Household Impact"
        description="Official-data panels that connect macro indicators to fiscal pressure, external vulnerability, and everyday household impact. Forward-looking labels are trend math only, not forecasts."
        sourceLinks={SOURCE_LINKS}
      />

      <div className="insight-two-col">
        <div className="context-block card">
          <h3>Fiscal stress monitor</h3>
          <div className="context-list">
            <div><span>Fiscal balance</span><strong>{latestFiscal ? `₨${fmt(latestFiscal.value / 1e6, 2)}T` : '—'}</strong><small>{latestFiscal?.fy}</small></div>
            <div><span>Primary balance</span><strong>{latestPrimary ? `₨${fmt(latestPrimary.value / 1e6, 2)}T` : '—'}</strong><small>{latestPrimary?.fy}</small></div>
            <div><span>FBR target gap</span><strong>₨{fmt(Math.abs(fbrGap || 0), 0)}B {fbrGap >= 0 ? 'ahead' : 'short'}</strong><small>{fbr.data?.fytd?.period}</small></div>
            <div><span>Public debt</span><strong>{publicDebt?.value}{publicDebt?.unit}</strong><small>{publicDebt?.change}</small></div>
            <div><span>Power circular debt</span><strong>{circularDebt?.value}{circularDebt?.unit}</strong><small>{circularDebt?.asOf}</small></div>
          </div>
        </div>

        <div className="context-block card">
          <h3>External vulnerability scorecard</h3>
          <div className="context-list">
            <div><span>Import cover</span><strong>{reservesAdequacy.data?.current?.importCoverMonths} months</strong><small>{reservesAdequacy.data?.benchmark?.label}</small></div>
            <div><span>SBP reserves</span><strong>${reservesAdequacy.data?.current?.sbpReserves}B</strong><small>{reservesAdequacy.data?.current?.asOf}</small></div>
            <div><span>FY26 gross external repayment</span><strong>${externalDebt.data?.fy26?.grossRepayment}B</strong><small>rollovers remain critical</small></div>
            <div><span>Hard-cash repayment</span><strong>${externalDebt.data?.fy26?.hardRepayment}B</strong><small>interest + non-rolled principal</small></div>
            <div><span>Latest trade deficit</span><strong>${fmt(Math.abs(latestTrade?.balance || 0) / 1000, 2)}B</strong><small>{latestTrade?.date}</small></div>
          </div>
        </div>
      </div>

      <div className="insight-two-col">
        <div className="context-block card">
          <h3>Household impact view</h3>
          <div className="context-list">
            <div><span>CPI inflation</span><strong>{fmt(latestInf?.value)}%</strong><small>{latestInf?.date}</small></div>
            <div><span>Inflation momentum</span><strong>{signed((latestInf?.value || 0) - (priorInf?.value || 0), ' pp')}</strong><small>latest vs prior month</small></div>
            <div><span>Policy rate</span><strong>{policy?.value}{policy?.unit}</strong><small>{policy?.asOf}</small></div>
            <div><span>Petrol price</span><strong>{petrol?.value}{petrol?.unit}</strong><small>{petrol?.asOf}</small></div>
          </div>
        </div>

        <div className="context-block card">
          <h3>Trend watch, not a forecast</h3>
          <div className="context-list">
            <div><span>Remittances vs 3-month average</span><strong>{signed(pctChange(latestRemit?.total, remitAvg), '%')}</strong><small>{latestRemit?.date}</small></div>
            <div><span>Trade balance vs 3-month average</span><strong>{signed((latestTrade?.balance || 0) - tradeAvg, 'M', 0)}</strong><small>less negative is better</small></div>
            <div><span>Inflation direction</span><strong>{(latestInf?.value || 0) >= (priorInf?.value || 0) ? 'Rising' : 'Cooling'}</strong><small>latest official CPI print</small></div>
            <div><span>Tax collection vs FYTD target</span><strong>{fbrGap >= 0 ? 'Ahead' : 'Behind'}</strong><small>official FBR target comparison</small></div>
          </div>
        </div>
      </div>

      <p className="insight-note">No synthetic estimates are introduced here. Every value is either directly sourced from the dashboard datasets or a transparent arithmetic comparison of those official values.</p>
    </section>
  );
}

export function EconomicTimelineSection() {
  const { data, loading, error } = useData('economic-events.json');
  if (loading || !data) return <LoadingCard label="Loading official economic timeline…" />;
  if (error) return <div className="card"><p>Error loading timeline: {error.message}</p></div>;

  return (
    <section className="fade-in">
      <SectionHeader
        title="Official Economic Timeline"
        description="Context markers for charts and indicators. Events are included only when tied to an official or primary institutional source."
        sourceLinks={[{ label: 'IMF Pakistan', url: 'https://www.imf.org/en/Countries/PAK' }, { label: 'SBP', url: 'https://www.sbp.org.pk' }]}
      />
      <div className="timeline">
        {data.events.map((event) => (
          <article key={`${event.date}-${event.title}`} className="timeline-event card">
            <div className="timeline-event__date">{event.date}</div>
            <div>
              <span className="source-pill">{event.category}</span>
              <h3>{event.title}</h3>
              <p>{event.whyItMatters}</p>
              <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.officialSource} ↗</a>
            </div>
          </article>
        ))}
      </div>
      <p className="insight-note">{data.methodologyNote}</p>
    </section>
  );
}

export function LearningCenterSection() {
  const { data, loading, error } = useData('explainers.json');
  if (loading || !data) return <LoadingCard label="Loading learning center…" />;
  if (error) return <div className="card"><p>Error loading explainers: {error.message}</p></div>;

  return (
    <section className="fade-in">
      <SectionHeader
        title="Learning Center & Glossary"
        description="Plain-English explainers for the dashboard's core macroeconomic concepts, with official methodology links for deeper reading."
        sourceLinks={SOURCE_LINKS}
      />
      {data.sections.map((section) => (
        <div key={section.id} className="learning-section">
          <h3>{section.title}</h3>
          <div className="learning-grid">
            {section.terms.map((term) => (
              <article key={term.term} className="learning-card card">
                <h4>{term.term}</h4>
                <p>{term.plainEnglish}</p>
                <div className="learning-card__read">
                  <strong>How to read it:</strong> {term.howToRead}
                </div>
                <a href={term.sourceUrl} target="_blank" rel="noreferrer">{term.officialSource} ↗</a>
              </article>
            ))}
          </div>
        </div>
      ))}
      <p className="insight-note">{data.methodologyNote}</p>
    </section>
  );
}

export function SourceTrustSection() {
  const { data, loading } = useData('data-freshness.json');
  const datasets = data?.datasets || [];
  const counts = datasets.reduce((acc, dataset) => {
    if (dataset.apiSeries?.length) acc.api += 1;
    else if (dataset.sourceFile) acc.files += 1;
    else acc.curated += 1;
    if (dataset.critical) acc.critical += 1;
    return acc;
  }, { api: 0, files: 0, curated: 0, critical: 0 });

  return (
    <section className="fade-in">
      <SectionHeader
        title="Source Confidence & Audit Trail"
        description="A trust layer that shows which datasets come from official APIs, official files, or manually curated official documents, plus freshness metadata."
        sourceLinks={SOURCE_LINKS}
      />
      {!loading && (
        <div className="trust-grid">
          <InsightCard title="Official APIs" value={counts.api} meta="machine-readable series" body="Fetched from SBP EasyData or other official APIs where available." source="Generated source manifest" tone="positive" />
          <InsightCard title="Official files" value={counts.files} meta="Excel/PDF source files" body="Parsed from official SBP/FBR/Finance Division files with source-file metadata." source="Generated source manifest" tone="positive" />
          <InsightCard title="Curated official documents" value={counts.curated} meta="event-driven datasets" body="Used only where no stable machine-readable feed exists; each card links to primary sources." source="Generated source manifest" tone="neutral" />
          <InsightCard title="Critical datasets" value={counts.critical} meta="freshness-monitored" body="Core indicators are checked by the audit script before build/deploy." source="Generated source manifest" tone="positive" />
        </div>
      )}
      <DataFreshnessPanel />
    </section>
  );
}
