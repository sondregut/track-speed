import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraPosition, StartMethod, VelocityUnit, DistanceUnit } from '../types';

interface GhostGateSettings {
  enabled: boolean;
  sensitivity: number; // 0-100
  calibrationFrames: number;
}

interface TimingSettings {
  defaultStartMethod: StartMethod;
  autoDetectionEnabled: boolean;
  confidenceThreshold: number; // 0-100
  subFrameInterpolation: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface CameraSettings {
  preferredPosition: CameraPosition;
  targetFrameRate: 30 | 60 | 120 | 240;
  resolution: '720p' | '1080p' | '4k';
  torchEnabled: boolean;
  stabilizationEnabled: boolean;
}

interface DisplaySettings {
  theme: 'dark' | 'light' | 'system';
  showMilliseconds: boolean;
  largeTimerDisplay: boolean;
  keepScreenAwake: boolean;
}

interface UnitSettings {
  velocity: VelocityUnit;
  distance: DistanceUnit;
}

interface SettingsStore {
  // Settings groups
  ghostGate: GhostGateSettings;
  timing: TimingSettings;
  camera: CameraSettings;
  display: DisplaySettings;
  units: UnitSettings;

  // Actions
  updateGhostGate: (updates: Partial<GhostGateSettings>) => void;
  updateTiming: (updates: Partial<TimingSettings>) => void;
  updateCamera: (updates: Partial<CameraSettings>) => void;
  updateDisplay: (updates: Partial<DisplaySettings>) => void;
  updateUnits: (updates: Partial<UnitSettings>) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  ghostGate: {
    enabled: true,
    sensitivity: 50,
    calibrationFrames: 30,
  },
  timing: {
    defaultStartMethod: 'ready_set_go' as StartMethod,
    autoDetectionEnabled: true,
    confidenceThreshold: 70,
    subFrameInterpolation: true,
    soundEnabled: true,
    vibrationEnabled: true,
  },
  camera: {
    preferredPosition: 'back' as CameraPosition,
    targetFrameRate: 60 as const,
    resolution: '1080p' as const,
    torchEnabled: false,
    stabilizationEnabled: true,
  },
  display: {
    theme: 'light' as const,
    showMilliseconds: true,
    largeTimerDisplay: true,
    keepScreenAwake: true,
  },
  units: {
    velocity: 'm/s' as VelocityUnit,
    distance: 'metric' as DistanceUnit,
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      updateGhostGate: (updates) =>
        set((state) => ({
          ghostGate: { ...state.ghostGate, ...updates },
        })),

      updateTiming: (updates) =>
        set((state) => ({
          timing: { ...state.timing, ...updates },
        })),

      updateCamera: (updates) =>
        set((state) => ({
          camera: { ...state.camera, ...updates },
        })),

      updateDisplay: (updates) =>
        set((state) => ({
          display: { ...state.display, ...updates },
        })),

      updateUnits: (updates) =>
        set((state) => ({
          units: { ...state.units, ...updates },
        })),

      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'track-speed-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
