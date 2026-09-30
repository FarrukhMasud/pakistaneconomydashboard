import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';
import { resolveSourceTier, TRUST_LABELS, unavailableInfo } from '../utils/figureTrust';
import { useContext } from 'react';
import { TrustContext } from '../utils/trustContext';

const FALLBACK_TIERS = {
  'official-primary': { short: 'Official', tone: 'positive', label: 'Official primary' },
  'official-derived': { short: 'Derived', tone: 'neutral', label: 'Derived on this dashboard' },
  'secondary-attributed': { short: 'Press-sourced', tone: 'warning', label: 'Secondary reporting' },
  unavailable: { short: 'Unavailable', tone: 'warning', label: 'Unavailable' },
  unverified: { short: 'Not verified', tone: 'warning', label: 'Not verified' },
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
  const { t, tx } = useI18n();
  const scope = useContext(TrustContext);
  const canonical = useData(datasetId ? `${datasetId}.json` : 'data-freshness.json');
  const tiers = data?.tiers || FALLBACK_TIERS;
  const datasets = data?.datasets || [];
  const dataset = {
    ...(datasetId ? datasets.find((item) => item.id === datasetId) : null),
    ...(datasetId === scope.datasetId ? scope.data : null),
    ...(datasetId ? canonical.data : null),
  };
  const resolved = canonical.unavailable || unavailableInfo(dataset) ? 'unavailable' : datasetId && (canonical.loading || canonical.error) ? 'unverified' : sourceType
    ? resolveSourceTier({ sourceType }) : resolveSourceTier(dataset);

  const tier = tiers[resolved] || FALLBACK_TIERS[resolved];
  if (!tier) return null;

  const title = [tier.label, tier.description, dataset?.sourceLabel]
    .filter(Boolean)
    .map((part) => tx(part))
    .join(' — ');

  return (
    <span className={`source-badge-tier source-badge-tier--${tier.tone}`} title={title}>
      {tier.tone === 'warning' ? '⚠ ' : ''}{t(`trust.authenticity.${resolved}`, compact ? tx(tier.short) : TRUST_LABELS.authenticity[resolved] || tx(tier.label))}
    </span>
  );
}
