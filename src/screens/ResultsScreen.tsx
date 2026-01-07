import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts';
import { spacing, typography } from '../constants/theme';
import { Header, Card } from '../components/ui';
import { ResultCard } from '../components/timing';
import { useTimingStore, useSessionStore } from '../stores';
import { formatDate } from '../utils/formatting';
import { formatTime } from '../utils/timing';
import { TimingResult } from '../types';

interface ResultsScreenProps {
  navigation: any;
}

export function ResultsScreen({ navigation }: ResultsScreenProps) {
  const { colors, isDark } = useTheme();
  const { results, deleteResult } = useTimingStore();
  const { currentSession } = useSessionStore();

  // Calculate stats
  const sortedTimes = [...results]
    .map((r) => r.time_ms)
    .sort((a, b) => a - b);
  const bestTime = sortedTimes[0];
  const averageTime =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.time_ms, 0) / results.length
      : 0;

  const renderResult = ({ item, index }: { item: TimingResult; index: number }) => (
    <View style={styles.resultItem}>
      <View style={[styles.resultIndex, { backgroundColor: isDark ? colors.background.tertiary : colors.gray[200] }]}>
        <Text style={[styles.indexText, { color: colors.text.secondary }]}>{index + 1}</Text>
      </View>
      <ResultCard
        result={item}
        distance={currentSession?.distance}
        showDetails={false}
        onPress={() => {
          navigation.navigate('ResultDetail', { resultId: item.id });
        }}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Header title="Results" />

      {/* Stats Summary */}
      {results.length > 0 && (
        <Card variant="elevated" style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary[600] }]}>{formatTime(bestTime)}s</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Best</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border.primary }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary[600] }]}>{formatTime(averageTime)}s</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Average</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border.primary }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary[600] }]}>{results.length}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Total</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Results List */}
      {results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No Results Yet</Text>
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            Complete a timing session to see your results here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...results].reverse()}
          renderItem={renderResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 120,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
});
