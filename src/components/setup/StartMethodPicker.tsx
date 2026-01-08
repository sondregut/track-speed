/**
 * StartMethodPicker - Choose how to start the timer
 *
 * Three options:
 * - Sound: Clap/gun triggers start, run through same phone to finish (1 phone)
 * - Thumb: Hold thumb at start phone, run through finish phone (2+ phones)
 * - Gate: Run through start gate, then finish gate (2+ phones)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useTheme } from '../../contexts';
import type { SimpleStartMethod } from '../../types';

interface StartMethodPickerProps {
  selected: SimpleStartMethod;
  onSelect: (method: SimpleStartMethod) => void;
}

interface MethodOption {
  value: SimpleStartMethod;
  icon: string;
  label: string;
  description: string;
  minPhones: number;
}

const METHODS: MethodOption[] = [
  {
    value: 'sound',
    icon: '🔊',
    label: 'Sound',
    description: 'Clap or gun starts timer',
    minPhones: 1,
  },
  {
    value: 'thumb',
    icon: '👍',
    label: 'Thumb',
    description: 'Hold thumb, release to start',
    minPhones: 2,
  },
  {
    value: 'gate',
    icon: '🚩',
    label: 'Gate',
    description: 'Run through start gate',
    minPhones: 2,
  },
];

export function StartMethodPicker({ selected, onSelect }: StartMethodPickerProps) {
  const { colors: themeColors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: themeColors.text.primary }]}>
        How do you want to start?
      </Text>

      <View style={styles.optionsContainer}>
        {METHODS.map((method) => {
          const isSelected = selected === method.value;

          return (
            <TouchableOpacity
              key={method.value}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected
                    ? (isDark ? colors.primary[900] : colors.primary[50])
                    : themeColors.card.background,
                  borderColor: isSelected
                    ? colors.primary[500]
                    : themeColors.border.primary,
                },
              ]}
              onPress={() => onSelect(method.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.icon}>{method.icon}</Text>
              <Text
                style={[
                  styles.label,
                  {
                    color: isSelected
                      ? (isDark ? colors.primary[300] : colors.primary[600])
                      : themeColors.text.primary,
                  },
                ]}
              >
                {method.label}
              </Text>
              <Text style={[styles.description, { color: themeColors.text.secondary }]}>
                {method.description}
              </Text>
              <View
                style={[
                  styles.phoneBadge,
                  {
                    backgroundColor: isDark
                      ? colors.gray[700]
                      : colors.gray[100],
                  },
                ]}
              >
                <Text style={[styles.phoneText, { color: themeColors.text.tertiary }]}>
                  {method.minPhones} phone{method.minPhones > 1 ? 's' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    gap: spacing.xs,
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    textAlign: 'center',
  },
  description: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    minHeight: 32,
  },
  phoneBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  phoneText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
});
