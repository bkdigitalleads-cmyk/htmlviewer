import { useColorScheme } from 'react-native';
import type { TokenType } from './highlight';

/**
 * "Folio." A calm reading tool: the file is the hero and the chrome stays
 * thin. Warm paper white behind everything, white cards with hairlines,
 * near-black ink, and one accent, a deep reading-lamp teal, for the one
 * thing to do on a screen (Open a file, Continue, Share) and for the
 * current find match. Code is set in JetBrains Mono (no ligatures); every
 * sentence is the system font, which follows Dynamic Type. Dark follows
 * the system: a soft graphite, never pure black, and the teal lifts.
 */
export interface Theme {
  /** The paper: the screen background. */
  bg: string;
  /** A card: lists, sheets, bars. */
  card: string;
  /** One step down: pressed rows, wells, the segmented track. */
  well: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  /** Hairlines between rows. */
  rule: string;
  /** The 1 px edge around cards and sheets. */
  edge: string;
  /** The one accent: the main action and the current find match. */
  accent: string;
  onAccent: string;
  /** A light wash of the accent behind other find matches and the picked segment's text. */
  accentWash: string;
  danger: string;
  scrim: string;
  isDark: boolean;
}

export const lightTheme: Theme = {
  bg: '#F6F5F2',
  card: '#FFFFFF',
  well: '#ECEAE5',
  ink: '#16171A',
  inkSoft: '#55575D',
  inkFaint: '#7D7F86',
  rule: '#E4E2DD',
  edge: 'rgba(22, 23, 26, 0.10)',
  accent: '#0B6E66',
  onAccent: '#FFFFFF',
  accentWash: 'rgba(11, 110, 102, 0.14)',
  danger: '#B3261E',
  scrim: 'rgba(16, 17, 19, 0.38)',
  isDark: false,
};

export const darkTheme: Theme = {
  bg: '#121314',
  card: '#1B1C1E',
  well: '#26272A',
  ink: '#EDECE9',
  inkSoft: '#B0AFAB',
  inkFaint: '#8A8986',
  rule: '#2C2D30',
  edge: 'rgba(255, 255, 255, 0.09)',
  accent: '#5BC9BE',
  onAccent: '#04211E',
  accentWash: 'rgba(91, 201, 190, 0.18)',
  danger: '#FF8A80',
  scrim: 'rgba(0, 0, 0, 0.55)',
  isDark: true,
};

/** Follows the system: light unless the phone is in dark mode. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** Corners: cards and the main button 14, small controls 10, tags 6. */
export const radius = { card: 14, control: 10, tag: 6, round: 999 };

/** The spacing scale. Every margin, padding and gap is one of these. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

/** JetBrains Mono NL (SIL OFL), registered under these names in App.tsx. */
export const fonts = {
  mono: 'HV-Mono',
  monoMedium: 'HV-Mono-Medium',
  monoBold: 'HV-Mono-Bold',
};

export const UI_FONT_FILES = {
  [fonts.mono]: require('../assets/fonts/JetBrainsMonoNL-Regular.ttf'),
  [fonts.monoMedium]: require('../assets/fonts/JetBrainsMonoNL-Medium.ttf'),
  [fonts.monoBold]: require('../assets/fonts/JetBrainsMonoNL-Bold.ttf'),
};

/**
 * One type scale:
 *  - display 32: onboarding lines and the home title
 *  - title 22: screen titles in sheets
 *  - body 17: rows and text (system)
 *  - strong 17 semibold
 *  - small 14: secondary lines
 *  - caps 12: section heads, letter-spaced, in the mono
 *  - tag 11: the file kind tag ("HTML"), in the mono
 *  - code 13: source and the editor (the size can change with Pro)
 */
export const type = {
  display: { fontSize: 32, lineHeight: 37, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '700' as const, letterSpacing: -0.3 },
  body: { fontSize: 17, lineHeight: 23 },
  strong: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 19 },
  caps: { fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  tag: { fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
  code: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 20 },
  button: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
};

/** Everything a finger taps is at least this tall. */
export const TOUCH = 44;
/** The main button. */
export const MAIN_BUTTON = 54;

// ---------- source themes ----------

export type SourceThemeId = 'system' | 'paper' | 'night' | 'sepia' | 'contrast';

export interface SourceTheme {
  id: Exclude<SourceThemeId, 'system'>;
  name: string;
  bg: string;
  text: string;
  gutter: string;
  gutterText: string;
  colors: Record<TokenType, string>;
  isDark: boolean;
}

/**
 * The colors code is shown in. Free: Paper in light mode, Night in dark.
 * Pro: pick any of the four. Every color reads at 4.5:1 or more on its
 * background (checked by `npm test`).
 */
export const SOURCE_THEMES: Record<SourceTheme['id'], SourceTheme> = {
  paper: {
    id: 'paper',
    name: 'Paper',
    bg: '#FFFFFF',
    text: '#1E1F23',
    gutter: '#F7F6F3',
    gutterText: '#6E7077',
    isDark: false,
    colors: { plain: '#1E1F23', tag: '#0B5F8A', attr: '#7A4A00', value: '#0B6E3A', comment: '#6B6E75', keyword: '#8A2C7A', string: '#0B6E3A', number: '#A1360F', prop: '#0B5F8A', punct: '#4A4C52', heading: '#8A2C7A', code: '#0B6E3A', entity: '#A1360F' },
  },
  night: {
    id: 'night',
    name: 'Night',
    bg: '#151618',
    text: '#E4E3DF',
    gutter: '#1B1C1F',
    gutterText: '#85858A',
    isDark: true,
    colors: { plain: '#E4E3DF', tag: '#7CC4F0', attr: '#E8C07A', value: '#8FD6A8', comment: '#8C8E94', keyword: '#E39BD6', string: '#8FD6A8', number: '#F2A57E', prop: '#7CC4F0', punct: '#B4B3AF', heading: '#E39BD6', code: '#8FD6A8', entity: '#F2A57E' },
  },
  sepia: {
    id: 'sepia',
    name: 'Sepia',
    bg: '#F6EFDF',
    text: '#3A2F22',
    gutter: '#EFE6D2',
    gutterText: '#665641',
    isDark: false,
    colors: { plain: '#3A2F22', tag: '#7A3B12', attr: '#5B4A00', value: '#2F5A2A', comment: '#73665A', keyword: '#7A2357', string: '#2F5A2A', number: '#8A3A10', prop: '#7A3B12', punct: '#55493C', heading: '#7A2357', code: '#2F5A2A', entity: '#8A3A10' },
  },
  contrast: {
    id: 'contrast',
    name: 'High contrast',
    bg: '#000000',
    text: '#FFFFFF',
    gutter: '#0E0E0E',
    gutterText: '#B8B8B8',
    isDark: true,
    colors: { plain: '#FFFFFF', tag: '#6CCBFF', attr: '#FFD866', value: '#7DF0A1', comment: '#B5B5B5', keyword: '#FF9BE8', string: '#7DF0A1', number: '#FFB38A', prop: '#6CCBFF', punct: '#E0E0E0', heading: '#FF9BE8', code: '#7DF0A1', entity: '#FFB38A' },
  },
};

/** The source theme in use: the person's pick with Pro, else Paper or Night by the system. */
export function sourceTheme(id: SourceThemeId, isPro: boolean, dark: boolean): SourceTheme {
  if (isPro && id !== 'system') return SOURCE_THEMES[id];
  return dark ? SOURCE_THEMES.night : SOURCE_THEMES.paper;
}
