// The open-a-file proof, part (c), without a phone: the app's own page copy
// of a file with a style sheet and a picture beside it (the bundled sample),
// written exactly as the app writes it (src/page.ts pageCopy, UTF-8 with a
// byte order mark, in the file's own folder), loaded by file:// URL in
// Chromium. Checks that the relative style sheet and picture load, that a
// script in the page does not run with Scripts off, that nothing is fetched
// from the web with Web content off, and that find in page marks and
// reaches a match by URL fragment with no script. Writes the screenshots to
// docs/design/proof/. Chromium is not the phone's WebKit: the folder-only
// read access (loadFileURL allowingReadAccessToURL) is checked on TestFlight.
//
//   node store/page-proof.mjs      (needs Playwright with Chromium)
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = new URL('..', import.meta.url).pathname;
const { SAMPLE_FILES } = await import(`${ROOT}src/sample.ts`);
const { pageCopy } = await import(`${ROOT}src/page.ts`);

const dir = mkdtempSync(join(tmpdir(), 'hv-proof-'));
for (const f of SAMPLE_FILES) {
  mkdirSync(dirname(join(dir, f.path)), { recursive: true });
  writeFileSync(join(dir, f.path), f.text);
}
// The same page, as if it had arrived from another app with a script and a web picture in it.
const main = SAMPLE_FILES[0].text
  .replace('</body>', '<img id="web" src="https://example.com/tracker.png" alt=""><script>document.title = "SCRIPT RAN"; document.body.dataset.ran = "1";</script></body>');

const out = join(ROOT, 'docs/design/proof');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
};

async function load(opts, shot, fragment = '') {
  const copy = pageCopy(main, opts).html;
  const file = join(dir, `.hv-view-${shot}.html`);
  writeFileSync(file, `﻿${copy}`);
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  // A web request blocked by the page's Content Security Policy still shows as a request in Chromium,
  // then fails with net::ERR_BLOCKED_BY_CSP before anything goes out; only an answered one counts.
  const web = [];
  const blocked = [];
  page.on('response', (r) => {
    if (/^https?:/.test(r.url())) web.push(r.url());
  });
  page.on('requestfailed', (r) => {
    if (/^https?:/.test(r.url())) blocked.push(`${r.url()} (${r.failure()?.errorText})`);
  });
  await page.goto(pathToFileURL(file).href + fragment);
  await page.waitForLoadState('load');
  await page.waitForTimeout(300);
  return { page, web, blocked };
}

{
  const { page, web, blocked } = await load({ scripts: false, remote: false, dark: false, scale: 1 }, 'plain');
  const css = await page.evaluate(() => getComputedStyle(document.body).fontFamily + ' | ' + getComputedStyle(document.body).backgroundColor);
  check('relative style sheet css/style.css applies', /Georgia/.test(css) && /251, 250, 246/.test(css), css);
  const img = await page.evaluate(() => document.querySelector('figure img').naturalWidth);
  check('relative picture images/harvest.svg loads', img > 0, `naturalWidth ${img}`);
  const ran = await page.evaluate(() => document.body.dataset.ran ?? null);
  const title = await page.title();
  check('a script in the page does not run with Scripts off', ran == null && title !== 'SCRIPT RAN', `title "${title}"`);
  check('nothing is fetched from the web with Web content off', web.length === 0 && blocked.length === 1 && /\(csp\)|BLOCKED_BY_CSP/i.test(blocked[0]), blocked.join(', ') || web.join(', '));
  const webImg = await page.evaluate(() => document.getElementById('web').naturalWidth);
  check('the web picture stays empty', webImg === 0);
  const text = await page.evaluate(() => document.characterSet);
  check('the copy reads as UTF-8', text === 'UTF-8', text);
  await page.screenshot({ path: join(out, 'relative-assets.png') });
  await page.close();
}

{
  const { page } = await load({ scripts: false, remote: false, dark: false, scale: 1, find: 'beds' }, 'find', '#hv-find-1');
  const marks = await page.evaluate(() => document.querySelectorAll('mark.hv-find').length);
  check('find in page marks every match', marks === 2, `${marks} marks for "beds"`);
  const target = await page.evaluate(() => {
    const t = document.querySelector('mark.hv-find:target');
    return t ? `${t.id} ${getComputedStyle(t).backgroundColor}` : null;
  });
  check('the current match is reached by the URL fragment, with no script', target?.startsWith('hv-find-1') ?? false, target ?? 'none');
  await page.screenshot({ path: join(out, 'find-in-page.png') });
  await page.close();
}

{
  const { page } = await load({ scripts: false, remote: false, dark: true, scale: 1.3 }, 'dark');
  const filter = await page.evaluate(() => getComputedStyle(document.documentElement).filter);
  check('the dark page and text size apply as CSS', /invert/.test(filter), filter);
  await page.screenshot({ path: join(out, 'dark-page.png') });
  await page.close();
}

{
  const { page } = await load({ scripts: true, remote: false, dark: false, scale: 1 }, 'scripts');
  const ran = await page.evaluate(() => document.body.dataset.ran ?? null);
  check('with Scripts on, the page script runs', ran === '1');
  await page.close();
}

await browser.close();
rmSync(dir, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'results.txt'), results.map((r) => `${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`).join('\n') + '\n');
if (failed.length) process.exit(1);
