/**
 * GateControls - Role-specific controls for multi-gate timing
 *
 * Different UI based on device role:
 * - Start Gate: Large START button, broadcasts to all connected devices
 * - Finish Gate: Shows "Waiting for athlete", camera detection active
 * - Split Gate: Shows split point info, camera detection active
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, borderRadius, darkColors } from '../../constants/theme';
import type { BluetoothDeviceRole } from '../../lib/sync';
import type { TimingState } from '../../types';

interface GateControlsProps {
  role: BluetoothDeviceRole;
  timerState: TimingState;
  elapsedTime: number;
  isConnected: boolean;
  isSynced: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  disabled?: boolean;
  isDetecting?: boolean;  // True when camera is detecting athlete
  confidence?: number;    // Detection confidence (0-1)
}

export function GateControls({
  role,
  timerState,
  elapsedTime,
  isConnected,
  isSynced,
  onStart,
  onStop,
  onReset,
  disabled = false,
  isDetecting = false,
  confidence = 0,
}: GateControlsProps) {
  // Format elapsed time
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Start Gate: Large START button
  if (role === 'start') {
    return (
      <View style={styles.container}>
        <View style={styles.roleHeader}>
          <Text style={styles.roleIcon}>🚩</Text>
          <Text style={styles.roleLabel}>START GATE</Text>
        </View>

        {timerState === 'idle' && (
          <>
            <TouchableOpacity
              style={[
                styles.startButton,
                disabled && styles.buttonDisabled,
                !isSynced && styles.buttonWarning,
              ]}
              onPress={onStart}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>START</Text>
            </TouchableOpacity>
            {!isSynced && isConnected && (
              <Text style={styles.warningText}>Waiting for sync...</Text>
            )}
            {!isConnected && (
              <Text style={styles.warningText}>Connect devices first</Text>
            )}
          </>
        )}

        {timerState === 'running' && (
          <>
            <View style={styles.runningContainer}>
              <Text style={styles.runningLabel}>Timer Running</Text>
              <Text style={styles.runningTime}>{formatTime(elapsedTime)}</Text>
            </View>
            <Text style={styles.waitingText}>Waiting for finish gate...</Text>
          </>
        )}

        {timerState === 'stopped' && (
          <>
            <View style={styles.stoppedContainer}>
              <Text style={styles.stoppedLabel}>Run Complete</Text>
              <Text style={styles.stoppedTime}>{formatTime(elapsedTime)}</Text>
            </View>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={onReset}
              activeOpacity={0.8}
            >
              <Text style={styles.resetButtonText}>↺ RESET</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  // Finish Gate: Detection state + manual override
  if (role === 'finish') {
    return (
      <View style={styles.container}>
        <View style={styles.roleHeader}>
          <Text style={styles.roleIcon}>🏁</Text>
          <Text style={styles.roleLabel}>FINISH GATE</Text>
        </View>

        {timerState === 'idle' && (
          <View style={styles.idleContainer}>
            <Text style={styles.idleText}>Waiting for start signal...</Text>
            {!isSynced && isConnected && (
              <ActivityIndicator color={colors.warning[500]} style={styles.spinner} />
            )}
          </View>
        )}

        {timerState === 'running' && (
          <>
            <View style={styles.detectingContainer}>
              {isDetecting ? (
                <>
                  <View style={[styles.detectingDot, { backgroundColor: colors.timing.ready }]} />
                  <Text style={styles.detectingText}>
                    Athlete Detected ({Math.round(confidence * 100)}%)
                  </Text>
                </>
              ) : (
                <>
                  <View style={[styles.detectingDot, { backgroundColor: colors.gray[500] }]} />
                  <Text style={styles.detectingText}>Watching for athlete...</Text>
                </>
              )}
            </View>

            <Text style={styles.elapsedText}>{formatTime(elapsedTime)}</Text>

            {/* Manual stop override */}
            <TouchableOpacity
              style={styles.stopButton}
              onPress={onStop}
              activeOpacity={0.8}
            >
              <Text style={styles.stopButtonText}>STOP</Text>
            </TouchableOpacity>
            <Text style={styles.hintText}>Tap to manually stop</Text>
          </>
        )}

        {timerState === 'stopped' && (
          <>
            <View style={styles.stoppedContainer}>
              <Text style={styles.finishLabel}>FINISH TIME</Text>
              <Text style={styles.finishTime}>{formatTime(elapsedTime)}</Text>
            </View>
            <Text style={styles.sentText}>Result sent to start gate</Text>
          </>
        )}
      </View>
    );
  }

  // Split/Lap Gate: Similar to finish but shows split info
  return (
    <View style={styles.container}>
      <View style={styles.roleHeader}>
        <Text style={styles.roleIcon}>⏱</Text>
        <Text style={styles.roleLabel}>SPLIT GATE</Text>
      </View>

      {timerState === 'idle' && (
        <View style={styles.idleContainer}>
          <Text style={styles.idleText}>Waiting for start signal...</Text>
        </View>
      )}

      {timerState === 'running' && (
        <>
          <View style={styles.detectingContainer}>
            {isDetecting ? (
              <>
                <View style={[styles.detectingDot, { backgroundColor: colors.warning[500] }]} />
                <Text style={styles.detectingText}>
                  Athlete Approaching ({Math.round(confidence * 100)}%)
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.detectingDot, { backgroundColor: colors.gray[500] }]} />
                <Text style={styles.detectingText}>Watching for athlete...</Text>
              </>
            )}
          </View>

          <Text style={styles.elapsedText}>{formatTime(elapsedTime)}</Text>

          {/* Manual split trigger */}
          <TouchableOpacity
            style={styles.splitButton}
            onPress={onStop}
            activeOpacity={0.8}
          >
            <Text style={styles.splitButtonText}>SPLIT</Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>Tap to manually record split</Text>
        </>
      )}

      {timerState === 'stopped' && (
        <>
          <View style={styles.stoppedContainer}>
            <Text style={styles.splitLabel}>SPLIT TIME</Text>
            <Text style={styles.splitTime}>{formatTime(elapsedTime)}</Text>
          </View>
          <Text style={styles.sentText}>Split sent to host</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleIcon: {
    fontSize: 24,
  },
  roleLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold as '700',
    color: darkColors.white,
    letterSpacing: 2,
  },
  // Start button styles
  startButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.timing.ready,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.timing.ready,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  startButtonText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: darkColors.white,
    letterSpacing: 3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonWarning: {
    backgroundColor: colors.warning[500],
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[500],
    marginTop: spacing.md,
  },
  // Running state
  runningContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  runningLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.timing.ready,
    marginBottom: spacing.xs,
  },
  runningTime: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold as '700',
    color: darkColors.white,
    fontVariant: ['tabular-nums'],
  },
  waitingText: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
    fontStyle: 'italic',
  },
  // Stopped state
  stoppedContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  stoppedLabel: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
    marginBottom: spacing.xs,
  },
  stoppedTime: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold as '700',
    color: darkColors.white,
    fontVariant: ['tabular-nums'],
  },
  resetButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: darkColors.gray[700],
    borderRadius: borderRadius.full,
  },
  resetButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    color: darkColors.white,
  },
  // Finish gate styles
  idleContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  idleText: {
    fontSize: typography.fontSize.base,
    color: darkColors.gray[400],
    fontStyle: 'italic',
  },
  spinner: {
    marginTop: spacing.md,
  },
  detectingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: darkColors.black + '80',
    borderRadius: borderRadius.full,
  },
  detectingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detectingText: {
    fontSize: typography.fontSize.sm,
    color: darkColors.white,
  },
  elapsedText: {
    fontSize: 56,
    fontWeight: typography.fontWeight.bold as '700',
    color: darkColors.white,
    fontVariant: ['tabular-nums'],
    marginBottom: spacing.lg,
  },
  stopButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.timing.stopped,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.timing.stopped,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  stopButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    color: darkColors.white,
    letterSpacing: 2,
  },
  hintText: {
    fontSize: typography.fontSize.xs,
    color: darkColors.gray[500],
    marginTop: spacing.sm,
  },
  finishLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.timing.ready,
    marginBottom: spacing.xs,
  },
  finishTime: {
    fontSize: 56,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.timing.ready,
    fontVariant: ['tabular-nums'],
  },
  sentText: {
    fontSize: typography.fontSize.sm,
    color: colors.timing.ready,
    marginTop: spacing.md,
  },
  // Split gate styles
  splitButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.warning[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.warning[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  splitButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    color: darkColors.white,
    letterSpacing: 2,
  },
  splitLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[500],
    marginBottom: spacing.xs,
  },
  splitTime: {
    fontSize: 56,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.warning[500],
    fontVariant: ['tabular-nums'],
  },
});
