// Unit checks for the free versus Pro gates, the recent list and its free
// limit, the JavaScript and web content default rule, the rating prompt
// rules, the text size steps, and the database (the same migrations and
// SQL the app runs, on Node's SQLite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const G = await import('../src/gates.ts');
const R = await import('../src/rules.ts');
const S = await import('../src/db/schema.ts');
const Repo = await import('../src/db/repo.ts');
const O = await import('../src/offer.ts');

// ---------- free versus Pro ----------

test('free forever: reading, source, find and copy never wait on Pro', () => {
  assert.equal(G.canRead(false), true);
  assert.equal(G.canRead(true), true);
});

test('Pro: editing and replace, source themes and size, folders', () => {
  for (const f of [G.canEdit, G.canReplace, G.canStyleSource, G.canUseFolders]) {
    assert.equal(f(false), false, f.name);
    assert.equal(f(true), true, f.name);
  }
});

test('PDF: the first is free, the second asks for Pro, Pro has every one', () => {
  assert.equal(G.FREE_PDFS, 1);
  assert.deepEqual(G.pdfDecision(false, 0), { allowed: true, usesFree: true });
  assert.deepEqual(G.pdfDecision(false, 1), { allowed: false, usesFree: false });
  assert.deepEqual(G.pdfDecision(false, 7), { allowed: false, usesFree: false });
  assert.deepEqual(G.pdfDecision(true, 0), { allowed: true, usesFree: false });
  assert.deepEqual(G.pdfDecision(true, 9), { allowed: true, usesFree: false });
});

test('recent list: three on the free plan, newest first; older ones kept and counted, never dropped; Pro lists all', () => {
  assert.equal(G.FREE_RECENTS, 3);
  const files = [5, 1, 4, 2, 3].map((n) => ({ id: `f${n}`, openedAt: n * 1000, folder: n % 2 ? 'Bank' : '' }));
  const free = G.visibleRecents(false, files);
  assert.deepEqual(free.shown.map((f) => f.id), ['f5', 'f4', 'f3']);
  assert.equal(free.hidden, 2);
  const pro = G.visibleRecents(true, files);
  assert.deepEqual(pro.shown.map((f) => f.id), ['f5', 'f4', 'f3', 'f2', 'f1']);
  assert.equal(pro.hidden, 0);
  assert.deepEqual(G.visibleRecents(false, files.slice(0, 2)).hidden, 0);
  assert.equal(files.length, 5, 'the list passed in is not changed');
  assert.deepEqual(G.inFolder(files, 'Bank').map((f) => f.id), ['f5', 'f1', 'f3']);
  assert.deepEqual(G.folderNames([{ folder: 'School' }, { folder: '' }, { folder: 'Bank' }, { folder: 'School' }]), ['Bank', 'School']);
  assert.equal(G.cleanFolder('  Bank\n statements   and more letters than thirty  '), 'Bank statements and more lette');
});

test('keeping a fourth file opens the paywall first on the free plan, once per launch; never with Pro', () => {
  assert.equal(G.keepAsksPro(false, 2, false), false, 'the third file is free');
  assert.equal(G.keepAsksPro(false, 3, false), true, 'the fourth file asks');
  assert.equal(G.keepAsksPro(false, 3, true), false, 'once per launch');
  assert.equal(G.keepAsksPro(false, 9, false), true);
  assert.equal(G.keepAsksPro(true, 9, false), false);
});

// ---------- the JavaScript default ----------

test('scripts and web content: off by default for files from other apps, on for files made here; the person’s choice wins', () => {
  assert.equal(R.scriptsDefault('outside'), false);
  assert.equal(R.scriptsDefault('made'), true);
  assert.equal(R.remoteDefault('outside'), false);
  assert.equal(R.remoteDefault('made'), true);
  assert.deepEqual(R.pageFlags({ origin: 'outside', scripts: null, remote: null }), { scripts: false, remote: false });
  assert.deepEqual(R.pageFlags({ origin: 'outside', scripts: true, remote: null }), { scripts: true, remote: false });
  assert.deepEqual(R.pageFlags({ origin: 'made', scripts: false, remote: null }), { scripts: false, remote: true });
  assert.equal(R.SCRIPTS_OFF_LINE, 'Scripts are off for files from other apps.', 'the line from the brief, word for word');
});

// ---------- rating ----------

test('rating ask: never while editing, at most one per launch, each trigger once ever, StoreKit permitting', () => {
  const base = { editing: false, askedThisLaunch: false, triggerUsed: false, storeCanAsk: true };
  assert.equal(R.shouldAsk(base), true);
  assert.equal(R.shouldAsk({ ...base, editing: true }), false);
  assert.equal(R.shouldAsk({ ...base, askedThisLaunch: true }), false);
  assert.equal(R.shouldAsk({ ...base, triggerUsed: true }), false);
  assert.equal(R.shouldAsk({ ...base, storeCanAsk: false }), false);
  assert.equal(R.laterDayLaunch('2026-11-20', '2026-11-21', 3), true);
  assert.equal(R.laterDayLaunch('2026-11-20', '2026-11-21', 2), false, 'three files first');
  assert.equal(R.laterDayLaunch('2026-11-20', '2026-11-20', 9), false, 'not on install day');
  assert.equal(R.laterDayLaunch(null, '2026-11-21', 9), false);
  assert.equal(R.laterDayLaunch('junk', '2026-11-21', 9), false);
  assert.equal(R.afterOnboardingPaywall(true), 'app');
  assert.equal(R.afterOnboardingPaywall(false), 'claim');
});

