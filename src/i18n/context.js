import { createContext } from 'react';
import en from './en.js';
import ur from './ur.js';
import stringsUr from './strings-ur.js';

export const LANGUAGES = {
  en: { id: 'en', label: 'English', short: 'EN', dir: 'ltr', dict: en, strings: null },
  ur: { id: 'ur', label: 'اردو', short: 'اردو', dir: 'rtl', dict: ur, strings: stringsUr },
};

export const DEFAULT_LANGUAGE = 'en';

export const STORAGE_KEY = 'pak-eco-lang';

/** Look a key up in the active dictionary, falling back to English then the key. */
export function translate(lang, key, fallback) {
  const dict = LANGUAGES[lang]?.dict || LANGUAGES[DEFAULT_LANGUAGE].dict;
  return dict[key] ?? en[key] ?? fallback ?? key;
}

/**
 * Normalise a lookup key so a curly vs straight apostrophe, a non-breaking
 * space or stray double spacing never silently drops a translation.
 */
export function normalizeKey(text) {
  return text
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalizedCache = new Map();

function normalizedStrings(lang) {
  if (normalizedCache.has(lang)) return normalizedCache.get(lang);
  const strings = LANGUAGES[lang]?.strings;
  const index = strings
    ? Object.fromEntries(Object.entries(strings).map(([key, value]) => [normalizeKey(key), value]))
    : null;
  normalizedCache.set(lang, index);
  return index;
}

/**
 * Translate a literal English UI string.
 *
 * Components already pass readable English (`title="Trade Balance"`), so the
 * dictionary is keyed on that string. Anything untranslated returns unchanged,
 * which is exactly what we want for figures, periods and institution names.
 */
export function translateString(lang, text) {
  if (typeof text !== 'string' || !text) return text;
  const strings = LANGUAGES[lang]?.strings;
  if (!strings) return text;
  if (strings[text] !== undefined) return strings[text];
  return normalizedStrings(lang)?.[normalizeKey(text)] ?? text;
}

export const I18nContext = createContext({
  lang: DEFAULT_LANGUAGE,
  dir: 'ltr',
  setLang: () => {},
  t: (key, fallback) => translate(DEFAULT_LANGUAGE, key, fallback),
  tx: (text) => text,
});
