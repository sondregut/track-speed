/**
 * useSoundDetection - Detects loud sounds (claps, starting gun) to trigger timer
 *
 * Uses expo-audio to monitor microphone levels and detect sudden spikes
 * that indicate a clap or starting pistol sound.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
} from 'expo-audio';

interface UseSoundDetectionOptions {
  /** Threshold for sound detection (0-1, default 0.7) */
  threshold?: number;
  /** Minimum time between detections in ms (default 500) */
  debounceMs?: number;
  /** Auto-start listening when enabled */
  autoStart?: boolean;
}

interface UseSoundDetectionReturn {
  /** Whether sound detection is currently listening */
  isListening: boolean;
  /** Current audio level (0-1) */
  audioLevel: number;
  /** Whether a sound was just detected */
  soundDetected: boolean;
  /** Start listening for sounds */
  startListening: () => Promise<void>;
  /** Stop listening */
  stopListening: () => Promise<void>;
  /** Reset the detected state */
  resetDetection: () => void;
  /** Current threshold value */
  threshold: number;
  /** Update threshold */
  setThreshold: (value: number) => void;
  /** Error if any */
  error: Error | null;
  /** Whether permissions are granted */
  hasPermission: boolean;
}

// Recording options with metering enabled
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export function useSoundDetection(
  options: UseSoundDetectionOptions = {}
): UseSoundDetectionReturn {
  const {
    threshold: initialThreshold = 0.7,
    debounceMs = 500,
    autoStart = false,
  } = options;

  // State
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [soundDetected, setSoundDetected] = useState(false);
  const [threshold, setThreshold] = useState(initialThreshold);
  const [error, setError] = useState<Error | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Refs
  const lastDetectionTime = useRef(0);

  // Audio recorder hook with status listener for metering
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Process metering updates
  useEffect(() => {
    if (!isListening || recorderState.metering === undefined) return;

    // Convert dB to 0-1 scale (-60dB to 0dB typical range)
    // Metering values are typically negative dB (-160 silence to 0 max)
    const meteringDb = recorderState.metering;
    const normalizedLevel = Math.max(0, Math.min(1, (meteringDb + 60) / 60));
    setAudioLevel(normalizedLevel);

    // Check for sound spike
    const now = Date.now();
    if (
      normalizedLevel >= threshold &&
      now - lastDetectionTime.current > debounceMs
    ) {
      lastDetectionTime.current = now;
      setSoundDetected(true);
    }
  }, [recorderState.metering, isListening, threshold, debounceMs]);

  // Request permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        setHasPermission(status.granted);
        if (!status.granted) {
          setError(new Error('Microphone permission not granted'));
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to request permissions'));
      }
    };

    requestPermissions();
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    if (!hasPermission) {
      setError(new Error('Microphone permission not granted'));
      return;
    }

    try {
      setError(null);
      setSoundDetected(false);

      // Configure audio mode for recording
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Start recording (we monitor levels, don't save the file)
      await audioRecorder.record();
      setIsListening(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start listening'));
      setIsListening(false);
    }
  }, [hasPermission, audioRecorder]);

  // Stop listening
  const stopListening = useCallback(async () => {
    try {
      await audioRecorder.stop();
      setIsListening(false);
      setAudioLevel(0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to stop listening'));
    }
  }, [audioRecorder]);

  // Reset detection state
  const resetDetection = useCallback(() => {
    setSoundDetected(false);
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && hasPermission && !isListening) {
      startListening();
    }
  }, [autoStart, hasPermission, isListening, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        audioRecorder.stop();
      }
    };
  }, [isListening, audioRecorder]);

  return {
    isListening,
    audioLevel,
    soundDetected,
    startListening,
    stopListening,
    resetDetection,
    threshold,
    setThreshold,
    error,
    hasPermission,
  };
}
