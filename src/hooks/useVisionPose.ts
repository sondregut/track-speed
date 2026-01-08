/**
 * useVisionPose - React hook for iOS Vision pose detection
 *
 * This hook manages the complete auto-detection flow:
 * 1. Camera frame capture (via Vision Camera)
 * 2. Pose detection (via iOS Vision framework)
 * 3. Gate crossing detection
 * 4. Sub-frame timing interpolation
 *
 * The "gate" is a virtual finish line in the camera view.
 * When the athlete's torso crosses this line, the timer stops.
 *
 * IMPORTANT: This hook uses react-native-worklets-core primitives ONLY.
 * Do NOT use react-native-reanimated's runOnJS or useSharedValue here -
 * they use a different worklet runtime that causes serialization errors.
 */

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useFrameProcessor, Frame, VisionCameraProxy } from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import {
  TorsoCenter,
  isVisionPoseAvailable,
  detectGateCrossing,
  interpolateCrossingTime,
} from '../lib/pose/VisionPoseDetector';

// Initialize the native frame processor plugin at module level
const initPlugin = () => {
  try {
    const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});
    if (plugin) {
      console.log('[VisionPose] Native plugin loaded');
      return plugin;
    }
  } catch (e) {
    console.log('[VisionPose] Native plugin not available (expected in Expo Go)');
  }
  return null;
};

const detectPosePlugin = initPlugin();

interface UseVisionPoseOptions {
  /** X position of gate line (0-1, left to right). Default: 0.5 (center) */
  gateLineX?: number;
  /** Minimum confidence to accept detection. Default: 0.5 */
  minConfidence?: number;
  /** Enable detection. Default: true */
  enabled?: boolean;
  /** Camera position: 'front' or 'back'. Default: 'back' */
  cameraPosition?: 'front' | 'back';
  /** Enable debug logging. Default: false */
  debug?: boolean;
  /** Enable frame capture on crossing. Default: false */
  captureOnCrossing?: boolean;
  /** Enable frame buffer for review feature. Default: false */
  enableFrameBuffer?: boolean;
  /** Callback when gate crossing detected */
  onGateCrossing?: (crossingTimeMs: number, confidence: number) => void;
  /** Callback when crossing frame is captured (base64 JPEG with overlays) */
  onCrossingFrame?: (frameBase64: string) => void;
  /** Callback when frame buffer is ready for review */
  onFrameBufferReady?: (folderPath: string, frameCount: number, aiFrameIndex: number) => void;
  /** Callback for detection status updates (throttled) */
  onDetectionUpdate?: (isDetected: boolean, confidence: number) => void;
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
  /** Trigger manual frame capture (for manual override) */
  manualCapture: () => void;
}

