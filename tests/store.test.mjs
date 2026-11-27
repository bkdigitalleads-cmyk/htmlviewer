// Unit checks for what goes to the App Store and the website: names,
// subtitles and keywords in both listings, the promotional text, the
// description's order, the review note, the screenshot plan, the product
// ids, the privacy label, and the website pages with the FAQ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const meta = readFileSync(`${ROOT}store/metadata.md`, 'utf8');
const section = (h) => meta.split(/\n## /).find((s) => s.startsWith(h)).split('\n').slice(1).join('\n').trim();
const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const site = (f) => readFileSync(`${ROOT}docs/${f}`, 'utf8');

test('English name, subtitle and keywords as briefed: 24, 29 and 95, no word from the name or subtitle, no repeats', () => {
  const name = section('Name').split('\n')[0];
  const sub = section('Subtitle').split('\n')[0];
  assert.equal(name, 'HTML Viewer: Code Editor');
  assert.equal(sub, 'Text Editor, View Page Source');
  assert.equal(name.length, 24);
  assert.equal(sub.length, 29);
  assert.match(meta, /## Name \(24\/30\)/);
  assert.match(meta, /## Subtitle \(29\/30\)/);
  const kw = section('Keywords, English').split('\n')[0];
  assert.equal(kw, 'file,reader,opener,web,css,javascript,js,htm,preview,open,inspect,xml,json,markdown,pdf,convert');
  assert.equal(Buffer.byteLength(kw), 95);
  assert.match(meta, /## Keywords, English \(U\.S\.\) \(95\/100\)/);
  const banned = new Set(words(`${name} ${sub}`));
  const list = kw.split(',');
  assert.equal(new Set(list).size, list.length);
  for (const w of list) assert.ok(!banned.has(w), w);
  assert.ok(!/\s/.test(kw));
});

test('Spanish (Mexico) listing with its own English name, subtitle and keywords for the extra indexed words', () => {
  const es = section('Spanish (Mexico) listing');
  assert.match(es, /Name \(24\/30\): HTML Editor: File Reader\n/);
  assert.match(es, /Subtitle \(30\/30\): Open HTM Files, Convert to PDF\n/);
  const kw = es.match(/Keywords \((\d+)\/100\): (\S+)/);
  assert.equal(kw[2], 'viewer,code,text,source,web,page,css,javascript,js,preview,inspect,xml,json,markdown,txt,document');
  assert.equal(Buffer.byteLength(kw[2]), Number(kw[1]));
  const banned = new Set(words('HTML Editor: File Reader Open HTM Files, Convert to PDF'));
  for (const w of kw[2].split(',')) assert.ok(!banned.has(w), w);
  const promo = es.match(/Promotional text \(es-MX, (\d+)\/170\): (.+)/);
  assert.equal(promo[2].length, Number(promo[1]));
});

test('promotional text fits; the description leads with outcomes in the brief’s order', () => {
  const promo = section('Promotional text').split('\n')[0];
  assert.ok(promo.length <= 170);
  assert.match(meta, new RegExp(`## Promotional text \\(${promo.length}/170\\)`));
  const d = section('Description');
  assert.match(d.split('\n')[0], /^Open the \.html file you were sent/);
  const heads = ['READ IT LIKE A PAGE', 'SEE AND SEARCH THE CODE', 'FIX IT AND PREVIEW THE CHANGE', 'SAVE IT AS A PDF', 'NOTHING LEAVES THE PHONE'];
  let at = -1;
  for (const h of heads) {
    const i = d.indexOf(h);
    assert.ok(i > at, h);
    at = i;
  }
  assert.match(d, /Terms of Use \(EULA\): https:\/\/www\.apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula\//);
  assert.match(section("What's New (1.0.0)"), /^First version\./);
});

test('review note: what is free, what Pro adds, the paywall close button, no account, the sample file; category and age', () => {
  const n = section('App Review note');
  for (const s of ['does not browse the web', 'no address bar', 'Free: opening and previewing any file', 'Pro adds editing', 'the close button (X, top right) appears after 3 seconds', 'closes with the X', 'no account', 'How to test with the bundled sample file', 'Sample page', 'email any .html file']) assert.ok(n.includes(s), s);
  assert.match(meta, /Primary: Developer Tools\. Secondary: Productivity\./);
  assert.match(meta, /^4\+\. Every content question is None\./m);
});

test('products and RevenueCat ids exactly as briefed; privacy label Purchases only, not linked, not tracking', () => {
  for (const id of ['html_pro_weekly', 'html_pro_yearly', 'html_pro_lifetime', '$rc_weekly', '$rc_annual', '$rc_lifetime', 'entitlement `pro`', 'offering `default`']) assert.ok(meta.includes(id), id);
  const p = section('App Privacy');
  assert.match(p, /^Purchases \(Purchase History\), used for App Functionality, not linked to the user's identity, not used for tracking\./);
  assert.match(p, /Nothing else is collected/);
});

test('screenshot plan: six shots in the brief’s order', () => {
  const s = section('Screenshots');
  const shots = [...s.matchAll(/^\d\. "([^"]+)": ([^(]+)/gm)].map((m) => m[2].trim());
  assert.equal(shots.length, 6);
  for (const [i, w] of ['a previewed page', 'the source view', 'the editor with the live page', 'onboarding screen, an attachment shared', 'the PDF export', 'the recent list'].entries()) assert.ok(shots[i].includes(w), `${i + 1}: ${shots[i]}`);
});

test('website: landing, privacy, support with the FAQ whose first question is how to open an HTML file on iPhone, sitemap and robots', () => {
  for (const f of ['index.html', 'privacy.html', 'support.html', 'sitemap.xml', 'robots.txt', 'style.css', 'icon-512.png', 'apple-touch-icon.png', 'og-image.png']) assert.ok(existsSync(`${ROOT}docs/${f}`), f);
  const sup = site('support.html');
  const first = sup.match(/<details[^>]*><summary>([^<]+)<\/summary>/)[1];
  assert.equal(first, 'How do I open an HTML file on iPhone?');
  assert.match(sup, /"name": "How do I open an HTML file on iPhone\?"/);
  assert.match(sup, /mailto:bkdigitalleads@gmail\.com/);
  const priv = site('privacy.html');
  assert.match(priv, /Purchases, not linked to you/);
  assert.match(priv, /makes no network calls of its own/);
  for (const f of ['', 'support.html', 'privacy.html']) assert.match(site('sitemap.xml'), new RegExp(`<loc>https://bkdigitalleads-cmyk\\.github\\.io/htmlviewer/${f.replace('.', '\\.')}</loc>`));
  assert.match(site('robots.txt'), /Sitemap: https:\/\/bkdigitalleads-cmyk\.github\.io\/htmlviewer\/sitemap\.xml/);
  for (const f of ['index.html', 'privacy.html', 'support.html']) assert.match(site(f), /href="(support|privacy)\.html"/);
  assert.match(site('index.html'), /apps\.apple\.com\/app\/idTODO_COWORK_ASC_APP_ID/, 'the App Store link waits for the app id');
});
