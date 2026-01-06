import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../contexts';
import { spacing, borderRadius } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  variant = 'default',
  padding = 'medium',
  style,
}: CardProps) {
  const { colors, shadows } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: colors.card.background,
          borderWidth: 1,
          borderColor: colors.border.primary,
        };
      case 'elevated':
        return {
          backgroundColor: colors.card.background,
          ...shadows.md,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.secondary,
        };
    }
  };

  const cardStyles = [
    styles.base,
    getVariantStyle(),
    styles[`${padding}Padding`],
    style,
  ];

  return <View style={cardStyles}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
  },

  // Padding
  nonePadding: {
    padding: 0,
  },
  smallPadding: {
    padding: spacing.sm,
  },
  mediumPadding: {
    padding: spacing.md,
  },
  largePadding: {
    padding: spacing.lg,
  },
});
