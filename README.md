# HTML Viewer (htmlviewer)

Engine base for app 20, HTML Viewer, forked from Cash Counter (bkdigitalleads-cmyk/cashcounter, main at 84c3ba6, Nov 27, 2026).

This first commit holds only the engine pieces that carry over unchanged: the RevenueCat wrapper with the foreground Pro re-check (src/purchases.ts), the trial and plan rules (src/trial.ts, src/offer.ts), the trial reminder (src/reminder.ts), the test-build check (src/testing.ts), the startup guard (index.ts), the EAS workflows, eas.json, and plugins/withoutPushEntitlement.js. It is not an app yet; the app arrives on branch claude/html-1.0.0 by pull request. Rules: AGENTS.md, and CLAUDE.md on that branch.
