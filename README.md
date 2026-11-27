# HTML Viewer

An HTML viewer and code editor for the iPhone: open the .html file you were sent (from Mail, Files or Messages), read it like a page, see and search its code, edit it with the page live above it, and save it as a PDF. No account, no server: the app keeps its own copy of each file on the phone, and a page can only read the files in its own folder.

- App: Expo SDK 57, React Native, TypeScript. `npm install`, then `npx tsc --noEmit` and `npm test`.
- Website: `docs/` (GitHub Pages): landing page, privacy policy, support with questions and answers.
- Store listing: `store/metadata.md`. Icon concepts: `cd store && npm install && node icon.js options`. The open-a-file proof in Chromium: `node store/page-proof.mjs`.
- Design: `docs/design/NOTES.md`, with the renders and the icon options.
- Rules for working in this repo: `CLAUDE.md`. Change log and TestFlight checklist: `NOTES.md`.
