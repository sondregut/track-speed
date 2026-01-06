import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  Platform,
  View,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../../contexts';
import { spacing, typography, borderRadius } from '../../constants/theme';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * GlassButton - A button component with iOS Liquid Glass effect.
 * Uses native glass blur when available (iOS 26+), falls back to styled button.
 */
export function GlassButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
}: GlassButtonProps) {
  const { colors, isDark } = useTheme();
  const isGlassSupported = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const getTintColor = () => {
    switch (variant) {
      case 'primary':
        return colors.primary[500] + '40';
      case 'secondary':
        return colors.gray[500] + '40';
      case 'danger':
        return colors.error[500] + '40';
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.gray[400];
    switch (variant) {
      case 'primary':
        return colors.primary[600];
      case 'secondary':
        return colors.text.primary;
      case 'danger':
        return colors.error[600];
    }
  };

  const getFallbackStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary[100],
          borderColor: colors.primary[300],
        };
      case 'secondary':
        return {
          backgroundColor: colors.gray[100],
          borderColor: colors.gray[300],
        };
      case 'danger':
        return {
          backgroundColor: colors.error[100],
          borderColor: colors.error[500],
        };
    }
  };

  const sizeStyles = {
    small: styles.sizeSmall,
    medium: styles.sizeMedium,
    large: styles.sizeLarge,
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  if (isGlassSupported) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        style={style}
      >
        <GlassView
          style={[
            styles.container,
            sizeStyles[size],
            disabled && styles.disabled,
          ]}
          glassEffectStyle="clear"
          tintColor={getTintColor()}
          isInteractive={!disabled}
        >
          <Text style={[styles.text, textSizeStyles[size], { color: getTextColor() }]}>
            {title}
          </Text>
        </GlassView>
      </TouchableOpacity>
    );
  }

  // Fallback for non-glass platforms
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.container,
        styles.fallback,
        sizeStyles[size],
        getFallbackStyle(),
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, textSizeStyles[size], { color: getTextColor() }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  sizeSmall: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 80,
  },
  sizeMedium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 120,
  },
  sizeLarge: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minWidth: 160,
  },
  text: {
    fontWeight: typography.fontWeight.semibold as '600',
    textAlign: 'center',
  },
  textSmall: {
    fontSize: typography.fontSize.sm,
  },
  textMedium: {
    fontSize: typography.fontSize.base,
  },
  textLarge: {
    fontSize: typography.fontSize.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  fallback: {
    borderWidth: 1,
  },
});
