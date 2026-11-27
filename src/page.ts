/**
 * The page copy: what the web view loads. Pure, checked by `npm test`.
 *
 * The original file is never changed. For Preview the app writes a copy
 * beside it in the file's own folder (".hv-view-N.html") with a small head
 * block added at the top:
 *  - a Content Security Policy: scripts only when Scripts is on; nothing
 *    from the web unless Web content is on; no forms, plugins or <base>;
 *    local files only by file: URL (and the web view itself is limited to
 *    the file's folder, see src/ui/PageView.tsx)
 *  - UTF-8 (the copy is written as UTF-8 with a byte order mark)
 *  - a viewport that allows pinch to zoom
 *  - the text size and the dark page, as CSS
 *  - find in page: each match wrapped in <mark id="hv-find-N">, and the
 *    current one reached by the URL fragment (#hv-find-N) and shown by
 *    CSS :target, so find works with scripts off.
 * The PDF copy inlines the folder's images and styles, drops scripts and
 * allows no file: loads at all.
 */
import { extOf, mimeOf } from './filetypes.ts';
import { safeRelPath } from './names.ts';

export interface PageOptions {
  scripts: boolean;
  remote: boolean;
  dark: boolean;
  /** Text size, 1 = as the page sets it. */
  scale: number;
  /** Find in page: the query, or empty. */
  find?: string;
  /** The PDF copy: no file: loads (everything is inlined), no scripts. */
  print?: boolean;
}

/** The Content Security Policy for a page copy. */
export function cspFor(o: { scripts: boolean; remote: boolean; print?: boolean }): string {
  const local = o.print ? [] : ['file:'];
  const web = o.remote ? ['https:', 'http:'] : [];
  const src = (...extra: string[]) => [...local, ...extra, ...web].join(' ');
  const scripts = o.scripts && !o.print;
  return [
    "default-src 'none'",
    `img-src ${src('data:', 'blob:')}`,
    `style-src ${src('data:', "'unsafe-inline'")}`,
    `font-src ${src('data:')}`,
    `media-src ${src('data:', 'blob:')}`,
    `script-src ${scripts ? src("'unsafe-inline'", "'unsafe-eval'") : "'none'"}`,
    `frame-src ${o.print ? "'none'" : src()}`,
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'template', 'svg', 'math', 'select']);

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '\u2014', ndash: '\u2013',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', deg: '°', middot: '·',
  bull: '•', times: '×', divide: '÷', laquo: '«', raquo: '»', shy: '',
};

interface Decoded {
  text: string;
  /** For each char of text, where it starts and ends in the source. */
  from: number[];
  to: number[];
}

/** HTML text decoded for matching: entities read, white space runs read as one space. */
export function decodeText(src: string): Decoded {
  const d: Decoded = { text: '', from: [], to: [] };
  let i = 0;
  while (i < src.length) {
    let ch = src[i];
    let len = 1;
    if (ch === '&') {
      const m = /^&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/i.exec(src.slice(i, i + 32));
      if (m) {
        const body = m[1];
        let v: string | undefined;
        if (body[0] === '#') {
          const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
          v = code > 0 && code < 0x110000 ? String.fromCodePoint(code) : undefined;
        } else v = ENTITIES[body.toLowerCase()];
        if (v !== undefined) {
          ch = v;
          len = m[0].length;
        }
      }
    }
    if (/\s/.test(ch) || ch === ' ') {
      const last = d.text.length - 1;
      if (last >= 0 && d.text[last] === ' ') {
        d.to[last] = i + len;
        i += len;
        continue;
      }
      ch = ' ';
    }
    for (const c of ch) {
      d.text += c;
      d.from.push(i);
      d.to.push(i + len);
    }
    i += len;
  }
  return d;
}

interface Segment {
  text: boolean;
  s: string;
}

/** The page split into markup and the text people read (outside scripts, styles, titles, SVG and the like). */
export function segments(html: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  const n = html.length;
  const push = (text: boolean, s: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last && last.text === text) last.s += s;
    else out.push({ text, s });
  };
  while (i < n) {
    if (html[i] !== '<') {
      const next = html.indexOf('<', i);
      const end = next === -1 ? n : next;
      push(true, html.slice(i, end));
      i = end;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      const e = html.indexOf('-->', i + 4);
      const end = e === -1 ? n : e + 3;
      push(false, html.slice(i, end));
      i = end;
      continue;
    }
    const m = /^<(\/?)([A-Za-z][\w:-]*)/.exec(html.slice(i, i + 64));
    if (!m && /^<[!?]/.test(html.slice(i, i + 2))) {
      const e = html.indexOf('>', i);
      const end = e === -1 ? n : e + 1;
      push(false, html.slice(i, end));
      i = end;
      continue;
    }
    if (!m) {
      push(true, '<');
      i++;
      continue;
    }
    // A tag: up to the ">" outside quotes.
    let j = i + m[0].length;
    let q: string | null = null;
    while (j < n) {
      const c = html[j];
      if (q) {
        if (c === q) q = null;
      } else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
      j++;
    }
    const end = Math.min(n, j + 1);
    const tag = html.slice(i, end);
    push(false, tag);
    i = end;
    const name = m[2].toLowerCase();
    if (!m[1] && RAW_TEXT.has(name) && !/\/\s*>$/.test(tag)) {
      const close = new RegExp(`</${name}\\s*>`, 'i').exec(html.slice(i));
      const stop = close ? i + close.index + close[0].length : n;
      push(false, html.slice(i, stop));
      i = stop;
    }
  }
  return out;
}

