import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chart as ChartJS, TimeScale } from 'chart.js';
import 'chartjs-adapter-date-fns';
import CiteFigure from './CiteFigure';
import EditorialNote from './EditorialNote';
import useI18n from '../i18n/useI18n';
import { useShareableChartState } from '../hooks/useShareableChartState';
import { CHART_RANGES, chartSummary, selectChartRange, visibleChartData } from '../utils/chartTimeRange';
import { chartToCsv, downloadTextFile, slugify } from '../utils/download';
import { formatKpiPeriod } from '../utils/kpiFormat';
import { trackDiscovery } from '../utils/sectionCatalog';

ChartJS.register(TimeScale);

function mapCharts(node, transform) {
  if (Array.isArray(node)) return Children.map(node, (child) => mapCharts(child, transform));
  if (!isValidElement(node)) return node;
  if (node.props?.data?.labels && node.props?.data?.datasets) return transform(node);
  return node.props?.children
    ? cloneElement(node, {}, mapCharts(node.props.children, transform))
    : node;
}

function chronologicalOptions(options = {}, selection) {
  if (!selection.applicable) return options;
  const times = new Map(selection.data.labels.map((label, index) => {
    const [year, month, day = 1] = selection.dates[index].split('-').map(Number);
    return [label, new Date(year, month - 1, day).getTime()];
  }));
  const annualFiscal = selection.data.labels.every((label) => /^FY(20\d{2}|\d{2})$/.test(String(label)));
  const fiscalLabels = new Map([...times].map(([label, time]) => [time, label]));
  const callbacks = options.plugins?.tooltip?.callbacks;
  const remapItem = (item) => ({ ...item, dataIndex: selection.indices[item.dataIndex] });
  return {
    ...options,
    scales: {
      ...options.scales,
      x: {
        ...options.scales?.x,
        type: 'time',
        time: {
          unit: annualFiscal ? 'year' : selection.dates.every((date) => date.length === 7) ? 'month' : undefined,
          parser: (label) => typeof label === 'number' ? label : times.get(label),
          tooltipFormat: annualFiscal ? "'FY'yyyy" : selection.dates.every((date) => date.length === 7) ? 'MMM yyyy' : 'd MMM yyyy',
        },
        ticks: {
          ...options.scales?.x?.ticks,
          callback: function (value) {
            return annualFiscal ? fiscalLabels.get(value) : this.getLabelForValue(value);
          },
          source: annualFiscal ? 'data' : 'auto',
          maxTicksLimit: 12,
        },
      },
    },
    plugins: {
      ...options.plugins,
      tooltip: {
        ...options.plugins?.tooltip,
        ...(callbacks ? {
          callbacks: Object.fromEntries(Object.entries(callbacks).map(([key, callback]) => [
            key,
            function (items, ...args) {
              return callback.call(this, Array.isArray(items) ? items.map(remapItem) : remapItem(items), ...args);
            },
          ])),
        } : {}),
      },
    },
  };
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

export function ChartDataTable({ chartData, caption }) {
  const { t, tx } = useI18n();
  const datasets = visibleChartData(chartData).datasets.filter((dataset) => Array.isArray(dataset.data));
  return (
    <div className="chart-data-table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="chart-data-table">
        <caption className="chart-data-table__caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('chart.periodCategory', 'Period / Category')}</th>
            {datasets.map((dataset, index) => (
              <th scope="col" key={`${dataset.label || 'Series'}-${index}`}>
                {dataset.label ? tx(dataset.label) : `${t('chart.series', 'Series')} ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chartData.labels.map((label, rowIndex) => (
            <tr key={`${label}-${rowIndex}`}>
              <th scope="row">{label}</th>
              {datasets.map((dataset, colIndex) => (
                <td key={colIndex}>{formatTableValue(dataset.data[rowIndex])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChartCard({
  title, description, source, dataSource, lastUpdated, dataCoverage, coverageNote,
  provenanceKeys, noteKey, children, observationDates, rangeMode = 'chronological', defaultRange = 'all', chartId,
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const expandButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const modalRef = useRef(null);
  const id = useId();
  const { range, setRange } = useShareableChartState('off', defaultRange);
  const { t, tx } = useI18n();
  const localTitle = tx(title);
  const localDescription = tx(description);
  const anchorId = chartId || `chart-${slugify(title) || id.replace(/[^a-z0-9-]/gi, '').toLowerCase()}`;
  const charts = [];
  const preparedChildren = mapCharts(children, (node) => {
    const selection = selectChartRange(node.props.data, observationDates, range, rangeMode);
    const index = charts.length;
    const summary = chartSummary(selection.data, {
      t, tx, coverage: selection.applicable ? undefined : dataCoverage,
      unit: node.props.options?.scales?.y?.title?.text,
      categorical: !selection.applicable && rangeMode !== 'fiscal',
    });
    charts.push({ ...selection, summary, exportData: visibleChartData(selection.data) });
    return cloneElement(node, {
      data: selection.data,
      options: chronologicalOptions(node.props.options, selection),
      role: 'img',
      'aria-label': charts.length > 1 ? `${localTitle} (${charts.length})` : localTitle,
      'aria-describedby': `${id}-summary-${index}`,
      fallbackContent: summary,
    });
  });
  const chronological = charts.find((chart) => chart.applicable);
  const latestLabel = chronological?.data.labels.at(-1);
  const latestPeriod = chronological
    ? formatKpiPeriod(/^FY\d{2,4}$/.test(String(latestLabel)) ? latestLabel : chronological.dates.at(-1))
    : dataCoverage;

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
        const focusable = [...(modalRef.current?.querySelectorAll(
          'button:not([disabled]), summary, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) || [])].filter((element) => element.getClientRects().length > 0);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || !modalRef.current.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !modalRef.current.contains(document.activeElement))) {
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

  const renderContext = () => (
    <div className="chart-essential-context">
      {(dataSource || source) && <span>{t('chart.sourceLabel', 'Source:')} {tx(dataSource || source)}</span>}
      {' '}
      {latestPeriod && <span>{t('chart.latestPeriodLabel', 'Latest available period:')} {latestPeriod}</span>}
      {' '}
      {coverageNote && <span>{t('chart.coverageNotice', 'Read the coverage note in Data & sources before comparing figures.')}</span>}
    </div>
  );

  const renderRange = () => chronological ? (
    <div className="chart-range-controls" role="group" aria-label={t('chart.timeRange', 'Time range')}>
      {CHART_RANGES.map((value) => (
        <button
          type="button"
          key={value}
          className={`period-compare__btn ${chronological.range === value ? 'active' : ''}`}
          aria-pressed={chronological.range === value}
          aria-label={t(`chart.range.${value}`, value === 'all' ? 'All available history' : `Last ${value[0]} year${value[0] === '1' ? '' : 's'}`)}
          onClick={() => setRange(value)}
        >
          {value === 'all' ? t('chart.rangeAll', 'All') : t(`chart.rangeShort.${value}`, value.toUpperCase())}
        </button>
      ))}
    </div>
  ) : rangeMode === 'fiscal' || rangeMode === 'comparison' ? (
    <p className="chart-range-note">{t('chart.rangeNotApplied', 'Full comparison period shown; time range applies to chronological charts only.')}</p>
  ) : null;

  const renderDataSources = (inFocus = false) => (
    <details className="chart-data-sources">
      <summary>{t('chart.dataSources', 'Data & sources')}</summary>
      <div className="chart-data-sources__body">
        {charts.map((chart, index) => (
          <div key={index}>
            <div className="chart-data-sources__actions">
              <button
                type="button"
                className="source-link-pill"
                onClick={() => setTableOpen((value) => !value)}
                aria-expanded={tableOpen}
                aria-controls={`${id}-table-${inFocus ? 'focus' : 'card'}-${index}`}
              >
                {tableOpen ? t('chart.hideTable', 'Hide data table') : t('chart.showDataTable', 'Show data table')}
              </button>
              <button
                type="button"
                className="source-link-pill"
                onClick={() => {
                  downloadTextFile(
                    `${slugify(title)}${charts.length > 1 ? `-${index + 1}` : ''}.csv`,
                    'text/csv',
                    chartToCsv(chart.exportData, { title }),
                  );
                  trackDiscovery('csv');
                }}
              >
                {t('chart.downloadCsv', 'Download CSV')}
              </button>
            </div>
            {tableOpen && (
              <div id={`${id}-table-${inFocus ? 'focus' : 'card'}-${index}`}>
                <ChartDataTable chartData={chart.exportData} caption={t('chart.tabularDataFor', 'Tabular data for {name}').replace('{name}', localTitle)} />
              </div>
            )}
          </div>
        ))}
        {source && <p>{t('chart.sourceLabel', 'Source:')} {tx(source)}</p>}
        {dataCoverage && <p>{t('chart.fullCoverage', 'Full source coverage:')} {dataCoverage}</p>}
        {lastUpdated && <p>{t('chart.updatedLabel', 'Updated:')} {lastUpdated}</p>}
        {coverageNote && <p className="chart-coverage-note">{tx(coverageNote)}</p>}
        {Array.isArray(provenanceKeys) && provenanceKeys.length > 0 && (
          <div className="chart-provenance">
            <span>{t('chart.traceFigure', 'Trace a headline figure:')}</span>
            {provenanceKeys.map((key) => <CiteFigure key={key} figureKey={key} />)}
          </div>
        )}
      </div>
    </details>
  );

  const renderChart = () => (
    <>
      {renderRange()}
      {charts.map((chart, index) => <p key={index} id={`${id}-summary-${index}`} className="sr-only">{chart.summary}</p>)}
      {preparedChildren}
    </>
  );

  return (
    <div className="card chart-card" role="region" aria-labelledby={anchorId}>
      <div className="chart-card-header">
        <div className="chart-title-row">
          <h3 id={anchorId} tabIndex={-1} data-chart-anchor>{localTitle}</h3>
          {latestPeriod && <span className="latest-period-badge">{t('chart.latestBadge', 'Latest:')} {latestPeriod}</span>}
          <button
            type="button"
            ref={expandButtonRef}
            className="chart-action-btn"
            onClick={() => setChartOpen(true)}
            aria-label={t('chart.expandNamed', 'Expand {name}').replace('{name}', localTitle)}
            title={t('chart.expand', 'Expand chart')}
          >
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button
            type="button"
            className={`info-toggle ${infoOpen ? 'active' : ''}`}
            onClick={() => setInfoOpen((value) => !value)}
            aria-expanded={infoOpen}
            aria-controls={`${id}-description`}
            aria-label={infoOpen ? t('chart.hideDescription', 'Hide description') : t('chart.showDescription', 'Show description')}
            title={t('chart.howToRead', 'How to read this chart')}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
        <div id={`${id}-description`} className={`chart-description-panel ${infoOpen ? 'expanded' : ''}`} hidden={!infoOpen}>
          {infoOpen && <p className="chart-description">{localDescription}</p>}
          {infoOpen && noteKey && <EditorialNote noteKey={noteKey} />}
        </div>
      </div>
      {chartOpen ? <div className="chart-expanded-placeholder">{t('chart.openInFocus', 'Chart open in focus view')}</div> : renderChart()}
      {renderContext()}
      {!chartOpen && renderDataSources()}
      {chartOpen && createPortal(
        <div className="chart-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setChartOpen(false);
        }}>
          <div ref={modalRef} className="chart-modal" role="dialog" aria-modal="true" aria-label={localTitle}>
            <div className="chart-modal__header">
              <h2>{localTitle}</h2>
              <button
                type="button"
                ref={closeButtonRef}
                className="chart-modal__close"
                onClick={() => setChartOpen(false)}
                aria-label={t('chart.closeExpanded', 'Close expanded chart')}
              >×</button>
            </div>
            <div className="chart-modal__body">{renderChart()}</div>
            <div className="chart-modal__details">
              {description && <p>{localDescription}</p>}
              {renderContext()}
              {renderDataSources(true)}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
