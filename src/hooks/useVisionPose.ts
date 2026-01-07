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
import { useFrameProcessor, Frame, VisionCameraProxy } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import {
  PoseDetectionResult,
  TorsoCenter,
  isVisionPoseAvailable,
  detectGateCrossing,
  interpolateCrossingTime,
  calculateTorsoVelocity,
} from '../lib/pose/VisionPoseDetector';

// Initialize the native frame processor plugin
let detectPosePlugin: ReturnType<typeof VisionCameraProxy.initFrameProcessorPlugin> | null = null;
try {
  detectPosePlugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});
  if (detectPosePlugin) {
    console.log('VisionPose: Native plugin loaded successfully');
  }
} catch (e) {
  console.log('VisionPose: Native plugin not available (expected in Expo Go)');
}

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

  // State - check both platform support AND native plugin availability
  const [isAvailable] = useState(() => isVisionPoseAvailable() && detectPosePlugin !== null);
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

  // Handle detection result (receives primitive values)
  const handleDetectionResult = useCallback((
    detected: boolean,
    confidence: number,
    torsoX: number,
    torsoY: number,
    timestamp: number,
    processingTime: number,
    frameWidth: number
  ) => {
    if (!detected || confidence < minConfidence * 100) {
      setIsDetected(false);
      setTorsoCenter(null);
      setConfidence(0);
      return;
    }

    const torso: TorsoCenter = { x: torsoX, y: torsoY };

    setIsDetected(true);
    setTorsoCenter(torso);
    setConfidence(confidence);
    setProcessingTimeMs(processingTime);

    // Calculate velocity
    if (previousTorsoRef.current && previousTimestampRef.current) {
      const deltaTime = timestamp - previousTimestampRef.current;
      const vel = calculateTorsoVelocity(
        torso,
        previousTorsoRef.current,
        deltaTime,
        frameWidth
      );
      setVelocity(vel);
    }

    // Check for gate crossing
    if (previousXRef.current !== null && !gateCrossedRef.current) {
      const crossed = detectGateCrossing(torso, gateLineX, previousXRef.current);

      if (crossed) {
        gateCrossedRef.current = true;

        // Calculate precise crossing time with sub-frame interpolation
        const crossingTime = interpolateCrossingTime(
          previousXRef.current,
          torsoX,
          gateLineX,
          previousTimestampRef.current || timestamp,
          timestamp
        );

        onGateCrossing?.(crossingTime, confidence);
      }
    }

    // Update previous values
    previousTorsoRef.current = torso;
    previousXRef.current = torsoX;
    previousTimestampRef.current = timestamp;

    // Update FPS
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFpsUpdateRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }
  }, [gateLineX, minConfidence, onGateCrossing]);

  // Handle JSON result from native plugin (parses JSON and calls handleDetectionResult)
  const handleJsonResult = useCallback((jsonString: string, frameWidth: number) => {
    try {
      const data = JSON.parse(jsonString);
      handleDetectionResult(
        Boolean(data.detected),
        Number(data.confidence) || 0,
        Number(data.torsoX) || 0,
        Number(data.torsoY) || 0,
        Number(data.timestamp) || 0,
        Number(data.processingTimeMs) || 0,
        frameWidth
      );
    } catch (e) {
      // Invalid JSON, ignore
    }
  }, [handleDetectionResult]);

  // Frame processor for Vision Camera
  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';

    if (!enabled) return;
    if (!detectPosePlugin) {
      return;
    }

    try {
      // Call the native detectPose frame processor plugin
      // Returns JSON string to bypass worklet serialization issues
      const jsonResult = detectPosePlugin.call(frame) as string;

      if (jsonResult && typeof jsonResult === 'string') {
        // Parse JSON on JS thread to avoid worklet issues
        runOnJS(handleJsonResult)(jsonResult, frame.width);
      }
    } catch (error: unknown) {
      // Silently ignore frame processor errors to avoid log spam
    }
  }, [enabled, handleJsonResult]);

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
