import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';

function formatValue(figure) {
  if (!Number.isFinite(figure.value)) return String(figure.value ?? '—');
  return figure.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function statusLabel(status) {
  if (status === 'provisional') return 'Provisional (P) — subject to revision by the source';
  if (status === 'revised') return 'Revised (R) by the source';
  if (status === 'estimate') return 'Estimate — not a final published outturn';
  if (status === 'derived') return 'Derived on this dashboard from official inputs';
  return 'Final published figure';
}

/**
 * Shows exactly where a single published number came from: which institution,
 * which document, which sheet/table, which period, and how it was derived.
 *
 * Everything rendered here is written by the parsers into
 * public/data/provenance.json, so the citation can never drift from the figure.
 */
export default function CiteFigure({ figureKey, compact = false }) {
  const { tx } = useI18n();
  const { data } = useData('provenance.json');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const wrapRef = useRef(null);
  const popoverRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (wrapRef.current?.contains(event.target)) return;
      if (popoverRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // The popover is portalled to <body> because KPI and chart cards clip
    // overflow; reposition it whenever the page moves under it.
    const reposition = () => {
      const rect = toggleRef.current?.getBoundingClientRect();
      if (rect) setAnchor({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    };
    reposition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const figure = data?.figures?.[figureKey];
  const source = figure ? data?.sources?.[figure.sourceId] : null;
  if (!figure || !source) return null;

  const citation = [
    `${source.institution}, "${source.title}"`,
    figure.sheet ? `sheet "${figure.sheet}"` : null,
    figure.location,
    `${figure.label}: ${formatValue(figure)}${figure.unit ? ` ${figure.unit}` : ''}`,
    figure.period ? `for ${figure.period}` : null,
    `retrieved ${figure.retrievedAt}`,
    source.url,
  ].filter(Boolean).join('. ');

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this citation:', citation);
    }
  };

  return (
    <span className={`cite-figure ${compact ? 'cite-figure--compact' : ''}`} ref={wrapRef}>
      <button
        ref={toggleRef}
        type="button"
        className="cite-figure__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title={`Where does ${figure.label} come from?`}
      >
        ⓘ Source
      </button>
      {open && anchor && createPortal(
        <div
          ref={popoverRef}
          className="cite-figure__popover"
          style={{ top: `${anchor.top}px`, right: `${Math.max(8, anchor.right)}px` }}
          role="dialog"
          aria-label={`Source for ${figure.label}`}
        >
          <span className="cite-figure__title">{figure.label}</span>
          <span className="cite-figure__value">
            {formatValue(figure)} {figure.unit}
            {figure.period ? ` · ${figure.period}` : ''}
          </span>
          <dl className="cite-figure__rows">
            <div>
              <dt>{tx("Institution")}</dt>
              <dd>{source.institution}</dd>
            </div>
            <div>
              <dt>{tx("Document")}</dt>
              <dd>
                <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                {source.landingUrl && (
                  <>
                    {' '}
                    (<a href={source.landingUrl} target="_blank" rel="noreferrer">page</a>)
                  </>
                )}
              </dd>
            </div>
            {figure.sheet && (
              <div>
                <dt>{tx("Sheet")}</dt>
                <dd>{figure.sheet}</dd>
              </div>
            )}
            {figure.location && (
              <div>
                <dt>{tx("Location")}</dt>
                <dd>{figure.location}</dd>
              </div>
            )}
            {figure.derivedFrom && (
              <div>
                <dt>{tx("Derivation")}</dt>
                <dd>{figure.derivedFrom}</dd>
              </div>
            )}
            <div>
              <dt>{tx("Status")}</dt>
              <dd>{statusLabel(figure.status)}</dd>
            </div>
            <div>
              <dt>{tx("Retrieved")}</dt>
              <dd>{figure.retrievedAt}</dd>
            </div>
            {source.cadence && (
              <div>
                <dt>{tx("Cadence")}</dt>
                <dd>{source.cadence}</dd>
              </div>
            )}
          </dl>
          {figure.note && <span className="cite-figure__note">{figure.note}</span>}
          <button type="button" className="cite-figure__copy" onClick={copyCitation}>
            {copied ? '✅ Citation copied' : '📋 Copy citation'}
          </button>
        </div>,
        document.body,
      )}
    </span>
  );
}
