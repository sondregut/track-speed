/**
 * RunResultScreen - Full-screen result view after each run
 *
 * Shows:
 * - Large time display with confidence badge
 * - Finish photo (if captured)
 * - Velocity and distance info
 * - Actions: Run Again, Change Setup, All Results, Finish Session
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { RunResultScreenProps } from '../types/navigation';
import { useTimingStore } from '../stores/timingStore';
import { formatVelocity, getVelocityRating } from '../utils/velocity';

// Format time from milliseconds to display string
function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const seconds = Math.floor(totalSeconds);
  const milliseconds = Math.round((totalSeconds - seconds) * 1000);
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
}

// Get confidence badge info
function getConfidenceBadge(confidence: number | null): {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  if (confidence === null) {
    return { label: 'Manual', color: colors.gray[500], icon: 'hand-left' };
  }
  if (confidence >= 0.9) {
    return { label: 'High Confidence', color: colors.success[500], icon: 'checkmark-circle' };
  }
  if (confidence >= 0.7) {
    return { label: 'Good', color: colors.warning[500], icon: 'checkmark' };
  }
  return { label: 'Low Confidence', color: colors.error[500], icon: 'alert-circle' };
}

export function RunResultScreen({ route, navigation }: RunResultScreenProps) {
  const insets = useSafeAreaInsets();
  const { resultId } = route.params;
  const results = useTimingStore((state) => state.results);
  const resetTimer = useTimingStore((state) => state.resetTimer);
  const endSession = useTimingStore((state) => state.endSession);

  // Look up the result by ID
  const result = useMemo(() => {
    const found = results.find((r) => r.id === resultId);
    console.log('[RunResult] Result lookup:', {
      id: resultId,
      hasFrameBuffer: !!(found?.frameBufferPath && found?.frameBufferCount),
      frameBufferPath: found?.frameBufferPath,
      frameBufferCount: found?.frameBufferCount,
      aiFrameIndex: found?.aiFrameIndex,
    });
    return found;
  }, [results, resultId]);

  // Calculate run number in session
  const runNumber = useMemo(() => {
    const index = results.findIndex((r) => r.id === resultId);
    return index >= 0 ? index + 1 : results.length;
  }, [results, resultId]);

  // Handle case where result is not found
  if (!result) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.text.primary }}>Result not found</Text>
        </View>
      </View>
    );
  }

  // Confidence badge
  const badge = getConfidenceBadge(result.confidence);

  // Velocity rating
  const velocityRating = result.velocity_ms ? getVelocityRating(result.velocity_ms) : null;
  const velocityColor =
    velocityRating === 'elite'
      ? colors.success[500]
      : velocityRating === 'advanced'
        ? colors.primary[500]
        : velocityRating === 'intermediate'
          ? colors.warning[500]
          : colors.gray[400];

  // Action handlers
  const handleRunAgain = () => {
    resetTimer();
    // Navigate to Timer - can't use goBack because we used reset() to get here
    navigation.navigate('Timer');
  };

  const handleChangeSetup = () => {
    endSession();
    navigation.reset({
      index: 0,
      routes: [{ name: 'SessionSetup' }],
    });
  };

  const handleViewAllResults = () => {
    navigation.navigate('SessionResults');
  };

  const handleFinishSession = () => {
    navigation.navigate('SessionSummary');
  };

  const handleReviewCrossing = () => {
    if (result?.frameBufferPath && result.frameBufferCount && result.aiFrameIndex !== undefined) {
      navigation.navigate('CrossingReview', {
        folderPath: result.frameBufferPath,
        frameCount: result.frameBufferCount,
        aiFrameIndex: result.aiFrameIndex,
        resultId: result.id,
      });
    }
  };

  // Check if frame buffer is available for review
  const canReviewCrossing = !!(result?.frameBufferPath && result.frameBufferCount);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with run number */}
        <View style={styles.header}>
          <Text style={styles.runLabel}>Run #{runNumber}</Text>
          <View style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
            <Ionicons name={badge.icon} size={14} color={badge.color} />
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Photo section - show placeholder if no photo */}
        {result.finishPhotoUri ? (
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: result.finishPhotoUri }}
              style={styles.photo}
              resizeMode="cover"
            />
            <View style={styles.photoOverlay}>
              <Ionicons name="camera" size={16} color={colors.white} />
              <Text style={styles.photoLabel}>Finish Photo</Text>
            </View>
            {/* Review Crossing button overlay */}
            {canReviewCrossing && (
              <Pressable
                style={({ pressed }) => [styles.reviewButton, pressed && styles.buttonPressed]}
                onPress={handleReviewCrossing}
              >
                <Ionicons name="images" size={16} color={colors.white} />
                <Text style={styles.reviewButtonText}>Review Crossing</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={48} color={colors.gray[400]} />
            <Text style={styles.photoPlaceholderText}>Photo capture coming soon</Text>
            {/* Show review button even without finish photo if frame buffer exists */}
            {canReviewCrossing && (
              <Pressable
                style={({ pressed }) => [styles.reviewButtonStandalone, pressed && styles.buttonPressed]}
                onPress={handleReviewCrossing}
              >
                <Ionicons name="images" size={18} color={colors.primary[500]} />
                <Text style={styles.reviewButtonStandaloneText}>Review Crossing Frames</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Main time display */}
        <View style={styles.timeSection}>
          <Text style={styles.timeLabel}>Time</Text>
          <Text style={styles.timeValue}>{formatTime(result.time_ms)}</Text>
          <Text style={styles.timeUnit}>seconds</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {/* Distance */}
          {result.distance_m && (
            <View style={styles.statCard}>
              <Ionicons name="resize" size={20} color={colors.primary[500]} />
              <Text style={styles.statValue}>{result.distance_m}m</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          )}

          {/* Velocity */}
          {result.velocity_ms && (
            <View style={styles.statCard}>
              <Ionicons name="speedometer" size={20} color={velocityColor} />
              <Text style={[styles.statValue, { color: velocityColor }]}>
                {formatVelocity(result.velocity_ms, 'm/s', 2)}
              </Text>
              <Text style={styles.statLabel}>Velocity</Text>
            </View>
          )}

          {/* Start method */}
          <View style={styles.statCard}>
            <Ionicons
              name={
                result.startMethod === 'sound'
                  ? 'volume-high'
                  : result.startMethod === 'thumb'
                    ? 'hand-left'
                    : 'scan'
              }
              size={20}
              color={colors.gray[400]}
            />
            <Text style={styles.statValue}>
              {result.startMethod.charAt(0).toUpperCase() + result.startMethod.slice(1)}
            </Text>
            <Text style={styles.statLabel}>Start</Text>
          </View>
        </View>

        {/* Run config info */}
        {result.runConfig && (
          <View style={styles.configSection}>
            <Text style={styles.configTitle}>Run Configuration</Text>
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>Session Type:</Text>
              <Text style={styles.configValue}>
                {result.runConfig.sessionType || 'Standard'}
              </Text>
            </View>
            {result.runConfig.flyInDistance_m && (
              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Fly-in:</Text>
                <Text style={styles.configValue}>{result.runConfig.flyInDistance_m}m</Text>
              </View>
            )}
          </View>
        )}

        {/* Session progress */}
        <View style={styles.sessionProgress}>
          <Text style={styles.sessionProgressText}>
            {results.length} run{results.length !== 1 ? 's' : ''} in this session
          </Text>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Primary action - Run Again */}
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={handleRunAgain}
        >
          <Ionicons name="play" size={24} color={colors.white} />
          <Text style={styles.primaryButtonText}>Run Again</Text>
        </Pressable>

        {/* Secondary actions row */}
        <View style={styles.secondaryRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={handleChangeSetup}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text.secondary} />
            <Text style={styles.secondaryButtonText}>Change Setup</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={handleViewAllResults}
          >
            <Ionicons name="list" size={20} color={colors.text.secondary} />
            <Text style={styles.secondaryButtonText}>All Results ({results.length})</Text>
          </Pressable>
        </View>

        {/* Finish session */}
        <Pressable
          style={({ pressed }) => [styles.finishButton, pressed && styles.buttonPressed]}
          onPress={handleFinishSession}
        >
          <Ionicons name="flag" size={20} color={colors.error[500]} />
          <Text style={styles.finishButtonText}>Finish Session</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  runLabel: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.text.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },

  // Photo
  photoContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  photoLabel: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border.primary,
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  reviewButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  reviewButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
  reviewButtonStandalone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  reviewButtonStandaloneText: {
    color: colors.primary[500],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },

  // Time display
  timeSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timeLabel: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  timeValue: {
    fontSize: typography.fontSize['7xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  timeUnit: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: -spacing.sm,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
  },
  statCard: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    minWidth: 100,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Config section
  configSection: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  configTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  configLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  configValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    color: colors.text.primary,
  },

  // Session progress
  sessionProgress: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  sessionProgressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },

  // Actions
  actions: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.white,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    color: colors.text.secondary,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  finishButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
    color: colors.error[500],
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
