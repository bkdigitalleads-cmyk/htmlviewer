// Unit checks for the viewer's pure logic: file type detection, safe file
// names, reading bytes, source line splitting and coloring, find, the page
// copy (scripts, web content, find marks, viewport, dark page), the link
// rules, the folder plan for files picked together, and the PDF copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../src/filetypes.ts');
const N = await import('../src/names.ts');
const X = await import('../src/text.ts');
const F = await import('../src/find.ts');
const H = await import('../src/highlight.ts');
const P = await import('../src/page.ts');
const V = await import('../src/nav.ts');
const U = await import('../src/undo.ts');

const enc = (s) => new TextEncoder().encode(s);

// ---------- file types ----------

test('file types: the ten from the brief, HTML and SVG open in Preview, the rest in Source', () => {
  const want = { html: 'html', htm: 'html', xhtml: 'html', txt: 'txt', css: 'css', js: 'js', json: 'json', xml: 'xml', svg: 'svg', md: 'md' };
  for (const [ext, kind] of Object.entries(want)) {
    assert.equal(T.kindOf(`file.${ext}`), kind, ext);
    assert.equal(T.kindOf(`FILE.${ext.toUpperCase()}`), kind, `${ext} in capitals`);
    assert.equal(T.typeInfo(kind).opensIn, kind === 'html' || kind === 'svg' ? 'preview' : 'source', ext);
  }
  assert.equal(T.kindOf('statement.html.txt'), 'txt', 'the last extension wins');
  assert.equal(T.kindOf('README'), null);
  assert.equal(T.kindOf('.html'), null, 'a hidden name has no extension');
  assert.equal(T.kindOf('photo.png'), null);
  assert.equal(T.extOf('/a/b.c/page.HTM'), 'htm');
});

