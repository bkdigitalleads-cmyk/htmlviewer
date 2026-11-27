/**
 * The app's own copies of the files people open. Each kept file gets its
 * own folder under Documents/library/<dir>/, with the main file and any
 * files that came with it (style sheets, pictures) placed where the page
 * looks for them. The web view may read only that folder.
 *
 * Files that arrive from another app (Mail, Files, Messages) are handed
 * over by iOS as a copy in Documents/Inbox (Info.plist
 * LSSupportsOpeningDocumentsInPlace is false). The app copies it into its
 * folder and deletes the Inbox copy. The original in the other app is
 * never touched.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { classify, kindOf, Kind } from './filetypes';
import { decodeBytes } from './text';
import { copyName, isWorkingFile, lastPart, safeFileName, safeRelPath, uniqueName } from './names';
import { cssRefs, FolderFile, planFolder, references } from './page';
import type { FileRow } from './db/repo';
import type { Origin } from './rules';
import { SAMPLE_FILES, SAMPLE_NAME } from './sample';

/** Files over this size do not open (a page this big is almost never one file a person reads). */
export const MAX_BYTES = 25_000_000;

export class Refused extends Error {}

function libDir(): Directory {
  const d = new Directory(Paths.document, 'library');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export function itemDir(dir: string): Directory {
  return new Directory(libDir(), dir);
}

/** The file:// URL of a file's folder, ending in "/". */
export function folderUrl(row: FileRow): string {
  const u = itemDir(row.dir).uri;
  return u.endsWith('/') ? u : `${u}/`;
}

function fileAt(dir: string, path: string): File {
  return new File(itemDir(dir), ...path.split('/'));
}

export function mainFile(row: FileRow, path = row.main): File {
  return fileAt(row.dir, path);
}

const newDirId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const newId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function ensureParent(dir: Directory, path: string) {
  const parts = path.split('/').slice(0, -1);
  if (parts.length === 0) return;
  const d = new Directory(dir, ...parts);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

function headBytes(f: File): Uint8Array {
  const h = f.open();
  try {
    return h.readBytes(Math.min(8000, f.size ?? 8000));
  } finally {
    h.close();
  }
}

export interface Source {
  uri: string;
  name: string;
}

/**
 * Keeps one file, or a page with the files picked with it: a new folder,
 * the main file in it, and the rest placed where the page looks for them.
 * Throws Refused with a plain reason when nothing in it opens here.
 */
export function keepFiles(sources: Source[], origin: Origin, now = Date.now()): FileRow {
  if (sources.length === 0) throw new Refused('Nothing was picked.');
  const named = sources.map((s) => ({ ...s, name: safeFileName(s.name || lastPart(s.uri), 'file.html') }));
  // The main file: the first page, else the first file of the ten types, else the first text file.
  const pick =
    named.find((s) => kindOf(s.name) === 'html') ??
    named.find((s) => kindOf(s.name) != null) ??
    named[0];
  const src = new File(pick.uri);
  if (!src.exists) throw new Refused('The file could not be read. Try sharing it again.');
  if ((src.size ?? 0) > MAX_BYTES) throw new Refused('This file is too large to open here (over 25 MB).');
  const verdict = classify(pick.name, headBytes(src));
  if ('refuse' in verdict) throw new Refused(verdict.refuse);
  const kind: Kind = verdict.kind;
  const rest = named.filter((s) => s !== pick);

  let refs: string[] = [];
  if (kind === 'html' && rest.length > 0) refs = references(decodeBytes(src.bytesSync()).text);
  const companions = rest.map((s) => {
    if (kindOf(s.name) !== 'css') return { name: s.name };
    try {
      return { name: s.name, refs: cssRefs(decodeBytes(new File(s.uri).bytesSync()).text) };
    } catch {
      return { name: s.name };
    }
  });
  // A name with no extension that reads as text gets ".txt", so it opens the same way next time.
  const mainName = kindOf(pick.name) ? pick.name : `${pick.name}.txt`;
  const plan = planFolder({ name: mainName, refs }, companions);

  const dirId = newDirId();
  const dir = itemDir(dirId);
  dir.create({ intermediates: true, idempotent: true });
  try {
    src.copySync(new File(dir, plan.main));
    for (const p of plan.placements) {
      const from = rest.find((s) => s.name === p.from);
      if (!from) continue;
      ensureParent(dir, p.to);
      try {
        new File(from.uri).copySync(new File(dir, ...p.to.split('/')));
      } catch {
        // a companion that cannot be copied is left out; the page still opens
      }
    }
  } catch (e) {
    try {
      dir.delete();
    } catch {
      // nothing to clean
    }
    throw new Refused('The file could not be copied into the app. Check that the phone has space and try again.');
  }
  return {
    id: newId(),
    name: plan.main,
    dir: dirId,
    main: plan.main,
    kind,
    origin,
    folder: '',
    scripts: null,
    remote: null,
    size: src.size ?? 0,
    createdAt: now,
    openedAt: now,
    updatedAt: now,
  };
}

/** A file handed over by another app (Open in, the share sheet). Its Inbox copy is removed once kept. */
export function keepIncoming(url: string, now = Date.now()): FileRow {
  const row = keepFiles([{ uri: url, name: lastPart(url) }], 'outside', now);
  if (/\/Inbox\//.test(url)) {
    try {
      new File(url).delete();
    } catch {
      // iOS clears the Inbox itself in time
    }
  }
  return row;
}

/** Writes text as a new kept file made in the app (pasted code, the sample). */
export function keepText(name: string, kind: Kind, text: string, now = Date.now(), extra: { path: string; text: string }[] = []): FileRow {
  const dirId = newDirId();
  const dir = itemDir(dirId);
  dir.create({ intermediates: true, idempotent: true });
  const main = safeFileName(name, 'Pasted code.txt');
  const f = new File(dir, main);
  f.create();
  f.write(text);
  for (const e of extra) {
    const p = safeRelPath(e.path);
    if (!p) continue;
    ensureParent(dir, p);
    const ef = new File(dir, ...p.split('/'));
    ef.create();
    ef.write(e.text);
  }
  return { id: newId(), name: main, dir: dirId, main, kind, origin: 'made', folder: '', scripts: null, remote: null, size: f.size ?? text.length, createdAt: now, openedAt: now, updatedAt: now };
}

/** The sample page with its style sheet and chart beside it. */
export function keepSample(now = Date.now()): FileRow {
  const [main, ...rest] = SAMPLE_FILES;
  return keepText(SAMPLE_NAME, 'html', main.text, now, rest);
}

/** The text of a file in a kept folder (the main file unless a path is given). */
export function readText(row: FileRow, path = row.main): { text: string; encoding: string } {
  const f = mainFile(row, path);
  if (!f.exists) throw new Refused('This file is no longer on the phone.');
  return decodeBytes(f.bytesSync());
}

let viewSeq = 0;

/**
 * Writes the page copy beside the file it shows (so its relative links
 * work), as UTF-8 with a byte order mark, and removes earlier copies.
 * Returns its file:// URL.
 */
export function writeView(row: FileRow, path: string, html: string): string {
  const parts = path.split('/');
  const parent = parts.length > 1 ? new Directory(itemDir(row.dir), ...parts.slice(0, -1)) : itemDir(row.dir);
  try {
    for (const f of parent.list()) if (f instanceof File && f.name.startsWith('.hv-view-')) f.delete();
  } catch {
    // an old copy that will not go is harmless
  }
  const f = new File(parent, `.hv-view-${++viewSeq}.html`);
  f.create({ overwrite: true });
  f.write(`﻿${html}`);
  return f.uri;
}

/** Every file in a kept folder except the app's working files, for the PDF (at most 30 MB in all). */
export function folderFiles(row: FileRow): Map<string, FolderFile> {
  const out = new Map<string, FolderFile>();
  let total = 0;
  const walk = (d: Directory, prefix: string, depth: number) => {
    if (depth > 6) return;
    for (const e of d.list()) {
      if (isWorkingFile(e.name)) continue;
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e instanceof Directory) walk(e, path, depth + 1);
      else if (e instanceof File) {
        const size = e.size ?? 0;
        if (size > 10_000_000 || total + size > 30_000_000) continue;
        total += size;
        const isCss = kindOf(e.name) === 'css';
        out.set(path.toLowerCase(), { path, base64: isCss ? '' : e.base64Sync(), text: isCss ? decodeBytes(e.bytesSync()).text : undefined });
      }
    }
  };
  walk(itemDir(row.dir), '', 0);
  return out;
}

/** Saves the editor's text over the app's copy. The original in the other app is never touched. */
export function saveOver(row: FileRow, text: string, now = Date.now()): FileRow {
  const f = mainFile(row);
  if (!f.exists) f.create();
  f.write(text);
  return { ...row, size: f.size ?? text.length, updatedAt: now, openedAt: now };
}

function copyTree(from: Directory, to: Directory, depth = 0) {
  if (depth > 6) return;
  if (!to.exists) to.create({ intermediates: true, idempotent: true });
  for (const e of from.list()) {
    if (isWorkingFile(e.name)) continue;
    if (e instanceof Directory) copyTree(e, new Directory(to, e.name), depth + 1);
    else if (e instanceof File) e.copySync(new File(to, e.name));
  }
}

/** Saves the editor's text as a new kept file, in a new folder with copies of the files beside it. */
export function saveAsNew(row: FileRow, text: string, existingNames: string[], now = Date.now()): FileRow {
  const dirId = newDirId();
  const dir = itemDir(dirId);
  copyTree(itemDir(row.dir), dir);
  const name = copyName(row.name, existingNames);
  const old = new File(dir, ...row.main.split('/'));
  try {
    if (old.exists) old.delete();
  } catch {
    // left beside it
  }
  const mainPath = row.main.includes('/') ? `${row.main.slice(0, row.main.lastIndexOf('/') + 1)}${name}` : name;
  const taken = (() => {
    try {
      return itemDir(dirId).list().map((e) => e.name);
    } catch {
      return [];
    }
  })();
  const finalPath = mainPath.includes('/') ? mainPath : uniqueName(mainPath, taken);
  ensureParent(dir, finalPath);
  const f = new File(dir, ...finalPath.split('/'));
  f.create({ overwrite: true });
  f.write(text);
  return { ...row, id: newId(), name: finalPath.split('/').pop() ?? name, dir: dirId, main: finalPath, folder: row.folder, size: f.size ?? text.length, createdAt: now, openedAt: now, updatedAt: now };
}

/** Removes a kept file's folder and everything in it. */
export function removeFolder(row: FileRow): void {
  try {
    const d = itemDir(row.dir);
    if (d.exists) d.delete();
  } catch {
    // already gone
  }
}

/** True when the main file is still there. */
export function exists(row: FileRow, path = row.main): boolean {
  try {
    return mainFile(row, path).exists;
  } catch {
    return false;
  }
}
