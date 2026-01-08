// TrackSpeed Theme
// Supports both light and dark modes

// Shared values
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
    '7xl': 72,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const animation = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Light theme colors
export const lightColors = {
  // Primary palette (blue)
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#2563EB',
    600: '#1D4ED8',
    700: '#1E40AF',
    800: '#1E3A8A',
    900: '#172554',
  },

  // Gray scale
  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  // Semantic colors
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
  },
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
  },

  // Timing colors
  timing: {
    ready: '#16A34A',
    active: '#2563EB',
    stopped: '#DC2626',
    gate: '#2563EB',
    // Semantic aliases
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#DC2626',
  },

  // Base
  white: '#FFFFFF',
  black: '#000000',

  // Semantic shortcuts for light mode
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#64748B',
    inverse: '#FFFFFF',
  },
  border: {
    primary: '#E2E8F0',
    secondary: '#CBD5E1',
  },
  card: {
    background: '#FFFFFF',
    border: '#E2E8F0',
  },
} as const;

// Dark theme colors
export const darkColors = {
  // Primary palette (blue)
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Gray scale (adjusted for navy/blue-gray theme)
  gray: {
    50: '#FFFFFF',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#4B5563',
    700: '#374151',
    800: '#2C3544',
    900: '#222937',
    950: '#1A1F2B',
  },

  // Semantic colors
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
  },
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
  },

  // Timing colors
  timing: {
    ready: '#22C55E',
    active: '#F59E0B',
    stopped: '#EF4444',
    gate: '#F59E0B',
    // Semantic aliases
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },

  // Base
  white: '#FFFFFF',
  black: '#000000',

  // Semantic shortcuts for dark mode (navy/blue-gray with white text)
  background: {
    primary: '#222937',
    secondary: '#2C3544',
    tertiary: '#374151',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E2E8F0',
    tertiary: '#94A3B8',
    inverse: '#222937',
  },
  border: {
    primary: '#374151',
    secondary: '#4B5563',
  },
  card: {
    background: '#2C3544',
    border: '#374151',
  },
} as const;

// Shadows for light mode
export const lightShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Shadows for dark mode
export const darkShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 12,
  },
} as const;

// Default to light mode (better for outdoor visibility)
export const colors = lightColors;
export const shadows = lightShadows;

// Theme type
export type ThemeMode = 'light' | 'dark';

// Get colors for a specific theme
export function getThemeColors(mode: ThemeMode) {
  return mode === 'light' ? lightColors : darkColors;
}

// Get shadows for a specific theme
export function getThemeShadows(mode: ThemeMode) {
  return mode === 'light' ? lightShadows : darkShadows;
}

export default {
  colors,
  lightColors,
  darkColors,
  spacing,
  borderRadius,
  typography,
  shadows,
  lightShadows,
  darkShadows,
  animation,
  getThemeColors,
  getThemeShadows,
};
