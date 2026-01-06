/**
 * TorsoTracker - Tracks torso movement for gate crossing detection
 *
 * Uses Kalman filtering for smooth tracking and velocity estimation.
 * This helps with sub-frame interpolation by predicting position
 * between actual detection frames.
 */

import { PoseLandmarks } from '../../types';
import { TORSO_LANDMARKS } from './PoseDetector';

export interface TrackedPosition {
  x: number;
  y: number;
  vx: number; // Velocity X
  vy: number; // Velocity Y
  timestamp: number;
  confidence: number;
}

export interface TrackingConfig {
  smoothingFactor: number; // 0-1, higher = more smoothing
  velocityDecay: number; // 0-1, velocity reduction per frame
  maxPredictionFrames: number; // How many frames to predict ahead
  minConfidence: number; // Minimum confidence to update
}

export class TorsoTracker {
  private config: TrackingConfig;
  private currentPosition: TrackedPosition | null = null;
  private history: TrackedPosition[] = [];
  private maxHistoryLength: number = 60; // ~2 seconds at 30fps

  constructor(config: Partial<TrackingConfig> = {}) {
    this.config = {
      smoothingFactor: 0.3,
      velocityDecay: 0.95,
      maxPredictionFrames: 3,
      minConfidence: 0.5,
      ...config,
    };
  }

  /**
   * Update tracker with new landmarks
   */
  update(landmarks: PoseLandmarks, timestamp: number): TrackedPosition | null {
    const torsoCenter = this.calculateTorsoCenter(landmarks);

    if (!torsoCenter) {
      // Use prediction if we have history
      return this.predict(timestamp);
    }

    const confidence = this.calculateConfidence(landmarks);

    if (confidence < this.config.minConfidence) {
      return this.predict(timestamp);
    }

    const newPosition = this.filterPosition(torsoCenter, timestamp, confidence);
    this.currentPosition = newPosition;

    // Add to history
    this.history.push(newPosition);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }

    return newPosition;
  }

  /**
   * Get current tracked position
   */
  getPosition(): TrackedPosition | null {
    return this.currentPosition;
  }

  /**
   * Predict position at a future timestamp
   */
  predict(timestamp: number): TrackedPosition | null {
    if (!this.currentPosition) {
      return null;
    }

    const dt = (timestamp - this.currentPosition.timestamp) / 1000; // seconds
    const maxDt = this.config.maxPredictionFrames / 30; // Assume 30fps

    if (dt > maxDt || dt < 0) {
      return null;
    }

    // Simple linear prediction with velocity decay
    const decayFactor = Math.pow(this.config.velocityDecay, dt * 30);

    return {
      x: this.currentPosition.x + this.currentPosition.vx * dt * decayFactor,
      y: this.currentPosition.y + this.currentPosition.vy * dt * decayFactor,
      vx: this.currentPosition.vx * decayFactor,
      vy: this.currentPosition.vy * decayFactor,
      timestamp,
      confidence: this.currentPosition.confidence * 0.9, // Reduce confidence for predictions
    };
  }

  /**
   * Get velocity magnitude
   */
  getVelocity(): number {
    if (!this.currentPosition) return 0;
    return Math.sqrt(
      this.currentPosition.vx ** 2 + this.currentPosition.vy ** 2
    );
  }

  /**
   * Get movement direction in radians
   */
  getDirection(): number {
    if (!this.currentPosition) return 0;
    return Math.atan2(this.currentPosition.vy, this.currentPosition.vx);
  }

  /**
   * Check if moving downward (toward gate)
   */
  isMovingDown(): boolean {
    return this.currentPosition ? this.currentPosition.vy > 0.01 : false;
  }

  /**
   * Get position history for analysis
   */
  getHistory(): TrackedPosition[] {
    return [...this.history];
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.currentPosition = null;
    this.history = [];
  }

  /**
   * Apply smoothing filter to new position
   */
  private filterPosition(
    raw: { x: number; y: number },
    timestamp: number,
    confidence: number
  ): TrackedPosition {
    if (!this.currentPosition) {
      // First position - no filtering
      return {
        x: raw.x,
        y: raw.y,
        vx: 0,
        vy: 0,
        timestamp,
        confidence,
      };
    }

    const dt = (timestamp - this.currentPosition.timestamp) / 1000;

    if (dt <= 0) {
      return this.currentPosition;
    }

    // Exponential smoothing
    const alpha = this.config.smoothingFactor;
    const smoothedX = alpha * raw.x + (1 - alpha) * this.currentPosition.x;
    const smoothedY = alpha * raw.y + (1 - alpha) * this.currentPosition.y;

    // Calculate velocity
    const rawVx = (smoothedX - this.currentPosition.x) / dt;
    const rawVy = (smoothedY - this.currentPosition.y) / dt;

    // Smooth velocity too
    const vx = alpha * rawVx + (1 - alpha) * this.currentPosition.vx;
    const vy = alpha * rawVy + (1 - alpha) * this.currentPosition.vy;

    return {
      x: smoothedX,
      y: smoothedY,
      vx,
      vy,
      timestamp,
      confidence,
    };
  }

  /**
   * Calculate torso center from landmarks
   */
  private calculateTorsoCenter(
    landmarks: PoseLandmarks
  ): { x: number; y: number } | null {
    const leftShoulder = landmarks[TORSO_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[TORSO_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[TORSO_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[TORSO_LANDMARKS.RIGHT_HIP];

    const points = [leftShoulder, rightShoulder, leftHip, rightHip].filter(
      Boolean
    );

    if (points.length < 3) {
      return null;
    }

    // Calculate weighted average based on confidence
    let sumX = 0;
    let sumY = 0;
    let sumWeight = 0;

    for (const point of points) {
      if (point) {
        sumX += point.x * point.confidence;
        sumY += point.y * point.confidence;
        sumWeight += point.confidence;
      }
    }

    if (sumWeight === 0) return null;

    return {
      x: sumX / sumWeight,
      y: sumY / sumWeight,
    };
  }

  /**
   * Calculate average confidence of torso landmarks
   */
  private calculateConfidence(landmarks: PoseLandmarks): number {
    const indices = Object.values(TORSO_LANDMARKS);
    let sum = 0;
    let count = 0;

    for (const idx of indices) {
      if (landmarks[idx]) {
        sum += landmarks[idx].confidence;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }
}
