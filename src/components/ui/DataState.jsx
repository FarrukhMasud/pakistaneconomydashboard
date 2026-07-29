import useI18n from '../../i18n/useI18n';

export function LoadingCard({ label }) {
  const { t, tx } = useI18n();
  const text = label ? tx(label) : t('common.loading', 'Loading…');
  return (
    <div className="card loading-card" role="status" aria-live="polite">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorCard({ error, onRetry, label, compact = false }) {
  const { t, tx } = useI18n();
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

export function UnavailableCard({ label, reason }) {
  const { t, tx } = useI18n();
  return (
    <div className="card data-state-card data-state-card--muted" role="status">
      <strong className="data-state-card__title">
        {label ? tx(label) : t('common.unavailable', 'Data unavailable')}
      </strong>
      {reason && <p className="data-state-card__msg">{tx(reason)}</p>}
    </div>
  );
}

/**
 * Standard section guard: loading → error/empty → children(data).
 */
export default function SectionState({
  loading,
  error,
  data,
  retry,
  loadingLabel,
  errorLabel,
  requireData = true,
  children,
  compact = false,
}) {
  if (loading) return <LoadingCard label={loadingLabel} />;
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
