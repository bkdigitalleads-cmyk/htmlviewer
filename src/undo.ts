/**
 * The editor's undo and its row of code characters. Pure, checked by
 * `npm test`.
 */

export interface Sel {
  start: number;
  end: number;
}

export interface Snapshot {
  text: string;
  sel: Sel;
}

export interface History {
  past: Snapshot[];
  future: Snapshot[];
  /** When the last edit was recorded, to group quick typing into one undo step. */
  lastAt: number;
}

export const EMPTY_HISTORY: History = { past: [], future: [], lastAt: 0 };

/** Undo steps kept. */
export const MAX_STEPS = 200;
/** Typing faster than this joins the previous undo step. */
export const GROUP_MS = 900;

/**
 * Records the text as it was before an edit. Quick single-character typing
 * groups into one step; a paste, a cut, a replace or a pause starts a new one.
 */
export function record(h: History, before: Snapshot, now: number, small: boolean): History {
  const group = small && now - h.lastAt < GROUP_MS && h.past.length > 0;
  const past = group ? h.past : [...h.past, before].slice(-MAX_STEPS);
  return { past, future: [], lastAt: now };
}

export function canUndo(h: History): boolean {
  return h.past.length > 0;
}

export function canRedo(h: History): boolean {
  return h.future.length > 0;
}

/** Steps back: returns the snapshot to show and the new history. */
export function undo(h: History, current: Snapshot): { h: History; snap: Snapshot } | null {
  if (!h.past.length) return null;
  const snap = h.past[h.past.length - 1];
  return { h: { past: h.past.slice(0, -1), future: [current, ...h.future], lastAt: 0 }, snap };
}

export function redo(h: History, current: Snapshot): { h: History; snap: Snapshot } | null {
  if (!h.future.length) return null;
  const snap = h.future[0];
  return { h: { past: [...h.past, current], future: h.future.slice(1), lastAt: 0 }, snap };
}

/** The keys above the keyboard. Tab types two spaces. */
export const CODE_KEYS: { label: string; insert: string; a11y?: string }[] = [
  { label: 'Tab', insert: '  ', a11y: 'Tab, two spaces' },
  { label: '<', insert: '<' },
  { label: '>', insert: '>' },
  { label: '/', insert: '/' },
  { label: '=', insert: '=' },
  { label: '"', insert: '"', a11y: 'Double quote' },
  { label: "'", insert: "'", a11y: 'Single quote' },
  { label: '{', insert: '{' },
  { label: '}', insert: '}' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: ';', insert: ';' },
  { label: ':', insert: ':' },
  { label: '#', insert: '#' },
  { label: '.', insert: '.' },
  { label: '-', insert: '-' },
  { label: '_', insert: '_' },
  { label: '&', insert: '&' },
  { label: '[', insert: '[' },
  { label: ']', insert: ']' },
];

/** Types text at the selection (replacing what is selected). The caret goes after it. */
export function insertAt(text: string, sel: Sel, insert: string): Snapshot {
  const start = Math.max(0, Math.min(sel.start, sel.end, text.length));
  const end = Math.max(start, Math.min(Math.max(sel.start, sel.end), text.length));
  const next = text.slice(0, start) + insert + text.slice(end);
  const caret = start + insert.length;
  return { text: next, sel: { start: caret, end: caret } };
}

/** True when an edit is one typed character (or one deleted), which groups for undo. */
export function isSmallEdit(before: string, after: string): boolean {
  return Math.abs(after.length - before.length) <= 1;
}