export function useVisionPose(options: UseVisionPoseOptions = {}): UseVisionPoseReturn {
  const {
    gateLineX = 0.5,
    minConfidence = 0.5,
    enabled = true,
    cameraPosition = 'back',
    debug = false,
    captureOnCrossing = false,
    enableFrameBuffer = false,
    onGateCrossing,
    onCrossingFrame,
    onFrameBufferReady,
    onDetectionUpdate,
  } = options;

  // State - check both platform support AND native plugin availability
  const [isAvailable] = useState(() => isVisionPoseAvailable() && detectPosePlugin !== null);
  const [isDetected, setIsDetected] = useState(false);
  const [torsoCenter, setTorsoCenter] = useState<TorsoCenter | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [fps, setFps] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState(0);
  const [velocity, setVelocity] = useState(0);

  // Refs for JS-side tracking (FPS counter, etc.)
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // Shared values for worklet-side tracking (these work across worklet boundary)
  const gateCrossedValue = useSharedValue(false);
  const lastUpdateValue = useSharedValue(0);
  const previousXValue = useSharedValue(-1); // -1 means no previous value
  const previousTimestampValue = useSharedValue(0); // For interpolation
  const manualCaptureValue = useSharedValue(false); // Trigger manual capture
  const startFrameBufferCaptureValue = useSharedValue(false); // Trigger frame buffer capture

  // Create runOnJS callbacks using worklets-core
  // These are safe to call from VisionCamera's frame processor runtime
  const onGateCrossedJS = useMemo(() => {
    if (!onGateCrossing) return null;
    return Worklets.createRunOnJS((crossingTimeMs: number, conf: number) => {
      console.log('[VisionPose] Gate crossed!', { crossingTimeMs, confidence: conf });
      onGateCrossing(crossingTimeMs, conf);
    });
  }, [onGateCrossing]);

  // Callback for crossing frame capture
  const onCrossingFrameJS = useMemo(() => {
    if (!onCrossingFrame || !captureOnCrossing) return null;
    return Worklets.createRunOnJS((frameBase64: string) => {
      console.log('[VisionPose] Crossing frame captured, size:', frameBase64.length);
      onCrossingFrame(frameBase64);
    });
  }, [onCrossingFrame, captureOnCrossing]);

  // Callback for frame buffer ready
  const onFrameBufferReadyJS = useMemo(() => {
    if (!onFrameBufferReady || !enableFrameBuffer) return null;
    return Worklets.createRunOnJS((folderPath: string, frameCount: number, aiFrameIndex: number) => {
      console.log('[VisionPose] Frame buffer ready:', { folderPath, frameCount, aiFrameIndex });
      onFrameBufferReady(folderPath, frameCount, aiFrameIndex);
    });
  }, [onFrameBufferReady, enableFrameBuffer]);

  const onStatusUpdateJS = useMemo(() => {
    return Worklets.createRunOnJS((detected: boolean, conf: number, torsoX: number, torsoY: number, procTime: number) => {
      setIsDetected(detected);
      setConfidence(conf);
      setProcessingTimeMs(procTime);
      if (detected) {
        setTorsoCenter({ x: torsoX, y: torsoY });
      } else {
        setTorsoCenter(null);
      }

      // Update FPS counter
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsUpdateRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      // Call external update callback if provided
      onDetectionUpdate?.(detected, conf);
    });
  }, [onDetectionUpdate]);

  // Frame processor - runs native pose detection
  // Uses ONLY worklets-core primitives (Worklets.createRunOnJS)
  // NO Reanimated imports allowed here!
  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';

    // Check plugin availability
    if (!detectPosePlugin) {
      return;
    }

    // Determine if we should capture the frame
    // 1. Near gate line for automatic crossing capture
    // 2. Manual capture triggered from JS
    const prevX = previousXValue.value;
    const nearGate = prevX >= 0 && Math.abs(prevX - gateLineX) < 0.15;
    const wantManualCapture = manualCaptureValue.value;
    const shouldCapture = (captureOnCrossing && nearGate && !gateCrossedValue.value) || wantManualCapture;
    const wantStartFrameBufferCapture = startFrameBufferCaptureValue.value;

    // Call native pose detection with arguments - returns JSON string
    const resultStr = detectPosePlugin.call(frame, {
      cameraPosition: cameraPosition,
      debug: debug,
      captureFrame: shouldCapture,
      gateLineX: gateLineX,
      enableFrameBuffer: enableFrameBuffer,
      startFrameBufferCapture: wantStartFrameBufferCapture,
    });

    // Reset the start frame buffer capture flag after sending to native
    if (wantStartFrameBufferCapture) {
      startFrameBufferCaptureValue.value = false;
    }

    if (typeof resultStr !== 'string') {
      return;
    }

    // Parse JSON result in worklet using simple string operations
    // Format: {"detected":true,"confidence":85.00,"torsoX":0.500000,"torsoY":0.500000,"timestamp":123456,"processingTimeMs":5.00,"frameBase64":"..."}

    // Check for detected
    const detectedIdx = resultStr.indexOf('"detected":true');
    const detected = detectedIdx !== -1;

    // Helper to extract number after a key
    const extractNumber = (key: string): number => {
      'worklet';
      const keyIdx = resultStr.indexOf(key);
      if (keyIdx === -1) return 0;
      const startIdx = keyIdx + key.length;
      let endIdx = startIdx;
      while (endIdx < resultStr.length) {
        const char = resultStr.charAt(endIdx);
        if (char === ',' || char === '}') break;
        endIdx++;
      }
      const numStr = resultStr.substring(startIdx, endIdx);
      return parseFloat(numStr) || 0;
    };

    // Helper to extract string value after a key
    const extractString = (key: string): string => {
      'worklet';
      const keyIdx = resultStr.indexOf(key);
      if (keyIdx === -1) return '';
      const startIdx = keyIdx + key.length + 1; // +1 for the opening quote
      const endIdx = resultStr.indexOf('"', startIdx);
      if (endIdx === -1) return '';
      return resultStr.substring(startIdx, endIdx);
    };

    const conf = extractNumber('"confidence":');
    const torsoX = extractNumber('"torsoX":');
    const torsoY = extractNumber('"torsoY":');
    const timestamp = extractNumber('"timestamp":');
    const procTime = extractNumber('"processingTimeMs":');

    // Throttle status updates to every ~100ms (avoid overwhelming JS thread)
    // But ALWAYS process gate crossing logic
    const now = Date.now();
    const shouldUpdateStatus = now - lastUpdateValue.value > 100;
    if (shouldUpdateStatus) {
      lastUpdateValue.value = now;
      // Call JS to update UI state
      if (onStatusUpdateJS) {
        onStatusUpdateJS(detected, conf, torsoX, torsoY, procTime);
      }
    }

    // Gate crossing detection - this is the critical path
    // Track when torso crosses from one side of gate to the other
    if (detected && conf >= minConfidence * 100) {
      const currentPrevX = previousXValue.value;

      // Check if we have a valid previous position and haven't already crossed
      if (currentPrevX >= 0 && !gateCrossedValue.value) {
        // Detect crossing: previous was on one side, current is on other side
        const crossedLeftToRight = currentPrevX < gateLineX && torsoX >= gateLineX;
        const crossedRightToLeft = currentPrevX > gateLineX && torsoX <= gateLineX;

        if (crossedLeftToRight || crossedRightToLeft) {
          gateCrossedValue.value = true;

          // Calculate interpolated crossing time for sub-frame accuracy
          // This is the key to achieving ±0.01s accuracy like Photo Finish
          const prevX = currentPrevX;
          const prevTimestamp = previousTimestampValue.value;
          let crossingTimeMs = timestamp;

          if (prevTimestamp > 0 && Math.abs(torsoX - prevX) > 0.0001) {
            // Linear interpolation: find exact moment chest crossed gate
            const totalDistance = torsoX - prevX;
            const distanceToGate = gateLineX - prevX;
            const factor = Math.max(0, Math.min(1, distanceToGate / totalDistance));
            const deltaTime = timestamp - prevTimestamp;
            crossingTimeMs = prevTimestamp + deltaTime * factor;
          }

          // Notify crossing with interpolated time
          if (onGateCrossedJS) {
            onGateCrossedJS(crossingTimeMs, conf);
          }

          // Trigger frame buffer capture for review (if enabled)
          if (enableFrameBuffer && onFrameBufferReadyJS) {
            startFrameBufferCaptureValue.value = true;
          }

          // Extract and send captured frame if available
          if (onCrossingFrameJS) {
            const frameBase64 = extractString('"frameBase64":');
            if (frameBase64.length > 0) {
              onCrossingFrameJS(frameBase64);
            }
          }
        }
      }

      // Update previous position and timestamp for next frame's interpolation
      previousXValue.value = torsoX;
      previousTimestampValue.value = timestamp;
    }

    // Handle manual capture request (independent of gate crossing)
    if (wantManualCapture && detected && onCrossingFrameJS) {
      manualCaptureValue.value = false; // Reset flag immediately
      const frameBase64 = extractString('"frameBase64":');
      if (frameBase64.length > 0) {
        onCrossingFrameJS(frameBase64);
      }
    }

    // Handle frame buffer ready response
    const frameBufferPath = extractString('"frameBufferPath":');
    if (frameBufferPath.length > 0 && onFrameBufferReadyJS) {
      const frameCount = extractNumber('"frameCount":');
      const aiFrameIndex = extractNumber('"aiFrameIndex":');
      onFrameBufferReadyJS(frameBufferPath, frameCount, aiFrameIndex);
    }
  }, [gateLineX, minConfidence, cameraPosition, debug, captureOnCrossing, enableFrameBuffer, onGateCrossedJS, onCrossingFrameJS, onFrameBufferReadyJS, onStatusUpdateJS, gateCrossedValue, lastUpdateValue, previousXValue, previousTimestampValue, manualCaptureValue, startFrameBufferCaptureValue]);

  // Reset function
  const reset = useCallback(() => {
    gateCrossedValue.value = false;
    previousXValue.value = -1;
    previousTimestampValue.value = 0;
    manualCaptureValue.value = false;
    startFrameBufferCaptureValue.value = false;
    setIsDetected(false);
    setTorsoCenter(null);
    setConfidence(0);
    setVelocity(0);
  }, [gateCrossedValue, previousXValue, previousTimestampValue, manualCaptureValue, startFrameBufferCaptureValue]);

  // Manual capture function - triggers capture on next frame
  const manualCapture = useCallback(() => {
    manualCaptureValue.value = true;
  }, [manualCaptureValue]);

  // Reset when gate line changes
  useEffect(() => {
    gateCrossedValue.value = false;
    previousXValue.value = -1;
    previousTimestampValue.value = 0;
  }, [gateLineX, gateCrossedValue, previousXValue, previousTimestampValue]);

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
    manualCapture,
  };
}
