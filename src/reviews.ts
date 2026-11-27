import * as StoreReview from 'expo-store-review';
import { kvGet, kvSet } from './store';
import { ReviewTrigger, shouldAsk } from './rules';

export type { ReviewTrigger } from './rules';

/**
 * The App Store rating ask, at a moment the person just got something:
 * the first PDF or share that went out, or a launch on a later day once
 * three files have been opened (rules.ts). At most one prompt per launch,
 * each trigger once ever, never while a file is open in the editor, and
 * StoreKit still decides whether the prompt is shown (it caps it at 3 a
 * year). The decisions are pure functions in rules.ts, checked by
 * `npm test`. Same engine as Cash Counter, Estimate Maker and Odo 1.0.6.
 */
const triggerKey = (t: ReviewTrigger) => `review.${t}`;

let launchState: 'idle' | 'checking' | 'asked' = 'idle';
let editing: () => boolean = () => false;

/** state.tsx tells this module whether the editor is open. */
export function setReviewGuard(isEditing: () => boolean): void {
  editing = isEditing;
}

export async function maybeRequestReview(trigger: ReviewTrigger): Promise<void> {
  if (launchState !== 'idle' || editing()) return;
  launchState = 'checking';
  try {
    const used = (await kvGet(triggerKey(trigger))) != null;
    const storeCanAsk = await StoreReview.hasAction();
    if (!shouldAsk({ editing: editing(), askedThisLaunch: false, triggerUsed: used, storeCanAsk })) return;
    await kvSet(triggerKey(trigger), '1');
    launchState = 'asked';
    setTimeout(() => {
      // One last look: the editor opened in the meantime wins.
      if (!editing()) StoreReview.requestReview().catch(() => {});
    }, 1200);
  } catch {
    // never let review plumbing get in the way
  } finally {
    if (launchState === 'checking') launchState = 'idle';
  }
}
