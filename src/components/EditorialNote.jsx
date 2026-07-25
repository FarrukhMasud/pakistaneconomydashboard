import { useData } from '../hooks/useData';

/**
 * Renders a narrative claim that was computed from the dashboard's own data
 * (see scripts/generate-editorial-notes.mjs) together with the official
 * documents behind it, so no sentence on the site asserts a number that cannot
 * be traced.
 */
export default function EditorialNote({ noteKey }) {
  const { data } = useData('editorial-notes.json');
  const note = data?.notes?.[noteKey];
  if (!note) return null;

  return (
    <span className="editorial-note">
      <span className="editorial-note__text">{note.text}</span>
      <span className="editorial-note__meta">
        <span className="editorial-note__derivation" title={note.derivation}>
          Computed from published data{note.asOf ? ` · as of ${note.asOf}` : ''}
        </span>
        {note.sources?.map((source) => (
          <a key={source.id} href={source.url} target="_blank" rel="noreferrer" title={`${source.institution} — ${source.label}`}>
            {source.institution}
          </a>
        ))}
      </span>
    </span>
  );
}
