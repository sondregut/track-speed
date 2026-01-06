import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts';
import { spacing, typography } from '../../constants/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  style?: ViewStyle;
}

export function Header({
  title,
  subtitle,
  leftAction,
  rightAction,
  transparent = false,
  style,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: transparent ? 'transparent' : colors.background.primary,
          borderBottomColor: colors.border.primary,
          borderBottomWidth: transparent ? 0 : 1,
        },
        transparent && styles.transparent,
        style,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          {leftAction}
        </View>

        <View style={styles.centerSection}>
          <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.text.secondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightSection}>
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  transparent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  leftSection: {
    width: 60,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 60,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
});
