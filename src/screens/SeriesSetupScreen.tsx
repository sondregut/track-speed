/**
 * SeriesSetupScreen - Configure interval/series training sessions
 *
 * Allows setting:
 * - Number of sets and reps
 * - Rest periods between reps and sets
 * - Distance per rep
 * - Target time (optional)
 * - Auto-advance setting
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../contexts';
import { spacing, typography, borderRadius } from '../constants/theme';
import { Header, Button, Card, GlassCard } from '../components/ui';
import { useSessionStore } from '../stores';
import { SeriesConfig, StartMethod } from '../types';

// Preset configurations
const PRESETS = {
  sprint: {
    name: 'Sprint Training',
    sets: 3,
    repsPerSet: 4,
    restBetweenReps: 60,
    restBetweenSets: 180,
    distance_m: 30,
  },
  speed_endurance: {
    name: 'Speed Endurance',
    sets: 2,
    repsPerSet: 6,
    restBetweenReps: 90,
    restBetweenSets: 300,
    distance_m: 60,
  },
  acceleration: {
    name: 'Acceleration Work',
    sets: 4,
    repsPerSet: 3,
    restBetweenReps: 120,
    restBetweenSets: 240,
    distance_m: 20,
  },
};

const DISTANCE_OPTIONS = [10, 20, 30, 40, 60, 100];
const SETS_OPTIONS = [1, 2, 3, 4, 5, 6];
const REPS_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

export function SeriesSetupScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { createSession } = useSessionStore();

  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const CardComponent = useGlassUI ? GlassCard : Card;

  // Form state
  const [sessionName, setSessionName] = useState('');
  const [sets, setSets] = useState(3);
  const [repsPerSet, setRepsPerSet] = useState(4);
  const [restBetweenReps, setRestBetweenReps] = useState(60);
  const [restBetweenSets, setRestBetweenSets] = useState(180);
  const [distance, setDistance] = useState(30);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [targetTime, setTargetTime] = useState('');
  const [startMethod, setStartMethod] = useState<StartMethod>('touch');

  // Calculated values
  const totalReps = sets * repsPerSet;
  const totalRestTime = useMemo(() => {
    const repRests = (repsPerSet - 1) * restBetweenReps * sets;
    const setRests = (sets - 1) * restBetweenSets;
    return repRests + setRests;
  }, [sets, repsPerSet, restBetweenReps, restBetweenSets]);

  // Apply preset
  const applyPreset = (preset: keyof typeof PRESETS) => {
    const config = PRESETS[preset];
    setSets(config.sets);
    setRepsPerSet(config.repsPerSet);
    setRestBetweenReps(config.restBetweenReps);
    setRestBetweenSets(config.restBetweenSets);
    setDistance(config.distance_m);
    setSessionName(config.name);
  };

  // Format time for display
  const formatRestTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Start session
  const handleStartSession = () => {
    const seriesConfig: SeriesConfig = {
      sets,
      repsPerSet,
      restBetweenReps,
      restBetweenSets,
      distance_m: distance,
      autoAdvance,
      targetTime_ms: targetTime ? parseFloat(targetTime) * 1000 : undefined,
    };

    const session = createSession({
      name: sessionName || `Series ${distance}m x ${totalReps}`,
      sessionType: 'series',
      seriesConfig,
      startMethod,
      distance,
    });

    navigation.navigate('Timer' as never, { sessionId: session.id } as never);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['bottom']}>
      <Header
        title="Series Training"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backButton, { color: colors.primary[500] }]}>Cancel</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Session Name */}
        <CardComponent variant="default" style={styles.card}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>Session Name</Text>
          <TextInput
            style={[styles.input, { color: colors.text.primary, borderColor: colors.border.primary }]}
            placeholder="e.g., Sprint Training"
            placeholderTextColor={colors.text.tertiary}
            value={sessionName}
            onChangeText={setSessionName}
          />
        </CardComponent>

        {/* Presets */}
        <CardComponent variant="default" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Quick Presets</Text>
          <View style={styles.presetRow}>
            {Object.entries(PRESETS).map(([key, preset]) => (
              <TouchableOpacity
                key={key}
                style={[styles.presetButton, { borderColor: colors.border.primary }]}
                onPress={() => applyPreset(key as keyof typeof PRESETS)}
              >
                <Text style={[styles.presetName, { color: colors.text.primary }]}>{preset.name}</Text>
                <Text style={[styles.presetDetail, { color: colors.text.tertiary }]}>
                  {preset.sets}x{preset.repsPerSet} @ {preset.distance_m}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </CardComponent>

        {/* Sets & Reps */}
        <CardComponent variant="default" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Sets & Reps</Text>

          <Text style={[styles.label, { color: colors.text.secondary }]}>Number of Sets</Text>
          <View style={styles.optionRow}>
            {SETS_OPTIONS.map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.optionButton,
                  { borderColor: colors.border.primary },
                  sets === num && { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
                ]}
                onPress={() => setSets(num)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text.primary },
                    sets === num && { color: colors.white },
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text.secondary }, { marginTop: spacing.md }]}>
            Reps per Set
          </Text>
          <View style={styles.optionRow}>
            {REPS_OPTIONS.map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.optionButton,
                  { borderColor: colors.border.primary },
                  repsPerSet === num && { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
                ]}
                onPress={() => setRepsPerSet(num)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text.primary },
                    repsPerSet === num && { color: colors.white },
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.totalRow, { backgroundColor: colors.background.tertiary }]}>
            <Text style={[styles.totalLabel, { color: colors.text.secondary }]}>Total Reps</Text>
            <Text style={[styles.totalValue, { color: colors.primary[500] }]}>{totalReps}</Text>
          </View>
        </CardComponent>

        {/* Distance */}
        <CardComponent variant="default" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Distance per Rep</Text>
          <View style={styles.optionRow}>
            {DISTANCE_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.optionButton,
                  { borderColor: colors.border.primary },
                  distance === d && { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
                ]}
                onPress={() => setDistance(d)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text.primary },
                    distance === d && { color: colors.white },
                  ]}
                >
                  {d}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </CardComponent>

        {/* Rest Periods */}
        <CardComponent variant="default" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Rest Periods</Text>

          <View style={styles.restRow}>
            <View style={styles.restItem}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>Between Reps</Text>
              <View style={styles.restButtons}>
                <TouchableOpacity
                  style={[styles.restAdjust, { borderColor: colors.border.primary }]}
                  onPress={() => setRestBetweenReps(Math.max(15, restBetweenReps - 15))}
                >
                  <Text style={[styles.restAdjustText, { color: colors.text.primary }]}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.restValue, { color: colors.text.primary }]}>
                  {formatRestTime(restBetweenReps)}
                </Text>
                <TouchableOpacity
                  style={[styles.restAdjust, { borderColor: colors.border.primary }]}
                  onPress={() => setRestBetweenReps(restBetweenReps + 15)}
                >
                  <Text style={[styles.restAdjustText, { color: colors.text.primary }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.restItem}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>Between Sets</Text>
              <View style={styles.restButtons}>
                <TouchableOpacity
                  style={[styles.restAdjust, { borderColor: colors.border.primary }]}
                  onPress={() => setRestBetweenSets(Math.max(30, restBetweenSets - 30))}
                >
                  <Text style={[styles.restAdjustText, { color: colors.text.primary }]}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.restValue, { color: colors.text.primary }]}>
                  {formatRestTime(restBetweenSets)}
                </Text>
                <TouchableOpacity
                  style={[styles.restAdjust, { borderColor: colors.border.primary }]}
                  onPress={() => setRestBetweenSets(restBetweenSets + 30)}
                >
                  <Text style={[styles.restAdjustText, { color: colors.text.primary }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[styles.totalRow, { backgroundColor: colors.background.tertiary }]}>
            <Text style={[styles.totalLabel, { color: colors.text.secondary }]}>Total Rest Time</Text>
            <Text style={[styles.totalValue, { color: colors.primary[500] }]}>
              {formatRestTime(totalRestTime)}
            </Text>
          </View>
        </CardComponent>

        {/* Options */}
        <CardComponent variant="default" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Options</Text>

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setAutoAdvance(!autoAdvance)}
          >
            <View>
              <Text style={[styles.toggleLabel, { color: colors.text.primary }]}>Auto-Advance</Text>
              <Text style={[styles.toggleDescription, { color: colors.text.tertiary }]}>
                Automatically start next rep after rest
              </Text>
            </View>
            <View
              style={[
                styles.toggle,
                { backgroundColor: autoAdvance ? colors.primary[500] : colors.gray[600] },
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  { backgroundColor: colors.white },
                  autoAdvance && styles.toggleKnobOn,
                ]}
              />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border.primary }]} />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Target Time (optional)</Text>
          <TextInput
            style={[styles.input, { color: colors.text.primary, borderColor: colors.border.primary }]}
            placeholder="e.g., 4.5 (seconds)"
            placeholderTextColor={colors.text.tertiary}
            value={targetTime}
            onChangeText={setTargetTime}
            keyboardType="decimal-pad"
          />
        </CardComponent>

        {/* Summary */}
        <CardComponent variant="elevated" style={[styles.card, styles.summaryCard]}>
          <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>Session Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.primary[500] }]}>{sets}</Text>
              <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Sets</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.primary[500] }]}>{repsPerSet}</Text>
              <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Reps/Set</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.primary[500] }]}>{distance}m</Text>
              <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Distance</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.primary[500] }]}>{totalReps}</Text>
              <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Total Reps</Text>
            </View>
          </View>
        </CardComponent>

        <View style={styles.buttonContainer}>
          <Button
            title="Start Series"
            onPress={handleStartSession}
            size="large"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  backButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
  },
  presetRow: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  presetButton: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  presetName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  presetDetail: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 50,
    alignItems: 'center',
  },
  optionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  totalLabel: {
    fontSize: typography.fontSize.sm,
  },
  totalValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
  },
  restRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  restItem: {
    flex: 1,
  },
  restButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  restAdjust: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restAdjustText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.medium as '500',
  },
  restValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  toggleDescription: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
  },
  toggleKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  toggleKnobOn: {
    transform: [{ translateX: 20 }],
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  summaryCard: {
    marginTop: spacing.sm,
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  buttonContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});

export default SeriesSetupScreen;