test('text size and source size steps hold at the ends; paper by region; dates read plainly', () => {
  assert.equal(R.stepScale(1, 1), 1.15);
  assert.equal(R.stepScale(1, -1), 0.85);
  assert.equal(R.stepScale(2, 1), 2);
  assert.equal(R.stepScale(0.85, -1), 0.85);
  assert.equal(R.stepScale(1.07, 1), 1.15, 'an odd stored value starts from 100%');
  assert.equal(R.scaleLabel(1.15), '115%');
  assert.equal(R.stepSourceSize(13, 1), 14);
  assert.equal(R.stepSourceSize(20, 1), 20);
  assert.equal(R.stepSourceSize(11, -1), 11);
  assert.equal(R.paperFor('US').name, 'US Letter');
  assert.equal(R.paperFor('DE').name, 'A4');
  assert.equal(R.paperFor(null).name, 'A4');
  const now = new Date(2026, 10, 27, 9, 41).getTime();
  assert.equal(R.openedLabel(now - 60_000, now), 'Opened today');
  assert.equal(R.openedLabel(now - 86_400_000, now), 'Opened yesterday');
  assert.equal(R.openedLabel(new Date(2026, 10, 20).getTime(), now), 'Opened Nov 20');
  assert.equal(R.dayKey(now), '2026-11-27');
});

// ---------- engine copy: plans and trial ----------

test('plans: three rows, weekly first and preselected on both paywalls; disclosure has every price', () => {
  for (const onb of [true, false]) {
    assert.deepEqual(O.planOrder(onb), ['WEEKLY', 'ANNUAL', 'LIFETIME']);
    assert.equal(O.preselect(['LIFETIME', 'ANNUAL', 'WEEKLY'], onb), 'WEEKLY');
  }
  assert.equal(O.trialLabelFrom({ price: 0, periodNumberOfUnits: 3, periodUnit: 'DAY' }, true), '3 days free');
  assert.equal(O.trialLabelFrom({ price: 0, periodNumberOfUnits: 3, periodUnit: 'DAY' }, false), null);
  const d = O.disclosureText({ weekly: '$4.99', yearly: '$19.99', lifetime: '$24.99', trial: '3 days free' });
  assert.match(d, /Weekly \$4\.99\/week .*3 days free/);
  assert.match(d, /Lifetime \$24\.99 is a one-time purchase/);
});

// ---------- the database ----------

function nodeDb() {
  const sq = new DatabaseSync(':memory:');
  return {
    exec: async (sql) => sq.exec(sql),
    run: async (sql, p = []) => void sq.prepare(sql).run(...p),
    all: async (sql, p = []) => sq.prepare(sql).all(...p),
    get: async (sql, p = []) => sq.prepare(sql).get(...p) ?? null,
    tx: async (fn) => {
      sq.exec('BEGIN');
      try {
        await fn();
        sq.exec('COMMIT');
      } catch (e) {
        sq.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

test('database: one migration, run once; files and settings round-trip; an unknown kind reads as text', async () => {
  assert.equal(S.MIGRATIONS.length, 1);
  const db = nodeDb();
  assert.equal(await S.migrate(db), 1);
  assert.equal(await S.migrate(db), 1, 'running again changes nothing');
  await Repo.kvSet(db, 'a', '1');
  await Repo.kvSet(db, 'a', '2');
  assert.equal(await Repo.kvGet(db, 'a'), '2');
  assert.equal(await Repo.kvGet(db, 'missing'), null);
  const row = { id: 'f1', name: 'statement.html', dir: 'd1', main: 'statement.html', kind: 'html', origin: 'outside', folder: '', scripts: null, remote: null, size: 2048, createdAt: 1, openedAt: 10, updatedAt: 1 };
  await Repo.saveFile(db, row);
  await Repo.saveFile(db, { ...row, id: 'f2', name: 'b.css', main: 'b.css', kind: 'css', openedAt: 20 });
  assert.deepEqual(await Repo.getFile(db, 'f1'), row);
  assert.deepEqual((await Repo.listFiles(db)).map((f) => f.id), ['f2', 'f1'], 'most recently opened first');
  await Repo.saveFile(db, { ...row, scripts: true, remote: false, folder: 'Bank', openedAt: 30 });
  const back = await Repo.getFile(db, 'f1');
  assert.equal(back.scripts, true);
  assert.equal(back.remote, false);
  assert.equal(back.folder, 'Bank');
  assert.equal(back.origin, 'outside', 'where a file came from never changes');
  assert.equal(await Repo.countFiles(db), 2);
  await Repo.deleteFile(db, 'f2');
  assert.equal(await Repo.countFiles(db), 1);
  await db.run("INSERT INTO files (id, name, dir, main, kind, created_at, opened_at, updated_at) VALUES ('f3', 'x', 'd', 'x', 'nonsense', 0, 0, 0)");
  const odd = await Repo.getFile(db, 'f3');
  assert.equal(odd.kind, 'txt');
  assert.equal(odd.origin, 'outside', 'an old row with no origin is treated as from outside: scripts off');
});
