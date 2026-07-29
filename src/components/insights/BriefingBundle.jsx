import { isFiniteNumber } from '../../utils/periodHelpers';
import DataFreshnessPanel from '../DataFreshnessPanel';
import SectionHeader from '../SectionHeader';
import { LoadingCard, ErrorCard } from '../ui/DataState';
import {
  SOURCE_LINKS,
  sourceLinksWithFytd,
  fmt,
  signed,
  latest,
  previous,
  yoyRow,
  pctChange,
  trendClass,
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
export function GoodBadWatchSection() {
  const { tx } = useI18n();
  const remittances = useData('remittances.json');
  const services = useData('services.json');
  const reserves = useData('reserves.json');
  const fbr = useData('fbr-tax.json');
  const policy = useData('monetary-policy.json');
  const circularDebt = useData('circular-debt.json');
  const imf = useData('imf-tracker.json');
  const trade = useData('trade.json');

  const sources = [remittances, services, reserves, fbr, policy, circularDebt, imf, trade];
    const { loading, failed, retryAll, hasPartialFailure } = multiState(sources);
    if (loading) return <LoadingCard label="Writing verified Good / Bad / Watch brief…" />;
    const fy = resolveFyLabels(trade, remittances, services);

    const latestRemit = latest(remittances.data?.monthly);
    const remitYoy = yoyRow(remittances.data?.monthly, latestRemit?.date);
    const remitGrowth = pctChange(latestRemit?.total, remitYoy?.total);
    const latestReserve = latest(reserves.data?.weekly);
    const prevReserve = previous(reserves.data?.weekly);
    const reserveChange = latestReserve && prevReserve ? latestReserve.sbp - prevReserve.sbp : null;
    const fbrGap = fbr.data?.fytd && isFiniteNumber(fbr.data.fytd.net) && isFiniteNumber(fbr.data.fytd.target)
      ? fbr.data.fytd.net - fbr.data.fytd.target
      : null;
    const latestTrade = latest(trade.data?.monthly);
    const itTotal = services.data?.itMonthly?.components?.find((item) => item.key === 'itTotal');
    const freelance = services.data?.itMonthly?.components?.find((item) => item.key === 'freelance');
    const circularTarget = circularDebt.data?.targets?.find(
      (target) => target.label === fy.fyFull || target.label === fy.fyLabel || target.label === `FY${fy.fy}`,
    );

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
                circularTarget?.status === 'at risk' && `Circular-debt ${fy.fyLabel} target is at risk: ${circularTarget.statusNote}`,
                (() => {
                  const next = fbr.data?.annualTargets?.find((row) => row.fyLabel === `FY${fy.fy + 1}` || row.fyLabel === `FY${String(fy.fy + 1).slice(-2)}`);
                  return next?.budgetTarget != null && `${next.fyLabel || `FY${fy.fy + 1}`} FBR target is ${fmtPkrBn(next.budgetTarget)}.`;
                })(),
                services.data?.itMonthly?.latestMonth && `Track whether IT/freelance exports extend the latest monthly trend after ${services.data.itMonthly.latestMonth}.`,
              ].filter(Boolean),
            },
          ];

          return (
            <section className="fade-in">
              <SectionHeader
                title="Good / Bad / Watch Brief"
                description="A rule-based monthly brief from verified dashboard data. It intentionally avoids adding unverified claims, forecasts, or figures not present in source-backed datasets."
                sourceLinks={sourceLinksWithFytd(fbr.data?.fytd)}
              />
              {hasPartialFailure && <PartialFailureNote failed={failed} onRetry={retryAll} />}
              <div className="brief-columns">
        {columns.map((column) => (
          <div key={column.title} className={`brief-column brief-column--${column.tone}`}>
            <h3>{column.title}</h3>
            <ul>
              {column.items.length ? column.items.map((item) => <li key={item}>{item}</li>) : <li>{tx("No verified item currently qualifies.")}</li>}
            </ul>
          </div>
        ))}
      </div>
      <p className="insight-note">This brief is generated from source-backed dashboard JSON only; if a datapoint is incomplete, it is not shown.</p>
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

  const sources = [kpi, trade, remittances, inflation, reserves, fbr];
  const { loading, failed, retryAll, hasPartialFailure } = multiState(sources);
  if (loading) return <LoadingCard label="Building the latest official-data briefing…" />;

  const t = latest(trade.data?.monthly);
  const tPrev = previous(trade.data?.monthly);
  const r = latest(remittances.data?.monthly);
  const rYoy = yoyRow(remittances.data?.monthly, r?.date);
  const inf = latest(inflation.data?.national_cpi?.data);
  const infPrev = previous(inflation.data?.national_cpi?.data);
  const res = latest(reserves.data?.weekly);
  const resPrev = previous(reserves.data?.weekly);
  const fbrGap = fbr.data?.fytd && isFiniteNumber(fbr.data.fytd.net) && isFiniteNumber(fbr.data.fytd.target)
    ? fbr.data.fytd.net - fbr.data.fytd.target
    : null;

  const cards = [
    isFiniteNumber(res?.total) && {
      title: 'External buffer',
      value: `$${fmt(res.total / 1000, 2)}B`,
      meta: `${res.date || 'Latest'} · ${resPrev && isFiniteNumber(resPrev.total) ? `${signed((res.total - resPrev.total) / 1000, 'B', 2)} vs prior week` : '—'}`,
      tone: resPrev && isFiniteNumber(resPrev.total) ? trendClass(res.total - resPrev.total) : 'neutral',
      body: 'Reserves are the first line of defense against import and external-debt pressure. Watch both the level and import-cover months.',
      source: 'State Bank of Pakistan',
      sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    },
    isFiniteNumber(r?.total) && {
      title: 'Remittance support',
      value: `$${fmt(r.total / 1000, 2)}B`,
      meta: `${r.date || 'Latest'} · ${signed(pctChange(r.total, rYoy?.total), '% YoY')}`,
      tone: trendClass(pctChange(r.total, rYoy?.total)),
      body: 'Remittances are one of Pakistan’s most important recurring foreign-exchange inflows and can offset part of the trade gap.',
      source: 'SBP EasyData',
      sourceUrl: 'https://easydata.sbp.org.pk',
    },
    isFiniteNumber(t?.balance) && {
      title: 'Trade gap',
      value: `$${fmt(Math.abs(t.balance) / 1000, 2)}B deficit`,
      meta: `${t.date || 'Latest'} · ${tPrev && isFiniteNumber(tPrev.balance) ? `${signed(t.balance - tPrev.balance, 'M', 0)} vs prior month` : '—'}`,
      tone: tPrev && isFiniteNumber(tPrev.balance) ? trendClass(t.balance - tPrev.balance) : 'neutral',
      body: 'A smaller negative balance eases pressure on reserves. Imports, exports, and remittances should be read together.',
      source: 'State Bank of Pakistan',
      sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
    },
    isFiniteNumber(inf?.value) && {
      title: 'Inflation pulse',
      value: `${fmt(inf.value)}%`,
      meta: `${inf.date || 'Latest'} · ${infPrev && isFiniteNumber(infPrev.value) ? `${signed(inf.value - infPrev.value, ' pp')}` : '—'}`,
      tone: infPrev && isFiniteNumber(infPrev.value) ? trendClass(inf.value - infPrev.value, false) : 'neutral',
      body: 'Inflation determines household purchasing power and guides SBP policy-rate decisions.',
      source: 'PBS via SBP EasyData',
      sourceUrl: 'https://easydata.sbp.org.pk',
    },
    fbrGap != null && {
      title: 'Tax target pressure',
      value: `₨${fmt(Math.abs(fbrGap), 0)}B ${fbrGap >= 0 ? 'ahead' : 'short'}`,
      meta: fbr.data?.fytd?.period,
      tone: fbrGap >= 0 ? 'positive' : 'negative',
      body: 'Tax collection relative to target indicates how much fiscal adjustment may be needed through revenue measures or spending control.',
      source: fbr.data?.fytd?.sourceLabel || 'Federal Board of Revenue',
      sourceUrl: fbr.data?.fytd?.source || 'https://www.fbr.gov.pk',
    },
  ].filter(Boolean);

  return (
    <section className="fade-in">
      <SectionHeader
        title="Monthly Economic Briefing"
        description="A plain-English briefing generated from the same source-attributed datasets that power the dashboard. It highlights what changed, why it matters, and which source backs each statement."
        sourceLinks={sourceLinksWithFytd(fbr.data?.fytd)}
      />
      {hasPartialFailure && <PartialFailureNote failed={failed} onRetry={retryAll} />}
      <div className="insight-grid">
        {cards.map((card) => <InsightCard key={card.title} {...card} />)}
      </div>
      <p className="insight-note">Interpretation is rule-based and limited to official data already shown in the dashboard; it does not infer unpublished values.</p>
    </section>
  );
}

