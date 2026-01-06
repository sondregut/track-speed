import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../contexts';
import { spacing, typography, borderRadius } from '../constants/theme';
import { Header, Button, Card, GlassCard } from '../components/ui';
import { useSessionStore, useSettingsStore } from '../stores';
import {
  SessionType,
  StartMethod,
  GateConfig,
  GateRole,
  FLYING_DISTANCES,
  FLY_IN_DISTANCES,
  STANDARD_DISTANCES,
} from '../types';

// ============================================
// Session Type Configurations
// ============================================

const SESSION_TYPES: {
  value: SessionType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'flying',
    label: 'Flying Start',
    description: 'Max velocity testing',
    icon: '⚡',
  },
  {
    value: 'standing',
    label: 'Standing Start',
    description: 'From stationary',
    icon: '🏃',
  },
  {
    value: 'block_start',
    label: 'Block Start',
    description: 'Competition style',
    icon: '🎯',
  },
];

const START_METHODS: {
  value: StartMethod;
  label: string;
  description: string;
}[] = [
  {
    value: 'ready_set_go',
    label: 'Ready, Set, Go',
    description: 'Coach says commands, taps on "Go"',
  },
  {
    value: 'three_two_one',
    label: 'Three, Two, One, Go',
    description: 'Countdown then tap to start',
  },
  {
    value: 'touch',
    label: 'Touch',
    description: 'Touch anywhere, release to start',
  },
  {
    value: 'sound_detection',
    label: 'Sound Detection',
    description: 'Clap or starting gun triggers timer',
  },
];

