import * as Haptics from 'expo-haptics';

/**
 * Quiet motion: sheets and modals fade, nothing bounces. Touch feedback is
 * light and rare: a tick when a choice changes, a soft success when a PDF
 * or a save goes out.
 */
export const MODAL_ANIMATION = 'fade' as const;

/** A PDF made, a file saved: a soft confirmation. */
export const doneHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
/** Picking an option. */
export const tick = () => Haptics.selectionAsync().catch(() => {});
