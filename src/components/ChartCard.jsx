import { isValidElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function collectChartData(node, charts = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectChartData(child, charts));
    return charts;
  }

  if (!isValidElement(node)) return charts;

  const data = node.props?.data;
  if (data?.labels?.length && data?.datasets?.length) {
    charts.push(data);
  }

  if (node.props?.children) {
    collectChartData(node.props.children, charts);
  }

  return charts;
}

function formatTableValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof value === 'object') {
    if ('y' in value) return formatTableValue(value.y);
    if ('x' in value) return formatTableValue(value.x);
  }
  return String(value);
}

function ChartDataTable({ chartData }) {
  if (!chartData) return null;

  const datasets = chartData.datasets.filter((dataset) => Array.isArray(dataset.data));
  if (!datasets.length) return null;

  return (
    <div className="chart-data-table-wrap">
      <table className="chart-data-table">
        <thead>
          <tr>
            <th>Period / Category</th>
            {datasets.map((dataset, index) => (
              <th key={`${dataset.label || 'Series'}-${index}`}>{dataset.label || `Series ${index + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chartData.labels.map((label, rowIndex) => (
            <tr key={`${label}-${rowIndex}`}>
              <td>{label}</td>
              {datasets.map((dataset, colIndex) => (
                <td key={`${dataset.label || colIndex}-${rowIndex}`}>
                  {formatTableValue(dataset.data[rowIndex])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChartCard({ title, description, source, dataSource, lastUpdated, dataCoverage, children }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const expandButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const modalRef = useRef(null);
  const tableData = collectChartData(children)[0];

  useEffect(() => {
    if (!chartOpen) return undefined;

    const priorOverflow = document.body.style.overflow;
    const expandButton = expandButtonRef.current;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setChartOpen(false);
        return;
      }

      if (event.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', onKeyDown);
      expandButton?.focus();
    };
  }, [chartOpen]);

  const renderMeta = () => (
    <div className="chart-meta">
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
            ref={expandButtonRef}
            className="chart-action-btn"
            onClick={() => setChartOpen(true)}
            aria-label={`Expand ${title}`}
            title="Expand chart"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          {tableData && (
            <button
              className={`chart-action-btn chart-action-btn--text ${tableOpen ? 'active' : ''}`}
              onClick={() => setTableOpen((value) => !value)}
              aria-label={tableOpen ? `Hide data table for ${title}` : `Show data table for ${title}`}
              title="Show table"
            >
              Data
            </button>
          )}
          <button
            className={`info-toggle ${infoOpen ? 'active' : ''}`}
            onClick={() => setInfoOpen(e => !e)}
            aria-label={infoOpen ? 'Hide description' : 'Show description'}
            title="How to read this chart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
        <div className={`chart-description-panel ${infoOpen ? 'expanded' : ''}`}>
          <p className="chart-description">{description}</p>
        </div>
      </div>
      {chartOpen ? (
        <div className="chart-expanded-placeholder">Chart open in focus view</div>
      ) : (
        children
      )}
      {tableOpen && <ChartDataTable chartData={tableData} />}
      {renderMeta()}
      {chartOpen && createPortal(
        <div
          className="chart-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChartOpen(false);
          }}
        >
          <div ref={modalRef} className="chart-modal" role="dialog" aria-modal="true" aria-label={title}>
            <div className="chart-modal__header">
              <div>
                <h2>{title}</h2>
                {dataCoverage && <p>Latest available period: {dataCoverage}</p>}
              </div>
              <button
                ref={closeButtonRef}
                className="chart-modal__close"
                onClick={() => setChartOpen(false)}
                aria-label="Close expanded chart"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="chart-modal__body">
              {children}
            </div>
            <div className="chart-modal__details">
              {description && <p>{description}</p>}
              {tableData && (
                <>
                  <h3 className="chart-modal__table-title">Tabular data</h3>
                  <ChartDataTable chartData={tableData} />
                </>
              )}
              {renderMeta()}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