test('file types: .mht and web archives are refused with a reason; unknown text opens as text; binaries are refused', () => {
  assert.match(T.classify('page.mht', enc('MIME-Version: 1.0')).refuse, /MHT files do not open here/);
  assert.match(T.classify('page.MHTML', enc('x')).refuse, /MHT/);
  assert.match(T.classify('page.webarchive', enc('bplist00')).refuse, /Web archives/);
  assert.deepEqual(T.classify('notes.log', enc('line one\nline two\n')), { kind: 'txt' });
  assert.deepEqual(T.classify('page.html', new Uint8Array([0, 1, 2])), { kind: 'html' }, 'a known extension opens whatever its bytes');
  assert.equal(T.classify('photo.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 13])).refuse, T.NOT_TEXT);
  assert.ok(T.looksLikeText(new Uint8Array([0xff, 0xfe, 0x3c, 0x00])), 'UTF-16 with a byte order mark is text');
  assert.ok(T.looksLikeText(new Uint8Array([])));
});

test('file types: pasted code is recognized', () => {
  assert.equal(T.sniffKind('<!DOCTYPE html><html><body>x</body></html>'), 'html');
  assert.equal(T.sniffKind('  <div class="a"><p>Hi</p></div>'), 'html');
  assert.equal(T.sniffKind('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'svg');
  assert.equal(T.sniffKind('<svg viewBox="0 0 1 1"/>'), 'svg');
  assert.equal(T.sniffKind('{"a": [1, 2, {"b": null}]}'), 'json');
  assert.equal(T.sniffKind('{ not json'), 'txt');
  assert.equal(T.sniffKind('<?xml version="1.0"?><note><to>A</to></note>'), 'xml');
  assert.equal(T.sniffKind('body { color: red; }\n.a { margin: 0 }'), 'css');
  assert.equal(T.sniffKind('const a = 1;\nfunction f() { return a; }'), 'js');
  assert.equal(T.sniffKind('# Title\n\nSome text.'), 'md');
  assert.equal(T.sniffKind('Just a note.'), 'txt');
  assert.equal(T.pasteName('html'), 'Pasted code.html');
  assert.equal(T.pasteName('txt'), 'Pasted code.txt');
});

// ---------- names ----------

test('safe file names: one path part, no reserved or control characters, no leading dots, length kept with the extension', () => {
  assert.equal(N.safeFileName('file:///private/var/mobile/Containers/Data/Application/X/Documents/Inbox/My%20Statement%20(1).html'), 'My Statement (1).html');
  assert.equal(N.safeFileName('../../etc/passwd'), 'passwd');
  assert.equal(N.safeFileName('a\\b\\c.html'), 'c.html');
  assert.equal(N.safeFileName('re: what?*.html'), 're what .html');
  assert.equal(N.safeFileName('.hidden.html'), 'hidden.html', 'no hidden files, never an .hv- working file');
  assert.equal(N.safeFileName('.hv-view-1.html'), 'hv-view-1.html');
  assert.equal(N.safeFileName('bad\u0000name\u001f.htm'), 'badname.htm');
  assert.equal(N.safeFileName('   '), 'file.html');
  assert.equal(N.safeFileName('..'), 'file.html');
  assert.equal(N.safeFileName('', 'Pasted code.txt'), 'Pasted code.txt');
  assert.equal(N.safeFileName('100%25 done.html'), '100% done.html');
  assert.equal(N.safeFileName('bad%E0%A4%A.html'), 'bad%E0%A4%A.html', 'a broken escape stays as typed');
  const long = N.safeFileName(`${'x'.repeat(300)}.html`);
  assert.equal(long.length, 80);
  assert.ok(long.endsWith('.html'));
  assert.equal(N.safeFileName('trailing dots...'), 'trailing dots');
});

test('safe names: relative paths stay inside the folder; names never collide; PDF and copy names', () => {
  assert.equal(N.safeRelPath('images/logo.png'), 'images/logo.png');
  assert.equal(N.safeRelPath('./css/../css/site.css?v=3#x'), 'css/site.css');
  assert.equal(N.safeRelPath('../secret.txt'), null);
  assert.equal(N.safeRelPath('a/../../b'), null);
  assert.equal(N.safeRelPath('img%20dir/a%20b.png'), 'img dir/a b.png');
  assert.equal(N.safeRelPath('a/b/c/d/e/f/g.png'), null, 'not too deep');
  assert.equal(N.uniqueName('page.html', ['Page.HTML', 'page 2.html']), 'page 3.html');
  assert.equal(N.uniqueName('page.html', []), 'page.html');
  assert.equal(N.pdfName('statement.html'), 'statement.pdf');
  assert.equal(N.pdfName('README'), 'README.pdf');
  assert.equal(N.copyName('statement.html', ['statement copy.html']), 'statement copy 2.html');
  assert.ok(N.isWorkingFile('.hv-view-2.html'));
  assert.ok(!N.isWorkingFile('view.html'));
});

// ---------- bytes and lines ----------

test('reading bytes: UTF-8 with and without a byte order mark, UTF-16 both ways, and older Western text', () => {
  assert.deepEqual(X.decodeBytes(enc('Café ✓ 😀')), { text: 'Café ✓ 😀', encoding: 'utf-8' });
  assert.equal(X.decodeBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])).text, 'A');
  assert.deepEqual(X.decodeBytes(new Uint8Array([0xff, 0xfe, 0x48, 0, 0x69, 0])), { text: 'Hi', encoding: 'utf-16le' });
  assert.deepEqual(X.decodeBytes(new Uint8Array([0xfe, 0xff, 0, 0x48, 0, 0x69])), { text: 'Hi', encoding: 'utf-16be' });
  const w = X.decodeBytes(new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x20, 0x80, 0x93, 0x94]));
  assert.equal(w.encoding, 'windows-1252');
  assert.equal(w.text, 'Café €“”');
  assert.equal(X.utf8(new Uint8Array([0xc0, 0x80])), null, 'overlong is not UTF-8');
  assert.equal(X.utf8(new Uint8Array([0xe2, 0x82])), null, 'cut short is not UTF-8');
  const big = 'a'.repeat(100_000) + 'é';
  assert.equal(X.decodeBytes(enc(big)).text, big, 'long files decode');
});

