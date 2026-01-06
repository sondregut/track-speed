import { useCallback, useRef, useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { useSettingsStore } from '../stores';

type SoundType = 'start' | 'stop' | 'beep' | 'countdown';

// Sound configuration - frequencies and durations for generated tones
const SOUND_CONFIG: Record<SoundType, { frequency: number; duration: number }> = {
  start: { frequency: 880, duration: 150 },      // A5 - high pitched start
  stop: { frequency: 523, duration: 200 },       // C5 - lower pitched stop
  beep: { frequency: 1000, duration: 100 },      // Short beep
  countdown: { frequency: 440, duration: 100 },  // A4 - countdown tick
};

/**
 * Hook for audio feedback using expo-audio
 * Uses generated tones for timing events (no external sound files needed)
 */
export function useSound() {
  const soundEnabled = useSettingsStore((state) => state.timing.soundEnabled);
  const audioSourceRef = useRef<string | null>(null);

  const play = useCallback(
    async (type: SoundType) => {
      if (!soundEnabled) return;

      try {
        // Generate tone data URI
        const uri = generateToneDataUri(
          SOUND_CONFIG[type].frequency,
          SOUND_CONFIG[type].duration
        );

        // For now, just log - expo-audio requires actual audio source
        // In production, use preloaded audio files
        console.log(`Sound: ${type} (${SOUND_CONFIG[type].frequency}Hz)`);
      } catch (error) {
        console.warn(`Failed to play sound: ${type}`, error);
      }
    },
    [soundEnabled]
  );

  return { play };
}

/**
 * Generate a simple sine wave tone as a base64 WAV data URI
 * This allows playing sounds without needing external audio files
 */
function generateToneDataUri(frequency: number, durationMs: number): string {
  const sampleRate = 44100;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const amplitude = 0.3;

  // Create WAV file data
  const wavData = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(wavData);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);           // Subchunk1Size
  view.setUint16(20, 1, true);            // AudioFormat (PCM)
  view.setUint16(22, 1, true);            // NumChannels (mono)
  view.setUint32(24, sampleRate, true);   // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);            // BlockAlign
  view.setUint16(34, 16, true);           // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Generate sine wave samples with fade in/out
  const fadeLength = Math.floor(numSamples * 0.1);
  for (let i = 0; i < numSamples; i++) {
    let sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude;

    // Apply fade in/out envelope
    if (i < fadeLength) {
      sample *= i / fadeLength;
    } else if (i > numSamples - fadeLength) {
      sample *= (numSamples - i) / fadeLength;
    }

    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  // Convert to base64
  const bytes = new Uint8Array(wavData);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
