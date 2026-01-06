/**
 * GhostGate - Background subtraction for faster detection
 *
 * Creates a "ghost" reference of the empty gate area, then detects
 * motion by comparing against this reference. This dramatically
 * reduces processing time by focusing pose detection only on
 * regions with movement.
 *
 * Optimized for vertical scanline detection:
 * - Camera perpendicular to track on tripod
 * - Athletes run left→right or right→left through frame
 * - Only monitors a thin vertical strip (the "gate line")
 */

import type { GateROI, ROIMotionResult } from '../../types';

export interface GhostGateConfig {
  calibrationFrames: number;
  sensitivity: number; // 0-100
  motionThreshold: number;
  updateInterval: number; // How often to update background (frames)
  /** Optional ROI for focused scanline detection */
  roi?: GateROI;
}

export interface MotionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
}

export interface CalibrationResult {
  success: boolean;
  error?: string;
  frameCount: number;
  backgroundQuality: number;
}

type CalibrationCallback = (progress: number) => void;

export class GhostGate {
  private config: GhostGateConfig;
  private isCalibrated: boolean = false;
  private calibrationFrames: ImageData[] = [];
  private backgroundModel: Uint8ClampedArray | null = null;
  private framesSinceUpdate: number = 0;

  constructor(config: Partial<GhostGateConfig> = {}) {
    this.config = {
      calibrationFrames: 30,
      sensitivity: 50,
      motionThreshold: 25,
      updateInterval: 300, // Update every 10 seconds at 30fps
      ...config,
    };
  }

