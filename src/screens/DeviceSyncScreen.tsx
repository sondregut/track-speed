import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../contexts';
import { spacing, typography, borderRadius } from '../constants/theme';
import { Header, Button, Card, GlassCard } from '../components/ui';
import { useBluetoothSync, SessionMode } from '../hooks';
import { useSessionStore } from '../stores';
import { BluetoothDevice, DeviceRole } from '../lib/sync';
import { GateConfig, GateRole } from '../types';

const DEFAULT_ROLES: { value: DeviceRole; label: string; description: string }[] = [
  { value: 'start', label: 'Start Gate', description: 'Triggers timer start (0m)' },
  { value: 'finish', label: 'Finish Gate', description: 'Detects finish crossing' },
  { value: 'lap', label: 'Lap/Split Gate', description: 'Records split times' },
];

const SESSION_MODES: { value: SessionMode; label: string; description: string }[] = [
  { value: 'host', label: 'Host Session', description: 'Other phones connect to this device' },
  { value: 'client', label: 'Join Session', description: 'Connect to another host phone' },
];

export function DeviceSyncScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const [deviceName, setDeviceName] = useState(`${Platform.OS === 'ios' ? 'iPhone' : 'Android'} ${Math.floor(Math.random() * 100)}`);
  const [gateDistance, setGateDistance] = useState<number>(0);
  const [customDistanceInput, setCustomDistanceInput] = useState('');

  // Use Glass UI on iOS 26+ (adapts to light/dark via tintColor)
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const SyncCard = useGlassUI ? GlassCard : Card;

  // Theme-aware selection colors
  const selectedBg = isDark ? colors.primary[900] : colors.primary[50];
  const selectedTextColor = isDark ? colors.primary[300] : colors.primary[600];

  // Get configured gates from current session
  const { currentSession, updateSession } = useSessionStore();
  const configuredGates = useMemo(() => {
    return currentSession?.splitConfig?.gates || [];
  }, [currentSession]);

  const hasConfiguredGates = configuredGates.length >= 2;

  const {
    // Bluetooth state
    isBluetoothAvailable,
    hasPermissions,
    requestPermissions,
    // Session mode (host/client)
    sessionMode,
    setSessionMode,
    // Host mode
    isAdvertising,
    startHostSession,
    stopHostSession,
    connectedClientCount,
    // Device discovery (client mode)
    isScanning,
    discoveredDevices,
    startScan,
    stopScan,
    // Connection
    connectionState,
    connectedDevice,
    connect,
    disconnect,
    // Sync status
    isSynced,
    syncAccuracy,
    // Role and distance
    deviceRole,
    setDeviceRole,
    gateDistance: hookGateDistance,
    setGateDistance: setHookGateDistance,
    // Error
    error,
    clearError,
  } = useBluetoothSync({ deviceName, autoScan: false });

  // Show error alert
  useEffect(() => {
    if (error) {
      Alert.alert('Sync Error', error.message, [
        { text: 'OK', onPress: clearError },
      ]);
    }
  }, [error, clearError]);

  // Select a configured gate position
  const selectConfiguredGate = (gate: GateConfig) => {
    setDeviceRole(gate.role as DeviceRole);
    setGateDistance(gate.distance_m);
    setHookGateDistance(gate.distance_m);
  };

  // Handle Bluetooth permission request
  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (granted) {
      startScan();
    } else {
      Alert.alert(
        'Bluetooth Permissions Required',
        'Please enable Bluetooth permissions in Settings to connect with other devices.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle scan button press
  const handleStartScan = async () => {
    if (!hasPermissions) {
      await handleRequestPermissions();
    } else {
      startScan();
    }
  };

  const handleConnect = async (device: BluetoothDevice) => {
    if (connectedDevice?.id === device.id) {
      await disconnect();
    } else {
      await connect(device);
    }
  };

  const getConnectionStateColor = () => {
    switch (connectionState) {
      case 'connected':
      case 'syncing':
        return colors.warning[500];
      case 'synced':
        return colors.success[500];
      case 'error':
        return colors.error[500];
      default:
        return colors.gray[500];
    }
  };

  const getConnectionStateText = () => {
    switch (connectionState) {
      case 'disconnected':
        return 'Not Connected';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'syncing':
        return 'Synchronizing...';
      case 'synced':
        return `Synced (${syncAccuracy.toFixed(1)}ms)`;
      case 'error':
        return 'Connection Error';
    }
  };

  const getSyncQualityText = () => {
    if (syncAccuracy === Infinity) return 'Not synced';
    if (syncAccuracy < 5) return 'Excellent';
    if (syncAccuracy < 15) return 'Good';
    if (syncAccuracy < 30) return 'Fair';
    return 'Poor';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Header
        title="Device Sync"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: colors.primary[500] }]}>Back</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Bluetooth Status Card */}
        <SyncCard variant="elevated" style={styles.statusCard}>
          {!isBluetoothAvailable ? (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.error[500] }]} />
                <Text style={[styles.statusText, { color: colors.text.primary }]}>
                  Bluetooth Unavailable
                </Text>
              </View>
              <Text style={[styles.syncQuality, { color: colors.text.secondary }]}>
                Please enable Bluetooth in Settings
              </Text>
            </>
          ) : !hasPermissions ? (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.warning[500] }]} />
                <Text style={[styles.statusText, { color: colors.text.primary }]}>
                  Permissions Required
                </Text>
              </View>
              <Button
                title="Grant Bluetooth Access"
                variant="primary"
                size="small"
                onPress={handleRequestPermissions}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: getConnectionStateColor() }]} />
                <Text style={[styles.statusText, { color: colors.text.primary }]}>
                  {getConnectionStateText()}
                </Text>
              </View>
              {isSynced && (
                <Text style={[styles.syncQuality, { color: colors.text.secondary }]}>
                  Sync Quality: {getSyncQualityText()}
                </Text>
              )}
            </>
          )}
        </SyncCard>

        {/* Session Mode Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Session Mode
          </Text>
          <View style={styles.sessionModeContainer}>
            {SESSION_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.value}
                style={[
                  styles.sessionModeOption,
                  { backgroundColor: colors.card.background, borderColor: colors.border.primary },
                  sessionMode === mode.value && { borderColor: colors.primary[500], backgroundColor: selectedBg },
                ]}
                onPress={() => setSessionMode(mode.value)}
                disabled={isAdvertising || connectedDevice !== null}
              >
                <Text
                  style={[
                    styles.sessionModeLabel,
                    { color: colors.text.primary },
                    sessionMode === mode.value && { color: selectedTextColor },
                  ]}
                >
                  {mode.label}
                </Text>
                <Text style={[styles.sessionModeDescription, { color: colors.text.secondary }]}>
                  {mode.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Host Mode Controls */}
        {sessionMode === 'host' && (
          <SyncCard variant="elevated" style={styles.hostControlsCard}>
            <View style={styles.hostStatusRow}>
              <View style={styles.hostStatusInfo}>
                <Text style={[styles.hostStatusLabel, { color: colors.text.primary }]}>
                  {isAdvertising ? 'Hosting Session' : 'Not Hosting'}
                </Text>
                {isAdvertising && (
                  <Text style={[styles.connectedClientsText, { color: colors.text.secondary }]}>
                    {connectedClientCount === 0
                      ? 'Waiting for devices to connect...'
                      : `${connectedClientCount} device${connectedClientCount !== 1 ? 's' : ''} connected`}
                  </Text>
                )}
              </View>
              <View style={[
                styles.hostStatusIndicator,
                { backgroundColor: isAdvertising ? colors.success[500] : colors.gray[500] }
              ]} />
            </View>
            <Button
              title={isAdvertising ? 'Stop Hosting' : 'Start Hosting'}
              variant={isAdvertising ? 'secondary' : 'primary'}
              onPress={isAdvertising ? stopHostSession : startHostSession}
              style={{ marginTop: spacing.md }}
            />
            {isAdvertising && (
              <Text style={[styles.hostHint, { color: colors.text.tertiary }]}>
                Other devices can now find and connect to this phone
              </Text>
            )}
          </SyncCard>
        )}

        {/* Device Role Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            {hasConfiguredGates ? 'Assign to Gate Position' : 'My Role'}
          </Text>

          {hasConfiguredGates ? (
            // Show configured gates from session
            <>
              <Text style={[styles.sectionHint, { color: colors.text.tertiary }]}>
                Select which gate position this phone will be at
              </Text>
              <View style={styles.rolesContainer}>
                {configuredGates.map((gate) => {
                  const isSelected = deviceRole === gate.role && gateDistance === gate.distance_m;
                  const isAssigned = Boolean(gate.deviceId);
                  return (
                    <TouchableOpacity
                      key={`${gate.role}-${gate.distance_m}`}
                      style={[
                        styles.gateOption,
                        { backgroundColor: colors.card.background, borderColor: colors.border.primary },
                        isSelected && { borderColor: colors.primary[500], backgroundColor: selectedBg },
                        isAssigned && !isSelected && { opacity: 0.6 },
                      ]}
                      onPress={() => selectConfiguredGate(gate)}
                      disabled={connectedDevice !== null || (isAssigned && !isSelected)}
                    >
                      <View style={styles.gateOptionContent}>
                        <View
                          style={[
                            styles.gateRoleBadge,
                            {
                              backgroundColor:
                                gate.role === 'start' ? colors.success[500] :
                                gate.role === 'finish' ? colors.error[500] :
                                colors.primary[500],
                            },
                          ]}
                        >
                          <Text style={styles.gateRoleText}>
                            {gate.role.charAt(0).toUpperCase() + gate.role.slice(1)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.gateDistanceText,
                            { color: colors.text.primary },
                            isSelected && { color: selectedTextColor },
                          ]}
                        >
                          {gate.distance_m}m
                        </Text>
                      </View>
                      {isAssigned && (
                        <Text style={[styles.assignedText, { color: colors.text.tertiary }]}>
                          {gate.deviceName || 'Assigned'}
                        </Text>
                      )}
                      {isSelected && !isAssigned && (
                        <View style={[styles.selectedIndicator, { backgroundColor: colors.primary[500] }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            // Fallback to manual role selection
            <>
              <View style={styles.rolesContainer}>
                {DEFAULT_ROLES.map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleOption,
                      { backgroundColor: colors.card.background, borderColor: colors.border.primary },
                      deviceRole === role.value && { borderColor: colors.primary[500], backgroundColor: selectedBg },
                    ]}
                    onPress={() => {
                      setDeviceRole(role.value);
                      // Set default distance based on role
                      let defaultDistance = 15;
                      if (role.value === 'start') defaultDistance = 0;
                      else if (role.value === 'finish') defaultDistance = 30;
                      setGateDistance(defaultDistance);
                      setHookGateDistance(defaultDistance);
                    }}
                    disabled={connectedDevice !== null}
                  >
                    <Text
                      style={[
                        styles.roleLabel,
                        { color: colors.text.primary },
                        deviceRole === role.value && { color: selectedTextColor },
                      ]}
                    >
                      {role.label}
                    </Text>
                    <Text style={[styles.roleDescription, { color: colors.text.secondary }]}>
                      {role.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom distance input for manual mode */}
              <View style={styles.customDistanceRow}>
                <Text style={[styles.customDistanceLabel, { color: colors.text.secondary }]}>
                  Gate Distance:
                </Text>
                <TextInput
                  style={[
                    styles.customDistanceInput,
                    {
                      backgroundColor: colors.card.background,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                    },
                  ]}
                  value={gateDistance.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 0) {
                      setGateDistance(num);
                      setHookGateDistance(num);
                    } else if (text === '') {
                      setGateDistance(0);
                      setHookGateDistance(0);
                    }
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.text.tertiary}
                  editable={connectedDevice === null}
                />
                <Text style={[styles.customDistanceUnit, { color: colors.text.secondary }]}>m</Text>
              </View>
            </>
          )}
        </View>

        {/* Discovered Devices - Client Mode Only */}
        {sessionMode === 'client' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              Nearby Host Devices
            </Text>
            {isScanning ? (
              <TouchableOpacity onPress={stopScan}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleStartScan} disabled={!isBluetoothAvailable}>
                <Text style={[styles.scanButton, { color: isBluetoothAvailable ? colors.primary[500] : colors.gray[400] }]}>Scan</Text>
              </TouchableOpacity>
            )}
          </View>

          {discoveredDevices.length === 0 ? (
            <SyncCard variant="default">
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                {isScanning
                  ? 'Scanning for Track Speed devices via Bluetooth...'
                  : 'No devices found. Make sure Bluetooth is enabled on both phones and they are within range.'}
              </Text>
            </SyncCard>
          ) : (
            <View style={styles.devicesList}>
              {discoveredDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  onPress={() => handleConnect(device)}
                  activeOpacity={0.7}
                >
                  <SyncCard
                    variant={connectedDevice?.id === device.id ? 'elevated' : 'default'}
                    style={connectedDevice?.id === device.id && { borderWidth: 2, borderColor: colors.primary[500] }}
                  >
                    <View style={styles.deviceRow}>
                      <View style={styles.deviceInfo}>
                        <Text style={[styles.deviceName, { color: colors.text.primary }]}>
                          {device.name}
                        </Text>
                        <Text style={[styles.deviceDetails, { color: colors.text.secondary }]}>
                          {device.role}{device.distance_m !== undefined ? ` • ${device.distance_m}m` : ''} • Signal: {device.rssi}dBm
                        </Text>
                      </View>
                      {connectedDevice?.id === device.id ? (
                        <View style={[styles.connectedBadge, { backgroundColor: colors.success[500] }]}>
                          <Text style={[styles.connectedText, { color: colors.white }]}>
                            {isSynced ? 'Synced' : 'Connected'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.connectText, { color: colors.primary[500] }]}>
                          Connect
                        </Text>
                      )}
                    </View>
                  </SyncCard>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        )}

        {/* Instructions */}
        <SyncCard variant="default" style={styles.instructionsCard}>
          <Text style={[styles.instructionsTitle, { color: colors.text.primary }]}>
            Multi-Phone Setup (Bluetooth)
          </Text>
          <Text style={[styles.instructionsText, { color: colors.text.secondary }]}>
            {hasConfiguredGates ? (
              `1. Enable Bluetooth on all phones\n` +
              `2. On each phone, select its gate position (${configuredGates.map(g => g.distance_m + 'm').join(', ')})\n` +
              `3. Tap "Scan" to find nearby Track Speed devices\n` +
              `4. Connect to each device when it appears\n` +
              `5. Wait for time sync to complete (green status)`
            ) : (
              `1. Enable Bluetooth on both phones\n` +
              `2. Set one phone as "Start Gate", the other as "Finish Gate"\n` +
              `3. Tap "Scan" to find nearby Track Speed devices\n` +
              `4. Connect to the other device when it appears\n` +
              `5. Wait for time sync to complete (green status)`
            )}
          </Text>
        </SyncCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backText: {
    fontSize: typography.fontSize.base,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 40,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  syncQuality: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: spacing.sm,
  },
  scanButton: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  rolesContainer: {
    gap: spacing.sm,
  },
  roleOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  roleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
    marginBottom: 2,
  },
  roleDescription: {
    fontSize: typography.fontSize.sm,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  registerInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  registerLabel: {
    fontSize: typography.fontSize.base,
  },
  registerValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    marginTop: 2,
  },
  devicesList: {
    gap: spacing.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  deviceDetails: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  connectedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  connectedText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
  connectText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  instructionsCard: {
    marginTop: spacing.md,
  },
  instructionsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: spacing.sm,
  },
  instructionsText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
  },
  // New styles for gate configuration
  sectionHint: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  gateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  gateOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gateRoleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  gateRoleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold as '600',
    color: 'white',
  },
  gateDistanceText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
  },
  assignedText: {
    fontSize: typography.fontSize.xs,
  },
  selectedIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  customDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  customDistanceLabel: {
    fontSize: typography.fontSize.sm,
  },
  customDistanceInput: {
    width: 80,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  customDistanceUnit: {
    fontSize: typography.fontSize.sm,
  },
  // Session mode styles
  sessionModeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sessionModeOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  sessionModeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: 2,
  },
  sessionModeDescription: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  // Host controls styles
  hostControlsCard: {
    paddingVertical: spacing.lg,
  },
  hostStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostStatusInfo: {
    flex: 1,
  },
  hostStatusLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  connectedClientsText: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  hostStatusIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  hostHint: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
