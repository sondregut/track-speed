/**
 * useVisionPose - React hook for iOS Vision pose detection
 *
 * This hook manages the complete auto-detection flow:
 * 1. Camera frame capture (via Vision Camera)
 * 2. Pose detection (via iOS Vision framework)
 * 3. Torso tracking (smoothing + velocity)
 * 4. Gate crossing detection
 * 5. Sub-frame timing interpolation
 *
 * The "gate" is a virtual finish line in the camera view.
 * When the athlete's torso crosses this line, the timer stops.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useFrameProcessor, Frame } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import {
  PoseDetectionResult,
  TorsoCenter,
  isVisionPoseAvailable,
  detectGateCrossing,
  interpolateCrossingTime,
  calculateTorsoVelocity,
} from '../lib/pose/VisionPoseDetector';

interface UseVisionPoseOptions {
  /** X position of gate line (0-1, left to right). Default: 0.5 (center) */
  gateLineX?: number;
  /** Minimum confidence to accept detection. Default: 0.5 */
  minConfidence?: number;
  /** Enable detection. Default: true */
  enabled?: boolean;
  /** Callback when gate crossing detected */
  onGateCrossing?: (crossingTimeMs: number, confidence: number) => void;
}

interface UseVisionPoseReturn {
  /** Is native Vision pose available? */
  isAvailable: boolean;
  /** Is pose currently detected in frame? */
  isDetected: boolean;
  /** Current torso center position */
  torsoCenter: TorsoCenter | null;
  /** Detection confidence (0-100) */
  confidence: number;
  /** Current FPS of detection */
  fps: number;
  /** Processing time per frame in ms */
  processingTimeMs: number;
  /** Estimated torso velocity */
  velocity: number;
  /** Frame processor to pass to Vision Camera */
  frameProcessor: ReturnType<typeof useFrameProcessor>;
  /** Reset tracking state */
  reset: () => void;
}

export function useVisionPose(options: UseVisionPoseOptions = {}): UseVisionPoseReturn {
  const {
    gateLineX = 0.5,
    minConfidence = 0.5,
    enabled = true,
    onGateCrossing,
  } = options;

  // State
  const [isAvailable] = useState(() => isVisionPoseAvailable());
  const [isDetected, setIsDetected] = useState(false);
  const [torsoCenter, setTorsoCenter] = useState<TorsoCenter | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [fps, setFps] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState(0);
  const [velocity, setVelocity] = useState(0);

  // Refs for tracking across frames
  const previousTorsoRef = useRef<TorsoCenter | null>(null);
  const previousXRef = useRef<number | null>(null);
  const previousTimestampRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const gateCrossedRef = useRef(false);

  // Handle detection result from worklet
  const handleDetectionResult = useCallback((result: PoseDetectionResult, frameWidth: number) => {
    if (!result.detected || result.confidence < minConfidence * 100) {
      setIsDetected(false);
      setTorsoCenter(null);
      setConfidence(0);
      return;
    }

    setIsDetected(true);
    setTorsoCenter(result.torsoCenter);
    setConfidence(result.confidence);
    setProcessingTimeMs(result.processingTimeMs);

    // Calculate velocity
    if (previousTorsoRef.current && previousTimestampRef.current) {
      const deltaTime = result.timestamp - previousTimestampRef.current;
      const vel = calculateTorsoVelocity(
        result.torsoCenter,
        previousTorsoRef.current,
        deltaTime,
        frameWidth
      );
      setVelocity(vel);
    }

    // Check for gate crossing
    if (
      result.torsoCenter &&
      previousXRef.current !== null &&
      !gateCrossedRef.current
    ) {
      const crossed = detectGateCrossing(
        result.torsoCenter,
        gateLineX,
        previousXRef.current
      );

      if (crossed) {
        gateCrossedRef.current = true;

        // Calculate precise crossing time with sub-frame interpolation
        const crossingTime = interpolateCrossingTime(
          previousXRef.current,
          result.torsoCenter.x,
          gateLineX,
          previousTimestampRef.current || result.timestamp,
          result.timestamp
        );

        onGateCrossing?.(crossingTime, result.confidence);
      }
    }

    // Update previous values
    previousTorsoRef.current = result.torsoCenter;
    previousXRef.current = result.torsoCenter?.x ?? null;
    previousTimestampRef.current = result.timestamp;

    // Update FPS
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFpsUpdateRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }
  }, [gateLineX, minConfidence, onGateCrossing]);

  // Frame processor for Vision Camera
  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';

    if (!enabled) return;

    try {
      // Get the detectPose plugin (registered by native module)
      // @ts-ignore - Plugin is registered at runtime
      const detectPose = global.__detectPose;

      if (!detectPose) {
        // Plugin not available (Expo Go or not initialized)
        return;
      }

      // Run pose detection on frame
      const result = detectPose(frame) as PoseDetectionResult;

      // Send result to JS thread
      runOnJS(handleDetectionResult)(result, frame.width);
    } catch (error) {
      // Detection failed, ignore
    }
  }, [enabled, handleDetectionResult]);

  // Reset function
  const reset = useCallback(() => {
    previousTorsoRef.current = null;
    previousXRef.current = null;
    previousTimestampRef.current = null;
    gateCrossedRef.current = false;
    setIsDetected(false);
    setTorsoCenter(null);
    setConfidence(0);
    setVelocity(0);
  }, []);

  // Reset when gate line changes
  useEffect(() => {
    gateCrossedRef.current = false;
  }, [gateLineX]);

  return {
    isAvailable,
    isDetected,
    torsoCenter,
    confidence,
    fps,
    processingTimeMs,
    velocity,
    frameProcessor,
    reset,
  };
}
