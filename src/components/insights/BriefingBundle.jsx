import { avgField, isFiniteNumber } from '../../utils/periodHelpers';
import { resolveSourceTier, TRUST_LABELS } from '../../utils/figureTrust';
import DataFreshnessPanel from '../DataFreshnessPanel';
import SectionHeader from '../SectionHeader';
import { LoadingCard, ErrorCard, UnavailableCard } from '../ui/DataState';
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
import { ProgressMeter, InsightCard, PartialFailureNote, TrustedContextValue } from './shared.jsx';
import FigureTrust from '../FigureTrust';
import useI18n from '../../i18n/useI18n';
import '../ui/Insights.css';
export function GoodBadWatchSection() {
  const { t, tx } = useI18n();
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
    if (loading) return <LoadingCard label="Building the latest official-data briefing…" />;
    const fy = resolveFyLabels(trade, remittances, services);

    const latestRemit = latest(remittances.data?.monthly);
    const remitYoy = yoyRow(remittances.data?.monthly, latestRemit?.date);
    const remitGrowth = pctChange(latestRemit?.total, remitYoy?.total);
    const latestReserve = latest(reserves.data?.weekly);
    const prevReserve = previous(reserves.data?.weekly);
    const reserveChange = isFiniteNumber(latestReserve?.sbp) && isFiniteNumber(prevReserve?.sbp) ? latestReserve.sbp - prevReserve.sbp : null;
    const fbrGap = fbr.data?.fytd && isFiniteNumber(fbr.data.fytd.net) && isFiniteNumber(fbr.data.fytd.target)
      ? fbr.data.fytd.net - fbr.data.fytd.target
      : null;
    const latestTrade = latest(trade.data?.monthly);
    const itTotal = services.data?.itHeadline
      || services.data?.itMonthly?.components?.find((item) => item.key === 'itTotal');
    const freelance = services.data?.itMonthly?.components?.find((item) => item.key === 'freelance');
    const circularTarget = circularDebt.data?.targets?.find(
      (target) => target.label === fy.fyFull || target.label === fy.fyLabel || target.label === `FY${fy.fy}`,
    );
    const itGrowth = pctChange(itTotal?.fytd, itTotal?.fytdPrior);
    const freelanceGrowth = pctChange(freelance?.fytd, freelance?.fytdPrior);
    const claim = (text, datasetId, row, period, derivation) => ({ text, datasetId, row, period, derivation });

  const columns = [
    {
      title: 'Good',
      tone: 'positive',
      items: [
        remitGrowth > 0 && claim(`Remittances rose ${fmtPct(remitGrowth)} YoY in ${latestRemit.date}.`, 'remittances', latestRemit, latestRemit.date, '(Current month ÷ same month last year − 1) × 100'),
        itGrowth > 0 && claim(`IT & Telecom exports are ${fmtPct(itGrowth)} higher FYTD (${itTotal.fytdLabel || services.data?.itMonthly?.fytdLabel}).`, 'services', itTotal, itTotal.fytdLabel, '(Current FYTD ÷ prior-year same-period FYTD − 1) × 100'),
        freelanceGrowth > 0 && claim(`Freelance IT exports are ${fmtPct(freelanceGrowth)} higher FYTD (${freelance.fytdLabel || 'Period not stated'}).`, 'services', freelance, freelance.fytdLabel, '(Current FYTD ÷ prior-year same-period FYTD − 1) × 100'),
        circularDebt.data?.yoy?.changePct < 0 && claim(`Power circular debt stock is down ${Math.abs(circularDebt.data.yoy.changePct)}% YoY as of ${circularDebt.data.current?.asOf}.`, 'circular-debt', circularDebt.data.current, circularDebt.data.current?.asOf),
      ].filter(Boolean),
    },
    {
      title: 'Bad',
      tone: 'negative',
      items: [
        itGrowth < 0 && claim(`IT & Telecom exports are ${fmt(Math.abs(itGrowth))}% lower FYTD (${itTotal.fytdLabel || 'Period not stated'}).`, 'services', itTotal, itTotal.fytdLabel, '(Current FYTD ÷ prior-year same-period FYTD − 1) × 100'),
        freelanceGrowth < 0 && claim(`Freelance IT exports are ${fmt(Math.abs(freelanceGrowth))}% lower FYTD (${freelance.fytdLabel || 'Period not stated'}).`, 'services', freelance, freelance.fytdLabel, '(Current FYTD ÷ prior-year same-period FYTD − 1) × 100'),
        fbrGap < 0 && claim(`FBR collection is ${fmtPkrBn(Math.abs(fbrGap))} below FYTD target (${fbr.data.fytd.period}).`, 'fbr-tax', fbr.data.fytd, fbr.data.fytd.period, 'FYTD net collection − FYTD target'),
        reserveChange < 0 && claim(`SBP reserves fell $${fmt(Math.abs(reserveChange) / 1000, 2)}B in the latest week (${latestReserve.date} vs ${prevReserve.date}).`, 'reserves', latestReserve, latestReserve.date, 'Current weekly SBP reserves − prior weekly SBP reserves'),
        latestTrade?.balance < 0 && claim(`Latest goods trade balance is a $${fmt(Math.abs(latestTrade.balance) / 1000, 2)}B deficit (${latestTrade.date}).`, 'trade', latestTrade, latestTrade.date),
      ].filter(Boolean),
    },
    {
      title: 'Watch',
      tone: 'neutral',
      items: [
        imf.data?.upcomingDecision?.dateText && claim(`${imf.data.upcomingDecision.label}: ${imf.data.upcomingDecision.dateText}.`, 'imf-tracker', imf.data.upcomingDecision, imf.data.upcomingDecision.dateText),
                circularTarget?.status === 'at risk' && claim(`Circular-debt ${fy.fyLabel} target is at risk: ${circularTarget.statusNote}`, 'circular-debt', circularTarget, fy.fyLabel),
                (() => {
                  const next = fbr.data?.annualTargets?.find((row) => row.fyLabel === `FY${fy.fy + 1}` || row.fyLabel === `FY${String(fy.fy + 1).slice(-2)}`);
                  return isFiniteNumber(next?.budgetTarget) && claim(`${next.fyLabel || `FY${fy.fy + 1}`} FBR target is ${fmtPkrBn(next.budgetTarget)}.`, 'fbr-tax', next, next.fyLabel);
                })(),
                (services.data?.itHeadline?.latestMonth || services.data?.itMonthly?.latestMonth) && claim(`Track whether IT/freelance exports extend the latest monthly trend after ${services.data?.itHeadline?.latestMonth || services.data.itMonthly.latestMonth}.`, 'services', itTotal, itTotal?.latestMonth),
              ].filter(Boolean),
            },
          ];

          return (
            <section className="fade-in">
              <SectionHeader
                title="Good / Bad / Watch Brief"
                description={t('trust.briefDescription', 'A rule-based brief from published official datasets. Unavailable figures and unverified claims are excluded; calculations retain their source periods.')}
                sourceLinks={sourceLinksWithFytd(fbr.data?.fytd)}
              />
              {hasPartialFailure && <PartialFailureNote failed={failed} onRetry={retryAll} />}
              <div className="brief-columns">
        {columns.map((column) => (
          <div key={column.title} className={`brief-column brief-column--${column.tone}`}>
            <h3>{column.title}</h3>
            <ul>
              {column.items.length ? column.items.map((item) => <li key={item.text}>{tx(item.text)}
                <FigureTrust datasetId={item.datasetId} row={item.row} period={item.period} derivation={item.derivation} compact />
              </li>) : <li>{t('trust.noBriefItem', 'No published official item currently qualifies.')}</li>}
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
      datasetId: 'reserves', row: res,
    },
    isFiniteNumber(r?.total) && {
      title: 'Remittance support',
      value: `$${fmt(r.total / 1000, 2)}B`,
      meta: `${r.date || 'Latest'} · ${signed(pctChange(r.total, rYoy?.total), '% YoY')}`,
      tone: trendClass(pctChange(r.total, rYoy?.total)),
      body: 'Remittances are one of Pakistan’s most important recurring foreign-exchange inflows and can offset part of the trade gap.',
      source: 'SBP EasyData',
      sourceUrl: 'https://easydata.sbp.org.pk',
      datasetId: 'remittances', row: r,
    },
    isFiniteNumber(t?.balance) && {
      title: 'Trade gap',
      value: `$${fmt(Math.abs(t.balance) / 1000, 2)}B ${t.balance < 0 ? 'deficit' : t.balance > 0 ? 'surplus' : 'balanced'}`,
      meta: `${t.date || 'Latest'} · ${tPrev && isFiniteNumber(tPrev.balance) ? `${signed(t.balance - tPrev.balance, 'M', 0)} vs prior month` : '—'}`,
      tone: tPrev && isFiniteNumber(tPrev.balance) ? trendClass(t.balance - tPrev.balance) : 'neutral',
      body: 'A smaller negative balance eases pressure on reserves. Imports, exports, and remittances should be read together.',
      source: 'State Bank of Pakistan',
      sourceUrl: 'https://www.sbp.org.pk/ecodata/index2.asp',
      datasetId: 'trade', row: t,
    },
    isFiniteNumber(inf?.value) && {
      title: 'Inflation pulse',
      value: `${fmt(inf.value)}%`,
      meta: `${inf.date || 'Latest'} · ${infPrev && isFiniteNumber(infPrev.value) ? `${signed(inf.value - infPrev.value, ' pp')}` : '—'}`,
      tone: infPrev && isFiniteNumber(infPrev.value) ? trendClass(inf.value - infPrev.value, false) : 'neutral',
      body: 'Inflation determines household purchasing power and guides SBP policy-rate decisions.',
      source: 'PBS via SBP EasyData',
      sourceUrl: 'https://easydata.sbp.org.pk',
      datasetId: 'inflation', row: inf,
    },
    fbrGap != null && {
      title: 'Tax target pressure',
      value: `₨${fmt(Math.abs(fbrGap), 0)}B ${fbrGap >= 0 ? 'ahead' : 'short'}`,
      meta: fbr.data?.fytd?.period,
      tone: fbrGap >= 0 ? 'positive' : 'negative',
      body: 'Tax collection relative to target indicates how much fiscal adjustment may be needed through revenue measures or spending control.',
      source: fbr.data?.fytd?.sourceLabel || 'Federal Board of Revenue',
      sourceUrl: fbr.data?.fytd?.source || 'https://www.fbr.gov.pk',
      datasetId: 'fbr-tax', row: fbr.data?.fytd, derivation: 'FYTD net collection − FYTD target',
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
    const remitAvg = remit3m.length === 3 ? avgField(remit3m, 'total') : null;
    const latestTrade = latest(trade.data?.monthly);
    const trade3m = (trade.data?.monthly || []).slice(-3);
    const tradeAvg = trade3m.length === 3 ? avgField(trade3m, 'balance') : null;
    const petrol = indicators.data?.indicators?.find((row) => row.id === 'petrol-price' && !row.unavailable);
    const policy = indicators.data?.indicators?.find((row) => row.id === 'policy-rate' && !row.unavailable);
    const publicDebt = indicators.data?.indicators?.find((row) => row.id === 'public-debt' && !row.unavailable);
    const circularDebt = indicators.data?.indicators?.find((row) => row.id === 'circular-debt' && !row.unavailable);
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
              <TrustedContextValue label="Fiscal balance" value={isFiniteNumber(latestFiscal?.value) ? `₨${fmt(latestFiscal.value / 1e6, 2)}T` : null} period={latestFiscal?.fy} datasetId="fiscal" row={latestFiscal} />
              <TrustedContextValue label="Primary balance" value={isFiniteNumber(latestPrimary?.value) ? `₨${fmt(latestPrimary.value / 1e6, 2)}T` : null} period={latestPrimary?.fy} datasetId="fiscal" row={latestPrimary} />
              <TrustedContextValue label="FBR target gap" value={fbrGap == null ? null : `₨${fmt(Math.abs(fbrGap), 0)}B ${fbrGap >= 0 ? 'ahead' : 'short'}`} period={fbr.data?.fytd?.period} datasetId="fbr-tax" row={fbr.data?.fytd} derivation="FYTD net collection − FYTD target" />
              <TrustedContextValue label="Public debt" value={publicDebt?.value != null ? `${publicDebt.value}${publicDebt.unit || ''}` : null} period={publicDebt?.asOf} datasetId="indicators" row={publicDebt} />
              <TrustedContextValue label="Power circular debt" value={circularDebt?.value != null ? `${circularDebt.value}${circularDebt.unit || ''}` : null} period={circularDebt?.asOf} datasetId="indicators" row={circularDebt} />
            </div>
          </div>

          <div className="context-block card">
            <h3>{tx("External vulnerability scorecard")}</h3>
            <div className="context-list">
              <TrustedContextValue label="Import cover" value={isFiniteNumber(reservesAdequacy.data?.current?.importCoverMonths) ? `${reservesAdequacy.data.current.importCoverMonths} months` : null} period={reservesAdequacy.data?.current?.asOf} datasetId="reserves-adequacy" row={reservesAdequacy.data?.current} />
              <TrustedContextValue label="SBP reserves" value={isFiniteNumber(reservesAdequacy.data?.current?.sbpReserves) ? `$${reservesAdequacy.data.current.sbpReserves}B` : null} period={reservesAdequacy.data?.current?.asOf} datasetId="reserves-adequacy" row={reservesAdequacy.data?.current} />
              <TrustedContextValue label={`${fy.fyLabel} gross external repayment`} value={isFiniteNumber(externalDebt.data?.fy26?.grossRepayment) ? `$${externalDebt.data.fy26.grossRepayment}B` : null} period={fy.fyLabel} datasetId="external-debt" row={externalDebt.data?.fy26} />
              <TrustedContextValue label="Hard-cash repayment" value={isFiniteNumber(externalDebt.data?.fy26?.hardRepayment) ? `$${externalDebt.data.fy26.hardRepayment}B` : null} period={fy.fyLabel} datasetId="external-debt" row={externalDebt.data?.fy26} />
              <TrustedContextValue label={latestTrade?.balance > 0 ? 'Latest trade surplus' : 'Latest trade deficit'} value={isFiniteNumber(latestTrade?.balance) ? `$${fmt(Math.abs(latestTrade.balance) / 1000, 2)}B` : null} period={latestTrade?.date} datasetId="trade" row={latestTrade} />
            </div>
          </div>
        </div>

        <div className="insight-two-col">
          <div className="context-block card">
            <h3>{tx("Household impact view")}</h3>
            <div className="context-list">
              <TrustedContextValue label="CPI inflation" value={isFiniteNumber(latestInf?.value) ? `${fmt(latestInf.value)}%` : null} period={latestInf?.date} datasetId="inflation" row={latestInf} />
              <TrustedContextValue label="Inflation momentum" value={isFiniteNumber(latestInf?.value) && isFiniteNumber(priorInf?.value) ? signed(latestInf.value - priorInf.value, ' pp') : null} period={latestInf?.date} datasetId="inflation" row={latestInf} derivation={`Latest CPI (${latestInf?.date || 'unavailable'}) − prior CPI (${priorInf?.date || 'unavailable'})`} />
              <TrustedContextValue label="Policy rate" value={policy?.value != null ? `${policy.value}${policy.unit || ''}` : null} period={policy?.asOf} datasetId="indicators" row={policy} />
              <TrustedContextValue label="Petrol price" value={petrol?.value != null ? `${petrol.value}${petrol.unit || ''}` : null} period={petrol?.asOf} datasetId="indicators" row={petrol} />
            </div>
          </div>

          <div className="context-block card">
            <h3>{tx("Trend watch, not a forecast")}</h3>
            <div className="context-list">
              <TrustedContextValue label="Remittances vs 3-month average" value={isFiniteNumber(latestRemit?.total) && isFiniteNumber(remitAvg) ? signed(pctChange(latestRemit.total, remitAvg), '%') : null} period={latestRemit?.date} datasetId="remittances" row={latestRemit} derivation="(Latest month ÷ mean of three published months − 1) × 100" />
              <TrustedContextValue label="Trade balance vs 3-month average" value={isFiniteNumber(latestTrade?.balance) && isFiniteNumber(tradeAvg) ? signed(latestTrade.balance - tradeAvg, 'M', 0) : null} period={latestTrade?.date} datasetId="trade" row={latestTrade} derivation="Latest balance − mean of three published monthly balances" />
              <TrustedContextValue label="Inflation direction" value={isFiniteNumber(latestInf?.value) && isFiniteNumber(priorInf?.value) ? latestInf.value === priorInf.value ? 'Unchanged' : latestInf.value > priorInf.value ? 'Rising' : 'Cooling' : null} period={latestInf?.date} datasetId="inflation" row={latestInf} derivation="Compare latest published CPI with the prior published month" />
              <TrustedContextValue label="Tax collection vs FYTD target" value={fbrGap == null ? null : fbrGap >= 0 ? 'Ahead' : 'Behind'} period={fbr.data?.fytd?.period} datasetId="fbr-tax" row={fbr.data?.fytd} derivation="FYTD net collection − FYTD target" />
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
  if (!Array.isArray(data.events) || !data.events.length) return <UnavailableCard reason={data.publication?.reason} sourceUrl={data.sourceUrl} />;

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
  if (!Array.isArray(data.sections) || !data.sections.length) return <UnavailableCard reason={data.publication?.reason} sourceUrl={data.sourceUrl} />;

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
  const { t } = useI18n();
  const { data, loading, error, retry } = useData('data-freshness.json');
  if (loading) return <LoadingCard label="Loading source trust audit…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Source trust" />;
  const datasets = data?.datasets || [];

  const byTier = datasets.reduce((acc, dataset) => {
    const key = resolveSourceTier(dataset);
    (acc[key] = acc[key] || []).push(dataset);
    return acc;
  }, {});

  const tierOrder = ['official-primary', 'official-derived', 'unverified', 'unavailable'];

  return (
    <section className="fade-in">
      <SectionHeader
        title="Source Confidence & Audit Trail"
        description={t('trust.officialOnly', 'Only verifiable official figures are published. Unsupported press numbers are unavailable, not estimates.')}
        sourceLinks={SOURCE_LINKS}
      />
      {!loading && (
        <>
          <div className="trust-tier-list">
            {tierOrder.filter((key) => byTier[key]?.length).map((key) => {
              return (
                <div key={key} className="trust-tier trust-tier--neutral">
                  <div className="trust-tier__head">
                    <h3>{t(`trust.authenticity.${key}`, TRUST_LABELS.authenticity[key])}</h3>
                    <span className="trust-tier__count">{byTier[key].length} datasets</span>
                  </div>
                  <ul className="trust-tier__items">
                    {byTier[key].map((dataset) => (
                      <li key={dataset.id}>
                        <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.label}</a>
                        <span>{dataset.sourceLabel || dataset.source}</span>
                        {dataset.verifiedFrom?.length > 0 && (
                          <small>
                            {t('trust.originalSource', 'Original source')}:{' '}
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
        </>
      )}
      <DataFreshnessPanel />
    </section>
  );
}
