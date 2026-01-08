/**
 * useTimingSounds - Audio feedback for timing events
 *
 * Provides distinct sounds for:
 * - Start: High-pitched beep (go signal) + heavy haptic
 * - Lap: Medium tone (split marker) + medium haptic
 * - Finish: Lower celebratory tone + success haptic
 *
 * Includes haptic feedback as backup for audio
 */

import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../stores';

// Sound URLs for different timing events
// Using reliable, short beep sounds
const SOUND_URLS = {
  // High-pitched short beep for start
  start: 'https://www.soundjay.com/buttons/beep-01a.mp3',
  // Quick tick for lap
  lap: 'https://www.soundjay.com/buttons/beep-07.mp3',
  // Success ding for finish
  finish: 'https://www.soundjay.com/buttons/beep-09.mp3',
} as const;

export type TimingEventType = 'start' | 'lap' | 'finish';

interface UseTimingSoundsOptions {
  /** Enable/disable sounds globally (overrides settings) */
  enabled?: boolean;
  /** Enable haptic feedback */
  hapticEnabled?: boolean;
  /** Volume level (0-1) */
  volume?: number;
}

interface UseTimingSoundsReturn {
  /** Play a sound for a specific timing event */
  playSound: (eventType: TimingEventType) => void;
  /** Whether sounds are ready to play */
  isReady: boolean;
}

export function useTimingSounds(
  options: UseTimingSoundsOptions = {}
): UseTimingSoundsReturn {
  // Get sound setting from store
  const soundEnabledFromStore = useSettingsStore((state) => state.timing?.soundEnabled ?? true);
  const vibrationEnabledFromStore = useSettingsStore((state) => state.timing?.vibrationEnabled ?? true);

  const {
    enabled = soundEnabledFromStore,
    hapticEnabled = vibrationEnabledFromStore,
    volume = 1.0,
  } = options;

  // Create separate players for each sound type
  const startPlayer = useAudioPlayer(SOUND_URLS.start);
  const lapPlayer = useAudioPlayer(SOUND_URLS.lap);
  const finishPlayer = useAudioPlayer(SOUND_URLS.finish);

  // Track if sounds loaded successfully
  const soundsReady = useRef(false);

  // Set volume on all players when they change
  useEffect(() => {
    try {
      if (startPlayer) startPlayer.volume = volume;
      if (lapPlayer) lapPlayer.volume = volume;
      if (finishPlayer) finishPlayer.volume = volume;
      soundsReady.current = true;
    } catch (error) {
      console.warn('Failed to set audio volume:', error);
    }
  }, [volume, startPlayer, lapPlayer, finishPlayer]);

  // Haptic feedback for each event type
  const triggerHaptic = useCallback(async (eventType: TimingEventType) => {
    if (!hapticEnabled) return;

    try {
      switch (eventType) {
        case 'start':
          // Heavy impact for start
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'lap':
          // Medium impact for lap
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'finish':
          // Success notification for finish
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
      }
    } catch (error) {
      // Haptics might not be available on all devices
      console.debug('Haptic feedback not available:', error);
    }
  }, [hapticEnabled]);

  const playSound = useCallback((eventType: TimingEventType) => {
    // Always trigger haptic (it's the most reliable feedback)
    triggerHaptic(eventType);

    // Try to play audio if enabled
    if (!enabled) return;

    try {
      let player;
      switch (eventType) {
        case 'start':
          player = startPlayer;
          break;
        case 'lap':
          player = lapPlayer;
          break;
        case 'finish':
          player = finishPlayer;
          break;
      }

      if (player) {
        // Seek to beginning and play
        player.seekTo(0);
        player.play();
      }
    } catch (error) {
      // Audio playback failed - haptic already triggered as fallback
      console.debug(`Audio playback failed for ${eventType}:`, error);
    }
  }, [enabled, startPlayer, lapPlayer, finishPlayer, triggerHaptic]);

  return {
    playSound,
    isReady: soundsReady.current,
  };
}

/**
 * Play a timing sound imperatively (for use outside React components)
 * Falls back to haptic feedback only
 */
export async function playTimingSoundImperative(eventType: TimingEventType): Promise<void> {
  try {
    // Just use haptics for imperative calls - audio requires hooks
    switch (eventType) {
      case 'start':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'lap':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'finish':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
    }
  } catch (error) {
    console.debug('Haptic feedback not available');
  }
}
