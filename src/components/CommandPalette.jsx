import { useEffect, useMemo, useRef, useState } from 'react';
import useI18n from '../i18n/useI18n';
import { INDICATOR_CATALOG, indicatorForQuery, scoreSearch } from '../utils/indicatorCatalog';
import { isPlainNavigation, sectionDescription, trackDiscovery } from '../utils/sectionCatalog';
import { routeToPath } from '../hooks/useHashRoute';
import { useWatchlist } from '../hooks/useWatchlist';
import { paletteShortcutAction } from '../utils/navigationModal';
import NavigationDialog from './NavigationDialog';
import WatchlistFeedback from './WatchlistFeedback';

export default function CommandPalette({ groups, onNavigate, groupLabel, sectionLabel }) {
  const { t } = useI18n();
  const { isPinned, toggle } = useWatchlist();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);

  const sectionEntries = useMemo(() => groups.flatMap((group) => group.sections.map((section) => ({
    key: `section:${group.id}/${section.id}`,
    kind: 'section',
    groupId: group.id,
    sectionId: section.id,
    icon: group.icon,
    group: groupLabel(group),
    label: sectionLabel(section),
    description: sectionDescription(section.id, t),
    terms: [sectionLabel(section), section.label, groupLabel(group), group.label, section.id, sectionDescription(section.id, t)],
  }))), [groups, groupLabel, sectionLabel, t]);

  const indicatorEntries = useMemo(() => INDICATOR_CATALOG.map((baseItem) => {
    const item = indicatorForQuery(baseItem, query);
    return {
      ...item,
      key: `indicator:${item.id}`,
      kind: 'indicator',
      icon: '📌',
      group: t('palette.indicator', 'Indicator'),
      label: t(item.labelKey || `indicator.${item.id}`, item.label),
      description: item.chartId
        ? t('palette.jumpChart', 'Jump directly to chart')
        : t('palette.openSection', 'Open the explanatory section'),
      terms: [t(item.labelKey || `indicator.${item.id}`, item.label), item.label, item.id, ...item.terms],
    };
  }), [t, query]);

  const results = useMemo(() => {
    if (!query.trim()) return sectionEntries;
    return [...sectionEntries, ...indicatorEntries]
      .map((entry) => ({ entry, rank: scoreSearch(entry.terms, query) }))
      .filter(({ rank }) => rank > 0)
      .sort((a, b) => b.rank - a.rank || Number(b.entry.kind === 'indicator') - Number(a.entry.kind === 'indicator'))
      .map(({ entry }) => entry);
  }, [sectionEntries, indicatorEntries, query]);
  const selectedIndex = results.length ? Math.min(activeIndex, results.length - 1) : 0;

  const openPalette = () => {
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const action = paletteShortcutAction(event, {
        open,
        anotherDialogOpen: Boolean(document.querySelector('dialog[open]:not(.search-dialog), [aria-modal="true"]:not(.search-dialog)')),
      });
      if (!action) return;
      event.preventDefault();
      if (action === 'close') setOpen(false);
      else {
        setQuery('');
        setActiveIndex(0);
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, open]);

  const choose = (entry) => {
    if (!entry) return;
    trackDiscovery(entry.kind);
    setOpen(false);
    onNavigate(entry.groupId, entry.sectionId, { chartId: entry.chartId });
  };

  return (
    <>
      <button
        type="button" className="palette-trigger navigation-trigger" onClick={openPalette}
        aria-haspopup="dialog" aria-expanded={open} title={t('palette.open', 'Search dashboard')}
      >
        <span aria-hidden="true">🔍</span>
        <span className="palette-trigger__text">{t('palette.trigger', 'Search')}</span>
        <kbd className="palette-trigger__kbd">Ctrl K</kbd>
      </button>
      {open && (
        <NavigationDialog
          className="search-dialog"
          title={t('palette.label', 'Dashboard search')}
          description={t('palette.description', 'Search in English or Urdu. Try inflation, dollar, مہنگائی, or ڈالر.')}
          onClose={() => setOpen(false)}
        >
          <label className="navigation-field">
            <span>{t('palette.searchLabel', 'Search sections and indicators')}</span>
            <input
              data-initial-focus type="search" value={query}
              placeholder={t('palette.placeholder', 'Search sections, indicators, data…')}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              aria-controls="palette-results"
              aria-describedby="palette-keyboard-hint"
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  const change = event.key === 'ArrowDown' ? 1 : -1;
                  setActiveIndex((index) => results.length ? (index + change + results.length) % results.length : 0);
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  choose(results[selectedIndex]);
                }
              }}
            />
          </label>
          <p className="navigation-dialog__count" role="status">
            {t('palette.resultCount', '{count} results').replace('{count}', String(results.length))}
            {results[selectedIndex] && <span className="sr-only">. {results[selectedIndex].label}</span>}
          </p>
          <ul className="palette__results discovery-results" id="palette-results" ref={listRef}>
            {results.map((entry, index) => {
              const pinId = entry.kind === 'indicator' ? entry.id : null;
              const pinned = pinId && isPinned(pinId);
              return (
                <li key={entry.key} className="palette__row">
                  <a
                    href={routeToPath(entry.groupId, entry.sectionId, { chartId: entry.chartId })}
                    data-active={index === selectedIndex}
                    className={`palette__item ${index === selectedIndex ? 'active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={(event) => {
                      if (!isPlainNavigation(event)) { trackDiscovery(entry.kind); return; }
                      event.preventDefault();
                      choose(entry);
                    }}
                  >
                    <span className="palette__icon" aria-hidden="true">{entry.icon}</span>
                    <span className="discovery-result__text">
                      <strong>{entry.label}</strong>
                      <span>{entry.description}</span>
                      <small>{entry.group}</small>
                    </span>
                  </a>
                  {pinId && (
                    <button
                      type="button" className={`palette__pin ${pinned ? 'is-pinned' : ''}`}
                      aria-pressed={Boolean(pinned)}
                      aria-label={`${pinned ? t('watchlist.unpin', 'Unpin') : t('watchlist.pin', 'Pin to watchlist')}: ${entry.label}`}
                      onClick={() => toggle(pinId)}
                    >
                      <span aria-hidden="true">{pinned ? '★' : '☆'}</span>
                    </button>
                  )}
                </li>
              );
            })}
            {!results.length && <li className="palette__empty">{t('palette.noResults', 'No matching section')}</li>}
          </ul>
          <WatchlistFeedback />
          <p className="palette__hint" id="palette-keyboard-hint">
            {t('palette.keyboardHint', 'Use arrow keys then Enter to jump, Tab to reach links and pins, or Escape to close.')}
          </p>
        </NavigationDialog>
      )}
    </>
  );
}
