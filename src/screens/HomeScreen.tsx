import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTheme } from '../contexts';
import { spacing, typography } from '../constants/theme';
import { Button, Card, GlassCard, GlassButton } from '../components/ui';
import { useSessionStore, useTimingStore } from '../stores';
import { formatDate, formatCount } from '../utils/formatting';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

interface HomeScreenProps {
  navigation: any;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { colors, isDark } = useTheme();
  const { sessions, currentSession, createSession } = useSessionStore();
  const { results } = useTimingStore();

  const recentSessions = sessions.slice(-5).reverse();
  // Use Glass UI on iOS 26+ (adapts to light/dark via tintColor)
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const handleNewSession = () => {
    navigation.navigate('SessionSetup');
  };

  const handleQuickStart = () => {
    if (!currentSession) {
      createSession({ name: 'Quick Session' });
    }
    navigation.navigate('Timer');
  };

  // Stats card - uses Glass effect on iOS 26+
  const StatsCard = useGlassUI ? GlassCard : Card;

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Track Speed</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>Sprint Timing Precision</Text>
        </View>

        {/* Quick Actions - Glass buttons on iOS 26+ */}
        <View style={styles.actions}>
          {useGlassUI ? (
            <>
              <GlassButton
                title="Quick Start"
                onPress={handleQuickStart}
                variant="primary"
                size="large"
              />
              <GlassButton
                title="New Session"
                onPress={handleNewSession}
                variant="secondary"
                size="large"
              />
            </>
          ) : (
            <>
              <Button
                title="Quick Start"
                onPress={handleQuickStart}
                size="large"
                style={{ backgroundColor: colors.timing.ready }}
              />
              <Button
                title="New Session"
                onPress={handleNewSession}
                variant="secondary"
                size="large"
              />
            </>
          )}
        </View>

        {/* Stats Overview */}
        <StatsCard variant="elevated" style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary[600] }]}>{sessions.length}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Sessions</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border.primary }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary[600] }]}>{results.length}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Times</Text>
            </View>
          </View>
        </StatsCard>

        {/* Recent Sessions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Recent Sessions</Text>
          {recentSessions.length === 0 ? (
            <Card variant="outlined">
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                No sessions yet. Start your first sprint timing session!
              </Text>
            </Card>
          ) : (
            recentSessions.map((session) => (
              <Card
                key={session.id}
                variant="default"
                style={styles.sessionCard}
              >
                <Text style={[styles.sessionName, { color: colors.text.primary }]}>{session.name}</Text>
                <View style={styles.sessionMeta}>
                  <Text style={[styles.sessionDate, { color: colors.text.secondary }]}>
                    {formatDate(session.date)}
                  </Text>
                  <Text style={[styles.sessionResults, { color: colors.text.tertiary }]}>
                    {formatCount(session.results?.length || 0, 'result')}
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold as '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.lg,
  },
  actions: {
    gap: spacing.md,
  },
  statsCard: {
    marginTop: spacing.md,
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
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as '700',
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  sessionCard: {
    marginBottom: spacing.sm,
  },
  sessionName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
    marginBottom: spacing.xs,
  },
  sessionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionDate: {
    fontSize: typography.fontSize.sm,
  },
  sessionResults: {
    fontSize: typography.fontSize.sm,
  },
});
