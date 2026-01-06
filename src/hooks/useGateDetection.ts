/**
 * useGateDetection - Hook for optimized gate crossing detection
 *
 * Combines native GhostGate motion detection with Vision pose detection
 * for efficient, accurate finish line timing.
 *
 * Flow:
 * 1. Fast motion detection in ROI (~0.1ms native)
 * 2. Pose detection only when motion detected (~5-15ms)
 * 3. Sub-frame interpolation for precise crossing time
 *
 * Usage:
 * ```tsx
 * const { frameProcessor, state, crossing } = useGateDetection({
 *   onCrossing: (result) => console.log('Crossed at', result.crossingTime),
 * });
 *
 * <Camera frameProcessor={frameProcessor} />
 * ```
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import { Platform } from 'react-native';
import type {
  GateSetup,
  GateROI,
  GateCrossingResult,
  ROIMotionResult,
  RunDirection,
} from '../types';

// Types for VisionCamera frame processor
interface Frame {
  width: number;
  height: number;
  timestamp: number;
}

interface UseGateDetectionOptions {
  /** Direction athletes run through the gate */
  runDirection?: RunDirection;
  /** Custom ROI configuration */
  roi?: GateROI;
  /** Motion intensity threshold (0-1) */
  motionThreshold?: number;
  /** Minimum pose confidence (0-1) */
  confidenceThreshold?: number;
  /** Called when motion detected in ROI */
  onMotion?: (result: ROIMotionResult) => void;
  /** Called when gate crossing detected */
  onCrossing?: (result: GateCrossingResult) => void;
}

interface GateDetectionState {
  /** Is detection active */
  isActive: boolean;
  /** Is calibrated */
  isCalibrated: boolean;
  /** Current tracking state */
  trackingState: 'waiting' | 'approaching' | 'in_roi' | 'crossed' | 'exited';
  /** Last motion result */
  lastMotion: ROIMotionResult | null;
  /** Last crossing result */
  lastCrossing: GateCrossingResult | null;
  /** Frame count */
  frameCount: number;
  /** Pose detections run (for efficiency tracking) */
  poseDetectionCount: number;
}

interface UseGateDetectionReturn {
  /** Current detection state */
  state: GateDetectionState;
  /** Last crossing result */
  crossing: GateCrossingResult | null;
  /** Current gate setup */
  gateSetup: GateSetup;
  /** Start detection */
  start: () => void;
  /** Stop detection */
  stop: () => void;
  /** Reset for next athlete */
  reset: () => void;
  /** Calibrate background (call with empty track) */
  calibrate: () => Promise<boolean>;
  /** Update ROI */
  setROI: (roi: GateROI) => void;
  /** Efficiency stats */
  getEfficiencyStats: () => { poseRate: number; savings: number };
  /** Frame processor for VisionCamera */
  createFrameProcessor: () => (frame: Frame) => void;
}

/**
 * Default ROI for horizontal camera setup
 * Camera perpendicular to track, athletes run left→right or right→left
 */
const DEFAULT_ROI: GateROI = {
  position: 0.5, // Center of frame (finish line)
  width: 0.08, // 8% of frame width
  top: 0.15, // Skip sky/ceiling
  bottom: 0.95, // Include feet
};

/**
 * Check if native processors are available
 */
function isNativeAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;

  try {
    const { VisionCameraProxy } = require('react-native-vision-camera');
    return VisionCameraProxy !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get native frame processor plugins
 */
function getNativePlugins(): {
  detectMotion: ((frame: Frame, options?: any) => any) | null;
  detectPose: ((frame: Frame) => any) | null;
} {
  if (!isNativeAvailable()) {
    return { detectMotion: null, detectPose: null };
  }

  try {
    const { VisionCameraProxy } = require('react-native-vision-camera');

    const motionPlugin = VisionCameraProxy.initFrameProcessorPlugin(
      'detectGhostGateMotion',
      {}
    );
    const posePlugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});

    return {
      detectMotion: motionPlugin
        ? (frame: Frame, options?: any) => motionPlugin.call(frame, options)
        : null,
      detectPose: posePlugin ? (frame: Frame) => posePlugin.call(frame) : null,
    };
  } catch (error) {
    console.warn('Failed to init native plugins:', error);
    return { detectMotion: null, detectPose: null };
  }
}

