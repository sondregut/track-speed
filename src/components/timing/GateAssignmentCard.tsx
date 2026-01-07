/**
 * GateAssignmentCard - Shows and manages device assignments to gates
 *
 * Displays configured gates and which Bluetooth device is assigned to each.
 * Allows users to assign discovered devices to specific gate positions.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { Card } from '../ui';
import type { GateConfig, GateRole } from '../../types';
import type { BluetoothDevice, BluetoothDeviceRole } from '../../lib/sync';

interface GateAssignmentCardProps {
  /** Configured gates for this session */
  gates: GateConfig[];
  /** Discovered Bluetooth devices */
  discoveredDevices: BluetoothDevice[];
  /** Connected Bluetooth devices */
  connectedDevices: BluetoothDevice[];
  /** Update gate with device assignment */
  onAssignDevice: (gateIndex: number, device: BluetoothDevice | null) => void;
  /** Navigate to device sync screen */
  onConfigureDevices: () => void;
  /** This device's role (null if not assigned to a gate) */
  thisDeviceRole?: GateRole | null;
  /** Set this device's role */
  onSetThisDeviceRole?: (role: GateRole) => void;
}

const ROLE_CONFIG: Record<GateRole, { label: string; icon: string; color: string }> = {
  start: {
    label: 'START',
    icon: '🚩',
    color: colors.success[500],
  },
  finish: {
    label: 'FINISH',
    icon: '🏁',
    color: colors.error[500],
  },
  lap: {
    label: 'LAP',
    icon: '⏱',
    color: colors.primary[500],
  },
};

export function GateAssignmentCard({
  gates,
  discoveredDevices,
  connectedDevices,
  onAssignDevice,
  onConfigureDevices,
  thisDeviceRole,
  onSetThisDeviceRole,
}: GateAssignmentCardProps) {
  // Get all available devices (discovered + connected, deduplicated)
  const availableDevices = useMemo(() => {
    const deviceMap = new Map<string, BluetoothDevice>();
    discoveredDevices.forEach(d => deviceMap.set(d.id, d));
    connectedDevices.forEach(d => deviceMap.set(d.id, d));
    return Array.from(deviceMap.values());
  }, [discoveredDevices, connectedDevices]);

  // Get devices not assigned to any gate
  const unassignedDevices = useMemo(() => {
    const assignedIds = new Set(gates.map(g => g.deviceId).filter(Boolean));
    return availableDevices.filter(d => !assignedIds.has(d.id));
  }, [availableDevices, gates]);

  // Check if we have enough devices for all gates
  const hasEnoughDevices = availableDevices.length >= gates.length - 1; // -1 because this phone can be one gate

  return (
    <Card variant="default" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gate Assignments</Text>
        <TouchableOpacity onPress={onConfigureDevices}>
          <Text style={styles.configureLink}>Find Devices</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Assign phones to each gate position
      </Text>

      {/* This Device Role Selector */}
      {onSetThisDeviceRole && (
        <View style={styles.thisDeviceSection}>
          <Text style={styles.thisDeviceLabel}>This phone is:</Text>
          <View style={styles.roleSelector}>
            {(['start', 'lap', 'finish'] as GateRole[]).map((role) => {
              const config = ROLE_CONFIG[role];
              const isSelected = thisDeviceRole === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleButton,
                    { borderColor: config.color },
                    isSelected && { backgroundColor: config.color + '20' },
                  ]}
                  onPress={() => onSetThisDeviceRole(role)}
                >
                  <Text style={styles.roleIcon}>{config.icon}</Text>
                  <Text
                    style={[
                      styles.roleLabel,
                      { color: isSelected ? config.color : colors.text.secondary },
                    ]}
                  >
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Gate List */}
      <View style={styles.gateList}>
        {gates.map((gate, index) => {
          const config = ROLE_CONFIG[gate.role];
          const assignedDevice = availableDevices.find(d => d.id === gate.deviceId);
          const isThisDevice = thisDeviceRole === gate.role;

          return (
            <View key={index} style={styles.gateRow}>
              <View style={[styles.gateBadge, { backgroundColor: config.color }]}>
                <Text style={styles.gateBadgeIcon}>{config.icon}</Text>
                <Text style={styles.gateBadgeText}>{gate.distance_m}m</Text>
              </View>

              <View style={styles.gateInfo}>
                <Text style={styles.gateRoleText}>{config.label} Gate</Text>
                {isThisDevice ? (
                  <Text style={[styles.deviceAssigned, { color: config.color }]}>
                    This Phone
                  </Text>
                ) : assignedDevice ? (
                  <Text style={styles.deviceAssigned}>
                    {assignedDevice.name || 'Unknown Device'}
                  </Text>
                ) : (
                  <Text style={styles.deviceUnassigned}>Not assigned</Text>
                )}
              </View>

              {!isThisDevice && (
                <TouchableOpacity
                  style={styles.assignButton}
                  onPress={() => {
                    // If there's an unassigned device, assign it; otherwise clear
                    const nextDevice = unassignedDevices[0] || null;
                    onAssignDevice(index, assignedDevice ? null : nextDevice);
                  }}
                >
                  <Text style={styles.assignButtonText}>
                    {assignedDevice ? 'Clear' : 'Assign'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Unassigned Devices */}
      {unassignedDevices.length > 0 && (
        <View style={styles.unassignedSection}>
          <Text style={styles.unassignedLabel}>Available Devices:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.unassignedList}>
              {unassignedDevices.map((device) => (
                <View key={device.id} style={styles.unassignedDevice}>
                  <Text style={styles.unassignedDeviceName} numberOfLines={1}>
                    {device.name || 'Unknown'}
                  </Text>
                  {device.rssi && (
                    <Text style={styles.unassignedDeviceRssi}>
                      {device.rssi}dBm
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Status Message */}
      {!hasEnoughDevices && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Need {gates.length - 1 - availableDevices.length} more device(s)
          </Text>
          <TouchableOpacity onPress={onConfigureDevices}>
            <Text style={styles.warningLink}>Scan for Devices</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
  },
  configureLink: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[500],
    fontWeight: typography.fontWeight.medium as '500',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  // This device role selector
  thisDeviceSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  thisDeviceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    gap: spacing.xs,
  },
  roleIcon: {
    fontSize: typography.fontSize.base,
  },
  roleLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold as '600',
    letterSpacing: 0.5,
  },
  // Gate list
  gateList: {
    gap: spacing.sm,
  },
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  gateBadgeIcon: {
    fontSize: typography.fontSize.sm,
  },
  gateBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.white,
  },
  gateInfo: {
    flex: 1,
  },
  gateRoleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    color: colors.text.primary,
  },
  deviceAssigned: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  deviceUnassigned: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[500],
    fontStyle: 'italic',
  },
  assignButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary[500] + '20',
    borderRadius: borderRadius.sm,
  },
  assignButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[500],
    fontWeight: typography.fontWeight.medium as '500',
  },
  // Unassigned devices
  unassignedSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  unassignedLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  unassignedList: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  unassignedDevice: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  unassignedDeviceName: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    maxWidth: 100,
  },
  unassignedDeviceRssi: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  // Warning banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warning[500] + '15',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
  },
  warningLink: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    fontWeight: typography.fontWeight.semibold as '600',
    textDecorationLine: 'underline',
  },
});
