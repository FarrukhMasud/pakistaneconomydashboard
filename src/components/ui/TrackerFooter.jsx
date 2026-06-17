/** Shared disclaimer + sources footer for tracker cards. */
export default function TrackerFooter({ methodologyNote, lastVerified, sourceUrl, sourceLabel = 'Source', verifiedFrom }) {
  return (
    <div className="tracker__disclaimer">
      <p>
        ⓘ {methodologyNote}
        {lastVerified && <> Last verified: {lastVerified}.</>}
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
