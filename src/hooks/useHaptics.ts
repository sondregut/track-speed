import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../stores';

/**
 * Hook for haptic feedback using expo-haptics
 * Provides various feedback types for timing events
 */
export function useHaptics() {
  const vibrationEnabled = useSettingsStore((state) => state.timing.vibrationEnabled);

  const trigger = useCallback(
    async (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
      if (!vibrationEnabled) return;

      try {
        switch (type) {
          case 'light':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'success':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'warning':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case 'error':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      } catch (error) {
        // Haptics may not be available on all devices/simulators
        console.warn('Haptic feedback unavailable:', error);
      }
    },
    [vibrationEnabled]
  );

  const selection = useCallback(async () => {
    if (!vibrationEnabled) return;
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn('Haptic selection unavailable:', error);
    }
  }, [vibrationEnabled]);

  return { trigger, selection };
}
