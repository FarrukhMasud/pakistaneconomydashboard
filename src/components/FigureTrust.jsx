import { useContext } from 'react';
import { useData } from '../hooks/useData';
import { TrustContext } from '../utils/trustContext';
import useI18n from '../i18n/useI18n';
import { formatKpiPeriod } from '../utils/kpiFormat';
import {
  evidenceListOf, fieldIsWithheld, freshnessStatus, locatorLabel, publicationOf, resolveFigureMetadata, resolveSourceTier, safeSourceUrl,
  sourceFigureStatus, TRUST_LABELS, unavailableInfo, validationStatus,
} from '../utils/figureTrust';
import '../styles/trust.css';

export default function FigureTrust({ datasetId, data, row, field, period, derivation, compact = false }) {
  const freshness = useData('data-freshness.json');
  const provenance = useData('provenance.json');
  const { t, tx } = useI18n();
  const scope = useContext(TrustContext);
  const id = datasetId || scope.datasetId;
  const canonical = useData(id ? `${id}.json` : 'data-freshness.json');
  const metadata = freshness.data?.datasets?.find((item) => item.id === id);
  const dataset = { ...metadata, ...(data || (id === scope.datasetId ? scope.data : null)), ...(id ? canonical.data : null),
    ...(id && canonical.error ? { freshnessStatus: 'fetch-failed' } : {}) };
  const figure = row || field || period ? resolveFigureMetadata(dataset, row, { field, period }) : dataset;
  const evidences = evidenceListOf(figure, provenance.data);
  const evidence = evidences[0];
  const sourceUrl = evidence.sourceUrl || safeSourceUrl(figure?.sourceUrl || dataset?.sourceUrl);
  const blocked = (id && canonical.unavailable) || unavailableInfo(dataset) || unavailableInfo(figure) || (field && fieldIsWithheld(dataset, field));
  const formula = derivation || figure?.derivedFrom || figure?.derivation;
  const authenticity = blocked ? 'unavailable' : id && (canonical.loading || canonical.error) ? 'unverified' : formula && resolveSourceTier(dataset) !== 'unverified'
    ? 'official-derived' : resolveSourceTier(figure, resolveSourceTier(dataset));
  const status = formula ? 'derived' : sourceFigureStatus(figure);
  const statedObservation = period || figure?.period || figure?.date || figure?.observationDate || dataset?.observationDate || dataset?.latestObservation;
  const formattedObservation = formatKpiPeriod(statedObservation);
  const observation = formattedObservation === '—' || /\b(?:null|undefined|NaN|Infinity)\b/.test(formattedObservation) ? null : formattedObservation;
  const label = (kind, value) => t(`trust.${kind}.${value}`, TRUST_LABELS[kind][value]);

  return (
    <div className={`figure-trust ${compact ? 'figure-trust--compact' : ''}`}>
      <div className="figure-trust__line">
        <span>{observation || t('trust.periodUnknown', 'Period not stated')}</span>
        <span>{blocked ? t('trust.unavailableShort', 'Unavailable') : label('status', status)}</span>
        {!blocked && formula && <span>{t('trust.inputStatus', 'Source figure status')}: {label('status', sourceFigureStatus(figure))}</span>}
        {sourceUrl
          ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{t('trust.originalSource', 'Original source')}</a>
          : <span>{t('trust.evidenceMissing', 'Exact source evidence not available')}</span>}
        {evidences.filter((item) => item.artifactUrl).map((item, index) =>
          <a key={`${item.artifactUrl}-${index}`} href={item.artifactUrl} target="_blank" rel="noopener noreferrer">
            {t('trust.artifact', 'Source artifact')}{evidences.length > 1 ? ` ${index + 1}` : ''}
          </a>)}
        {sourceUrl && !evidences.some((item) => item.artifactUrl) && <span>{t('trust.evidenceMissing', 'Exact source evidence not available')}</span>}
      </div>
      <details className="figure-trust__details">
        <summary>{t('trust.details', 'Trust details')} · {label('authenticity', authenticity)}</summary>
        <dl>
          <div><dt>{t('trust.authenticity', 'Authenticity')}</dt><dd>{label('authenticity', authenticity)}</dd></div>
          <div><dt>{t('trust.freshness', 'Freshness')}</dt><dd>{label('freshness', freshnessStatus({ ...dataset, ...figure }))}</dd></div>
          <div><dt>{t('trust.validation', 'Calculation validation')}</dt><dd>{label('validation', validationStatus({ ...dataset, ...figure }))}</dd></div>
          <div><dt>{t('trust.derivation', 'Derivation')}</dt><dd>{formula ? tx(formula) : authenticity === 'official-derived' ? t('trust.formulaMissing', 'Derivation not documented') : t('trust.noDerivation', 'No derivation documented; see source')}</dd></div>
          {evidences.filter((item) => item.sourceUrl || item.artifactUrl || item.responseUrl || item.locator || item.retrievedAt).map((item, index) => <div key={`evidence-${index}`}>
            <dt>{t('trust.artifact', 'Source artifact')}{evidences.length > 1 ? ` ${index + 1}` : ''}</dt>
            <dd>
              {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{t('trust.originalSource', 'Original source')}</a>}
              {item.responseUrl && <> · {t('trust.downloadedFrom', 'Downloaded from')}: <a href={item.responseUrl} target="_blank" rel="noopener noreferrer">{item.responseUrl}</a></>}
              {item.retrievedAt && <> · {t('trust.retrieved', 'Artifact retrieved')}: {item.retrievedAt}</>}
              {locatorLabel(item.locator) && <> · {t('trust.locator', 'Source location')}: {locatorLabel(item.locator)}</>}
              {item.parserVersion && <> · {t('trust.parser', 'Parser version')}: {item.parserVersion}</>}
              {item.status && <> · {t('trust.inputStatus', 'Source figure status')}: {label('status', sourceFigureStatus(item))}</>}
              {item.sourceStatus && <> · {t('trust.sourceStatus', 'Recorded source status')}: {item.sourceStatus}</>}
              {item.comments && <> · {t('trust.sourceComments', 'Source comments')}: {item.comments}</>}
            </dd>
          </div>)}
          {figure?.sourceStatus && <div><dt>{t('trust.sourceStatus', 'Recorded source status')}</dt><dd>{figure.sourceStatus}</dd></div>}
          {figure?.comments && <div><dt>{t('trust.sourceComments', 'Source comments')}</dt><dd>{figure.comments}</dd></div>}
          {(figure?.verificationDate || dataset?.verificationDate) && <div><dt>{t('trust.checked', 'Source checked')}</dt><dd>{figure.verificationDate || dataset.verificationDate}</dd></div>}
          {publicationOf(dataset)?.reason && <div><dt>{t('trust.publication', 'Publication policy')}</dt><dd>{tx(publicationOf(dataset).reason)}</dd></div>}
        </dl>
      </details>
    </div>
  );
}
