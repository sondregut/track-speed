/**
 * StabilityIndicator - Visual feedback for phone stability and alignment
 *
 * Shows:
 * - Colored border around camera preview (red/yellow/green)
 * - Instructions for proper setup
 * - Tilt direction indicators
 * - Stability score
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { spacing, typography, darkColors } from '../../constants/theme';
import { useDeviceStability, StabilityState } from '../../hooks/useDeviceStability';

interface StabilityIndicatorProps {
  /** Show as overlay on camera */
  showOverlay?: boolean;
  /** Show instructions text */
  showInstructions?: boolean;
  /** Callback when stability state changes */
  onStabilityChange?: (isReady: boolean, state: StabilityState) => void;
  /** Children (camera preview) to wrap with border */
  children?: React.ReactNode;
}

export function StabilityIndicator({
  showOverlay = true,
  showInstructions = true,
  onStabilityChange,
  children,
}: StabilityIndicatorProps) {
  const stability = useDeviceStability({ autoStart: true });
  const [borderColorAnim] = useState(new Animated.Value(0));

  // Notify parent of stability changes
  useEffect(() => {
    if (onStabilityChange) {
      onStabilityChange(stability.isReady, stability as StabilityState);
    }
  }, [stability.isReady, onStabilityChange]);

  // Animate border color transitions
  useEffect(() => {
    Animated.timing(borderColorAnim, {
      toValue: stability.isReady ? 2 : stability.isStable ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [stability.isReady, stability.isStable]);

  // Calculate border color
  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      darkColors.timing.error,    // Red - unstable
      darkColors.timing.warning,  // Yellow - stable but not vertical
      darkColors.timing.success,  // Green - ready
    ],
  });

  // Get setup instructions
  const getInstructions = () => {
    if (stability.isReady) {
      return {
        title: 'Ready',
        detail: 'Phone is stable and vertical',
        icon: '✓',
      };
    }

    if (!stability.isStill) {
      return {
        title: 'Hold Still',
        detail: 'Place phone on a stable surface',
        icon: '⏸',
      };
    }

    if (!stability.isNotRotating) {
      return {
        title: 'Stop Rotating',
        detail: 'Keep phone steady',
        icon: '↻',
      };
    }

    if (!stability.isVertical) {
      const direction = stability.tiltDirection;
      let hint = 'Make phone vertical';

      switch (direction) {
        case 'tilted_left':
          hint = 'Tilt phone right';
          break;
        case 'tilted_right':
          hint = 'Tilt phone left';
          break;
        case 'tilted_forward':
          hint = 'Tilt phone backward';
          break;
        case 'tilted_backward':
          hint = 'Tilt phone forward';
          break;
      }

      return {
        title: 'Adjust Angle',
        detail: hint,
        icon: getTiltIcon(direction),
      };
    }

    return {
      title: 'Setting Up',
      detail: 'Please wait...',
      icon: '...',
    };
  };

  const getTiltIcon = (direction: string) => {
    switch (direction) {
      case 'tilted_left':
        return '→';
      case 'tilted_right':
        return '←';
      case 'tilted_forward':
        return '↓';
      case 'tilted_backward':
        return '↑';
      default:
        return '⊙';
    }
  };

  const instructions = getInstructions();

  if (!stability.isSupported) {
    // Fallback for unsupported devices
    return (
      <View style={styles.container}>
        <View style={[styles.cameraWrapper, styles.borderReady]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera preview with animated border */}
      <Animated.View
        style={[
          styles.cameraWrapper,
          { borderColor: borderColor },
        ]}
      >
        {children}

        {/* Overlay with instructions */}
        {showOverlay && !stability.isReady && (
          <View style={styles.overlay}>
            <View style={styles.instructionContainer}>
              {/* Tilt indicator */}
              <View style={styles.tiltIndicator}>
                <Text style={styles.tiltIcon}>{instructions.icon}</Text>
              </View>

              {/* Text instructions */}
              {showInstructions && (
                <View style={styles.textContainer}>
                  <Text style={styles.instructionTitle}>{instructions.title}</Text>
                  <Text style={styles.instructionDetail}>{instructions.detail}</Text>
                </View>
              )}

              {/* Stability score */}
              <View style={styles.scoreContainer}>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreFill,
                      {
                        width: `${stability.overallScore}%`,
                        backgroundColor: stability.isReady
                          ? darkColors.timing.success
                          : stability.isStable
                          ? darkColors.timing.warning
                          : darkColors.timing.error,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.scoreText}>{stability.overallScore}%</Text>
              </View>
            </View>
          </View>
        )}

        {/* Ready indicator */}
        {showOverlay && stability.isReady && (
          <View style={styles.readyBadge}>
            <Text style={styles.readyText}>Ready</Text>
          </View>
        )}
      </Animated.View>

      {/* Status bar below camera */}
      <View style={styles.statusBar}>
        <StatusItem
          label="Still"
          isActive={stability.isStill}
          score={stability.stillnessScore}
        />
        <StatusItem
          label="Stable"
          isActive={stability.isNotRotating}
          score={stability.rotationScore}
        />
        <StatusItem
          label="Vertical"
          isActive={stability.isVertical}
          score={stability.verticalScore}
        />
      </View>
    </View>
  );
}

interface StatusItemProps {
  label: string;
  isActive: boolean;
  score: number;
}

function StatusItem({ label, isActive, score }: StatusItemProps) {
  return (
    <View style={styles.statusItem}>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: isActive ? darkColors.timing.success : darkColors.timing.error },
        ]}
      />
      <Text style={[styles.statusLabel, isActive && styles.statusLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  cameraWrapper: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 16,
    borderWidth: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  borderReady: {
    borderColor: darkColors.timing.success,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  tiltIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tiltIcon: {
    fontSize: 40,
    color: darkColors.white,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  instructionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: darkColors.white,
    textAlign: 'center',
  },
  instructionDetail: {
    fontSize: typography.fontSize.base,
    color: darkColors.gray[300],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 150,
  },
  scoreBar: {
    flex: 1,
    height: 6,
    backgroundColor: darkColors.gray[700],
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreText: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
    fontVariant: ['tabular-nums'],
    width: 35,
  },
  readyBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: darkColors.timing.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  readyText: {
    color: darkColors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[500],
  },
  statusLabelActive: {
    color: darkColors.gray[300],
  },
});

export default StabilityIndicator;
