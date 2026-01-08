import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../contexts';
import { spacing, typography, borderRadius, colors } from '../../constants/theme';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const { colors: themeColors } = useTheme();
  const { units } = useSettingsStore();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Collect all photos (finish + splits)
  const photos: { uri: string; label: string }[] = [];
  if (result.finishPhotoUri) {
    photos.push({ uri: result.finishPhotoUri, label: 'Finish' });
  }
  if (result.splits) {
    result.splits.forEach((split, index) => {
      if (split.photoUri) {
        photos.push({
          uri: split.photoUri,
          label: `${split.distance_m}m`,
        });
      }
    });
  }

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

  // Photo viewer modal
  const renderPhotoModal = () => (
    <Modal
      visible={!!selectedPhoto}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedPhoto(null)}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalContent}>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedPhoto(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
    <>
      {renderPhotoModal()}
      <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
        <Card variant="elevated" padding="medium">
          <View style={styles.header}>
            <View style={styles.timeContainer}>
              <Text style={[styles.time, { color: themeColors.text.primary }]}>
                {formatTime(result.time_ms)}s
              </Text>
              {velocity_ms && (
                <Text style={[styles.velocity, { color: themeColors.primary[600] }]}>
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

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <View style={styles.photoSection}>
              <Text style={[styles.photoLabel, { color: themeColors.text.secondary }]}>
                Timing Photos
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoGallery}
              >
                {photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoThumbnailContainer}
                    onPress={() => setSelectedPhoto(photo.uri)}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoThumbnail}
                      resizeMode="cover"
                    />
                    <View style={styles.photoLabelBadge}>
                      <Text style={styles.photoLabelText}>{photo.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showDetails && (
            <View style={styles.details}>
              {effectiveDistance && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: themeColors.text.secondary }]}>Distance</Text>
                  <Text style={[styles.detailValue, { color: themeColors.text.primary }]}>
                    {effectiveDistance}m
                  </Text>
                </View>
              )}
              {result.flyInDistance_m && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: themeColors.text.secondary }]}>Fly-In</Text>
                  <Text style={[styles.detailValue, { color: themeColors.text.primary }]}>
                    {result.flyInDistance_m}m
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: themeColors.text.secondary }]}>Start</Text>
                <Text style={[styles.detailValue, { color: themeColors.text.primary }]}>
                  {result.startMethod.replace('_', ' ')}
                </Text>
              </View>
            </View>
          )}

          {onEdit && (
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Text style={[styles.editText, { color: themeColors.primary[500] }]}>Edit</Text>
            </TouchableOpacity>
          )}
        </Card>
      </TouchableOpacity>
    </>
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
  // Photo gallery styles
  photoSection: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  photoLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
  photoGallery: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  photoThumbnailContainer: {
    position: 'relative',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  photoLabelBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  photoLabelText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
    textAlign: 'center',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  fullPhoto: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    height: SCREEN_WIDTH - spacing.xl * 2,
    borderRadius: borderRadius.lg,
  },
  closeButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  closeButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
});
