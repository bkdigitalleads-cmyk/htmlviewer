@AGENTS.md

# HTML Viewer (htmlviewer)

App #20 in Brian's iOS app portfolio (seller bkdigitalleads-cmyk). Expo SDK 57, React Native 0.86, TypeScript, expo-sqlite (the kept files' records and settings), expo-file-system (the app's own copies of files, one folder each), react-native-webview (the page, from the app's copy, with read access to that folder only), expo-print (the PDF, made on the phone), expo-document-picker (Open a file), expo-clipboard (Paste code through the system paste button), react-native-svg (glyphs), RevenueCat, expo-notifications (local only, one trial reminder). Engine forked from Cash Counter (cashcounter main at 84c3ba6, Nov 27, 2026), which came from Estimate Maker, Signature Maker, Migraine Log, Image to Text, Pumping and Odo 1.0.6. The count, till, denomination and count sheet modules, pdf-lib and Barlow were dropped. There are no local native modules.

- App Store name: "HTML Viewer: Code Editor" (24). Subtitle "Text Editor, View Page Source" (29). Spanish (Mexico) listing in English for extra indexed words: "HTML Editor: File Reader", "Open HTM Files, Convert to PDF". Home screen name and in-app name: "HTML Viewer". Category Developer Tools, secondary Productivity. Bundle ID com.bwk.htmlviewer. Expo slug and scheme: htmlviewer. Owner bkdeveloper123. GitHub: bkdigitalleads-cmyk/htmlviewer.
- Placeholders, clearly marked, for Cowork to fill before the first build: app.json `extra.eas.projectId` (TODO_COWORK_EAS_PROJECT_ID), app.json `extra.revenueCatApiKeyIos` (TODO_COWORK_REVENUECAT_PUBLIC_IOS_KEY; the app runs with purchases off until a key starting with `appl_` is there), eas.json `ascAppId` (TODO_COWORK_ASC_APP_ID, also in the website's App Store links and store/metadata.md).
- Not built yet. 1.0.0 build 1 is branch claude/html-1.0.0, PR 1, not merged, no EAS run.
- What it is: people who were sent an .html file (a bank statement, a report, an exported chat, a saved page, a school assignment) open it from Mail, Files or Messages through the share sheet or Open in, and read it like a page, see and search its code, and save it as a PDF. Secondary users are students and hobbyists who edit and preview HTML on a phone. No account, no server, no network calls of the app's own.
- Guardrail, always: the app is a file viewer, not a browser. No address bar, no way to type a web address, no in-app web browsing: links leave to the system browser. This keeps the age rating at 4+ and the review simple. No brand names of browsers, editors or other companies' products anywhere (app, listing, website).

## How opening a file works (read before touching it)

- app.json `ios.infoPlist` declares the document types (CFBundleDocumentTypes: "Web page" for public.html and public.xhtml, "Code or text file" for public.plain-text, public.css, com.netscape.javascript-source, public.json, public.xml, public.svg-image and net.daringfireball.markdown, both role Viewer, rank Alternate), imports the three types iOS may not know (UTImportedTypeDeclarations: public.xhtml, public.css, net.daringfireball.markdown), and sets LSSupportsOpeningDocumentsInPlace to false. That last one makes iOS hand the app a copy in Documents/Inbox, so no security-scoped access is needed. Expo SDK 57 writes all of this into Info.plist from app.json alone; no config plugin is needed (checked with `npx expo prebuild` into a scratch folder).
- The Expo AppDelegate passes the file URL to React Native's Linking (expo-linking's subscriber returns false, so RCTLinkingManager gets it). App.tsx takes `file://` URLs from `Linking.getInitialURL()` and the `url` event, waits until onboarding is done, then src/library.ts `keepIncoming` copies the file into Documents/library/<dir>/ and deletes the Inbox copy.
- The page is a copy (src/page.ts `pageCopy`) written beside the file as `.hv-view-N.html`: a Content Security Policy (scripts only when Scripts is on; nothing from the web unless Web content is on; no forms, plugins, base or connect), UTF-8, a viewport that allows pinch to zoom, text size and dark page as CSS, and find marks. src/ui/PageView.tsx loads it with `allowingReadAccessToURL` set to the file's folder, so the web view cannot read anything outside it. Links follow src/nav.ts. Never load an original file directly, never widen the read access, never allow a top-frame navigation that is not a tap.
- Scripts and web content are off by default for files from other apps and on for files made in the app (src/rules.ts `scriptsDefault`, `remoteDefault`). Do not change that rule without Brian.

## How shipping works (read before every push)

