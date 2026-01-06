import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../../contexts';
import { spacing, borderRadius } from '../../constants/theme';

interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated';
  interactive?: boolean;
  glassEffectStyle?: 'clear' | 'regular';
}

/**
 * GlassCard - A card component that uses iOS Liquid Glass effect when available.
 * Falls back to a standard card appearance on unsupported platforms.
 *
 * Requires iOS 26+ for glass effect. Development build required (not Expo Go).
 */
export function GlassCard({
  children,
  style,
  variant = 'default',
  interactive = false,
  glassEffectStyle,
}: GlassCardProps) {
  const { colors, isDark } = useTheme();
  const isGlassSupported = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (isGlassSupported) {
    // Use 'clear' style in light mode for better visibility, 'regular' in dark mode
    const effectStyle = glassEffectStyle || (isDark ? 'regular' : 'clear');
    // Apply tint color based on theme for better contrast
    const tintColor = isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.7)';

    return (
      <GlassView
        style={[
          styles.container,
          variant === 'elevated' && styles.elevated,
          style,
        ]}
        glassEffectStyle={effectStyle}
        tintColor={tintColor}
        isInteractive={interactive}
      >
        {children}
      </GlassView>
    );
  }

  // Fallback for Android and older iOS versions
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card.background,
          borderWidth: 1,
          borderColor: colors.border.primary,
        },
        variant === 'elevated' && {
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 8,
          elevation: 4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  elevated: {
    // Glass effect handles elevation naturally
  },
});
