/**
 * CrossingReviewScreen - Frame-by-frame review of gate crossing
 *
 * Allows user to manually select the exact crossing frame
 * if the AI detection wasn't accurate.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { spacing, typography, darkColors } from '../constants/theme';
import { Button } from '../components/ui';
import { useTimingStore } from '../stores/timingStore';
import { calculateVelocity } from '../utils/velocity';

interface FrameMetadata {
  index: number;
  timestamp: number;
  torsoX: number;
  torsoY: number;
  confidence: number;
}

interface CrossingMetadata {
  frameCount: number;
  aiDetectedFrameIndex: number;
  gateLineX: number;
  frames: FrameMetadata[];
}

import { useRouter, useLocalSearchParams } from 'expo-router';

export function CrossingReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const folderPath = params.folderPath as string;
  const frameCount = parseInt(params.frameCount as string, 10);
  const aiFrameIndex = parseInt(params.aiFrameIndex as string, 10);
  const resultId = params.resultId as string | undefined;
  const insets = useSafeAreaInsets();

  // Get store actions and result
  const results = useTimingStore((state) => state.results);
  const updateResult = useTimingStore((state) => state.updateResult);

  // Find the result we're reviewing
  const result = useMemo(() => {
    if (!resultId) return null;
    return results.find((r) => r.id === resultId);
  }, [results, resultId]);

  const [currentFrameIndex, setCurrentFrameIndex] = useState(aiFrameIndex);
  const [metadata, setMetadata] = useState<CrossingMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load metadata on mount
  useEffect(() => {
    loadMetadata();
  }, [folderPath]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const metadataPath = `${folderPath}/metadata.json`;
      const response = await fetch(`file://${metadataPath}`);
      const data = await response.json();
      setMetadata(data);
      setCurrentFrameIndex(data.aiDetectedFrameIndex);
      setError(null);
    } catch (err) {
      console.error('[CrossingReview] Failed to load metadata:', err);
      setError('Failed to load frame data');
      // Use route params as fallback
      setMetadata({
        frameCount,
        aiDetectedFrameIndex: aiFrameIndex,
        gateLineX: 0.5,
        frames: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const getFramePath = (index: number) => {
    const filename = `frame_${String(index).padStart(3, '0')}.jpg`;
    return `file://${folderPath}/${filename}`;
  };

  const getCurrentFrame = () => {
    if (!metadata || metadata.frames.length === 0) return null;
    return metadata.frames[currentFrameIndex];
  };

  const getTimeOffset = () => {
    if (!metadata || metadata.frames.length === 0) return 0;
    const aiFrame = metadata.frames[metadata.aiDetectedFrameIndex];
    const currentFrame = metadata.frames[currentFrameIndex];
    if (!aiFrame || !currentFrame) return 0;
    return currentFrame.timestamp - aiFrame.timestamp;
  };

  const handlePrevFrame = useCallback(() => {
    setCurrentFrameIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextFrame = useCallback(() => {
    setCurrentFrameIndex(prev => Math.min((metadata?.frameCount || frameCount) - 1, prev + 1));
  }, [metadata, frameCount]);

  const handleSliderChange = useCallback((value: number) => {
    setCurrentFrameIndex(Math.round(value));
  }, []);

  const handleConfirm = useCallback(() => {
    const timeOffset = getTimeOffset();
    const isAiFrame = currentFrameIndex === (metadata?.aiDetectedFrameIndex ?? aiFrameIndex);

    // If user selected a different frame, update the result
    if (!isAiFrame && result && resultId) {
      const newTime = result.time_ms + timeOffset;

      // Recalculate velocity if distance is available
      const newVelocity = result.distance_m
        ? calculateVelocity(result.distance_m, newTime)
        : result.velocity_ms;

      updateResult(resultId, {
        time_ms: newTime,
        velocity_ms: newVelocity,
        source: 'manual_override',
        confidence: null, // Manual override = no AI confidence
        aiFrameIndex: currentFrameIndex, // Track which frame was selected
      });

      Alert.alert(
        'Time Updated',
        `Time adjusted by ${timeOffset >= 0 ? '+' : ''}${timeOffset.toFixed(0)}ms`,
        [{ text: 'OK' }]
      );
    }

    router.back();
  }, [currentFrameIndex, metadata, result, resultId, updateResult, router, aiFrameIndex]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={darkColors.primary[500]} />
        <Text style={styles.loadingText}>Loading frames...</Text>
      </View>
    );
  }

  const currentFrame = getCurrentFrame();
  const timeOffset = getTimeOffset();
  const isAiFrame = currentFrameIndex === (metadata?.aiDetectedFrameIndex ?? aiFrameIndex);
  const totalFrames = metadata?.frameCount ?? frameCount;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>Review Crossing</Text>
        <Text style={styles.headerSubtitle}>
          Scrub through frames to find exact crossing moment
        </Text>
      </View>

      {/* Frame Display */}
      <View style={styles.frameContainer}>
        <Image
          source={{ uri: getFramePath(currentFrameIndex) }}
          style={styles.frameImage}
          resizeMode="contain"
        />

        {/* Center Gate Line - Finish Line */}
        <View style={styles.gateLineContainer}>
          <View style={styles.gateLine} />
        </View>

        {/* AI Frame Indicator */}
        {isAiFrame && (
          <View style={styles.aiIndicator}>
            <Text style={styles.aiIndicatorText}>AI Detected</Text>
          </View>
        )}
      </View>

      {/* Frame Info */}
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Frame:</Text>
          <Text style={styles.infoValue}>
            {currentFrameIndex + 1} / {totalFrames}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Time Offset:</Text>
          <Text style={[styles.infoValue, timeOffset !== 0 && styles.infoValueHighlight]}>
            {timeOffset >= 0 ? '+' : ''}{timeOffset.toFixed(0)}ms
          </Text>
        </View>

        {currentFrame && (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Torso X:</Text>
              <Text style={styles.infoValue}>{currentFrame.torsoX.toFixed(3)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Confidence:</Text>
              <Text style={styles.infoValue}>{(currentFrame.confidence * 100).toFixed(0)}%</Text>
            </View>
          </>
        )}
      </View>

      {/* Frame Controls */}
      <View style={styles.controlsContainer}>
        {/* Prev/Next Buttons */}
        <View style={styles.navButtons}>
          <TouchableOpacity
            style={[styles.navButton, currentFrameIndex === 0 && styles.navButtonDisabled]}
            onPress={handlePrevFrame}
            disabled={currentFrameIndex === 0}
          >
            <Text style={styles.navButtonText}>{'<'} Prev</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.jumpButton, isAiFrame && styles.jumpButtonActive]}
            onPress={() => setCurrentFrameIndex(metadata?.aiDetectedFrameIndex ?? aiFrameIndex)}
          >
            <Text style={[styles.jumpButtonText, isAiFrame && styles.jumpButtonTextActive]}>
              AI Frame
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, currentFrameIndex === totalFrames - 1 && styles.navButtonDisabled]}
            onPress={handleNextFrame}
            disabled={currentFrameIndex === totalFrames - 1}
          >
            <Text style={styles.navButtonText}>Next {'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Slider */}
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>1</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={totalFrames - 1}
            step={1}
            value={currentFrameIndex}
            onValueChange={handleSliderChange}
            minimumTrackTintColor={darkColors.primary[500]}
            maximumTrackTintColor={darkColors.gray[600]}
            thumbTintColor={darkColors.primary[400]}
          />
          <Text style={styles.sliderLabel}>{totalFrames}</Text>
        </View>

        {/* AI Frame Marker on slider */}
        <View style={styles.aiMarkerContainer}>
          <View
            style={[
              styles.aiMarker,
              { left: `${((metadata?.aiDetectedFrameIndex ?? aiFrameIndex) / (totalFrames - 1)) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={[styles.actionButtons, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Cancel"
          onPress={handleCancel}
          variant="secondary"
          style={styles.actionButton}
        />
        <Button
          title={isAiFrame ? 'Confirm AI Selection' : 'Use This Frame'}
          onPress={handleConfirm}
          style={styles.confirmButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.black,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: darkColors.gray[400],
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    color: darkColors.white,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  frameContainer: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: darkColors.gray[900],
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  gateLineContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateLine: {
    width: 2,
    height: '100%',
    backgroundColor: darkColors.primary[500],
    shadowColor: darkColors.primary[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  aiIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: darkColors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  aiIndicatorText: {
    color: darkColors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: darkColors.gray[900],
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: darkColors.white,
    fontVariant: ['tabular-nums'],
  },
  infoValueHighlight: {
    color: darkColors.primary[400],
  },
  controlsContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  navButton: {
    backgroundColor: darkColors.gray[800],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    color: darkColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  jumpButton: {
    backgroundColor: darkColors.gray[800],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: darkColors.primary[500],
  },
  jumpButtonActive: {
    backgroundColor: darkColors.primary[500],
  },
  jumpButtonText: {
    color: darkColors.primary[400],
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  jumpButtonTextActive: {
    color: darkColors.white,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    color: darkColors.gray[500],
    fontSize: typography.fontSize.xs,
    width: 30,
    textAlign: 'center',
  },
  aiMarkerContainer: {
    position: 'relative',
    height: 4,
    marginHorizontal: 35, // Align with slider track
    marginTop: -spacing.md,
  },
  aiMarker: {
    position: 'absolute',
    width: 4,
    height: 8,
    backgroundColor: '#22C55E',
    borderRadius: 2,
    transform: [{ translateX: -2 }],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: darkColors.primary[500],
  },
});
