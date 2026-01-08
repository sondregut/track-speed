/**
 * useDeviceStability - Hook for monitoring device stability and alignment
 *
 * Uses native CMMotionManager to detect:
 * - Phone stillness (not moving)
 * - Phone vertical alignment (upright)
 * - Phone rotation stability (not rotating)
 *
 * Critical for accurate timing - the phone must be stable and vertical.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { DeviceStabilityModule } = NativeModules;

export interface StabilityState {
  // Stability flags
  isStill: boolean;
  isNotRotating: boolean;
  isVertical: boolean;
  isStable: boolean;  // isStill && isNotRotating
  isReady: boolean;   // isStable && isVertical

  // Raw measurements
  acceleration: number;  // m/s²
  rotation: number;      // rad/s
  tiltAngle: number;     // degrees from vertical
  pitch: number;         // degrees
  roll: number;          // degrees

  // Scores (0-100)
  stillnessScore: number;
  rotationScore: number;
  verticalScore: number;
  overallScore: number;

  // UI helpers
  tiltDirection: 'level' | 'tilted_left' | 'tilted_right' | 'tilted_forward' | 'tilted_backward';
  message: string;
}

const defaultState: StabilityState = {
  isStill: false,
  isNotRotating: false,
  isVertical: false,
  isStable: false,
  isReady: false,
  acceleration: 0,
  rotation: 0,
  tiltAngle: 0,
  pitch: 0,
  roll: 0,
  stillnessScore: 0,
  rotationScore: 0,
  verticalScore: 0,
  overallScore: 0,
  tiltDirection: 'level',
  message: 'Initializing...',
};

interface UseDeviceStabilityOptions {
  /** Auto-start monitoring when hook mounts */
  autoStart?: boolean;
}

export function useDeviceStability(options: UseDeviceStabilityOptions = {}) {
  const { autoStart = false } = options;

  const [state, setState] = useState<StabilityState>(defaultState);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const eventEmitterRef = useRef<NativeEventEmitter | null>(null);

  // Check if module is available
  useEffect(() => {
    if (Platform.OS !== 'ios' || !DeviceStabilityModule) {
      setIsSupported(false);
      setState(prev => ({
        ...prev,
        message: 'Stability detection not available',
      }));
    }
  }, []);

  // Set up event listener
  useEffect(() => {
    if (!isSupported || Platform.OS !== 'ios' || !DeviceStabilityModule) return;

    const eventEmitter = new NativeEventEmitter(DeviceStabilityModule);
    eventEmitterRef.current = eventEmitter;

    const subscription = eventEmitter.addListener('onStabilityChange', (data: StabilityState) => {
      setState(data);
    });

    return () => {
      subscription.remove();
    };
  }, [isSupported]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && isSupported) {
      startMonitoring();
    }

    return () => {
      if (autoStart && isMonitoring) {
        stopMonitoring();
      }
    };
  }, [autoStart, isSupported]);

  const startMonitoring = useCallback(async () => {
    if (!isSupported || !DeviceStabilityModule) {
      console.warn('[useDeviceStability] Module not available');
      return;
    }

    try {
      await DeviceStabilityModule.startMonitoring();
      setIsMonitoring(true);
    } catch (error) {
      console.error('[useDeviceStability] Failed to start:', error);
    }
  }, [isSupported]);

  const stopMonitoring = useCallback(async () => {
    if (!isSupported || !DeviceStabilityModule) return;

    try {
      await DeviceStabilityModule.stopMonitoring();
      setIsMonitoring(false);
    } catch (error) {
      console.error('[useDeviceStability] Failed to stop:', error);
    }
  }, [isSupported]);

  const getStabilityState = useCallback(async (): Promise<StabilityState | null> => {
    if (!isSupported || !DeviceStabilityModule) {
      console.warn('[useDeviceStability] Module not available');
      return null;
    }

    try {
      const data = await DeviceStabilityModule.getStabilityState();
      setState(data);
      return data;
    } catch (error) {
      console.error('[useDeviceStability] Failed to get state:', error);
      return null;
    }
  }, [isSupported]);

  return {
    // Current state
    ...state,

    // Control methods
    startMonitoring,
    stopMonitoring,
    getStabilityState,

    // Status
    isMonitoring,
    isSupported,
  };
}

export default useDeviceStability;
