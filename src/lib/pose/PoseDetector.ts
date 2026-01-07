/**
 * PoseDetector - Unified interface for pose detection
 *
 * Abstracts platform-specific pose detection:
 * - iOS: Vision Framework (VNDetectHumanBodyPoseRequest)
 * - Android: MediaPipe Pose / BlazePose
 * - Fallback: TensorFlow.js for Expo Go testing
 *
 * Per World Athletics Rule 164, only torso landmarks trigger timing:
 * - Shoulders (landmarks 11, 12)
 * - Hips (landmarks 23, 24)
 */

import { Platform } from 'react-native';
import { PoseLandmarks, PoseLandmark } from '../../types';

// Torso landmark indices (MediaPipe/BlazePose convention)
export const TORSO_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

// All landmark indices for full skeleton
export const ALL_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export interface DetectionResult {
  landmarks: PoseLandmarks | null;
  torsoCenter: { x: number; y: number } | null;
  confidence: number;
  timestamp: number;
  processingTime: number;
}

export interface PoseDetectorConfig {
  modelComplexity: 0 | 1 | 2; // Lite, Full, Heavy
  minDetectionConfidence: number;
  minTrackingConfidence: number;
  torsoOnly: boolean;
}

export type DetectorBackend = 'vision' | 'mediapipe' | 'tfjs' | 'mock';

export abstract class PoseDetector {
  protected config: PoseDetectorConfig;
  protected isInitialized: boolean = false;

  constructor(config: Partial<PoseDetectorConfig> = {}) {
    this.config = {
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      torsoOnly: true,
      ...config,
    };
  }

  abstract initialize(): Promise<void>;
  abstract detect(imageData: ImageData | any): Promise<DetectionResult>;
  abstract dispose(): void;

  /**
   * Calculate weighted torso center based on lean
   * During a sprint, the lean shifts weight distribution
   */
  protected calculateTorsoCenter(landmarks: PoseLandmarks): { x: number; y: number } | null {
    const leftShoulder = landmarks[TORSO_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[TORSO_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[TORSO_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[TORSO_LANDMARKS.RIGHT_HIP];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return null;
    }

    // Calculate shoulder and hip midpoints
    const shoulderMid = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    };

    const hipMid = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
    };

    // Calculate lean angle
    const leanAngle = Math.atan2(
      shoulderMid.x - hipMid.x,
      hipMid.y - shoulderMid.y
    );

    // Adjust weighting based on lean
    // Forward lean (negative angle) shifts center toward shoulders
    // Backward lean (positive angle) shifts center toward hips
    const leanFactor = Math.sin(leanAngle) * 0.2; // -0.2 to +0.2 adjustment
    const shoulderWeight = 0.5 - leanFactor;
    const hipWeight = 0.5 + leanFactor;

    return {
      x: shoulderMid.x * shoulderWeight + hipMid.x * hipWeight,
      y: shoulderMid.y * shoulderWeight + hipMid.y * hipWeight,
    };
  }

  /**
   * Calculate overall confidence from torso landmarks
   */
  protected calculateConfidence(landmarks: PoseLandmarks): number {
    const torsoIndices = Object.values(TORSO_LANDMARKS);
    let totalConfidence = 0;
    let count = 0;

    for (const idx of torsoIndices) {
      const landmark = landmarks[idx];
      if (landmark) {
        totalConfidence += landmark.confidence;
        count++;
      }
    }

    return count > 0 ? (totalConfidence / count) * 100 : 0;
  }

  /**
   * Filter landmarks to torso only
   */
  protected filterTorsoLandmarks(landmarks: PoseLandmarks): PoseLandmarks {
    const filtered: PoseLandmarks = {};
    const torsoIndices = Object.values(TORSO_LANDMARKS);

    for (const idx of torsoIndices) {
      if (landmarks[idx]) {
        filtered[idx] = landmarks[idx];
      }
    }

    return filtered;
  }
}

/**
 * Mock detector for testing in Expo Go
 */
export class MockPoseDetector extends PoseDetector {
  private frameCount: number = 0;

  async initialize(): Promise<void> {
    this.isInitialized = true;
    console.log('MockPoseDetector initialized');
  }

  async detect(_imageData: any): Promise<DetectionResult> {
    const startTime = performance.now();
    this.frameCount++;

    // Simulate detection delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Generate mock landmarks with simulated movement
    const t = this.frameCount / 30; // Time in seconds
    const yPosition = 0.3 + Math.sin(t * 2) * 0.4; // Oscillate 0.3-0.7

    const mockLandmarks: PoseLandmarks = {
      [TORSO_LANDMARKS.LEFT_SHOULDER]: {
        x: 0.4,
        y: yPosition - 0.1,
        confidence: 0.9,
      },
      [TORSO_LANDMARKS.RIGHT_SHOULDER]: {
        x: 0.6,
        y: yPosition - 0.1,
        confidence: 0.9,
      },
      [TORSO_LANDMARKS.LEFT_HIP]: {
        x: 0.42,
        y: yPosition + 0.15,
        confidence: 0.85,
      },
      [TORSO_LANDMARKS.RIGHT_HIP]: {
        x: 0.58,
        y: yPosition + 0.15,
        confidence: 0.85,
      },
    };

    const processingTime = performance.now() - startTime;

    return {
      landmarks: this.config.torsoOnly
        ? mockLandmarks
        : mockLandmarks,
      torsoCenter: this.calculateTorsoCenter(mockLandmarks),
      confidence: this.calculateConfidence(mockLandmarks),
      timestamp: Date.now(),
      processingTime,
    };
  }

  dispose(): void {
    this.isInitialized = false;
    this.frameCount = 0;
  }
}

/**
 * Factory function to create appropriate detector for platform
 */
export function createPoseDetector(
  config?: Partial<PoseDetectorConfig>
): PoseDetector {
  // For now, always use mock detector
  // In production build:
  // - iOS: Use VisionPoseDetector (native module)
  // - Android: Use MediaPipePoseDetector (native module)

  const backend = getDetectorBackend();
  console.log(`Creating pose detector with backend: ${backend}`);

  switch (backend) {
    case 'mock':
    default:
      return new MockPoseDetector(config);
  }
}

/**
 * Determine which detection backend to use
 */
export function getDetectorBackend(): DetectorBackend {
  // Check if we have native VisionCamera available (dev build, not Expo Go)
  try {
    const { VisionCameraProxy } = require('react-native-vision-camera');
    if (VisionCameraProxy) {
      if (Platform.OS === 'ios') {
        return 'vision';
      }
      if (Platform.OS === 'android') {
        return 'mediapipe';
      }
    }
  } catch {
    // VisionCamera not available (likely Expo Go)
  }

  return 'mock';
}
