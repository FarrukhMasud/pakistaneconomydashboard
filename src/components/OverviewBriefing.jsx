import { useMemo } from 'react';
import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';
import { isFiniteNumber } from '../utils/periodHelpers';
import { buildOverviewClauses, joinClauses } from '../utils/overviewModel';
import { PublicationNotice, UnavailableCard } from './ui/DataState';

export default function OverviewBriefing({ indicators = [], onNavigate }) {
  const { t } = useI18n();
  const fbr = useData('fbr-tax.json');

  const sentence = useMemo(() => {
    const byId = Object.fromEntries(indicators.map((row) => [row.id, row]));
    const fytd = fbr.data?.fytd;
    const fbrGap = fytd && isFiniteNumber(fytd.net) && isFiniteNumber(fytd.target)
      ? fytd.net - fytd.target
      : null;

    const clauses = buildOverviewClauses({
      inflation: byId.inflation,
      remittances: byId.remittances,
      trade: byId.trade,
      fbrGap,
      fbrPeriod: fytd?.period
        ? `${fytd.period}${fytd.fyLabel && !fytd.period.includes(fytd.fyLabel) ? ` ${fytd.fyLabel}` : ''}`
        : null,
      fbrGapUnit: 'Rs bn',
    });

    const parts = clauses.map((clause) => (
      t(clause.key, clause.fallback).replace('{value}', clause.value).replace('{period}', clause.period)
    ));
    return joinClauses(parts);
  }, [indicators, fbr.data, t]);

  if (!sentence && !fbr.unavailable && !indicators.some((row) => row.unavailable)) return null;

  return (
    <section className="overview-briefing" aria-label={t('overview.briefingTitle', 'State of the economy')}>
      <div className="overview-briefing__kicker">{t('overview.latestPicture', 'Latest economic picture')}</div>
      <p className="overview-briefing__sentence">{sentence}</p>
      {fbr.unavailable ? <UnavailableCard {...fbr.unavailable} compact /> : <PublicationNotice data={fbr.data} compact />}
      <a
        className="overview-briefing__link"
        href="/insights/briefing"
        onClick={(event) => {
          if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onNavigate?.('insights', 'briefing');
        }}
      >
        {t('overview.readBriefing', 'Read the full briefing')}
      </a>
    </section>
  );
}
