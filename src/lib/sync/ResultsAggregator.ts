/**
 * ResultsAggregator - Aggregates timing data from multiple gates
 *
 * Collects timing events from start, finish, and split gates and
 * combines them into a unified TimingResult with calculated velocities.
 *
 * Features:
 * - Collects events from multiple gates
 * - Calculates split times and segment velocities
 * - Handles out-of-order event arrival
 * - Validates timing data consistency
 * - Generates comprehensive timing results
 */

import type { TimingEvent as BluetoothTimingEvent, DeviceRole as BluetoothDeviceRole } from './BluetoothSync';
import type { TimingResult, SplitTime, StartMethod, GateConfig } from '../../types';

// Gate event with metadata
export interface GateEvent {
  gateId: string;
  role: BluetoothDeviceRole;
  distance_m: number;
  timestamp: number;      // Synchronized timestamp
  localTime_ms: number;   // Local elapsed time at gate
  confidence?: number;
  frameNumber?: number;
  receivedAt: number;     // When we received this event
}

// Run being assembled from multiple gate events
export interface RunInProgress {
  runId: string;
  startedAt: number;
  athleteId?: string;
  events: GateEvent[];
  isComplete: boolean;
  result?: TimingResult;
}

// Aggregator configuration
export interface ResultsAggregatorConfig {
  /** Gates in this session, in order by distance */
  gates: GateConfig[];
  /** Session ID for results */
  sessionId: string;
  /** Start method used */
  startMethod: StartMethod;
  /** Total distance being timed */
  totalDistance_m: number;
  /** Timeout for incomplete runs (ms) */
  runTimeout_ms?: number;
  /** Callback when a run is complete */
  onRunComplete?: (result: TimingResult) => void;
}

/**
 * ResultsAggregator class
 */