export function SessionSetupScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const { createSession } = useSessionStore();
  const { timing } = useSettingsStore();

  // Use Glass UI on iOS 26+ (adapts to light/dark via tintColor)
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const PreviewCard = useGlassUI ? GlassCard : Card;

  // Form state
  const [sessionName, setSessionName] = useState('');
  const [location, setLocation] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('flying');
  const [startMethod, setStartMethod] = useState<StartMethod>(timing.defaultStartMethod);

  // Flying start config
  const [flyingDistance, setFlyingDistance] = useState<number>(10);
  const [flyInDistance, setFlyInDistance] = useState<number>(30);

  // Standing/Block start config
  const [standardDistance, setStandardDistance] = useState<number>(30);

  // Multi-gate splits config
  const [splitsEnabled, setSplitsEnabled] = useState(false);
  const [customGates, setCustomGates] = useState<GateConfig[]>([
    { role: 'start', distance_m: 0 },
    { role: 'finish', distance_m: 50 },
  ]);
  const [newGateDistance, setNewGateDistance] = useState('');

  // Add a new lap gate
  const addGate = () => {
    const distance = parseInt(newGateDistance, 10);
    if (isNaN(distance) || distance <= 0) return;

    // Check if gate already exists at this distance
    if (customGates.some(g => g.distance_m === distance)) return;

    const newGate: GateConfig = { role: 'lap', distance_m: distance };
    const updatedGates = [...customGates, newGate].sort((a, b) => a.distance_m - b.distance_m);

    // Update roles based on position
    const finalGates = updatedGates.map((gate, index) => ({
      ...gate,
      role: index === 0 ? 'start' as GateRole :
            index === updatedGates.length - 1 ? 'finish' as GateRole :
            'lap' as GateRole,
    }));

    setCustomGates(finalGates);
    setNewGateDistance('');
  };

  // Remove a gate
  const removeGate = (distance: number) => {
    if (customGates.length <= 2) return; // Keep at least start and finish

    const updatedGates = customGates.filter(g => g.distance_m !== distance);

    // Update roles based on position
    const finalGates = updatedGates.map((gate, index) => ({
      ...gate,
      role: index === 0 ? 'start' as GateRole :
            index === updatedGates.length - 1 ? 'finish' as GateRole :
            'lap' as GateRole,
    }));

    setCustomGates(finalGates);
  };

  // Update finish gate distance
  const updateFinishDistance = (distance: number) => {
    const updatedGates = customGates.map(gate =>
      gate.role === 'finish' ? { ...gate, distance_m: distance } : gate
    );
    setCustomGates(updatedGates);
  };

  // Generate session name based on config
  const generatedName = useMemo(() => {
    if (sessionName.trim()) return sessionName.trim();

    if (sessionType === 'flying') {
      return `Flying ${flyingDistance}m`;
    } else if (sessionType === 'standing') {
      return `${standardDistance}m Standing`;
    } else {
      return `${standardDistance}m Block Start`;
    }
  }, [sessionName, sessionType, flyingDistance, standardDistance]);

  // Get effective distance for display
  const effectiveDistance = sessionType === 'flying' ? flyingDistance : standardDistance;

  const handleStartSession = () => {
    const session: Parameters<typeof createSession>[0] = {
      name: generatedName,
      location: location.trim() || undefined,
      sessionType,
      startMethod,
    };

    if (sessionType === 'flying') {
      session.flyingConfig = {
        flyingDistance_m: flyingDistance,
        flyInDistance_m: flyInDistance,
      };
      session.distance = flyingDistance; // Legacy field
    } else {
      session.standardConfig = {
        totalDistance_m: standardDistance,
      };
      session.distance = standardDistance; // Legacy field
    }

    if (splitsEnabled && customGates.length >= 2) {
      // Use custom gate configuration
      const lapGates = customGates.filter(g => g.role === 'lap');
      const finishGate = customGates.find(g => g.role === 'finish');

      session.splitConfig = {
        enabled: true,
        distances_m: lapGates.map(g => g.distance_m),
        gates: customGates,
      };

      // Update distance to finish gate distance
      if (finishGate) {
        session.distance = finishGate.distance_m;
        if (sessionType === 'flying' && session.flyingConfig) {
          session.flyingConfig.flyingDistance_m = finishGate.distance_m;
        } else if (session.standardConfig) {
          session.standardConfig.totalDistance_m = finishGate.distance_m;
        }
      }
    }

    createSession(session);
    navigation.navigate('Timer' as never);
  };

  const handleConfigureGates = () => {
    navigation.navigate('DeviceSync' as never);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Header
        title="New Session"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.cancelText, { color: colors.primary[500] }]}>Cancel</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Session Type */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Session Type</Text>
          <View style={styles.typeGrid}>
            {SESSION_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeCard,
                  { backgroundColor: colors.card.background, borderColor: colors.border.primary },
                  sessionType === type.value && {
                    borderColor: colors.primary[500],
                    backgroundColor: colors.primary[50],
                  },
                ]}
                onPress={() => setSessionType(type.value)}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    { color: colors.text.primary },
                    sessionType === type.value && { color: colors.primary[600] },
                  ]}
                >
                  {type.label}
                </Text>
                <Text
                  style={[
                    styles.typeDescription,
                    { color: colors.text.secondary },
                  ]}
                  numberOfLines={2}
                >
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Flying Start Configuration */}
        {sessionType === 'flying' && (
          <>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>Flying Distance (Timed Zone)</Text>
              <View style={styles.optionsRow}>
                {FLYING_DISTANCES.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.distanceOption,
                      { backgroundColor: colors.card.background, borderColor: colors.border.primary },
                      flyingDistance === d && { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
                    ]}
                    onPress={() => setFlyingDistance(d)}
                  >
                    <Text
                      style={[
                        styles.distanceText,
                        { color: colors.text.secondary },
                        flyingDistance === d && { color: colors.primary[600] },
                      ]}
                    >
                      {d}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>Fly-In Distance (Acceleration Zone)</Text>
              <Text style={[styles.hint, { color: colors.text.tertiary }]}>
                Build up to max speed before timing starts
              </Text>
              <View style={styles.optionsRow}>
                {FLY_IN_DISTANCES.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.distanceOption,
                      { backgroundColor: colors.card.background, borderColor: colors.border.primary },
                      flyInDistance === d && { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
                    ]}
                    onPress={() => setFlyInDistance(d)}
                  >
                    <Text
                      style={[
                        styles.distanceText,
                        { color: colors.text.secondary },
                        flyInDistance === d && { color: colors.primary[600] },
                      ]}
                    >
                      {d}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Standing/Block Start Configuration */}
        {(sessionType === 'standing' || sessionType === 'block_start') && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Total Distance</Text>
            <View style={styles.distanceGrid}>
              {STANDARD_DISTANCES.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.distanceGridItem,
                    { backgroundColor: colors.card.background, borderColor: colors.border.primary },
                    standardDistance === d && { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
                  ]}
                  onPress={() => setStandardDistance(d)}
                >
                  <Text
                    style={[
                      styles.distanceText,
                      { color: colors.text.secondary },
                      standardDistance === d && { color: colors.primary[600] },
                    ]}
                  >
                    {d}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Start Method */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>Start Method</Text>
          <View style={styles.methodsContainer}>
            {START_METHODS.map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.methodOption,
                  { backgroundColor: colors.card.background, borderColor: colors.border.primary },
                  startMethod === method.value && { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
                ]}
                onPress={() => setStartMethod(method.value)}
              >
                <View style={styles.methodContent}>
                  <Text
                    style={[
                      styles.methodLabel,
                      { color: colors.text.primary },
                      startMethod === method.value && { color: colors.primary[600] },
                    ]}
                  >
                    {method.label}
                  </Text>
                  <Text style={[styles.methodDescription, { color: colors.text.secondary }]}>
                    {method.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    { borderColor: colors.border.secondary },
                    startMethod === method.value && { borderColor: colors.primary[500] },
                  ]}
                >
                  {startMethod === method.value && (
                    <View style={[styles.radioInner, { backgroundColor: colors.primary[500] }]} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Multi-Gate Configuration */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.toggleRow,
              { backgroundColor: colors.card.background, borderColor: colors.border.primary },
            ]}
            onPress={() => setSplitsEnabled(!splitsEnabled)}
          >
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.text.primary }]}>
                Multi-Phone Timing
              </Text>
              <Text style={[styles.toggleDescription, { color: colors.text.secondary }]}>
                Use multiple phones as Start, Lap, and Finish gates
              </Text>
            </View>
            <View
              style={[
                styles.toggle,
                { backgroundColor: splitsEnabled ? colors.primary[500] : colors.gray[300] },
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: splitsEnabled ? 20 : 0 }] },
                ]}
              />
            </View>
          </TouchableOpacity>

          {splitsEnabled && (
            <Card variant="default" style={styles.gateEditorCard}>
              <Text style={[styles.gateEditorTitle, { color: colors.text.primary }]}>
                Gate Positions
              </Text>
              <Text style={[styles.gateEditorHint, { color: colors.text.secondary }]}>
                Place phones at these distances from start
              </Text>

              {/* Gate List */}
              <View style={styles.gateList}>
                {customGates.map((gate, index) => (
                  <View
                    key={`${gate.role}-${gate.distance_m}`}
                    style={[styles.gateItem, { borderColor: colors.border.primary }]}
                  >
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
                    <Text style={[styles.gateDistance, { color: colors.text.primary }]}>
                      {gate.distance_m}m
                    </Text>
                    {gate.role === 'lap' && (
                      <TouchableOpacity
                        style={[styles.gateRemoveButton, { backgroundColor: colors.error[100] }]}
                        onPress={() => removeGate(gate.distance_m)}
                      >
                        <Text style={[styles.gateRemoveText, { color: colors.error[600] }]}>X</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Add Gate */}
              <View style={styles.addGateRow}>
                <TextInput
                  style={[
                    styles.addGateInput,
                    {
                      backgroundColor: colors.card.background,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                    },
                  ]}
                  value={newGateDistance}
                  onChangeText={setNewGateDistance}
                  placeholder="Distance (m)"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={[styles.addGateButton, { backgroundColor: colors.primary[500] }]}
                  onPress={addGate}
                >
                  <Text style={styles.addGateButtonText}>Add Lap Gate</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Add Buttons */}
              <View style={styles.quickAddRow}>
                <Text style={[styles.quickAddLabel, { color: colors.text.secondary }]}>Quick add:</Text>
                {[10, 20, 30, 40].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.quickAddButton,
                      { borderColor: colors.border.primary },
                      customGates.some(g => g.distance_m === d) && { opacity: 0.5 },
                    ]}
                    onPress={() => {
                      setNewGateDistance(d.toString());
                      setTimeout(addGate, 50);
                    }}
                    disabled={customGates.some(g => g.distance_m === d)}
                  >
                    <Text style={[styles.quickAddText, { color: colors.text.secondary }]}>{d}m</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Update Finish Distance */}
              <View style={styles.finishDistanceRow}>
                <Text style={[styles.finishDistanceLabel, { color: colors.text.secondary }]}>
                  Finish at:
                </Text>
                <View style={styles.finishOptions}>
                  {[30, 40, 50, 60, 100].map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.finishOption,
                        { borderColor: colors.border.primary },
                        customGates.find(g => g.role === 'finish')?.distance_m === d && {
                          borderColor: colors.primary[500],
                          backgroundColor: colors.primary[50],
                        },
                      ]}
                      onPress={() => updateFinishDistance(d)}
                    >
                      <Text
                        style={[
                          styles.finishOptionText,
                          { color: colors.text.secondary },
                          customGates.find(g => g.role === 'finish')?.distance_m === d && {
                            color: colors.primary[600],
                          },
                        ]}
                      >
                        {d}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Link to Device Sync */}
              <TouchableOpacity
                style={[styles.configureButton, { borderColor: colors.primary[500], marginTop: spacing.md }]}
                onPress={handleConfigureGates}
              >
                <Text style={[styles.configureButtonText, { color: colors.primary[500] }]}>
                  Connect Phones to Gates
                </Text>
              </TouchableOpacity>
            </Card>
          )}
        </View>

        {/* Session Name (optional) */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>Session Name (optional)</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.card.background,
              color: colors.text.primary,
              borderColor: colors.border.primary
            }]}
            value={sessionName}
            onChangeText={setSessionName}
            placeholder={generatedName}
            placeholderTextColor={colors.text.tertiary}
          />
        </View>

        {/* Location (optional) */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>Location (optional)</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.card.background,
              color: colors.text.primary,
              borderColor: colors.border.primary
            }]}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g., Track Field"
            placeholderTextColor={colors.text.tertiary}
          />
        </View>

        {/* Session Preview */}
        <PreviewCard variant="elevated" style={styles.previewCard}>
          <Text style={[styles.previewTitle, { color: colors.text.secondary }]}>Session Preview</Text>
          <View style={styles.previewRow}>
            <Text style={[styles.previewLabel, { color: colors.text.secondary }]}>Type</Text>
            <Text style={[styles.previewValue, { color: colors.text.primary }]}>
              {SESSION_TYPES.find((t) => t.value === sessionType)?.label}
            </Text>
          </View>
          {sessionType === 'flying' ? (
            <>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.text.secondary }]}>Timed Zone</Text>
                <Text style={[styles.previewValue, { color: colors.text.primary }]}>{flyingDistance}m</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.text.secondary }]}>Fly-In</Text>
                <Text style={[styles.previewValue, { color: colors.text.primary }]}>{flyInDistance}m</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.text.secondary }]}>Total Run</Text>
                <Text style={[styles.previewValue, { color: colors.primary[600] }]}>
                  {flyInDistance + flyingDistance}m
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.previewRow}>
              <Text style={[styles.previewLabel, { color: colors.text.secondary }]}>Distance</Text>
              <Text style={[styles.previewValue, { color: colors.text.primary }]}>{standardDistance}m</Text>
            </View>
          )}
          <View style={styles.previewRow}>
            <Text style={[styles.previewLabel, { color: colors.text.secondary }]}>Start</Text>
            <Text style={[styles.previewValue, { color: colors.text.primary }]}>
              {START_METHODS.find((m) => m.value === startMethod)?.label}
            </Text>
          </View>
          {splitsEnabled && (
            <>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.text.secondary }]}>Multi-Phone</Text>
                <Text style={[styles.previewValue, { color: colors.primary[600] }]}>
                  {customGates.length} gates
                </Text>
              </View>
              <View style={styles.previewGates}>
                {customGates.map((gate) => (
                  <View
                    key={`preview-${gate.distance_m}`}
                    style={[
                      styles.previewGateBadge,
                      {
                        backgroundColor:
                          gate.role === 'start' ? colors.success[100] :
                          gate.role === 'finish' ? colors.error[100] :
                          colors.primary[100],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.previewGateText,
                        {
                          color:
                            gate.role === 'start' ? colors.success[600] :
                            gate.role === 'finish' ? colors.error[600] :
                            colors.primary[600],
                        },
                      ]}
                    >
                      {gate.distance_m}m
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </PreviewCard>
      </ScrollView>

      {/* Start Button */}
      <SafeAreaView edges={['bottom']} style={[styles.footer, { borderTopColor: colors.border.primary, backgroundColor: colors.background.primary }]}>
        <Button
          title="Start Session"
          onPress={handleStartSession}
          size="large"
          style={{ backgroundColor: colors.timing.ready }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cancelText: {
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
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    marginTop: -spacing.xs,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
    minHeight: 100,
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  typeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  typeDescription: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  input: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  distanceOption: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  distanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  distanceGridItem: {
    width: '31%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  distanceText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  methodsContainer: {
    gap: spacing.sm,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  methodContent: {
    flex: 1,
  },
  methodLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: typography.fontSize.sm,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: typography.fontSize.sm,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
  },
  configureButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  configureButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  previewCard: {
    marginTop: spacing.md,
  },
  previewTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  previewLabel: {
    fontSize: typography.fontSize.sm,
  },
  previewValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
  },
  // Gate Editor Styles
  gateEditorCard: {
    marginTop: spacing.sm,
  },
  gateEditorTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: spacing.xs,
  },
  gateEditorHint: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  gateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  gateRoleBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  gateRoleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
    color: 'white',
  },
  gateDistance: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  gateRemoveButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  gateRemoveText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as '700',
  },
  addGateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  addGateInput: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
  },
  addGateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  addGateButtonText: {
    color: 'white',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickAddLabel: {
    fontSize: typography.fontSize.sm,
  },
  quickAddButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  quickAddText: {
    fontSize: typography.fontSize.sm,
  },
  finishDistanceRow: {
    gap: spacing.sm,
  },
  finishDistanceLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  finishOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  finishOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  finishOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
  // Preview gate badges
  previewGates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  previewGateBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  previewGateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
});