test('source lines: every kind of line ending, empty lines kept, an empty file is one line', () => {
  assert.deepEqual(X.splitLines('a\r\nb\rc\nd'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(X.splitLines('a\n\nb\n'), ['a', '', 'b', '']);
  assert.deepEqual(X.splitLines(''), ['']);
  assert.equal(X.sizeLabel(820), '820 bytes');
  assert.equal(X.sizeLabel(12_400), '12 KB');
  assert.equal(X.sizeLabel(1_400_000), '1.4 MB');
});

// ---------- coloring ----------

const joinLines = (lines) => lines.map((l) => l.map((t) => t.s).join('')).join('\n');

test('coloring: the lines give back the text exactly, for every language', () => {
  const samples = {
    html: '<!doctype html>\n<html>\n<head><style>\n  body { color: red; }\n</style>\n<script>\n  const a = "x"; // note\n</script></head>\n<body class="a" data-x=1>\n  <p>Tom &amp; Jerry</p>\n  <!-- a\n  comment -->\n</body>\n</html>',
    css: '/* c */\n@media (max-width: 600px) {\n  .a, h1 > b { margin: 0 auto; color: #fff; }\n}\n',
    js: 'import x from "y";\nconst n = 0x1F + 2.5e3;\nfunction f(a) { return `t ${a}`; } /* end */\n',
    json: '{\n  "name": "a",\n  "n": -1.5e2,\n  "ok": true,\n  "list": [null]\n}',
    xml: '<?xml version="1.0"?>\n<note a=\'1\'><![CDATA[ <x> ]]></note>',
    md: '# Title\n\nSome *em* and `code` and [a link](x.html).\n\n```\nfenced\n```\n- item',
    text: 'plain\ttext\n\nend',
  };
  for (const [lang, src] of Object.entries(samples)) {
    const lines = H.colorLines(src, lang);
    assert.equal(joinLines(lines), src, lang);
    assert.equal(lines.length, src.split('\n').length, `${lang} line count`);
  }
  assert.equal(joinLines(H.colorLines('a\r\nb', 'text')), 'a\nb');
});

test('coloring: tags, attributes, values, comments, keywords and strings are told apart', () => {
  const kinds = (src, lang) => H.tokenize(src, lang).map((t) => `${t.t}:${t.s}`);
  const html = kinds('<a href="x.html">Go</a>', 'html');
  assert.ok(html.includes('tag:<a'));
  assert.ok(html.includes('attr:href'));
  assert.ok(html.includes('value:"x.html"'));
  assert.ok(html.includes('plain:Go'));
  assert.ok(kinds('<!-- hi -->', 'html').includes('comment:<!-- hi -->'));
  const js = kinds('const a = "s"; // c', 'js');
  assert.ok(js.includes('keyword:const') && js.includes('string:"s"') && js.includes('comment:// c'));
  const css = kinds('a { color: red; }', 'css');
  assert.ok(css.includes('tag:a') && css.includes('prop:color') && css.includes('value:red'));
  const json = kinds('{"k": 1}', 'json');
  assert.ok(json.includes('prop:"k"') && json.includes('number:1'));
  const inScript = kinds('<script>if (a) {}</script>', 'html');
  assert.ok(inScript.includes('keyword:if'), 'the script inside a page is colored as JavaScript');
  const big = 'x'.repeat(H.MAX_COLORED + 1);
  assert.deepEqual(H.tokenize(big, 'html'), [{ t: 'plain', s: big }], 'a very large file shows plain');
});

// ---------- find ----------

test('find: every match, any case, never overlapping; by line for Source; next and previous wrap', () => {
  assert.deepEqual(F.findAll('Total total TOTAL', 'total'), [{ start: 0, end: 5 }, { start: 6, end: 11 }, { start: 12, end: 17 }]);
  assert.deepEqual(F.findAll('aaaa', 'aa'), [{ start: 0, end: 2 }, { start: 2, end: 4 }]);
  assert.deepEqual(F.findAll('abc', ''), []);
  assert.equal(F.findAll('x'.repeat(5000), 'x').length, F.MAX_MATCHES);
  assert.deepEqual(F.findInLines(['<p>Hi</p>', '', 'hi there'], 'hi'), [{ line: 0, start: 3, end: 5 }, { line: 2, start: 0, end: 2 }]);
  assert.equal(F.stepMatch(2, 3, 1), 0);
  assert.equal(F.stepMatch(0, 3, -1), 2);
  assert.equal(F.stepMatch(-1, 3, 1), 0);
  assert.equal(F.stepMatch(0, 0, 1), -1);
  assert.equal(F.matchLabel(2, 12, 'a'), '3 of 12');
  assert.equal(F.matchLabel(-1, 0, 'a'), 'No matches');
  assert.equal(F.matchLabel(0, 0, ''), '');
  assert.equal(F.lineAt('a\nb\r\nc\rd', 7), 3);
});

test('replace (Pro, in the editor): one at a time or all at once', () => {
  assert.deepEqual(F.replaceOne('a cat sat', { start: 2, end: 5 }, 'dog'), { text: 'a dog sat', caret: 5 });
  assert.deepEqual(F.replaceAll('Cat cat CAT', 'cat', 'dog'), { text: 'dog dog dog', count: 3 });
  assert.deepEqual(F.replaceAll('abc', 'x', 'y'), { text: 'abc', count: 0 });
});

// ---------- the page copy ----------

const csp = (html) => /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1].replace(/&#39;|&apos;/g, "'");

test('page copy: scripts off means script-src none; on adds inline scripts; web content only when on; never forms, plugins or <base>', () => {
  const off = P.cspFor({ scripts: false, remote: false });
  assert.match(off, /script-src 'none'/);
  assert.match(off, /img-src file: data: blob:;/);
  assert.ok(!/https?:/.test(off), 'nothing from the web');
  assert.match(off, /connect-src 'none'/);
  assert.match(off, /form-action 'none'/);
  assert.match(off, /object-src 'none'/);
  assert.match(off, /base-uri 'none'/);
  assert.match(off, /^default-src 'none'/);
  const on = P.cspFor({ scripts: true, remote: false });
  assert.match(on, /script-src file: 'unsafe-inline' 'unsafe-eval';/);
  const web = P.cspFor({ scripts: false, remote: true });
  assert.match(web, /img-src file: data: blob: https: http:/);
  assert.match(web, /script-src 'none'/, 'web content does not turn scripts on');
  const print = P.cspFor({ scripts: true, remote: false, print: true });
  assert.ok(!/file:/.test(print), 'the PDF copy loads no local files at all');
  assert.match(print, /script-src 'none'/);
});

test('page copy: the head block goes first in <head>, says UTF-8 once, keeps pinch to zoom, adds text size and the dark page', () => {
  const src = '<!DOCTYPE html><html><head><meta charset="windows-1252"><meta name="viewport" content="width=device-width, user-scalable=no, maximum-scale=1"><title>T</title></head><body><p>x</p></body></html>';
  const { html } = P.pageCopy(src, { scripts: false, remote: false, dark: true, scale: 1.3 });
  assert.ok(html.startsWith('<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy"'));
  assert.equal(html.match(/charset/gi).length, 1, 'one charset');
  assert.match(html, /<meta name="viewport" content="width=device-width">/);
  assert.ok(!/user-scalable|maximum-scale/.test(html));
  assert.match(html, /html\{zoom:1\.3\}/);
  assert.match(html, /filter:invert\(1\) hue-rotate\(180deg\)/);
  assert.match(html, /<body><p>x<\/p><\/body>/, 'the page itself is unchanged');
  const bare = P.pageCopy('<p>Just text</p>', { scripts: false, remote: false, dark: false, scale: 1 }).html;
  assert.ok(bare.startsWith('<meta charset="utf-8">'));
  assert.match(bare, /<meta name="viewport" content="width=device-width, initial-scale=1">/, 'a viewport when the page has none');
  assert.ok(!/zoom|invert/.test(bare));
  assert.equal(P.headAt('<!doctype html><p>a'), '<!doctype html>'.length);
  assert.equal(P.headAt('<html lang="en"><body>'), '<html lang="en">'.length);
  assert.equal(P.relaxViewport('initial-scale=1, user-scalable=0'), 'width=device-width, initial-scale=1');
});

test('find in page: matches in the text people read are marked, entities and spaces read as shown; not in tags, scripts, styles or titles', () => {
  const src = '<html><head><title>Tom</title><style>.tom{}</style></head><body><p class="tom">Tom &amp;   Jerry</p><script>var tom</script><p>tom<b>my</b> TOM</p></body></html>';
  const { html, count } = P.markFind(src, 'tom');
  assert.equal(count, 3);
  assert.match(html, /<title>Tom<\/title>/);
  assert.match(html, /\.tom\{\}/);
  assert.match(html, /class="tom"/);
  assert.match(html, /var tom/);
  assert.match(html, /<mark class="hv-find" id="hv-find-0">Tom<\/mark> &amp;/);
  assert.match(html, /<mark class="hv-find" id="hv-find-2">TOM<\/mark>/);
  const amp = P.markFind('<p>Tom &amp; Jerry</p>', 'tom & jerry');
  assert.equal(amp.count, 1);
  assert.equal(amp.html, '<p><mark class="hv-find" id="hv-find-0">Tom &amp; Jerry</mark></p>', 'the entity stays whole inside the mark');
  assert.equal(P.markFind('<p>a\n   b</p>', 'a b').count, 1, 'white space reads as one space');
  assert.equal(P.markFind('<p>x</p>', '').count, 0);
  assert.equal(P.markFind('<svg><text>tom</text></svg><p>tom</p>', 'tom').count, 1, 'not inside SVG');
  assert.equal(P.markFind('<p title="a > tom">b</p>', 'tom').count, 0, 'a ">" inside an attribute is not text');
  assert.equal(P.findFragment(4), 'hv-find-4');
  const page = P.pageCopy('<body><p>tom</p></body>', { scripts: false, remote: false, dark: false, scale: 1, find: 'tom' });
  assert.equal(page.count, 1);
  assert.match(page.html, /mark\.hv-find:target/);
});

test('page copy: scripts and web content are noticed, so the one-line reason shows only when it matters', () => {
  assert.ok(P.hasScripts('<script>1</script>'));
  assert.ok(P.hasScripts('<button onclick="x()">'));
  assert.ok(P.hasScripts('<a href="javascript:void 0">'));
  assert.ok(!P.hasScripts('<p>The word onclick</p> description'));
  assert.ok(P.hasRemote('<img src="https://example.com/a.png">'));
  assert.ok(P.hasRemote('<link rel="stylesheet" href="//cdn.example.com/a.css">'));
  assert.ok(P.hasRemote('<div style="background:url(https://x/y.png)">'));
  assert.ok(!P.hasRemote('<a href="https://example.com">link</a><img src="a.png">'), 'a plain link loads nothing');
});

test('SVG preview: the picture is shown as an image, so its own scripts never run', () => {
  const html = P.svgPage('chart%201.svg', { scripts: true, remote: true, dark: false, scale: 1 });
  assert.match(html, /<img src="chart%201\.svg"/);
  assert.match(csp(html), /script-src 'none'/);
  assert.ok(!/https?:/.test(csp(html)));
});

// ---------- links ----------

test('links: web links open in the browser on a tap only; sibling files open in the viewer; nothing outside the folder; no redirects', () => {
  const ctx = { pageUrl: 'file:///app/Documents/library/a1/.hv-view-1.html', folderUrl: 'file:///app/Documents/library/a1/', remote: false };
  const c = (url, navigationType = 'click', isTopFrame = true, more = {}) => V.classifyNav({ url, navigationType, isTopFrame }, { ...ctx, ...more });
  assert.deepEqual(c('https://example.com/x'), { action: 'browser', url: 'https://example.com/x' });
  assert.deepEqual(c('https://example.com/x', 'other'), { action: 'block' }, 'a redirect or script never leaves');
  assert.deepEqual(c('https://example.com/x', 'formsubmit'), { action: 'block' });
  assert.deepEqual(c('mailto:a@example.com'), { action: 'system', url: 'mailto:a@example.com' });
  assert.deepEqual(c('tel:5551234', 'other'), { action: 'block' });
  assert.deepEqual(c('file:///app/Documents/library/a1/.hv-view-1.html', 'other'), { action: 'allow' }, 'the page itself loads');
  assert.deepEqual(c('file:///app/Documents/library/a1/.hv-view-1.html#part-2'), { action: 'allow' }, 'anchors scroll in place');
  assert.deepEqual(c('file:///app/Documents/library/a1/about%20us.html'), { action: 'sibling', path: 'about us.html' });
  assert.deepEqual(c('file:///app/Documents/library/a1/pages/two.htm'), { action: 'sibling', path: 'pages/two.htm' });
  assert.deepEqual(c('file:///app/Documents/library/a1/two.html', 'other'), { action: 'block' }, 'a page cannot move itself');
  assert.deepEqual(c('file:///app/Documents/library/a1/photo.png'), { action: 'block' });
  assert.deepEqual(c('file:///app/Documents/library/b2/other.html'), { action: 'block' }, 'another file folder');
  assert.deepEqual(c('file:///app/Documents/library/a1/../b2/x.html'), { action: 'block' });
  assert.deepEqual(c('file:///app/Library/x.html'), { action: 'block' });
  assert.deepEqual(c('file:///app/Documents/library/a1/frame.html', 'other', false), { action: 'allow' }, 'a frame from the same folder');
  assert.deepEqual(c('https://video.example.com/embed', 'other', false), { action: 'block' }, 'a web frame with web content off');
  assert.deepEqual(c('https://video.example.com/embed', 'other', false, { remote: true }), { action: 'allow' });
  assert.deepEqual(c('javascript:alert(1)'), { action: 'block' });
  assert.deepEqual(c('data:text/html,<p>x'), { action: 'block' });
  assert.deepEqual(c('about:blank', 'other'), { action: 'allow' });
});

// ---------- files picked together ----------

test('references: what the page loads from beside it, not web addresses, data, anchors or plain links', () => {
  const html = `<link rel="stylesheet" href="css/site.css?v=2"><link rel=icon href=favicon.ico>
    <img src="images/logo.png"><img src='https://x/y.png'><img src="data:image/png;base64,AA">
    <img srcset="a.png 1x, b@2x.png 2x"><a href="page2.html">two</a><a href="#top">top</a>
    <div style="background:url('bg.jpg')"></div><style>@import "more.css"; .x{background:url(img/x.svg)}</style>
    <script src="js/app.js"></script><img src="/root.png"><img src="//cdn/x.png"><img src="{{tpl}}">`;
  assert.deepEqual(P.references(html).sort(), ['a.png', 'b@2x.png', 'bg.jpg', 'css/site.css', 'favicon.ico', 'images/logo.png', 'img/x.svg', 'js/app.js', 'more.css'].sort());
  assert.deepEqual(P.cssRefs('a{background:url("../img/a.png")} @import \'b.css\';').sort(), ['b.css'].sort(), 'a path that climbs out is dropped');
  assert.equal(P.resolveRel('css/site.css', '../img/a.png'), 'img/a.png');
  assert.equal(P.resolveRel('site.css', 'img/a.png'), 'img/a.png');
  assert.equal(P.resolveRel('a.css', '../../x.png'), null);
  assert.equal(P.resolveRel('a.css', 'https://x/y.png'), null);
});

test('files picked together land where the page looks for them, style sheets first so their pictures follow', () => {
  const plan = P.planFolder(
    { name: 'report.html', refs: ['css/site.css', 'images/logo.png', 'images/chart.svg', 'thumbs/logo.png'] },
    [{ name: 'logo.png' }, { name: 'site.css', refs: ['../fonts/body.woff2', 'bg.jpg'] }, { name: 'body.woff2' }, { name: 'bg.jpg' }, { name: 'notes.txt' }, { name: 'report.html' }]
  );
  assert.equal(plan.main, 'report.html');
  const to = (from) => plan.placements.filter((p) => p.from === from).map((p) => p.to);
  assert.deepEqual(to('site.css'), ['css/site.css']);
  assert.deepEqual(to('logo.png'), ['images/logo.png', 'thumbs/logo.png'], 'a picture asked for in two places goes to both');
  assert.deepEqual(to('body.woff2'), ['fonts/body.woff2'], 'relative to the style sheet');
  assert.deepEqual(to('bg.jpg'), ['css/bg.jpg']);
  assert.deepEqual(to('notes.txt'), ['notes.txt'], 'what nothing asks for goes beside the page');
  assert.deepEqual(to('report.html'), ['report 2.html'], 'never over the main file');
});

test('the PDF copy: pictures and styles from the folder inlined, scripts taken out', () => {
  const files = new Map([
    ['css/site.css', { path: 'css/site.css', base64: '', text: 'body{background:url(../img/bg.png)} h1{color:red}' }],
    ['img/bg.png', { path: 'img/bg.png', base64: 'QkJC' }],
    ['images/logo.png', { path: 'images/logo.png', base64: 'TE9HTw==' }],
  ]);
  const html = '<head><link rel="stylesheet" href="css/site.css"><script src="app.js"></script></head><body><img src="images/logo.png"><img src="missing.png"><script>alert(1)</script><div style="background:url(images/logo.png)"></div></body>';
  const out = P.inlineForPrint(html, files, 'page.html');
  assert.ok(!/<script/i.test(out));
  assert.match(out, /<style>body\{background:url\("data:image\/png;base64,QkJC"\)\} h1\{color:red\}<\/style>/);
  assert.match(out, /<img src="data:image\/png;base64,TE9HTw==">/);
  assert.match(out, /<img src="missing\.png">/, 'what is not in the folder stays as it was');
  assert.match(out, /style="background:url\(&quot;data:image\/png;base64,TE9HTw==&quot;\)"/);
});

// ---------- editor ----------

test('editor: typing groups into one undo step, a pause or paste starts a new one; undo and redo walk both ways', () => {
  let h = U.EMPTY_HISTORY;
  const s = (text) => ({ text, sel: { start: text.length, end: text.length } });
  h = U.record(h, s(''), 1000, true);
  h = U.record(h, s('a'), 1200, true);
  h = U.record(h, s('ab'), 1300, true);
  assert.equal(h.past.length, 1, 'quick typing is one step');
  h = U.record(h, s('abc'), 5000, true);
  assert.equal(h.past.length, 2, 'after a pause, a new step');
  h = U.record(h, s('abcd'), 5100, false);
  assert.equal(h.past.length, 3, 'a paste is its own step');
  const u1 = U.undo(h, s('abcd pasted'));
  assert.equal(u1.snap.text, 'abcd');
  const r1 = U.redo(u1.h, u1.snap);
  assert.equal(r1.snap.text, 'abcd pasted');
  assert.equal(U.undo(U.EMPTY_HISTORY, s('x')), null);
  assert.equal(U.redo(U.EMPTY_HISTORY, s('x')), null);
  let big = U.EMPTY_HISTORY;
  for (let i = 0; i < 300; i++) big = U.record(big, s(String(i)), i * 10_000, false);
  assert.equal(big.past.length, U.MAX_STEPS);
});

test('editor: the code keys type at the caret or over the selection', () => {
  assert.deepEqual(U.insertAt('<p></p>', { start: 3, end: 3 }, 'Hi'), { text: '<p>Hi</p>', sel: { start: 5, end: 5 } });
  assert.deepEqual(U.insertAt('abc', { start: 1, end: 2 }, '='), { text: 'a=c', sel: { start: 2, end: 2 } });
  assert.deepEqual(U.insertAt('abc', { start: 99, end: 99 }, '>'), { text: 'abc>', sel: { start: 4, end: 4 } });
  assert.equal(U.CODE_KEYS[0].insert, '  ', 'Tab is two spaces');
  for (const k of ['<', '>', '/', '=', '"', "'", '{', '}', ';']) assert.ok(U.CODE_KEYS.some((c) => c.insert === k), k);
  assert.ok(U.isSmallEdit('ab', 'abc'));
  assert.ok(!U.isSmallEdit('ab', 'ab pasted'));
});

test('source find: a match is painted across colored pieces, the current one apart from the rest', () => {
  const toks = H.tokenize('<a href="x">', 'html');
  const painted = H.paintLine(toks, [{ start: 1, end: 7 }, { start: 9, end: 10 }], 1);
  assert.equal(painted.map((p) => p.s).join(''), '<a href="x">', 'nothing lost');
  assert.deepEqual(painted.filter((p) => p.mark === 1).map((p) => p.s).join(''), 'a href');
  assert.deepEqual(painted.filter((p) => p.mark === 2).map((p) => p.s), ['x']);
  assert.ok(painted.some((p) => p.mark === 1 && p.t === 'tag') && painted.some((p) => p.mark === 1 && p.t === 'attr'), 'the colors stay under the mark');
  assert.deepEqual(H.paintLine([{ t: 'plain', s: 'abc' }], []), [{ t: 'plain', s: 'abc', mark: 0 }]);
});

test('a PDF of a code or text file: the name, then the text escaped, so nothing in it runs or loads', () => {
  const html = P.sourcePrintHtml('<script>alert(1)</script>\r\n<img src=x onerror=y>', 'a<b>.js');
  assert.match(html, /<h1>a&lt;b&gt;\.js<\/h1>/);
  assert.match(html, /<pre>&lt;script&gt;alert\(1\)&lt;\/script&gt;\n&lt;img src=x onerror=y&gt;<\/pre>/);
  assert.ok(!/<script>/.test(html));
  assert.match(csp(html), /script-src 'none'/);
  assert.ok(!/file:/.test(csp(html)));
});
