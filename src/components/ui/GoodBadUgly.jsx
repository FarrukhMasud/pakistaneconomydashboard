import './GoodBadUgly.css';
import useI18n from '../../i18n/useI18n';

const COLUMNS = [
  { key: 'good', label: 'The Good', icon: '✅', cls: 'gbu-col--good' },
  { key: 'bad', label: 'The Bad', icon: '⚠️', cls: 'gbu-col--bad' },
  { key: 'ugly', label: 'The Ugly', icon: '🔴', cls: 'gbu-col--ugly' },
];

/**
 * Strongly-opinionated "Good / Bad / Ugly" editorial commentary panel.
 *
 * @param {object} commentary – { summary?, good[], bad[], ugly[] }
 * @param {string} title      – panel heading
 */
export default function GoodBadUgly({ commentary, title = 'The Good, the Bad & the Ugly' }) {
  const { tx } = useI18n();
  if (!commentary) return null;
  const { summary, good = [], bad = [], ugly = [] } = commentary;
  const hasAny = good.length || bad.length || ugly.length;
  if (!hasAny && !summary) return null;

  return (
    <div className="gbu card">
      <div className="gbu__head">
        <h3>🗣️ {tx(title)}</h3>
        <span className="gbu__tag">{tx('Editorial · opinion, not official data')}</span>
      </div>
      {summary && <p className="gbu__summary">{summary}</p>}
      <div className="gbu__grid">
        {COLUMNS.map((col) => {
          const items = commentary[col.key] || [];
          if (!items.length) return null;
          return (
            <div key={col.key} className={`gbu-col ${col.cls}`}>
              <div className="gbu-col__head">
                <span className="gbu-col__icon">{col.icon}</span>
                {tx(col.label)}
              </div>
              <ul className="gbu-col__list">
                {items.map((item, i) => (
                  <li key={i}>
                    {typeof item === 'string' ? (
                      item
                    ) : (
                      <>
                        {item.point && <strong>{item.point}. </strong>}
                        {item.detail || item.text}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
