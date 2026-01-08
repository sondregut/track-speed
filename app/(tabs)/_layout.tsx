/**
 * Tab Layout for Track Speed
 *
 * Uses Expo Router's NativeTabs for native iOS 26 Liquid Glass tab bar.
 * Falls back to standard styling on older iOS versions.
 */

import { Platform, DynamicColorIOS } from 'react-native';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  // Dynamic colors for iOS 26 Liquid Glass - adapts to light/dark content behind tab bar
  const tintColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ light: '#0F172A', dark: '#FFFFFF' })
    : '#6366F1';

  const labelColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ light: '#0F172A', dark: '#FFFFFF' })
    : '#6366F1';

  return (
    <NativeTabs
      tintColor={tintColor}
      labelStyle={{ color: labelColor }}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          drawable="ic_home"
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="results">
        <Icon
          sf={{ default: 'stopwatch', selected: 'stopwatch.fill' }}
          drawable="ic_timer"
        />
        <Label>Results</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon
          sf={{ default: 'person', selected: 'person.fill' }}
          drawable="ic_person"
        />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
