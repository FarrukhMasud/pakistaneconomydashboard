import useI18n from '../../i18n/useI18n';

/**
 * Mobile-friendly series focus control for multi-dataset charts.
 * focus: null | dataset index (null = show all)
 */
export default function SeriesFocus({ labels = [], focus, onChange }) {
  const { t, tx } = useI18n();
  if (!labels.length || labels.length < 2) return null;

  return (
    <div className="series-focus" role="group" aria-label={t('chart.focusSeries', 'Focus series')}>
      <button
        type="button"
        className={`series-focus__btn ${focus == null ? 'active' : ''}`}
        aria-pressed={focus == null}
        onClick={() => onChange(null)}
      >
        {t('chart.focusAll', 'All series')}
      </button>
      {labels.map((label, index) => (
        <button
          key={`${label}-${index}`}
          type="button"
          className={`series-focus__btn ${focus === index ? 'active' : ''}`}
          aria-pressed={focus === index}
          onClick={() => onChange(index)}
        >
          {tx(label)}
        </button>
      ))}
    </div>
  );
}
