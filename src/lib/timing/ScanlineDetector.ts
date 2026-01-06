/**
 * ScanlineDetector - Optimized gate crossing detection
 *
 * Combines cheap motion detection with expensive pose detection:
 * 1. Continuously monitor thin vertical ROI for motion (fast, ~0.1ms)
 * 2. When motion detected, run pose detection on motion region (slower, ~5-15ms)
 * 3. Track torso position and detect gate line crossing
 * 4. Use sub-frame interpolation for precise crossing time
 *
 * Designed for:
 * - Phone on tripod, perpendicular to track
 * - Athletes run left↔right through frame
 * - Finish line is a vertical strip in the camera view
 */

import type {
  GateSetup,
  GateROI,
  GateCrossingResult,
  ROIMotionResult,
  RunDirection,
} from '../../types';
import { GhostGate, getGhostGate } from './GhostGate';
import { TorsoTracker, TrackedPosition } from '../pose/TorsoTracker';
import {
  PoseDetectionResult,
  interpolateCrossingTime,
} from '../pose/VisionPoseDetector';

export interface ScanlineDetectorConfig {
  /** Gate setup with ROI and thresholds */
  gateSetup: GateSetup;
  /** Callback when motion detected in ROI */
  onMotion?: (result: ROIMotionResult) => void;
  /** Callback when pose detected */
  onPose?: (result: PoseDetectionResult) => void;
  /** Callback when gate crossing detected */
  onCrossing?: (result: GateCrossingResult) => void;
}

export interface DetectorState {
  /** Is the detector actively monitoring */
  isActive: boolean;
  /** Current tracking state */
  trackingState: 'waiting' | 'approaching' | 'in_roi' | 'crossed' | 'exited';
  /** Last motion detection result */
  lastMotion: ROIMotionResult | null;
  /** Last pose detection result */
  lastPose: PoseDetectionResult | null;
  /** Last crossing result */
  lastCrossing: GateCrossingResult | null;
  /** Frame count since start */
  frameCount: number;
  /** Pose detection count (expensive operation tracking) */
  poseDetectionCount: number;
}

/**
 * Default gate setup for horizontal (perpendicular) camera position
 */
export function createDefaultGateSetup(
  runDirection: RunDirection = 'left_to_right'
): GateSetup {
  return {
    orientation: 'horizontal',
    runDirection,
    roi: {
      position: 0.5, // Center of frame
      width: 0.08, // 8% of frame width (~60-80 pixels on 1080p)
      top: 0.15, // Exclude sky/background
      bottom: 0.95, // Include feet
    },
    motionThreshold: 0.03, // 3% motion intensity to trigger
    confidenceThreshold: 0.5, // 50% pose confidence minimum
  };
}

export class ScanlineDetector {
  private config: ScanlineDetectorConfig;
  private ghostGate: GhostGate;
  private torsoTracker: TorsoTracker;
  private state: DetectorState;
  private previousTorsoX: number | null = null;
  private previousTimestamp: number | null = null;

  constructor(config: ScanlineDetectorConfig) {
    this.config = config;
    this.ghostGate = getGhostGate();
    this.ghostGate.setROI(config.gateSetup.roi);
    this.torsoTracker = new TorsoTracker({
      smoothingFactor: 0.4,
      minConfidence: config.gateSetup.confidenceThreshold,
    });

    this.state = {
      isActive: false,
      trackingState: 'waiting',
      lastMotion: null,
      lastPose: null,
      lastCrossing: null,
      frameCount: 0,
      poseDetectionCount: 0,
    };
  }

  /**
   * Start the detector
   */
  start(): void {
    this.state.isActive = true;
    this.state.trackingState = 'waiting';
    this.state.frameCount = 0;
    this.state.poseDetectionCount = 0;
    this.previousTorsoX = null;
    this.previousTimestamp = null;
    this.torsoTracker.reset();
  }

  /**
   * Stop the detector
   */
  stop(): void {
    this.state.isActive = false;
  }

  /**
   * Reset for next athlete
   */
  reset(): void {
    this.state.trackingState = 'waiting';
    this.state.lastMotion = null;
    this.state.lastPose = null;
    this.state.lastCrossing = null;
    this.previousTorsoX = null;
    this.previousTimestamp = null;
    this.torsoTracker.reset();
  }

  /**
   * Process a frame - the main detection loop
   *
   * @param frame - ImageData from camera
   * @param poseResult - Pose detection result (only provided when motion triggers it)
   * @returns Whether pose detection should run on this frame
   */
  processFrame(
    frame: ImageData,
    poseResult?: PoseDetectionResult
  ): { shouldRunPose: boolean; crossing: GateCrossingResult | null } {
    if (!this.state.isActive) {
      return { shouldRunPose: false, crossing: null };
    }

    this.state.frameCount++;

    // Step 1: Check for motion in ROI (always runs, very fast)
    const motionResult = this.ghostGate.detectMotionInROI(frame);
    this.state.lastMotion = motionResult;
    this.config.onMotion?.(motionResult);

    // Step 2: Determine if we should run pose detection
    const shouldRunPose = this.shouldRunPoseDetection(motionResult);

    // Step 3: If we have a pose result, process it
    let crossing: GateCrossingResult | null = null;
    if (poseResult && poseResult.detected) {
      this.state.lastPose = poseResult;
      this.state.poseDetectionCount++;
      this.config.onPose?.(poseResult);

      // Update tracking and check for crossing
      crossing = this.processPoseResult(poseResult);
      if (crossing) {
        this.state.lastCrossing = crossing;
        this.config.onCrossing?.(crossing);
      }
    }

    return { shouldRunPose, crossing };
  }

