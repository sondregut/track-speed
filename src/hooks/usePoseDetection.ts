import { useCallback, useRef, useEffect, useState } from 'react';
import { useSettingsStore } from '../stores';
import { createPoseDetector, PoseDetector, DetectionResult, TorsoTracker, TrackedPosition } from '../lib/pose';

interface PoseDetectionState {
  isInitialized: boolean;
  isProcessing: boolean;
  currentPosition: TrackedPosition | null;
  confidence: number;
  fps: number;
}

/**
 * Hook for managing pose detection
 * Uses MockPoseDetector in Expo Go, native detectors in production builds
 */
export function usePoseDetection() {
  const autoDetectionEnabled = useSettingsStore((state) => state.timing.autoDetectionEnabled);

  const detectorRef = useRef<PoseDetector | null>(null);
  const trackerRef = useRef<TorsoTracker | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const processingRef = useRef(false);

  const [state, setState] = useState<PoseDetectionState>({
    isInitialized: false,
    isProcessing: false,
    currentPosition: null,
    confidence: 0,
    fps: 0,
  });

  // Initialize detector and tracker
  useEffect(() => {
    if (!autoDetectionEnabled) return;

    const init = async () => {
      try {
        detectorRef.current = createPoseDetector();
        await detectorRef.current.initialize();

        trackerRef.current = new TorsoTracker({
          smoothingFactor: 0.3,
          velocityDecay: 0.95,
          maxPredictionFrames: 3,
        });

        setState((s) => ({ ...s, isInitialized: true }));
      } catch (error) {
        console.error('Failed to initialize pose detector:', error);
      }
    };

    init();

    return () => {
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }
      trackerRef.current = null;
      setState((s) => ({ ...s, isInitialized: false }));
    };
  }, [autoDetectionEnabled]);

  // Process a camera frame
  const processFrame = useCallback(async (imageData?: any): Promise<TrackedPosition | null> => {
    if (!detectorRef.current || !trackerRef.current || processingRef.current) {
      return null;
    }

    processingRef.current = true;
    setState((s) => ({ ...s, isProcessing: true }));

    try {
      // Detect pose in frame
      const result = await detectorRef.current.detect(imageData);

      if (!result || !result.landmarks) {
        processingRef.current = false;
        setState((s) => ({ ...s, isProcessing: false }));
        return null;
      }

      // Track position
      const tracked = trackerRef.current.update(result.landmarks, result.timestamp);

      // Update FPS counter
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsUpdateRef.current >= 1000) {
        setState((s) => ({
          ...s,
          fps: frameCountRef.current,
          currentPosition: tracked,
          confidence: result.confidence,
          isProcessing: false,
        }));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      } else {
        setState((s) => ({
          ...s,
          currentPosition: tracked,
          confidence: result.confidence,
          isProcessing: false,
        }));
      }

      processingRef.current = false;
      return tracked;
    } catch (error) {
      console.error('Pose detection error:', error);
      processingRef.current = false;
      setState((s) => ({ ...s, isProcessing: false }));
      return null;
    }
  }, []);

  // Get current tracked position
  const getCurrentPosition = useCallback((): TrackedPosition | null => {
    return state.currentPosition;
  }, [state.currentPosition]);

  // Predict position at future timestamp
  const predictPosition = useCallback((timestamp: number): TrackedPosition | null => {
    if (!trackerRef.current) return null;
    return trackerRef.current.predict(timestamp);
  }, []);

  // Reset tracker state
  const reset = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.reset();
    }
    setState((s) => ({
      ...s,
      currentPosition: null,
      confidence: 0,
    }));
  }, []);

  return {
    ...state,
    processFrame,
    getCurrentPosition,
    predictPosition,
    reset,
  };
}
