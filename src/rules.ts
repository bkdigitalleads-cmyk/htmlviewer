/**
 * Small behavior rules as pure functions checked by `npm test`: the page
 * defaults for scripts and web content, the rating prompt, the text size
 * and source font steps, and the local day key.
 */

/** Where a file came from: another app (Mail, Files, Messages, the picker), or made in this app (pasted, saved as new, the sample). */
export type Origin = 'outside' | 'made';

/** Scripts are off by default for files that arrive from other apps, on for files made here. */
export function scriptsDefault(origin: Origin): boolean {
  return origin === 'made';
}

/** Pictures, styles and fonts from the web follow the same rule. */
export function remoteDefault(origin: Origin): boolean {
  return origin === 'made';
}

/** The page settings for a file: the person's own choice for it, else the default for where it came from. */
export function pageFlags(file: { origin: Origin; scripts: boolean | null; remote: boolean | null }): { scripts: boolean; remote: boolean } {
  return {
    scripts: file.scripts ?? scriptsDefault(file.origin),
    remote: file.remote ?? remoteDefault(file.origin),
  };
}

/** The one-line reasons shown with the switches. */
export const SCRIPTS_OFF_LINE = 'Scripts are off for files from other apps.';
export const REMOTE_OFF_LINE = 'Pictures and styles from the web are off for files from other apps.';

/**
 * When the app asks for an App Store rating (through expo-store-review):
 * after the first PDF export or share that went out, or on a launch on a
 * later day than install once three files have been opened. At most one
 * prompt per launch, each trigger once ever, never while a file is open
 * in the editor, and StoreKit still decides whether it shows.
 */
export type ReviewTrigger = 'firstExport' | 'laterDayLaunch';

export function reviewAllowed(opts: { editing: boolean; askedThisLaunch: boolean; triggerUsed: boolean }): boolean {
  return !opts.editing && !opts.askedThisLaunch && !opts.triggerUsed;
}

export function shouldAsk(opts: { editing: boolean; askedThisLaunch: boolean; triggerUsed: boolean; storeCanAsk: boolean }): boolean {
  return reviewAllowed(opts) && opts.storeCanAsk;
}

/** A launch that earns the ask: a later calendar day than install, with three files opened. Days are "YYYY-MM-DD". */
export function laterDayLaunch(installDay: string | null, today: string, filesOpened: number): boolean {
  return installDay != null && /^\d{4}-\d{2}-\d{2}$/.test(installDay) && today > installDay && filesOpened >= 3;
}

/** When the onboarding paywall closes: with Pro, straight in; with the X, the small "Reading is free" sheet first. */
export function afterOnboardingPaywall(isPro: boolean): 'app' | 'claim' {
  return isPro ? 'app' : 'claim';
}

/** Text size steps for Preview. */
export const SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];

/** One step bigger or smaller, held at the ends. */
export function stepScale(current: number, dir: 1 | -1): number {
  let at = SCALES.findIndex((s) => Math.abs(s - current) < 0.001);
  if (at === -1) at = SCALES.indexOf(1);
  return SCALES[Math.max(0, Math.min(SCALES.length - 1, at + dir))];
}

/** "115%". */
export function scaleLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/** Source font sizes (Pro); the free plan reads at 13. */
export const SOURCE_SIZES = [11, 12, 13, 14, 15, 16, 18, 20];
export const DEFAULT_SOURCE_SIZE = 13;

export function stepSourceSize(current: number, dir: 1 | -1): number {
  let at = SOURCE_SIZES.indexOf(current);
  if (at === -1) at = SOURCE_SIZES.indexOf(DEFAULT_SOURCE_SIZE);
  return SOURCE_SIZES[Math.max(0, Math.min(SOURCE_SIZES.length - 1, at + dir))];
}

/** The local calendar day, "2026-11-27". */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "Opened today", "Opened yesterday", "Opened Nov 20". */
export function openedLabel(openedAt: number, now: number, locale = 'en-US'): string {
  const a = dayKey(openedAt);
  const b = dayKey(now);
  if (a === b) return 'Opened today';
  if (a === dayKey(now - 86_400_000)) return 'Opened yesterday';
  const d = new Date(openedAt);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  try {
    return `Opened ${d.toLocaleDateString(locale, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch {
    return `Opened ${a}`;
  }
}

/** US Letter in the US, Canada and Mexico; A4 elsewhere. Points. */
export function paperFor(region: string | null): { name: 'US Letter' | 'A4'; width: number; height: number } {
  return region && ['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'PR'].includes(region.toUpperCase())
    ? { name: 'US Letter', width: 612, height: 792 }
    : { name: 'A4', width: 595, height: 842 };
}
