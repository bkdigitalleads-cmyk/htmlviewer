// Unit checks for the engine carried over from Cash Counter (the Pro
// re-check, the paywall, onboarding, the test menu), the app config and the
// document types, the copy and review-safety rules, the wiring of the gates,
// and the design rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(`${ROOT}${f}`, 'utf8');

function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    if (f === 'node_modules') return [];
    return statSync(p).isDirectory() ? walk(p, ext) : ext.some((e) => p.endsWith(e)) ? [p] : [];
  });
}
const SRC = () => [...walk(`${ROOT}src`, ['.ts', '.tsx']), `${ROOT}App.tsx`];
/** The strings in a source file: quoted text and JSX text, not imports or code. */
const strings = (s) => (s.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`|>[^<>{}]+</g) ?? []).filter((t) => !/^'\.\.?\//.test(t) && !/^'(react|expo|@)/.test(t));

// ---------- the open-a-file proof, part (a): config ----------

test('document types: .html and .htm (and .xhtml) and the code and text types are declared, so the app is offered in the share sheet and Open in', () => {
  const plist = JSON.parse(read('app.json')).expo.ios.infoPlist;
  const types = plist.CFBundleDocumentTypes;
  const web = types.find((t) => t.CFBundleTypeName === 'Web page');
  assert.deepEqual(web.LSItemContentTypes, ['public.html', 'public.xhtml'], 'public.html covers .html and .htm');
  const code = types.find((t) => t.CFBundleTypeName === 'Code or text file');
  for (const uti of ['public.plain-text', 'public.css', 'com.netscape.javascript-source', 'public.json', 'public.xml', 'public.svg-image', 'net.daringfireball.markdown']) assert.ok(code.LSItemContentTypes.includes(uti), uti);
  for (const t of types) {
    assert.equal(t.CFBundleTypeRole, 'Viewer', 'the original is never edited in place');
    assert.equal(t.LSHandlerRank, 'Alternate', 'not the owner of these types: offered, never the default');
  }
  assert.equal(plist.LSSupportsOpeningDocumentsInPlace, false, 'iOS copies the file into Documents/Inbox before handing it over');
  const imported = Object.fromEntries(plist.UTImportedTypeDeclarations.map((d) => [d.UTTypeIdentifier, d]));
  assert.deepEqual(imported['public.css'].UTTypeTagSpecification['public.filename-extension'], ['css']);
  assert.deepEqual(imported['net.daringfireball.markdown'].UTTypeTagSpecification['public.filename-extension'], ['md', 'markdown']);
  assert.ok(imported['public.xhtml'].UTTypeTagSpecification['public.filename-extension'].includes('xhtml'));
  assert.ok(!('UIFileSharingEnabled' in plist) && !('UISupportsDocumentBrowser' in plist), 'not a document browser app');
});

test('the open-a-file path: file URLs from Linking are kept as the app’s own copy, the Inbox copy removed, then shown', () => {
  const app = read('App.tsx');
  assert.match(app, /Linking\.getInitialURL\(\)\.then\(take\)/);
  assert.match(app, /Linking\.addEventListener\('url', \(e\) => take\(e\.url\)\)/);
  assert.match(app, /const isFileUrl = \(url: string \| null \| undefined\): url is string => !!url && \/\^file:\\\/\\\/\/i\.test\(url\);/);
  assert.match(app, /if \(!onboarded \|\| !data\.loaded \|\| pending\.length === 0\) return;/, 'a file that arrives during onboarding waits, then opens');
  const lib = read('src/library.ts');
  assert.match(lib, /new Directory\(Paths\.document, 'library'\)/);
  assert.match(lib, /src\.copySync\(new File\(dir, plan\.main\)\)/);
  assert.match(lib, /if \(\/\\\/Inbox\\\/\/\.test\(url\)\) \{\s+try \{\s+new File\(url\)\.delete\(\);/);
  const view = read('src/ui/PageView.tsx');
  assert.match(view, /allowingReadAccessToURL=\{folder\}/, 'the web view reads only the file’s own folder');
  assert.match(view, /javaScriptEnabled=\{scripts\}/);
  assert.match(view, /key=\{`\$\{scripts \? 's' : '-'\}\$\{remote \? 'r' : '-'\}`\}/, 'rebuilt when scripts change, since the setting is fixed when it is made');
  for (const p of ['allowFileAccessFromFileURLs={false}', 'allowUniversalAccessFromFileURLs={false}', 'allowsLinkPreview={false}', 'dataDetectorTypes="none"', 'incognito', 'javaScriptCanOpenWindowsAutomatically={false}']) assert.ok(view.includes(p), p);
  assert.match(view, /classifyNav\(req, \{ pageUrl: view\.uri \?\? '', folderUrl: folder, remote \}\)/);
  assert.ok(!/source=\{\{\s*html/.test(view), 'never loaded as an HTML string (which would lose the folder limit)');
});

// ---------- config ----------

test('app.json: identity as briefed, iPhone only, no permissions, push entitlement plugin last, placeholders marked', () => {
  const app = JSON.parse(read('app.json')).expo;
  assert.equal(app.name, 'HTML Viewer');
  assert.equal(app.slug, 'htmlviewer');
  assert.equal(app.ios.bundleIdentifier, 'com.bwk.htmlviewer');
  assert.equal(app.version, '1.0.0');
  assert.equal(app.ios.buildNumber, '1');
  assert.equal(app.ios.supportsTablet, false);
  assert.equal(app.owner, 'bkdeveloper123');
  assert.equal(app.ios.infoPlist.LSApplicationCategoryType, 'public.app-category.developer-tools');
  assert.equal(JSON.parse(read('package.json')).version, app.version);
  assert.equal(app.plugins[app.plugins.length - 1], './plugins/withoutPushEntitlement');
  assert.ok(!JSON.stringify(app).match(/UsageDescription|Camera|Microphone|Location|Photo|Contacts|image-picker|camera/i));
  const eas = JSON.parse(read('eas.json'));
  assert.equal(eas.cli.appVersionSource, 'local');
  assert.equal(eas.build.production.autoIncrement, false);
  // Cowork fills these before the first build.
  assert.equal(app.extra.eas.projectId, 'TODO_COWORK_EAS_PROJECT_ID');
  assert.equal(app.extra.revenueCatApiKeyIos, 'TODO_COWORK_REVENUECAT_PUBLIC_IOS_KEY');
  assert.equal(eas.submit.production.ios.ascAppId, 'TODO_COWORK_ASC_APP_ID');
  assert.match(read('src/purchases.ts'), /!apiKey\.startsWith\('appl_'\)/, 'with the placeholder in place, purchases stay off instead of configuring junk');
  assert.match(read('.eas/workflows/deploy.yml'), /branches: \['main'\]/, 'nothing builds from a branch');
});

test('no native modules or permissions the app does not need, and no network calls of its own', () => {
  const deps = Object.keys(JSON.parse(read('package.json')).dependencies);
  for (const d of ['expo-camera', 'expo-image-picker', 'expo-location', 'expo-contacts', 'expo-media-library', 'expo-mail-composer', 'pdf-lib', 'axios']) assert.ok(!deps.includes(d), d);
  for (const f of SRC()) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/\bfetch\(|XMLHttpRequest|downloadFileAsync|createDownloadTask|\.upload\(|createUploadTask|new WebSocket/.test(s), `network call in ${f}`);
    assert.ok(!/from 'expo-(camera|image-picker|location|contacts|media-library)'/.test(s), f);
  }
});

test('purchases.ts is the engine copy: entitlement pro, offering current; the foreground Pro re-check never takes Pro away on an error', () => {
  const p = read('src/purchases.ts');
  assert.match(p, /export const ENTITLEMENT_ID = 'pro';/);
  assert.match(p, /offerings\.current/);
  assert.match(p, /export async function checkPro\(\): Promise<boolean \| null>/);
  const st = read('src/state.tsx');
  assert.match(st, /checkPro\(\)\.then\(\(v\) => \{\s*if \(v !== null\) setStorePro\(v\);/);
  assert.match(st, /onProChange\(/);
  assert.match(read('src/reminder.ts'), /htmlviewer\.trialReminder/);
});

// ---------- copy ----------

test('copy: no em dashes, exclamation marks, banned words or brand names in the app, the website or the store text', () => {
  const files = [...SRC(), ...walk(`${ROOT}docs`, ['.html']), `${ROOT}store/metadata.md`];
  const brands = /\b(safari|chrome|firefox|edge browser|opera|brave|vs ?code|visual studio|sublime|notepad\+\+|atom editor|textedit|textastic|koder|gmail|outlook|yahoo|dropbox|google|microsoft|adobe acrobat|word document|excel|whatsapp|telegram|slack|chatgpt|openai|jetbrains)\b/i;
  for (const f of files) {
    let s = readFileSync(f, 'utf8');
    if (f.endsWith('metadata.md')) s = s.split('\n').slice(3).join('\n'); // the line that names the rule
    if (/\.(ts|tsx)$/.test(f)) s = strings(s).join('\n');
    s = s.replace(/bkdigitalleads@gmail\.com/g, 'the support address');
    assert.ok(!s.includes('—'), `em dash in ${f}`);
    for (const w of [/\bunlock/i, /\bpremium\b/i, /\bseamless/i, /\beffortless/i, new RegExp(`\\b${['wel', 'come'].join('')}\\b`, 'i'), /\blet's\b/i, /\blet’s\b/i]) assert.equal(s.match(w), null, `${w} in ${f}`);
    assert.equal(s.match(brands), null, `brand name in ${f}`);
  }
  for (const f of [...walk(`${ROOT}src`, ['.tsx']), `${ROOT}App.tsx`]) {
    for (const t of strings(readFileSync(f, 'utf8'))) assert.ok(!/[A-Za-z0-9.]!(\s|$|['"`<])/.test(t), `exclamation in ${f}: ${t}`);
  }
  for (const f of [...SRC(), ...walk(`${ROOT}docs`, ['.html', '.md']), ...walk(`${ROOT}store`, ['.md', '.js', '.mjs']), `${ROOT}README.md`, `${ROOT}NOTES.md`, `${ROOT}CLAUDE.md`].filter(existsSync))
    assert.ok(!/brianwkershner/i.test(readFileSync(f, 'utf8')), `personal address in ${f}`);
  assert.match(read('src/links.ts'), /SUPPORT_EMAIL = 'bkdigitalleads@gmail\.com'/);
  for (const f of [...SRC(), ...walk(`${ROOT}docs`, ['.html'])])
    for (const m of readFileSync(f, 'utf8').matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)) assert.equal(m[0], 'bkdigitalleads@gmail.com', `${m[0]} in ${f}`);
  // The examples from the brief, word for word.
  assert.match(read('src/screens/Home.tsx'), /Open an HTML file to read it here\./);
  assert.match(read('src/screens/PdfExport.tsx'), /say\('Saved as PDF\.'\)/);
  assert.match(read('src/rules.ts'), /'Scripts are off for files from other apps\.'/);
});

