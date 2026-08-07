import useI18n from '../i18n/useI18n';
import { useDensity } from '../hooks/useDensity';

export default function DensityToggle() {
  const { t } = useI18n();
  const { density, setDensity } = useDensity();

  const options = [
    { value: 'compact', label: t('density.compact', 'Brief view'), short: 'B' },
    { value: 'comfortable', label: t('density.comfortable', 'Analyst view'), short: 'A' },
  ];

  return (
    <div className="density-toggle" role="radiogroup" aria-label={t('density.label', 'Detail level')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`density-toggle-btn ${density === opt.value ? 'active' : ''}`}
          onClick={() => setDensity(opt.value)}
          aria-pressed={density === opt.value}
          title={opt.label}
        >
          <span className="density-toggle-btn__short" aria-hidden="true">{opt.short}</span>
          <span className="density-toggle-btn__label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
