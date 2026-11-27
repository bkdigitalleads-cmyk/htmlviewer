/**
 * Find (and, in the editor, replace). Pure, checked by `npm test`.
 * Matching ignores case; matches never overlap.
 */

export interface Match {
  start: number;
  end: number;
}

export interface LineMatch {
  line: number;
  start: number;
  end: number;
}

/** At most this many matches are counted and shown. */
export const MAX_MATCHES = 2000;

/** Every match of the query in the text, in order. An empty query finds nothing. */
export function findAll(text: string, query: string, limit = MAX_MATCHES): Match[] {
  if (!query) return [];
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  // Lower-casing can change a string's length (a few letters outside Latin); then match on the text as it is.
  const same = hay.length === text.length && needle.length === query.length;
  const h = same ? hay : text;
  const n = same ? needle : query;
  const out: Match[] = [];
  let at = h.indexOf(n);
  while (at !== -1 && out.length < limit) {
    out.push({ start: at, end: at + n.length });
    at = h.indexOf(n, at + n.length);
  }
  return out;
}

/** Matches by line, for the Source view. A match never spans lines. */
export function findInLines(lines: string[], query: string, limit = MAX_MATCHES): LineMatch[] {
  const out: LineMatch[] = [];
  if (!query) return out;
  for (let i = 0; i < lines.length && out.length < limit; i++) {
    for (const m of findAll(lines[i], query, limit - out.length)) out.push({ line: i, start: m.start, end: m.end });
  }
  return out;
}

/** The next (1) or previous (-1) match, wrapping around. -1 when there are none. */
export function stepMatch(current: number, total: number, dir: 1 | -1): number {
  if (total <= 0) return -1;
  if (current < 0 || current >= total) return dir === 1 ? 0 : total - 1;
  return (current + dir + total) % total;
}

/** "3 of 12", "No matches", or "" with no query. */
export function matchLabel(current: number, total: number, query: string, capped = total >= MAX_MATCHES): string {
  if (!query) return '';
  if (total === 0) return 'No matches';
  return `${current + 1} of ${total}${capped ? '+' : ''}`;
}

/** Replaces one match. Returns the new text and where the caret goes (after the replacement). */
export function replaceOne(text: string, m: Match, replacement: string): { text: string; caret: number } {
  return { text: text.slice(0, m.start) + replacement + text.slice(m.end), caret: m.start + replacement.length };
}

/** Replaces every match. Returns the new text and how many were replaced. */
export function replaceAll(text: string, query: string, replacement: string): { text: string; count: number } {
  const ms = findAll(text, query, Number.MAX_SAFE_INTEGER);
  if (ms.length === 0) return { text, count: 0 };
  let out = '';
  let last = 0;
  for (const m of ms) {
    out += text.slice(last, m.start) + replacement;
    last = m.end;
  }
  return { text: out + text.slice(last), count: ms.length };
}

/** The line a character offset is on (for scrolling the editor to a match). */
export function lineAt(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10 || (c === 13 && text.charCodeAt(i + 1) !== 10)) line++;
  }
  return line;
}
