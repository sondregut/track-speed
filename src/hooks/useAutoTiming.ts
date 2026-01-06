import { useCallback, useRef, useEffect, useState } from 'react';
import { useSettingsStore, useTimingStore, useSessionStore } from '../stores';
import { usePoseDetection } from './usePoseDetection';
import { useHaptics } from './useHaptics';
import { useSound } from './useSound';
import { getTimingEngine, CrossingEvent, TimingFrame } from '../lib/timing';
import { TrackedPosition } from '../lib/pose';

interface AutoTimingState {
  isReady: boolean;
  isRunning: boolean;
  lastCrossing: CrossingEvent | null;
  gatePosition: number;
  detectionActive: boolean;
}

/**
 * Hook for automatic timing using pose detection
 * Detects when athlete's torso crosses the virtual gate line
 */
export function useAutoTiming(gatePosition: number = 0.7) {
  const { timing: timingSettings, ghostGate } = useSettingsStore();
  const { state: timerState, startTimer, stopTimer, elapsedTime } = useTimingStore();
  const { currentSession } = useSessionStore();
  const { trigger } = useHaptics();
  const { play } = useSound();

  const {
    isInitialized,
    currentPosition,
    confidence,
    fps,
    processFrame,
    reset: resetDetection,
  } = usePoseDetection();

  const timingEngineRef = useRef(getTimingEngine());
  const frameNumberRef = useRef(0);
  const detectionLoopRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<AutoTimingState>({
    isReady: false,
    isRunning: false,
    lastCrossing: null,
    gatePosition,
    detectionActive: false,
  });

  // Configure timing engine
  useEffect(() => {
    const engine = timingEngineRef.current;
    engine.updateConfig({
      gatePosition,
      subFrameInterpolation: timingSettings.subFrameInterpolation,
      confidenceThreshold: 50,
    });
  }, [gatePosition, timingSettings.subFrameInterpolation]);

  // Update ready state when pose detection initializes
  useEffect(() => {
    setState((s) => ({
      ...s,
      isReady: isInitialized && timingSettings.autoDetectionEnabled,
    }));
  }, [isInitialized, timingSettings.autoDetectionEnabled]);

  // Start detection loop
  const startDetection = useCallback(() => {
    if (!state.isReady || state.detectionActive) return;

    setState((s) => ({ ...s, detectionActive: true, isRunning: true }));
    frameNumberRef.current = 0;

    // Prepare timing engine
    const engine = timingEngineRef.current;
    engine.prepare();

    // Start detection loop (targets ~30 fps for pose detection)
    const loopInterval = 33; // ~30fps

    detectionLoopRef.current = setInterval(async () => {
      const position = await processFrame();

      if (position && timerState === 'running') {
        frameNumberRef.current++;

        // Create timing frame from tracked position
        const frame: TimingFrame = {
          timestamp: position.timestamp,
          frameNumber: frameNumberRef.current,
          torsoPosition: { x: position.x, y: position.y },
          confidence: position.confidence,
        };

        // Process frame for crossing detection
        const crossing = engine.processFrame(frame);

        if (crossing) {
          // Gate crossing detected!
          setState((s) => ({ ...s, lastCrossing: crossing }));

          // Trigger feedback
          trigger('success');
          play('stop');

          // Calculate elapsed time from crossing timestamp
          // Note: In production, use native monotonic timestamps for accuracy
          const crossingTimeMs = elapsedTime; // Use current elapsed time as approximation

          // Stop the timer with auto-detected result
          stopTimer({
            time_ms: crossingTimeMs,
            source: 'auto_detected',
            confidence: crossing.confidence,
            startMethod: timingSettings.defaultStartMethod,
            frameNumber: crossing.frameNumber,
            videoFrameRate: fps,
          });
        }
      }
    }, loopInterval);
  }, [state.isReady, state.detectionActive, processFrame, timerState, trigger, play, stopTimer, timingSettings.defaultStartMethod, fps, elapsedTime]);

  // Stop detection loop
  const stopDetection = useCallback(() => {
    if (detectionLoopRef.current) {
      clearInterval(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    setState((s) => ({ ...s, detectionActive: false, isRunning: false }));
    resetDetection();
  }, [resetDetection]);

  // Start timing with auto-detection
  const start = useCallback(() => {
    if (!state.isReady) {
      console.warn('Auto-timing not ready. Falling back to manual timing.');
      startTimer(timingSettings.defaultStartMethod);
      return;
    }

    // Start the timer
    startTimer(timingSettings.defaultStartMethod);

    // Prepare timing engine with start timestamp
    const engine = timingEngineRef.current;
    engine.start(performance.now()); // TODO: Use native monotonic timestamp

    // Start pose detection
    startDetection();

    trigger('medium');
    play('start');
  }, [state.isReady, startTimer, startDetection, trigger, play, timingSettings.defaultStartMethod]);

  // Manual stop (override auto-detection)
  const stop = useCallback(() => {
    stopDetection();

    if (timerState === 'running') {
      stopTimer({
        time_ms: elapsedTime,
        source: 'manual_override',
        confidence: null,
        startMethod: timingSettings.defaultStartMethod,
        frameNumber: frameNumberRef.current,
      });

      trigger('medium');
      play('stop');
    }
  }, [stopDetection, timerState, stopTimer, elapsedTime, trigger, play, timingSettings.defaultStartMethod]);

  // Reset timing
  const reset = useCallback(() => {
    stopDetection();
    const engine = timingEngineRef.current;
    engine.reset();
    setState((s) => ({ ...s, lastCrossing: null }));
  }, [stopDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectionLoopRef.current) {
        clearInterval(detectionLoopRef.current);
      }
    };
  }, []);

  return {
    ...state,
    currentPosition,
    confidence,
    fps,
    start,
    stop,
    reset,
    elapsedTime,
    timerState,
  };
}
