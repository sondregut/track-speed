/**
 * Athlete List Screen
 *
 * Manage athletes for timing sessions.
 */

import { useLocalSearchParams } from 'expo-router';
import { AthleteListScreen } from '../src/screens';

export default function AthleteList() {
  const { selectionMode } = useLocalSearchParams<{ selectionMode?: string }>();
  return <AthleteListScreen />;
}
