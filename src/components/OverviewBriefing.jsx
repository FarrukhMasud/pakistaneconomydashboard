import { useMemo } from 'react';
import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';
import { isFiniteNumber } from '../utils/periodHelpers';
import {
  buildOverviewClauses,
  buildTradeKpi,
  decorateOverviewKpis,
  joinClauses,
} from '../utils/overviewModel';

export default function OverviewBriefing({ onNavigate }) {
  const { t } = useI18n();
  const kpi = useData('kpi-summary.json');
  const trade = useData('trade.json');
  const remittances = useData('remittances.json');
  const fbr = useData('fbr-tax.json');

  const sentence = useMemo(() => {
    const byId = Object.fromEntries(
      decorateOverviewKpis(kpi.data?.indicators || [], { remittances: remittances.data })
        .map((row) => [row.id, row]),
    );
    const tradeKpi = buildTradeKpi(trade.data);
    const fytd = fbr.data?.fytd;
    const fbrGap = fytd && isFiniteNumber(fytd.net) && isFiniteNumber(fytd.target)
      ? fytd.net - fytd.target
      : null;

    const clauses = buildOverviewClauses({
      inflation: byId.inflation,
      remittances: byId.remittances,
      trade: tradeKpi,
      fbrGap,
      fbrGapUnit: 'Rs bn',
    });

    const parts = clauses.map((clause) => (
      t(clause.key, clause.fallback).replace('{value}', clause.value)
    ));
    return joinClauses(parts);
  }, [kpi.data, trade.data, remittances.data, fbr.data, t]);

  if (!sentence) return null;

  return (
    <section className="overview-briefing" aria-label={t('overview.briefingTitle', 'State of the economy')}>
      <div className="overview-briefing__kicker">{t('overview.briefingKicker', 'This month')}</div>
      <p className="overview-briefing__sentence">{sentence}</p>
      <a
        className="overview-briefing__link"
        href="/insights/briefing"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onNavigate?.('insights', 'briefing');
        }}
      >
        {t('overview.readBriefing', 'Read the full briefing')}
      </a>
    </section>
  );
}
