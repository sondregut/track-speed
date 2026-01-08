export { useTimer } from './useTimer';
export { useKeepAwake } from './useKeepAwake';
export { useHaptics } from './useHaptics';
export { useSound } from './useSound';
export { usePoseDetection } from './usePoseDetection';
export { useAutoTiming } from './useAutoTiming';
export { useSyncConnection } from './useSyncConnection';
export { useSoundDetection } from './useSoundDetection';
export { useBluetoothSync, type SessionMode } from './useBluetoothSync';
export { useVisionPose } from './useVisionPose';
export { useSeries } from './useSeries';
export { useGateDetection } from './useGateDetection';
export { useResultsAggregator } from './useResultsAggregator';
export { useTimingSounds, type TimingEventType } from './useTimingSounds';
export {
  useTimingPhotoCapture,
  getSessionPhotos,
  cleanupOldPhotos,
  type CapturedPhoto,
} from './useTimingPhotoCapture';
export { useDeviceStability, type StabilityState } from './useDeviceStability';

// Supabase / Auth hooks
export { useAuth } from './useAuth';
export { useAthletes, useSessions, useResults, useDataSync } from './useSupabaseData';
