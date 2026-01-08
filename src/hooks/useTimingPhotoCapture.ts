/**
 * useTimingPhotoCapture - Capture photos at timing events
 *
 * Captures a photo when:
 * - Athlete crosses a lap gate
 * - Athlete crosses the finish line
 *
 * Photos are stored locally and associated with timing results.
 */

import { useCallback, useRef } from 'react';
import { CameraView } from 'expo-camera';
import { File, Directory, Paths } from 'expo-file-system';

export interface CapturedPhoto {
  uri: string;
  timestamp: number;
  eventType: 'lap' | 'finish';
  distance_m?: number;
}

interface UseTimingPhotoCaptureOptions {
  /** Enable/disable photo capture */
  enabled?: boolean;
  /** Quality of captured photos (0-1) */
  quality?: number;
}

interface UseTimingPhotoCaptureReturn {
  /** Reference to pass to CameraView */
  cameraRef: React.RefObject<CameraView | null>;
  /** Capture a photo for a timing event */
  capturePhoto: (eventType: 'lap' | 'finish', distance_m?: number) => Promise<CapturedPhoto | null>;
  /** Get all captured photos for the current session */
  getCapturedPhotos: () => CapturedPhoto[];
  /** Clear all captured photos */
  clearPhotos: () => void;
}

// Directory name for storing timing photos
const PHOTOS_DIR_NAME = 'timing-photos';

export function useTimingPhotoCapture(
  options: UseTimingPhotoCaptureOptions = {}
): UseTimingPhotoCaptureReturn {
  const { enabled = true, quality = 0.8 } = options;

  const cameraRef = useRef<CameraView>(null);
  const capturedPhotos = useRef<CapturedPhoto[]>([]);

  // Ensure photos directory exists
  const ensurePhotosDir = useCallback(async () => {
    const photosDir = new Directory(Paths.document, PHOTOS_DIR_NAME);
    if (!photosDir.exists) {
      await photosDir.create();
    }
    return photosDir;
  }, []);

  const capturePhoto = useCallback(async (
    eventType: 'lap' | 'finish',
    distance_m?: number
  ): Promise<CapturedPhoto | null> => {
    if (!enabled || !cameraRef.current) {
      console.log('[PhotoCapture] Capture skipped - disabled or no camera');
      return null;
    }

    try {
      const photosDir = await ensurePhotosDir();

      // Take photo with expo-camera
      const photo = await cameraRef.current.takePictureAsync({
        quality,
        skipProcessing: true, // Faster capture
      });

      if (!photo?.uri) {
        console.warn('[PhotoCapture] Failed to capture photo - no URI');
        return null;
      }

      const timestamp = Date.now();
      const filename = `${eventType}_${timestamp}.jpg`;

      // Create a File from the photo URI and copy to our directory
      const sourceFile = new File(photo.uri);
      const destFile = new File(photosDir, filename);

      await sourceFile.move(destFile);

      const capturedPhoto: CapturedPhoto = {
        uri: destFile.uri,
        timestamp,
        eventType,
        distance_m,
      };

      capturedPhotos.current.push(capturedPhoto);

      console.log(`[PhotoCapture] Captured ${eventType} photo at ${distance_m}m`);
      return capturedPhoto;
    } catch (error) {
      console.error('[PhotoCapture] Failed to capture photo:', error);
      return null;
    }
  }, [enabled, quality, ensurePhotosDir]);

  const getCapturedPhotos = useCallback(() => {
    return [...capturedPhotos.current];
  }, []);

  const clearPhotos = useCallback(async () => {
    // Delete all photos in directory
    try {
      const photosDir = new Directory(Paths.document, PHOTOS_DIR_NAME);
      if (photosDir.exists) {
        await photosDir.delete();
      }
    } catch (error) {
      console.warn('[PhotoCapture] Failed to clear photos:', error);
    }

    capturedPhotos.current = [];
  }, []);

  return {
    cameraRef,
    capturePhoto,
    getCapturedPhotos,
    clearPhotos,
  };
}

/**
 * Get photos for a specific session (by timestamp range)
 */
export async function getSessionPhotos(
  startTime: number,
  endTime: number
): Promise<CapturedPhoto[]> {
  try {
    const photosDir = new Directory(Paths.document, PHOTOS_DIR_NAME);
    if (!photosDir.exists) {
      return [];
    }

    const contents = await photosDir.list();
    const photos: CapturedPhoto[] = [];

    for (const item of contents) {
      if (item instanceof File && item.name) {
        // Parse timestamp from filename (format: eventType_timestamp.jpg)
        const match = item.name.match(/^(lap|finish)_(\d+)\.jpg$/);
        if (match) {
          const [, eventType, timestampStr] = match;
          const timestamp = parseInt(timestampStr, 10);

          if (timestamp >= startTime && timestamp <= endTime) {
            photos.push({
              uri: item.uri,
              timestamp,
              eventType: eventType as 'lap' | 'finish',
            });
          }
        }
      }
    }

    return photos.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('[PhotoCapture] Failed to get session photos:', error);
    return [];
  }
}

/**
 * Delete old timing photos (older than specified days)
 */
export async function cleanupOldPhotos(daysToKeep: number = 7): Promise<void> {
  try {
    const photosDir = new Directory(Paths.document, PHOTOS_DIR_NAME);
    if (!photosDir.exists) {
      return;
    }

    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const contents = await photosDir.list();

    for (const item of contents) {
      if (item instanceof File && item.name) {
        const match = item.name.match(/_(\d+)\.jpg$/);
        if (match) {
          const timestamp = parseInt(match[1], 10);
          if (timestamp < cutoff) {
            await item.delete();
          }
        }
      }
    }
  } catch (error) {
    console.warn('[PhotoCapture] Failed to cleanup old photos:', error);
  }
}
