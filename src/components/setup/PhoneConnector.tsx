/**
 * PhoneConnector - Connect and assign phones to gate positions
 *
 * Shows which phones are connected and assigns them to roles:
 * - This phone's role (Start, Lap, or Finish)
 * - Connected devices and their assigned roles
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useTheme } from '../../contexts';
import type { SimpleStartMethod, PhoneRole } from '../../types';

interface ConnectedDevice {
  id: string;
  name: string;
  role?: PhoneRole;
  isConnected: boolean;
}

interface PhoneConnectorProps {
  startMethod: SimpleStartMethod;
  gateCount: number;
  thisPhoneRole: PhoneRole;
  onThisPhoneRoleChange: (role: PhoneRole) => void;
  connectedDevices: ConnectedDevice[];
  isScanning: boolean;
  onStartScan: () => void;
  onStopScan: () => void;
  onAssignRole: (deviceId: string, role: PhoneRole) => void;
  lapDistances: number[];
  totalDistance: number;
}

const ROLE_CONFIG: Record<PhoneRole, { icon: string; color: string; label: string }> = {
  start: { icon: '🚩', color: colors.success[500], label: 'START' },
  lap: { icon: '⏱', color: colors.primary[500], label: 'LAP' },
  finish: { icon: '🏁', color: colors.error[500], label: 'FINISH' },
  start_finish: { icon: '🔊', color: colors.warning[500], label: 'START + FINISH' },
};

export function PhoneConnector({
  startMethod,
  gateCount,
  thisPhoneRole,
  onThisPhoneRoleChange,
  connectedDevices,
  isScanning,
  onStartScan,
  onStopScan,
  onAssignRole,
  lapDistances,
  totalDistance,
}: PhoneConnectorProps) {
  const { colors: themeColors, isDark } = useTheme();

  // Determine available roles based on start method and gate count
  const getAvailableRoles = (): PhoneRole[] => {
    if (startMethod === 'sound') {
      // Sound start: this phone is always start+finish
      if (gateCount === 1) return ['start_finish'];
      // With laps, this phone is start+finish, others are laps
      return ['start_finish'];
    }
    // Thumb/Gate: can be start, lap, or finish
    const roles: PhoneRole[] = ['start', 'finish'];
    if (gateCount > 2) {
      roles.splice(1, 0, 'lap');
    }
    return roles;
  };

  const availableRoles = getAvailableRoles();
  const neededDevices = startMethod === 'sound' ? gateCount - 1 : gateCount - 1;
  const connectedCount = connectedDevices.filter(d => d.isConnected).length;

  // Build gate assignment display
  const getGateAssignments = () => {
    const gates: { role: PhoneRole; distance: number; device?: string; isThisPhone: boolean }[] = [];

    if (startMethod === 'sound') {
      // This phone is start+finish
      gates.push({
        role: 'start_finish',
        distance: 0,
        device: 'This Phone',
        isThisPhone: true,
      });
      // Add lap gates for other phones
      lapDistances.forEach((dist, i) => {
        const device = connectedDevices.find(d => d.role === 'lap');
        gates.push({
          role: 'lap',
          distance: dist,
          device: device?.name,
          isThisPhone: false,
        });
      });
    } else {
      // Start gate
      if (thisPhoneRole === 'start') {
        gates.push({ role: 'start', distance: 0, device: 'This Phone', isThisPhone: true });
      } else {
        const device = connectedDevices.find(d => d.role === 'start');
        gates.push({ role: 'start', distance: 0, device: device?.name, isThisPhone: false });
      }

      // Lap gates
      lapDistances.forEach((dist, i) => {
        if (thisPhoneRole === 'lap') {
          gates.push({ role: 'lap', distance: dist, device: 'This Phone', isThisPhone: true });
        } else {
          const device = connectedDevices.find(d => d.role === 'lap');
          gates.push({ role: 'lap', distance: dist, device: device?.name, isThisPhone: false });
        }
      });

      // Finish gate
      if (thisPhoneRole === 'finish') {
        gates.push({ role: 'finish', distance: totalDistance, device: 'This Phone', isThisPhone: true });
      } else {
        const device = connectedDevices.find(d => d.role === 'finish');
        gates.push({ role: 'finish', distance: totalDistance, device: device?.name, isThisPhone: false });
      }
    }

    return gates;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: themeColors.text.primary }]}>
        Connect your phones
      </Text>

      {/* This Phone Role Selector */}
      {startMethod !== 'sound' && (
        <View style={[styles.card, { backgroundColor: themeColors.card.background, borderColor: themeColors.border.primary }]}>
          <Text style={[styles.sectionLabel, { color: themeColors.text.secondary }]}>
            This Phone Is
          </Text>
          <View style={styles.roleOptions}>
            {availableRoles.map((role) => {
              const config = ROLE_CONFIG[role];
              const isSelected = thisPhoneRole === role;

              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor: isSelected
                        ? config.color + '20'
                        : themeColors.background.tertiary,
                      borderColor: isSelected ? config.color : 'transparent',
                    },
                  ]}
                  onPress={() => onThisPhoneRoleChange(role)}
                >
                  <Text style={styles.roleIcon}>{config.icon}</Text>
                  <Text
                    style={[
                      styles.roleLabel,
                      { color: isSelected ? config.color : themeColors.text.primary },
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

      {/* Sound mode info */}
      {startMethod === 'sound' && (
        <View style={[styles.card, { backgroundColor: themeColors.card.background, borderColor: themeColors.border.primary }]}>
          <View style={styles.soundModeInfo}>
            <Text style={styles.soundIcon}>🔊</Text>
            <View style={styles.soundModeText}>
              <Text style={[styles.soundModeTitle, { color: themeColors.text.primary }]}>
                This Phone: Start + Finish
              </Text>
              <Text style={[styles.soundModeDesc, { color: themeColors.text.secondary }]}>
                Clap to start, run through to finish
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Gate Assignments */}
      <View style={[styles.card, { backgroundColor: themeColors.card.background, borderColor: themeColors.border.primary }]}>
        <Text style={[styles.sectionLabel, { color: themeColors.text.secondary }]}>
          Gate Assignments
        </Text>
        <View style={styles.gateList}>
          {getGateAssignments().map((gate, index) => {
            const config = ROLE_CONFIG[gate.role];
            return (
              <View key={index} style={styles.gateRow}>
                <View style={[styles.gateBadge, { backgroundColor: config.color }]}>
                  <Text style={styles.gateBadgeIcon}>{config.icon}</Text>
                  <Text style={styles.gateBadgeText}>{gate.distance}m</Text>
                </View>
                <View style={styles.gateInfo}>
                  <Text style={[styles.gateRole, { color: themeColors.text.primary }]}>
                    {config.label}
                  </Text>
                  {gate.device ? (
                    <Text style={[styles.gateDevice, { color: gate.isThisPhone ? config.color : themeColors.text.secondary }]}>
                      {gate.device}
                    </Text>
                  ) : (
                    <Text style={[styles.gateDeviceMissing, { color: colors.warning[500] }]}>
                      Not assigned
                    </Text>
                  )}
                </View>
                {gate.isThisPhone && (
                  <View style={[styles.thisPhoneBadge, { backgroundColor: config.color }]}>
                    <Text style={styles.thisPhoneBadgeText}>YOU</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Other Devices (if multi-phone) */}
      {neededDevices > 0 && (
        <View style={[styles.card, { backgroundColor: themeColors.card.background, borderColor: themeColors.border.primary }]}>
          <View style={styles.devicesHeader}>
            <Text style={[styles.sectionLabel, { color: themeColors.text.secondary }]}>
              Other Phones ({connectedCount}/{neededDevices})
            </Text>
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: colors.primary[500] }]}
              onPress={isScanning ? onStopScan : onStartScan}
            >
              {isScanning && <ActivityIndicator size="small" color="white" style={styles.scanSpinner} />}
              <Text style={styles.scanButtonText}>
                {isScanning ? 'Stop' : 'Scan'}
              </Text>
            </TouchableOpacity>
          </View>

          {connectedDevices.length === 0 ? (
            <View style={styles.emptyDevices}>
              <Text style={[styles.emptyText, { color: themeColors.text.tertiary }]}>
                {isScanning ? 'Searching for nearby phones...' : 'Tap Scan to find other phones'}
              </Text>
            </View>
          ) : (
            <View style={styles.deviceList}>
              {connectedDevices.map((device) => (
                <View
                  key={device.id}
                  style={[
                    styles.deviceRow,
                    {
                      backgroundColor: device.isConnected
                        ? (isDark ? colors.success[700] + '30' : colors.success[50])
                        : themeColors.background.tertiary,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.deviceStatus,
                      {
                        backgroundColor: device.isConnected
                          ? colors.success[500]
                          : colors.gray[400],
                      },
                    ]}
                  />
                  <Text
                    style={[styles.deviceName, { color: themeColors.text.primary }]}
                    numberOfLines={1}
                  >
                    {device.name}
                  </Text>
                  {device.role && (
                    <View
                      style={[
                        styles.deviceRoleBadge,
                        { backgroundColor: ROLE_CONFIG[device.role].color },
                      ]}
                    >
                      <Text style={styles.deviceRoleText}>
                        {ROLE_CONFIG[device.role].label}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {connectedCount < neededDevices && (
            <View style={[styles.warningBanner, { backgroundColor: colors.warning[500] + '15' }]}>
              <Text style={[styles.warningText, { color: colors.warning[600] }]}>
                Need {neededDevices - connectedCount} more phone{neededDevices - connectedCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      )}
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
  roleOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    gap: spacing.xs,
  },
  roleIcon: {
    fontSize: 20,
  },
  roleLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  soundModeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  soundIcon: {
    fontSize: 40,
  },
  soundModeText: {
    flex: 1,
  },
  soundModeTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  soundModeDesc: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
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
    color: 'white',
  },
  gateInfo: {
    flex: 1,
  },
  gateRole: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
  gateDevice: {
    fontSize: typography.fontSize.xs,
  },
  gateDeviceMissing: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  thisPhoneBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  thisPhoneBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as '700',
    color: 'white',
  },
  devicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  scanSpinner: {
    marginRight: spacing.xs,
  },
  scanButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    color: 'white',
  },
  emptyDevices: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  deviceList: {
    gap: spacing.xs,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  deviceStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  deviceRoleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  deviceRoleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
    color: 'white',
  },
  warningBanner: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
});
