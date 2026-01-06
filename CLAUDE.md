# Track Speed

A cross-platform mobile sprint timing app that delivers timing-gate accuracy using smartphones.

## Project Overview

Track Speed uses smartphone cameras and AI pose detection to time sprints with sub-10ms accuracy. Athletes run through a virtual "gate" (the phone's camera view) and the app detects when their torso crosses the finish line.

## Tech Stack

- **Framework:** React Native 0.81+ with Expo SDK 54
- **Language:** TypeScript
- **Platforms:** iOS 17+ (optimized for iOS 26), Android 12+ (optimized for Android 16)
- **Navigation:** React Navigation 7
- **State Management:** Zustand
- **Camera:** expo-camera (Expo Go), react-native-vision-camera (production)
- **Native UI:** @expo/ui (SwiftUI), expo-glass-effect (Liquid Glass)
- **Pose Detection:**
  - iOS: Vision Framework (VNDetectHumanBodyPoseRequest)
  - Android: MediaPipe Pose / BlazePose
- **Styling:** StyleSheet with theme tokens (see STYLE_GUIDE.md)

## Key Features

1. **Torso Detection** - Only triggers on shoulders/hips per World Athletics Rule 164
2. **Ghost Gate** - Background calibration for faster, more accurate detection
3. **Thumb Start** - Solo training mode where lifting thumb starts timer
4. **Sub-Frame Interpolation** - Achieves sub-10ms accuracy even at 60 FPS
5. **Manual Override** - Review and adjust auto-detected times frame-by-frame
6. **Multi-Phone Sync** - Use multiple phones for split times with NTP-style sync

## Project Structure

```
velocity-gate/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── camera/          # CameraPreview, GateLine, PoseOverlay
│   │   ├── timing/          # TimerDisplay, StartButton, ResultCard
│   │   └── ui/              # Button, Card, GlassCard, GlassButton, Header, ErrorBoundary
│   ├── screens/             # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── TimerScreen.tsx
│   │   ├── ResultsScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Core libraries
│   │   ├── timing/          # TimingEngine, GhostGate
│   │   ├── pose/            # PoseDetector, TorsoTracker
│   │   └── sync/            # TimeSync, DeviceDiscovery
│   ├── stores/              # Zustand state stores
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   └── constants/           # Theme and config constants
├── App.tsx                  # Root component with navigation
├── STYLE_GUIDE.md          # Design system reference
├── ACTIVITY_LOG.md         # Development progress log
├── PRD.md                  # Product requirements
└── TECHNICAL_SPEC.md       # Technical specifications
```

## Development Commands

```bash
# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Type checking
npx tsc --noEmit

# Linting
npx eslint .

# Run tests
npm test
```

## Architecture Notes

### Timing Precision
- iOS: Use `mach_continuous_time()` for nanosecond precision
- Android: Use `SystemClock.elapsedRealtimeNanos()` for monotonic timestamps
- Never use `Date.now()` for timing - it's not monotonic

### Pose Detection Pipeline
1. Ghost Gate background subtraction (if calibrated)
2. Crop frame to motion region
3. Run pose detection on cropped region
4. Extract torso landmarks (11, 12, 23, 24)
5. Calculate crossing point with lean-adaptive weighting
6. Apply sub-frame interpolation

### Start Methods
- **Coach Tap:** Coach taps button to start timer
- **Thumb Start:** Athlete holds thumb, lifts to start
- **Audio Detection:** Detect starting gun sound
- **External Gate:** Bluetooth sync with timing gates

## Current Phase

**Phase 1: MVP Foundation** ✅ COMPLETE
- [x] Expo project setup
- [x] Basic navigation (tabs + stack)
- [x] Camera preview with permissions
- [x] Simple timing (coach tap start)
- [x] Results display
- [x] Settings screen
- [x] Core libraries (timing, pose, sync)

**Phase 2: Enhanced Timing** ✅ COMPLETE
- [x] Ghost Gate calibration flow
- [x] Session setup screen
- [x] Athlete management
- [x] Result editing/review
- [x] Error boundaries
- [x] iOS Liquid Glass UI components

**Phase 3: Production Polish** (Current)
- [ ] End-to-end testing
- [ ] Production build with native features
- [ ] SwiftUI native components
- [ ] Performance optimization

---

## MANDATORY: Style Guide Reference

**⚠️ CRITICAL: All styling MUST follow `STYLE_GUIDE.md`**

### Colors
- NEVER hardcode hex values in components
- ALWAYS import from `src/constants/theme.ts`
- Use semantic color tokens (e.g., `colors.timing.ready` not `#22C55E`)

### Typography
- Use typography tokens from theme
- Timer displays: `fontVariant: ['tabular-nums']`
- All font sizes from `typography.fontSize`

### Spacing
- Use spacing tokens: `spacing.xs`, `spacing.sm`, etc.
- Never use arbitrary pixel values

### Implementation
```typescript
// ✅ CORRECT
import { colors, spacing, typography } from '../constants/theme';
style={{ backgroundColor: colors.gray[800], padding: spacing.md }}

// ❌ WRONG - Never do this
style={{ backgroundColor: '#1E293B', padding: 16 }}
```

---

## MANDATORY: Activity Log

**⚠️ CRITICAL: Update `ACTIVITY_LOG.md` after every significant milestone**

After completing important work:
1. Open `ACTIVITY_LOG.md`
2. Add entry under current date
3. Document:
   - What was completed
   - Files changed/created
   - Dependencies added/removed
   - Any issues encountered
   - Next steps

This ensures continuity between sessions and tracks project progress.

---

## Important Reference Files

| File | Purpose |
|------|---------|
| `STYLE_GUIDE.md` | All colors, typography, spacing, components |
| `ACTIVITY_LOG.md` | Development progress tracking |
| `PRD.md` | Full product requirements |
| `TECHNICAL_SPEC.md` | Technical implementation details |
| `src/constants/theme.ts` | Theme token implementations |
| `src/types/index.ts` | All TypeScript types |

---

## Notes for Claude

### Must Follow
- **Always use theme tokens** - Never hardcode colors/sizes
- **Update activity log** - After every significant change
- **Type safety** - Use types from `src/types/`
- **Monotonic clocks** - Never use `Date.now()` for timing

### Technical Requirements
- Torso detection is critical - never trigger on arms/hands/feet
- Ghost Gate calibration dramatically improves performance
- Test on real devices for accurate performance metrics
- Frame rate affects timing accuracy - 120 FPS recommended for production

### Code Style
- Components in PascalCase
- Hooks start with `use`
- Types in PascalCase, interfaces preferred
- Keep components focused and small
- Extract reusable logic into hooks

### Glass UI Pattern
For iOS 26+ Liquid Glass effects:
```typescript
import { Platform } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { GlassCard, GlassButton, Card, Button } from '../components/ui';

// Check availability (iOS 26+ with dev build required)
const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();

// Use conditionally
const CardComponent = useGlassUI ? GlassCard : Card;
```
