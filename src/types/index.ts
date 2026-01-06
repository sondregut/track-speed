// Note: Navigation types are in ./navigation.ts
// Import them directly when needed to avoid circular deps

// ============================================
// Session & Training Types
// ============================================

/** Type of sprint session - determines UI and calculations */
export type SessionType = 'flying' | 'standing' | 'block_start' | 'series';

/** Start trigger method */
export type StartMethod = 'touch' | 'ready_set_go' | 'sound_detection' | 'three_two_one' | 'external_gate';

// ============================================
// Series/Interval Training Types
// ============================================

/** Series training mode (interval training) */
export interface SeriesConfig {
  /** Number of sets in the series */
  sets: number;
  /** Number of reps per set */
  repsPerSet: number;
  /** Rest time between reps (seconds) */
  restBetweenReps: number;
  /** Rest time between sets (seconds) */
  restBetweenSets: number;
  /** Distance for each rep (meters) */
  distance_m: number;
  /** Auto-start next rep after rest countdown */
  autoAdvance: boolean;
  /** Target time for each rep (optional, for pacing) */
  targetTime_ms?: number;
}

/** Current state of a series session */
export interface SeriesState {
  /** Current set number (1-indexed) */
  currentSet: number;
  /** Current rep within the set (1-indexed) */
  currentRep: number;
  /** Whether currently in rest period */
  isResting: boolean;
  /** Remaining rest time in seconds */
  restRemaining: number;
  /** All results from this series */
  results: SeriesRepResult[];
  /** Is the series complete */
  isComplete: boolean;
}

/** Result for a single rep in a series */
export interface SeriesRepResult {
  setNumber: number;
  repNumber: number;
  time_ms: number;
  velocity_ms?: number;
  comparedToTarget?: 'faster' | 'slower' | 'on_target';
}

/** Summary statistics for a completed series */
export interface SeriesSummary {
  totalReps: number;
  completedReps: number;
  averageTime_ms: number;
  bestTime_ms: number;
  worstTime_ms: number;
  averageVelocity_ms?: number;
  consistency: number; // Standard deviation as percentage
}

/** Velocity display unit preference */
export type VelocityUnit = 'm/s' | 'km/h' | 'mph';

/** Distance measurement system */
export type DistanceUnit = 'metric' | 'imperial';

/** Timer state machine */
export type TimingState = 'idle' | 'ready' | 'running' | 'stopped';

// ============================================
// Timing Result Types
// ============================================

/** Split time recorded during a run */
export interface SplitTime {
  distance_m: number;
  time_ms: number;
  velocity_ms?: number; // Calculated velocity at this split
}

/** Complete timing result with velocity calculations */
export interface TimingResult {
  id: string;
  sessionId: string;
  athleteId?: string;

  // Core timing
  time_ms: number;
  source: 'auto_detected' | 'manual_override' | 'manual_only';
  confidence: number | null;
  startMethod: StartMethod;
  frameNumber: number;
  videoFrameRate?: number;

  // Velocity data (calculated from distance/time)
  velocity_ms?: number; // Max velocity in m/s
  distance_m?: number; // Distance for this result (optional for legacy)

  // Session context (optional for backwards compatibility)
  sessionType?: SessionType;
  flyInDistance_m?: number; // For flying starts: acceleration zone

  // Split times (for multi-gate setups)
  splits?: SplitTime[];

  createdAt?: Date;
}

// ============================================
// Session Types
// ============================================

/** Flying start configuration */
export interface FlyingConfig {
  flyingDistance_m: number; // Timed zone: 10, 20, 30m
  flyInDistance_m: number; // Acceleration zone: 20, 30, 40m
}

/** Standing/Block start configuration */
export interface StandardConfig {
  totalDistance_m: number; // 10, 20, 30, 40, 60, 100m
}

/** Gate role in multi-phone timing setup */
export type GateRole = 'start' | 'lap' | 'finish';

/** Individual gate configuration */
export interface GateConfig {
  role: GateRole;
  distance_m: number; // Distance from start (0 for start gate)
  deviceId?: string; // Connected device ID
  deviceName?: string; // Human-readable device name
}

/** Split configuration for multi-gate timing */
export interface SplitConfig {
  enabled: boolean;
  distances_m: number[]; // e.g., [10, 20, 30] for splits at those points
  gates?: GateConfig[]; // Detailed gate configuration for multi-phone
}

/** Training session */
export interface Session {
  id: string;
  name: string;
  date: string;
  location?: string;