- A push to `main` that touches app.json, eas.json, package*.json, App.tsx, index.ts, src/, assets/ or modules/ starts an EAS workflow (.eas/workflows/deploy.yml) once the Expo project is connected. It builds iOS in the cloud and uploads the build to App Store Connect / TestFlight. Every such push costs a paid build credit. (modules/ stays in the filter from the engine; this app has none.)
- Never merge to `main` without Brian. Work on a branch and open a PR.
- Pushes that only change Markdown files (CLAUDE.md, NOTES.md, README.md, store/metadata.md), store/ or docs/ do not build.
- Version numbers are local (`appVersionSource: local`, no auto-increment). Before any push that builds: raise `ios.buildNumber` in app.json by 1, and raise `version` when it will become a new App Store release. A build number that was already used makes the upload fail.
- Before every commit: run `npx tsc --noEmit` and `npm test`, and fix every error.
- Batch the changes for one app into one push. Ask Brian before any push that builds, and say what is in it.
- Submitting for App Review, release dates, prices, the subtitle, keywords, the age rating and screenshots all happen in App Store Connect. Brian and his Cowork session handle that side. Do not try to do it from here.

## Rules

- Brian handles every credential and sign-in. Never type, paste, print or store passwords, tokens or API keys (the RevenueCat key in app.json is the public SDK key and belongs there). If git push asks for credentials, stop and tell Brian.
- No spending (paid services, EAS builds beyond what Brian approved) without Brian saying go.
- Never change the RevenueCat entitlement id `pro`, the offering `default`, the product ids (html_pro_weekly, html_pro_yearly, html_pro_lifetime), the packages ($rc_weekly, $rc_annual, $rc_lifetime) or the logic in src/purchases.ts (a copy of the engine's, with the foreground Pro re-check in state.tsx) without Brian asking. Paying users must never lose Pro. Prices and trial text on screen always come from StoreKit through RevenueCat.
- Free forever (src/gates.ts holds the rules, with checks): opening and previewing any file, viewing source, find in page and in source, copy, the last three recent files, and the first PDF export. Pro: editing with live preview and saving, find and replace, every PDF after the first, every recent file with folders, source themes and font size. The in-app paywall opens on Edit, on a second PDF export, on a fourth recent file being kept (at most once per launch; the file opens either way), from folders and source themes, and from Settings. A file is always kept and always opens; older ones are kept out of the list on the free plan, never deleted. Never lock anyone out of reading a file.
- Never change the original outside the app. The app reads its own copy; Save goes over that copy or makes a new file.
- The database only ever gains migrations (src/db/schema.ts `MIGRATIONS`). Never edit or reorder a shipped migration; add a new one. Old rows must still read.
- Do not change the app name, subtitle, keywords or the rating-prompt trigger (the first PDF or share that went out, or a later-day launch after three files; at most one per launch, each once ever, never while the editor is open) without asking.
- Keep changes small. Fix what the task needs and tidy only the files you already touch. List anything else you notice in NOTES.md under "Noticed, not changed" instead of fixing it. No broad refactors, dependency upgrades or Expo SDK upgrades unless Brian asks.
- Copy voice: plain, short. No "Unlock", "Premium", "Seamless", "Effortless", "Welcome", "Let's", exclamation marks or em dashes in any user-facing text (app, notifications, PDFs, store text, website), in commits or pull requests, and none in text Brian sends to other people. Examples: "Open an HTML file to read it here.", "Saved as PDF.", "Scripts are off for files from other apps." Support email bkdigitalleads@gmail.com only.
- Design (docs/design/NOTES.md, "Folio") uses the theme's tokens, never ad hoc values. One accent, the reading-lamp teal, for the main action and the current find match. The kit's names are its own (src/ui/Kit.tsx). Glyphs are drawn in src/ui/Glyph.tsx. No icon pack.
- Fonts: only SIL OFL fonts, each with its licence in assets/fonts. The code face is the upstream no-ligatures monospace (assets/fonts/OFL-JetBrainsMono.txt), converted from the published webfont to TTF without changing a glyph.
- plugins/withoutPushEntitlement.js stays last in app.json plugins. After touching plugins or app.json, check `npx expo config --type introspect` still shows `ios.entitlements` as `{}`, no camera, microphone, location or photo-library usage strings, and both document types. The app needs no permission but notifications (asked only for the trial reminder).
- Files stay on the device unless the person shares them. Never add analytics, a server, sync or a network call.

## Logging (so Brian's Cowork session can follow along)

- With every commit, add an entry at the top of NOTES.md in the same commit: date, version/build, what changed and why, and how it was checked.

## Testing

- Type check: `npx tsc --noEmit`. Unit checks: `npm test`. Bundle check: `npx expo export --platform ios`. Config: `npx expo config --type introspect`.
- Pure logic has no React or native imports (it imports with a `.ts` extension so Node runs it directly), so `npm test` checks exactly what the app runs.
- The open-a-file proof, part (c), without a phone: `node store/page-proof.mjs` (needs Playwright with Chromium) loads the app's page copy of the bundled sample, with its style sheet and picture beside it, by file:// URL, and checks that they load, that a page script stays off, that a web picture is blocked, and that find works with no script. Screenshots and results in docs/design/proof/.
- Icon concepts: `cd store && npm install && node icon.js options`; `node icon.js` writes the shipped icons from `CHOSEN` (null until Brian picks; the shipped files are a plain teal stand-in).
- Simulator (needs Xcode): Expo Go does not work (RevenueCat needs a development build). Purchases do not complete in the simulator. Open in from Mail needs a device.
- Real-device check: TestFlight build from the EAS workflow, on Brian's iPhone. NOTES.md has the TestFlight checklist.
