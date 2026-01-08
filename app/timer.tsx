/**
 * Timer Screen
 *
 * Main timing interface with camera and pose detection.
 */

import { useLocalSearchParams } from 'expo-router';
import { TimerScreen } from '../src/screens';

export default function Timer() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  return <TimerScreen />;
}
