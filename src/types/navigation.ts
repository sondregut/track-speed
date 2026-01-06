import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

/**
 * Root Stack Navigator
 */
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  Timer: { sessionId?: string } | undefined;
  SessionSetup: undefined;
  ResultDetail: { resultId: string };
  AthleteSelect: undefined;
  GhostGateCalibration: undefined;
};

/**
 * Tab Navigator
 */
export type TabParamList = {
  Home: undefined;
  Results: undefined;
  Settings: undefined;
};

/**
 * Screen Props Types
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Individual Screen Props
 */
export type HomeScreenProps = TabScreenProps<'Home'>;
export type ResultsScreenProps = TabScreenProps<'Results'>;
export type SettingsScreenProps = TabScreenProps<'Settings'>;
export type TimerScreenProps = RootStackScreenProps<'Timer'>;
export type SessionSetupScreenProps = RootStackScreenProps<'SessionSetup'>;
export type ResultDetailScreenProps = RootStackScreenProps<'ResultDetail'>;
export type AthleteSelectScreenProps = RootStackScreenProps<'AthleteSelect'>;
export type GhostGateCalibrationScreenProps = RootStackScreenProps<'GhostGateCalibration'>;

/**
 * Declare global types for useNavigation hook
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
