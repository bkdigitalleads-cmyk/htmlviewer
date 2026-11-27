/**
 * Small storage helpers: the key/value table in SQLite (settings, counters,
 * flags) and the share copies of exported files (PDFs) in the cache
 * folder, which are cleared at the next launch.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { getDb } from './db/native';
import * as repo from './db/repo';

export async function kvGet(key: string): Promise<string | null> {
  return repo.kvGet(await getDb(), key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  await repo.kvSet(await getDb(), key, value);
}

/** A new empty folder in the cache for one share copy, so its file keeps a readable name. */
export function shareDir(): Directory {
  const d = new Directory(Paths.cache, 'share', Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Moves a file the system made (a PDF from the print renderer) into a share folder under a readable name. */
export function shareCopy(uri: string, name: string): string {
  const src = new File(uri);
  const dest = new File(shareDir(), name);
  src.moveSync(dest);
  return dest.uri;
}

/** Clears earlier share copies at launch. */
export function sweepCache(): void {
  try {
    const d = new Directory(Paths.cache, 'share');
    if (d.exists) d.delete();
  } catch {
    // harmless
  }
}
