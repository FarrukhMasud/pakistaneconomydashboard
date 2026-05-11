import { useState } from 'react';

export default function ChartCard({ title, description, source, dataSource, lastUpdated, dataCoverage, children }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card chart-card">
      <div className="chart-card-header">
        <div className="chart-title-row">
          <h3>{title}</h3>
          {dataCoverage && (
            <span className="latest-period-badge" title="Latest available period in this chart">
              Latest: {dataCoverage}
            </span>
          )}
          <button
            className={`info-toggle ${expanded ? 'active' : ''}`}
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Hide description' : 'Show description'}
            title="How to read this chart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
        <div className={`chart-description-panel ${expanded ? 'expanded' : ''}`}>
          <p className="chart-description">{description}</p>
        </div>
      </div>
      {children}
      {source && <div className="source-badge">📊 {source}</div>}
      {(dataSource || dataCoverage || lastUpdated) && (
        <div className="chart-footnote">
          {dataSource && <span>Source: {dataSource}</span>}
          {dataCoverage && <span>Latest available period: {dataCoverage}</span>}
          {lastUpdated && <span>Updated: {lastUpdated}</span>}
        </div>
      )}
    </div>
  );
}