  /**
   * Decide if pose detection should run this frame
   */
  private shouldRunPoseDetection(motionResult: ROIMotionResult): boolean {
    const { motionThreshold } = this.config.gateSetup;

    // Always run pose if we're already tracking someone
    if (
      this.state.trackingState === 'approaching' ||
      this.state.trackingState === 'in_roi'
    ) {
      return true;
    }

    // Otherwise, only run if motion exceeds threshold
    if (motionResult.hasMotion && motionResult.intensity > motionThreshold) {
      this.state.trackingState = 'approaching';
      return true;
    }

    return false;
  }

  /**
   * Process pose detection result and check for gate crossing
   */
  private processPoseResult(
    poseResult: PoseDetectionResult
  ): GateCrossingResult | null {
    if (!poseResult.torsoCenter) {
      return null;
    }

    const { roi, runDirection } = this.config.gateSetup;
    const torsoX = poseResult.torsoCenter.x;
    const timestamp = poseResult.timestamp;
    const gateLineX = roi.position;

    // Update tracking state based on position
    this.updateTrackingState(torsoX, gateLineX);

    // Check for gate crossing
    if (this.previousTorsoX !== null && this.previousTimestamp !== null) {
      const crossed = this.checkCrossing(
        this.previousTorsoX,
        torsoX,
        gateLineX,
        runDirection
      );

      if (crossed) {
        // Use sub-frame interpolation for precise crossing time
        const crossingTime = interpolateCrossingTime(
          this.previousTorsoX,
          torsoX,
          gateLineX,
          this.previousTimestamp,
          timestamp
        );

        const crossingResult: GateCrossingResult = {
          crossed: true,
          crossingTime,
          crossingX: gateLineX,
          confidence: poseResult.confidence,
          direction: this.getCrossingDirection(
            this.previousTorsoX,
            torsoX,
            runDirection
          ),
        };

        this.state.trackingState = 'crossed';
        this.previousTorsoX = torsoX;
        this.previousTimestamp = timestamp;

        return crossingResult;
      }
    }

    // Update previous position for next frame
    this.previousTorsoX = torsoX;
    this.previousTimestamp = timestamp;

    return null;
  }

  /**
   * Update tracking state based on torso position relative to gate
   */
  private updateTrackingState(torsoX: number, gateLineX: number): void {
    const { roi } = this.config.gateSetup;
    const roiLeft = roi.position - roi.width / 2;
    const roiRight = roi.position + roi.width / 2;

    if (torsoX >= roiLeft && torsoX <= roiRight) {
      if (this.state.trackingState !== 'crossed') {
        this.state.trackingState = 'in_roi';
      }
    } else if (this.state.trackingState === 'crossed') {
      this.state.trackingState = 'exited';
    }
  }

  /**
   * Check if torso crossed the gate line
   */
  private checkCrossing(
    previousX: number,
    currentX: number,
    gateLineX: number,
    runDirection: RunDirection
  ): boolean {
    // For left-to-right: crossing when going from left of line to right of line
    // For right-to-left: crossing when going from right of line to left of line

    const crossedLeftToRight = previousX < gateLineX && currentX >= gateLineX;
    const crossedRightToLeft = previousX > gateLineX && currentX <= gateLineX;

    if (runDirection === 'left_to_right') {
      return crossedLeftToRight;
    } else if (runDirection === 'right_to_left') {
      return crossedRightToLeft;
    }

    // For other directions or unknown, accept either
    return crossedLeftToRight || crossedRightToLeft;
  }

  /**
   * Determine crossing direction
   */
  private getCrossingDirection(
    previousX: number,
    currentX: number,
    runDirection: RunDirection
  ): 'entering' | 'exiting' {
    const movingRight = currentX > previousX;

    if (runDirection === 'left_to_right') {
      return movingRight ? 'entering' : 'exiting';
    } else if (runDirection === 'right_to_left') {
      return movingRight ? 'exiting' : 'entering';
    }

    return 'entering';
  }

  /**
   * Get current detector state
   */
  getState(): DetectorState {
    return { ...this.state };
  }

  /**
   * Get efficiency stats
   */
  getEfficiencyStats(): {
    frameCount: number;
    poseDetectionCount: number;
    poseDetectionRate: number;
    estimatedSavings: number;
  } {
    const { frameCount, poseDetectionCount } = this.state;
    const rate = frameCount > 0 ? poseDetectionCount / frameCount : 0;

    return {
      frameCount,
      poseDetectionCount,
      poseDetectionRate: rate,
      // Estimated % savings from not running pose on every frame
      estimatedSavings: Math.round((1 - rate) * 100),
    };
  }

  /**
   * Update gate setup (e.g., when user adjusts the ROI)
   */
  updateGateSetup(gateSetup: Partial<GateSetup>): void {
    this.config.gateSetup = { ...this.config.gateSetup, ...gateSetup };
    if (gateSetup.roi) {
      this.ghostGate.setROI(gateSetup.roi);
    }
  }
}

// Singleton for easy access
let scanlineDetectorInstance: ScanlineDetector | null = null;

export function getScanlineDetector(
  config?: ScanlineDetectorConfig
): ScanlineDetector {
  if (!scanlineDetectorInstance && config) {
    scanlineDetectorInstance = new ScanlineDetector(config);
  } else if (config) {
    scanlineDetectorInstance?.updateGateSetup(config.gateSetup);
  }
  return scanlineDetectorInstance!;
}

export function resetScanlineDetector(): void {
  scanlineDetectorInstance?.stop();
  scanlineDetectorInstance = null;
}
