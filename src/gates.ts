/**
 * What is free and what is Pro, as pure functions checked by `npm test`.
 *
 * Free forever: opening and previewing any file, viewing its source, find
 * in page and in source, copy, the last three recent files, and the first
 * PDF export.
 *
 * Pro: editing with live preview and saving, find and replace, every PDF
 * export after the first, every recent file and folders, and the source
 * themes and font size.
 *
 * Nobody loses what they opened: a file is always kept and always opens,
 * even past three on the free plan (older ones stay on the phone, out of
 * the list, and come back with Pro). Edits saved while Pro stay saved.
 */

/** Recent files listed on the free plan. */
export const FREE_RECENTS = 3;
/** PDF exports that are free. */
export const FREE_PDFS = 1;

/** Why the in-app paywall opened. */
export type PaywallReason = 'edit' | 'pdf' | 'recents' | 'folders' | 'themes' | 'pro';

/** Opening, previewing, viewing source, find and copy never wait on Pro. */
export function canRead(_isPro: boolean): true {
  return true;
}

/** Edit opens the editor with Pro; on the free plan it opens the paywall. */
export function canEdit(isPro: boolean): boolean {
  return isPro;
}

/** Replace sits in the editor, so it is Pro with it. */
export function canReplace(isPro: boolean): boolean {
  return isPro;
}

export interface ExportDecision {
  allowed: boolean;
  /** This export uses the free one. */
  usesFree: boolean;
}

/** A PDF: the first is free, every one after needs Pro. */
export function pdfDecision(isPro: boolean, used: number): ExportDecision {
  if (isPro) return { allowed: true, usesFree: false };
  if (used < FREE_PDFS) return { allowed: true, usesFree: true };
  return { allowed: false, usesFree: false };
}

/**
 * Keeping a new file: the paywall opens first when the free list is
 * already full (the fourth file kept), at most once per launch so reading
 * an attachment is never interrupted twice. The file opens either way.
 */
export function keepAsksPro(isPro: boolean, keptBefore: number, askedThisLaunch: boolean): boolean {
  return !isPro && keptBefore >= FREE_RECENTS && !askedThisLaunch;
}

/** The recent files listed, newest first, and how many older ones are kept out of sight. */
export function visibleRecents<T extends { openedAt: number }>(isPro: boolean, files: T[]): { shown: T[]; hidden: number } {
  const sorted = [...files].sort((a, b) => b.openedAt - a.openedAt);
  if (isPro) return { shown: sorted, hidden: 0 };
  return { shown: sorted.slice(0, FREE_RECENTS), hidden: Math.max(0, sorted.length - FREE_RECENTS) };
}

/** Folders on the recent list are Pro. Files already in a folder keep it. */
export function canUseFolders(isPro: boolean): boolean {
  return isPro;
}

/** Source themes and the source font size are Pro; the free plan follows light and dark at the standard size. */
export function canStyleSource(isPro: boolean): boolean {
  return isPro;
}

/** The files in one folder ('' is all), keeping their order. */
export function inFolder<T extends { folder: string }>(files: T[], folder: string): T[] {
  return folder ? files.filter((f) => f.folder === folder) : files;
}

/** The folder names in use, sorted, without blanks or repeats. */
export function folderNames(files: { folder: string }[]): string[] {
  return [...new Set(files.map((f) => f.folder.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** A folder name as typed, cleaned: one line, at most 30 characters. */
export function cleanFolder(name: string): string {
  return name.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
}
