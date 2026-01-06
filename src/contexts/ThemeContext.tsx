import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useSettingsStore } from '../stores';
import {
  lightColors,
  darkColors,
  lightShadows,
  darkShadows,
  spacing,
  borderRadius,
  typography,
  animation,
  ThemeMode,
} from '../constants/theme';

// Color type that accommodates both light and dark theme variations
type ThemeColors = typeof lightColors | typeof darkColors;
type ThemeShadows = typeof lightShadows | typeof darkShadows;

// Theme context type
interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  shadows: ThemeShadows;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  animation: typeof animation;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { display } = useSettingsStore();

  const theme = useMemo(() => {
    const mode: ThemeMode = display.theme === 'dark' ? 'dark' : 'light';
    const isDark = mode === 'dark';

    return {
      mode,
      colors: isDark ? darkColors : lightColors,
      shadows: isDark ? darkShadows : lightShadows,
      spacing,
      borderRadius,
      typography,
      animation,
      isDark,
    };
  }, [display.theme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Export a hook that returns just the colors for convenience
export function useThemeColors() {
  const { colors } = useTheme();
  return colors;
}

export default ThemeContext;
