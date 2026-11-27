/**
 * File names, made safe. Pure, checked by `npm test`.
 *
 * A file that arrives can be named anything: a path, percent escapes, a
 * leading dot, characters other systems refuse, a name hundreds of
 * characters long. The app's copy always gets a plain name that stays
 * inside its own folder and never collides with the app's working files
 * (which start with ".hv-").
 */

const MAX = 80;

/** Percent escapes decoded when they are valid; the text as it is when not. */
function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The last part of a path or file URL, decoded: "file:///a/Inbox/My%20page.html" -> "My page.html". */
export function lastPart(pathOrUrl: string): string {
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(pathOrUrl);
  const noQuery = url ? pathOrUrl.split(/[?#]/)[0] : pathOrUrl;
  const parts = noQuery.split(/[\\/]/).filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  return url || /%[0-9a-f]{2}/i.test(last) ? decode(last) : last;
}

/** "statement.html" -> ["statement", ".html"]; "README" -> ["README", ""]. */
export function splitName(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
}

/**
 * A name that is safe to write: one path part only, no control or reserved
 * characters, no leading dots or spaces, at most 80 characters with the
 * extension kept. Empty becomes the fallback.
 */
export function safeFileName(raw: string, fallback = 'file.html'): string {
  let s = lastPart(String(raw ?? ''));
  s = s
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '');
  if (!s || s === '.' || s === '..') return fallback;
  if (s.length > MAX) {
    const [stem, ext] = splitName(s);
    const keep = ext.length <= 12 ? ext : '';
    s = stem.slice(0, MAX - keep.length).trim() + keep;
  }
  return s || fallback;
}

/** A relative path made of safe parts, or null when it climbs out of its folder. "css/../a.css" -> "a.css". */
export function safeRelPath(raw: string): string | null {
  const out: string[] = [];
  for (const part of decode(raw.split(/[?#]/)[0]).split(/[\\/]+/)) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(safeFileName(part, '_'));
  }
  if (out.length === 0 || out.length > 6) return null;
  return out.join('/');
}

/** A name not already taken in the folder (case does not matter): "page.html", "page 2.html", "page 3.html". */
export function uniqueName(name: string, taken: string[]): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  const [stem, ext] = splitName(name);
  for (let n = 2; n < 1000; n++) {
    const next = `${stem} ${n}${ext}`;
    if (!lower.has(next.toLowerCase())) return next;
  }
  return `${stem} ${Date.now()}${ext}`;
}

/** "statement.html" -> "statement.pdf". */
export function pdfName(name: string): string {
  const [stem] = splitName(safeFileName(name, 'page.html'));
  return `${stem}.pdf`;
}

/** "statement.html" -> "statement copy.html", or "statement copy 2.html" when that is taken. */
export function copyName(name: string, taken: string[]): string {
  const [stem, ext] = splitName(name);
  return uniqueName(`${stem} copy${ext}`, taken);
}

/** True for the app's own working files inside a file's folder (the page copy, drafts). */
export function isWorkingFile(name: string): boolean {
  return name.startsWith('.hv-');
}
