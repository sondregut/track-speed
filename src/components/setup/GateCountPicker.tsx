/**
 * GateCountPicker - Choose number of gates and set distances
 *
 * Shows gate configuration based on start method:
 * - Sound: 1 gate (start+finish on same phone) or more with laps
 * - Thumb/Gate: 2+ gates (start + finish, optional laps)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useTheme } from '../../contexts';
import type { SimpleStartMethod } from '../../types';

interface GateCountPickerProps {
  startMethod: SimpleStartMethod;
  gateCount: number;
  onGateCountChange: (count: number) => void;
  totalDistance: number;
  onTotalDistanceChange: (distance: number) => void;
  lapDistances: number[];
  onLapDistancesChange: (distances: number[]) => void;
}

const COMMON_DISTANCES = [30, 40, 50, 60, 100];

export function GateCountPicker({
  startMethod,
  gateCount,
  onGateCountChange,
  totalDistance,
  onTotalDistanceChange,
  lapDistances,
  onLapDistancesChange,
}: GateCountPickerProps) {
  const { colors: themeColors, isDark } = useTheme();

  const minGates = startMethod === 'sound' ? 1 : 2;
  const maxGates = 6;

  // Calculate number of lap gates
  const lapCount = Math.max(0, gateCount - (startMethod === 'sound' ? 1 : 2));

  const handleAddLap = () => {
    if (gateCount < maxGates) {
      onGateCountChange(gateCount + 1);
      // Add a default lap distance (halfway to finish)
      const lastLap = lapDistances.length > 0 ? lapDistances[lapDistances.length - 1] : 0;
      const newLapDistance = Math.round((lastLap + totalDistance) / 2);
      onLapDistancesChange([...lapDistances, newLapDistance]);
    }
  };

  const handleRemoveLap = () => {
    if (gateCount > minGates) {
      onGateCountChange(gateCount - 1);
      onLapDistancesChange(lapDistances.slice(0, -1));
    }
  };

  const updateLapDistance = (index: number, distance: number) => {
    const newDistances = [...lapDistances];
    newDistances[index] = distance;
    onLapDistancesChange(newDistances);
  };

  // Get gate description based on start method
  const getGateDescription = () => {
    if (startMethod === 'sound') {
      if (gateCount === 1) {
        return 'Sound starts timer, run through same phone to finish';
      }
      return `Sound starts, ${lapCount} lap gate${lapCount > 1 ? 's' : ''}, finish on start phone`;
    }
    if (lapCount === 0) {
      return startMethod === 'thumb'
        ? 'Thumb on start phone, run through finish phone'
        : 'Run through start gate, then finish gate';
    }
    return `Start + ${lapCount} lap${lapCount > 1 ? 's' : ''} + Finish`;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: themeColors.text.primary }]}>
        Set up your gates
      </Text>

      {/* Gate Count Selector */}
      <View style={[styles.card, { backgroundColor: themeColors.card.background, borderColor: themeColors.border.primary }]}>
        <Text style={[styles.sectionLabel, { color: themeColors.text.secondary }]}>
          Number of Gates
        </Text>

        <View style={styles.counterRow}>
          <TouchableOpacity
            style={[
              styles.counterButton,
              { backgroundColor: themeColors.background.tertiary },
              gateCount <= minGates && styles.counterButtonDisabled,
            ]}
            onPress={handleRemoveLap}
            disabled={gateCount <= minGates}
          >
            <Text style={[styles.counterButtonText, { color: themeColors.text.primary }]}>-</Text>
          </TouchableOpacity>

          <View style={styles.counterDisplay}>
            <Text style={[styles.counterValue, { color: themeColors.text.primary }]}>
              {gateCount}
            </Text>
            <Text style={[styles.counterLabel, { color: themeColors.text.secondary }]}>
              phone{gateCount > 1 ? 's' : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.counterButton,
              { backgroundColor: themeColors.background.tertiary },
              gateCount >= maxGates && styles.counterButtonDisabled,
            ]}
            onPress={handleAddLap}
            disabled={gateCount >= maxGates}
          >
            <Text style={[styles.counterButtonText, { color: themeColors.text.primary }]}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.description, { color: themeColors.text.tertiary }]}>
          {getGateDescription()}
        </Text>
      </View>

      {/* Finish Distance */}
      <View style={[styles.card, { backgroundColor: themeColors.card.background, borderColor: themeColors.border.primary }]}>
        <Text style={[styles.sectionLabel, { color: themeColors.text.secondary }]}>
          Finish Distance
        </Text>

        <View style={styles.distanceOptions}>
          {COMMON_DISTANCES.map((d) => (
            <TouchableOpacity
              key={d}
              style={[
                styles.distanceOption,
                {
                  backgroundColor: totalDistance === d
                    ? (isDark ? colors.primary[900] : colors.primary[50])
                    : themeColors.background.tertiary,
                  borderColor: totalDistance === d
                    ? colors.primary[500]
                    : 'transparent',
                },
              ]}
              onPress={() => onTotalDistanceChange(d)}
            >
              <Text
                style={[
                  styles.distanceText,
                  {
                    color: totalDistance === d
                      ? (isDark ? colors.primary[300] : colors.primary[600])
                      : themeColors.text.primary,
                  },
                ]}
              >
                {d}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Lap Distances (if any) */}
      {lapCount > 0 && (
        <View style={[styles.card, { backgroundColor: themeColors.card.background, borderColor: themeColors.border.primary }]}>
          <Text style={[styles.sectionLabel, { color: themeColors.text.secondary }]}>
            Lap Gate Distances
          </Text>

          <View style={styles.lapList}>
            {lapDistances.map((distance, index) => (
              <View key={index} style={styles.lapRow}>
                <View style={[styles.lapBadge, { backgroundColor: colors.primary[500] }]}>
                  <Text style={styles.lapBadgeText}>LAP {index + 1}</Text>
                </View>
                <TextInput
                  style={[
                    styles.lapInput,
                    {
                      backgroundColor: themeColors.background.tertiary,
                      color: themeColors.text.primary,
                      borderColor: themeColors.border.primary,
                    },
                  ]}
                  value={distance.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num > 0 && num < totalDistance) {
                      updateLapDistance(index, num);
                    }
                  }}
                  keyboardType="number-pad"
                  placeholder="Distance"
                  placeholderTextColor={themeColors.text.tertiary}
                />
                <Text style={[styles.lapUnit, { color: themeColors.text.secondary }]}>m</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.hint, { color: themeColors.text.tertiary }]}>
            Lap gates must be between 0m and {totalDistance}m
          </Text>
        </View>
      )}

      {/* Visual Gate Layout */}
      <View style={styles.visualLayout}>
        <View style={styles.trackLine}>
          {/* Start */}
          <View style={styles.gateMarker}>
            <View style={[styles.gateIcon, { backgroundColor: colors.success[500] }]}>
              <Text style={styles.gateIconText}>
                {startMethod === 'sound' ? '🔊' : startMethod === 'thumb' ? '👍' : '🚩'}
              </Text>
            </View>
            <Text style={[styles.gateLabel, { color: themeColors.text.secondary }]}>
              {startMethod === 'sound' ? 'Start' : 'Start'}
            </Text>
            <Text style={[styles.gateDistance, { color: themeColors.text.tertiary }]}>0m</Text>
          </View>

          {/* Laps */}
          {lapDistances.map((distance, index) => (
            <View key={index} style={[styles.gateMarker, { left: `${(distance / totalDistance) * 100}%` }]}>
              <View style={[styles.gateIcon, { backgroundColor: colors.primary[500] }]}>
                <Text style={styles.gateIconText}>⏱</Text>
              </View>
              <Text style={[styles.gateLabel, { color: themeColors.text.secondary }]}>
                Lap {index + 1}
              </Text>
              <Text style={[styles.gateDistance, { color: themeColors.text.tertiary }]}>{distance}m</Text>
            </View>
          ))}

          {/* Finish */}
          <View style={[styles.gateMarker, styles.gateMarkerEnd]}>
            <View style={[styles.gateIcon, { backgroundColor: colors.error[500] }]}>
              <Text style={styles.gateIconText}>🏁</Text>
            </View>
            <Text style={[styles.gateLabel, { color: themeColors.text.secondary }]}>
              {startMethod === 'sound' && gateCount === 1 ? 'Finish' : 'Finish'}
            </Text>
            <Text style={[styles.gateDistance, { color: themeColors.text.tertiary }]}>{totalDistance}m</Text>
          </View>
        </View>
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
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  counterButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonDisabled: {
    opacity: 0.3,
  },
  counterButtonText: {
    fontSize: 28,
    fontWeight: typography.fontWeight.bold as '700',
  },
  counterDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  counterValue: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold as '700',
    fontVariant: ['tabular-nums'],
  },
  counterLabel: {
    fontSize: typography.fontSize.sm,
  },
  description: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  distanceOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  distanceOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  distanceText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  lapList: {
    gap: spacing.sm,
  },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lapBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  lapBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as '700',
    color: 'white',
  },
  lapInput: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
  },
  lapUnit: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  hint: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  visualLayout: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  trackLine: {
    height: 4,
    backgroundColor: colors.gray[300],
    borderRadius: 2,
    position: 'relative',
    marginVertical: 40,
  },
  gateMarker: {
    position: 'absolute',
    top: -36,
    left: 0,
    alignItems: 'center',
    transform: [{ translateX: -20 }],
  },
  gateMarkerEnd: {
    left: 'auto',
    right: 0,
    transform: [{ translateX: 20 }],
  },
  gateIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateIconText: {
    fontSize: 20,
  },
  gateLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
    marginTop: spacing.xs,
  },
  gateDistance: {
    fontSize: typography.fontSize.xs,
  },
});
