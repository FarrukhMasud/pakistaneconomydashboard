import { useEffect, useMemo, useRef, useState } from 'react';
import useI18n from '../i18n/useI18n';

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
  // Fall back to a loose subsequence match so "fbrtax" still finds "FBR Tax".
  let cursor = 0;
  for (const char of query) {
    cursor = text.indexOf(char, cursor);
    if (cursor === -1) return -1;
    cursor += 1;
  }
  return 1;
}

/**
 * Ctrl/Cmd+K jump-to-section palette.
 *
 * With 30 sections across 5 groups, hunting through two rows of tabs is the
 * slowest part of using the dashboard. The palette searches the translated
 * labels, the English labels and the group names at once, so it works in either
 * language and still matches on the source term a user may have read elsewhere.
 */
export default function CommandPalette({ groups, onNavigate, groupLabel, sectionLabel }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const entries = useMemo(() => groups.flatMap((group) => group.sections.map((section) => ({
    key: `${group.id}/${section.id}`,
    groupId: group.id,
    sectionId: section.id,
    icon: group.icon,
    group: groupLabel(group),
    label: sectionLabel(section),
    // Keep the untranslated labels searchable so an English search term still
    // works while the interface is in Urdu.
    haystack: [sectionLabel(section), section.label, groupLabel(group), group.label, section.id].join(' '),
  }))), [groups, groupLabel, sectionLabel]);

  const results = useMemo(() => {
    if (!query.trim()) return entries;
    return entries
      .map((entry) => ({ entry, rank: score(entry.haystack, query.trim()) }))
      .filter((item) => item.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .map((item) => item.entry);
  }, [entries, query]);

  // Clamp during render rather than in an effect so a shrinking result list
  // never leaves the highlight pointing past the end.
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
    if (!open) return;
    inputRef.current?.focus();
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
          <div className="palette" role="dialog" aria-modal="true" aria-label={t('palette.label', 'Section search')}>
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
              {results.map((entry, index) => (
                <li key={entry.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    data-active={index === selectedIndex}
                    className={`palette__item ${index === selectedIndex ? 'active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(entry)}
                  >
                    <span className="palette__icon" aria-hidden="true">{entry.icon}</span>
                    <span className="palette__label">{entry.label}</span>
                    <span className="palette__group">{entry.group}</span>
                  </button>
                </li>
              ))}
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
