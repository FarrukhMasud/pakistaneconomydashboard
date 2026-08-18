import { useMemo } from 'react';
import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';
import { COLORS } from '../utils/chartConfig';
import MiniSparkline from './ui/MiniSparkline';
import AnimatedNumber from './ui/AnimatedNumber';
import { formatMonthYear, formatDayMonthYear, isFiniteNumber } from '../utils/periodHelpers';
import { formatKpiUnit, getKpiDecimals } from '../utils/kpiFormat';

const PULSE = [
  { id: 'reserves', label: 'Reserves', groupId: 'external', sectionId: 'reserves', sparkKey: 'reserves' },
  { id: 'inflation', label: 'CPI', groupId: 'prices', sectionId: 'inflation', sparkKey: 'inflation' },
  { id: 'exchange-rate', label: 'PKR/USD', groupId: 'external', sectionId: 'exchange', sparkKey: 'exchange' },
  { id: 'fbr-tax', label: 'FBR FYTD', groupId: 'fiscal', sectionId: 'fbr', sparkKey: 'fbr' },
  { id: 'remittances', label: 'Remittances', groupId: 'external', sectionId: 'remittances', sparkKey: 'remittances' },
];

function formatPeriod(period) {
  if (!period) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return formatDayMonthYear(period);
  if (/^\d{4}-\d{2}$/.test(period)) return formatMonthYear(period);
  return period;
}

function sentimentClass(sentiment) {
  if (sentiment === 'positive') return 'positive';
  if (sentiment === 'negative') return 'negative';
  return 'neutral';
}

function sentimentColor(sentiment) {
  if (sentiment === 'positive') return COLORS.teal;
  if (sentiment === 'negative') return COLORS.coral;
  return COLORS.amber;
}

function takeTail(series, n = 12) {
  if (!Array.isArray(series)) return [];
  return series.slice(-n);
}

function formatDelta(value, unit) {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  if (unit === '%' || unit === 'pp') return `${sign}${value}${unit}`;
  return `${sign}${value}${unit ? ` ${formatKpiUnit(unit)}` : ''}`;
}

/**
 * Hero “economy pulse” strip — five headline chips with optional sparklines.
 */
export default function EconomyPulse({ onNavigate }) {
  const { t, tx } = useI18n();
  const kpi = useData('kpi-summary.json');
  const reserves = useData('reserves.json');
  const inflation = useData('inflation.json');
  const exchange = useData('exchange-rates.json');
  const fbr = useData('fbr-tax.json');
  const remittances = useData('remittances.json');

  const sparks = useMemo(() => {
    const seriesOf = (node) => {
      if (Array.isArray(node)) return node;
      if (Array.isArray(node?.data)) return node.data;
      return [];
    };

    const r = takeTail(
      seriesOf(reserves.data?.weekly || reserves.data?.monthly).map((row) => row.total ?? row.value),
    ).filter(isFiniteNumber);
    const inf = takeTail(
      seriesOf(inflation.data?.national_cpi || inflation.data?.national || inflation.data?.cpi)
        .map((row) => row.yoy ?? row.value),
    ).filter(isFiniteNumber);
    const fx = takeTail(
      seriesOf(exchange.data?.monthly || exchange.data?.daily || exchange.data?.usd)
        .map((row) => row.USD ?? row.rate ?? row.value),
    ).filter(isFiniteNumber);
    const tax = takeTail(
      seriesOf(fbr.data?.monthly).map((row) => row.net ?? row.value),
    ).filter(isFiniteNumber);
    const rem = takeTail(
      seriesOf(remittances.data?.monthly).map((row) => row.total ?? row.value),
    ).filter(isFiniteNumber);

    return {
      reserves: r,
      inflation: inf,
      exchange: fx,
      fbr: tax,
      remittances: rem,
    };
  }, [reserves.data, inflation.data, exchange.data, fbr.data, remittances.data]);

  const chips = useMemo(() => {
    const byId = Object.fromEntries((kpi.data?.indicators || []).map((row) => [row.id, row]));
    return PULSE.map((spec) => {
      const row = byId[spec.id];
      if (!row) return null;
      return {
        ...spec,
        label: row.label || spec.label,
        value: row.value,
        decimals: getKpiDecimals(row),
        unit: formatKpiUnit(row.unit),
        period: formatPeriod(row.period),
        change: row.change,
        changeUnit: row.changeUnit,
        sentiment: row.sentiment || 'neutral',
        spark: sparks[spec.sparkKey] || [],
      };
    }).filter(Boolean);
  }, [kpi.data, sparks]);

  if (kpi.loading && !kpi.data) return null;
  if (!chips.length) return null;

  return (
    <section className="economy-pulse" aria-label={t('pulse.title', 'Economy pulse')}>
      <div className="economy-pulse__head">
        <div>
          <div className="economy-pulse__kicker">{t('pulse.kicker', 'Live pulse')}</div>
          <h2>{t('pulse.heading', 'Pakistan at a glance')}</h2>
          <p className="economy-pulse__meta">
            {t('pulse.meta', 'Five critical series · tap any chip to open the full section')}
            {kpi.data?.lastUpdated ? ` · ${t('common.updated', 'Updated')} ${kpi.data.lastUpdated}` : ''}
          </p>
        </div>
      </div>
      <div className="economy-pulse__chips stagger-children">
        {chips.map((chip) => {
          const color = sentimentColor(chip.sentiment);
          const delta = formatDelta(chip.change, chip.changeUnit);
          return (
            <button
              key={chip.id}
              type="button"
              className="pulse-chip"
              onClick={() => onNavigate?.(chip.groupId, chip.sectionId)}
            >
              <div className="pulse-chip__top">
                <span className="pulse-chip__label">{tx(chip.label)}</span>
              </div>
              <span className="pulse-chip__value" style={{ color }}>
                <AnimatedNumber value={chip.value} decimals={chip.decimals} />
                {' '}
                <span className="pulse-chip__unit">{chip.unit}</span>
              </span>
              <span className={`pulse-chip__delta ${sentimentClass(chip.sentiment)}`}>
                {delta}
                {chip.period ? ` · ${chip.period}` : ''}
              </span>
              <MiniSparkline values={chip.spark} color={color} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