export class ResultsAggregator {
  private config: ResultsAggregatorConfig;
  private currentRun: RunInProgress | null = null;
  private completedRuns: TimingResult[] = [];
  private runCounter = 0;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ResultsAggregatorConfig) {
    this.config = {
      ...config,
      runTimeout_ms: config.runTimeout_ms ?? 60000, // Default 1 minute timeout
    };
  }

  /**
   * Process a timing event from any gate
   */
  processEvent(event: BluetoothTimingEvent, gateId: string, gateRole: BluetoothDeviceRole, distance_m: number): void {
    console.log('[ResultsAggregator] Processing event:', {
      type: event.type,
      gateRole,
      distance_m,
      data: event.data,
    });

    switch (event.type) {
      case 'start':
        this.handleStart(event, gateId, distance_m);
        break;
      case 'stop':
        this.handleStop(event, gateId, gateRole, distance_m);
        break;
      case 'split':
        this.handleSplit(event, gateId, distance_m);
        break;
      case 'reset':
        this.handleReset();
        break;
    }
  }

  /**
   * Handle start event (from start gate)
   */
  private handleStart(event: BluetoothTimingEvent, gateId: string, distance_m: number): void {
    // Clear any existing incomplete run
    if (this.currentRun && !this.currentRun.isComplete) {
      console.warn('[ResultsAggregator] Abandoning incomplete run');
    }

    // Start new run
    this.runCounter++;
    this.currentRun = {
      runId: `run_${Date.now()}_${this.runCounter}`,
      startedAt: event.timestamp,
      events: [{
        gateId,
        role: 'start',
        distance_m,
        timestamp: event.timestamp,
        localTime_ms: 0, // Start is always 0
        receivedAt: Date.now(),
      }],
      isComplete: false,
    };

    // Start timeout timer
    this.startTimeoutTimer();

    console.log('[ResultsAggregator] Started new run:', this.currentRun.runId);
  }

  /**
   * Handle stop event (from finish gate)
   */
  private handleStop(event: BluetoothTimingEvent, gateId: string, gateRole: BluetoothDeviceRole, distance_m: number): void {
    if (!this.currentRun) {
      console.warn('[ResultsAggregator] Received stop without active run');
      return;
    }

    const finishTime_ms = event.data?.time_ms ?? 0;
    const confidence = event.data?.confidence;
    const frameNumber = event.data?.frameNumber;

    // Add finish event
    this.currentRun.events.push({
      gateId,
      role: gateRole,
      distance_m,
      timestamp: event.timestamp,
      localTime_ms: finishTime_ms,
      confidence,
      frameNumber,
      receivedAt: Date.now(),
    });

    // If this is the finish gate, complete the run
    if (gateRole === 'finish') {
      this.completeRun(finishTime_ms, confidence, frameNumber);
    }
  }

  /**
   * Handle split event (from lap/split gates)
   */
  private handleSplit(event: BluetoothTimingEvent, gateId: string, distance_m: number): void {
    if (!this.currentRun) {
      console.warn('[ResultsAggregator] Received split without active run');
      return;
    }

    const splitTime_ms = event.data?.time_ms ?? 0;

    // Add split event
    this.currentRun.events.push({
      gateId,
      role: 'lap',
      distance_m,
      timestamp: event.timestamp,
      localTime_ms: splitTime_ms,
      receivedAt: Date.now(),
    });

    console.log('[ResultsAggregator] Recorded split at', distance_m, 'm:', splitTime_ms, 'ms');
  }

  /**
   * Handle reset event
   */
  private handleReset(): void {
    this.clearTimeoutTimer();
    this.currentRun = null;
    console.log('[ResultsAggregator] Run reset');
  }

  /**
   * Complete the current run and generate result
   */
  private completeRun(finishTime_ms: number, confidence?: number, frameNumber?: number): void {
    if (!this.currentRun) return;

    this.clearTimeoutTimer();

    // Sort events by distance
    const sortedEvents = [...this.currentRun.events].sort((a, b) => a.distance_m - b.distance_m);

    // Generate splits from events
    const splits: SplitTime[] = [];
    let prevDistance = 0;
    let prevTime = 0;

    for (const evt of sortedEvents) {
      if (evt.role === 'start') continue; // Skip start gate

      // Calculate segment velocity
      const segmentDistance = evt.distance_m - prevDistance;
      const segmentTime = evt.localTime_ms - prevTime;
      const velocity_ms = segmentTime > 0 ? (segmentDistance / segmentTime) * 1000 : undefined;

      splits.push({
        distance_m: evt.distance_m,
        time_ms: evt.localTime_ms,
        velocity_ms,
      });

      prevDistance = evt.distance_m;
      prevTime = evt.localTime_ms;
    }

    // Calculate overall velocity
    const overallVelocity_ms = finishTime_ms > 0
      ? (this.config.totalDistance_m / finishTime_ms) * 1000
      : undefined;

    // Build result
    const result: TimingResult = {
      id: this.currentRun.runId,
      sessionId: this.config.sessionId,
      athleteId: this.currentRun.athleteId,
      time_ms: finishTime_ms,
      source: confidence !== undefined ? 'auto_detected' : 'manual_only',
      confidence: confidence ?? null,
      startMethod: this.config.startMethod,
      frameNumber: frameNumber ?? 0,
      velocity_ms: overallVelocity_ms,
      distance_m: this.config.totalDistance_m,
      splits: splits.length > 0 ? splits : undefined,
      createdAt: new Date(),
    };

    this.currentRun.result = result;
    this.currentRun.isComplete = true;

    // Store completed run
    this.completedRuns.push(result);

    // Notify listener
    this.config.onRunComplete?.(result);

    console.log('[ResultsAggregator] Run complete:', {
      time: finishTime_ms,
      splits: splits.length,
      velocity: overallVelocity_ms,
    });

    // Clear current run
    this.currentRun = null;
  }

  /**
   * Start timeout timer for incomplete runs
   */
  private startTimeoutTimer(): void {
    this.clearTimeoutTimer();

    this.timeoutTimer = setTimeout(() => {
      if (this.currentRun && !this.currentRun.isComplete) {
        console.warn('[ResultsAggregator] Run timed out');
        this.currentRun = null;
      }
    }, this.config.runTimeout_ms);
  }

  /**
   * Clear timeout timer
   */
  private clearTimeoutTimer(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * Get current run status
   */
  getCurrentRun(): RunInProgress | null {
    return this.currentRun;
  }

  /**
   * Get all completed runs
   */
  getCompletedRuns(): TimingResult[] {
    return [...this.completedRuns];
  }

  /**
   * Get the most recent result
   */
  getLastResult(): TimingResult | null {
    return this.completedRuns.length > 0
      ? this.completedRuns[this.completedRuns.length - 1]
      : null;
  }

  /**
   * Check if a run is in progress
   */
  isRunInProgress(): boolean {
    return this.currentRun !== null && !this.currentRun.isComplete;
  }

  /**
   * Set the athlete for the current run
   */
  setAthlete(athleteId: string): void {
    if (this.currentRun) {
      this.currentRun.athleteId = athleteId;
    }
  }

  /**
   * Get statistics for all runs
   */
  getStatistics(): {
    totalRuns: number;
    averageTime_ms: number;
    bestTime_ms: number;
    averageSplits: SplitTime[];
  } | null {
    if (this.completedRuns.length === 0) return null;

    const times = this.completedRuns.map(r => r.time_ms);
    const totalRuns = times.length;
    const averageTime_ms = times.reduce((a, b) => a + b, 0) / totalRuns;
    const bestTime_ms = Math.min(...times);

    // Calculate average splits
    const splitsByDistance: Map<number, number[]> = new Map();
    for (const run of this.completedRuns) {
      if (run.splits) {
        for (const split of run.splits) {
          const existing = splitsByDistance.get(split.distance_m) ?? [];
          existing.push(split.time_ms);
          splitsByDistance.set(split.distance_m, existing);
        }
      }
    }

    const averageSplits: SplitTime[] = [];
    for (const [distance, times] of splitsByDistance.entries()) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      averageSplits.push({
        distance_m: distance,
        time_ms: avgTime,
      });
    }
    averageSplits.sort((a, b) => a.distance_m - b.distance_m);

    return {
      totalRuns,
      averageTime_ms,
      bestTime_ms,
      averageSplits,
    };
  }

  /**
   * Reset all runs
   */
  reset(): void {
    this.clearTimeoutTimer();
    this.currentRun = null;
    this.completedRuns = [];
    this.runCounter = 0;
    console.log('[ResultsAggregator] All runs reset');
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.clearTimeoutTimer();
  }
}

// Factory function
let aggregatorInstance: ResultsAggregator | null = null;

export function createResultsAggregator(config: ResultsAggregatorConfig): ResultsAggregator {
  aggregatorInstance?.cleanup();
  aggregatorInstance = new ResultsAggregator(config);
  return aggregatorInstance;
}

export function getResultsAggregator(): ResultsAggregator | null {
  return aggregatorInstance;
}
