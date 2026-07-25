import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import en from '../../src/i18n/en.js';
import ur from '../../src/i18n/ur.js';
import stringsUr from '../../src/i18n/strings-ur.js';
import { scanTranslatableStrings, scanTxLiterals } from '../lib/i18n-scan.mjs';

/** Mirrors translateString()'s normalisation in src/i18n/context.js. */
function normalize(text) {
  return text
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readAllSources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) readAllSources(full, out);
    else if (full.endsWith('.jsx') || full.endsWith('.js')) out.push(readFileSync(full, 'utf8'));
  }
  return out;
}

test('every English key has an Urdu translation', () => {
  const missing = Object.keys(en).filter(key => !(key in ur));
  assert.deepEqual(missing, [], `missing Urdu strings: ${missing.join(', ')}`);
});

test('the Urdu dictionary does not carry keys that no longer exist in English', () => {
  const orphans = Object.keys(ur).filter(key => !(key in en));
  assert.deepEqual(orphans, [], `orphaned Urdu strings: ${orphans.join(', ')}`);
});

test('no translation is left as an untranslated copy of the English string', () => {
  // Emoji-only differences are fine, but a whole Latin-script sentence in the
  // Urdu file means the key was added and never translated.
  const untranslated = Object.entries(ur)
    .filter(([key, value]) => {
      if (value !== en[key]) return false;
      return /[A-Za-z]{4,}/.test(value);
    })
    .map(([key]) => key);
  assert.deepEqual(untranslated, []);
});

test('every nav key in the English dictionary is namespaced consistently', () => {
  for (const key of Object.keys(en)) {
    assert.match(key, /^[a-z][a-z0-9]*(\.[A-Za-z0-9-]+)+$/, `key "${key}" is not dot-namespaced`);
  }
});

test('every translatable prop literal in the components has an Urdu string', () => {
  const translated = new Set(Object.keys(stringsUr).map(normalize));
  const missing = [...scanTranslatableStrings('src').keys()]
    .filter((text) => !translated.has(normalize(text)));
  assert.deepEqual(
    missing,
    [],
    `add Urdu translations to src/i18n/strings-ur.js for:\n  ${missing.join('\n  ')}`,
  );
});

test('the string dictionary carries no keys that no longer appear in the source', () => {
  const sources = readAllSources('src').map(normalize).join('\n');
  const orphans = Object.keys(stringsUr).filter((key) => !sources.includes(normalize(key)));
  assert.deepEqual(
    orphans,
    [],
    `remove these stale keys from src/i18n/strings-ur.js:\n  ${orphans.join('\n  ')}`,
  );
});

test('every inline tx() literal has an Urdu string', () => {
  const translated = new Set(Object.keys(stringsUr).map(normalize));
  const missing = [...scanTxLiterals('src').keys()]
    .filter((text) => !translated.has(normalize(text)));
  assert.deepEqual(
    missing,
    [],
    `add Urdu translations to src/i18n/strings-ur.js for:\n  ${missing.join('\n  ')}`,
  );
});

test('no Urdu string is left as a verbatim copy of its English key', () => {
  const copies = Object.entries(stringsUr)
    .filter(([key, value]) => key === value && /[A-Za-z]{4,}/.test(value))
    .map(([key]) => key);
  assert.deepEqual(copies, []);
});
