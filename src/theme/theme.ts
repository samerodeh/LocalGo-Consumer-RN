/**
 * Design tokens mirrored from the SwiftUI app's AppTheme (and the localgo-landing
 * site) so the iOS/Android app reads as the same product.
 */
export const colors = {
  navy: '#0F172A',
  navyDeep: '#020617',
  navyMid: '#1E293B',

  orange: '#F97316',
  orangeLight: '#FB923C',
  orangeDark: '#EA580C',

  offWhite: '#F8FAFC',
  white: '#FFFFFF',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  textLight: '#64748B',
  danger: '#DC2626',
  star: '#FACC15',
} as const;

/** The orange → orangeDark accent gradient used on primary buttons and CTAs. */
export const accentGradient = [colors.orange, colors.orangeDark] as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
} as const;

/**
 * Barlow Condensed display font families, registered in the root layout via
 * expo-font. Used for logos, section titles, and hero numbers.
 */
export const fonts = {
  displayBlack: 'BarlowCondensed-Black',
  displayExtraBold: 'BarlowCondensed-ExtraBold',
  displayBold: 'BarlowCondensed-Bold',
  displaySemiBold: 'BarlowCondensed-SemiBold',
} as const;
