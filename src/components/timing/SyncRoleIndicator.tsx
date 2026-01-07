/**
 * SyncRoleIndicator - Shows the current device role in multi-gate sync
 *
 * Displays a badge indicating whether this device is:
 * - Start Gate: Triggers timer start, broadcasts to all connected devices
 * - Finish Gate: Detects athlete crossing, sends result back
 * - Split Gate: Records intermediate times
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import type { BluetoothDeviceRole } from '../../lib/sync';

interface SyncRoleIndicatorProps {
  role: BluetoothDeviceRole;
  distance?: number;  // Gate distance in meters (for display)
  isConnected: boolean;
  connectedCount: number;
  compact?: boolean;
}

const ROLE_CONFIG: Record<BluetoothDeviceRole, { label: string; icon: string; color: string }> = {
  start: {
    label: 'START GATE',
    icon: '🚩',
    color: colors.timing.ready,
  },
  finish: {
    label: 'FINISH GATE',
    icon: '🏁',
    color: colors.timing.stopped,
  },
  lap: {
    label: 'SPLIT GATE',
    icon: '⏱',
    color: colors.warning[500],
  },
};

export function SyncRoleIndicator({
  role,
  distance,
  isConnected,
  connectedCount,
  compact = false,
}: SyncRoleIndicatorProps) {
  const config = ROLE_CONFIG[role];

  if (compact) {
    return (
      <View style={[styles.compactContainer, { borderColor: config.color }]}>
        <Text style={styles.compactIcon}>{config.icon}</Text>
        <Text style={[styles.compactLabel, { color: config.color }]}>
          {role.toUpperCase()}
        </Text>
        {isConnected && (
          <View style={[styles.connectionDot, { backgroundColor: colors.timing.ready }]} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: config.color }]}>
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={styles.label}>{config.label}</Text>
        {distance !== undefined && (
          <Text style={styles.distance}>{distance}m</Text>
        )}
      </View>

      <View style={styles.statusRow}>
        <View style={[
          styles.connectionIndicator,
          { backgroundColor: isConnected ? colors.timing.ready : colors.gray[600] }
        ]}>
          <View style={[
            styles.connectionDot,
            { backgroundColor: isConnected ? colors.white : colors.gray[400] }
          ]} />
          <Text style={styles.connectionText}>
            {isConnected
              ? `${connectedCount} device${connectedCount !== 1 ? 's' : ''} connected`
              : 'Not connected'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  icon: {
    fontSize: typography.fontSize.xl,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.white,
    letterSpacing: 1,
  },
  distance: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.white,
    opacity: 0.9,
    marginLeft: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionText: {
    fontSize: typography.fontSize.xs,
    color: colors.white,
    opacity: 0.9,
  },
  // Compact mode styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
    backgroundColor: colors.black + '60',
  },
  compactIcon: {
    fontSize: typography.fontSize.sm,
  },
  compactLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold as '600',
    letterSpacing: 0.5,
  },
});
