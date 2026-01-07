import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts';
import { spacing, typography, borderRadius } from '../constants/theme';
import { Header, Card, GlassCard, Button } from '../components/ui';
import { useSettingsStore, useSessionStore } from '../stores';
import { VelocityUnit, DistanceUnit } from '../types';

interface SettingsScreenProps {
  navigation: any;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { colors, isDark } = useTheme();

  // Selected option background - lighter in light mode, darker tint in dark mode
  const selectedOptionBg = isDark ? colors.primary[900] : colors.primary[50];
  const selectedOptionTextColor = isDark ? colors.primary[300] : colors.primary[600];
  const {
    ghostGate,
    timing,
    camera,
    display,
    units,
    updateGhostGate,
    updateTiming,
    updateCamera,
    updateDisplay,
    updateUnits,
    resetToDefaults,
  } = useSettingsStore();
  const { athletes } = useSessionStore();

  // Use Glass UI on iOS 26+ (adapts to light/dark via tintColor)
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const SettingsCard = useGlassUI ? GlassCard : Card;

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'This will reset all settings to their default values including theme. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => resetToDefaults(),
        },
      ]
    );
  };

  // Helper components with theme colors
  const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border.primary }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: colors.text.primary }]}>{label}</Text>
        {description && (
          <Text style={[styles.settingDescription, { color: colors.text.secondary }]}>{description}</Text>
        )}
      </View>
      {children}
    </View>
  );

  const LinkRow = ({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) => (
    <TouchableOpacity style={[styles.linkRow, { borderBottomColor: colors.border.primary }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.settingLabel, { color: colors.text.primary }]}>{label}</Text>
      <View style={styles.linkRight}>
        {value && <Text style={[styles.linkValue, { color: colors.text.secondary }]}>{value}</Text>}
        <Text style={[styles.chevron, { color: colors.text.tertiary }]}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Header
        title="Settings"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Quick Actions</Text>
          <SettingsCard variant="default">
            <LinkRow
              label="Manage Athletes"
              value={`${athletes.length} athlete${athletes.length !== 1 ? 's' : ''}`}
              onPress={() => navigation.navigate('AthleteList')}
            />
            <LinkRow
              label="Calibrate Ghost Gate"
              value={ghostGate.enabled ? 'Enabled' : 'Disabled'}
              onPress={() => navigation.navigate('GhostGateCalibration')}
            />
            <LinkRow
              label="Device Sync"
              value="Multi-phone timing"
              onPress={() => navigation.navigate('DeviceSync')}
            />
          </SettingsCard>
        </View>

        {/* Timing Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Timing</Text>
          <SettingsCard variant="default">
            <SettingRow
              label="Auto Detection"
              description="Automatically detect when athlete crosses gate"
            >
              <Switch
                value={timing.autoDetectionEnabled}
                onValueChange={(value) =>
                  updateTiming({ autoDetectionEnabled: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>

            <SettingRow
              label="Sub-Frame Interpolation"
              description="Improve timing precision beyond frame rate"
            >
              <Switch
                value={timing.subFrameInterpolation}
                onValueChange={(value) =>
                  updateTiming({ subFrameInterpolation: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>

            <SettingRow label="Sound Effects">
              <Switch
                value={timing.soundEnabled}
                onValueChange={(value) =>
                  updateTiming({ soundEnabled: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>

            <SettingRow label="Haptic Feedback">
              <Switch
                value={timing.vibrationEnabled}
                onValueChange={(value) =>
                  updateTiming({ vibrationEnabled: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>
          </SettingsCard>
        </View>

        {/* Ghost Gate Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Ghost Gate</Text>
          <SettingsCard variant="default">
            <SettingRow
              label="Enable Ghost Gate"
              description="Use background subtraction for faster detection"
            >
              <Switch
                value={ghostGate.enabled}
                onValueChange={(value) =>
                  updateGhostGate({ enabled: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>
          </SettingsCard>
        </View>

        {/* Camera Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Camera</Text>
          <SettingsCard variant="default">
            <SettingRow label="Torch / Flash">
              <Switch
                value={camera.torchEnabled}
                onValueChange={(value) =>
                  updateCamera({ torchEnabled: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>

            <SettingRow
              label="Stabilization"
              description="Reduce camera shake"
            >
              <Switch
                value={camera.stabilizationEnabled}
                onValueChange={(value) =>
                  updateCamera({ stabilizationEnabled: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>
          </SettingsCard>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Appearance</Text>
          <SettingsCard variant="default">
            <SettingRow
              label="Dark Mode"
              description="Light mode recommended for outdoor use"
            >
              <Switch
                value={display.theme === 'dark'}
                onValueChange={(value) =>
                  updateDisplay({ theme: value ? 'dark' : 'light' })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>
          </SettingsCard>
        </View>

        {/* Display Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Display</Text>
          <SettingsCard variant="default">
            <SettingRow
              label="Keep Screen Awake"
              description="Prevent screen from sleeping during timing"
            >
              <Switch
                value={display.keepScreenAwake}
                onValueChange={(value) =>
                  updateDisplay({ keepScreenAwake: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>

            <SettingRow label="Show Milliseconds">
              <Switch
                value={display.showMilliseconds}
                onValueChange={(value) =>
                  updateDisplay({ showMilliseconds: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>

            <SettingRow label="Large Timer Display">
              <Switch
                value={display.largeTimerDisplay}
                onValueChange={(value) =>
                  updateDisplay({ largeTimerDisplay: value })
                }
                trackColor={{ true: colors.primary[500] }}
              />
            </SettingRow>
          </SettingsCard>
        </View>

        {/* Units Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Units</Text>
          <SettingsCard variant="default">
            <View style={[styles.unitSection, { borderBottomColor: colors.border.primary }]}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Velocity</Text>
              <View style={styles.unitOptions}>
                {(['m/s', 'km/h', 'mph'] as VelocityUnit[]).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.unitOption,
                      { borderColor: colors.border.primary },
                      units.velocity === unit && {
                        borderColor: colors.primary[500],
                        backgroundColor: selectedOptionBg,
                      },
                    ]}
                    onPress={() => updateUnits({ velocity: unit })}
                  >
                    <Text
                      style={[
                        styles.unitOptionText,
                        { color: colors.text.secondary },
                        units.velocity === unit && { color: selectedOptionTextColor },
                      ]}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.unitSection}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Distance</Text>
              <View style={styles.unitOptions}>
                {([
                  { value: 'metric' as DistanceUnit, label: 'Metric (m)' },
                  { value: 'imperial' as DistanceUnit, label: 'Imperial (yd)' },
                ]).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.unitOption,
                      styles.unitOptionWide,
                      { borderColor: colors.border.primary },
                      units.distance === option.value && {
                        borderColor: colors.primary[500],
                        backgroundColor: selectedOptionBg,
                      },
                    ]}
                    onPress={() => updateUnits({ distance: option.value })}
                  >
                    <Text
                      style={[
                        styles.unitOptionText,
                        { color: colors.text.secondary },
                        units.distance === option.value && { color: selectedOptionTextColor },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </SettingsCard>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>About</Text>
          <SettingsCard variant="default">
            <View style={[styles.aboutRow, { borderBottomColor: colors.border.primary }]}>
              <Text style={[styles.aboutLabel, { color: colors.text.secondary }]}>Version</Text>
              <Text style={[styles.aboutValue, { color: colors.text.primary }]}>0.1.0</Text>
            </View>
            <View style={[styles.aboutRow, { borderBottomColor: colors.border.primary }]}>
              <Text style={[styles.aboutLabel, { color: colors.text.secondary }]}>Build</Text>
              <Text style={[styles.aboutValue, { color: colors.text.primary }]}>MVP</Text>
            </View>
          </SettingsCard>
        </View>

        {/* Reset Settings */}
        <View style={[styles.resetSection, { borderTopColor: colors.border.primary }]}>
          <Button
            title="Reset All Settings"
            variant="danger"
            onPress={handleResetSettings}
          />
          <Text style={[styles.resetHint, { color: colors.text.tertiary }]}>
            Resets theme, timing, camera, and all other settings to defaults
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    padding: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: 120,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: typography.fontSize.base,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  linkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkValue: {
    fontSize: typography.fontSize.sm,
  },
  chevron: {
    fontSize: typography.fontSize.xl,
    fontWeight: '300',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  aboutLabel: {
    fontSize: typography.fontSize.base,
  },
  aboutValue: {
    fontSize: typography.fontSize.base,
  },
  resetSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  resetHint: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  unitSection: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  unitOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  unitOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  unitOptionWide: {
    flex: 1,
    alignItems: 'center',
  },
  unitOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
});