  // Session type and configuration
  sessionType: SessionType;
  flyingConfig?: FlyingConfig; // Set when sessionType === 'flying'
  standardConfig?: StandardConfig; // Set when sessionType === 'standing' | 'block_start'
  seriesConfig?: SeriesConfig; // Set when sessionType === 'series'
  splitConfig?: SplitConfig;

  // Legacy field for backwards compatibility
  distance?: number;

  startMethod: StartMethod;
  results?: TimingResult[];
  settings?: SessionSettings;
}

/** Session-level settings */
export interface SessionSettings {
  targetFPS: 60 | 120 | 240;
  startMethod: StartMethod;
  ghostGateEnabled: boolean;
  autoSave: boolean;
}

// ============================================
// Preset Configurations
// ============================================

/** Common flying sprint distances */
export const FLYING_DISTANCES = [10, 20, 30] as const;
export type FlyingDistance = typeof FLYING_DISTANCES[number];

/** Common fly-in (acceleration) distances */
export const FLY_IN_DISTANCES = [20, 30, 40] as const;
export type FlyInDistance = typeof FLY_IN_DISTANCES[number];

/** Common standing/block start distances */
export const STANDARD_DISTANCES = [10, 20, 30, 40, 60, 100] as const;
export type StandardDistance = typeof STANDARD_DISTANCES[number];

export interface Athlete {
  id: string;
  name: string;
  team?: string;
  personalBests?: Record<number, number>; // distance -> time_ms
}

// Pose Detection Types
export interface PoseLandmark {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  confidence: number; // 0-1
}

export interface PoseLandmarks {
  [landmarkIndex: number]: PoseLandmark;
}

export interface TorsoPosition {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  confidence: number; // 0-1
  leanAngle: number; // degrees from vertical
  timestamp: number; // milliseconds
}

// Camera Types
export type CameraPosition = 'front' | 'back';

export interface CameraConfig {
  targetFPS: number;
  resolution: 'hd' | 'fhd' | '4k';
  position: CameraPosition;
}

// Ghost Gate Types
export interface GhostGateCalibration {
  isCalibrated: boolean;
  calibratedAt: Date | null;
  quality: CalibrationQuality | null;
}

export interface CalibrationQuality {
  status: 'excellent' | 'good' | 'acceptable' | 'poor';
  stabilityScore: number;
  lightingScore: number;
  frameCount: number;
}

// Thumb Start Types
export type ThumbStartState = 'idle' | 'ready' | 'running' | 'cancelled';

// App State Types
export type AppScreen = 'home' | 'session' | 'results' | 'settings' | 'history';

// ============================================
// Gate ROI & Scanline Detection Types
// ============================================

/**
 * Gate setup orientation
 * - 'horizontal': Camera perpendicular to track, athletes run left↔right
 * - 'vertical': Camera along track, athletes run toward/away from camera
 */
export type GateOrientation = 'horizontal' | 'vertical';

/**
 * Direction athletes move through the gate
 */
export type RunDirection = 'left_to_right' | 'right_to_left' | 'toward_camera' | 'away_from_camera';

/**
 * Region of Interest for the finish line scanline
 * All values normalized 0-1
 */
export interface GateROI {
  /** Center position of the gate line (0-1, typically 0.5 for center) */
  position: number;
  /** Width of the detection strip (0-1, e.g., 0.05 = 5% of frame width) */
  width: number;
  /** Top boundary of detection area (0-1) */
  top: number;
  /** Bottom boundary of detection area (0-1) */
  bottom: number;
}

/**
 * Complete gate setup configuration
 */
export interface GateSetup {
  /** How the camera is positioned relative to the track */
  orientation: GateOrientation;
  /** Direction athletes run through the frame */
  runDirection: RunDirection;
  /** The vertical scanline ROI for detection */
  roi: GateROI;
  /** Minimum motion intensity to trigger pose detection (0-1) */
  motionThreshold: number;
  /** Minimum confidence to count as valid detection (0-1) */
  confidenceThreshold: number;
}

/**
 * Motion detection result for the ROI
 */
export interface ROIMotionResult {
  /** Was motion detected in the ROI? */
  hasMotion: boolean;
  /** Intensity of motion (0-1) */
  intensity: number;
  /** Bounding box of motion within ROI (normalized 0-1) */
  motionBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Timestamp of detection */
  timestamp: number;
}

/**
 * Gate crossing detection result
 */
export interface GateCrossingResult {
  /** Was a crossing detected this frame? */
  crossed: boolean;
  /** Precise crossing timestamp (sub-frame interpolated) */
  crossingTime: number;
  /** Torso X position at crossing (normalized 0-1) */
  crossingX: number;
  /** Confidence of the detection (0-1) */
  confidence: number;
  /** Direction of crossing */
  direction: 'entering' | 'exiting';
}
