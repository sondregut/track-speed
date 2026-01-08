/**
 * Run Result Screen
 *
 * View individual run result after timing.
 */

import { useLocalSearchParams } from 'expo-router';
import { RunResultScreen } from '../src/screens';

export default function RunResult() {
  const { resultId } = useLocalSearchParams<{ resultId: string }>();
  return <RunResultScreen />;
}
