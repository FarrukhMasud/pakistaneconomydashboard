import useI18n from '../../i18n/useI18n';
import { OFFICIAL_UNAVAILABLE, publicationOf, safeSourceUrl, withheldPaths } from '../../utils/figureTrust';
import '../../styles/trust.css';

export function LoadingCard({ label }) {
  const { t, tx } = useI18n();
  const text = label ? tx(label) : t('common.loading', 'Loading…');
  return (
    <div className="card loading-card" role="status" aria-live="polite">
      <div className="skeleton-lines" aria-hidden="true">
        <div className="skeleton-line skeleton-line--lg" />
        <div className="skeleton-line skeleton-line--md" />
        <div className="skeleton-line skeleton-line--sm" />
      </div>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}

export function ErrorCard({ error, onRetry, label, compact = false, unavailable }) {
  const { t, tx } = useI18n();
  if (!error) return <UnavailableCard {...unavailable} />;
  const message = error?.message || t('common.loadFailed', 'Failed to load data');
  const title = label ? tx(label) : t('common.unavailable', 'Data unavailable');

  if (compact) {
    return (
      <div className="card data-state-card data-state-card--compact" role="alert">
        <span className="data-state-card__title">{title}</span>
        <span className="data-state-card__msg">{message}</span>
        {onRetry && (
          <button type="button" className="data-state-card__retry" onClick={onRetry}>
            {t('common.retry', 'Try again')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card data-state-card" role="alert">
      <strong className="data-state-card__title">{title}</strong>
      <p className="data-state-card__msg">{message}</p>
      {onRetry && (
        <button type="button" className="data-state-card__retry" onClick={onRetry}>
          {t('common.retry', 'Try again')}
        </button>
      )}
    </div>
  );
}

export function UnavailableCard({ label, reason, sourceUrl }) {
  const { t, tx } = useI18n();
  return (
    <div className="card data-state-card data-state-card--muted publication-notice" role="status">
      <strong className="data-state-card__title">
        {label && label !== OFFICIAL_UNAVAILABLE ? tx(label) : t('trust.unavailable', OFFICIAL_UNAVAILABLE)}
      </strong>
      {reason && <p className="data-state-card__msg">{tx(reason)}</p>}
      {safeSourceUrl(sourceUrl) && <a href={safeSourceUrl(sourceUrl)} target="_blank" rel="noopener noreferrer">{t('trust.originalSource', 'Original source')}</a>}
    </div>
  );
}

export function PublicationNotice({ data, unavailable }) {
  const { t, tx } = useI18n();
  if (unavailable) return <UnavailableCard {...unavailable} />;
  if (publicationOf(data)?.status !== 'partial') return null;
  return (
    <aside className="publication-notice" role="status">
      <strong>{t('trust.partial', 'Partial publication: certified figures retained')}</strong>
      <p>{tx(publicationOf(data).reason || OFFICIAL_UNAVAILABLE)}</p>
      <p>{t('trust.unavailableFields', 'Unavailable fields')}: {withheldPaths(data).join(', ') || t('trust.evidenceMissing', 'Exact source evidence not available')}</p>
      {safeSourceUrl(data.sourceUrl) && <a href={safeSourceUrl(data.sourceUrl)} target="_blank" rel="noopener noreferrer">{t('trust.originalSource', 'Original source')}</a>}
    </aside>
  );
}

/**
 * Standard section guard: loading → error/empty → children(data).
 */
export function SectionState({
  state,
  loading = state?.loading,
  error = state?.error,
  data = state?.data,
  retry = state?.retry,
  label,
  loadingLabel,
  errorLabel = label,
  requireData = true,
  children,
  compact = false,
  unavailable = state?.unavailable,
}) {
  if (loading) return <LoadingCard label={loadingLabel} />;
  if (unavailable) return <UnavailableCard {...unavailable} />;
  if (error || (requireData && !data)) {
    return (
      <ErrorCard
        error={error}
        onRetry={retry}
        label={errorLabel || loadingLabel}
        compact={compact}
      />
    );
  }
  return typeof children === 'function' ? children(data) : children;
}

export default SectionState;
