import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts';
import { spacing, typography, borderRadius } from '../constants/theme';
import { Header, Card, GlassCard } from '../components/ui';
import { useSessionStore, useTimingStore, useSettingsStore } from '../stores';
import { formatTime, formatVelocity } from '../utils';

interface ProfileScreenProps {
  navigation: any;
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { colors, isDark } = useTheme();
  const { sessions, athletes } = useSessionStore();
  const { results } = useTimingStore();
  const { units } = useSettingsStore();

  // Use Glass UI on iOS 26+
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const ProfileCard = useGlassUI ? GlassCard : Card;

  // Calculate stats
  const totalSessions = sessions.length;
  const totalRuns = results.length;
  const totalAthletes = athletes.length;

  // Find best times by distance
  const bestTimes: Record<number, number> = {};
  results.forEach((result) => {
    const distance = result.distance_m || 0;
    if (distance > 0) {
      if (!bestTimes[distance] || result.time_ms < bestTimes[distance]) {
        bestTimes[distance] = result.time_ms;
      }
    }
  });

  // Find fastest velocity
  const maxVelocity = Math.max(
    ...results.map((r) => r.velocity_ms || 0),
    0
  );

  // Recent activity
  const recentSessions = sessions.slice(-5).reverse();

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Header
        title="Profile"
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <ProfileCard variant="elevated" style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
            <Ionicons name="person" size={48} color={colors.white} />
          </View>
          <Text style={[styles.profileName, { color: colors.text.primary }]}>
            Athlete
          </Text>
          <Text style={[styles.profileSubtitle, { color: colors.text.secondary }]}>
            Track Speed User
          </Text>
        </ProfileCard>

        {/* Stats Overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Statistics
          </Text>
          <ProfileCard variant="default">
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary[500] }]}>
                  {totalSessions}
                </Text>
                <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                  Sessions
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border.primary }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary[500] }]}>
                  {totalRuns}
                </Text>
                <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                  Runs
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border.primary }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary[500] }]}>
                  {totalAthletes}
                </Text>
                <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                  Athletes
                </Text>
              </View>
            </View>
          </ProfileCard>
        </View>

        {/* Personal Bests */}
        {Object.keys(bestTimes).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              Personal Bests
            </Text>
            <ProfileCard variant="default">
              {Object.entries(bestTimes)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([distance, time], index, arr) => (
                  <View
                    key={distance}
                    style={[
                      styles.pbRow,
                      index < arr.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.pbDistance, { color: colors.text.primary }]}>
                      {distance}m
                    </Text>
                    <Text style={[styles.pbTime, { color: colors.primary[500] }]}>
                      {formatTime(time, { decimals: 2 })}
                    </Text>
                  </View>
                ))}
            </ProfileCard>
          </View>
        )}

        {/* Max Velocity */}
        {maxVelocity > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              Top Speed
            </Text>
            <ProfileCard variant="elevated">
              <View style={styles.velocityContainer}>
                <Ionicons name="flash" size={32} color={colors.warning[500]} />
                <Text style={[styles.velocityValue, { color: colors.text.primary }]}>
                  {formatVelocity(maxVelocity, units.velocity)}
                </Text>
                <Text style={[styles.velocityLabel, { color: colors.text.secondary }]}>
                  Maximum Velocity
                </Text>
              </View>
            </ProfileCard>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Quick Actions
          </Text>
          <ProfileCard variant="default">
            <TouchableOpacity
              style={[styles.actionRow, { borderBottomColor: colors.border.primary }]}
              onPress={() => navigation.navigate('AthleteList')}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="people-outline" size={22} color={colors.text.primary} />
                <Text style={[styles.actionLabel, { color: colors.text.primary }]}>
                  Manage Athletes
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRow, { borderBottomColor: colors.border.primary }]}
              onPress={() => navigation.navigate('GhostGateCalibration')}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="scan-outline" size={22} color={colors.text.primary} />
                <Text style={[styles.actionLabel, { color: colors.text.primary }]}>
                  Calibrate Ghost Gate
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigation.navigate('DeviceSync')}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="phone-portrait-outline" size={22} color={colors.text.primary} />
                <Text style={[styles.actionLabel, { color: colors.text.primary }]}>
                  Multi-Phone Sync
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </ProfileCard>
        </View>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              Recent Sessions
            </Text>
            <ProfileCard variant="default">
              {recentSessions.map((session, index) => (
                <View
                  key={session.id}
                  style={[
                    styles.sessionRow,
                    index < recentSessions.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border.primary,
                    },
                  ]}
                >
                  <View>
                    <Text style={[styles.sessionName, { color: colors.text.primary }]}>
                      {session.name}
                    </Text>
                    <Text style={[styles.sessionDate, { color: colors.text.tertiary }]}>
                      {new Date(session.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.sessionBadge, { backgroundColor: isDark ? colors.primary[900] : colors.primary[100] }]}>
                    <Text style={[styles.sessionBadgeText, { color: isDark ? colors.primary[300] : colors.primary[600] }]}>
                      {session.results?.length || 0} runs
                    </Text>
                  </View>
                </View>
              ))}
            </ProfileCard>
          </View>
        )}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.text.tertiary }]}>
            Track Speed
          </Text>
          <Text style={[styles.appVersion, { color: colors.text.tertiary }]}>
            Version 0.1.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 120,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  profileName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
  },
  profileSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  pbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pbDistance: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  pbTime: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    fontVariant: ['tabular-nums'],
  },
  velocityContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  velocityValue: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as '700',
    marginTop: spacing.sm,
  },
  velocityLabel: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionLabel: {
    fontSize: typography.fontSize.base,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  sessionName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  sessionDate: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  sessionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  sessionBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
  appInfo: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  appName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
  },
  appVersion: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
});
