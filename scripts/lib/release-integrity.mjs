import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from './source-evidence.mjs';

export function contentEntry(path, body) {
  return { path, sha256: sha256(body), bytes: Buffer.byteLength(body) };
}

export function releaseId(files) {
  return sha256(JSON.stringify([...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)));
}

export async function collectReleaseFiles(publicDir) {
  const files = [];
  const walk = async (directory, prefix) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Release assets cannot be symbolic links: ${path}`);
      if (entry.isDirectory()) await walk(resolve(directory, entry.name), path);
      else if (entry.isFile()) files.push(contentEntry(path, await readFile(resolve(directory, entry.name))));
    }
  };
  for (const folder of ['data', 'api', 'source-evidence']) {
    await walk(resolve(publicDir, folder), `/${folder}`);
  }
  for (const filename of ['feed.xml', 'sitemap.xml']) {
    files.push(contentEntry(`/${filename}`, await readFile(resolve(publicDir, filename))));
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export function validateReleaseManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid release manifest');
  const seen = new Set();
  for (const entry of manifest.files) {
    if (!/^\/(?:data|api|source-evidence)\/[A-Za-z0-9._/-]+$/.test(entry.path) && !['/feed.xml', '/sitemap.xml'].includes(entry.path)) throw new Error('Invalid release asset path');
    if (entry.path.includes('..') || seen.has(entry.path)) throw new Error('Duplicate or unsafe release asset path');
    seen.add(entry.path);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) throw new Error('Invalid release asset integrity');
  }

  if (releaseId(manifest.files) !== manifest.releaseId) throw new Error('Release manifest identity is invalid');
  return manifest;
}

export async function verifyLiveRelease(local, readLive) {
  validateReleaseManifest(local);
  const live = validateReleaseManifest(JSON.parse((await readLive('/release-manifest.json')).toString('utf8')));
  if (live.releaseId !== local.releaseId) throw new Error(`Different release is live: expected ${local.releaseId}, received ${live.releaseId}`);
  const failures = [];
  for (let index = 0; index < local.files.length; index += 4) {
    await Promise.all(local.files.slice(index, index + 4).map(async expected => {
      try {
        const received = contentEntry(expected.path, await readLive(expected.path));
        if (received.sha256 !== expected.sha256 || received.bytes !== expected.bytes) failures.push(`${expected.path}: content differs from the checked release`);
      } catch (error) {
        failures.push(error.message);
      }
    }));
  }
  if (failures.length) throw new Error(failures.join('\n'));
  return live;
}
