/**
 * SessionSummaryScreen - End of session summary with export
 *
 * Shows:
 * - Session statistics (runs, best times, average times)
 * - All results with photos in a gallery view
 * - Export options (CSV, share)
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { File, Directory, Paths } from 'expo-file-system';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useTimingStore } from '../stores/timingStore';
import { TimingResult } from '../types';
import { formatVelocity, calculateAverageVelocity } from '../utils/velocity';

// Format time from milliseconds to display string
function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const seconds = Math.floor(totalSeconds);
  const milliseconds = Math.round((totalSeconds - seconds) * 1000);
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
}

// Format date for display
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format duration
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// Calculate statistics for a set of results
interface SessionStats {
  totalRuns: number;
  totalDistances: number;
  bestTime: number;
  worstTime: number;
  avgTime: number;
  avgVelocity: number | null;
  sessionDuration: number;
  distanceStats: Map<number, {
    count: number;
    best: number;
    avg: number;
  }>;
}

function calculateSessionStats(
  results: TimingResult[],
  sessionStartTime: number | null
): SessionStats {
  if (results.length === 0) {
    return {
      totalRuns: 0,
      totalDistances: 0,
      bestTime: 0,
      worstTime: 0,
      avgTime: 0,
      avgVelocity: null,
      sessionDuration: 0,
      distanceStats: new Map(),
    };
  }

  const times = results.map((r) => r.time_ms);
  const velocities = results
    .filter((r) => r.velocity_ms !== undefined)
    .map((r) => r.velocity_ms!);

  const distanceStats = new Map<number, { count: number; best: number; avg: number }>();
  for (const result of results) {
    const distance = result.distance_m || 0;
    if (!distanceStats.has(distance)) {
      distanceStats.set(distance, { count: 0, best: Infinity, avg: 0 });
    }
    const stat = distanceStats.get(distance)!;
    stat.count++;
    stat.best = Math.min(stat.best, result.time_ms);
  }

  // Calculate averages per distance
  for (const [distance, stat] of distanceStats) {
    const distanceResults = results.filter((r) => (r.distance_m || 0) === distance);
    const avgTime = distanceResults.reduce((sum, r) => sum + r.time_ms, 0) / distanceResults.length;
    stat.avg = avgTime;
  }

  return {
    totalRuns: results.length,
    totalDistances: distanceStats.size,
    bestTime: Math.min(...times),
    worstTime: Math.max(...times),
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    avgVelocity: velocities.length > 0 ? calculateAverageVelocity(velocities) : null,
    sessionDuration: sessionStartTime ? Date.now() - sessionStartTime : 0,
    distanceStats,
  };
}

// Generate CSV content from results
function generateCSV(results: TimingResult[]): string {
  const headers = ['Run #', 'Time (s)', 'Distance (m)', 'Velocity (m/s)', 'Start Method', 'Confidence'];
  const rows = results.map((result, index) => [
    index + 1,
    (result.time_ms / 1000).toFixed(3),
    result.distance_m || '',
    result.velocity_ms?.toFixed(2) || '',
    result.startMethod,
    result.confidence !== null ? (result.confidence * 100).toFixed(0) + '%' : 'Manual',
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

interface PhotoModalProps {
  visible: boolean;
  result: TimingResult | null;
  runNumber: number;
  onClose: () => void;
}

function PhotoModal({ visible, result, runNumber, onClose }: PhotoModalProps) {
  if (!result) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Run #{runNumber}</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </Pressable>
          </View>

          {result.finishPhotoUri ? (
            <Image
              source={{ uri: result.finishPhotoUri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.noPhotoPlaceholder}>
              <Ionicons name="camera-outline" size={48} color={colors.gray[400]} />
              <Text style={styles.noPhotoText}>No photo captured</Text>
            </View>
          )}

          <View style={styles.modalStats}>
            <Text style={styles.modalTime}>{formatTime(result.time_ms)}s</Text>
            {result.velocity_ms && (
              <Text style={styles.modalVelocity}>
                {formatVelocity(result.velocity_ms, 'm/s', 2)}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export function SessionSummaryScreen() {
  const router = useRouter();
  const results = useTimingStore((state) => state.results);
  const sessionStartTime = useTimingStore((state) => state.sessionStartTime);
  const endSession = useTimingStore((state) => state.endSession);

  const [selectedResult, setSelectedResult] = useState<{
    result: TimingResult;
    index: number;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate stats
  const stats = useMemo(
    () => calculateSessionStats(results, sessionStartTime),
    [results, sessionStartTime]
  );

  // Session date
  const sessionDate = useMemo(() => {
    const timestamp = results.length > 0
      ? results[0].createdAt || new Date()
      : new Date();
    return formatDate(timestamp instanceof Date ? timestamp : new Date(timestamp));
  }, [results]);

  // Handle export
  const handleExport = async () => {
    if (results.length === 0) {
      Alert.alert('No Results', 'No results to export.');
      return;
    }

    setIsExporting(true);

    try {
      const csvContent = generateCSV(results);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `track-speed-session-${timestamp}.csv`;

      // Save to temporary file
      const exportDir = new Directory(Paths.cache, 'exports');
      if (!exportDir.exists) {
        await exportDir.create();
      }

      const csvFile = new File(exportDir, filename);
      await csvFile.write(csvContent);

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(csvFile.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Session Results',
        });
      } else {
        Alert.alert('Export Complete', `Results saved to ${filename}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Export Failed', 'Unable to export results. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle done - end session and go home
  const handleDone = () => {
    endSession();
    router.replace('/');
  };

  // Handle new session
  const handleNewSession = () => {
    endSession();
    router.replace('/session-setup');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Session Complete</Text>
        <Text style={styles.headerDate}>{sessionDate}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats summary card */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalRuns}</Text>
              <Text style={styles.statLabel}>Total Runs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatTime(stats.bestTime)}s</Text>
              <Text style={styles.statLabel}>Best Time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatTime(stats.avgTime)}s</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
          </View>

          {(stats.avgVelocity !== null || stats.sessionDuration > 0) && (
            <View style={[styles.statsRow, styles.statsRowSecondary]}>
              {stats.avgVelocity !== null && (
                <View style={styles.statItem}>
                  <Text style={styles.statValueSecondary}>
                    {formatVelocity(stats.avgVelocity, 'm/s', 2)}
                  </Text>
                  <Text style={styles.statLabel}>Avg Velocity</Text>
                </View>
              )}
              {stats.sessionDuration > 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statValueSecondary}>
                    {formatDuration(stats.sessionDuration)}
                  </Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Distance breakdown */}
        {stats.distanceStats.size > 1 && (
          <View style={styles.distanceSection}>
            <Text style={styles.sectionTitle}>By Distance</Text>
            {Array.from(stats.distanceStats.entries()).map(([distance, stat]) => (
              <View key={distance} style={styles.distanceRow}>
                <Text style={styles.distanceLabel}>
                  {distance > 0 ? `${distance}m` : 'Unknown'}
                </Text>
                <Text style={styles.distanceCount}>{stat.count} runs</Text>
                <Text style={styles.distanceBest}>Best: {formatTime(stat.best)}s</Text>
              </View>
            ))}
          </View>
        )}

        {/* Photo gallery */}
        <View style={styles.gallerySection}>
          <Text style={styles.sectionTitle}>Results Gallery</Text>
          <View style={styles.gallery}>
            {results.map((result, index) => (
              <Pressable
                key={result.id}
                style={({ pressed }) => [
                  styles.galleryItem,
                  pressed && styles.galleryItemPressed,
                ]}
                onPress={() => setSelectedResult({ result, index })}
              >
                {result.finishPhotoUri ? (
                  <Image
                    source={{ uri: result.finishPhotoUri }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.galleryPlaceholder}>
                    <Ionicons name="timer-outline" size={24} color={colors.gray[400]} />
                  </View>
                )}
                <View style={styles.galleryOverlay}>
                  <Text style={styles.galleryRunNumber}>#{index + 1}</Text>
                  <Text style={styles.galleryTime}>{formatTime(result.time_ms)}s</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleExport}
            disabled={isExporting}
          >
            <Ionicons
              name={isExporting ? 'hourglass' : 'share-outline'}
              size={20}
              color={colors.text.secondary}
            />
            <Text style={styles.secondaryButtonText}>
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleNewSession}
          >
            <Ionicons name="add" size={20} color={colors.text.secondary} />
            <Text style={styles.secondaryButtonText}>New Session</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={handleDone}
        >
          <Ionicons name="checkmark" size={24} color={colors.white} />
          <Text style={styles.primaryButtonText}>Done</Text>
        </Pressable>
      </View>

      {/* Photo modal */}
      <PhotoModal
        visible={selectedResult !== null}
        result={selectedResult?.result || null}
        runNumber={(selectedResult?.index || 0) + 1}
        onClose={() => setSelectedResult(null)}
      />
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
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.text.primary,
  },
  headerDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },

  // Stats card
  statsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statsRowSecondary: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  statValueSecondary: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.primary,
  },

  // Distance section
  distanceSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  distanceLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
    minWidth: 60,
  },
  distanceCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  distanceBest: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    color: colors.success[500],
    fontVariant: ['tabular-nums'],
  },

  // Gallery section
  gallerySection: {
    marginBottom: spacing.lg,
  },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  galleryItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: spacing.xs,
  },
  galleryItemPressed: {
    opacity: 0.7,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
  },
  galleryPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryOverlay: {
    position: 'absolute',
    bottom: spacing.xs + 4,
    left: spacing.xs + 4,
    right: spacing.xs + 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  galleryRunNumber: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
    color: colors.white,
  },
  galleryTime: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.text.primary,
  },
  modalClose: {
    padding: spacing.xs,
  },
  modalImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  noPhotoPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  modalStats: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalTime: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  modalVelocity: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Actions
  actions: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
    gap: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  buttonPressed: {
    opacity: 0.7,
  },
});
