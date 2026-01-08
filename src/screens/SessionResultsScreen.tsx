/**
 * SessionResultsScreen - View all results mid-session
 *
 * Shows results grouped by distance/run type for mixed sessions.
 * Allows user to continue training or finish session.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useTimingStore } from '../stores/timingStore';
import { TimingResult } from '../types';
import { formatVelocity } from '../utils/velocity';

// Format time from milliseconds to display string
function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const seconds = Math.floor(totalSeconds);
  const milliseconds = Math.round((totalSeconds - seconds) * 1000);
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
}

// Group results by distance
interface ResultGroup {
  distance_m: number;
  results: TimingResult[];
  bestTime: number;
  avgTime: number;
}

function groupResultsByDistance(results: TimingResult[]): ResultGroup[] {
  const groups: Map<number, TimingResult[]> = new Map();

  for (const result of results) {
    const distance = result.distance_m || 0;
    if (!groups.has(distance)) {
      groups.set(distance, []);
    }
    groups.get(distance)!.push(result);
  }

  const resultGroups: ResultGroup[] = [];
  for (const [distance_m, groupResults] of groups) {
    const times = groupResults.map((r) => r.time_ms);
    resultGroups.push({
      distance_m,
      results: groupResults,
      bestTime: Math.min(...times),
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    });
  }

  // Sort by distance
  return resultGroups.sort((a, b) => a.distance_m - b.distance_m);
}

interface ResultRowProps {
  result: TimingResult;
  index: number;
  isBest: boolean;
  onPress: () => void;
}

function ResultRow({ result, index, isBest, onPress }: ResultRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
      onPress={onPress}
    >
      <View style={styles.resultRowLeft}>
        <Text style={[styles.runNumber, isBest && styles.runNumberBest]}>
          #{index + 1}
        </Text>
        {isBest && (
          <View style={styles.bestBadge}>
            <Ionicons name="trophy" size={10} color={colors.warning[500]} />
          </View>
        )}
      </View>

      <View style={styles.resultRowCenter}>
        <Text style={[styles.resultTime, isBest && styles.resultTimeBest]}>
          {formatTime(result.time_ms)}s
        </Text>
        {result.velocity_ms && (
          <Text style={styles.resultVelocity}>
            {formatVelocity(result.velocity_ms, 'm/s', 2)}
          </Text>
        )}
      </View>

      <View style={styles.resultRowRight}>
        {result.finishPhotoUri && (
          <Image
            source={{ uri: result.finishPhotoUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
      </View>
    </Pressable>
  );
}

interface GroupSectionProps {
  group: ResultGroup;
  onResultPress: (result: TimingResult) => void;
}

function GroupSection({ group, onResultPress }: GroupSectionProps) {
  return (
    <View style={styles.groupSection}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>
          {group.distance_m > 0 ? `${group.distance_m}m` : 'Unknown Distance'}
        </Text>
        <View style={styles.groupStats}>
          <Text style={styles.groupStatLabel}>Best:</Text>
          <Text style={styles.groupStatValue}>{formatTime(group.bestTime)}s</Text>
          <Text style={styles.groupStatSeparator}>|</Text>
          <Text style={styles.groupStatLabel}>Avg:</Text>
          <Text style={styles.groupStatValue}>{formatTime(group.avgTime)}s</Text>
        </View>
      </View>

      {group.results.map((result, index) => (
        <ResultRow
          key={result.id}
          result={result}
          index={index}
          isBest={result.time_ms === group.bestTime}
          onPress={() => onResultPress(result)}
        />
      ))}
    </View>
  );
}

export function SessionResultsScreen() {
  const router = useRouter();
  const results = useTimingStore((state) => state.results);
  const sessionStartTime = useTimingStore((state) => state.sessionStartTime);
  const resetTimer = useTimingStore((state) => state.resetTimer);

  // Group results by distance
  const groups = useMemo(() => groupResultsByDistance(results), [results]);

  // Calculate session duration
  const sessionDuration = useMemo(() => {
    if (!sessionStartTime) return null;
    const durationMs = Date.now() - sessionStartTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [sessionStartTime]);

  // Navigation handlers
  const handleContinueTraining = () => {
    resetTimer();
    router.push('/timer');
  };

  const handleFinishSession = () => {
    router.push('/session-summary');
  };

  const handleResultPress = (result: TimingResult) => {
    router.push(`/run-result?resultId=${result.id}`);
  };

  if (results.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Session Results</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="timer-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Results Yet</Text>
          <Text style={styles.emptyText}>Complete a run to see your results here.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleContinueTraining}
          >
            <Ionicons name="play" size={24} color={colors.white} />
            <Text style={styles.primaryButtonText}>Start Training</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Session Results</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Session stats summary */}
      <View style={styles.sessionSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{results.length}</Text>
          <Text style={styles.summaryLabel}>Runs</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{groups.length}</Text>
          <Text style={styles.summaryLabel}>Distances</Text>
        </View>
        {sessionDuration && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{sessionDuration}</Text>
              <Text style={styles.summaryLabel}>Duration</Text>
            </View>
          </>
        )}
      </View>

      {/* Results list grouped by distance */}
      <FlatList
        data={groups}
        keyExtractor={(item) => `group-${item.distance_m}`}
        renderItem={({ item }) => (
          <GroupSection group={item} onResultPress={handleResultPress} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={handleContinueTraining}
        >
          <Ionicons name="play" size={24} color={colors.white} />
          <Text style={styles.primaryButtonText}>Continue Training</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.finishButton, pressed && styles.buttonPressed]}
          onPress={handleFinishSession}
        >
          <Ionicons name="flag" size={20} color={colors.error[500]} />
          <Text style={styles.finishButtonText}>Finish Session</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
  },

  // Session summary
  sessionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  summaryItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  summaryValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.primary,
  },

  // Group section
  groupSection: {
    marginBottom: spacing.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.tertiary,
  },
  groupTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginRight: spacing.xs,
  },
  groupStatValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  groupStatSeparator: {
    marginHorizontal: spacing.sm,
    color: colors.text.tertiary,
  },

  // Result row
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  resultRowPressed: {
    backgroundColor: colors.background.secondary,
  },
  resultRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  runNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
    color: colors.text.secondary,
  },
  runNumberBest: {
    color: colors.warning[500],
  },
  bestBadge: {
    marginLeft: spacing.xs,
  },
  resultRowCenter: {
    flex: 1,
  },
  resultTime: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  resultTimeBest: {
    color: colors.warning[500],
  },
  resultVelocity: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  resultRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumbnail: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
  },

  // List
  listContent: {
    paddingBottom: spacing.xl,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
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
