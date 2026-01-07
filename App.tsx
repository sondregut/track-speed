import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  HomeScreen,
  TimerScreen,
  ResultsScreen,
  SettingsScreen,
  ProfileScreen,
  SessionSetupScreen,
  SeriesSetupScreen,
  GhostGateCalibrationScreen,
  AthleteListScreen,
  ResultDetailScreen,
  DeviceSyncScreen,
  PoseTestScreen,
  CrossingReviewScreen,
} from './src/screens';
import { ErrorBoundary } from './src/components/ui';
import { ThemeProvider, useTheme } from './src/contexts';

// Navigation types
export type RootStackParamList = {
  MainTabs: undefined;
  Timer: { sessionId?: string } | undefined;
  SessionSetup: undefined;
  SeriesSetup: undefined;
  GhostGateCalibration: undefined;
  AthleteList: { selectionMode?: boolean } | undefined;
  ResultDetail: { resultId: string };
  DeviceSync: undefined;
  Settings: undefined;
  PoseTest: undefined;
  CrossingReview: {
    folderPath: string;
    frameCount: number;
    aiFrameIndex: number;
    onConfirm?: (selectedFrameIndex: number, timestamp: number) => void;
  };
};

export type TabParamList = {
  Home: undefined;
  Results: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Tab icon component using modern SF Symbols style icons
function TabIcon({ name, focused, colors }: { name: string; focused: boolean; colors: any }) {
  const iconColor = focused ? colors.primary[500] : colors.gray[400];

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (name) {
      case 'Home':
        return focused ? 'home' : 'home-outline';
      case 'Results':
        return focused ? 'timer' : 'timer-outline';
      case 'Profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'ellipse';
    }
  };

  return (
    <Ionicons name={getIconName()} size={24} color={iconColor} />
  );
}

// Main tab navigator with theme
function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} colors={colors} />
        ),
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.border.primary,
          paddingTop: 8,
          height: 85,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Results" component={ResultsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Themed navigation container
function ThemedNavigator() {
  const { colors, isDark } = useTheme();

  // Create navigation theme based on current theme
  const navigationTheme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary[500],
      background: colors.background.secondary,
      card: colors.background.primary,
      text: colors.text.primary,
      border: colors.border.primary,
      notification: colors.primary[500],
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="Timer"
          component={TimerScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="SessionSetup"
          component={SessionSetupScreen}
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="SeriesSetup"
          component={SeriesSetupScreen}
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="GhostGateCalibration"
          component={GhostGateCalibrationScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="AthleteList"
          component={AthleteListScreen}
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="ResultDetail"
          component={ResultDetailScreen}
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="DeviceSync"
          component={DeviceSyncScreen}
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="PoseTest"
          component={PoseTestScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="CrossingReview"
          component={CrossingReviewScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Root app component
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Styles removed - no longer needed with Ionicons
