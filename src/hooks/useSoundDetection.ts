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

  // Create recorder with metering enabled
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  // Get recorder state (includes metering)
  const recorderState = useAudioRecorderState(audioRecorder);

  // Request permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        console.log('Sound: Permission status:', status);
        setHasPermission(status.granted);
        if (!status.granted) {
          setError(new Error('Microphone permission not granted'));
        }
      } catch (err) {
        console.log('Sound: Permission error:', err);
        setError(err instanceof Error ? err : new Error('Failed to request permissions'));
      }
    };

    requestPermissions();
  }, []);

  // Process metering from recorder state
  useEffect(() => {
    if (!isListening || !recorderState.isRecording) {
      return;
    }

    const meteringDb = recorderState.metering ?? -160;

    // Convert dB to 0-1 scale (-60dB to 0dB typical range)
    const normalizedLevel = Math.max(0, Math.min(1, (meteringDb + 60) / 60));
    setAudioLevel(normalizedLevel);

    // Debug log
    if (normalizedLevel > 0.05) {
      console.log(`Sound: level=${normalizedLevel.toFixed(2)}, threshold=${threshold}, dB=${meteringDb.toFixed(1)}`);
    }

    // Check for sound spike
    const now = Date.now();
    if (
      normalizedLevel >= threshold &&
      now - lastDetectionTime.current > debounceMs
    ) {
      console.log('Sound: TRIGGERED!');
      lastDetectionTime.current = now;
      setSoundDetected(true);
    }
  }, [recorderState, isListening, threshold, debounceMs]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!hasPermission) {
      console.log('Sound: No permission');
      setError(new Error('Microphone permission not granted'));
      return;
    }

    try {
      setError(null);
      setSoundDetected(false);

      console.log('Sound: Configuring audio mode...');
      // Configure audio mode for recording
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      console.log('Sound: Preparing to record...');
      await audioRecorder.prepareToRecordAsync();

      console.log('Sound: Starting recording...');
      audioRecorder.record();

      setIsListening(true);
      console.log('Sound: Recording started!');
    } catch (err) {
      console.log('Sound: ERROR starting:', err);
      setError(err instanceof Error ? err : new Error('Failed to start listening'));
      setIsListening(false);
    }
  }, [hasPermission, audioRecorder]);

  // Stop listening
  const stopListening = useCallback(async () => {
    console.log('Sound: stopListening called');

    try {
      await audioRecorder.stop();
      setIsListening(false);
      setAudioLevel(0);
      console.log('Sound: Stopped listening');
    } catch (err) {
      console.log('Sound: ERROR stopping:', err);
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
      if (audioRecorder) {
        audioRecorder.stop().catch(() => {});
      }
    };
  }, [audioRecorder]);

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
