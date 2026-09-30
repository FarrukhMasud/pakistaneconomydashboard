import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname, extname, basename, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OFFICIAL_DOMAINS = [
  'sbp.org.pk', 'pbs.gov.pk', 'fbr.gov.pk', 'finance.gov.pk',
  'imf.org', 'worldbank.org', 'power.gov.pk', 'ndma.gov.pk',
  'punjab.gov.pk', 'sindh.gov.pk', 'kp.gov.pk', 'balochistan.gov.pk',
  'nepra.org.pk', 'ogra.org.pk',
];
const SECRET_PARAMETERS = /^(?:api[_-]?key|token|access_token|password|secret|authorization)$/i;
let evidenceQueue = Promise.resolve();

function serialize(operation) {
  const result = evidenceQueue.then(operation, operation);
  evidenceQueue = result;
  return result;
}

export function officialDomain(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  return OFFICIAL_DOMAINS.find(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)) || null;
}

export function validateOfficialUrl(value) {
  if (!officialDomain(value)) throw new Error('Source is not an approved official HTTPS origin');
  const url = new URL(value);
  if ([...url.searchParams.keys()].some(key => SECRET_PARAMETERS.test(key))) {
    throw new Error('Source evidence URLs must not contain credentials');
  }
  url.hash = '';
  return url.toString();
}

export function sha256(body) {
  return createHash('sha256').update(body).digest('hex');
}

async function readCatalog(rootDir) {
  try {
    const catalog = JSON.parse(await readFile(resolve(rootDir, 'public', 'data', 'source-artifacts.json'), 'utf8'));
    if (!Array.isArray(catalog.artifacts) || !catalog.sources) throw new Error('Invalid source-artifacts catalog');
    return catalog;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { schemaVersion: 1, artifacts: [], sources: {}, checks: {} };
  }
}

