import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts';
import { spacing, typography, borderRadius } from '../../constants/theme';
import { formatTime } from '../../utils/timing';
import { formatConfidence, getConfidenceLevel } from '../../utils/formatting';
import {
  calculateVelocity,
  formatVelocity,
  convertVelocity,
} from '../../utils/velocity';
import { TimingResult, SessionType, VelocityUnit } from '../../types';
import { Card } from '../ui/Card';
import { useSettingsStore } from '../../stores';

interface ResultCardProps {
  result: TimingResult;
  distance?: number;
  sessionType?: SessionType;
  onPress?: () => void;
  onEdit?: () => void;
  showDetails?: boolean;
}

export function ResultCard({
  result,
  distance,
  sessionType,
  onPress,
  onEdit,
  showDetails = true,
}: ResultCardProps) {
  const { colors } = useTheme();
  const { units } = useSettingsStore();

  // Use result's distance if available, fall back to prop
  const effectiveDistance = result.distance_m || distance;

  // Calculate velocity - use stored velocity or calculate from distance/time
  const velocity_ms = result.velocity_ms ||
    (effectiveDistance ? calculateVelocity(effectiveDistance, result.time_ms) : null);

  const confidenceLevel = getConfidenceLevel(result.confidence);

  // Determine session type from result or prop
  const effectiveSessionType = result.sessionType || sessionType;

  const getSourceLabel = () => {
    switch (result.source) {
      case 'auto_detected':
        return 'Auto';
      case 'manual_override':
        return 'Edited';
      case 'manual_only':
        return 'Manual';
    }
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

  const getSessionTypeLabel = () => {
    switch (effectiveSessionType) {
      case 'flying':
        return 'Flying';
      case 'standing':
        return 'Standing';
      case 'block_start':
        return 'Block';
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Card variant="elevated" padding="medium">
        <View style={styles.header}>
          <View style={styles.timeContainer}>
            <Text style={[styles.time, { color: colors.text.primary }]}>
              {formatTime(result.time_ms)}s
            </Text>
            {velocity_ms && (
              <Text style={[styles.velocity, { color: colors.primary[600] }]}>
                {formatVelocity(velocity_ms, units.velocity)}
              </Text>
            )}
          </View>
          <View style={styles.badges}>
            {effectiveSessionType && (
              <View style={[styles.badge, { backgroundColor: colors.primary[500] }]}>
                <Text style={[styles.badgeText, { color: colors.white }]}>
                  {getSessionTypeLabel()}
                </Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: colors.gray[500] }]}>
              <Text style={[styles.badgeText, { color: colors.white }]}>{getSourceLabel()}</Text>
            </View>
            {result.confidence !== null && (
              <View style={[styles.badge, { backgroundColor: getConfidenceColor() }]}>
                <Text style={[styles.badgeText, { color: colors.white }]}>
                  {formatConfidence(result.confidence)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {showDetails && (
          <View style={styles.details}>
            {effectiveDistance && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Distance</Text>
                <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                  {effectiveDistance}m
                </Text>
              </View>
            )}
            {result.flyInDistance_m && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Fly-In</Text>
                <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                  {result.flyInDistance_m}m
                </Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Start</Text>
              <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                {result.startMethod.replace('_', ' ')}
              </Text>
            </View>
          </View>
        )}

        {onEdit && (
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
            <Text style={[styles.editText, { color: colors.primary[500] }]}>Edit</Text>
          </TouchableOpacity>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timeContainer: {
    flexDirection: 'column',
  },
  time: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as '700',
    fontVariant: ['tabular-nums'],
  },
  velocity: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
  details: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    textTransform: 'capitalize',
  },
  editButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-end',
  },
  editText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
});
