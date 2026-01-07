/**
 * SyncStatusOverlay - Shows connection and sync status for multi-gate timing
 *
 * Displays:
 * - Connected devices with their roles
 * - Sync accuracy
 * - Last received timing event
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, typography, borderRadius, darkColors } from '../../constants/theme';
import type { BluetoothDevice, BluetoothConnectionState, BluetoothDeviceRole, BluetoothTimingEvent } from '../../lib/sync';

interface SyncStatusOverlayProps {
  connectionState: BluetoothConnectionState;
  connectedDevices: BluetoothDevice[];
  syncAccuracy: number;  // in ms
  lastEvent?: BluetoothTimingEvent | null;
  deviceRole: BluetoothDeviceRole;
  isHost: boolean;
  connectedClientCount?: number;
}

const ROLE_ICONS: Record<BluetoothDeviceRole, string> = {
  start: '🚩',
  finish: '🏁',
  lap: '⏱',
};

export function SyncStatusOverlay({
  connectionState,
  connectedDevices,
  syncAccuracy,
  lastEvent,
  deviceRole,
  isHost,
  connectedClientCount = 0,
}: SyncStatusOverlayProps) {
  const isConnected = connectionState === 'connected' || connectionState === 'synced';
  const isSynced = connectionState === 'synced';

  // Calculate total connected count (as host, count clients; as client, count devices)
  const totalConnected = isHost ? connectedClientCount : connectedDevices.length;

  if (totalConnected === 0 && !isHost) {
    return null; // Don't show if no connections
  }

  return (
    <View style={styles.container}>
      {/* Connection Status Header */}
      <View style={styles.header}>
        <View style={[
          styles.statusDot,
          { backgroundColor: isSynced ? colors.timing.ready : isConnected ? colors.warning[500] : colors.gray[500] }
        ]} />
        <Text style={styles.statusText}>
          {isSynced ? 'Synced' : isConnected ? 'Connecting...' : 'Searching...'}
        </Text>
        {isSynced && syncAccuracy < Infinity && (
          <Text style={styles.accuracyText}>±{syncAccuracy.toFixed(1)}ms</Text>
        )}
      </View>

      {/* Host mode: Show client count */}
      {isHost && (
        <View style={styles.hostInfo}>
          <Text style={styles.hostLabel}>HOSTING</Text>
          <Text style={styles.clientCount}>
            {connectedClientCount} client{connectedClientCount !== 1 ? 's' : ''} connected
          </Text>
        </View>
      )}

      {/* Client mode: Show connected devices */}
      {!isHost && connectedDevices.length > 0 && (
        <View style={styles.deviceList}>
          {connectedDevices.slice(0, 3).map((device) => (
            <View key={device.id} style={styles.deviceRow}>
              <Text style={styles.deviceIcon}>
                {ROLE_ICONS[device.role || 'finish']}
              </Text>
              <Text style={styles.deviceName} numberOfLines={1}>
                {device.name || 'Unknown Device'}
              </Text>
              {device.distance_m && (
                <Text style={styles.deviceDistance}>{device.distance_m}m</Text>
              )}
            </View>
          ))}
          {connectedDevices.length > 3 && (
            <Text style={styles.moreDevices}>
              +{connectedDevices.length - 3} more
            </Text>
          )}
        </View>
      )}

      {/* Last Event Display */}
      {lastEvent && (
        <View style={styles.lastEvent}>
          <Text style={styles.eventType}>
            {lastEvent.type === 'start' && '▶ START received'}
            {lastEvent.type === 'stop' && '⏹ STOP received'}
            {lastEvent.type === 'split' && '⏱ SPLIT received'}
            {lastEvent.type === 'reset' && '↺ RESET received'}
          </Text>
          {lastEvent.data?.time_ms && (
            <Text style={styles.eventTime}>
              {(lastEvent.data.time_ms / 1000).toFixed(3)}s
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: darkColors.black + 'CC',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    color: darkColors.white,
  },
  accuracyText: {
    fontSize: typography.fontSize.xs,
    color: darkColors.gray[400],
    marginLeft: 'auto',
  },
  hostInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: darkColors.gray[700],
  },
  hostLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.timing.ready,
    letterSpacing: 1,
  },
  clientCount: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[300],
    marginTop: spacing.xs,
  },
  deviceList: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: darkColors.gray[700],
    gap: spacing.xs,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deviceIcon: {
    fontSize: typography.fontSize.sm,
  },
  deviceName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: darkColors.white,
  },
  deviceDistance: {
    fontSize: typography.fontSize.xs,
    color: darkColors.gray[400],
  },
  moreDevices: {
    fontSize: typography.fontSize.xs,
    color: darkColors.gray[500],
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  lastEvent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: darkColors.gray[700],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventType: {
    fontSize: typography.fontSize.sm,
    color: darkColors.white,
  },
  eventTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.timing.ready,
    fontVariant: ['tabular-nums'],
  },
});