export function RiskOutlookSection() {
  const { tx } = useI18n();
  const fiscal = useData('fiscal.json');
  const fbr = useData('fbr-tax.json');
  const reservesAdequacy = useData('reserves-adequacy.json');
  const externalDebt = useData('external-debt.json');
  const inflation = useData('inflation.json');
  const remittances = useData('remittances.json');
  const trade = useData('trade.json');
  const indicators = useData('indicators.json');

  const sources = [fiscal, fbr, reservesAdequacy, externalDebt, inflation, remittances, trade, indicators];
    const { loading, failed, retryAll, hasPartialFailure } = multiState(sources);
    if (loading) return <LoadingCard label="Assembling risk, household, and trend-watch panels…" />;
    const fy = resolveFyLabels(trade, remittances, inflation);

    const pf = fiscal.data?.publicFinance || {};
    const latestFiscal = latest(pf.fiscal_balance?.data);
    const latestPrimary = latest(pf.primary_balance?.data);
    const latestInf = latest(inflation.data?.national_cpi?.data);
    const priorInf = previous(inflation.data?.national_cpi?.data);
    const latestRemit = latest(remittances.data?.monthly);
    const remit3m = (remittances.data?.monthly || []).slice(-3);
    const remitAvg = remit3m.length
      ? remit3m.reduce((sum, row) => sum + (Number(row.total) || 0), 0) / remit3m.length
      : null;
    const latestTrade = latest(trade.data?.monthly);
    const trade3m = (trade.data?.monthly || []).slice(-3);
    const tradeAvg = trade3m.length
      ? trade3m.reduce((sum, row) => sum + (Number(row.balance) || 0), 0) / trade3m.length
      : null;
    const petrol = indicators.data?.indicators?.find((row) => row.id === 'petrol-price');
    const policy = indicators.data?.indicators?.find((row) => row.id === 'policy-rate');
    const publicDebt = indicators.data?.indicators?.find((row) => row.id === 'public-debt');
    const circularDebt = indicators.data?.indicators?.find((row) => row.id === 'circular-debt');
    const fbrGap = fbr.data?.fytd && isFiniteNumber(fbr.data.fytd.net) && isFiniteNumber(fbr.data.fytd.target)
      ? fbr.data.fytd.net - fbr.data.fytd.target
      : null;

    return (
      <section className="fade-in">
        <SectionHeader
          title="Risk, Outlook & Household Impact"
          description="Source-backed panels that connect macro indicators to fiscal pressure, external vulnerability, and everyday household impact. Forward-looking labels are trend math only, not forecasts."
          sourceLinks={sourceLinksWithFytd(fbr.data?.fytd)}
        />
        {hasPartialFailure && <PartialFailureNote failed={failed} onRetry={retryAll} />}

        <div className="insight-two-col">
          <div className="context-block card">
            <h3>{tx("Fiscal stress monitor")}</h3>
            <div className="context-list">
              <div><span>{tx("Fiscal balance")}</span><strong>{latestFiscal ? `₨${fmt(latestFiscal.value / 1e6, 2)}T` : '—'}</strong><small>{latestFiscal?.fy}</small></div>
              <div><span>{tx("Primary balance")}</span><strong>{latestPrimary ? `₨${fmt(latestPrimary.value / 1e6, 2)}T` : '—'}</strong><small>{latestPrimary?.fy}</small></div>
              <div><span>{tx("FBR target gap")}</span><strong>{fbrGap == null ? '—' : `₨${fmt(Math.abs(fbrGap), 0)}B ${fbrGap >= 0 ? 'ahead' : 'short'}`}</strong><small>{fbr.data?.fytd?.period || '—'}</small></div>
              <div><span>{tx("Public debt")}</span><strong>{publicDebt ? `${publicDebt.value}${publicDebt.unit || ''}` : '—'}</strong><small>{publicDebt?.change || '—'}</small></div>
              <div><span>{tx("Power circular debt")}</span><strong>{circularDebt ? `${circularDebt.value}${circularDebt.unit || ''}` : '—'}</strong><small>{circularDebt?.asOf || '—'}</small></div>
            </div>
          </div>

          <div className="context-block card">
            <h3>{tx("External vulnerability scorecard")}</h3>
            <div className="context-list">
              <div><span>{tx("Import cover")}</span><strong>{reservesAdequacy.data?.current?.importCoverMonths != null ? `${reservesAdequacy.data.current.importCoverMonths} months` : '—'}</strong><small>{reservesAdequacy.data?.benchmark?.label || '—'}</small></div>
              <div><span>{tx("SBP reserves")}</span><strong>{reservesAdequacy.data?.current?.sbpReserves != null ? `$${reservesAdequacy.data.current.sbpReserves}B` : '—'}</strong><small>{reservesAdequacy.data?.current?.asOf || '—'}</small></div>
              <div><span>{tx(`${fy.fyLabel} gross external repayment`)}</span><strong>{externalDebt.data?.fy26?.grossRepayment != null ? `$${externalDebt.data.fy26.grossRepayment}B` : '—'}</strong><small>rollovers remain critical</small></div>
              <div><span>{tx("Hard-cash repayment")}</span><strong>{externalDebt.data?.fy26?.hardRepayment != null ? `$${externalDebt.data.fy26.hardRepayment}B` : '—'}</strong><small>interest + non-rolled principal</small></div>
              <div><span>{tx("Latest trade deficit")}</span><strong>{isFiniteNumber(latestTrade?.balance) ? `$${fmt(Math.abs(latestTrade.balance) / 1000, 2)}B` : '—'}</strong><small>{latestTrade?.date || '—'}</small></div>
            </div>
          </div>
        </div>

        <div className="insight-two-col">
          <div className="context-block card">
            <h3>{tx("Household impact view")}</h3>
            <div className="context-list">
              <div><span>{tx("CPI inflation")}</span><strong>{isFiniteNumber(latestInf?.value) ? `${fmt(latestInf.value)}%` : '—'}</strong><small>{latestInf?.date || '—'}</small></div>
              <div><span>{tx("Inflation momentum")}</span><strong>{isFiniteNumber(latestInf?.value) && isFiniteNumber(priorInf?.value) ? signed(latestInf.value - priorInf.value, ' pp') : '—'}</strong><small>latest vs prior month</small></div>
              <div><span>{tx("Policy rate")}</span><strong>{policy ? `${policy.value}${policy.unit || ''}` : '—'}</strong><small>{policy?.asOf || '—'}</small></div>
              <div><span>{tx("Petrol price")}</span><strong>{petrol ? `${petrol.value}${petrol.unit || ''}` : '—'}</strong><small>{petrol?.asOf || '—'}</small></div>
            </div>
          </div>

          <div className="context-block card">
            <h3>{tx("Trend watch, not a forecast")}</h3>
            <div className="context-list">
              <div><span>{tx("Remittances vs 3-month average")}</span><strong>{isFiniteNumber(latestRemit?.total) && isFiniteNumber(remitAvg) ? signed(pctChange(latestRemit.total, remitAvg), '%') : '—'}</strong><small>{latestRemit?.date || '—'}</small></div>
              <div><span>{tx("Trade balance vs 3-month average")}</span><strong>{isFiniteNumber(latestTrade?.balance) && isFiniteNumber(tradeAvg) ? signed(latestTrade.balance - tradeAvg, 'M', 0) : '—'}</strong><small>less negative is better</small></div>
              <div><span>{tx("Inflation direction")}</span><strong>{isFiniteNumber(latestInf?.value) && isFiniteNumber(priorInf?.value) ? (latestInf.value >= priorInf.value ? 'Rising' : 'Cooling') : '—'}</strong><small>latest official CPI print</small></div>
              <div><span>{tx("Tax collection vs FYTD target")}</span><strong>{fbrGap == null ? '—' : (fbrGap >= 0 ? 'Ahead' : 'Behind')}</strong><small>source-attributed FYTD comparison</small></div>
            </div>
          </div>
        </div>

      <p className="insight-note">No synthetic estimates are introduced here. Every value is either directly sourced from the dashboard datasets or a transparent arithmetic comparison of source-attributed values.</p>
    </section>
  );
}

