/**
 * Reading and writing the database through the Db interface. No native
 * imports: the app passes expo-sqlite, the tests pass node:sqlite, and the
 * same SQL runs on both.
 */
import type { Db } from './schema.ts';
import type { Kind } from '../filetypes.ts';
import { EXTENSIONS } from '../filetypes.ts';
import type { Origin } from '../rules.ts';

// ---------- key/value ----------

export async function kvGet(db: Db, key: string): Promise<string | null> {
  const r = await db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  return r ? r.value : null;
}

export async function kvSet(db: Db, key: string, value: string): Promise<void> {
  await db.run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

// ---------- files ----------

/** One kept file: its own folder in the app's storage, the main file in it, and how it shows. */
export interface FileRow {
  id: string;
  /** The name shown ("statement.html"). */
  name: string;
  /** Its folder under the app's library (one per kept file). */
  dir: string;
  /** The main file's path inside that folder. */
  main: string;
  kind: Kind;
  origin: Origin;
  /** A folder on the recent list (Pro), or ''. */
  folder: string;
  /** The person's own choice for scripts and web content; null follows the default for the origin. */
  scripts: boolean | null;
  remote: boolean | null;
  size: number;
  createdAt: number;
  openedAt: number;
  updatedAt: number;
}

type Row = {
  id: string;
  name: string;
  dir: string;
  main: string;
  kind: string;
  origin: string;
  folder: string;
  scripts: number | null;
  remote: number | null;
  size: number;
  created_at: number;
  opened_at: number;
  updated_at: number;
};

const KINDS = new Set(Object.values(EXTENSIONS));
const flag = (v: number | null): boolean | null => (v == null ? null : v === 1);
const bit = (v: boolean | null): number | null => (v == null ? null : v ? 1 : 0);

export const toFile = (r: Row): FileRow => ({
  id: r.id,
  name: r.name,
  dir: r.dir,
  main: r.main,
  kind: KINDS.has(r.kind as Kind) ? (r.kind as Kind) : 'txt',
  origin: r.origin === 'made' ? 'made' : 'outside',
  folder: r.folder ?? '',
  scripts: flag(r.scripts),
  remote: flag(r.remote),
  size: Number(r.size) || 0,
  createdAt: r.created_at,
  openedAt: r.opened_at,
  updatedAt: r.updated_at,
});

/** Every kept file, most recently opened first. */
export async function listFiles(db: Db): Promise<FileRow[]> {
  return (await db.all<Row>('SELECT * FROM files ORDER BY opened_at DESC, created_at DESC')).map(toFile);
}

export async function getFile(db: Db, id: string): Promise<FileRow | null> {
  const r = await db.get<Row>('SELECT * FROM files WHERE id = ?', [id]);
  return r ? toFile(r) : null;
}

export async function saveFile(db: Db, f: FileRow): Promise<void> {
  await db.run(
    `INSERT INTO files (id, name, dir, main, kind, origin, folder, scripts, remote, size, created_at, opened_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, main = excluded.main, kind = excluded.kind, folder = excluded.folder,
       scripts = excluded.scripts, remote = excluded.remote, size = excluded.size, opened_at = excluded.opened_at, updated_at = excluded.updated_at`,
    [f.id, f.name, f.dir, f.main, f.kind, f.origin, f.folder, bit(f.scripts), bit(f.remote), f.size, f.createdAt, f.openedAt, f.updatedAt]
  );
}

export async function deleteFile(db: Db, id: string): Promise<void> {
  await db.run('DELETE FROM files WHERE id = ?', [id]);
}

export async function countFiles(db: Db): Promise<number> {
  const r = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM files');
  return Number(r?.n ?? 0);
}
