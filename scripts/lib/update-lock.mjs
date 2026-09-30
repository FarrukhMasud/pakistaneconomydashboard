import { open, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function withUpdateLock(operation, rootDir) {
  const path = resolve(rootDir, '.data-update.lock');
  const token = JSON.stringify({ id: randomUUID(), pid: process.pid, startedAt: new Date().toISOString() });
  let handle;
  try { handle = await open(path, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error('Another data refresh owns .data-update.lock. Investigate a stopped updater before removing a stale lock.', { cause: error });
  }
  try {
    await handle.writeFile(token);
    return await operation();
  } finally {
    await handle.close();
    if (await readFile(path, 'utf8') !== token) throw new Error('Data update lock ownership changed unexpectedly');
    await unlink(path);
  }
}