export function useGateDetection(
  options: UseGateDetectionOptions = {}
): UseGateDetectionReturn {
  const {
    runDirection = 'left_to_right',
    roi = DEFAULT_ROI,
    motionThreshold = 0.03,
    confidenceThreshold = 0.5,
    onMotion,
    onCrossing,
  } = options;

  // State
  const [state, setState] = useState<GateDetectionState>({
    isActive: false,
    isCalibrated: false,
    trackingState: 'waiting',
    lastMotion: null,
    lastCrossing: null,
    frameCount: 0,
    poseDetectionCount: 0,
  });

  const [crossing, setCrossing] = useState<GateCrossingResult | null>(null);

  // Refs for frame processor (can't use state in worklets)
  const previousTorsoX = useRef<number | null>(null);
  const previousTimestamp = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const poseCountRef = useRef(0);

  // Gate setup
  const gateSetup = useMemo<GateSetup>(
    () => ({
      orientation: 'horizontal',
      runDirection,
      roi,
      motionThreshold,
      confidenceThreshold,
    }),
    [runDirection, roi, motionThreshold, confidenceThreshold]
  );

  // Native plugins
  const plugins = useMemo(() => getNativePlugins(), []);

  // Start detection
  const start = useCallback(() => {
    setState((s) => ({
      ...s,
      isActive: true,
      trackingState: 'waiting',
      frameCount: 0,
      poseDetectionCount: 0,
    }));
    frameCountRef.current = 0;
    poseCountRef.current = 0;
    previousTorsoX.current = null;
    previousTimestamp.current = null;
  }, []);

  // Stop detection
  const stop = useCallback(() => {
    setState((s) => ({ ...s, isActive: false }));
  }, []);

  // Reset for next athlete
  const reset = useCallback(() => {
    setState((s) => ({
      ...s,
      trackingState: 'waiting',
      lastMotion: null,
      lastCrossing: null,
    }));
    setCrossing(null);
    previousTorsoX.current = null;
    previousTimestamp.current = null;
  }, []);

  // Calibrate background
  const calibrate = useCallback(async (): Promise<boolean> => {
    if (!plugins.detectMotion) {
      console.warn('Native motion detection not available');
      setState((s) => ({ ...s, isCalibrated: true })); // Fallback
      return true;
    }

    try {
      // Quick calibrate with current frame
      // In production, you'd want to average multiple frames
      const result = plugins.detectMotion(null as any, { command: 'quickCalibrate' });
      const success = result?.success ?? false;

      setState((s) => ({ ...s, isCalibrated: success }));
      return success;
    } catch (error) {
      console.error('Calibration failed:', error);
      return false;
    }
  }, [plugins]);

  // Update ROI
  const setROI = useCallback(
    (newROI: GateROI) => {
      if (plugins.detectMotion) {
        plugins.detectMotion(null as any, {
          command: 'setROI',
          position: newROI.position,
          width: newROI.width,
          top: newROI.top,
          bottom: newROI.bottom,
        });
      }
    },
    [plugins]
  );

  // Efficiency stats
  const getEfficiencyStats = useCallback(() => {
    const frames = frameCountRef.current || 1;
    const poses = poseCountRef.current;
    const poseRate = poses / frames;

    return {
      poseRate,
      savings: Math.round((1 - poseRate) * 100),
    };
  }, []);

  // Create frame processor for VisionCamera
  const createFrameProcessor = useCallback(() => {
    const { detectMotion, detectPose } = plugins;

    return (frame: Frame) => {
      'worklet';

      if (!state.isActive) return;

      frameCountRef.current++;

      // Step 1: Check motion in ROI (fast, ~0.1ms)
      let motionResult: ROIMotionResult | null = null;

      if (detectMotion) {
        const nativeResult = detectMotion(frame);
        if (nativeResult) {
          motionResult = {
            hasMotion: nativeResult.hasMotion ?? false,
            intensity: nativeResult.intensity ?? 0,
            timestamp: nativeResult.timestamp ?? Date.now(),
            motionBounds: nativeResult.motionBounds,
          };
        }
      }

      // Notify motion callback
      if (motionResult && onMotion) {
        // Can't call JS functions from worklet directly in production
        // This would need to use Reanimated's runOnJS
      }

      // Step 2: Only run pose detection if motion detected
      const shouldRunPose =
        motionResult?.hasMotion &&
        (motionResult.intensity ?? 0) > motionThreshold;

      if (!shouldRunPose || !detectPose) return;

      poseCountRef.current++;

      // Step 3: Run pose detection (slower, ~5-15ms)
      const poseResult = detectPose(frame);

      if (!poseResult?.detected || !poseResult.torsoCenter) return;

      // Step 4: Check for gate crossing
      const torsoX = poseResult.torsoCenter.x;
      const timestamp = poseResult.timestamp;
      const gateLineX = roi.position;

      if (
        previousTorsoX.current !== null &&
        previousTimestamp.current !== null
      ) {
        // Check crossing based on run direction
        let crossed = false;

        if (runDirection === 'left_to_right') {
          crossed =
            previousTorsoX.current < gateLineX && torsoX >= gateLineX;
        } else if (runDirection === 'right_to_left') {
          crossed =
            previousTorsoX.current > gateLineX && torsoX <= gateLineX;
        } else {
          // Accept either direction
          crossed =
            (previousTorsoX.current < gateLineX && torsoX >= gateLineX) ||
            (previousTorsoX.current > gateLineX && torsoX <= gateLineX);
        }

        if (crossed) {
          // Sub-frame interpolation for precise crossing time
          const totalDist = torsoX - previousTorsoX.current;
          const distToGate = gateLineX - previousTorsoX.current;
          const factor =
            Math.abs(totalDist) > 0.0001 ? distToGate / totalDist : 1;
          const clampedFactor = Math.max(0, Math.min(1, factor));
          const deltaTime = timestamp - previousTimestamp.current;
          const crossingTime = previousTimestamp.current + deltaTime * clampedFactor;

          const crossingResult: GateCrossingResult = {
            crossed: true,
            crossingTime,
            crossingX: gateLineX,
            confidence: poseResult.confidence,
            direction:
              torsoX > previousTorsoX.current ? 'entering' : 'exiting',
          };

          // Update state (this needs runOnJS in production)
          setCrossing(crossingResult);
          if (onCrossing) {
            // onCrossing(crossingResult); // Need runOnJS
          }
        }
      }

      // Update previous position for next frame
      previousTorsoX.current = torsoX;
      previousTimestamp.current = timestamp;
    };
  }, [
    plugins,
    state.isActive,
    roi,
    runDirection,
    motionThreshold,
    onMotion,
    onCrossing,
  ]);

  return {
    state,
    crossing,
    gateSetup,
    start,
    stop,
    reset,
    calibrate,
    setROI,
    getEfficiencyStats,
    createFrameProcessor,
  };
}

export default useGateDetection;
