import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { formatTime } from '../../utils/timing';
import { TimingState } from '../../types';

interface TimerDisplayProps {
  time: number; // milliseconds
  state: TimingState;
  size?: 'small' | 'medium' | 'large';
  showMilliseconds?: boolean;
}

export function TimerDisplay({
  time,
  state,
  size = 'large',
  showMilliseconds = true,
}: TimerDisplayProps) {
  const formattedTime = formatTime(time, { decimals: showMilliseconds ? 2 : 0 });

  const getStateColor = () => {
    switch (state) {
      case 'idle':
        return colors.gray[400];
      case 'ready':
        return colors.timing.ready;
      case 'running':
        return colors.timing.active;
      case 'stopped':
        return colors.timing.stopped;
      default:
        return colors.white;
    }
  };

  return (
    <View style={[styles.container, styles[`${size}Container`]]}>
      <Text
        style={[
          styles.time,
          styles[`${size}Text`],
          { color: getStateColor() },
        ]}
      >
        {formattedTime}
      </Text>
      {state === 'running' && (
        <View style={styles.runningIndicator}>
          <View style={[styles.dot, { backgroundColor: colors.timing.active }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallContainer: {
    paddingVertical: spacing.xs,
  },
  mediumContainer: {
    paddingVertical: spacing.sm,
  },
  largeContainer: {
    paddingVertical: spacing.md,
  },
  time: {
    fontVariant: ['tabular-nums'],
    fontWeight: typography.fontWeight.bold as '700',
  },
  smallText: {
    fontSize: 32,
  },
  mediumText: {
    fontSize: 48,
  },
  largeText: {
    fontSize: 72,
  },
  runningIndicator: {
    marginTop: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
