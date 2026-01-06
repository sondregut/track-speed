/**
 * TimingEngine - Core timing logic for Track Speed
 *
 * IMPORTANT: This class coordinates timing but relies on native modules
 * for actual precision timing:
 * - iOS: mach_continuous_time() for nanosecond precision
 * - Android: SystemClock.elapsedRealtimeNanos() for monotonic timestamps
 *
 * Never use Date.now() for timing - it's not monotonic!
 */

import { StartMethod, TimingResult, TimingState } from '../../types';

export interface TimingFrame {
  timestamp: number; // Native timestamp in nanoseconds
  frameNumber: number;
  torsoPosition: { x: number; y: number } | null;
  confidence: number;
}

export interface TimingConfig {
  gatePosition: number; // 0-1, position of virtual gate line
  subFrameInterpolation: boolean;
  confidenceThreshold: number; // 0-100
}

export interface CrossingEvent {
  timestamp: number;
  frameNumber: number;
  confidence: number;
  interpolated: boolean;
  torsoPosition: { x: number; y: number };
}

type TimingCallback = (event: CrossingEvent) => void;

export class TimingEngine {
  private config: TimingConfig;
  private state: TimingState = 'idle';
  private startTimestamp: number | null = null;
  private frames: TimingFrame[] = [];
  private onCrossing: TimingCallback | null = null;

  // Track last known position for crossing detection
  private lastPosition: { x: number; y: number } | null = null;
  private lastFrameNumber: number = 0;

  constructor(config: Partial<TimingConfig> = {}) {
    this.config = {
      gatePosition: 0.7,
      subFrameInterpolation: true,
      confidenceThreshold: 70,
      ...config,
    };
  }

  /**
   * Set callback for crossing events
   */
  setOnCrossing(callback: TimingCallback): void {
    this.onCrossing = callback;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TimingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current state
   */
  getState(): TimingState {
    return this.state;
  }

  /**
   * Prepare for timing (calibration phase)
   */
  prepare(): void {
    this.state = 'ready';
    this.frames = [];
    this.lastPosition = null;
    this.lastFrameNumber = 0;
  }

  /**
   * Start timing
   * @param timestamp Native timestamp from monotonic clock (nanoseconds)
   */
  start(timestamp: number): void {
    if (this.state !== 'ready' && this.state !== 'idle') {
      console.warn('TimingEngine: Cannot start from state:', this.state);
      return;
    }

    this.state = 'running';
    this.startTimestamp = timestamp;
    this.frames = [];
  }

  /**
   * Process a frame from the camera
   */
  processFrame(frame: TimingFrame): CrossingEvent | null {
    if (this.state !== 'running') {
      return null;
    }

    // Store frame for analysis
    this.frames.push(frame);

    // Skip if no torso detected or low confidence
    if (!frame.torsoPosition || frame.confidence < this.config.confidenceThreshold) {
      return null;
    }

    // Check for gate crossing
    const crossing = this.detectCrossing(frame);

    if (crossing) {
      this.onCrossing?.(crossing);
    }

    // Update tracking
    this.lastPosition = frame.torsoPosition;
    this.lastFrameNumber = frame.frameNumber;

    return crossing;
  }

  /**
   * Detect if torso crossed the gate line
   */
  private detectCrossing(frame: TimingFrame): CrossingEvent | null {
    if (!this.lastPosition || !frame.torsoPosition) {
      return null;
    }

    const gateY = this.config.gatePosition;
    const prevY = this.lastPosition.y;
    const currY = frame.torsoPosition.y;

    // Check if crossed gate line (moving downward through frame)
    // Y increases from top to bottom
    const crossedGate =
      (prevY < gateY && currY >= gateY) || // Moving down
      (prevY > gateY && currY <= gateY);   // Moving up

    if (!crossedGate) {
      return null;
    }

    let crossingTimestamp: number;
    let interpolated = false;

    if (this.config.subFrameInterpolation && this.frames.length >= 2) {
      // Sub-frame interpolation for more precise timing
      const prevFrame = this.frames[this.frames.length - 2];
      crossingTimestamp = this.interpolateCrossingTime(
        prevFrame,
        frame,
        gateY
      );
      interpolated = true;
    } else {
      crossingTimestamp = frame.timestamp;
    }

    return {
      timestamp: crossingTimestamp,
      frameNumber: frame.frameNumber,
      confidence: frame.confidence,
      interpolated,
      torsoPosition: frame.torsoPosition,
    };
  }

  /**
   * Interpolate exact crossing time between frames
   */
  private interpolateCrossingTime(
    prevFrame: TimingFrame,
    currFrame: TimingFrame,
    gateY: number
  ): number {
    if (!prevFrame.torsoPosition || !currFrame.torsoPosition) {
      return currFrame.timestamp;
    }

    const prevY = prevFrame.torsoPosition.y;
    const currY = currFrame.torsoPosition.y;
    const deltaY = currY - prevY;

    if (Math.abs(deltaY) < 0.001) {
      return currFrame.timestamp;
    }

    // Linear interpolation
    const ratio = (gateY - prevY) / deltaY;
    const deltaTime = currFrame.timestamp - prevFrame.timestamp;

    return prevFrame.timestamp + ratio * deltaTime;
  }

  /**
   * Stop timing and return result
   */
  stop(endTimestamp: number): { elapsed_ns: number; elapsed_ms: number } | null {
    if (this.state !== 'running' || this.startTimestamp === null) {
      return null;
    }

    this.state = 'stopped';
    const elapsed_ns = endTimestamp - this.startTimestamp;
    const elapsed_ms = elapsed_ns / 1_000_000;

    return { elapsed_ns, elapsed_ms };
  }

  /**
   * Reset the engine
   */
  reset(): void {
    this.state = 'idle';
    this.startTimestamp = null;
    this.frames = [];
    this.lastPosition = null;
    this.lastFrameNumber = 0;
  }

  /**
   * Get all captured frames (for review/analysis)
   */
  getFrames(): TimingFrame[] {
    return [...this.frames];
  }

  /**
   * Get timing precision estimate based on frame rate
   */
  getEstimatedPrecision(): number {
    if (this.frames.length < 2) {
      return 16.67; // Assume 60fps
    }

    // Calculate average frame interval
    let totalInterval = 0;
    for (let i = 1; i < Math.min(this.frames.length, 30); i++) {
      totalInterval += this.frames[i].timestamp - this.frames[i - 1].timestamp;
    }
    const avgInterval = totalInterval / (Math.min(this.frames.length, 30) - 1);
    const avgIntervalMs = avgInterval / 1_000_000;

    // Sub-frame interpolation improves precision by ~4x
    return this.config.subFrameInterpolation ? avgIntervalMs / 4 : avgIntervalMs;
  }
}

// Singleton instance for app-wide use
let engineInstance: TimingEngine | null = null;

export function getTimingEngine(config?: Partial<TimingConfig>): TimingEngine {
  if (!engineInstance) {
    engineInstance = new TimingEngine(config);
  } else if (config) {
    engineInstance.updateConfig(config);
  }
  return engineInstance;
}

export function resetTimingEngine(): void {
  engineInstance?.reset();
  engineInstance = null;
}
