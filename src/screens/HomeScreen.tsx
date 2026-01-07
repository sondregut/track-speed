import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts';
import { spacing, typography } from '../constants/theme';
import { Button, Card, GlassCard, GlassButton } from '../components/ui';
import { useSessionStore, useTimingStore } from '../stores';
import { formatDate, formatCount } from '../utils/formatting';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSoundDetection } from '../hooks';

interface HomeScreenProps {
  navigation: any;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { colors, isDark } = useTheme();
  const { sessions, currentSession, createSession } = useSessionStore();
  const { results } = useTimingStore();
  const soundDetection = useSoundDetection({ threshold: 0.25 });

  const recentSessions = sessions.slice(-5).reverse();
  // Use Glass UI on iOS 26+ (adapts to light/dark via tintColor)
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();

  // DEV: Test sound detection
  const handleTestSound = async () => {
    console.log('DEV: Testing sound detection...');
    console.log('DEV: hasPermission:', soundDetection.hasPermission);
    console.log('DEV: error:', soundDetection.error);

    await soundDetection.startListening();
    console.log('DEV: Started listening, isListening:', soundDetection.isListening);
  };

  // DEV: Test pose detection (creates session and navigates to timer)
  const handleTestPose = () => {
    console.log('DEV: Testing pose detection...');
    createSession({ name: 'Pose Test', startMethod: 'touch' });
    navigation.navigate('Timer');
  };

  // DEV: Test sound + pose (creates session with sound detection)
  const handleTestSoundStart = () => {
    console.log('DEV: Testing sound start + pose finish...');
    createSession({ name: 'Sound Test', startMethod: 'sound_detection' });
    navigation.navigate('Timer');
  };

  const handleNewSession = () => {
    navigation.navigate('SessionSetup');
  };

  const handleSeriesTraining = () => {
    navigation.navigate('SeriesSetup');
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
              <GlassButton
                title="Series Training"
                onPress={handleSeriesTraining}
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
              <Button
                title="Series Training"
                onPress={handleSeriesTraining}
                variant="outline"
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

        {/* DEV: Test Buttons */}
        <View style={styles.devSection}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Dev Testing</Text>

          {/* Sound Test with Audio Meter */}
          <Card style={styles.soundTestCard}>
            <View style={styles.soundTestHeader}>
              <Text style={[styles.soundTestTitle, { color: colors.text.primary }]}>Sound Detection Test</Text>
              <TouchableOpacity
                style={[styles.soundToggleButton, { backgroundColor: soundDetection.isListening ? '#EF4444' : '#3B82F6' }]}
                onPress={soundDetection.isListening ? soundDetection.stopListening : handleTestSound}
              >
                <Text style={styles.soundToggleText}>
                  {soundDetection.isListening ? 'Stop' : 'Start'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Audio Level Bar */}
            <View style={styles.audioMeterContainer}>
              <View style={styles.audioMeterBackground}>
                {/* Current level bar */}
                <View
                  style={[
                    styles.audioMeterLevel,
                    {
                      width: `${soundDetection.audioLevel * 100}%`,
                      backgroundColor: soundDetection.audioLevel >= 0.25 ? '#22C55E' : '#3B82F6'
                    }
                  ]}
                />
                {/* Threshold line */}
                <View style={[styles.thresholdLine, { left: '25%' }]} />
              </View>
              <View style={styles.audioMeterLabels}>
                <Text style={[styles.audioMeterLabel, { color: colors.text.secondary }]}>0%</Text>
                <Text style={[styles.audioMeterLabel, { color: '#F59E0B' }]}>25% (threshold)</Text>
                <Text style={[styles.audioMeterLabel, { color: colors.text.secondary }]}>100%</Text>
              </View>
            </View>

            {/* Status */}
            <View style={styles.soundStatus}>
              <Text style={[styles.soundStatusText, { color: colors.text.secondary }]}>
                Level: {(soundDetection.audioLevel * 100).toFixed(0)}%
              </Text>
              <Text style={[styles.soundStatusText, { color: soundDetection.audioLevel >= 0.25 ? '#22C55E' : colors.text.secondary }]}>
                {soundDetection.audioLevel >= 0.25 ? '✓ Would trigger!' : 'Below threshold'}
              </Text>
            </View>
          </Card>

          {/* Other test buttons */}
          <View style={styles.devButtons}>
            <TouchableOpacity
              style={[styles.devButton, { backgroundColor: '#10B981' }]}
              onPress={handleTestPose}
            >
              <Text style={styles.devButtonText}>Test Pose</Text>
              <Text style={styles.devButtonSubtext}>Camera finish detection</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.devButton, { backgroundColor: '#F59E0B' }]}
              onPress={handleTestSoundStart}
            >
              <Text style={styles.devButtonText}>Sound + Pose</Text>
              <Text style={styles.devButtonSubtext}>Sound start, camera finish</Text>
            </TouchableOpacity>
          </View>
        </View>

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
  // Dev testing styles
  devSection: {
    gap: spacing.md,
  },
  devButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  devButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  devButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  devButtonSubtext: {
    color: '#FFFFFF99',
    fontSize: 10,
    marginTop: 4,
  },
  // Sound test card
  soundTestCard: {
    padding: spacing.md,
  },
  soundTestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  soundTestTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  soundToggleButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  soundToggleText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Audio meter
  audioMeterContainer: {
    marginBottom: spacing.sm,
  },
  audioMeterBackground: {
    height: 24,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  audioMeterLevel: {
    height: '100%',
    borderRadius: 12,
  },
  thresholdLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#F59E0B',
  },
  audioMeterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  audioMeterLabel: {
    fontSize: 10,
  },
  soundStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  soundStatusText: {
    fontSize: 12,
  },
});
