/**
 * Everything the screens read and write: the kept files (SQLite rows plus
 * their folders in the app's storage) and the reading settings. Screens
 * call these actions; nothing else touches the database or the library.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getDb } from './db/native';
import * as repo from './db/repo';
import type { FileRow } from './db/repo';
import * as lib from './library';
import { sniffKind, pasteName } from './filetypes';
import { cleanFolder } from './gates';
import { dayKey, DEFAULT_SOURCE_SIZE, paperFor } from './rules';
import { phoneLocale, PhoneLocale } from './locale';
import type { SourceThemeId } from './theme';

const K = {
  installDay: 'install.day',
  kept: 'usage.filesKept',
  prefs: 'prefs.reading',
};

export interface Prefs {
  /** Source: wrap long lines. */
  wrap: boolean;
  /** Source theme (Pro). */
  sourceTheme: SourceThemeId;
  /** Source font size (Pro). */
  sourceSize: number;
  /** Preview: text size. */
  scale: number;
  /** Preview: dark page. */
  dark: boolean;
}

const DEFAULT_PREFS: Prefs = { wrap: true, sourceTheme: 'system', sourceSize: DEFAULT_SOURCE_SIZE, scale: 1, dark: false };

export function parsePrefs(json: string | null): Prefs {
  try {
    const v = JSON.parse(json ?? '{}') ?? {};
    return {
      wrap: typeof v.wrap === 'boolean' ? v.wrap : DEFAULT_PREFS.wrap,
      sourceTheme: ['system', 'paper', 'night', 'sepia', 'contrast'].includes(v.sourceTheme) ? v.sourceTheme : 'system',
      sourceSize: typeof v.sourceSize === 'number' && v.sourceSize >= 10 && v.sourceSize <= 24 ? v.sourceSize : DEFAULT_SOURCE_SIZE,
      scale: typeof v.scale === 'number' && v.scale >= 0.5 && v.scale <= 3 ? v.scale : 1,
      dark: v.dark === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface Data {
  loaded: boolean;
  failed: string | null;
  locale: PhoneLocale;
  paper: ReturnType<typeof paperFor>;
  installDay: string | null;
  /** Files kept since install, including removed ones (for the rating rule). */
  keptEver: number;
  files: FileRow[];
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  keepIncoming: (url: string) => Promise<FileRow>;
  keepPicked: (sources: lib.Source[]) => Promise<FileRow>;
  keepPaste: (text: string) => Promise<FileRow>;
  keepSample: () => Promise<FileRow>;
  touch: (id: string) => void;
  remove: (id: string) => Promise<void>;
  setFolder: (id: string, folder: string) => Promise<void>;
  setFlags: (id: string, flags: { scripts?: boolean; remote?: boolean }) => Promise<void>;
  saveOver: (id: string, text: string) => Promise<FileRow>;
  saveAsNew: (id: string, text: string) => Promise<FileRow>;
}

const Ctx = createContext<Data | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const locale = useMemo(phoneLocale, []);
  const paper = useMemo(() => paperFor(locale.region), [locale]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [installDay, setInstallDay] = useState<string | null>(null);
  const [keptEver, setKeptEver] = useState(0);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        let day = await repo.kvGet(db, K.installDay);
        if (!day) {
          day = dayKey(Date.now());
          await repo.kvSet(db, K.installDay, day);
        }
        setInstallDay(day);
        setKeptEver(Math.max(0, Number(await repo.kvGet(db, K.kept)) || 0));
        setPrefsState(parsePrefs(await repo.kvGet(db, K.prefs)));
        setFiles(await repo.listFiles(db));
      } catch (e: any) {
        setFailed(e?.message ?? 'unknown');
      }
      setLoaded(true);
    })();
  }, []);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...p };
      getDb()
        .then((db) => repo.kvSet(db, K.prefs, JSON.stringify(next)))
        .catch(() => {});
      return next;
    });
  }, []);

  const store = useCallback(async (row: FileRow, counts = true) => {
    const db = await getDb();
    await repo.saveFile(db, row);
    setFiles((list) => [row, ...list.filter((f) => f.id !== row.id)].sort((a, b) => b.openedAt - a.openedAt));
    if (counts) {
      setKeptEver((n) => {
        repo.kvSet(db, K.kept, String(n + 1)).catch(() => {});
        return n + 1;
      });
    }
    return row;
  }, []);

  const keepIncoming = useCallback((url: string) => store(lib.keepIncoming(url)), [store]);
  const keepPicked = useCallback((sources: lib.Source[]) => store(lib.keepFiles(sources, 'outside')), [store]);
  const keepPaste = useCallback(
    (text: string) => {
      const kind = sniffKind(text);
      return store(lib.keepText(pasteName(kind), kind, text));
    },
    [store]
  );
  const keepSample = useCallback(() => store(lib.keepSample()), [store]);

  const update = useCallback(async (id: string, change: (f: FileRow) => FileRow) => {
    const db = await getDb();
    const cur = await repo.getFile(db, id);
    if (!cur) return null;
    const next = change(cur);
    await repo.saveFile(db, next);
    setFiles((list) => list.map((f) => (f.id === id ? next : f)).sort((a, b) => b.openedAt - a.openedAt));
    return next;
  }, []);

  const touch = useCallback(
    (id: string) => {
      update(id, (f) => ({ ...f, openedAt: Date.now() })).catch(() => {});
    },
    [update]
  );

  const remove = useCallback(async (id: string) => {
    const db = await getDb();
    const cur = await repo.getFile(db, id);
    if (cur) lib.removeFolder(cur);
    await repo.deleteFile(db, id);
    setFiles((list) => list.filter((f) => f.id !== id));
  }, []);

  const setFolder = useCallback(
    async (id: string, folder: string) => {
      await update(id, (f) => ({ ...f, folder: cleanFolder(folder) }));
    },
    [update]
  );

  const setFlags = useCallback(
    async (id: string, flags: { scripts?: boolean; remote?: boolean }) => {
      await update(id, (f) => ({ ...f, scripts: flags.scripts ?? f.scripts, remote: flags.remote ?? f.remote }));
    },
    [update]
  );

  const saveOver = useCallback(
    async (id: string, text: string) => {
      const next = await update(id, (f) => lib.saveOver(f, text));
      if (!next) throw new Error('This file is no longer on the phone.');
      return next;
    },
    [update]
  );

  const saveAsNew = useCallback(
    async (id: string, text: string) => {
      const db = await getDb();
      const cur = await repo.getFile(db, id);
      if (!cur) throw new Error('This file is no longer on the phone.');
      const names = (await repo.listFiles(db)).map((f) => f.name);
      return store(lib.saveAsNew(cur, text, names));
    },
    [store]
  );

  const value = useMemo<Data>(
    () => ({ loaded, failed, locale, paper, installDay, keptEver, files, prefs, setPrefs, keepIncoming, keepPicked, keepPaste, keepSample, touch, remove, setFolder, setFlags, saveOver, saveAsNew }),
    [loaded, failed, locale, paper, installDay, keptEver, files, prefs, setPrefs, keepIncoming, keepPicked, keepPaste, keepSample, touch, remove, setFolder, setFlags, saveOver, saveAsNew]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
