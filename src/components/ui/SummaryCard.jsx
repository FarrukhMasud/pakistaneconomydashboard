import React from 'react';
import './SummaryCard.css';
import ExpandableTile from './ExpandableTile';
import CiteFigure from '../CiteFigure';
import useI18n from '../../i18n/useI18n';
import FigureTrust from '../FigureTrust';

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
 * @param {string[]} provenanceKeys – provenance.json ids to expose "cite this figure" links for
 */
export default function SummaryCard({ title, items = [], footnote, accent, provenanceKeys, datasetId, row, period }) {
  const { t, tx } = useI18n();
  const unavailable = (item) => item.unavailable || item.value == null || item.value === '—';
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
    <ExpandableTile
      className="summary-card"
      style={accent ? { '--summary-accent': accent } : undefined}
      title={title}
      subtitle={footnote}
      details={(
        <div className="tile-detail-list">
          {items.map((item, i) => (
            <div key={i} className="tile-detail-row">
              <span>{tx(item.label)}</span>
              <strong style={!unavailable(item) && item.color ? { color: item.color } : undefined}>{unavailable(item) ? t('trust.unavailableShort', 'Unavailable') : item.value}</strong>
              {!unavailable(item) && item.sub && <small>{tx(item.sub)}</small>}
              <FigureTrust datasetId={item.datasetId || datasetId} row={unavailable(item) ? { ...(item.trust || item.row || row), authenticity: 'unavailable' } : item.trust || item.row || row}
                field={item.field} period={item.period || period} derivation={item.derivation} compact />
            </div>
          ))}
          {footnote && <p className="summary-card__footnote">{tx(footnote)}</p>}
        </div>
      )}
    >
      {title && <h3 className="summary-card__title">{tx(title)}</h3>}
      <div className="summary-card__grid">
        {items.map((item, i) => (
          <div key={i} className="summary-card__item">
            <span className="summary-item__label">{tx(item.label)}</span>
            <span
              className="summary-item__value"
              style={!unavailable(item) && item.color ? { color: item.color } : undefined}
            >
              {unavailable(item) ? t('trust.unavailableShort', 'Unavailable') : item.value}
            </span>
            <FigureTrust datasetId={item.datasetId || datasetId} row={unavailable(item) ? { ...(item.trust || item.row || row), authenticity: 'unavailable' } : item.trust || item.row || row}
              field={item.field} period={item.period || period} derivation={item.derivation} compact />
            {!unavailable(item) && (item.direction || item.sub) && (
              <span className={`summary-item__sub ${sentimentClass(item.sentiment)}`}>
                {item.direction === 'unavailable' ? t('trust.changeUnavailable', 'Comparison unavailable') : item.direction && (
                  <span className="summary-item__arrow">{arrow(item.direction)}</span>
                )}
                {tx(item.sub)}
              </span>
            )}
          </div>
        ))}
      </div>
      {footnote && <p className="summary-card__footnote">{tx(footnote)}</p>}
      {Array.isArray(provenanceKeys) && provenanceKeys.length > 0 && (
        <div className="chart-provenance">
          <span>{t('chart.traceFigure', 'Trace a headline figure:')}</span>
          {provenanceKeys.map((key) => <CiteFigure key={key} figureKey={key} />)}
        </div>
      )}
    </ExpandableTile>
  );
}
