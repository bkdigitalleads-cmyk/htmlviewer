/**
 * Which files open, and where. Pure (no React or native imports), checked
 * by `npm test`.
 *
 * The ten types from the brief: .html, .htm, .xhtml, .txt, .css, .js,
 * .json, .xml, .svg, .md. HTML and SVG open in Preview; the others open in
 * Source. .mht and .webarchive are out of scope and say so. A file with
 * another extension that iOS hands over as plain text (a .log, a .py) opens
 * as text in Source when its bytes look like text.
 */

export type Kind = 'html' | 'svg' | 'txt' | 'css' | 'js' | 'json' | 'xml' | 'md';
export type Lang = 'html' | 'css' | 'js' | 'json' | 'xml' | 'md' | 'text';

export interface TypeInfo {
  kind: Kind;
  /** The syntax coloring for Source. */
  lang: Lang;
  /** Where the file opens first. */
  opensIn: 'preview' | 'source';
  /** The short tag on the file's row ("HTML"). */
  tag: string;
  mime: string;
  /** The UTI the share sheet gets. */
  uti: string;
}

const TYPES: Record<Kind, TypeInfo> = {
  html: { kind: 'html', lang: 'html', opensIn: 'preview', tag: 'HTML', mime: 'text/html', uti: 'public.html' },
  svg: { kind: 'svg', lang: 'xml', opensIn: 'preview', tag: 'SVG', mime: 'image/svg+xml', uti: 'public.svg-image' },
  txt: { kind: 'txt', lang: 'text', opensIn: 'source', tag: 'TXT', mime: 'text/plain', uti: 'public.plain-text' },
  css: { kind: 'css', lang: 'css', opensIn: 'source', tag: 'CSS', mime: 'text/css', uti: 'public.css' },
  js: { kind: 'js', lang: 'js', opensIn: 'source', tag: 'JS', mime: 'text/javascript', uti: 'com.netscape.javascript-source' },
  json: { kind: 'json', lang: 'json', opensIn: 'source', tag: 'JSON', mime: 'application/json', uti: 'public.json' },
  xml: { kind: 'xml', lang: 'xml', opensIn: 'source', tag: 'XML', mime: 'application/xml', uti: 'public.xml' },
  md: { kind: 'md', lang: 'md', opensIn: 'source', tag: 'MD', mime: 'text/markdown', uti: 'net.daringfireball.markdown' },
};

/** Extension (lower case, no dot) to kind. */
export const EXTENSIONS: Record<string, Kind> = {
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  xht: 'html',
  txt: 'txt',
  text: 'txt',
  css: 'css',
  js: 'js',
  json: 'json',
  xml: 'xml',
  svg: 'svg',
  md: 'md',
  markdown: 'md',
};

/** Out of scope, with a plain reason. */
const REFUSED: Record<string, string> = {
  mht: 'MHT files do not open here. Save the page as HTML and open that.',
  mhtml: 'MHT files do not open here. Save the page as HTML and open that.',
  webarchive: 'Web archives do not open here. Save the page as HTML and open that.',
};

export const NOT_TEXT = 'This kind of file does not open here. HTML Viewer opens web pages, code and text.';

export function typeInfo(kind: Kind): TypeInfo {
  return TYPES[kind];
}

/** "page.HTML" -> "html"; "README" -> "". */
export function extOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** The kind for a file name, or null when the extension is not one of the ten. */
export function kindOf(name: string): Kind | null {
  return EXTENSIONS[extOf(name)] ?? null;
}

/** True for files that open in Preview (HTML and SVG). */
export function previews(kind: Kind): boolean {
  return TYPES[kind].opensIn === 'preview';
}

/** A file that may be the main file of a folder: one of the ten types. */
export function isViewable(name: string): boolean {
  return kindOf(name) != null;
}

/**
 * True when the first bytes look like text: no NUL byte (unless a UTF-16
 * byte order mark says otherwise) and few control characters.
 */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return true;
  const n = Math.min(bytes.length, 8000);
  let odd = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32 && b !== 27)) odd++;
  }
  return n === 0 || odd / n < 0.02;
}

export type Classified = { kind: Kind } | { refuse: string };

/**
 * What happens to a file that arrives: its kind, or a plain reason it does
 * not open. Unknown extensions open as text when the bytes are text.
 */
export function classify(name: string, head: Uint8Array): Classified {
  const ext = extOf(name);
  if (REFUSED[ext]) return { refuse: REFUSED[ext] };
  const kind = EXTENSIONS[ext];
  if (kind) return { kind };
  return looksLikeText(head) ? { kind: 'txt' } : { refuse: NOT_TEXT };
}

/**
 * The kind for pasted code, from what it looks like. Checked in this
 * order: SVG, HTML, JSON, XML, CSS, Markdown, JavaScript, then text.
 */
export function sniffKind(text: string): Kind {
  const t = text.replace(/^﻿/, '').trimStart();
  const head = t.slice(0, 2000);
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return 'svg';
  if (/^<!doctype html/i.test(head) || /<(html|head|body)[\s>]/i.test(head)) return 'html';
  if (/^[[{]/.test(t)) {
    try {
      JSON.parse(t);
      return 'json';
    } catch {
      // not JSON
    }
  }
  if (/^<\?xml/i.test(head)) return 'xml';
  if (/^<[a-z][\w-]*[\s/>]/i.test(head) && /<\/[a-z][\w-]*>|\/>/i.test(head)) return 'html';
  if (/^[^{}<>]*\{[^{}]*[\w-]+\s*:[^{};]+;?[^{}]*\}/.test(head) && !/\b(function|const|let|var|return)\b/.test(head)) return 'css';
  if (/^#{1,6} \S/m.test(head) && !/[;{}]\s*$/m.test(head)) return 'md';
  if (/\b(function|const|let|var|=>|console\.|document\.|import |export )/.test(head)) return 'js';
  return 'txt';
}

/** The file name a paste gets, by its kind. */
export function pasteName(kind: Kind): string {
  const ext = kind === 'txt' ? 'txt' : kind === 'md' ? 'md' : kind;
  return `Pasted code.${ext}`;
}

/** The MIME type for a companion file (images, fonts, styles) when it is inlined into a PDF. */
export function mimeOf(name: string): string {
  const ext = extOf(name);
  const known: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    avif: 'image/avif',
    css: 'text/css',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
  };
  if (known[ext]) return known[ext];
  const k = EXTENSIONS[ext];
  return k ? TYPES[k].mime : 'application/octet-stream';
}
