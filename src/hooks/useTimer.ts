import { useEffect, useRef, useCallback } from 'react';
import { useTimingStore } from '../stores';

/**
 * Hook for managing the timer display and updates
 * Uses requestAnimationFrame for smooth UI updates
 *
 * Note: This is for UI display only. Actual timing precision
 * comes from native modules using monotonic clocks.
 */
export function useTimer() {
  const {
    state,
    startTime,
    elapsedTime,
    updateElapsedTime,
    setState,
    startTimer,
    stopTimer,
    resetTimer,
  } = useTimingStore();

  const animationRef = useRef<number | null>(null);

  // Update elapsed time on each frame
  const updateTimer = useCallback(() => {
    if (startTime !== null) {
      const now = performance.now();
      updateElapsedTime(now - startTime);
      animationRef.current = requestAnimationFrame(updateTimer);
    }
  }, [startTime, updateElapsedTime]);

  // Start animation loop when timer is running
  useEffect(() => {
    if (state === 'running') {
      animationRef.current = requestAnimationFrame(updateTimer);
    }

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, updateTimer]);

  return {
    state,
    elapsedTime,
    isRunning: state === 'running',
    isStopped: state === 'stopped',
    isIdle: state === 'idle',
    isReady: state === 'ready',
    setState,
    start: startTimer,
    stop: stopTimer,
    reset: resetTimer,
  };
}
