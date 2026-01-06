import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { CameraPreview, GateLine } from '../components/camera';
import { Header, Button, Card, GlassCard } from '../components/ui';
import { useSettingsStore } from '../stores';

type CalibrationStep = 'intro' | 'positioning' | 'calibrating' | 'complete' | 'error';

export function GhostGateCalibrationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { ghostGate, updateGhostGate } = useSettingsStore();

  // Use Glass UI on iOS 26+
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const InfoCard = useGlassUI ? GlassCard : Card;

  const [step, setStep] = useState<CalibrationStep>('intro');
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState<number>(0);
  const [cameraReady, setCameraReady] = useState(false);

  // Animated progress bar
  const progressAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  const startCalibration = () => {
    setStep('positioning');
  };

  const beginCapture = () => {
    setStep('calibrating');
    setProgress(0);

    // Simulate calibration progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 3.33; // ~30 frames at ~30fps
        if (next >= 100) {
          clearInterval(interval);
          // Simulate quality assessment
          const simulatedQuality = 75 + Math.random() * 20; // 75-95%
          setQuality(simulatedQuality);
          setStep('complete');
          updateGhostGate({ enabled: true });
          return 100;
        }
        return next;
      });
    }, 100);
  };

  const handleDone = () => {
    navigation.goBack();
  };

  const handleRetry = () => {
    setStep('positioning');
    setProgress(0);
    setQuality(0);
  };

  const renderIntro = () => (
    <View style={styles.contentContainer}>
      <View style={styles.introContent}>
        <Text style={styles.title}>Ghost Gate Calibration</Text>
        <Text style={styles.description}>
          Ghost Gate captures the background to detect motion faster and more accurately.
        </Text>

        <InfoCard variant="default" style={styles.tipCard}>
          <Text style={styles.tipTitle}>Tips for best results:</Text>
          <View style={styles.tipList}>
            <Text style={styles.tipItem}>• Ensure no people are in frame</Text>
            <Text style={styles.tipItem}>• Keep the camera steady</Text>
            <Text style={styles.tipItem}>• Good lighting helps accuracy</Text>
            <Text style={styles.tipItem}>• Avoid moving backgrounds</Text>
          </View>
        </InfoCard>
      </View>

      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          title="Start Calibration"
          onPress={startCalibration}
          size="large"
          disabled={!cameraReady}
        />
        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          variant="ghost"
          size="large"
        />
      </View>
    </View>
  );

  const renderPositioning = () => (
    <View style={styles.contentContainer}>
      <View style={styles.overlayTop}>
        <Text style={styles.instructionTitle}>Position Camera</Text>
        <Text style={styles.instructionText}>
          Point camera at the finish line area. Make sure no one is in frame.
        </Text>
      </View>

      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          title="Capture Background"
          onPress={beginCapture}
          size="large"
          style={styles.captureButton}
        />
        <Button
          title="Back"
          onPress={() => setStep('intro')}
          variant="ghost"
          size="large"
        />
      </View>
    </View>
  );

  const renderCalibrating = () => (
    <View style={styles.contentContainer}>
      <View style={styles.overlayCenter}>
        <Text style={styles.calibratingTitle}>Calibrating...</Text>
        <Text style={styles.calibratingText}>Hold camera steady</Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      </View>
    </View>
  );

  const renderComplete = () => (
    <View style={styles.contentContainer}>
      <View style={styles.completeContent}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.completeTitle}>Calibration Complete</Text>

        <InfoCard variant="elevated" style={styles.qualityCard}>
          <Text style={styles.qualityLabel}>Background Quality</Text>
          <Text style={[styles.qualityValue, { color: getQualityColor(quality) }]}>
            {getQualityLabel(quality)}
          </Text>
          <View style={styles.qualityBar}>
            <View
              style={[
                styles.qualityFill,
                { width: `${quality}%`, backgroundColor: getQualityColor(quality) },
              ]}
            />
          </View>
          <Text style={styles.qualityScore}>{Math.round(quality)}% match</Text>
        </InfoCard>

        <Text style={styles.completeDescription}>
          Ghost Gate is now active. It will help detect athletes faster and more accurately.
        </Text>
      </View>

      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button title="Done" onPress={handleDone} size="large" />
        <Button
          title="Recalibrate"
          onPress={handleRetry}
          variant="outline"
          size="large"
        />
      </View>
    </View>
  );

  const getQualityColor = (q: number) => {
    if (q >= 85) return colors.success[500];
    if (q >= 70) return colors.warning[500];
    return colors.error[500];
  };

  const getQualityLabel = (q: number) => {
    if (q >= 85) return 'Excellent';
    if (q >= 70) return 'Good';
    if (q >= 50) return 'Fair';
    return 'Poor';
  };

  return (
    <View style={styles.container}>
      {/* Camera Background */}
      <CameraPreview onCameraReady={handleCameraReady}>
        <GateLine position={0.7} />
      </CameraPreview>

      {/* Header */}
      <Header
        title="Ghost Gate"
        transparent
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        }
      />

      {/* Content based on step */}
      {step === 'intro' && renderIntro()}
      {step === 'positioning' && renderPositioning()}
      {step === 'calibrating' && renderCalibrating()}
      {step === 'complete' && renderComplete()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  closeButton: {
    fontSize: 24,
    color: colors.white,
    fontWeight: '300',
  },
  contentContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  introContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingTop: 100,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.fontSize.lg,
    color: colors.gray[300],
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 26,
  },
  tipCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
  },
  tipTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  tipList: {
    gap: spacing.xs,
  },
  tipItem: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
  },
  buttonContainer: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayTop: {
    paddingTop: 120,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  instructionTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  instructionText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[300],
    textAlign: 'center',
  },
  captureButton: {
    backgroundColor: colors.timing.ready,
  },
  overlayCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  calibratingTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  calibratingText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[400],
    marginBottom: spacing.xl,
  },
  progressContainer: {
    width: '80%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.gray[700],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  progressText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.lg,
    color: colors.white,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  completeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingTop: 100,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successIconText: {
    fontSize: 40,
    color: colors.white,
  },
  completeTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.white,
    marginBottom: spacing.lg,
  },
  qualityCard: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  qualityLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  qualityValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    marginBottom: spacing.sm,
  },
  qualityBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.gray[700],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  qualityFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  qualityScore: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
  },
  completeDescription: {
    fontSize: typography.fontSize.base,
    color: colors.gray[400],
    textAlign: 'center',
    lineHeight: 22,
  },
});
