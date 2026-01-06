---
name: Fix SafeAreaView
description: Fix SafeAreaView padding issues in React Native/Expo screens. Use when user mentions safe area, padding issues on top/bottom of screens, or content being cut off by notch/home indicator.
---

# Fix SafeAreaView in React Native/Expo

When fixing SafeAreaView issues in this project, follow these patterns:

## Preferred Approach

Use `SafeAreaView` from `react-native-safe-area-context` with the `edges` prop instead of manually applying insets with `useSafeAreaInsets()`.

### Import
```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
```

### For Modal/Stack Screens (need top and bottom safe areas)
```tsx
<SafeAreaView style={styles.container} edges={['top']}>
  {/* Header and content */}
  <SafeAreaView edges={['bottom']} style={styles.footer}>
    {/* Footer buttons */}
  </SafeAreaView>
</SafeAreaView>
```

### For Tab Screens (tab bar handles bottom, may not need top)
Tab screens typically don't need SafeAreaView wrapping since the tab navigator handles safe areas. Just use a regular `View`:
```tsx
<View style={styles.container}>
  <Header title="Screen Title" />
  {/* Content */}
</View>
```

Add fixed bottom padding to scroll content to account for tab bar:
```tsx
contentContainerStyle={{ paddingBottom: 120 }}
```

## Anti-patterns to Fix

### Don't use manual insets padding
```tsx
// BAD - causes double padding issues
const insets = useSafeAreaInsets();
<View style={[styles.container, { paddingTop: insets.top }]}>
```

### Don't use SafeAreaView from react-native
```tsx
// BAD - use react-native-safe-area-context instead
import { SafeAreaView } from 'react-native';
```

## Checklist
1. Check if screen is in a tab navigator or stack navigator
2. Tab screens: Remove safe area padding from top, use fixed bottom padding
3. Stack/modal screens: Use SafeAreaView with appropriate edges prop
4. Remove any `useSafeAreaInsets()` hooks if switching to SafeAreaView component
5. Test on devices with notch/Dynamic Island and home indicator