export function EconomicTimelineSection() {
  const { data, loading, error, retry } = useData('economic-events.json');
  if (loading) return <LoadingCard label="Loading official economic timeline…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Economic timeline" />;

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
  const { tx } = useI18n();
  const { data, loading, error, retry } = useData('explainers.json');
  if (loading) return <LoadingCard label="Loading learning center…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Learning center" />;

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
                  <strong>{tx("How to read it:")}</strong> {term.howToRead}
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
  const { data, loading, error, retry } = useData('data-freshness.json');
  if (loading) return <LoadingCard label="Loading source trust audit…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Source trust" />;
  const datasets = data?.datasets || [];
  const tiers = data?.tiers || {};

  const byTier = datasets.reduce((acc, dataset) => {
    const key = dataset.sourceType || 'official-primary';
    (acc[key] = acc[key] || []).push(dataset);
    return acc;
  }, {});

  const counts = datasets.reduce((acc, dataset) => {
    if (dataset.apiSeries?.length) acc.api += 1;
    else if (dataset.sourceFile) acc.files += 1;
    else acc.curated += 1;
    if (dataset.critical) acc.critical += 1;
    return acc;
  }, { api: 0, files: 0, curated: 0, critical: 0 });

  const tierOrder = ['official-primary', 'official-derived', 'secondary-attributed'];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Source Confidence & Audit Trail"
        description="Not every number on this dashboard carries the same weight. This page states, dataset by dataset, whether a figure comes straight from the issuing institution, is derived here from official inputs, or is currently only available through press reporting of official figures."
        sourceLinks={SOURCE_LINKS}
      />
      {!loading && (
        <>
          <div className="trust-tier-list">
            {tierOrder.filter((key) => byTier[key]?.length).map((key) => {
              const tier = tiers[key] || {};
              return (
                <div key={key} className={`trust-tier trust-tier--${tier.tone || 'neutral'}`}>
                  <div className="trust-tier__head">
                    <h3>{tier.label || key}</h3>
                    <span className="trust-tier__count">{byTier[key].length} datasets</span>
                  </div>
                  <p className="trust-tier__desc">{tier.description}</p>
                  <ul className="trust-tier__items">
                    {byTier[key].map((dataset) => (
                      <li key={dataset.id}>
                        <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.label}</a>
                        <span>{dataset.sourceLabel || dataset.source}</span>
                        {dataset.verifiedFrom?.length > 0 && (
                          <small>
                            Verified against {dataset.verifiedFrom.length} published report{dataset.verifiedFrom.length === 1 ? '' : 's'}:{' '}
                            {dataset.verifiedFrom.map((url, index) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer">
                                [{index + 1}]
                              </a>
                            ))}
                          </small>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="trust-grid">
            <InsightCard title="Official APIs" value={counts.api} meta="machine-readable series" body="Fetched from SBP EasyData or other official APIs where available." source="Generated source manifest" tone="positive" />
            <InsightCard title="Official files" value={counts.files} meta="Excel/PDF source files" body="Parsed from official SBP/FBR/Finance Division files with source-file metadata." source="Generated source manifest" tone="positive" />
            <InsightCard title="Curated official documents" value={counts.curated} meta="event-driven datasets" body="Used only where no stable machine-readable feed exists; each card links to primary sources." source="Generated source manifest" tone="neutral" />
            <InsightCard title="Critical datasets" value={counts.critical} meta="freshness-monitored" body="Core indicators are checked by the audit script before build/deploy." source="Generated source manifest" tone="positive" />
          </div>
        </>
      )}
      <DataFreshnessPanel />
    </section>
  );
}