async function writeCatalog(rootDir, catalog) {
  const directory = resolve(rootDir, 'public', 'data');
  await mkdir(directory, { recursive: true });
  const temporary = resolve(directory, `source-artifacts.${process.pid}.tmp`);
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`);
  await rename(temporary, resolve(directory, 'source-artifacts.json'));
}

async function parserVersion(parser, rootDir) {
  if (!parser) throw new Error('Source evidence requires a parser identifier');
  const filename = basename(String(parser).split(':')[0]);
  const file = resolve(rootDir, 'scripts', filename);
  try {
    const source = await readFile(file);
    const hash = sha256(source);
    const path = `/source-evidence/parser-${hash}.txt`;
    await mkdir(resolve(rootDir, 'public', 'source-evidence'), { recursive: true });
    const archived = resolve(rootDir, 'public', 'source-evidence', basename(path));
    try {
      if (sha256(await readFile(archived)) !== hash) throw new Error('Archived parser source was modified');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await writeFile(archived, source, { flag: 'wx' });
    }
    const dependencies = [];
    const visited = new Set([file]);
    const collect = async currentFile => {
      const text = await readFile(currentFile, 'utf8');
      const imports = [...text.matchAll(/(?:from\s+|import\s*\()\s*['"](\.[^'"]+\.mjs)['"]/g)].map(match => match[1]);
      for (const specifier of imports) {
        const dependency = resolve(dirname(currentFile), ...specifier.split('/'));
        if (visited.has(dependency)) continue;
        if (!dependency.startsWith(`${resolve(rootDir, 'scripts')}${sep}`)) throw new Error('Parser dependency escapes the scripts directory');
        visited.add(dependency);
        const bytes = await readFile(dependency);
        const sha = sha256(bytes);
        const sourcePath = `/source-evidence/parser-${sha}.txt`;
        const archivedDependency = resolve(rootDir, 'public', 'source-evidence', basename(sourcePath));
        try {
          if (sha256(await readFile(archivedDependency)) !== sha) throw new Error('Archived parser dependency was modified');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          await writeFile(archivedDependency, bytes, { flag: 'wx' });
        }
        dependencies.push({ file: relative(rootDir, dependency).split(sep).join('/'), sha256: sha, sourcePath });
        await collect(dependency);
      }
    };
    await collect(file);
    for (const manifest of ['package.json', 'package-lock.json']) {
      let bytes;
      try { bytes = await readFile(resolve(rootDir, manifest)); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        continue;
      }
      const sha = sha256(bytes);
      const sourcePath = `/source-evidence/parser-${sha}.txt`;
      const archivedManifest = resolve(rootDir, 'public', 'source-evidence', basename(sourcePath));
      try {
        if (sha256(await readFile(archivedManifest)) !== sha) throw new Error('Archived dependency manifest was modified');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await writeFile(archivedManifest, bytes, { flag: 'wx' });
      }
      dependencies.push({ file: manifest, sha256: sha, sourcePath });
    }
    dependencies.sort((a, b) => a.file.localeCompare(b.file));
    return { version: `${filename}:sha256:${hash}:environment:${sha256(JSON.stringify(dependencies))}`, path, dependencies };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(`Cannot identify source parser version: ${parser}`, { cause: error });
  }
}

async function captureArtifact({
  sourceKey, sourceUrl, responseUrl = sourceUrl, body, contentType = '', filename, parser,
}, { rootDir = ROOT } = {}) {
  if (!sourceKey || !filename) throw new Error('Source evidence requires a source key and filename');
  const origin = validateOfficialUrl(sourceUrl);
  const finalUrl = validateOfficialUrl(responseUrl);
  if (officialDomain(origin) !== officialDomain(finalUrl)) {
    throw new Error('An official source redirected to a different institution');
  }
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (!bytes.length) throw new Error(`Cannot archive an empty source: ${sourceKey}`);
  const hash = sha256(bytes);
  const extension = extname(filename).toLowerCase();
  if (!/^\.(?:json|pdf|xls|xlsx|csv|html|txt)$/.test(extension)) throw new Error('Unsupported source evidence format');
  const path = `/source-evidence/${hash}${extension}`;
  const output = resolve(rootDir, 'public', 'source-evidence', `${hash}${extension}`);
  await mkdir(dirname(output), { recursive: true });
  try {
    const existing = await readFile(output);
    if (sha256(existing) !== hash) throw new Error(`Archived source has been modified: ${hash}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(output, bytes, { flag: 'wx' });
  }

  const now = new Date().toISOString();
  const catalog = await readCatalog(rootDir);
  const { version, path: parserPath, dependencies: parserDependencies } = await parserVersion(parser, rootDir);
  let receipt = catalog.artifacts.find(item => item.sha256 === hash && item.sourceKey === sourceKey && item.parserVersion === version
    && item.sourceUrl === origin && item.responseUrl === finalUrl);
  if (!receipt) {
    receipt = {
      artifactId: `${sourceKey}:${hash}:${sha256(`${version}:${origin}:${finalUrl}`).slice(0, 12)}`,
      sha256: hash, sourceKey, sourceUrl: origin, responseUrl: finalUrl,
      path, bytes: bytes.length, contentType, retrievedAt: now, parserVersion: version, parserPath, parserDependencies,
    };
    catalog.artifacts.push(receipt);
  }
  catalog.sources[sourceKey] = receipt.artifactId;
  catalog.checks ||= {};
  catalog.checks[sourceKey] = { status: 'success', checkedAt: now, artifactId: receipt.artifactId };
  await writeCatalog(rootDir, catalog);
  return receipt;
}

export function captureSourceArtifact(input, options) {
  return serialize(() => captureArtifact(input, options));
}

export function recordSourceFailure(sourceKey, reason, { rootDir = ROOT } = {}) {
  return serialize(async () => {
    if (!sourceKey || !reason) throw new Error('A failed source check must explain its failure');
    const catalog = await readCatalog(rootDir);
    catalog.checks ||= {};
    const safeReason = String(reason).replace(/([?&](?:api[_-]?key|token|access_token|password|secret)=)[^&\s]+/gi, '$1[redacted]');
    catalog.checks[sourceKey] = { status: 'failed', checkedAt: new Date().toISOString(), reason: safeReason };
    await writeCatalog(rootDir, catalog);
  });
}

export async function getSourceEvidence(sourceKey, { rootDir = ROOT, artifactId } = {}) {
  const catalog = await readCatalog(rootDir);
  const receipt = catalog.artifacts.find(item => item.artifactId === (artifactId || catalog.sources[sourceKey]));
  if (!receipt) return null;
  validateOfficialUrl(receipt.sourceUrl);
  validateOfficialUrl(receipt.responseUrl);
  if (!/^\/source-evidence\/[a-f0-9]{64}\.(?:json|pdf|xls|xlsx|csv|html|txt)$/.test(receipt.path)) {
    throw new Error('Invalid archived source path');
  }
  const bytes = await readFile(resolve(rootDir, 'public', 'source-evidence', basename(receipt.path)));
  if (sha256(bytes) !== receipt.sha256 || bytes.length !== receipt.bytes) {
    throw new Error(`Source evidence integrity failed for ${sourceKey}`);
  }
  return receipt;
}

