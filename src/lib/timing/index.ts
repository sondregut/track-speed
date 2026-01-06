export {
  TimingEngine,
  getTimingEngine,
  resetTimingEngine,
  type TimingFrame,
  type TimingConfig,
  type CrossingEvent,
} from './TimingEngine';

export {
  GhostGate,
  getGhostGate,
  resetGhostGate,
  type GhostGateConfig,
  type MotionRegion,
  type CalibrationResult,
} from './GhostGate';

export {
  ScanlineDetector,
  getScanlineDetector,
  resetScanlineDetector,
  createDefaultGateSetup,
  type ScanlineDetectorConfig,
  type DetectorState,
} from './ScanlineDetector';
