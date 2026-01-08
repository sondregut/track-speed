/**
 * Root Layout for Track Speed
 *
 * Sets up providers (Theme, SafeArea) and the main navigation stack.
 * Uses Expo Router with native iOS 26 Liquid Glass support.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/contexts';
import { ErrorBoundary } from '../src/components/ui';

function RootLayoutNav() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: colors.background.primary,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="timer"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'card',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="session-setup"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="series-setup"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="ghost-gate-calibration"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="athlete-list"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="result-detail"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="device-sync"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="pose-test"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="crossing-review"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="run-result"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="session-results"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="session-summary"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootLayoutNav />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
