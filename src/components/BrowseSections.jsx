import { useState } from 'react';
import useI18n from '../i18n/useI18n';
import { routeToPath } from '../hooks/useHashRoute';
import { scoreSearch } from '../utils/indicatorCatalog';
import { isPlainNavigation, sectionDescription, trackDiscovery } from '../utils/sectionCatalog';
import NavigationDialog from './NavigationDialog';

export default function BrowseSections({ groups, activeGroupId, activeSectionId, onNavigate, groupLabel, sectionLabel }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = groups.map((group) => ({
    ...group,
    sections: group.sections.filter((section) => !query.trim() || scoreSearch([
      groupLabel(group), sectionLabel(section), section.label, section.id,
      sectionDescription(section.id, t),
    ], query) > 0),
  })).filter((group) => group.sections.length);
  const count = results.reduce((total, group) => total + group.sections.length, 0);

  return (
    <>
      <button
        type="button"
        className="browse-trigger navigation-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('browse.title', 'Browse all sections')}
        onClick={() => { setQuery(''); setOpen(true); }}
      >
        {t('browse.trigger', 'Browse')}
      </button>
      {open && (
        <NavigationDialog
          className="browse-dialog"
          title={t('browse.title', 'Browse all sections')}
          description={t('browse.description', 'Choose a topic, then a section. Each link opens a focused view of the data.')}
          onClose={() => setOpen(false)}
        >
          <label className="navigation-field">
            <span>{t('browse.filter', 'Find a section')}</span>
            <input data-initial-focus type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <p className="navigation-dialog__count" role="status">
            {t('browse.count', '{count} sections').replace('{count}', String(count))}
          </p>
          <nav aria-label={t('browse.title', 'Browse all sections')} className="browse-groups">
            {results.map((group) => (
              <details key={`${group.id}:${Boolean(query.trim())}`} className="browse-group" open={query.trim() ? true : group.id === activeGroupId}>
                <summary>
                  <span aria-hidden="true">{group.icon}</span> {groupLabel(group)}
                  <span className="browse-group__count"> {group.sections.length}</span>
                </summary>
                <ul>
                  {group.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={routeToPath(group.id, section.id)}
                        aria-current={activeSectionId === section.id ? 'page' : undefined}
                        onClick={(event) => {
                          trackDiscovery('browse');
                          if (!isPlainNavigation(event)) return;
                          event.preventDefault();
                          setOpen(false);
                          onNavigate(group.id, section.id);
                        }}
                      >
                        <strong>{sectionLabel(section)}</strong>
                        <span>{sectionDescription(section.id, t)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {!count && <p>{t('browse.empty', 'No matching sections. Try another topic or use Search for an indicator.')}</p>}
          </nav>
        </NavigationDialog>
      )}
    </>
  );
}
