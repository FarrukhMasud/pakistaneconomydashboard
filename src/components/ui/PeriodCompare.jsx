import { useId } from 'react';
import useI18n from '../../i18n/useI18n';

/**
 * Toggle for comparing current period vs prior year / FYTD.
 * mode: 'off' | 'yoy' | 'fytd'
 */
export default function PeriodCompare({ mode, onChange, modes = ['yoy', 'fytd'], disabledModes = {}, note }) {
  const { t, tx } = useI18n();
  const id = useId();
  const options = [
    { id: 'off', label: t('compare.off', 'Latest series') },
    modes.includes('yoy') && { id: 'yoy', label: t('compare.lastYear', 'Compare with last year') },
    modes.includes('fytd') && { id: 'fytd', label: t('compare.fiscalYear', 'Compare fiscal year to date') },
  ].filter(Boolean);
  const activeMode = options.some((option) => option.id === mode && !disabledModes[mode]) ? mode : 'off';

  return (
    <div className="period-compare-wrap">
      <div className="period-compare" role="group" aria-label={t('compare.label', 'Compare periods')}>
        {options.map((opt) => {
          const disabledReason = disabledModes[opt.id];
          const disabled = Boolean(disabledReason);
          return (
            <button
              key={opt.id}
              type="button"
              className={`period-compare__btn ${activeMode === opt.id ? 'active' : ''}`}
              aria-pressed={activeMode === opt.id}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              aria-describedby={disabled ? `${id}-${opt.id}` : undefined}
              title={disabled ? tx(disabledReason) : undefined}
              onClick={() => {
                if (!disabled) onChange(opt.id);
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {options.filter((opt) => disabledModes[opt.id]).map((opt) => (
        <p key={opt.id} id={`${id}-${opt.id}`} className="period-compare__note">
          {opt.label}: {tx(disabledModes[opt.id])}
        </p>
      ))}
      {note && !Object.values(disabledModes).includes(note) && <p className="period-compare__note">{tx(note)}</p>}
      {!options.some((option) => option.id === mode) && (
        <p className="period-compare__note">{t('compare.unsupportedMode', 'This comparison is not available here; showing the latest series.')}</p>
      )}
    </div>
  );
}