  /**
   * Check if ghost gate is calibrated
   */
  getIsCalibrated(): boolean {
    return this.isCalibrated;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GhostGateConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Start calibration process
   * In production, this would capture frames from the camera
   */
  async calibrate(
    frameSource: AsyncGenerator<ImageData>,
    onProgress?: CalibrationCallback
  ): Promise<CalibrationResult> {
    this.calibrationFrames = [];
    this.isCalibrated = false;

    try {
      let frameCount = 0;

      for await (const frame of frameSource) {
        this.calibrationFrames.push(frame);
        frameCount++;

        onProgress?.(frameCount / this.config.calibrationFrames);

        if (frameCount >= this.config.calibrationFrames) {
          break;
        }
      }

      if (frameCount < this.config.calibrationFrames / 2) {
        return {
          success: false,
          error: 'Insufficient frames for calibration',
          frameCount,
          backgroundQuality: 0,
        };
      }

      // Build background model by averaging frames
      this.buildBackgroundModel();

      this.isCalibrated = true;
      return {
        success: true,
        frameCount,
        backgroundQuality: this.assessBackgroundQuality(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        frameCount: this.calibrationFrames.length,
        backgroundQuality: 0,
      };
    }
  }

  /**
   * Quick calibration using a single frame (less accurate but faster)
   */
  quickCalibrate(frame: ImageData): CalibrationResult {
    this.calibrationFrames = [frame];
    this.backgroundModel = new Uint8ClampedArray(frame.data);
    this.isCalibrated = true;

    return {
      success: true,
      frameCount: 1,
      backgroundQuality: 0.5, // Lower quality for single-frame calibration
    };
  }

  /**
   * Build background model from calibration frames
   */
  private buildBackgroundModel(): void {
    if (this.calibrationFrames.length === 0) return;

    const firstFrame = this.calibrationFrames[0];
    const model = new Uint8ClampedArray(firstFrame.data.length);

    // Average all calibration frames
    for (let i = 0; i < model.length; i++) {
      let sum = 0;
      for (const frame of this.calibrationFrames) {
        sum += frame.data[i];
      }
      model[i] = Math.round(sum / this.calibrationFrames.length);
    }

    this.backgroundModel = model;
  }

  /**
   * Assess quality of background model (0-1)
   */
  private assessBackgroundQuality(): number {
    if (!this.backgroundModel || this.calibrationFrames.length < 2) {
      return 0;
    }

    // Calculate variance across calibration frames
    // Lower variance = more stable background = higher quality
    let totalVariance = 0;
    const pixelCount = this.backgroundModel.length / 4; // RGBA

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      let variance = 0;

      for (const frame of this.calibrationFrames) {
        const diff = frame.data[idx] - this.backgroundModel[idx];
        variance += diff * diff;
      }
      variance /= this.calibrationFrames.length;
      totalVariance += variance;
    }

    const avgVariance = totalVariance / pixelCount;
    // Normalize: 0 variance = 1.0 quality, 1000+ variance = 0 quality
    return Math.max(0, 1 - avgVariance / 1000);
  }

  /**
   * Detect motion regions in a frame
   */
  detectMotion(frame: ImageData): MotionRegion[] {
    if (!this.isCalibrated || !this.backgroundModel) {
      // Return full frame as motion region if not calibrated
      return [
        {
          x: 0,
          y: 0,
          width: frame.width,
          height: frame.height,
          intensity: 1,
        },
      ];
    }

    const threshold = this.calculateThreshold();
    const regions: MotionRegion[] = [];

    // Simple grid-based motion detection
    const gridSize = 32;
    const gridCols = Math.ceil(frame.width / gridSize);
    const gridRows = Math.ceil(frame.height / gridSize);

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        const startX = gx * gridSize;
        const startY = gy * gridSize;
        const endX = Math.min(startX + gridSize, frame.width);
        const endY = Math.min(startY + gridSize, frame.height);

        let motionSum = 0;
        let pixelCount = 0;

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * frame.width + x) * 4;

            // Calculate grayscale difference
            const frameLum =
              frame.data[idx] * 0.299 +
              frame.data[idx + 1] * 0.587 +
              frame.data[idx + 2] * 0.114;
            const bgLum =
              this.backgroundModel[idx] * 0.299 +
              this.backgroundModel[idx + 1] * 0.587 +
              this.backgroundModel[idx + 2] * 0.114;

            const diff = Math.abs(frameLum - bgLum);
            if (diff > threshold) {
              motionSum += diff;
            }
            pixelCount++;
          }
        }

        const intensity = motionSum / (pixelCount * 255);
        if (intensity > 0.05) {
          regions.push({
            x: startX,
            y: startY,
            width: endX - startX,
            height: endY - startY,
            intensity,
          });
        }
      }
    }

    // Merge adjacent regions
    return this.mergeRegions(regions);
  }

  /**
   * Calculate motion threshold based on sensitivity
   */
  private calculateThreshold(): number {
    // sensitivity 0 = threshold 50 (very sensitive)
    // sensitivity 100 = threshold 5 (less sensitive)
    return this.config.motionThreshold * (1 - this.config.sensitivity / 100) + 5;
  }

  /**
   * Merge adjacent motion regions
   */
  private mergeRegions(regions: MotionRegion[]): MotionRegion[] {
    if (regions.length <= 1) return regions;

    // Simple bounding box merge
    const merged: MotionRegion[] = [];
    const used = new Set<number>();

    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) continue;

      let region = { ...regions[i] };
      used.add(i);

      // Find overlapping regions
      for (let j = i + 1; j < regions.length; j++) {
        if (used.has(j)) continue;

        const other = regions[j];
        if (this.regionsOverlap(region, other)) {
          region = this.mergeTwo(region, other);
          used.add(j);
        }
      }

      merged.push(region);
    }

    return merged;
  }

  /**
   * Check if two regions overlap or are adjacent
   */
  private regionsOverlap(a: MotionRegion, b: MotionRegion): boolean {
    const margin = 16; // Allow some gap for merging
    return !(
      a.x + a.width + margin < b.x ||
      b.x + b.width + margin < a.x ||
      a.y + a.height + margin < b.y ||
      b.y + b.height + margin < a.y
    );
  }

  /**
   * Merge two regions into one
   */
  private mergeTwo(a: MotionRegion, b: MotionRegion): MotionRegion {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y + a.height, b.y + b.height);

    return {
      x,
      y,
      width: right - x,
      height: bottom - y,
      intensity: Math.max(a.intensity, b.intensity),
    };
  }

  /**
   * Adaptively update background model
   */
  updateBackground(frame: ImageData, learningRate: number = 0.01): void {
    if (!this.backgroundModel) return;

    this.framesSinceUpdate++;
    if (this.framesSinceUpdate < this.config.updateInterval) return;

    this.framesSinceUpdate = 0;

    // Slowly adapt background to lighting changes
    for (let i = 0; i < this.backgroundModel.length; i++) {
      this.backgroundModel[i] = Math.round(
        this.backgroundModel[i] * (1 - learningRate) +
          frame.data[i] * learningRate
      );
    }
  }

  /**
   * Reset calibration
   */
  reset(): void {
    this.isCalibrated = false;
    this.calibrationFrames = [];
    this.backgroundModel = null;
    this.framesSinceUpdate = 0;
  }

  /**
   * Set ROI for focused scanline detection
   */
  setROI(roi: GateROI): void {
    this.config.roi = roi;
  }

  /**
   * Get current ROI
   */
  getROI(): GateROI | undefined {
    return this.config.roi;
  }

  /**
   * Detect motion only within the ROI (vertical scanline)
   * This is much faster than full-frame detection
   *
   * @param frame - Full frame ImageData
   * @returns Motion result for the ROI only
   */
  detectMotionInROI(frame: ImageData): ROIMotionResult {
    const roi = this.config.roi;
    const timestamp = Date.now();

    // If no ROI configured, fall back to center strip
    const effectiveROI: GateROI = roi ?? {
      position: 0.5,
      width: 0.1,
      top: 0.1,
      bottom: 0.9,
    };

    // Calculate pixel bounds for the ROI
    const roiLeft = Math.floor((effectiveROI.position - effectiveROI.width / 2) * frame.width);
    const roiRight = Math.ceil((effectiveROI.position + effectiveROI.width / 2) * frame.width);
    const roiTop = Math.floor(effectiveROI.top * frame.height);
    const roiBottom = Math.ceil(effectiveROI.bottom * frame.height);

    // Clamp to frame bounds
    const left = Math.max(0, roiLeft);
    const right = Math.min(frame.width, roiRight);
    const top = Math.max(0, roiTop);
    const bottom = Math.min(frame.height, roiBottom);

    if (!this.isCalibrated || !this.backgroundModel) {
      // Not calibrated - assume motion present
      return {
        hasMotion: true,
        intensity: 1,
        timestamp,
      };
    }

    const threshold = this.calculateThreshold();
    let motionSum = 0;
    let pixelCount = 0;
    let minMotionX = right;
    let maxMotionX = left;
    let minMotionY = bottom;
    let maxMotionY = top;
    let hasSignificantMotion = false;

    // Only scan within the ROI - this is the key optimization
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const idx = (y * frame.width + x) * 4;

        // Calculate grayscale difference (fast luminance approximation)
        const frameLum =
          frame.data[idx] * 0.299 +
          frame.data[idx + 1] * 0.587 +
          frame.data[idx + 2] * 0.114;
        const bgLum =
          this.backgroundModel[idx] * 0.299 +
          this.backgroundModel[idx + 1] * 0.587 +
          this.backgroundModel[idx + 2] * 0.114;

        const diff = Math.abs(frameLum - bgLum);

        if (diff > threshold) {
          motionSum += diff;
          hasSignificantMotion = true;

          // Track motion bounds
          if (x < minMotionX) minMotionX = x;
          if (x > maxMotionX) maxMotionX = x;
          if (y < minMotionY) minMotionY = y;
          if (y > maxMotionY) maxMotionY = y;
        }
        pixelCount++;
      }
    }

    const intensity = pixelCount > 0 ? motionSum / (pixelCount * 255) : 0;
    const hasMotion = intensity > 0.02; // 2% threshold for "motion detected"

    const result: ROIMotionResult = {
      hasMotion,
      intensity,
      timestamp,
    };

    // Add motion bounds if motion was detected
    if (hasMotion && hasSignificantMotion) {
      result.motionBounds = {
        x: minMotionX / frame.width,
        y: minMotionY / frame.height,
        width: (maxMotionX - minMotionX) / frame.width,
        height: (maxMotionY - minMotionY) / frame.height,
      };
    }

    return result;
  }

  /**
   * Get ROI pixel bounds for a given frame size
   * Useful for drawing the ROI overlay
   */
  getROIBounds(frameWidth: number, frameHeight: number): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    const roi = this.config.roi;
    if (!roi) return null;

    return {
      x: Math.floor((roi.position - roi.width / 2) * frameWidth),
      y: Math.floor(roi.top * frameHeight),
      width: Math.ceil(roi.width * frameWidth),
      height: Math.ceil((roi.bottom - roi.top) * frameHeight),
    };
  }
}

// Singleton instance
let ghostGateInstance: GhostGate | null = null;

export function getGhostGate(config?: Partial<GhostGateConfig>): GhostGate {
  if (!ghostGateInstance) {
    ghostGateInstance = new GhostGate(config);
  } else if (config) {
    ghostGateInstance.updateConfig(config);
  }
  return ghostGateInstance;
}

export function resetGhostGate(): void {
  ghostGateInstance?.reset();
  ghostGateInstance = null;
}
