/**
 * useSeries - Hook for managing series/interval training sessions
 *
 * Handles:
 * - Set and rep tracking
 * - Rest countdown timers
 * - Auto-advance between reps
 * - Series summary statistics
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  SeriesConfig,
  SeriesState,
  SeriesRepResult,
  SeriesSummary,
} from '../types';

interface UseSeriesOptions {
  config: SeriesConfig;
  onRepComplete?: (result: SeriesRepResult) => void;
  onSetComplete?: (setNumber: number) => void;
  onSeriesComplete?: (summary: SeriesSummary) => void;
  onRestComplete?: () => void;
}

interface UseSeriesReturn {
  // State
  state: SeriesState;
  isActive: boolean;
  isPaused: boolean;

  // Current position
  currentSet: number;
  currentRep: number;
  totalReps: number;
  completedReps: number;

  // Rest
  isResting: boolean;
  restRemaining: number;
  restTotal: number;

  // Actions
  start: () => void;
  recordRep: (time_ms: number, velocity_ms?: number) => void;
  skipRest: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;

  // Summary
  results: SeriesRepResult[];
  summary: SeriesSummary | null;
}

export function useSeries(options: UseSeriesOptions): UseSeriesReturn {
  const { config, onRepComplete, onSetComplete, onSeriesComplete, onRestComplete } = options;

  const totalReps = config.sets * config.repsPerSet;

  // State
  const [state, setState] = useState<SeriesState>({
    currentSet: 1,
    currentRep: 1,
    isResting: false,
    restRemaining: 0,
    results: [],
    isComplete: false,
  });

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Refs for timer
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Computed values
  const completedReps = state.results.length;

  const restTotal = useMemo(() => {
    // Determine if this is between-set rest or between-rep rest
    if (state.currentRep === 1 && state.currentSet > 1) {
      return config.restBetweenSets;
    }
    return config.restBetweenReps;
  }, [state.currentRep, state.currentSet, config.restBetweenSets, config.restBetweenReps]);

  // Calculate summary
  const summary = useMemo((): SeriesSummary | null => {
    if (state.results.length === 0) return null;

    const times = state.results.map(r => r.time_ms);
    const velocities = state.results.filter(r => r.velocity_ms).map(r => r.velocity_ms!);

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const bestTime = Math.min(...times);
    const worstTime = Math.max(...times);

    // Calculate consistency (coefficient of variation)
    const variance = times.reduce((acc, t) => acc + Math.pow(t - avgTime, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const consistency = 100 - (stdDev / avgTime) * 100; // Higher is more consistent

    return {
      totalReps,
      completedReps: state.results.length,
      averageTime_ms: avgTime,
      bestTime_ms: bestTime,
      worstTime_ms: worstTime,
      averageVelocity_ms: velocities.length > 0
        ? velocities.reduce((a, b) => a + b, 0) / velocities.length
        : undefined,
      consistency: Math.max(0, Math.min(100, consistency)),
    };
  }, [state.results, totalReps]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, []);

  // Start rest countdown
  const startRestCountdown = useCallback((seconds: number) => {
    setState(prev => ({
      ...prev,
      isResting: true,
      restRemaining: seconds,
    }));

    // Clear any existing timer
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
    }

    restTimerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.restRemaining <= 1) {
          // Rest complete
          if (restTimerRef.current) {
            clearInterval(restTimerRef.current);
            restTimerRef.current = null;
          }

          onRestComplete?.();

          return {
            ...prev,
            isResting: false,
            restRemaining: 0,
          };
        }

        return {
          ...prev,
          restRemaining: prev.restRemaining - 1,
        };
      });
    }, 1000);
  }, [onRestComplete]);

  // Start series
  const start = useCallback(() => {
    setIsActive(true);
    setIsPaused(false);
    setState({
      currentSet: 1,
      currentRep: 1,
      isResting: false,
      restRemaining: 0,
      results: [],
      isComplete: false,
    });
  }, []);

  // Record a completed rep
  const recordRep = useCallback((time_ms: number, velocity_ms?: number) => {
    if (!isActive || state.isComplete) return;

    // Compare to target if set
    let comparedToTarget: 'faster' | 'slower' | 'on_target' | undefined;
    if (config.targetTime_ms) {
      const tolerance = config.targetTime_ms * 0.02; // 2% tolerance
      if (time_ms < config.targetTime_ms - tolerance) {
        comparedToTarget = 'faster';
      } else if (time_ms > config.targetTime_ms + tolerance) {
        comparedToTarget = 'slower';
      } else {
        comparedToTarget = 'on_target';
      }
    }

    const result: SeriesRepResult = {
      setNumber: state.currentSet,
      repNumber: state.currentRep,
      time_ms,
      velocity_ms,
      comparedToTarget,
    };

    onRepComplete?.(result);

    setState(prev => {
      const newResults = [...prev.results, result];
      const isLastRep = prev.currentRep >= config.repsPerSet;
      const isLastSet = prev.currentSet >= config.sets;
      const isSeriesComplete = isLastRep && isLastSet;

      if (isSeriesComplete) {
        // Series complete!
        return {
          ...prev,
          results: newResults,
          isComplete: true,
          isResting: false,
        };
      }

      // Advance to next rep or set
      let nextSet = prev.currentSet;
      let nextRep = prev.currentRep + 1;
      let restDuration = config.restBetweenReps;

      if (isLastRep) {
        // End of set - move to next set
        nextSet = prev.currentSet + 1;
        nextRep = 1;
        restDuration = config.restBetweenSets;
        onSetComplete?.(prev.currentSet);
      }

      return {
        ...prev,
        results: newResults,
        currentSet: nextSet,
        currentRep: nextRep,
        isResting: true,
        restRemaining: restDuration,
      };
    });

    // Start rest countdown (check if series just completed)
    const isLastRep = state.currentRep >= config.repsPerSet;
    const isLastSet = state.currentSet >= config.sets;
    if (!(isLastRep && isLastSet)) {
      const restDuration = isLastRep ? config.restBetweenSets : config.restBetweenReps;
      startRestCountdown(restDuration);
    } else {
      // Series complete - trigger callback
      setTimeout(() => {
        if (summary) {
          onSeriesComplete?.(summary);
        }
      }, 100);
    }
  }, [
    isActive,
    state,
    config,
    onRepComplete,
    onSetComplete,
    onSeriesComplete,
    startRestCountdown,
    summary,
  ]);

  // Skip rest period
  const skipRest = useCallback(() => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isResting: false,
      restRemaining: 0,
    }));

    onRestComplete?.();
  }, [onRestComplete]);

  // Pause series (pauses rest timer)
  const pause = useCallback(() => {
    setIsPaused(true);
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
  }, []);

  // Resume series
  const resume = useCallback(() => {
    setIsPaused(false);
    if (state.isResting && state.restRemaining > 0) {
      startRestCountdown(state.restRemaining);
    }
  }, [state.isResting, state.restRemaining, startRestCountdown]);

  // Reset series
  const reset = useCallback(() => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    setIsActive(false);
    setIsPaused(false);
    setState({
      currentSet: 1,
      currentRep: 1,
      isResting: false,
      restRemaining: 0,
      results: [],
      isComplete: false,
    });
  }, []);

  return {
    // State
    state,
    isActive,
    isPaused,

    // Current position
    currentSet: state.currentSet,
    currentRep: state.currentRep,
    totalReps,
    completedReps,

    // Rest
    isResting: state.isResting,
    restRemaining: state.restRemaining,
    restTotal,

    // Actions
    start,
    recordRep,
    skipRest,
    pause,
    resume,
    reset,

    // Summary
    results: state.results,
    summary,
  };
}

export default useSeries;
