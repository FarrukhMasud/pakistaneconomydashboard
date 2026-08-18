import useI18n from '../../i18n/useI18n';

/**
 * Toggle for comparing current period vs prior year / FYTD.
 * mode: 'off' | 'yoy' | 'fytd'
 */
export default function PeriodCompare({ mode, onChange, modes = ['yoy', 'fytd'], disabledModes = {}, note }) {
  const { t } = useI18n();
  const options = [
    { id: 'off', label: t('compare.off', 'Latest series') },
    modes.includes('yoy') && { id: 'yoy', label: t('compare.yoy', 'YoY overlay') },
    modes.includes('fytd') && { id: 'fytd', label: t('compare.fytd', 'FYTD vs prior FY') },
  ].filter(Boolean);

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
              className={`period-compare__btn ${mode === opt.id ? 'active' : ''}`}
              aria-pressed={mode === opt.id}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              title={disabled ? disabledReason : undefined}
              onClick={() => {
                if (!disabled) onChange(opt.id);
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {note && <p className="period-compare__note">{note}</p>}
    </div>
  );
}