export function getSourceEvidenceById(artifactId, options = {}) {
  if (!artifactId) throw new Error('An immutable artifact identifier is required');
  return getSourceEvidence(null, { ...options, artifactId });
}

export async function collectSourceReceipts(data, options = {}) {
  const ids = new Set();
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (value.artifactId) ids.add(value.artifactId);
    for (const [key, item] of Object.entries(value)) if (key !== 'sourceEvidence') walk(item);
  };
  walk(data);
  const receipts = {};
  for (const id of ids) {
    const receipt = await getSourceEvidenceById(id, options);
    if (!receipt) throw new Error(`A published observation refers to unavailable source evidence: ${id}`);
    receipts[id] = receipt;
  }
  return receipts;
}

export function quarantineIncompleteArtifacts({ rootDir = ROOT } = {}) {
  return serialize(async () => {
    const catalog = await readCatalog(rootDir);
    const incomplete = catalog.artifacts.filter(receipt => !receipt.parserPath
      || !Array.isArray(receipt.parserDependencies) || !/:environment:[a-f0-9]{64}$/.test(receipt.parserVersion || ''));
    if (!incomplete.length) return [];
    const ids = new Set(incomplete.map(receipt => receipt.artifactId));
    catalog.quarantinedArtifacts ||= [];
    for (const receipt of incomplete) {
      const original = await getSourceEvidence(receipt.sourceKey, { rootDir, artifactId: receipt.artifactId });
      if (!original) throw new Error('Legacy source receipt could not be verified');
      catalog.quarantinedArtifacts.push({
        receipt: original, quarantinedAt: new Date().toISOString(),
        reason: 'Original acquisition lacks a captured parser/environment snapshot. Retained for history, not eligible to certify published figures.',
      });
    }
    catalog.artifacts = catalog.artifacts.filter(receipt => !ids.has(receipt.artifactId));
    catalog.checks ||= {};
    for (const [key, id] of Object.entries(catalog.sources)) {
      if (ids.has(id)) {
        delete catalog.sources[key];
        catalog.checks[key] = {
          status: 'needs-review', checkedAt: new Date().toISOString(),
          reason: 'Legacy evidence quarantined; a genuine fresh capture is required.',
        };
      }
    }
    await writeCatalog(rootDir, catalog);
    return incomplete.map(receipt => receipt.artifactId);
  });
}

export async function auditSourceArtifacts({ rootDir = ROOT } = {}) {
  const catalog = await readCatalog(rootDir);
  const seen = new Set();
  for (const receipt of catalog.artifacts) {
    if (seen.has(receipt.artifactId)) throw new Error(`Duplicate source artifact ${receipt.artifactId}`);
    seen.add(receipt.artifactId);
    validateOfficialUrl(receipt.sourceUrl);
    validateOfficialUrl(receipt.responseUrl);
    if (officialDomain(receipt.sourceUrl) !== officialDomain(receipt.responseUrl)) throw new Error('Source redirect institution mismatch');
    if (!/^\/source-evidence\/[a-f0-9]{64}\.(?:json|pdf|xls|xlsx|csv|html|txt)$/.test(receipt.path)) throw new Error('Invalid archived source path');
    const body = await readFile(resolve(rootDir, 'public', 'source-evidence', basename(receipt.path)));
    if (sha256(body) !== receipt.sha256 || body.length !== receipt.bytes) throw new Error(`Corrupt source artifact ${receipt.artifactId}`);
    if (!/^\/source-evidence\/parser-[a-f0-9]{64}\.txt$/.test(receipt.parserPath || '')) throw new Error('Missing archived parser version');
    const parser = await readFile(resolve(rootDir, 'public', 'source-evidence', basename(receipt.parserPath)));
    if (!receipt.parserVersion.includes(`:sha256:${sha256(parser)}:`)) throw new Error('Parser source integrity failed');
    if (!Array.isArray(receipt.parserDependencies) || !receipt.parserVersion.endsWith(`:environment:${sha256(JSON.stringify(receipt.parserDependencies))}`)) throw new Error('Parser environment integrity failed');
    for (const dependency of receipt.parserDependencies) {
      if (!/^\/source-evidence\/parser-[a-f0-9]{64}\.txt$/.test(dependency.sourcePath)) throw new Error('Invalid parser dependency path');
      const bytes = await readFile(resolve(rootDir, 'public', 'source-evidence', basename(dependency.sourcePath)));
      if (sha256(bytes) !== dependency.sha256) throw new Error('Parser dependency integrity failed');
    }
  }
  for (const artifactId of Object.values(catalog.sources)) {
    if (!seen.has(artifactId)) throw new Error('Source catalog references a missing artifact');
  }
  return catalog;
}
