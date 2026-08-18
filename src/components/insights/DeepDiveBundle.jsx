import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { baseBarOptions } from '../../utils/chartConfig';
import { isFiniteNumber, isClosedFiscalPeriod } from '../../utils/periodHelpers';
import SectionHeader from '../SectionHeader';
import { LoadingCard, ErrorCard } from '../ui/DataState';
import {
  SOURCE_LINKS,
  sourceLinksWithFytd,
  fmt,
  latest,
  yoyRow,
  pctChange,
  toneFromStatus,
  fmtPct,
  fmtPkrBn,
  resolveFyLabels,
  multiState,
  useData,
  COLORS,
} from './helpers.js';
import { ProgressMeter, InsightCard, PartialFailureNote } from './shared.jsx';
import useI18n from '../../i18n/useI18n';
import '../ui/Insights.css';
export function MacroRiskScorecardSection() {
  const { tx } = useI18n();
  const reservesAdequacy = useData('reserves-adequacy.json');
  const fbr = useData('fbr-tax.json');
  const policy = useData('monetary-policy.json');
  const circularDebt = useData('circular-debt.json');
  const externalDebt = useData('external-debt.json');
  const trade = useData('trade.json');
  const remittances = useData('remittances.json');

  const sources = [reservesAdequacy, fbr, policy, circularDebt, externalDebt, trade, remittances];
    const { loading, failed, retryAll, hasPartialFailure } = multiState(sources);
    if (loading) return <LoadingCard label="Building macro risk scorecard from verified data…" />;
    const fy = resolveFyLabels(trade, remittances, fbr);

    const latestTrade = latest(trade.data?.monthly);
    const latestRemit = latest(remittances.data?.monthly);
    const remitYoy = yoyRow(remittances.data?.monthly, latestRemit?.date);
    const fbrGap = fbr.data?.fytd && isFiniteNumber(fbr.data.fytd.net) && isFiniteNumber(fbr.data.fytd.target)
      ? fbr.data.fytd.net - fbr.data.fytd.target
      : null;
    const importCover = reservesAdequacy.data?.current?.importCoverMonths;
    const hardRepayment = externalDebt.data?.fy26?.hardRepayment;
    const sbpReserves = reservesAdequacy.data?.current?.sbpReserves;
    const hardRepaymentShare = isFiniteNumber(hardRepayment) && isFiniteNumber(sbpReserves) && sbpReserves !== 0
      ? (hardRepayment / sbpReserves) * 100
      : null;
    const realRate = policy.data?.context?.realRate;
    const circularTarget = circularDebt.data?.targets?.find(
      (target) => target.label === fy.fyFull || target.label === fy.fyLabel || target.label === `FY${fy.fy}`,
    );

  const rows = [
    importCover != null && {
      area: 'External buffer',
      signal: `${fmt(importCover)} months import cover`,
      status: importCover >= 3 ? 'ok' : 'pressure',
      detail: `${reservesAdequacy.data.current.asOf}; ${reservesAdequacy.data.benchmark?.label} ${reservesAdequacy.data.benchmark?.months} months.`,
      source: 'SBP data / dashboard calculation',
    },
    fbrGap != null && {
      area: 'Fiscal revenue',
      signal: `${fmtPkrBn(Math.abs(fbrGap))} ${fbrGap >= 0 ? 'ahead' : 'short'}`,
      status: fbrGap >= 0 ? 'ok' : 'behind',
      detail: `${fbr.data.fytd.period}; reported ${fmtPkrBn(fbr.data.fytd.net)} vs target ${fmtPkrBn(fbr.data.fytd.target)}.`,
      source: fbr.data.fytd.sourceLabel || 'FBR',
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
      detail: `$${hardRepayment}B hard-cash ${fy.fyLabel} repayment vs $${sbpReserves}B SBP reserves.`,
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
        sourceLinks={sourceLinksWithFytd(fbr.data?.fytd)}
      />
        {hasPartialFailure && <PartialFailureNote failed={failed} onRetry={retryAll} />}
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
        <p className="insight-note">{tx("Rows are omitted automatically if a verified source value is missing.")}</p>
      </section>
    );
  }

export function ImfComplianceSection() {
  const { tx } = useI18n();
  const imf = useData('imf-tracker.json');
  const fbr = useData('fbr-tax.json');
  const reservesAdequacy = useData('reserves-adequacy.json');
  const circularDebt = useData('circular-debt.json');
  const policy = useData('monetary-policy.json');

  const sources = [imf, fbr, reservesAdequacy, circularDebt, policy];
    const { loading, failed, retryAll, hasPartialFailure } = multiState(sources);
    if (loading) return <LoadingCard label="Loading IMF compliance tracker…" />;
    const fy = resolveFyLabels(fbr, policy);
    const nextFyFull = `FY${fy.fy + 1}`;
    const nextFyLabel = `FY${String(fy.fy + 1).slice(-2)}`;

    const fbrFyCurrent = fbr.data?.annualTargets?.find((row) => row.fyLabel === fy.fyFull || row.fyLabel === fy.fyLabel);
        const fbrFyNext = fbr.data?.annualTargets?.find((row) => row.fyLabel === nextFyFull || row.fyLabel === nextFyLabel);
        const fbrFy26 = fbrFyCurrent;
        const fbrFy27 = fbrFyNext;
        const fbrFy26Reference = fbrFy26?.actual ?? fbrFy26?.estimate;
        const fbrFy26ReferenceLabel = fbrFy26?.actual != null
      ? `reported ${fy.fyLabel} collection`
      : `${fy.fyLabel} budget-speech estimate`;
    const circularTarget = circularDebt.data?.targets?.find(
      (target) => target.label === fy.fyFull || target.label === fy.fyLabel || target.label === `FY${fy.fy}`,
    );
  const scoreItems = imf.data?.programScorecard?.items || [];
  const watchItems = [
    fbrFy26?.actual != null && fbrFy26?.budgetTarget != null && {
      label: `FBR ${fy.fyLabel} collection`,
      target: `Budget target ${fmtPkrBn(fbrFy26.budgetTarget)}`,
      actual: `Reported collection ${fmtPkrBn(fbrFy26.actual)}`,
      met: fbrFy26.actual >= fbrFy26.budgetTarget,
      source: 'FBR / budget documents',
    },
    fbrFy27?.budgetTarget != null && fbrFy26Reference != null && {
            label: `${nextFyLabel} tax effort`,
      target: `Budget target ${fmtPkrBn(fbrFy27.budgetTarget)}`,
      actual: `${fmtPct(pctChange(fbrFy27.budgetTarget, fbrFy26Reference))} above ${fbrFy26ReferenceLabel}`,
      met: null,
      source: 'Finance Division / FBR',
    },
    reservesAdequacy.data?.current && {
      label: 'Import-cover buffer',
      target: `${reservesAdequacy.data.benchmark?.months} months benchmark`,
      actual: `${reservesAdequacy.data.current.importCoverMonths} months as of ${reservesAdequacy.data.current.asOf}`,
      met: reservesAdequacy.data.current.importCoverMonths >= reservesAdequacy.data.benchmark?.months,
      source: 'SBP data / dashboard calculation',
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
              {hasPartialFailure && <PartialFailureNote failed={failed} onRetry={retryAll} />}
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
          <h3>{tx("IMF-published scorecard")}</h3>
          {scoreItems.map((item, index) => renderItem(item, index, imf.data?.programScorecard?.source))}
        </div>
        <div className="card">
          <h3>{tx("Live watch items")}</h3>
          {watchItems.map((item, index) => renderItem(item, index))}
        </div>
      </div>
      <p className="insight-note">{imf.data?.methodologyNote}</p>
    </section>
  );
}

export function ExternalFinancingWallSection() {
  const { tx } = useI18n();
  const externalDebt = useData('external-debt.json');
  const reservesAdequacy = useData('reserves-adequacy.json');
  const reserves = useData('reserves.json');

  const sources = [externalDebt, reservesAdequacy, reserves];
    const { loading, failed, retryAll, hasPartialFailure } = multiState(sources);
    if (loading) return <LoadingCard label="Loading external financing wall…" />;
    const fy = resolveFyLabels(reserves, externalDebt);

    const fy26 = externalDebt.data?.fy26;
    const latestReserve = latest(reserves.data?.weekly);
    const chart = {
      labels: [`${fy.fyLabel} external servicing`],
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
      title: `Gross ${fy.fyLabel} servicing`,
      value: `$${fy26.grossRepayment}B`,
      meta: `range ${fy26.grossRange}B`,
      body: fy26.note,
      tone: 'neutral',
      source: 'SBP briefings / financial media',
      sourceUrl: externalDebt.data?.sourceUrl,
    },
    fy26?.expectedRollovers != null && isFiniteNumber(fy26.grossRepayment) && fy26.grossRepayment !== 0 && {
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
        description={`A source-backed view of the repayment wall, expected rollovers, hard-cash burden, and reserve cushion. ${`FY${String(fy.fy + 1).slice(-2)}`} is shown only as a public range when detailed maturities are not fully public.`}
        sourceLinks={[{ label: 'IMF Pakistan', url: externalDebt.data?.sourceUrl || 'https://www.imf.org/en/Countries/PAK' }, { label: 'SBP reserves', url: 'https://www.sbp.org.pk/ecodata/index2.asp' }]}
      />
              {hasPartialFailure && <PartialFailureNote failed={failed} onRetry={retryAll} />}
              <div className="insight-grid">
                {cards.map((card) => <InsightCard key={card.title} {...card} />)}
              </div>
              <div className="card chart-card">
                <div className="chart-card-header"><h3>{tx(`${fy.fyLabel} repayment split`)}</h3></div>
        <div className="chart-container short"><Bar data={chart} options={options} /></div>
      </div>
      {externalDebt.data?.fy27?.note && <p className="insight-note">{externalDebt.data.fy27.note}</p>}
    </section>
  );
}

export function RevenueTargetMeterSection() {
  const fbr = useData('fbr-tax.json');
  if (fbr.loading) return <LoadingCard label="Loading revenue target meter…" />;
  if (fbr.error || !fbr.data) return <ErrorCard error={fbr.error} onRetry={fbr.retry} label="Revenue target meter" />;

  const fy = resolveFyLabels(fbr);
  const nextFyLabel = `FY${String(fy.fy + 1).slice(-2)}`;
  const fy26 = fbr.data.annualTargets?.find((row) => row.fyLabel === fy.fyFull || row.fyLabel === fy.fyLabel);
    const fy27 = fbr.data.annualTargets?.find((row) => row.fyLabel === `FY${fy.fy + 1}` || row.fyLabel === nextFyLabel);
  const fytd = fbr.data.fytd;
  const fy26BudgetGap = isFiniteNumber(fy26?.actual) && isFiniteNumber(fy26?.budgetTarget) ? fy26.actual - fy26.budgetTarget : null;
  const fy26RevisedGap = isFiniteNumber(fy26?.actual) && isFiniteNumber(fy26?.revisedTarget) ? fy26.actual - fy26.revisedTarget : null;
  const fy26Reference = isFiniteNumber(fy26?.actual) ? fy26.actual : (isFiniteNumber(fy26?.estimate) ? fy26.estimate : null);
  const fy26ReferenceLabel = isFiniteNumber(fy26?.actual) ? 'actual' : 'budget-speech estimate';
  const fy27Increase = isFiniteNumber(fy27?.budgetTarget) && isFiniteNumber(fy26Reference) ? pctChange(fy27.budgetTarget, fy26Reference) : null;
  const currentLabel = fy26?.fyLabel || fy.fyLabel;
  const nextLabel = fy27?.fyLabel || nextFyLabel;

  const chart = {
    labels: [`${currentLabel} budget`, `${currentLabel} revised`, `${currentLabel} ${fy26ReferenceLabel}`, `${nextLabel} target`],
    datasets: [{
      label: 'FBR net collection / target',
      data: [fy26?.budgetTarget, fy26?.revisedTarget, fy26Reference, fy27?.budgetTarget],
      backgroundColor: [COLORS.blue, COLORS.amber, fy26?.actual != null ? (fy26BudgetGap >= 0 ? COLORS.teal : COLORS.coral) : COLORS.text, COLORS.purple],
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
        description="Available FBR collections and explicitly labeled budget estimates versus official targets. Missing official actuals are not inferred."
        sourceLinks={[{
          label: fytd?.sourceLabel || 'FBR',
          url: fytd?.source || fbr.data.sourceUrl || 'https://www.fbr.gov.pk',
        }]}
      />
      <div className="insight-grid">
        {fytd && isFiniteNumber(fytd.net) && isFiniteNumber(fytd.target) && <InsightCard title={isClosedFiscalPeriod(fytd.period) ? `${fytd.fyLabel || 'Full year'} result` : 'FYTD pace'} value={`${fmtPkrBn(fytd.net)} collected`} meta={`${fmtPkrBn(Math.abs(fytd.net - fytd.target))} ${fytd.net >= fytd.target ? 'ahead' : 'short'} vs target`} body={`${fytd.period}; prior-year same-period collection was ${fmtPkrBn(fytd.priorNet)}.`} source={fytd.sourceLabel || 'FBR'} sourceUrl={fytd.source} tone={fytd.net >= fytd.target ? 'positive' : 'negative'} />}
                {fy26BudgetGap != null && <InsightCard title={`${currentLabel} budget target gap`} value={`${fmtPkrBn(Math.abs(fy26BudgetGap))} ${fy26BudgetGap >= 0 ? 'ahead' : 'short'}`} meta={`Actual ${fmtPkrBn(fy26.actual)} vs budget ${fmtPkrBn(fy26.budgetTarget)}`} body={fy26.note} source="FBR / budget documents" sourceUrl={fy26.sources?.[0]?.url} tone={fy26BudgetGap >= 0 ? 'positive' : 'negative'} />}
                {fy26RevisedGap != null && <InsightCard title={`${currentLabel} revised target gap`} value={`${fmtPkrBn(Math.abs(fy26RevisedGap))} ${fy26RevisedGap >= 0 ? 'ahead' : 'short'}`} meta={`Revised target ${fmtPkrBn(fy26.revisedTarget)}`} body="Shows whether the year ended above or below the revised IMF/FBR target in the source data." source="FBR / IMF reporting" sourceUrl={fy26.sources?.[0]?.url} tone={fy26RevisedGap >= 0 ? 'positive' : 'negative'} />}
                {fy27Increase != null && <InsightCard title={`${nextLabel} required uplift`} value={fmtPct(fy27Increase)} meta={`${fmtPkrBn(fy27.budgetTarget)} target`} body={`Increase implied by the ${nextLabel} budget target compared with the ${currentLabel} ${fy26ReferenceLabel}.`} source="Finance Division / FBR" sourceUrl={fy27.sources?.[0]?.url} tone="neutral" />}
      </div>
      <div className="card chart-card">
        <div className="chart-container"><Bar data={chart} options={options} /></div>
      </div>
              {isFiniteNumber(fy26?.actual) && isFiniteNumber(fy26?.budgetTarget) && fy26.budgetTarget !== 0 && <ProgressMeter label={`${currentLabel} actual vs budget target`} value={fy26.actual} max={fy26.budgetTarget} color={fy26.actual >= fy26.budgetTarget ? COLORS.teal : COLORS.coral} detail={`${fmt((fy26.actual / fy26.budgetTarget) * 100, 1)}% of budget target achieved`} />}
      <p className="insight-note">{fbr.data.methodologyNote}</p>
    </section>
  );
}

export function ItExportDeepDiveSection() {
  const { tx } = useI18n();
  const services = useData('services.json');
  if (services.loading) return <LoadingCard label="Loading IT export deep dive…" />;
  if (services.error || !services.data) return <ErrorCard error={services.error} onRetry={services.retry} label="IT export deep dive" />;

  const itMonthly = services.data.itMonthly;
  const components = itMonthly?.components || [];
  const detailItTotal = components.find((item) => item.key === 'itTotal');
  const itTotal = services.data.itHeadline
    ? {
        ...services.data.itHeadline,
        key: 'itTotal',
        name: 'IT & Telecom (total)',
      }
    : detailItTotal;
  const freelance = components.find((item) => item.key === 'freelance');
  const softwareConsultancy = components.find((item) => item.key === 'softwareConsultancy');
  const softwareExports = components.find((item) => item.key === 'softwareExports');
  const monthly = services.data.monthlySeries || [];
  const chart = {
    labels: monthly.map((row) => row.month),
    datasets: [
      { label: 'IT & Telecom exports', data: monthly.map((row) => row.itCredit), backgroundColor: COLORS.teal, borderRadius: 6 },
      { label: 'Freelance IT exports', data: monthly.map((row) => row.freelanceCredit), backgroundColor: COLORS.amber, borderRadius: 6 },
      {
        label: 'Non-freelance IT exports',
        data: monthly.map((row) => (
          row.itCredit == null || row.freelanceCredit == null
            ? null
            : Math.max(0, row.itCredit - row.freelanceCredit)
        )),
        backgroundColor: COLORS.blue,
        borderRadius: 6,
      },
    ],
  };
  const options = {
    ...baseBarOptions,
    scales: {
      ...baseBarOptions.scales,
      y: { ...baseBarOptions.scales.y, title: { display: true, text: 'US$ million', color: COLORS.text } },
    },
  };
  const sameLatestMonth = freelance?.latestMonth === itTotal?.latestMonth;
  const sameFytdPeriod = freelance?.fytdLabel === itTotal?.fytdLabel;
  const freelanceShare = sameLatestMonth && itTotal?.latest ? (freelance?.latest / itTotal.latest) * 100 : null;
  const fytdFreelanceShare = sameFytdPeriod && itTotal?.fytd ? (freelance?.fytd / itTotal.fytd) * 100 : null;

  return (
    <section className="fade-in">
      <SectionHeader
        title="IT Export Deep Dive"
        description="A focused view of monthly IT & Telecom exports from SBP’s headline services table, with formal freelance receipts and computer-services composition from the detailed EBOPS release."
        sourceLinks={[
          { label: 'SBP Services Headline', url: 'https://www.sbp.org.pk/assets/document/ExportsImports-Goods.pdf' },
          { label: 'SBP BOP Detail', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
        ]}
      />
      <div className="insight-grid">
        {itTotal && <InsightCard title="Latest IT & Telecom exports" value={`$${fmt(itTotal.latest)}M`} meta={itTotal.latestMonth || itMonthly.latestMonth} body={`FYTD exports are $${fmt(itTotal.fytd)}M, ${fmtPct(pctChange(itTotal.fytd, itTotal.fytdPrior))} versus ${itTotal.fytdPriorLabel || itMonthly.fytdPriorLabel}.`} source="SBP Services Headline" sourceUrl="https://www.sbp.org.pk/assets/document/ExportsImports-Goods.pdf" tone="positive" />}
        {freelance && <InsightCard title="Latest Freelance IT exports" value={`$${fmt(freelance.latest)}M`} meta={freelanceShare == null ? freelance.latestMonth : `${fmt(freelanceShare)}% of latest IT exports`} body={fytdFreelanceShare == null ? `FYTD freelance IT exports are $${fmt(freelance.fytd)}M through ${freelance.fytdLabel}.` : `FYTD freelance IT exports are $${fmt(freelance.fytd)}M, ${fmt(fytdFreelanceShare)}% of IT & Telecom exports.`} source="SBP EBOPS" sourceUrl="https://www.sbp.org.pk/ecodata/index2.asp" tone="positive" />}
        {softwareConsultancy && <InsightCard title="Software consultancy" value={`$${fmt(softwareConsultancy.latest)}M`} meta={`${softwareConsultancy.latestMonth} · ${fmtPct(pctChange(softwareConsultancy.latest, softwareConsultancy.yearAgo))} YoY`} body={`FYTD software consultancy exports are $${fmt(softwareConsultancy.fytd)}M through ${softwareConsultancy.fytdLabel}.`} source="SBP EBOPS" sourceUrl="https://www.sbp.org.pk/ecodata/index2.asp" tone="neutral" />}
        {softwareExports && <InsightCard title="Computer software exports" value={`$${fmt(softwareExports.latest)}M`} meta={`${softwareExports.latestMonth} · ${fmtPct(pctChange(softwareExports.latest, softwareExports.yearAgo))} YoY`} body={`FYTD computer software exports are $${fmt(softwareExports.fytd)}M through ${softwareExports.fytdLabel}.`} source="SBP EBOPS" sourceUrl="https://www.sbp.org.pk/ecodata/index2.asp" tone="neutral" />}
      </div>
      <div className="card chart-card">
        <div className="chart-card-header"><h3>{tx("Monthly IT and freelance export receipts")}</h3></div>
        <div className="chart-container tall"><Bar data={chart} options={options} /></div>
      </div>
      <p className="insight-note">{itMonthly?.note}</p>
    </section>
  );
}

export function PeerComparisonSection() {
  const { tx } = useI18n();
  const { data, loading, error, retry } = useData('peer-comparison.json');
  const [activeId, setActiveId] = useState('gdp-growth');

  const active = useMemo(
    () => data?.indicators?.find((indicator) => indicator.id === activeId) || data?.indicators?.[0],
    [data, activeId],
  );

  if (loading) return <LoadingCard label="Loading World Bank peer data…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Peer comparison" />;

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
          <thead><tr><th>{tx("Country")}</th><th>{tx("Value")}</th><th>{tx("Official year")}</th></tr></thead>
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
