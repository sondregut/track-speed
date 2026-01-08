import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { useSettingsStore } from '../stores';

type SoundType = 'start' | 'stop' | 'beep' | 'countdown' | 'crossing';

// Sound URLs for different timing events
// Using reliable, short beep sounds hosted online
const SOUND_URLS: Record<SoundType, string> = {
  start: 'https://www.soundjay.com/buttons/beep-01a.mp3',    // High-pitched start
  stop: 'https://www.soundjay.com/buttons/beep-09.mp3',      // Success ding for stop/finish
  beep: 'https://www.soundjay.com/buttons/beep-07.mp3',      // Short beep
  countdown: 'https://www.soundjay.com/buttons/beep-08b.mp3', // Countdown tick
  crossing: 'https://www.soundjay.com/buttons/beep-09.mp3',  // Crossing beep (same as stop)
};

/**
 * Hook for audio feedback using expo-audio
 * Uses hosted sound files for reliable playback
 */
export function useSound() {
  const soundEnabled = useSettingsStore((state) => state.timing.soundEnabled);

  // Create audio players for each sound type
  const startPlayer = useAudioPlayer(SOUND_URLS.start);
  const stopPlayer = useAudioPlayer(SOUND_URLS.stop);
  const beepPlayer = useAudioPlayer(SOUND_URLS.beep);
  const countdownPlayer = useAudioPlayer(SOUND_URLS.countdown);
  const crossingPlayer = useAudioPlayer(SOUND_URLS.crossing);

  const play = useCallback(
    (type: SoundType) => {
      if (!soundEnabled) return;

      try {
        let player;
        switch (type) {
          case 'start':
            player = startPlayer;
            break;
          case 'stop':
            player = stopPlayer;
            break;
          case 'beep':
            player = beepPlayer;
            break;
          case 'countdown':
            player = countdownPlayer;
            break;
          case 'crossing':
            player = crossingPlayer;
            break;
        }

        if (player) {
          player.seekTo(0);
          player.play();
        }
      } catch (error) {
        console.warn(`Failed to play sound: ${type}`, error);
      }
    },
    [soundEnabled, startPlayer, stopPlayer, beepPlayer, countdownPlayer, crossingPlayer]
  );

  return { play };
}
