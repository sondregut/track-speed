import { useEffect } from 'react';
import { useSettingsStore } from '../stores';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * Hook to keep the screen awake during timing sessions
 */
export function useKeepAwake(active: boolean = true) {
  const keepScreenAwake = useSettingsStore((state) => state.display.keepScreenAwake);

  useEffect(() => {
    if (active && keepScreenAwake) {
      activateKeepAwakeAsync().catch((error) => {
        console.warn('Failed to activate keep awake:', error);
      });

      return () => {
        deactivateKeepAwake();
      };
    }
  }, [active, keepScreenAwake]);
}
