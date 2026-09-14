import { useWatchlist } from '../hooks/useWatchlist';
import useI18n from '../i18n/useI18n';
import { resolveWatchlistItems } from '../utils/watchlistModel';
import './OverviewInteractions.css';

export default function WatchlistFeedback({ indicators = [] }) {
  const { t, tx } = useI18n();
  const { action, error, undo, dismiss } = useWatchlist();
  const item = action && resolveWatchlistItems(action.ids, indicators)[0];
  const label = item?.labelKey ? t(item.labelKey, item.label) : item?.label ? tx(item.label) : t('watchlist.indicator', 'Indicator');
  let message = '';
  if (action?.kind === 'pin') message = t('watchlist.added', '{label} added to your watchlist.').replace('{label}', label);
  if (action?.kind === 'unpin') message = t('watchlist.removed', '{label} removed from your watchlist.').replace('{label}', label);
  if (action?.kind === 'clear') message = t('watchlist.cleared', 'Watchlist cleared.');
  if (action?.kind === 'undo') message = t('watchlist.undone', 'Watchlist change undone.');

  return (
    <div className="watchlist-feedback">
      <div className="watchlist-feedback__status" role="status" aria-live="polite" aria-atomic="true">
        {message && <span>{message}</span>}
      </div>
      {action && action.kind !== 'undo' && (
        <button type="button" className="watchlist-feedback__undo" onClick={() => undo(action.token)}>
          {t('watchlist.undo', 'Undo')}
        </button>
      )}
      {action && (
        <button
          type="button"
          className="watchlist-feedback__dismiss"
          aria-label={t('watchlist.dismiss', 'Dismiss watchlist notification')}
          onClick={() => dismiss(action.token)}
        >
          ×
        </button>
      )}
      {error && (
        <p role="alert" className="watchlist-feedback__error">
          {error === 'read'
            ? t('watchlist.readError', 'Saved pins could not be read. Your watchlist is available for this session.')
            : t('watchlist.saveError', 'Pins could not be saved on this device. Changes are available for this session only.')}
        </p>
      )}
    </div>
  );
}
