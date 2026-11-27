# HTML Viewer design notes (1.0.0, Nov 27, 2026)

## Concept: Folio

The person opening this app has a file they cannot read: an attachment from a bank, a report, an exported chat, a saved page. They want the page, not an app. So the file is the hero and the chrome stays thin: a slim top bar with the file's name, two tabs (Page and Source), and a thin toolbar of four or five actions at the bottom. Everything else gets out of the way.

- Paper (the background) is a warm off-white, #F6F5F2; cards are white with a 1 px hairline edge (rgba ink at 10%) and 14 pt corners; wells (the segmented track, quiet buttons, fields) are #ECEAE5. Ink is near-black, #16171A, at 17.9:1 on white.
- One accent, a reading-lamp teal (#0B6E66, white lettering at 6.1:1): the one main action on a screen (Open a file, Continue, Share), switches that are on, the picked plan's radio, and the current find match in Source. Nothing else is colored. A page's own colors are the page's.
- Type: the system font for every sentence (it follows Dynamic Type); code, line numbers, the file kind tags ("HTML", "CSS") and the small capitals over sections are set in a no-ligatures monospace (SIL OFL), so code reads exactly as typed and "=>" stays two characters. Titles are the system font, bold, tightly tracked.
- The kind tag is the app's mark of a file: a small outlined tag in the monospace on each recent file, in the onboarding picture, and on the website's feature rows.
- Dark follows the system: graphite paper (#121314), cards #1B1C1E, ink #EDECE9, and the teal lifts to #5BC9BE with dark lettering. A previewed page keeps its own colors unless the person turns on Dark page, which inverts the page and puts pictures back.
- Source themes (Pro): Paper (light) and Night (dark) follow the system on the free plan; Pro adds Sepia and High contrast and a font size. Every token color reads at 4.5:1 or more on its background (checked by `npm test`).
- Motion is quiet: sheets fade, nothing bounces; a soft success tap when a PDF or a save goes out, a tick when a tab or choice changes.

Nothing here is Cash Counter's: no steel tray, no deposit-slip blue, no amber, no Barlow, no 56 pt count buttons. The kit has its own names (src/ui/Kit.tsx): Tap, Primary, Quiet, IconTap, Segments, Card, Row, SwitchRow, KindTag, Caps, Note, Field, TopBar, Toolbar, ToolItem, Notice, Drawer. The views: PageView (the web view), CodeView (the source), FindBar.

## Screens

- Home: "Recent" over the list of files (kind tag, name, when it was opened and its size; More for Move to folder, Share, Delete), the free plan's "N older files are kept on this iPhone" line, one line on how to open from Mail, then the large Open a file button and Paste code under it. Pro shows folder chips (All files, Bank, Personal, School) over the list. Empty: a drawing of a page beside its code and "Open an HTML file to read it here."
- Viewer: the name in the top bar, Page and Source tabs, a one-line notice when the page has scripts or web content that are off ("Scripts and web content are off for files from other apps." with Change), the page or the code, and the toolbar: Find in page (or Find, and Copy all in Source), Edit (a small lock on the free plan), PDF, Share. The top bar's right button opens Page options (text size, dark page, Scripts, Web content, each with its one-line reason) or Source options (wrap, theme, font size).
- Find: the toolbar turns into a find bar above the keyboard: field, "2 of 2", previous, next, Done. In the page every match is marked and the current one is orange (by CSS :target, so it works with scripts off); in Source the current match is the teal.
- Editor (Pro): close, the name and "Edited", find and replace, Save. The live page sits above the code (30% of the screen, can be folded away) and follows a moment after typing stops. Above the keyboard: undo, redo, a scrolling row of code characters (Tab, < > / = " ' { } ( ) ; : # . - _ & [ ]) and hide keyboard. Save offers "Save" (over the app's copy) and "Save as a new file".
- PDF: the PDF as it will print, on a gray backdrop, "Saved as PDF.", and Share, Print, Save to Files.
- Paywalls: the engine's, re-dressed: the headline by reason ("Fix it and see the change." on Edit), one line, "Opening and reading files stays free...", three rows (weekly with the trial first and picked, yearly with its weekly price, lifetime), Continue, "No payment now" when a trial applies, the disclosure, Restore purchases, Terms and Privacy. The onboarding one says "HTML Viewer Pro. 3 days free first." and shows the X after 3 seconds.
- Onboarding: three screens, each a small drawing over one large line: an email attachment shared to the app ("Open any HTML file from Mail or Files."), a page above its colored code ("See the page and its code."), a page saved as statement.pdf ("Save it as a PDF."); then the engine's trial and reminder screens, the paywall, and "Reading is free."

## Renders

`after/` holds every screen the brief asks for, 393x852 points at 2x, light and dark, from a throwaway web copy of the app (not in the repo): the real App.tsx, screens, kit, page copy and data layer on react-native-web, with the file system and SQLite kept in memory, the web view drawn as an iframe of the app's own page copy with the folder's pictures and styles inlined (src/page.ts inlineForPrint, which also drops scripts), a stubbed store with $4.99 weekly with 3 days free, $19.99 yearly and $24.99 lifetime (sample values; Brian sets the prices), and a drawn status bar. Haptics, Dynamic Type, VoiceOver, the iOS keyboard and its code-key row, the system paste button, the share and print sheets and WebKit's own PDF view are not visible in them; the PDF render shows the page copy laid on a Letter page.

1. `01-home`: the recent list on the free plan (three files and "3 older files are kept on this iPhone")
2. `02-home-empty`: the first screen with nothing opened yet
3. `03-page`: a previewed page (a made-up monthly statement with a script and a web picture, both off, and the notice line)
4. `04-source`: the source view
5. `05-find-in-page`: find in page, "bill", 2 of 2
6. `06-page-options`: text size, dark page, Scripts and Web content with their reasons
7. `07-editor`: the editor with the live page above the code (Pro)
8. `08-pdf-export`: the PDF with Share, Print and Save to Files, "Saved as PDF."
9. `09-paywall-in-app`: the in-app paywall from Edit
10. `10-paywall-onboarding`: the onboarding paywall, close button showing
11. `11-settings`: Settings
12. `12` to `14`: the three onboarding screens; `15-trial`: the trial screen
13. `16-home-pro-folders`: the recent list with folders (Pro); `17-source-markdown`: a Markdown file in Source (Night); `18-paste`: Paste code; `19-reading-is-free`: the sheet after the onboarding paywall; `20-source-sepia`: the Sepia source theme (Pro)

`proof/` holds the open-a-file proof in Chromium (`node store/page-proof.mjs`): the sample page from the app's copy with its relative style sheet and chart, find in page by fragment, the dark page, and results.txt.

## Icon

Not chosen. Three concepts in `icon-options.png`, each large and at 60 px on a light and a dark wallpaper, drawn by `store/icon.js` (`node icon.js options`). Until Brian picks, assets/icon.png and the other shipped icon files are a plain teal stand-in tile with a page outline (`CHOSEN = null`).

1. Folio: a white page with a folded corner on the teal: text lines in its top half, code brackets in its lower half. The page and its code, the app's two views; the strongest at 60 px on both wallpapers.
2. Brackets: large mint angle brackets framing a small paper page, on ink. Says "code" fastest; the most like what is already in the category.
3. Lens: a reading lens over a page of colored code lines, on paper. Says "read it"; the weakest at 60 px on a light wallpaper, because the tile is light.

No letters, no browser, compass or globe marks, nothing from another company's product.
