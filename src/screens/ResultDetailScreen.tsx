import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../contexts';
import { spacing, typography, borderRadius } from '../constants/theme';
import { Header, Button, Card, GlassCard } from '../components/ui';
import { useTimingStore, useSessionStore } from '../stores';
import { formatTime, calculateVelocity, formatVelocity, formatPace } from '../utils/timing';
import { formatDateTime, formatConfidence, getConfidenceLevel } from '../utils/formatting';
import { TimingResult } from '../types';

export function ResultDetailScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { results, updateResult, deleteResult } = useTimingStore();
  const { currentSession } = useSessionStore();

  // Use Glass UI on iOS 26+ (adapts to light/dark via tintColor)
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const ResultCard = useGlassUI ? GlassCard : Card;

  // Get result from route params or find by id
  const resultId = params.resultId as string;
  const result = results.find((r) => r.id === resultId);

  const [isEditing, setIsEditing] = useState(false);
  const [editedTime, setEditedTime] = useState(
    result ? formatTime(result.time_ms, { decimals: 3 }) : '0.000'
  );

  if (!result) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <Header
          title="Result"
          leftAction={
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.backText, { color: colors.primary[500] }]}>Back</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.text.secondary }]}>Result not found</Text>
        </View>
      </View>
    );
  }

  const distance = currentSession?.distance || 100;
  const velocity = calculateVelocity(distance, result.time_ms);
  const pace = (result.time_ms / 1000) * (100 / distance);
  const confidenceLevel = getConfidenceLevel(result.confidence);

  const handleSaveEdit = () => {
    const newTimeMs = parseFloat(editedTime) * 1000;
    if (isNaN(newTimeMs) || newTimeMs <= 0) {
      Alert.alert('Invalid Time', 'Please enter a valid time in seconds.');
      return;
    }

    updateResult(result.id, {
      time_ms: newTimeMs,
      source: 'manual_override',
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Result',
      'Are you sure you want to delete this result? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteResult(result.id);
            router.back();
          },
        },
      ]
    );
  };

  const getConfidenceColor = () => {
    switch (confidenceLevel) {
      case 'high':
        return colors.success[500];
      case 'medium':
        return colors.warning[500];
      case 'low':
        return colors.error[500];
      default:
        return colors.gray[500];
    }
  };

  const getSourceLabel = () => {
    switch (result.source) {
      case 'auto_detected':
        return 'Auto Detected';
      case 'manual_override':
        return 'Manually Edited';
      case 'manual_only':
        return 'Manual Entry';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Header
        title="Result Details"
        leftAction={
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary[500] }]}>Back</Text>
          </TouchableOpacity>
        }
        rightAction={
          !isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={[styles.editText, { color: colors.primary[500] }]}>Edit</Text>
            </TouchableOpacity>
          )
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Time Display */}
        <ResultCard variant="elevated" style={styles.mainCard}>
          {isEditing ? (
            <View style={styles.editContainer}>
              <Text style={[styles.editLabel, { color: colors.text.secondary }]}>Time (seconds)</Text>
              <TextInput
                style={[styles.timeInput, {
                  color: colors.primary[600],
                  backgroundColor: colors.gray[100],
                  borderColor: colors.border.primary
                }]}
                value={editedTime}
                onChangeText={setEditedTime}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.editActions}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setIsEditing(false);
                    setEditedTime(formatTime(result.time_ms, { decimals: 3 }));
                  }}
                />
                <Button title="Save" onPress={handleSaveEdit} />
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.mainTime, { color: colors.text.primary }]}>{formatTime(result.time_ms)}s</Text>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: colors.gray[500] }]}>
                  <Text style={[styles.badgeText, { color: colors.white }]}>{getSourceLabel()}</Text>
                </View>
                {result.confidence !== null && (
                  <View style={[styles.badge, { backgroundColor: getConfidenceColor() }]}>
                    <Text style={[styles.badgeText, { color: colors.white }]}>
                      {formatConfidence(result.confidence)} confidence
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ResultCard>

        {/* Performance Stats */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Performance</Text>
        <ResultCard variant="default">
          <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Distance</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{distance}m</Text>
          </View>
          <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Speed</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{formatVelocity(velocity)}</Text>
          </View>
          <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Pace (per 100m)</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{pace.toFixed(2)}s</Text>
          </View>
          {velocity > 0 && (
            <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Speed (km/h)</Text>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{(velocity * 3.6).toFixed(1)} km/h</Text>
            </View>
          )}
        </ResultCard>

        {/* Technical Details */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Technical Details</Text>
        <ResultCard variant="default">
          <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Start Method</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {result.startMethod.replace('_', ' ')}
            </Text>
          </View>
          <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Frame Number</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {result.frameNumber || 'N/A'}
            </Text>
          </View>
          {result.videoFrameRate && (
            <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Frame Rate</Text>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{result.videoFrameRate} fps</Text>
            </View>
          )}
          <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Detection Source</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{getSourceLabel()}</Text>
          </View>
        </ResultCard>

        {/* Session Info */}
        {currentSession && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Session</Text>
            <ResultCard variant="default">
              <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
                <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Session</Text>
                <Text style={[styles.statValue, { color: colors.text.primary }]}>{currentSession.name}</Text>
              </View>
              {currentSession.location && (
                <View style={[styles.statRow, { borderBottomColor: colors.border.primary }]}>
                  <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Location</Text>
                  <Text style={[styles.statValue, { color: colors.text.primary }]}>{currentSession.location}</Text>
                </View>
              )}
            </ResultCard>
          </>
        )}

        {/* Delete Button */}
        <View style={[styles.deleteSection, { borderTopColor: colors.border.primary }]}>
          <Button
            title="Delete Result"
            variant="danger"
            onPress={handleDelete}
          />
        </View>
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
  editText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 40,
  },
  mainCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  mainTime: {
    fontSize: typography.fontSize['5xl'],
    fontWeight: typography.fontWeight.bold as '700',
    fontVariant: ['tabular-nums'],
    marginBottom: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    textTransform: 'capitalize',
  },
  editContainer: {
    width: '100%',
    alignItems: 'center',
  },
  editLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  timeInput: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold as '700',
    textAlign: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minWidth: 200,
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: typography.fontSize.base,
  },
  statValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
    textTransform: 'capitalize',
  },
  deleteSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: typography.fontSize.lg,
  },
});
