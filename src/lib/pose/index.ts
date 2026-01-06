export {
  PoseDetector,
  MockPoseDetector,
  createPoseDetector,
  getDetectorBackend,
  TORSO_LANDMARKS,
  ALL_LANDMARKS,
  type DetectionResult,
  type PoseDetectorConfig,
  type DetectorBackend,
} from './PoseDetector';

export {
  TorsoTracker,
  type TrackedPosition,
  type TrackingConfig,
} from './TorsoTracker';

// Native iOS Vision pose detection
export {
  isVisionPoseAvailable,
  getDetectPosePlugin,
  detectGateCrossing,
  interpolateCrossingTime,
  calculateTorsoVelocity,
  type TorsoLandmark,
  type TorsoLandmarks,
  type TorsoCenter,
  type PoseDetectionResult,
} from './VisionPoseDetector';
