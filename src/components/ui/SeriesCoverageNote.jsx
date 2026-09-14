import { useState } from 'react';
import useI18n from '../../i18n/useI18n';
import { useDensity } from '../../hooks/useDensity';

export default function SeriesCoverageNote({ items = [] }) {
  const { t, tx } = useI18n();
  const { density } = useDensity();
  const [openOverride, setOpen] = useState(null);
  const open = openOverride ?? density === 'comfortable';
  const visible = items.filter((item) => item?.period);
  if (visible.length < 2) return null;

  return (
    <details
      className="series-coverage"
      open={open}
      onToggle={(event) => {
        if (event.currentTarget.open !== open) setOpen(event.currentTarget.open);
      }}
    >
      <summary>
        <strong>{tx('Coverage by series')}</strong>
        <span>{t('coverage.differentPeriods', 'Official tables may cover different periods')}</span>
      </summary>
      <div className="series-coverage__items">
        {visible.map((item) => (
          <span className="series-coverage__item" key={`${item.label}-${item.period}`}>
            <span>{item.label}</span>
            <b>{item.period}</b>
            {item.source && <small>{item.source}</small>}
          </span>
        ))}
      </div>
      <p>{tx('Different official tables can be published on different schedules; comparisons only use matching periods.')}</p>
    </details>
  );
}
