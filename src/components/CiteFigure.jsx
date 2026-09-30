import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';
import {
  canonicalProvenanceFigure, evidenceListOf, locatorLabel, OFFICIAL_UNAVAILABLE, provenanceFigureAllowed, provenanceTarget, safeSourceUrl,
  sourceFigureStatus, TRUST_LABELS, unavailableInfo,
} from '../utils/figureTrust';

function formatValue(figure) {
  if (!Number.isFinite(figure.value)) return String(figure.value ?? '—');
  return figure.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Shows exactly where a single published number came from: which institution,
 * which document, which sheet/table, which period, and how it was derived.
 *
 * Legacy provenance is gated against the canonical publication policy.
 */
export default function CiteFigure({ figureKey, compact = false }) {
  const { t, tx } = useI18n();
  const { data } = useData('provenance.json');
  const freshness = useData('data-freshness.json');
  const { datasetId } = provenanceTarget(figureKey);
  const canonical = useData(datasetId ? `${datasetId}.json` : 'data-freshness.json');
  const popoverId = useId();
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
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
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

  const rawFigure = data?.figures?.[figureKey];
  const figure = rawFigure ? canonicalProvenanceFigure(figureKey, rawFigure, canonical.data, data) : null;
  const source = figure ? data?.sources?.[figure.sourceId] : null;
  const dataset = canonical.data || freshness.data?.datasets?.find((item) => item.id === datasetId);
  const blocked = canonical.unavailable || unavailableInfo(figure) || unavailableInfo(dataset);
  const evidences = evidenceListOf(figure, data);
  const evidence = evidences[0];
  const sourceUrl = evidence.sourceUrl || safeSourceUrl(source?.url);
  const status = sourceFigureStatus(figure);
  const figureStatus = t(`trust.status.${status}`, TRUST_LABELS.status[status]);
  if (blocked) return <span className="figure-trust">{t('trust.unavailable', OFFICIAL_UNAVAILABLE)}</span>;
  if (canonical.loading || canonical.error || !provenanceFigureAllowed(figureKey, figure, canonical.data) || (!source && !evidence.sourceUrl)) return <span className="figure-trust">{t('trust.evidenceMissing', 'Exact source evidence not available')}</span>;

  const citation = [
    `${source?.institution || figure.source || 'Official source'}, "${source?.title || figure.label}"`,
    figure.sheet ? `sheet "${figure.sheet}"` : null,
    figure.location,
    `${figure.label}: ${formatValue(figure)}${figure.unit ? ` ${figure.unit}` : ''}`,
    figure.period ? `for ${figure.period}` : null,
    figureStatus,
    figure.derivedFrom ? `Derivation: ${figure.derivedFrom}` : null,
    ...evidences.flatMap((item) => [locatorLabel(item.locator), item.retrievedAt ? `Artifact retrieved ${item.retrievedAt}` : null,
      item.responseUrl ? `Downloaded from ${item.responseUrl}` : null, item.artifactUrl, item.sourceUrl]),
    sourceUrl,
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
        aria-controls={open ? popoverId : undefined}
        title={t('trust.sourceFor', 'Source for {label}').replace('{label}', figure.label)}
      >
        {t('trust.cite', 'Cite source')} · {figureStatus}
      </button>
      {open && anchor && createPortal(
        <div
          ref={popoverRef}
          id={popoverId}
          className="cite-figure__popover"
          style={{ top: `${anchor.top}px`, right: `${Math.max(8, anchor.right)}px` }}
          role="dialog"
          aria-label={t('trust.sourceFor', 'Source for {label}').replace('{label}', figure.label)}
        >
          <span className="cite-figure__title">{figure.label}</span>
          <span className="cite-figure__value">
            {formatValue(figure)} {figure.unit}
            {figure.period ? ` · ${figure.period}` : ''}
          </span>
          <dl className="cite-figure__rows">
            <div>
              <dt>{t('trust.issuer', 'Issuing institution')}</dt>
              <dd>{source?.institution || figure.source || t('trust.originalSource', 'Original source')}</dd>
            </div>
            <div>
              <dt>{tx("Document")}</dt>
              <dd>
                {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{source?.title || figure.label}</a> : source?.title}
                {safeSourceUrl(source?.landingUrl) && (
                  <>
                    {' '}
                    (<a href={source.landingUrl} target="_blank" rel="noreferrer">page</a>)
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>{t('trust.artifact', 'Source artifact')}</dt>
              <dd>{evidences.some((item) => item.artifactUrl) ? evidences.filter((item) => item.artifactUrl).map((item, index) =>
                <div key={index}><a href={item.artifactUrl} target="_blank" rel="noreferrer">{item.artifactId || t('trust.artifact', 'Source artifact')}</a>
                  {item.sourceUrl && <> · <a href={item.sourceUrl} target="_blank" rel="noreferrer">{t('trust.originalSource', 'Original source')}</a></>}
                  {item.responseUrl && <> · {t('trust.downloadedFrom', 'Downloaded from')}: <a href={item.responseUrl} target="_blank" rel="noreferrer">{item.responseUrl}</a></>}
                  {item.retrievedAt && <> · {t('trust.retrieved', 'Artifact retrieved')}: {item.retrievedAt}</>}
                  {locatorLabel(item.locator) && <> · {locatorLabel(item.locator)}</>}
                </div>) : t('trust.evidenceMissing', 'Exact source evidence not available')}</dd>
            </div>
            {evidence.responseUrl && <div><dt>{t('trust.downloadedFrom', 'Downloaded from')}</dt><dd><a href={evidence.responseUrl} target="_blank" rel="noreferrer">{evidence.responseUrl}</a></dd></div>}
            {locatorLabel(evidence.locator) && <div><dt>{t('trust.locator', 'Source location')}</dt><dd>{locatorLabel(evidence.locator)}</dd></div>}
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
              <dd>{figureStatus}</dd>
            </div>
            <div>
              <dt>{t('trust.retrieved', 'Artifact retrieved')}</dt>
              <dd>{evidence.retrievedAt || t('trust.retrievalUnknown', 'Artifact retrieval date not recorded')}</dd>
            </div>
            {source?.cadence && (
              <div>
                <dt>{tx("Cadence")}</dt>
                <dd>{source.cadence}</dd>
              </div>
            )}
          </dl>
          {figure.note && <span className="cite-figure__note">{figure.note}</span>}
          <button type="button" className="cite-figure__copy" onClick={copyCitation}>
            {copied ? t('trust.copied', 'Citation copied') : t('trust.copy', 'Copy citation')}
          </button>
        </div>,
        document.body,
      )}
    </span>
  );
}