/** At most this many matches are marked in a page. */
export const MAX_MARKS = 1000;

/** Wraps every match of the query in the page's text in <mark class="hv-find" id="hv-find-N">. */
export function markFind(html: string, query: string): { html: string; count: number } {
  const q = query.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!q) return { html, count: 0 };
  let count = 0;
  let out = '';
  for (const seg of segments(html)) {
    if (!seg.text || count >= MAX_MARKS) {
      out += seg.s;
      continue;
    }
    const d = decodeText(seg.s);
    const hay = d.text.toLowerCase();
    if (hay.length !== d.text.length) {
      out += seg.s;
      continue;
    }
    let last = 0;
    let at = hay.indexOf(q);
    while (at !== -1 && count < MAX_MARKS) {
      const s = d.from[at];
      const e = d.to[at + q.length - 1];
      out += seg.s.slice(last, s) + `<mark class="hv-find" id="hv-find-${count}">` + seg.s.slice(s, e) + '</mark>';
      count++;
      last = e;
      at = hay.indexOf(q, at + q.length);
    }
    out += seg.s.slice(last);
  }
  return { html: out, count };
}

/** The fragment that shows match N. */
export function findFragment(n: number): string {
  return `hv-find-${n}`;
}

/** Viewport content with pinch to zoom allowed: user-scalable and the scale limits dropped, a width kept. */
export function relaxViewport(content: string): string {
  const keep = content
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(user-scalable|maximum-scale|minimum-scale)\s*=/i.test(p));
  if (!keep.some((p) => /^width\s*=/i.test(p))) keep.unshift('width=device-width');
  return keep.join(', ');
}

/** The CSS for text size, the dark page and find marks. */
export function viewCss(o: { scale: number; dark: boolean }): string {
  const rules: string[] = [];
  if (Math.abs(o.scale - 1) > 0.001) rules.push(`html{zoom:${Math.round(o.scale * 100) / 100}}`);
  rules.push('mark.hv-find{background:#F4DE7A;color:#111;border-radius:2px;scroll-margin:35vh 0}');
  rules.push('mark.hv-find:target{background:#F09A3E;box-shadow:0 0 0 2px #F09A3E}');
  if (o.dark) {
    rules.push('html{background:#fff;filter:invert(1) hue-rotate(180deg)}');
    rules.push('img,video,picture,canvas,iframe,embed,object,svg image,mark.hv-find,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)}');
  }
  return rules.join('\n');
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Where the head block goes: after <head>, else after <html>, else after the doctype, else at the start. */
export function headAt(html: string): number {
  const head = /<head\b[^>]*>/i.exec(html);
  if (head) return head.index + head[0].length;
  const root = /<html\b[^>]*>/i.exec(html);
  if (root) return root.index + root[0].length;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) return doctype[0].length;
  return 0;
}

/** The page copy the web view loads (or, with print, the copy the PDF is made from). */
export function pageCopy(html: string, o: PageOptions): { html: string; count: number } {
  let body = html.replace(/^﻿/, '');
  let count = 0;
  if (o.find && !o.print) {
    const r = markFind(body, o.find);
    body = r.html;
    count = r.count;
  }
  // Charset declarations go: the copy is UTF-8, said once at the top.
  body = body.replace(/<meta\b[^>]*\bcharset\s*=[^>]*>/gi, '').replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-type["']?[^>]*>/gi, '');
  let hasViewport = false;
  body = body.replace(/<meta\b[^>]*\bname\s*=\s*["']?viewport["']?[^>]*>/gi, (tag) => {
    hasViewport = true;
    const m = /\bcontent\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]*))/i.exec(tag);
    const content = m ? (m[2] ?? m[3] ?? m[4] ?? '') : '';
    return `<meta name="viewport" content="${escapeAttr(relaxViewport(content))}">`;
  });
  const block = [
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(cspFor(o))}">`,
    hasViewport || o.print ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<style id="hv-view">${viewCss({ scale: o.print ? 1 : o.scale, dark: !o.print && o.dark })}</style>`,
  ].join('');
  const at = headAt(body);
  return { html: body.slice(0, at) + block + body.slice(at), count };
}

/** The page for an SVG file: the picture as an image (so its own scripts never run), centered, fit to width. */
export function svgPage(src: string, o: PageOptions): string {
  const css = viewCss({ scale: o.print ? 1 : o.scale, dark: !o.print && o.dark });
  return [
    '<!doctype html><html><head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(cspFor({ scripts: false, remote: false, print: o.print }))}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<style>html,body{margin:0;background:#fff}body{min-height:100vh;display:flex;align-items:center;justify-content:center}img{max-width:100%;height:auto;display:block}${css}</style>`,
    `</head><body><img src="${escapeAttr(src)}" alt=""></body></html>`,
  ].join('');
}

