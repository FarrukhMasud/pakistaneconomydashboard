import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';

const FALLBACK_TIERS = {
  'official-primary': { short: 'Official', tone: 'positive', label: 'Official primary' },
  'official-derived': { short: 'Derived', tone: 'neutral', label: 'Derived on this dashboard' },
  'secondary-attributed': { short: 'Press-sourced', tone: 'warning', label: 'Secondary reporting' },
};

/**
 * Makes the trust tier of a dataset visible wherever its numbers appear.
 *
 * A figure taken from a newspaper's report of a provisional FBR statement is
 * not the same thing as a figure read out of an SBP workbook, and the dashboard
 * should never let those look identical.
 */
export default function SourceBadge({ datasetId, sourceType, compact = false }) {
  const { data } = useData('data-freshness.json');
  const { tx } = useI18n();
  const tiers = data?.tiers || FALLBACK_TIERS;
  const datasets = data?.datasets || [];
  const dataset = datasetId ? datasets.find((item) => item.id === datasetId) : null;
  const resolved = sourceType || dataset?.sourceType;
  if (!resolved) return null;

  const tier = tiers[resolved] || FALLBACK_TIERS[resolved];
  if (!tier) return null;

  const title = [tier.label, tier.description, dataset?.sourceLabel]
    .filter(Boolean)
    .map((part) => tx(part))
    .join(' — ');

  return (
    <span className={`source-badge-tier source-badge-tier--${tier.tone}`} title={title}>
      {tier.tone === 'warning' ? '⚠️ ' : ''}{compact ? tx(tier.short) : tx(tier.label)}
    </span>
  );
}
