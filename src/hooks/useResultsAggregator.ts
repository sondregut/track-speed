/**
 * useResultsAggregator - React hook for multi-gate results aggregation
 *
 * Provides easy integration of ResultsAggregator with React components.
 * Automatically processes timing events from useBluetoothSync.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ResultsAggregator,
  createResultsAggregator,
  type ResultsAggregatorConfig,
  type RunInProgress,
  type BluetoothTimingEvent,
  type BluetoothDeviceRole,
} from '../lib/sync';
import type { TimingResult, GateConfig, StartMethod, SplitTime } from '../types';

interface UseResultsAggregatorOptions {
  /** Gates in this session */
  gates: GateConfig[];
  /** Session ID */
  sessionId: string;
  /** Start method used */
  startMethod: StartMethod;
  /** Total distance being timed */
  totalDistance_m: number;
  /** Timeout for incomplete runs (ms) */
  runTimeout_ms?: number;
  /** Enable aggregation */
  enabled?: boolean;
}

interface UseResultsAggregatorReturn {
  // State
  isRunInProgress: boolean;
  currentRun: RunInProgress | null;
  lastResult: TimingResult | null;
  completedRuns: TimingResult[];

  // Actions
  processEvent: (
    event: BluetoothTimingEvent,
    gateId: string,
    gateRole: BluetoothDeviceRole,
    distance_m: number
  ) => void;
  setAthlete: (athleteId: string) => void;
  reset: () => void;

  // Statistics
  statistics: {
    totalRuns: number;
    averageTime_ms: number;
    bestTime_ms: number;
    averageSplits: SplitTime[];
  } | null;
}

export function useResultsAggregator(
  options: UseResultsAggregatorOptions
): UseResultsAggregatorReturn {
  const {
    gates,
    sessionId,
    startMethod,
    totalDistance_m,
    runTimeout_ms = 60000,
    enabled = true,
  } = options;

  // State
  const [isRunInProgress, setIsRunInProgress] = useState(false);
  const [currentRun, setCurrentRun] = useState<RunInProgress | null>(null);
  const [lastResult, setLastResult] = useState<TimingResult | null>(null);
  const [completedRuns, setCompletedRuns] = useState<TimingResult[]>([]);
  const [statistics, setStatistics] = useState<UseResultsAggregatorReturn['statistics']>(null);

  // Ref to aggregator
  const aggregatorRef = useRef<ResultsAggregator | null>(null);

  // Handle run completion
  const handleRunComplete = useCallback((result: TimingResult) => {
    setLastResult(result);
    setCompletedRuns(prev => [...prev, result]);
    setIsRunInProgress(false);
    setCurrentRun(null);
  }, []);

  // Initialize aggregator
  useEffect(() => {
    if (!enabled) {
      aggregatorRef.current?.cleanup();
      aggregatorRef.current = null;
      return;
    }

    const config: ResultsAggregatorConfig = {
      gates,
      sessionId,
      startMethod,
      totalDistance_m,
      runTimeout_ms,
      onRunComplete: handleRunComplete,
    };

    aggregatorRef.current = createResultsAggregator(config);

    return () => {
      aggregatorRef.current?.cleanup();
      aggregatorRef.current = null;
    };
  }, [enabled, sessionId, startMethod, totalDistance_m, runTimeout_ms, handleRunComplete]);

  // Update gates when they change (without recreating aggregator)
  useEffect(() => {
    // Gates are used per-event, so this is just for reference updates
  }, [gates]);

  // Process event
  const processEvent = useCallback((
    event: BluetoothTimingEvent,
    gateId: string,
    gateRole: BluetoothDeviceRole,
    distance_m: number
  ) => {
    if (!aggregatorRef.current) return;

    aggregatorRef.current.processEvent(event, gateId, gateRole, distance_m);

    // Update state
    setIsRunInProgress(aggregatorRef.current.isRunInProgress());
    setCurrentRun(aggregatorRef.current.getCurrentRun());
    setStatistics(aggregatorRef.current.getStatistics());
  }, []);

  // Set athlete for current run
  const setAthlete = useCallback((athleteId: string) => {
    aggregatorRef.current?.setAthlete(athleteId);
  }, []);

  // Reset all runs
  const reset = useCallback(() => {
    aggregatorRef.current?.reset();
    setIsRunInProgress(false);
    setCurrentRun(null);
    setLastResult(null);
    setCompletedRuns([]);
    setStatistics(null);
  }, []);

  return {
    isRunInProgress,
    currentRun,
    lastResult,
    completedRuns,
    processEvent,
    setAthlete,
    reset,
    statistics,
  };
}
