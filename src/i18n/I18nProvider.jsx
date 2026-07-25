import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, I18nContext, LANGUAGES, STORAGE_KEY, translate, translateString } from './context';

function initialLang() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && LANGUAGES[stored]) return stored;
  // Honour an Urdu browser preference on first visit, but never guess beyond
  // the languages we actually ship.
  const preferred = (window.navigator?.languages || []).find(code => code.toLowerCase().startsWith('ur'));
  return preferred ? 'ur' : DEFAULT_LANGUAGE;
}

export default function I18nProvider({ children }) {
  const [lang, setLang] = useState(initialLang);
  const dir = LANGUAGES[lang]?.dir || 'ltr';

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
  }, [lang, dir]);

  const t = useCallback((key, fallback) => translate(lang, key, fallback), [lang]);
  const tx = useCallback((text) => translateString(lang, text), [lang]);
  const value = useMemo(() => ({ lang, dir, setLang, t, tx }), [lang, dir, t, tx]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