/** True when the page has scripts (script tags, event attributes or javascript: links). */
export function hasScripts(html: string): boolean {
  return /<script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html) || /\bjavascript:/i.test(html);
}

/** True when the page loads something from the web (pictures, styles, fonts, frames). Plain links do not count. */
export function hasRemote(html: string): boolean {
  if (/\b(src|srcset|poster|data|background)\s*=\s*["']?\s*(https?:)?\/\//i.test(html)) return true;
  if (/<link\b[^>]*\bhref\s*=\s*["']?\s*(https?:)?\/\//i.test(html)) return true;
  return /url\(\s*["']?\s*(https?:)?\/\//i.test(html) || /@import\s+["']\s*(https?:)?\/\//i.test(html);
}

/** True for a reference to a file beside the page (not a web address, a data URI, a fragment or a site root path). */
export function isRelativeRef(ref: string): boolean {
  const r = ref.trim();
  if (!r || r.startsWith('#') || r.startsWith('//') || r.startsWith('/') || r.startsWith('?')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r)) return false;
  if (/[{}<>]/.test(r)) return false;
  return true;
}

function addRef(out: Set<string>, raw: string) {
  if (!isRelativeRef(raw)) return;
  const p = safeRelPath(raw.trim().replace(/&amp;/g, '&'));
  if (p) out.add(p);
}

/** Files a style sheet refers to: url(...) and @import. */
export function cssRefs(css: string): string[] {
  const out = new Set<string>();
  for (const m of css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) addRef(out, m[2]);
  for (const m of css.matchAll(/@import\s+(["'])([^"']+)\1/gi)) addRef(out, m[2]);
  return [...out];
}

/** Files the page refers to beside it: src, srcset, poster, link href, and url() in styles. Plain links (<a href>) do not count. */
export function references(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\s(src|poster|data)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) addRef(out, m[3] ?? m[4] ?? m[5] ?? '');
  for (const m of html.matchAll(/\ssrcset\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    for (const part of (m[2] ?? m[3] ?? '').split(',')) addRef(out, part.trim().split(/\s+/)[0] ?? '');
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const h = /\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[0]);
    if (h) addRef(out, h[2] ?? h[3] ?? h[4] ?? '');
  }
  for (const r of cssRefs(html)) out.add(r);
  return [...out];
}

/** A path relative to another file: ("css/site.css", "../img/a.png") -> "img/a.png". Null when it leaves the folder. */
export function resolveRel(fromPath: string, ref: string): string | null {
  if (!isRelativeRef(ref)) return null;
  const dir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : '';
  return safeRelPath(dir + ref.trim());
}

const baseOf = (p: string) => (p.split('/').pop() ?? p).toLowerCase();

export interface Placement {
  /** The picked file's name. */
  from: string;
  /** Where its copy goes inside the folder. */
  to: string;
}

/**
 * Where each file picked with the page goes, so the page's relative links
 * find them: a picked "logo.png" goes to "images/logo.png" when the page
 * asks for that (and to each path that asks for it), and a picked style
 * sheet's own pictures follow the style sheet's place. Anything nothing
 * asks for goes beside the page.
 */
export function planFolder(main: { name: string; refs: string[] }, companions: { name: string; refs?: string[] }[]): { main: string; placements: Placement[] } {
  const mainName = safeRelPath(main.name) ?? 'page.html';
  const wanted = new Map<string, string[]>();
  const want = (path: string) => {
    const k = baseOf(path);
    const list = wanted.get(k) ?? [];
    if (!list.includes(path)) list.push(path);
    wanted.set(k, list);
  };
  for (const r of main.refs) want(r);
  const used = new Set<string>([mainName.toLowerCase()]);
  const placements: Placement[] = [];
  const place = (from: string) => {
    const targets = (wanted.get(baseOf(from)) ?? []).filter((t) => !used.has(t.toLowerCase()));
    const to = targets.length > 0 ? targets : [safeRelPath(from.split('/').pop() ?? from) ?? 'file'];
    const done: string[] = [];
    for (const t of to) {
      let path = t;
      if (used.has(path.toLowerCase())) {
        const dot = path.lastIndexOf('.');
        let k = 2;
        while (used.has(path.toLowerCase())) path = dot > 0 ? `${t.slice(0, dot)} ${k++}${t.slice(dot)}` : `${t} ${k++}`;
      }
      used.add(path.toLowerCase());
      placements.push({ from, to: path });
      done.push(path);
    }
    return done;
  };
  // Style sheets first, so the pictures they ask for land where they look.
  const sheets = companions.filter((c) => extOf(c.name) === 'css');
  const rest = companions.filter((c) => extOf(c.name) !== 'css');
  for (const c of sheets) {
    for (const at of place(c.name)) for (const r of c.refs ?? []) {
      const p = resolveRel(at, r);
      if (p) want(p);
    }
  }
  for (const c of rest) place(c.name);
  return { main: mainName, placements };
}

export interface FolderFile {
  /** The path inside the file's folder, as placed. */
  path: string;
  base64: string;
  /** The text, for style sheets. */
  text?: string;
}

function dataUri(f: FolderFile): string {
  return `data:${mimeOf(f.path)};base64,${f.base64}`;
}

/** url(...) in a style sheet or style attribute, pointed at data URIs where the file is in the folder. */
export function inlineCssUrls(css: string, fromPath: string, files: Map<string, FolderFile>): string {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (whole, _q, ref) => {
    const p = resolveRel(fromPath, ref);
    const f = p ? files.get(p.toLowerCase()) : undefined;
    return f ? `url("${dataUri(f)}")` : whole;
  });
}

/**
 * The page with its pictures and style sheets from its folder inlined, and
 * its scripts taken out, for the PDF. Files is keyed by lower-case path.
 */
export function inlineForPrint(html: string, files: Map<string, FolderFile>, pagePath: string): string {
  const look = (ref: string) => {
    const p = resolveRel(pagePath, ref.replace(/&amp;/g, '&'));
    return p ? files.get(p.toLowerCase()) : undefined;
  };
  let out = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/<script\b[^>]*\/>/gi, '');
  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) return tag;
    const h = /\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const ref = h ? (h[2] ?? h[3] ?? h[4] ?? '') : '';
    const f = look(ref);
    if (!f || f.text == null) return tag;
    const at = resolveRel(pagePath, ref) ?? ref;
    return `<style>${inlineCssUrls(f.text, at, files).replace(/<\/style/gi, '<\\/style')}</style>`;
  });
  out = out.replace(/(\s(?:src|poster)\s*=\s*)("([^"]*)"|'([^']*)')/gi, (whole, pre, _v, a, b) => {
    const f = look(a ?? b ?? '');
    return f ? `${pre}"${dataUri(f)}"` : whole;
  });
  out = out.replace(/(\ssrcset\s*=\s*)("([^"]*)"|'([^']*)')/gi, (whole, pre, _v, a, b) => {
    const parts = (a ?? b ?? '').split(',').map((part: string) => {
      const [u, ...w] = part.trim().split(/\s+/);
      const f = look(u ?? '');
      return [f ? dataUri(f) : u, ...w].join(' ');
    });
    return `${pre}"${parts.join(', ')}"`;
  });
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (_w, open, css, close) => open + inlineCssUrls(css, pagePath, files) + close);
  out = out.replace(/(\sstyle\s*=\s*)("([^"]*)"|'([^']*)')/gi, (whole, pre, _v, a, b) => {
    const css = a ?? b ?? '';
    if (!/url\(/i.test(css)) return whole;
    return `${pre}"${inlineCssUrls(css, pagePath, files).replace(/"/g, '&quot;')}"`;
  });
  return out;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The page a PDF of a code or text file is made from: the file name, then the text in a fixed-width face, wrapped. */
export function sourcePrintHtml(text: string, name: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(cspFor({ scripts: false, remote: false, print: true }))}">`,
    '<style>body{margin:0;font:10.5px/1.5 Menlo,monospace;color:#111}h1{font:600 12px/1.4 -apple-system,sans-serif;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #ccc}pre{margin:0;white-space:pre-wrap;word-break:break-word;font:inherit}</style>',
    `</head><body><h1>${escapeHtml(name)}</h1><pre>${escapeHtml(text.replace(/\r\n?/g, '\n'))}</pre></body></html>`,
  ].join('');
}
