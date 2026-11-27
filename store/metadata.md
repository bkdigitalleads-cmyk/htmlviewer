# HTML Viewer, App Store metadata (1.0.0)

Everything here is pasted into App Store Connect by Brian and Cowork. No em dashes anywhere, no brand names of browsers, editors or other companies' products, no "Unlock", "Premium", "Seamless", "Effortless", "Welcome", "Let's" or exclamation marks.

App record: bundle id com.bwk.htmlviewer, SKU htmlviewer, ASC app id TODO_COWORK_ASC_APP_ID (eas.json `ascAppId`). RevenueCat public iOS key in app.json `extra.revenueCatApiKeyIos` (TODO_COWORK_REVENUECAT_PUBLIC_IOS_KEY until Cowork fills it; the app runs with purchases off until a key starting with `appl_` is there). Expo project bkdeveloper123/htmlviewer (projectId TODO_COWORK_EAS_PROJECT_ID, app.json `extra.eas.projectId`).

## Name (24/30)
HTML Viewer: Code Editor

Home screen name and in-app name (app.json `name`): HTML Viewer.

## Subtitle (29/30)
Text Editor, View Page Source

## Keywords, English (U.S.) (95/100)
file,reader,opener,web,css,javascript,js,htm,preview,open,inspect,xml,json,markdown,pdf,convert

Rule: no word from the name or the subtitle (html, viewer, code, editor, text, view, page, source), no repeats, no brand names. Apple combines words across the name, subtitle and keywords, so the four terms from the research are covered: html viewer (name), html (name), text editor (subtitle), code editor (name). With the keywords: html file opener, html reader, view page source, web page viewer, css editor, javascript editor, json viewer, xml viewer, markdown editor, html to pdf, htm file, open html file, inspect code.

## Spanish (Mexico) listing
Name (24/30): HTML Editor: File Reader
Subtitle (30/30): Open HTM Files, Convert to PDF
Keywords (97/100): viewer,code,text,source,web,page,css,javascript,js,preview,inspect,xml,json,markdown,txt,document

This listing is in English on purpose: Apple also reads the Spanish (Mexico) listing for searches in the US store, so it carries extra indexed words (file reader, htm files, convert to pdf, document). No word in its keywords is in its own name or subtitle.

Promotional text (es-MX, 134/170): Abre el archivo .html que te enviaron y léelo como una página. Mira y busca su código, guárdalo como PDF y todo se queda en tu iPhone.

Description (es-MX): the English description below. The app's own text is in English.

## Promotional text (137/170)
Open the .html file you were sent and read it like a page. See and search its code, save it as a PDF, and keep everything on your iPhone.

## Description
Open the .html file you were sent and read it like a web page. A bank statement, a report, an exported chat, a saved page, a school assignment: tap Share on the attachment in Mail, Files or Messages, pick HTML Viewer, and it opens.

READ IT LIKE A PAGE
• The page as it was made, with its pictures and styles when they came with it
• Text size, a dark page for night reading, and pinch to zoom
• Find in page, with every match marked
• Links to the web open in your browser; the app itself never browses

SEE AND SEARCH THE CODE
• Source view with colored code, line numbers and wrap on or off
• Find in the source and copy all of it in one tap
• HTML, HTM, XHTML, CSS, JavaScript, JSON, XML, SVG, Markdown and plain text

FIX IT AND PREVIEW THE CHANGE
• A plain code editor with the page live above it as you type
• Undo, a row of code characters above the keyboard, find and replace
• Save over the app's copy or as a new file; the original in Mail or Files is never changed

SAVE IT AS A PDF
• Print the page or save it as a PDF, made on your iPhone
• Share the file, or save it to Files

SAFE BY DEFAULT
• Scripts are off for files from other apps; turn them on for one file when you trust it
• Pictures and styles from the web are off too, so the sender cannot see you opened it
• A page can only read the files in its own folder

NOTHING LEAVES THE PHONE
• No account, no sign-in, no cloud
• Your files stay on your iPhone unless you share them
• Paste code from the clipboard to start a new file

HTML VIEWER PRO
Free forever: open and preview any file, view the source, find, copy, your last three recent files and your first PDF. Pro adds editing with the live page and saving, find and replace, every PDF after the first, every recent file with folders, and source themes and font size: weekly with a free trial for new subscribers, yearly, or lifetime with one payment.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://bkdigitalleads-cmyk.github.io/htmlviewer/privacy.html

## What's New (1.0.0)
First version. Open an .html file from Mail, Files or Messages, read it like a page, see and search its code, and save it as a PDF.

## Category
Primary: Developer Tools. Secondary: Productivity.

