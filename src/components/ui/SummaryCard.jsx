import React from 'react';
import './SummaryCard.css';

/**
 * Reusable summary card for section-level KPIs.
 *
 * @param {string}  title    – e.g. "Jan – Mar 2026"
 * @param {Array}   items    – [{ label, value, sub?, direction?, sentiment?, color? }]
 *   direction : "up" | "down" | "flat"  (arrow direction)
 *   sentiment : "positive" | "negative" | "neutral"  (color meaning)
 *   color     : optional override color string
 * @param {string}  footnote – small italic note below the grid
 * @param {string}  accent   – CSS color for top border accent
 */
export default function SummaryCard({ title, items = [], footnote, accent }) {
  const arrow = (dir) => {
    if (dir === 'up') return '▲';
    if (dir === 'down') return '▼';
    return '';
  };

  const sentimentClass = (s) => {
    if (s === 'positive') return 'summary-item--positive';
    if (s === 'negative') return 'summary-item--negative';
    return 'summary-item--neutral';
  };

  return (
    <div className="summary-card" style={accent ? { '--summary-accent': accent } : undefined}>
      {title && <h3 className="summary-card__title">{title}</h3>}
      <div className="summary-card__grid">
        {items.map((item, i) => (
          <div key={i} className="summary-card__item">
            <span className="summary-item__label">{item.label}</span>
            <span
              className="summary-item__value"
              style={item.color ? { color: item.color } : undefined}
            >
              {item.value}
            </span>
            {(item.direction || item.sub) && (
              <span className={`summary-item__sub ${sentimentClass(item.sentiment)}`}>
                {item.direction && (
                  <span className="summary-item__arrow">{arrow(item.direction)}</span>
                )}
                {item.sub}
              </span>
            )}
          </div>
        ))}
      </div>
      {footnote && <p className="summary-card__footnote">{footnote}</p>}
    </div>
  );
}
