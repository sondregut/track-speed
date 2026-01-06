/**
 * VisionPoseDetector - Native iOS Vision Framework pose detection
 *
 * Uses VNDetectHumanBodyPoseRequest via Vision Camera frame processor.
 * This provides the highest accuracy pose detection on iOS.
 *
 * Requirements:
 * - iOS 14+ (Vision framework pose detection)
 * - Development build (not Expo Go)
 * - react-native-vision-camera
 */

import { Platform } from 'react-native';

// Types for pose detection results from native module
export interface TorsoLandmark {
  x: number;      // 0-1, left to right
  y: number;      // 0-1, top to bottom
  confidence: number;
}

export interface TorsoLandmarks {
  leftShoulder: TorsoLandmark;
  rightShoulder: TorsoLandmark;
  leftHip: TorsoLandmark;
  rightHip: TorsoLandmark;
}

export interface TorsoCenter {
  x: number;
  y: number;
  leanAngle: number;
  leanFactor: number;
}

export interface PoseDetectionResult {
  detected: boolean;
  landmarks: TorsoLandmarks | null;
  torsoCenter: TorsoCenter | null;
  confidence: number;
  timestamp: number;
  processingTimeMs: number;
  frameWidth?: number;
  frameHeight?: number;
  error?: string;
}

/**
 * Check if native Vision pose detection is available
 */
export function isVisionPoseAvailable(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }

  // Check iOS version (needs 14+)
  const iosVersion = parseFloat(Platform.Version as string);
  if (iosVersion < 14) {
    return false;
  }

  // In Expo Go, native modules aren't available
  // This will be true in development builds
  try {
    // VisionCamera registers the frame processor plugin
    const { VisionCameraProxy } = require('react-native-vision-camera');
    return VisionCameraProxy !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get the frame processor function for Vision pose detection
 *
 * Usage with Vision Camera:
 * ```typescript
 * const frameProcessor = useFrameProcessor((frame) => {
 *   'worklet';
 *   const result = detectPose(frame);
 *   // Handle result...
 * }, []);
 * ```
 */
export function getDetectPosePlugin(): ((frame: any) => PoseDetectionResult) | null {
  if (!isVisionPoseAvailable()) {
    console.warn('Vision pose detection not available');
    return null;
  }

  try {
    const { VisionCameraProxy } = require('react-native-vision-camera');
    const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});

    if (!plugin) {
      console.warn('detectPose frame processor plugin not found');
      return null;
    }

    return (frame: any) => {
      'worklet';
      return plugin.call(frame) as PoseDetectionResult;
    };
  } catch (error) {
    console.error('Failed to initialize detectPose plugin:', error);
    return null;
  }
}

/**
 * Calculate if torso has crossed a gate line
 *
 * @param torsoCenter - Current torso center position (0-1 normalized)
 * @param gateLineX - Gate line X position (0-1 normalized)
 * @param previousX - Previous torso X position
 * @returns true if torso crossed the gate line this frame
 */
export function detectGateCrossing(
  torsoCenter: TorsoCenter | null,
  gateLineX: number,
  previousX: number | null
): boolean {
  if (!torsoCenter || previousX === null) {
    return false;
  }

  const currentX = torsoCenter.x;

  // Check if we crossed from left to right (or right to left)
  const crossedLeftToRight = previousX < gateLineX && currentX >= gateLineX;
  const crossedRightToLeft = previousX > gateLineX && currentX <= gateLineX;

  return crossedLeftToRight || crossedRightToLeft;
}

/**
 * Calculate velocity from torso movement
 *
 * @param current - Current torso center
 * @param previous - Previous torso center
 * @param deltaTimeMs - Time between frames in ms
 * @param frameWidth - Frame width in pixels (for real-world calculation)
 * @returns Velocity in pixels per second
 */
export function calculateTorsoVelocity(
  current: TorsoCenter | null,
  previous: TorsoCenter | null,
  deltaTimeMs: number,
  frameWidth: number = 1
): number {
  if (!current || !previous || deltaTimeMs <= 0) {
    return 0;
  }

  const deltaX = (current.x - previous.x) * frameWidth;
  const deltaY = (current.y - previous.y) * frameWidth;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  return (distance / deltaTimeMs) * 1000; // Convert to per-second
}

/**
 * Sub-frame interpolation for precise crossing time
 *
 * When torso crosses gate between frames, interpolate the exact crossing time.
 *
 * @param previousX - Torso X position in previous frame
 * @param currentX - Torso X position in current frame
 * @param gateLineX - Gate line X position
 * @param previousTimestamp - Timestamp of previous frame
 * @param currentTimestamp - Timestamp of current frame
 * @returns Interpolated crossing timestamp
 */
export function interpolateCrossingTime(
  previousX: number,
  currentX: number,
  gateLineX: number,
  previousTimestamp: number,
  currentTimestamp: number
): number {
  // Linear interpolation factor (0-1)
  const totalDistance = currentX - previousX;

  if (Math.abs(totalDistance) < 0.0001) {
    // No movement, return current time
    return currentTimestamp;
  }

  const distanceToGate = gateLineX - previousX;
  const factor = distanceToGate / totalDistance;

  // Clamp factor to 0-1
  const clampedFactor = Math.max(0, Math.min(1, factor));

  // Interpolate timestamp
  const deltaTime = currentTimestamp - previousTimestamp;
  return previousTimestamp + deltaTime * clampedFactor;
}