## Age rating
4+. Every content question is None. The app has no web browsing and no address bar (Unrestricted Web Access: No): it shows files the person opens, and a web link opens in the system browser outside the app.

## App Privacy (nutrition label)
Purchases (Purchase History), used for App Functionality, not linked to the user's identity, not used for tracking. RevenueCat keeps the purchase history under an anonymous app user id to confirm Pro. Nothing else is collected: files are kept in the app's own storage on the device. No account, no analytics, no network calls of the app's own. The privacy page says exactly this.

Permissions: none at install and none for the app to work. No camera, microphone, location, contacts or photos. One local notification, the trial reminder, asked on the onboarding reminder screen only when a free trial is on offer. Paste code uses the system paste button, so iOS shows no paste prompt.

## Pricing and RevenueCat
- Subscription group "HTML Viewer Pro".
- `html_pro_weekly`: auto-renewing weekly, with a 3-day free trial (introductory offer) if Brian wants the onboarding trial screens. RevenueCat package `$rc_weekly`. Listed first and preselected on both paywalls.
- `html_pro_yearly`: auto-renewing yearly. RevenueCat package `$rc_annual`.
- `html_pro_lifetime`: non-consumable, one time. RevenueCat package `$rc_lifetime`.
- Prices: set by Brian in App Store Connect. The design renders use $4.99 a week with 3 days free, $19.99 a year and $24.99 once (Cash Counter's), only as sample values.
- RevenueCat: entitlement `pro` (attach all three products), offering `default` with the three packages.
- Prices and trial text in the app always come from StoreKit through RevenueCat.

## App Review contact and support
- Support URL: https://bkdigitalleads-cmyk.github.io/htmlviewer/support.html
- Marketing URL: https://bkdigitalleads-cmyk.github.io/htmlviewer/
- Privacy Policy URL: https://bkdigitalleads-cmyk.github.io/htmlviewer/privacy.html
- Contact email: bkdigitalleads@gmail.com. Settings in the app has "Email support", which opens Mail with the subject "HTML Viewer support".

## App Review note (paste into ASC, Notes)
HTML Viewer opens HTML, code and text files the user already has (for example an .html attachment in Mail) and shows them as a page and as source code. It does not browse the web: there is no address bar and no way to type a web address. Links inside a page open in the system browser, outside the app. Pages are shown from the app's own copy of the file; a page can only read files in its own folder, scripts are off by default for files from other apps, and pictures from the web are off by default too. There is no account, sign-in or server; files stay on the device unless the user shares them.

First launch: three short screens, then, if the Apple ID can still get the free trial, two screens about the trial and its reminder (the reminder screen may ask for notification permission, used only for one local reminder the day before a trial ends). Then the paywall opens; the close button (X, top right) appears after 3 seconds. Closing it shows a small sheet ("Reading is free.") and the app opens.

Free: opening and previewing any file, viewing the source, find in page and in source, copy, the last three recent files, and the first PDF export. Pro adds editing with live preview and saving, find and replace, every PDF after the first, every recent file with folders, and source themes and font size. The in-app paywall opens on Edit, on a second PDF export, on a fourth recent file being kept (once per launch; the file still opens), from folders and source themes, and from Settings. Every paywall has Restore purchases, Terms of Use and the Privacy Policy, and closes with the X.

How to test with the bundled sample file: on the first screen tap Sample page (or Settings, Open the sample page). The sample is an HTML page with a style sheet and a chart beside it, linked by relative paths. It opens as a page; tap Source to see the code, Find in page to search ("beds"), the text size button for text size and the dark page, PDF to make a PDF (Share, Print, Save to Files), and Edit for the paywall. To test opening from another app: email any .html file to the test device, open the attachment in Mail, tap Share, then HTML Viewer.

## Screenshots (6.9 inch at 1320x2868 and 6.3 inch at 1206x2622, six each)
Not made yet (no build). Plan, from the app's own screens (renders in docs/design/after), a short caption at the top on the paper background; no device frames, gradients or emoji. Sample content is made up (a monthly statement with no bank name, the garden club sample page).
1. "Open Any HTML File": a previewed page, the monthly statement (render 03-page)
2. "See the Page Source": the source view with colored code and line numbers (04-source)
3. "Edit and Preview Live": the editor with the live page above the code (07-editor)
4. "Open From Mail or Files": the first onboarding screen, an attachment shared to the app (12-onboarding-1)
5. "Save as PDF": the PDF export with Share, Print and Save to Files (08-pdf-export)
6. "Your Recent Files": the recent list with folders (16-home-pro-folders)