test('review safety: no web browsing, no address bar; web links leave for the browser on a tap only', () => {
  for (const f of SRC()) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/address bar|enter a (web address|url)|type a url|keyboardType="url"/i.test(strings(s).join('\n')), f);
    assert.ok(!/source=\{\{\s*uri:\s*['"`]https?:/.test(s), `a web page loaded in ${f}`);
  }
  const nav = read('src/nav.ts');
  assert.match(nav, /if \(top\) return click \? \{ action: 'browser', url \} : \{ action: 'block' \};/);
  assert.match(read('src/ui/PageView.tsx'), /if \(d\.action === 'browser' \|\| d\.action === 'system'\) Linking\.openURL\(d\.url\)/);
  assert.match(read('src/screens/PdfExport.tsx'), /originWhitelist=\{\['file:\/\/\*'\]\} javaScriptEnabled=\{false\}/);
});

// ---------- onboarding, paywalls and gates ----------

test('onboarding: three value screens, then the trial, the reminder and the paywall; nothing to type', () => {
  const app = read('App.tsx');
  const order = ["step === 'intro' && <Intro onDone={() => setStep('trial')} />", '<TrialSteps onDone={openOnboardingPaywall} />', '<PaywallModal privacyUrl={PRIVACY_URL} onboarding />'];
  let at = -1;
  for (const o of order) {
    const i = app.indexOf(o, at + 1);
    assert.ok(i > at, `out of order or missing: ${o}`);
    at = i;
  }
  const intro = read('src/screens/Intro.tsx');
  assert.deepEqual(
    [...intro.matchAll(/title: '([^']+)', line: '[^']+', show: '(open|code|pdf)'/g)].map((m) => m[1]),
    ['Open any HTML file from Mail or Files.', 'See the page and its code.', 'Save it as a PDF.']
  );
  assert.ok(!/TextInput|Field|keyboardType/.test(intro), 'no name or email asked');
});

test('paywalls: close after 3 seconds on the first one, Continue never Subscribe, Restore, Terms and Privacy, prices from the store', () => {
  const pay = read('src/screens/Paywall.tsx');
  assert.match(pay, /ONBOARDING_CLOSE_DELAY_MS = 3000/);
  assert.match(pay, /label=\{purchasing \? 'One moment' : 'Continue'\}/);
  assert.match(pay, /Restore purchases/);
  assert.match(pay, /Terms of Use \(EULA\)/);
  assert.match(pay, /p\.product\.priceString/);
  assert.ok(!/\$\d/.test(pay.replace(/\$\{/g, '')), 'no price typed into the paywall');
  for (const r of ['edit', 'pdf', 'recents', 'folders', 'themes', 'pro']) assert.match(pay, new RegExp(`\\n  ${r}: \\{ title: '`), r);
  assert.ok(!/Cash Counter|count sheet|\btills?\b/i.test(strings(pay).join('\n')), 'none of Cash Counter’s words on screen');
});

test('the in-app paywall opens where the brief says: Edit, a second PDF, a fourth kept file, and Settings; Restore everywhere', () => {
  assert.match(read('src/screens/Viewer.tsx'), /if \(canEdit\(isPro\) \|\| \(await askPro\('edit'\)\)\) onEdit\(path\);/);
  assert.match(read('src/screens/PdfExport.tsx'), /const gate = pdfDecision\(isPro, pdfUsed\);\s+if \(!gate\.allowed && !\(await askPro\('pdf'\)\)\) return onBack\(\);/);
  assert.match(read('App.tsx'), /if \(keepAsksPro\(isPro, keptBefore, keepAsked\.current\)\) \{\s+keepAsked\.current = true;[\s\S]{0,160}await settle\(\);\s+await askPro\('recents'\);\s+\}\s+setStack\(\[\{ name: 'viewer', id: row\.id \}\]\);/, 'the file opens after the paywall either way');
  assert.match(read('src/screens/Settings.tsx'), /askPro\('pro'\)/);
  assert.match(read('src/screens/Settings.tsx'), /Restore purchases/);
  assert.match(read('src/screens/PdfExport.tsx'), /if \(gate\.usesFree\) notePdf\(\);/, 'the free PDF is used once one is made');
});

test('rating ask: after the first PDF or share that went out, and a later-day launch; never while editing', () => {
  assert.match(read('src/screens/PdfExport.tsx'), /maybeRequestReview\('firstExport'\)/);
  assert.match(read('App.tsx'), /maybeRequestReview\('firstExport'\)/);
  assert.match(read('App.tsx'), /if \(laterDayLaunch\(data\.installDay, dayKey\(Date\.now\(\)\), data\.keptEver\)\)/);
  assert.match(read('src/reviews.ts'), /launchState !== 'idle' \|\| editing\(\)/);
  assert.match(read('src/screens/Editor.tsx'), /setEditing\(true\);\s+return \(\) => setEditing\(false\);/);
});

test('hidden test menu: seven taps on the version line in Settings, test builds only (TestFlight sandbox or development)', () => {
  const s = read('src/screens/Settings.tsx');
  assert.match(s, /testBuild && taps >= 7/);
  assert.match(s, /if \(!testBuild\) return;/);
  assert.match(read('src/state.tsx'), /const testBuild = __DEV__ \|\| sandbox;/);
});

test('paste uses the system paste button, so iOS shows no paste prompt; the original outside the app is never written', () => {
  assert.match(read('src/screens/Home.tsx'), /<Clipboard\.ClipboardPasteButton/);
  const lib = read('src/library.ts');
  assert.ok(!/new File\(url\)\.write|new File\(pick\.uri\)\.write|from\.uri\)\.write/.test(lib));
  assert.match(lib, /export function saveOver\(row: FileRow, text: string/);
  assert.match(read('src/screens/Editor.tsx'), /The file in Mail, Files or the app it came from is never changed\./);
});

// ---------- design ----------

const hex = (name, block) => block.match(new RegExp(`\\b${name}: '(#[0-9A-F]{6})'`, 'i'))[1];
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test('design: one accent with readable lettering, ink and soft ink readable on cards in both themes, the kit’s own names', () => {
  const theme = read('src/theme.ts');
  for (const name of ['lightTheme', 'darkTheme']) {
    const block = theme.slice(theme.indexOf(`export const ${name}`)).split('};')[0];
    assert.ok(contrast(hex('accent', block), hex('onAccent', block)) >= 4.5, `${name}: button lettering`);
    assert.ok(contrast(hex('ink', block), hex('card', block)) >= 12, `${name}: ink on a card`);
    assert.ok(contrast(hex('inkSoft', block), hex('card', block)) >= 4.5, `${name}: soft ink`);
    assert.ok(contrast(hex('inkSoft', block), hex('bg', block)) >= 4.5, `${name}: soft ink on paper`);
    assert.ok(contrast(hex('inkFaint', block), hex('bg', block)) >= 3, `${name}: faint ink still reads as a label`);
  }
  const kit = read('src/ui/Kit.tsx');
  for (const n of ['Tap', 'Primary', 'Quiet', 'IconTap', 'Segments', 'Card', 'Row', 'SwitchRow', 'KindTag', 'Caps', 'Note', 'Field', 'TopBar', 'Toolbar', 'Notice', 'Drawer']) assert.match(kit, new RegExp(`export (function|const) ${n}\\b`), n);
  for (const n of ['MainButton', 'PlainButton', 'RoundButton', 'Tray', 'Slot', 'Choice']) assert.ok(!new RegExp(`export function ${n}\\b`).test(kit), `Cash Counter's ${n}`);
  assert.ok(!/E9ECEF|1E4FD8|A93C00|Barlow/i.test(theme), 'not Cash Counter’s steel, blue, amber or type');
  for (const f of readdirSync(`${ROOT}assets/fonts`).filter((f) => f.endsWith('.ttf'))) assert.match(f, /^JetBrainsMonoNL-/);
  assert.ok(existsSync(`${ROOT}assets/fonts/OFL-JetBrainsMono.txt`));
});

test('design: every source theme color reads at 4.5:1 on its background', () => {
  const theme = read('src/theme.ts');
  const block = theme.slice(theme.indexOf('export const SOURCE_THEMES'));
  const themes = [...block.matchAll(/(\w+): \{\s+id: '\w+',[\s\S]*?bg: '(#[0-9A-F]{6})',\s+text: '(#[0-9A-F]{6})',[\s\S]*?gutter: '(#[0-9A-F]{6})',\s+gutterText: '(#[0-9A-F]{6})',[\s\S]*?colors: \{([^}]+)\}/gi)];
  assert.equal(themes.length, 4);
  for (const [, id, bg, text, gutter, gutterText, colors] of themes) {
    assert.ok(contrast(text, bg) >= 7, `${id} text`);
    assert.ok(contrast(gutterText, gutter) >= 4.5, `${id} line numbers`);
    for (const m of colors.matchAll(/(\w+): '(#[0-9A-F]{6})'/gi)) assert.ok(contrast(m[2], bg) >= 4.5, `${id} ${m[1]} ${m[2]} on ${bg}: ${contrast(m[2], bg).toFixed(2)}`);
  }
});

test('design renders: the screens the brief asks for, at 393x852 points, light and dark; three icon options, none picked', () => {
  const want = ['01-home', '03-page', '04-source', '05-find-in-page', '07-editor', '08-pdf-export', '09-paywall-in-app', '10-paywall-onboarding', '11-settings', '12-onboarding-1', '13-onboarding-2', '14-onboarding-3'];
  for (const w of want) {
    for (const mode of ['light', 'dark']) {
      const f = `${ROOT}docs/design/after/${w}-${mode}.png`;
      assert.ok(existsSync(f), f);
      const b = readFileSync(f);
      assert.equal(b.readUInt32BE(16) / b.readUInt32BE(20), 393 / 852, `${w}-${mode}`);
    }
  }
  const sheet = readFileSync(`${ROOT}docs/design/icon-options.png`);
  assert.deepEqual([sheet.readUInt32BE(16), sheet.readUInt32BE(20)], [1500, 820]);
  const icon = read('store/icon.js');
  assert.match(icon, /const CHOSEN = null;/, 'Brian picks');
  for (const v of ['folio', 'brackets', 'lens']) assert.match(icon, new RegExp(`\\n  ${v}: \\(\\) =>`), v);
  assert.ok(!/<text/.test(icon.slice(icon.indexOf('const art = {'), icon.indexOf('/** The stand-in'))), 'no letters on the concepts');
  const raw = readFileSync(`${ROOT}assets/icon.png`);
  assert.deepEqual([raw.readUInt32BE(16), raw.readUInt32BE(20)], [1024, 1024]);
  assert.equal(raw[25], 2, 'RGB with no alpha');
});

test('the open-a-file proof in Chromium passed and its screenshots are in the repo', () => {
  const r = read('docs/design/proof/results.txt');
  assert.ok(!/FAIL/.test(r), r);
  for (const line of ['relative style sheet css/style.css applies', 'relative picture images/harvest.svg loads', 'a script in the page does not run with Scripts off', 'nothing is fetched from the web with Web content off', 'the current match is reached by the URL fragment, with no script']) assert.ok(r.includes(`ok   ${line}`), line);
  for (const f of ['relative-assets.png', 'find-in-page.png', 'dark-page.png']) assert.ok(existsSync(`${ROOT}docs/design/proof/${f}`), f);
});

test('the first-run screens are called Intro; the banned word does not appear in the code', () => {
  const word = new RegExp(['wel', 'come'].join(''), 'i');
  for (const f of [...SRC(), `${ROOT}index.ts`, ...walk(`${ROOT}tests`, ['.mjs']), ...walk(`${ROOT}store`, ['.js', '.mjs'])]) assert.equal(readFileSync(f, 'utf8').match(word), null, f);
});
