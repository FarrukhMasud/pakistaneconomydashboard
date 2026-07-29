import { useEffect, useMemo, useRef, useState } from 'react';
import useI18n from '../i18n/useI18n';
import { INDICATOR_CATALOG } from '../utils/indicatorCatalog';
import { useWatchlist } from '../hooks/useWatchlist';

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function score(haystack, needle) {
  const text = haystack.toLowerCase();
  const query = needle.toLowerCase();
  if (!query) return 0;
  const index = text.indexOf(query);
  if (index === 0) return 3;
  if (index > 0) return 2;
  let cursor = 0;
  for (const char of query) {
    cursor = text.indexOf(char, cursor);
    if (cursor === -1) return -1;
    cursor += 1;
  }
  return 1;
}

/**
 * Ctrl/Cmd+K jump-to-section + indicator palette.
 */
export default function CommandPalette({ groups, onNavigate, groupLabel, sectionLabel }) {
  const { t } = useI18n();
  const { isPinned, toggle } = useWatchlist();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const dialogRef = useRef(null);

  const sectionEntries = useMemo(() => groups.flatMap((group) => group.sections.map((section) => ({
    key: `section:${group.id}/${section.id}`,
    kind: 'section',
    groupId: group.id,
    sectionId: section.id,
    icon: group.icon,
    group: groupLabel(group),
    label: sectionLabel(section),
    haystack: [sectionLabel(section), section.label, groupLabel(group), group.label, section.id].join(' '),
  }))), [groups, groupLabel, sectionLabel]);

  const indicatorEntries = useMemo(() => INDICATOR_CATALOG.map((item) => ({
    key: `indicator:${item.id}`,
    kind: 'indicator',
    groupId: item.groupId,
    sectionId: item.sectionId,
    icon: '📌',
    group: t('palette.indicator', 'Indicator'),
    label: item.label,
    haystack: [item.label, item.id, ...(item.terms || [])].join(' '),
  })), [t]);

  const entries = useMemo(
    () => [...sectionEntries, ...indicatorEntries],
    [sectionEntries, indicatorEntries],
  );

  const results = useMemo(() => {
    if (!query.trim()) return sectionEntries;
    return entries
      .map((entry) => ({ entry, rank: score(entry.haystack, query.trim()) }))
      .filter((item) => item.rank > 0)
      .sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        // Prefer exact section matches slightly over indicators at same rank
        if (a.entry.kind !== b.entry.kind) return a.entry.kind === 'section' ? -1 : 1;
        return 0;
      })
      .map((item) => item.entry);
  }, [entries, sectionEntries, query]);

  const selectedIndex = results.length ? Math.min(activeIndex, results.length - 1) : 0;

  const openPalette = () => {
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => {
          if (value) return false;
          setQuery('');
          setActiveIndex(0);
          return true;
        });
        return;
      }
      if (event.key === '/' && !open && !isTypingTarget(event.target)) {
        event.preventDefault();
        setQuery('');
        setActiveIndex(0);
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, open]);

  const choose = (entry) => {
    if (!entry) return;
    onNavigate(entry.groupId, entry.sectionId);
    setOpen(false);
  };

  const onInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[selectedIndex]);
    }
  };

  return (
    <>
      <button
        type="button"
        className="palette-trigger"
        onClick={openPalette}
        aria-haspopup="dialog"
        title={t('palette.open', 'Search sections')}
      >
        <span aria-hidden="true">🔍</span>
        <span className="palette-trigger__text">{t('palette.open', 'Search sections')}</span>
        <kbd className="palette-trigger__kbd">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="palette-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div ref={dialogRef} className="palette" role="dialog" aria-modal="true" aria-label={t('palette.label', 'Section search')}>
            <input
              ref={inputRef}
              className="palette__input"
              type="text"
              value={query}
              placeholder={t('palette.placeholder', 'Search sections, indicators, data…')}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              onKeyDown={onInputKeyDown}
              aria-controls="palette-results"
              aria-autocomplete="list"
            />
            <ul className="palette__results" id="palette-results" role="listbox" ref={listRef}>
              {results.map((entry, index) => {
                const pinId = entry.kind === 'indicator' ? entry.key.replace(/^indicator:/, '') : null;
                const pinned = pinId ? isPinned(pinId) : false;
                return (
                <li key={entry.key} className="palette__row">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    data-active={index === selectedIndex}
                    className={`palette__item ${index === selectedIndex ? 'active' : ''} ${entry.kind === 'indicator' ? 'palette__item--indicator' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(entry)}
                  >
                    <span className="palette__icon" aria-hidden="true">{entry.icon}</span>
                    <span className="palette__label">{entry.label}</span>
                    <span className="palette__group">{entry.group}</span>
                  </button>
                  {pinId && (
                    <button
                      type="button"
                      className={`palette__pin ${pinned ? 'is-pinned' : ''}`}
                      aria-pressed={pinned}
                      aria-label={pinned ? t('watchlist.unpin', 'Unpin') : t('watchlist.pin', 'Pin to watchlist')}
                      title={pinned ? t('watchlist.unpin', 'Unpin') : t('watchlist.pin', 'Pin to watchlist')}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(pinId);
                      }}
                    >
                      {pinned ? '★' : '☆'}
                    </button>
                  )}
                </li>
                );
              })}
              {results.length === 0 && (
                <li className="palette__empty">{t('palette.noResults', 'No matching section')}</li>
              )}
            </ul>
            <p className="palette__hint">{t('palette.hint')}</p>
          </div>
        </div>
      )}
    </>
  );
}
