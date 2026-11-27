/** The phone's locale and region (expo-localization), read once at launch. */
import { getLocales } from 'expo-localization';

export interface PhoneLocale {
  /** "en-US", "de-DE". */
  tag: string;
  region: string | null;
}

export function phoneLocale(): PhoneLocale {
  try {
    const l = getLocales()[0];
    return { tag: l?.languageTag || 'en-US', region: l?.regionCode ?? null };
  } catch {
    return { tag: 'en-US', region: 'US' };
  }
}
