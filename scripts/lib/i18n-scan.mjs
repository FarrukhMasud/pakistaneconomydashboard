import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Props whose string literal value is rendered verbatim to the user. */
export const TRANSLATABLE_PROPS = [
  'title',
  'description',
  'subtitle',
  'footnote',
  'label',
  'heading',
  'placeholder',
  'blurb',
  'caption',
  'emptyLabel',
  'coverageNote',
];

/**
 * Strings that are intentionally never translated: institution names, units,
 * series identifiers and provenance wording must read exactly as published.
 */
const NEVER_TRANSLATE = /^(SBP|PBS|FBR|IMF|MoF|USD|PKR|CSV|JSON|API|GDP|CPI|FDI|IT|FY\d*|[\d\s.,%$—–-]+)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.jsx')) out.push(full);
  }
  return out;
}

/** Extract user-visible string literals passed to translatable props. */
export function extractTranslatableStrings(source) {
  const found = new Set();
  const propList = TRANSLATABLE_PROPS.join('|');

  // Long prose is often hoisted into a module-level const and passed by name
  // (`coverageNote={SERVICES_COVERAGE_NOTE}`). Resolve those so the value is
  // still checked for a translation - otherwise the string silently renders in
  // English when the interface is switched to Urdu.
  const constants = new Map();
  const constPattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])((?:(?!\2)[^\\]|\\.)*)\2\s*;/g;
  let constMatch;
  while ((constMatch = constPattern.exec(source)) !== null) {
    constants.set(constMatch[1], constMatch[3]);
  }

  const patterns = [
    new RegExp(`\\b(?:${propList})\\s*=\\s*"([^"\\n]+)"`, 'g'),
    new RegExp(`\\b(?:${propList})\\s*=\\s*'([^'\\n]+)'`, 'g'),
    new RegExp(`\\b(?:${propList})\\s*=\\s*\\{\\s*"([^"\\n]+)"\\s*\\}`, 'g'),
    new RegExp(`\\b(?:${propList})\\s*=\\s*\\{\\s*'([^'\\n]+)'\\s*\\}`, 'g'),
  ];

  const candidates = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) candidates.push(match[1]);
  }

  const identifierPattern = new RegExp(`\\b(?:${propList})\\s*=\\s*\\{\\s*([A-Za-z_$][\\w$]*)\\s*\\}`, 'g');
  let identifierMatch;
  while ((identifierMatch = identifierPattern.exec(source)) !== null) {
    const resolved = constants.get(identifierMatch[1]);
    if (resolved) candidates.push(resolved);
  }

  for (const candidate of candidates) {
    const value = candidate.trim();
    if (!value) continue;
    if (NEVER_TRANSLATE.test(value)) continue;
    // Skip anything that is not prose (class names, urls, keys).
    if (/^[a-z0-9-]+$/.test(value)) continue;
    if (/^https?:/.test(value)) continue;
    if (!/[A-Za-z]{3,}/.test(value)) continue;
    found.add(value);
  }

  return found;
}

/** Extract the literal arguments of every `tx('…')` call. */
export function extractTxLiterals(source) {
  const found = new Set();
  const pattern = /\btx\(\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1\s*\)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const value = match[2]
      .replace(/\\u2026/g, '\u2026')
      .replace(/\\u2019/g, '\u2019')
      .replace(/\\u00b7/g, '\u00b7')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"');
    if (value) found.add(value);
  }
  return found;
}

/** Scan a directory tree of .jsx files for translatable literals. */
export function scanTranslatableStrings(rootDir) {
  const strings = new Map();
  for (const file of walk(rootDir)) {
    const source = readFileSync(file, 'utf8');
    for (const value of extractTranslatableStrings(source)) {
      if (!strings.has(value)) strings.set(value, []);
      strings.get(value).push(file);
    }
  }
  return strings;
}

/** Scan a directory tree of .jsx files for inline `tx('…')` literals. */
export function scanTxLiterals(rootDir) {
  const strings = new Map();
  for (const file of walk(rootDir)) {
    const source = readFileSync(file, 'utf8');
    for (const value of extractTxLiterals(source)) {
      if (!strings.has(value)) strings.set(value, []);
      strings.get(value).push(file);
    }
  }
  return strings;
}
