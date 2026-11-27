/**
 * Bytes to text, and text to lines. Pure, checked by `npm test`.
 *
 * Files arrive in UTF-8 most of the time, sometimes UTF-16 (with a byte
 * order mark) or an older Western encoding (windows-1252). The app reads
 * them all to one string and writes its own copies as UTF-8.
 */

export type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';

const CP1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030,
  0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

/** Builds a string from code points in chunks (long files would overflow fromCharCode's arguments). */
function fromCodes(codes: number[]): string {
  let s = '';
  for (let i = 0; i < codes.length; i += 8192) s += String.fromCharCode(...codes.slice(i, i + 8192));
  return s;
}

/** Strict UTF-8: null when the bytes are not valid UTF-8. */
export function utf8(bytes: Uint8Array, from = 0): string | null {
  const out: number[] = [];
  let i = from;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      out.push(b);
      i++;
      continue;
    }
    let need = 0;
    let cp = 0;
    if (b >= 0xc2 && b <= 0xdf) (need = 1), (cp = b & 0x1f);
    else if (b >= 0xe0 && b <= 0xef) (need = 2), (cp = b & 0x0f);
    else if (b >= 0xf0 && b <= 0xf4) (need = 3), (cp = b & 0x07);
    else return null;
    for (let k = 1; k <= need; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    if ((need === 2 && cp < 0x800) || (need === 3 && (cp < 0x10000 || cp > 0x10ffff)) || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    if (cp >= 0x10000) {
      const v = cp - 0x10000;
      out.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    } else out.push(cp);
    i += need + 1;
  }
  return fromCodes(out);
}

function utf16(bytes: Uint8Array, little: boolean): string {
  const codes: number[] = [];
  for (let i = 2; i + 1 < bytes.length; i += 2) codes.push(little ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
  return fromCodes(codes);
}

function cp1252(bytes: Uint8Array): string {
  const codes: number[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) codes[i] = CP1252[bytes[i]] ?? bytes[i];
  return fromCodes(codes);
}

/** The file's text and the encoding it was read as. Never throws. */
export function decodeBytes(bytes: Uint8Array): { text: string; encoding: Encoding } {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return { text: utf16(bytes, true), encoding: 'utf-16le' };
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return { text: utf16(bytes, false), encoding: 'utf-16be' };
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const u = utf8(bytes, bom ? 3 : 0);
  if (u != null) return { text: u, encoding: 'utf-8' };
  return { text: cp1252(bytes), encoding: 'windows-1252' };
}

/** Lines, whatever the line endings (\r\n, \r or \n). An empty file is one empty line. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

/** "12 KB", "1.4 MB", "820 bytes". */
export function sizeLabel(bytes: number): string {
  if (!(bytes >= 0)) return '';
  if (bytes < 1000) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
