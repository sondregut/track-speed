/**
 * Velocity calculation and conversion utilities for Track Speed
 *
 * Core formulas:
 * - Velocity (m/s) = distance (m) / time (s)
 * - km/h = m/s × 3.6
 * - mph = m/s × 2.237
 */

import { VelocityUnit, SplitTime } from '../types';

// ============================================
// Conversion Constants
// ============================================

const MS_TO_KMH = 3.6;
const MS_TO_MPH = 2.23694;
const METERS_TO_YARDS = 1.09361;
const METERS_TO_FEET = 3.28084;

// ============================================
// Core Velocity Calculations
// ============================================

/**
 * Calculate velocity in m/s from distance and time
 * @param distance_m Distance in meters
 * @param time_ms Time in milliseconds
 * @returns Velocity in meters per second
 */
export function calculateVelocity(distance_m: number, time_ms: number): number {
  if (time_ms <= 0 || distance_m <= 0) return 0;
  const time_s = time_ms / 1000;
  return distance_m / time_s;
}

/**
 * Calculate velocity for a flying sprint (max velocity test)
 * Flying sprints measure velocity at max speed, not average
 * @param flyingDistance_m The timed zone distance (10, 20, 30m)
 * @param time_ms Time to cover the flying distance
 * @returns Max velocity in m/s
 */
export function calculateFlyingVelocity(
  flyingDistance_m: number,
  time_ms: number
): number {
  return calculateVelocity(flyingDistance_m, time_ms);
}

/**
 * Calculate split velocities from split times
 * @param splits Array of split times
 * @returns Splits with velocity_ms populated
 */
export function calculateSplitVelocities(splits: SplitTime[]): SplitTime[] {
  if (splits.length === 0) return [];

  const result: SplitTime[] = [];
  let prevDistance = 0;
  let prevTime = 0;

  for (const split of splits) {
    const segmentDistance = split.distance_m - prevDistance;
    const segmentTime = split.time_ms - prevTime;
    const velocity = calculateVelocity(segmentDistance, segmentTime);

    result.push({
      ...split,
      velocity_ms: velocity,
    });

    prevDistance = split.distance_m;
    prevTime = split.time_ms;
  }

  return result;
}

// ============================================
// Unit Conversions
// ============================================

/**
 * Convert velocity from m/s to specified unit
 * @param velocity_ms Velocity in meters per second
 * @param unit Target unit
 * @returns Converted velocity value
 */
export function convertVelocity(velocity_ms: number, unit: VelocityUnit): number {
  switch (unit) {
    case 'm/s':
      return velocity_ms;
    case 'km/h':
      return velocity_ms * MS_TO_KMH;
    case 'mph':
      return velocity_ms * MS_TO_MPH;
    default:
      return velocity_ms;
  }
}

/**
 * Convert distance from meters to specified unit
 * @param meters Distance in meters
 * @param imperial If true, convert to yards
 * @returns Distance in target unit
 */
export function convertDistance(meters: number, imperial: boolean): number {
  return imperial ? meters * METERS_TO_YARDS : meters;
}

// ============================================
// Formatting
// ============================================

/**
 * Format velocity with unit label
 * @param velocity_ms Velocity in m/s
 * @param unit Display unit
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted string like "10.52 m/s"
 */
export function formatVelocity(
  velocity_ms: number,
  unit: VelocityUnit,
  decimals: number = 2
): string {
  const converted = convertVelocity(velocity_ms, unit);
  return `${converted.toFixed(decimals)} ${unit}`;
}

/**
 * Format velocity value only (no unit)
 * @param velocity_ms Velocity in m/s
 * @param unit Display unit
 * @param decimals Number of decimal places
 * @returns Formatted number string
 */
export function formatVelocityValue(
  velocity_ms: number,
  unit: VelocityUnit,
  decimals: number = 2
): string {
  const converted = convertVelocity(velocity_ms, unit);
  return converted.toFixed(decimals);
}

/**
 * Format distance with unit label
 * @param meters Distance in meters
 * @param imperial Use imperial units
 * @returns Formatted string like "100m" or "109yd"
 */
export function formatDistance(meters: number, imperial: boolean = false): string {
  if (imperial) {
    const yards = meters * METERS_TO_YARDS;
    return `${Math.round(yards)}yd`;
  }
  return `${meters}m`;
}

// ============================================
// Velocity Analysis
// ============================================

/**
 * Get velocity rating based on typical sprint performances
 * @param velocity_ms Velocity in m/s
 * @returns Rating category
 */
export function getVelocityRating(
  velocity_ms: number
): 'elite' | 'advanced' | 'intermediate' | 'beginner' {
  // Based on typical 10m fly times:
  // Elite: > 11 m/s (sub 0.91s for 10m)
  // Advanced: 9.5-11 m/s
  // Intermediate: 8-9.5 m/s
  // Beginner: < 8 m/s
  if (velocity_ms >= 11) return 'elite';
  if (velocity_ms >= 9.5) return 'advanced';
  if (velocity_ms >= 8) return 'intermediate';
  return 'beginner';
}

/**
 * Calculate projected time for a different distance at same velocity
 * @param velocity_ms Current velocity
 * @param targetDistance_m Target distance
 * @returns Projected time in ms
 */
export function projectTime(velocity_ms: number, targetDistance_m: number): number {
  if (velocity_ms <= 0) return 0;
  return (targetDistance_m / velocity_ms) * 1000;
}

/**
 * Find max velocity from an array of results
 * @param velocities Array of velocity values in m/s
 * @returns Max velocity or 0 if empty
 */
export function findMaxVelocity(velocities: number[]): number {
  if (velocities.length === 0) return 0;
  return Math.max(...velocities);
}

/**
 * Calculate average velocity from results
 * @param velocities Array of velocity values in m/s
 * @returns Average velocity or 0 if empty
 */
export function calculateAverageVelocity(velocities: number[]): number {
  if (velocities.length === 0) return 0;
  const sum = velocities.reduce((a, b) => a + b, 0);
  return sum / velocities.length;
}

// ============================================
// Conversion Tables (for reference displays)
// ============================================

/**
 * Generate a velocity conversion table for common 10m fly times
 * @returns Array of {time_s, m/s, km/h, mph} objects
 */
export function getVelocityConversionTable(): Array<{
  time_s: number;
  ms: number;
  kmh: number;
  mph: number;
}> {
  const times = [0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3];
  const distance = 10; // 10m fly standard

  return times.map((time_s) => {
    const ms = distance / time_s;
    return {
      time_s,
      ms: Math.round(ms * 100) / 100,
      kmh: Math.round(ms * MS_TO_KMH * 100) / 100,
      mph: Math.round(ms * MS_TO_MPH * 100) / 100,
    };
  });
}
