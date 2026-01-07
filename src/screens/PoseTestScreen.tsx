/**
 * PoseTestScreen - Simple test screen to verify pose detection is working
 *
 * Shows camera feed with large, obvious visual feedback:
 * - Green screen flash when pose detected
 * - Red when no pose
 * - Torso position dot
 * - Debug stats
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { File, Paths } from 'expo-file-system';
import { spacing, typography, darkColors } from '../constants/theme';
import { useVisionPose } from '../hooks';
import { Button } from '../components/ui';

interface PoseTestScreenProps {
  navigation: any;
}

export function PoseTestScreen({ navigation }: PoseTestScreenProps) {
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();

  // Camera position state - allow switching between front and back
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(cameraPosition);

  // State for crossing capture
  const [crossingImageUri, setCrossingImageUri] = useState<string | null>(null);
  const [crossingTime, setCrossingTime] = useState<number | null>(null);
  const [showCrossingImage, setShowCrossingImage] = useState(false);

  // State for frame buffer (review feature)
  const [frameBufferData, setFrameBufferData] = useState<{
    folderPath: string;
    frameCount: number;
    aiFrameIndex: number;
  } | null>(null);

  // Flip camera handler
  const handleFlipCamera = useCallback(() => {
    setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
  }, []);

  // Handle crossing frame capture - save base64 to file
  const handleCrossingFrame = useCallback((frameBase64: string) => {
    try {
      const timestamp = Date.now();
      const filename = `crossing_${timestamp}.jpg`;

      // Create file in document directory using new expo-file-system API
      const file = new File(Paths.document, filename);
      file.write(frameBase64, { encoding: 'base64' });

      console.log('[PoseTest] Crossing image saved:', file.uri);
      setCrossingImageUri(file.uri);
      setShowCrossingImage(true);
    } catch (error) {
      console.error('[PoseTest] Failed to save crossing image:', error);
    }
  }, []);

  // Handle gate crossing
  const handleGateCrossing = useCallback((crossingTimeMs: number, confidence: number) => {
    console.log('[PoseTest] Gate crossed!', { crossingTimeMs, confidence });
    setCrossingTime(crossingTimeMs);
  }, []);

  // Handle frame buffer ready (for review feature)
  const handleFrameBufferReady = useCallback((folderPath: string, frameCount: number, aiFrameIndex: number) => {
    console.log('[PoseTest] Frame buffer ready:', { folderPath, frameCount, aiFrameIndex });
    setFrameBufferData({ folderPath, frameCount, aiFrameIndex });
  }, []);

  // Handle review frames button
  const handleReviewFrames = useCallback(() => {
    if (frameBufferData) {
      navigation.navigate('CrossingReview', {
        folderPath: frameBufferData.folderPath,
        frameCount: frameBufferData.frameCount,
        aiFrameIndex: frameBufferData.aiFrameIndex,
        onConfirm: (selectedFrameIndex: number, timestamp: number) => {
          console.log('[PoseTest] Frame selected:', { selectedFrameIndex, timestamp });
          // Could update crossing time here if different from AI selection
        },
      });
    }
  }, [frameBufferData, navigation]);

  // Vision pose detection - with frame capture enabled
  const visionPose = useVisionPose({
    gateLineX: 0.5,
    minConfidence: 0.3, // Lower threshold for testing
    enabled: true,
    cameraPosition: cameraPosition,
    debug: __DEV__, // Enable debug logging only in development
    captureOnCrossing: true, // Enable frame capture
    enableFrameBuffer: true, // Enable frame buffer for review
    onGateCrossing: handleGateCrossing,
    onCrossingFrame: handleCrossingFrame,
    onFrameBufferReady: handleFrameBufferReady,
  });

  // Clear crossing and reset for next test
  const handleClearCrossing = useCallback(() => {
    setCrossingImageUri(null);
    setCrossingTime(null);
    setShowCrossingImage(false);
    setFrameBufferData(null);
    visionPose.reset();
  }, [visionPose]);

  // Request camera permission
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const isDetected = visionPose.isDetected;
  const confidence = visionPose.confidence;
  const torso = visionPose.torsoCenter;

  return (
    <View style={styles.container}>
      {/* Camera Feed */}
      {device && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          video={true}
          pixelFormat="yuv"
          frameProcessor={visionPose.frameProcessor}
        />
      )}

      {/* Detection Status Overlay - BIG AND OBVIOUS */}
      <View style={[
        styles.statusOverlay,
        { backgroundColor: isDetected ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)' }
      ]}>
        <Text style={styles.statusText}>
          {isDetected ? 'DETECTED' : 'NO POSE'}
        </Text>
        <Text style={styles.confidenceText}>
          {isDetected ? `${confidence.toFixed(0)}% confidence` : 'Point camera at a person'}
        </Text>
      </View>

      {/* Torso Position Indicator */}
      {isDetected && torso && (
        <View
          style={[
            styles.torsoIndicator,
            {
              left: `${torso.x * 100}%`,
              top: `${torso.y * 100}%`,
            },
          ]}
        >
          <View style={styles.torsoInner} />
        </View>
      )}

      {/* Gate Line (center) */}
      <View style={styles.gateLine} />

      {/* Flip Camera Button */}
      <TouchableOpacity
        style={[styles.flipButton, { top: insets.top + 10 }]}
        onPress={handleFlipCamera}
      >
        <Text style={styles.flipButtonIcon}>⟳</Text>
        <Text style={styles.flipButtonText}>
          {cameraPosition === 'back' ? 'Back' : 'Front'}
        </Text>
      </TouchableOpacity>

      {/* Manual Capture Button - for manual override */}
      <TouchableOpacity
        style={[styles.manualCaptureButton, { bottom: insets.bottom + 100 }]}
        onPress={visionPose.manualCapture}
        disabled={!isDetected}
      >
        <View style={[styles.manualCaptureInner, !isDetected && styles.manualCaptureDisabled]} />
      </TouchableOpacity>
      <Text style={[styles.manualCaptureLabel, { bottom: insets.bottom + 70 }]}>
        Manual Capture
      </Text>

      {/* Debug Stats Panel */}
      <View style={[styles.debugPanel, { top: insets.top + 70 }]}>
        <Text style={styles.debugTitle}>Pose Detection Test</Text>
        <View style={styles.debugRow}>
          <Text style={styles.debugLabel}>Camera:</Text>
          <Text style={[styles.debugValue, { color: '#3B82F6' }]}>
            {cameraPosition === 'back' ? 'Back (Rear)' : 'Front (Selfie)'}
          </Text>
        </View>
        <View style={styles.debugRow}>
          <Text style={styles.debugLabel}>Available:</Text>
          <Text style={[styles.debugValue, { color: visionPose.isAvailable ? '#22C55E' : '#EF4444' }]}>
            {visionPose.isAvailable ? 'YES' : 'NO'}
          </Text>
        </View>
        <View style={styles.debugRow}>
          <Text style={styles.debugLabel}>Detected:</Text>
          <Text style={[styles.debugValue, { color: isDetected ? '#22C55E' : '#EF4444' }]}>
            {isDetected ? 'YES' : 'NO'}
          </Text>
        </View>
        <View style={styles.debugRow}>
          <Text style={styles.debugLabel}>Confidence:</Text>
          <Text style={styles.debugValue}>{confidence.toFixed(1)}%</Text>
        </View>
        <View style={styles.debugRow}>
          <Text style={styles.debugLabel}>FPS:</Text>
          <Text style={styles.debugValue}>{visionPose.fps}</Text>
        </View>
        <View style={styles.debugRow}>
          <Text style={styles.debugLabel}>Process Time:</Text>
          <Text style={styles.debugValue}>{visionPose.processingTimeMs.toFixed(1)}ms</Text>
        </View>
        {torso && (
          <>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Torso X:</Text>
              <Text style={styles.debugValue}>{torso.x.toFixed(3)}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Torso Y:</Text>
              <Text style={styles.debugValue}>{torso.y.toFixed(3)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Crossing Image Modal */}
      {showCrossingImage && crossingImageUri && (
        <View style={styles.crossingModal}>
          <View style={styles.crossingModalContent}>
            <Text style={styles.crossingModalTitle}>Gate Crossing Captured!</Text>
            <Image
              source={{ uri: crossingImageUri }}
              style={styles.crossingImage}
              resizeMode="contain"
            />
            <Text style={styles.crossingModalSubtitle}>
              Yellow line = Gate | Green dot = Torso position
            </Text>
            <View style={styles.crossingModalButtons}>
              <TouchableOpacity
                style={[styles.crossingModalButton, { backgroundColor: '#22C55E' }]}
                onPress={handleClearCrossing}
              >
                <Text style={styles.crossingModalButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.crossingModalButton, { backgroundColor: '#3B82F6' }]}
                onPress={() => setShowCrossingImage(false)}
              >
                <Text style={styles.crossingModalButtonText}>Keep Testing</Text>
              </TouchableOpacity>
            </View>
            {/* Review Frames button - shown when frame buffer is available */}
            {frameBufferData && (
              <TouchableOpacity
                style={[styles.crossingModalButton, styles.reviewButton]}
                onPress={handleReviewFrames}
              >
                <Text style={styles.crossingModalButtonText}>
                  Review Frames ({frameBufferData.frameCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Back Button */}
      <View style={[styles.backButton, { bottom: insets.bottom + 20 }]}>
        <Button
          title="Back to Home"
          onPress={() => navigation.goBack()}
          variant="secondary"
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
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 64,
    fontWeight: '900',
    color: darkColors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  confidenceText: {
    fontSize: 24,
    fontWeight: '600',
    color: darkColors.white,
    marginTop: spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  torsoIndicator: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 4,
    borderColor: '#22C55E',
    transform: [{ translateX: -30 }, { translateY: -30 }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  torsoInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
  },
  gateLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#FACC15',
    transform: [{ translateX: -2 }],
    opacity: 0.8,
  },
  debugPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    padding: spacing.md,
  },
  debugTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: darkColors.white,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  debugLabel: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
  },
  debugValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: darkColors.white,
    fontVariant: ['tabular-nums'],
  },
  backButton: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  flipButton: {
    position: 'absolute',
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flipButtonIcon: {
    fontSize: 20,
    color: darkColors.white,
  },
  flipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: darkColors.white,
  },
  // Crossing modal styles
  crossingModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  crossingModalContent: {
    backgroundColor: darkColors.gray[900],
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  crossingModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  crossingImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    backgroundColor: darkColors.black,
  },
  crossingModalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  crossingModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  crossingModalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  crossingModalButtonText: {
    color: darkColors.white,
    fontWeight: '600',
    fontSize: typography.fontSize.base,
  },
  reviewButton: {
    marginTop: spacing.md,
    backgroundColor: darkColors.primary[500],
  },
  // Manual capture button styles
  manualCaptureButton: {
    position: 'absolute',
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: darkColors.white,
  },
  manualCaptureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: darkColors.white,
  },
  manualCaptureDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  manualCaptureLabel: {
    position: 'absolute',
    alignSelf: 'center',
    color: darkColors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
