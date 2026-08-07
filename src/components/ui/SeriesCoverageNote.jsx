import useI18n from '../../i18n/useI18n';

export default function SeriesCoverageNote({ items = [] }) {
  const { tx } = useI18n();
  const visible = items.filter((item) => item?.period);
  if (visible.length < 2) return null;

  return (
    <aside className="series-coverage" aria-label={tx('Coverage by series')}>
      <strong>{tx('Coverage by series')}</strong>
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
    </aside>
  );
}
