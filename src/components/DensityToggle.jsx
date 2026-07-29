import useI18n from '../i18n/useI18n';
import { useDensity } from '../hooks/useDensity';

export default function DensityToggle() {
  const { t } = useI18n();
  const { density, setDensity } = useDensity();

  const options = [
    { value: 'comfortable', label: t('density.comfortable', 'Roomy'), short: 'R' },
    { value: 'compact', label: t('density.compact', 'Compact'), short: 'C' },
  ];

  return (
    <div className="density-toggle" role="radiogroup" aria-label={t('density.label', 'Density')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`density-toggle-btn ${density === opt.value ? 'active' : ''}`}
          onClick={() => setDensity(opt.value)}
          aria-pressed={density === opt.value}
          title={opt.label}
        >
          {opt.short}
        </button>
      ))}
    </div>
  );
}
