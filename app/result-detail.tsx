/**
 * Result Detail Screen
 *
 * View detailed timing result with photo and stats.
 */

import { useLocalSearchParams } from 'expo-router';
import { ResultDetailScreen } from '../src/screens';

export default function ResultDetail() {
  const { resultId } = useLocalSearchParams<{ resultId: string }>();
  return <ResultDetailScreen />;
}
