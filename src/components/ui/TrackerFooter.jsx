import useI18n from '../../i18n/useI18n';

export default function TrackerFooter({ methodologyNote, lastVerified, sourceUrl, sourceLabel = 'Source', verifiedFrom }) {
  const { t } = useI18n();
  return (
    <div className="tracker__disclaimer">
      <p>
        ⓘ {methodologyNote}
        {lastVerified && <> {t('trust.checked', 'Source checked')}: {lastVerified}.</>}
      </p>
      {verifiedFrom?.length > 0 && (
        <details className="tracker__sources">
          <summary>Sources ({verifiedFrom.length})</summary>
          <ul>
            {verifiedFrom.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noopener noreferrer">{u}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="source-link-pill">
          🔗 {sourceLabel}
        </a>
      )}
    </div>
  );
}
