/**
 * Crossing Review Screen
 *
 * Review and adjust detected crossing frame.
 */

import { useLocalSearchParams } from 'expo-router';
import { CrossingReviewScreen } from '../src/screens';

export default function CrossingReview() {
  const params = useLocalSearchParams<{
    folderPath: string;
    frameCount: string;
    aiFrameIndex: string;
  }>();
  return <CrossingReviewScreen />;
}
