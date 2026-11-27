/**
 * Syntax coloring for the Source view: the text split into colored pieces,
 * then into lines. Pure, checked by `npm test`. Small hand-written
 * tokenizers for HTML (with the CSS and JavaScript inside it), CSS,
 * JavaScript, JSON, XML and SVG, and Markdown. They color; they do not
 * judge, so broken code still shows, plain.
 *
 * Joining every line's pieces with "\n" gives back the text exactly (with
 * \r\n and \r read as \n).
 */
import type { Lang } from './filetypes.ts';

export type TokenType = 'plain' | 'tag' | 'attr' | 'value' | 'comment' | 'keyword' | 'string' | 'number' | 'prop' | 'punct' | 'heading' | 'code' | 'entity';

export interface Token {
  t: TokenType;
  s: string;
}

/** Above this length the file shows plain, so a very large file still opens at once. */
export const MAX_COLORED = 400_000;

class Out {
  list: Token[] = [];
  push(t: TokenType, s: string) {
    if (!s) return;
    const last = this.list[this.list.length - 1];
    if (last && last.t === t) last.s += s;
    else this.list.push({ t, s });
  }
}

const JS_WORDS = new Set(
  'break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof undefined var void while with yield async await of static get set'.split(' ')
);

function jsInto(o: Out, src: string) {
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      const e = src.indexOf('\n', i);
      const end = e === -1 ? n : e;
      o.push('comment', src.slice(i, end));
      i = end;
    } else if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e === -1 ? n : e + 2;
      o.push('comment', src.slice(i, end));
      i = end;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n' && c !== '`') break;
        j++;
      }
      j = Math.min(n, j + 1);
      o.push('string', src.slice(i, j));
      i = j;
    } else if (/[0-9]/.test(c) || (c === '.' && d && /[0-9]/.test(d))) {
      const m = /^(0x[0-9a-f_]+|[0-9_]*\.?[0-9_]+(e[+-]?[0-9]+)?n?)/i.exec(src.slice(i, i + 40));
      const s = m ? m[0] : c;
      o.push('number', s);
      i += s.length;
    } else if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 200));
      const w = m ? m[0] : c;
      o.push(JS_WORDS.has(w) ? 'keyword' : 'plain', w);
      i += w.length;
    } else if (/[{}()[\];,.:?=+\-*/%<>!&|^~]/.test(c)) {
      o.push('punct', c);
      i++;
    } else {
      o.push('plain', c);
      i++;
    }
  }
}

function cssInto(o: Out, src: string) {
  let i = 0;
  const n = src.length;
  let depth = 0;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e === -1 ? n : e + 2;
      o.push('comment', src.slice(i, end));
      i = end;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      j = Math.min(n, j + 1);
      o.push('string', src.slice(i, j));
      i = j;
    } else if (c === '@') {
      const m = /^@[\w-]+/.exec(src.slice(i, i + 60));
      const s = m ? m[0] : c;
      o.push('keyword', s);
      i += s.length;
    } else if (c === '{' || c === '}') {
      depth += c === '{' ? 1 : -1;
      if (depth < 0) depth = 0;
      o.push('punct', c);
      i++;
    } else if (c === ':' || c === ';' || c === ',' || c === '(' || c === ')') {
      o.push('punct', c);
      i++;
    } else if (depth > 0 && /[A-Za-z-]/.test(c)) {
      const m = /^-?[A-Za-z_-][\w-]*/.exec(src.slice(i, i + 100));
      const w = m ? m[0] : c;
      // A name before ":" inside a block is a property; after it, a value.
      const rest = src.slice(i + w.length, i + w.length + 40);
      const isProp = /^\s*:/.test(rest) && !/^\s*:\s*[a-z-]+\s*[,{]/i.test(rest) && lastPunct(o) !== ':';
      o.push(isProp ? 'prop' : 'value', w);
      i += w.length;
    } else if (/[0-9#.]/.test(c) && depth > 0) {
      const m = /^(#[0-9a-f]{3,8}\b|-?[0-9]*\.?[0-9]+[a-z%]*)/i.exec(src.slice(i, i + 30));
      const s = m ? m[0] : c;
      o.push('number', s);
      i += s.length;
    } else if (depth === 0 && !/\s/.test(c)) {
      // Selectors.
      const m = /^[^{}/@'",\s]+/.exec(src.slice(i, i + 200));
      const s = m ? m[0] : c;
      o.push('tag', s);
      i += s.length;
    } else {
      o.push('plain', c);
      i++;
    }
  }
}

function lastPunct(o: Out): string | null {
  for (let k = o.list.length - 1; k >= 0; k--) {
    const t = o.list[k];
    if (t.t === 'plain' && !t.s.trim()) continue;
    return t.t === 'punct' ? t.s[t.s.length - 1] : null;
  }
  return null;
}

function jsonInto(o: Out, src: string) {
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"' && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      j = Math.min(n, j + 1);
      const s = src.slice(i, j);
      o.push(/^\s*:/.test(src.slice(j, j + 20)) ? 'prop' : 'string', s);
      i = j;
    } else if (/[-0-9]/.test(c)) {
      const m = /^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(src.slice(i, i + 40));
      const s = m ? m[0] : c;
      o.push('number', s);
      i += s.length;
    } else if (/[a-z]/.test(c)) {
      const m = /^[a-z]+/.exec(src.slice(i, i + 10));
      const w = m ? m[0] : c;
      o.push(w === 'true' || w === 'false' || w === 'null' ? 'keyword' : 'plain', w);
      i += w.length;
    } else if (/[{}[\]:,]/.test(c)) {
      o.push('punct', c);
      i++;
    } else {
      o.push('plain', c);
      i++;
    }
  }
}

/** HTML, XML and SVG. Script and style contents are colored as JavaScript and CSS. */
function markupInto(o: Out, src: string, html: boolean) {
  let i = 0;
  const n = src.length;
  while (i < n) {
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4);
      const end = e === -1 ? n : e + 3;
      o.push('comment', src.slice(i, end));
      i = end;
    } else if (src.startsWith('<![CDATA[', i)) {
      const e = src.indexOf(']]>', i);
      const end = e === -1 ? n : e + 3;
      o.push('string', src.slice(i, end));
      i = end;
    } else if (src[i] === '<' && /[!?]/.test(src[i + 1] ?? '')) {
      const e = src.indexOf('>', i);
      const end = e === -1 ? n : e + 1;
      o.push('keyword', src.slice(i, end));
      i = end;
    } else if (src[i] === '<' && /[A-Za-z/]/.test(src[i + 1] ?? '')) {
      const closing = src[i + 1] === '/';
      const m = /^<\/?([A-Za-z][\w:.-]*)/.exec(src.slice(i, i + 100));
      if (!m) {
        o.push('plain', '<');
        i++;
        continue;
      }
      const name = m[1].toLowerCase();
      o.push('tag', m[0]);
      i += m[0].length;
      // Attributes up to ">".
      while (i < n && src[i] !== '>') {
        const c = src[i];
        if (c === '"' || c === "'") {
          const e = src.indexOf(c, i + 1);
          const end = e === -1 ? n : e + 1;
          o.push('value', src.slice(i, end));
          i = end;
        } else if (c === '/' && src[i + 1] === '>') {
          o.push('tag', '/');
          i++;
        } else if (c === '=') {
          o.push('punct', '=');
          i++;
        } else if (/\s/.test(c)) {
          o.push('plain', c);
          i++;
        } else {
          const a = /^[^\s=>"'/]+/.exec(src.slice(i, i + 200));
          const s = a ? a[0] : c;
          // An unquoted value follows "=".
          const prev = o.list[o.list.length - 1];
          o.push(prev && prev.t === 'punct' && prev.s.endsWith('=') ? 'value' : 'attr', s);
          i += s.length;
        }
      }
      if (i < n) {
        o.push('tag', '>');
        i++;
      }
      if (!closing && (name === 'script' || name === 'style') && !/\/\s*>$/.test(lastTagText(o))) {
        const close = new RegExp(`</${name}\\s*>`, 'i');
        const rest = src.slice(i);
        const m2 = close.exec(rest);
        const body = m2 ? rest.slice(0, m2.index) : rest;
        if (name === 'script') jsInto(o, body);
        else cssInto(o, body);
        i += body.length;
      }
    } else if (src[i] === '&') {
      const m = /^&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/i.exec(src.slice(i, i + 40));
      if (m) {
        o.push('entity', m[0]);
        i += m[0].length;
      } else {
        o.push('plain', '&');
        i++;
      }
    } else {
      const next = src.slice(i).search(/[<&]/);
      const end = next === -1 ? n : i + Math.max(1, next);
      o.push('plain', src.slice(i, end));
      i = end;
    }
  }
  void html;
}

function lastTagText(o: Out): string {
  let s = '';
  for (let k = o.list.length - 1; k >= 0 && s.length < 400; k--) {
    s = o.list[k].s + s;
    if (o.list[k].t === 'tag' && o.list[k].s.startsWith('<')) break;
  }
  return s;
}

function mdInto(o: Out, src: string) {
  const lines = src.split('\n');
  let fenced = false;
  lines.forEach((line, k) => {
    if (k > 0) o.push('plain', '\n');
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      o.push('code', line);
      return;
    }
    if (fenced) return o.push('code', line);
    if (/^#{1,6}\s/.test(line)) return o.push('heading', line);
    if (/^\s*>/.test(line)) return o.push('comment', line);
    // Inline: code spans, links, emphasis markers.
    let i = 0;
    const m0 = /^(\s*([-*+]|\d+\.)\s)/.exec(line);
    if (m0) {
      o.push('punct', m0[0]);
      i = m0[0].length;
    }
    while (i < line.length) {
      const rest = line.slice(i);
      const code = /^`[^`]+`/.exec(rest);
      const link = /^!?\[[^\]]*\]\([^)]*\)/.exec(rest);
      const em = /^(\*\*|__|\*|_)/.exec(rest);
      if (code) {
        o.push('code', code[0]);
        i += code[0].length;
      } else if (link) {
        o.push('value', link[0]);
        i += link[0].length;
      } else if (em) {
        o.push('keyword', em[0]);
        i += em[0].length;
      } else {
        const nx = rest.slice(1).search(/[`![*_]/);
        const len = nx === -1 ? rest.length : nx + 1;
        o.push('plain', rest.slice(0, len));
        i += len;
      }
    }
  });
}

/** The text as colored pieces, in order. Line endings are read as \n. */
export function tokenize(text: string, lang: Lang): Token[] {
  const src = text.replace(/\r\n?/g, '\n');
  const o = new Out();
  if (src.length > MAX_COLORED || lang === 'text') o.push('plain', src);
  else if (lang === 'html') markupInto(o, src, true);
  else if (lang === 'xml') markupInto(o, src, false);
  else if (lang === 'css') cssInto(o, src);
  else if (lang === 'js') jsInto(o, src);
  else if (lang === 'json') jsonInto(o, src);
  else if (lang === 'md') mdInto(o, src);
  else o.push('plain', src);
  return o.list;
}

/** The pieces split at line breaks: one array of pieces per line. */
export function tokensToLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const tok of tokens) {
    const parts = tok.s.split('\n');
    parts.forEach((p, k) => {
      if (k > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ t: tok.t, s: p });
    });
  }
  return lines;
}

/** Colored lines for the Source view. */
export function colorLines(text: string, lang: Lang): Token[][] {
  return tokensToLines(tokenize(text, lang));
}

export interface Painted extends Token {
  /** 0 not a match, 1 a match, 2 the current match. */
  mark: 0 | 1 | 2;
}

/**
 * One line's pieces cut at the find matches on that line, so a match can
 * be painted across colored pieces. Marks are [start, end) offsets in the
 * line; current is the index (into marks) of the current match, or -1.
 */
export function paintLine(tokens: Token[], marks: { start: number; end: number }[], current = -1): Painted[] {
  if (marks.length === 0) return tokens.map((t) => ({ ...t, mark: 0 }));
  const out: Painted[] = [];
  let at = 0;
  for (const tok of tokens) {
    const end = at + tok.s.length;
    let i = at;
    while (i < end) {
      const k = marks.findIndex((m) => m.end > i && m.start < end && m.start <= i);
      if (k !== -1) {
        const stop = Math.min(end, marks[k].end);
        out.push({ t: tok.t, s: tok.s.slice(i - at, stop - at), mark: k === current ? 2 : 1 });
        i = stop;
      } else {
        const next = marks.filter((m) => m.start > i && m.start < end).reduce((min, m) => Math.min(min, m.start), end);
        out.push({ t: tok.t, s: tok.s.slice(i - at, next - at), mark: 0 });
        i = next;
      }
    }
    at = end;
  }
  return out;
}
