/**
 * Timing Utilities
 *
 * IMPORTANT: For actual timing precision, use native modules:
 * - iOS: mach_continuous_time() for nanosecond precision
 * - Android: SystemClock.elapsedRealtimeNanos() for monotonic timestamps
 *
 * These JS utilities are for display formatting and calculations only.
 * Never use Date.now() for timing - it's not monotonic!
 */

/**
 * Format milliseconds to display string (e.g., "10.45" or "1:23.456")
 */
export function formatTime(ms: number, options: {
  showMinutes?: boolean;
  decimals?: 0 | 2 | 3;
} = {}): string {
  const { showMinutes = false, decimals = 2 } = options;

  if (ms < 0) return '0.00';

  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (showMinutes && minutes > 0) {
    const paddedSeconds = seconds.toFixed(decimals).padStart(decimals + 3, '0');
    return `${minutes}:${paddedSeconds}`;
  }

  return seconds.toFixed(decimals);
}

/**
 * Format milliseconds to compact display (e.g., "10.45s")
 */
export function formatTimeCompact(ms: number): string {
  return `${formatTime(ms)}s`;
}

/**
 * Parse a time string back to milliseconds
 */
export function parseTime(timeStr: string): number {
  const parts = timeStr.split(':');

  if (parts.length === 2) {
    // Format: "M:SS.mmm"
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return (minutes * 60 + seconds) * 1000;
  }

  // Format: "SS.mmm"
  return parseFloat(timeStr) * 1000;
}

/**
 * Calculate velocity in m/s given distance and time
 */
export function calculateVelocity(distanceMeters: number, timeMs: number): number {
  if (timeMs <= 0) return 0;
  return distanceMeters / (timeMs / 1000);
}

/**
 * Calculate pace in seconds per 100m
 */
export function calculatePace(distanceMeters: number, timeMs: number): number {
  if (distanceMeters <= 0) return 0;
  return (timeMs / 1000) * (100 / distanceMeters);
}

/**
 * Format velocity to display string
 */
export function formatVelocity(metersPerSecond: number): string {
  return `${metersPerSecond.toFixed(2)} m/s`;
}

/**
 * Format pace to display string
 */
export function formatPace(secondsPer100m: number): string {
  return `${secondsPer100m.toFixed(2)}s/100m`;
}

/**
 * Sub-frame interpolation for more precise timing
 * Uses landmark positions from consecutive frames to estimate exact crossing time
 */
export function interpolateCrossingTime(
  prevFrame: { timestamp: number; position: number },
  currFrame: { timestamp: number; position: number },
  gatePosition: number
): number {
  const positionDelta = currFrame.position - prevFrame.position;

  if (Math.abs(positionDelta) < 0.001) {
    // No movement, return current timestamp
    return currFrame.timestamp;
  }

  // Linear interpolation to find exact crossing time
  const ratio = (gatePosition - prevFrame.position) / positionDelta;
  const timeDelta = currFrame.timestamp - prevFrame.timestamp;

  return prevFrame.timestamp + (ratio * timeDelta);
}

/**
 * Calculate confidence score based on detection quality
 */
export function calculateConfidence(
  landmarkConfidences: number[],
  motionBlur: number,
  lightingQuality: number
): number {
  // Average landmark confidence
  const avgLandmarkConf = landmarkConfidences.reduce((a, b) => a + b, 0) / landmarkConfidences.length;

  // Weight factors
  const landmarkWeight = 0.5;
  const blurWeight = 0.25;
  const lightingWeight = 0.25;

  // Combine scores (motionBlur is inverted - lower is better)
  const confidence =
    (avgLandmarkConf * landmarkWeight) +
    ((1 - motionBlur) * blurWeight) +
    (lightingQuality * lightingWeight);

  return Math.max(0, Math.min(1, confidence)) * 100;
}

/**
 * Get timing precision based on frame rate
 */
export function getTimingPrecision(frameRate: number): number {
  // Base precision is inter-frame interval
  const baseMs = 1000 / frameRate;

  // Sub-frame interpolation can improve by ~4x
  return baseMs / 4;
}

/**
 * Check if two times are within precision threshold
 */
export function timesMatch(time1: number, time2: number, precisionMs: number = 10): boolean {
  return Math.abs(time1 - time2) <= precisionMs;
}
