/**
 * The database layout and its migrations. Pure (no native imports), so
 * `npm test` runs the same migrations on Node's SQLite.
 *
 * Rules: MIGRATIONS only ever grows. A shipped migration is never edited
 * or reordered; a change is a new entry at the end. PRAGMA user_version
 * holds how many have run. (The engine's pattern, from Cash Counter.)
 */

export type Param = string | number | null;

/** The little the app needs from a database: expo-sqlite in the app, node:sqlite in the tests. */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: Param[]): Promise<void>;
  all<T>(sql: string, params?: Param[]): Promise<T[]>;
  get<T>(sql: string, params?: Param[]): Promise<T | null>;
  /** Runs fn inside one transaction: all of it lands, or none of it. */
  tx(fn: () => Promise<void>): Promise<void>;
}

export const MIGRATIONS: string[] = [
  // 1: 1.0.0
  `
  CREATE TABLE kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE files (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    dir TEXT NOT NULL,
    main TEXT NOT NULL,
    kind TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'outside',
    folder TEXT NOT NULL DEFAULT '',
    scripts INTEGER,
    remote INTEGER,
    size INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    opened_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX files_opened ON files (opened_at);
  `,
];

/** Runs every migration this database has not had yet, each in its own transaction. Returns the version it ends at. */
export async function migrate(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  let v = Number(row?.user_version ?? 0);
  if (v > MIGRATIONS.length) throw new Error(`This database is from a newer version of the app (${v}).`);
  while (v < MIGRATIONS.length) {
    const sql = MIGRATIONS[v];
    const next = v + 1;
    await db.tx(async () => {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${next}`);
    });
    v = next;
  }
  return v;
}
