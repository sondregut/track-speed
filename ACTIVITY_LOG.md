# Track Speed Activity Log

This file tracks all development progress and completed work. **Update this log after every significant milestone.**

---

## 2026-01-07

### Session 14: Finish Photo Capture & Distance Configuration

#### Completed Tasks

**1. Finish Photo Capture** (`src/screens/TimerScreen.tsx`)
- Added camera ref for photo capture functionality
- Implemented `captureFinishPhoto()` function using react-native-vision-camera's `takeSnapshot()`
- Uses expo-file-system new API (`File`, `Directory`, `Paths` classes)
- Saves photos to `documents/photos/` directory
- Automatically captures photo when timer stops
- Updates result with photo URI using `updateResult()`
- Photos display in `RunResultScreen` instead of placeholder

**2. Distance Configuration** (`src/screens/TimerScreen.tsx`)
- Added `DISTANCE_OPTIONS` constant: 10, 20, 30, 40, 50, 60, 100 meters
- Added `selectedDistance` state with default of 40m
- Created distance selector button with current distance display
- Implemented distance picker modal with tap-to-select options
- Distance is passed to `stopTimer()` and stored with results
- Distance is used to calculate velocity (m/s) for each run
- Disabled distance change while timer is running

#### Technical Details
- Uses `takeSnapshot()` for faster capture (no flash, no shutter sound)
- Photo files named: `finish_{resultId}_{timestamp}.jpg`
- Files saved with 85% JPEG quality
- Distance selector disabled during active runs to prevent accidental changes

#### Files Modified
- `src/screens/TimerScreen.tsx` - Added photo capture and distance picker

---

### Session 13: Simplified Session Setup - Freelap-Style Wizard

#### Completed Tasks

**1. New Types for Simplified Setup** (`src/types/index.ts`)
- Added `SimpleStartMethod` type: `'sound' | 'thumb' | 'gate'`
- Added `PhoneRole` type: `'start' | 'finish' | 'lap' | 'start_finish'`
- Added `QuickSetupConfig` interface for simplified session configuration
- Added helper functions: `getMinPhonesForStartMethod()`, `isStartFinishPhone()`
- Updated navigation types to support `quickSetup` param on Timer screen

**2. Setup Wizard Components** (`src/components/setup/`)
- Created `StartMethodPicker.tsx` - Choose how to start the timer:
  - Sound (1 phone): Clap/gun starts, run through same phone to finish
  - Thumb (2+ phones): Hold thumb on start phone, run through finish phone
  - Gate (2+ phones): Run through start gate, then finish gate
- Created `GateCountPicker.tsx` - Configure number of gates and distances:
  - Dynamic gate count (+/-) based on start method
  - Finish distance selection (30, 40, 50, 60, 100m)
  - Lap gate distance inputs with validation
  - Visual gate layout diagram
- Created `PhoneConnector.tsx` - Connect and assign phones to gates:
  - This phone role selector
  - Gate assignments display
  - Bluetooth device scanning and connection
  - Device-to-role assignment

**3. Rewrote SessionSetupScreen** (`src/screens/SessionSetupScreen.tsx`)
- Complete rewrite with 3-step wizard flow:
  1. Choose start method
  2. Configure gates
  3. Connect phones (if multi-phone)
- Step indicator with progress dots
- Automatic step adjustment based on configuration
- Passes `QuickSetupConfig` to Timer screen

#### Files Created
- `src/components/setup/StartMethodPicker.tsx`
- `src/components/setup/GateCountPicker.tsx`
- `src/components/setup/PhoneConnector.tsx`
- `src/components/setup/index.ts`

#### Files Modified
- `src/types/index.ts` - Added SimpleStartMethod, PhoneRole, QuickSetupConfig
- `src/types/navigation.ts` - Added quickSetup to Timer params
- `src/screens/SessionSetupScreen.tsx` - Complete rewrite

#### Start Method Logic
| Method | Min Phones | How it works |
|--------|-----------|--------------|
| Sound | 1 | Clap starts timer, run through same phone to finish |
| Thumb | 2 | Hold thumb on start phone, run through finish phone |
| Gate | 2 | Run through start gate phone, then finish gate phone |

#### Next Steps
- Update TimerScreen to use QuickSetupConfig for role-based UI
- Test new setup flow with real multi-phone scenarios

---

### Session 12: Bluetooth Multi-Phone Sync - UI Components & Results Aggregation

#### Completed Tasks

**1. Role-Specific Timer UI Components** (`src/components/timing/`)
- Created `SyncRoleIndicator.tsx` - Shows device role badge (Start/Finish/Split) with connection status
- Created `SyncStatusOverlay.tsx` - Displays connected devices, sync accuracy, and last timing event
- Created `GateControls.tsx` - Role-specific controls:
  - Start Gate: Large START button, broadcasts to connected devices
  - Finish Gate: Shows detection state, manual stop override
  - Split Gate: Records intermediate times
- Created `GateAssignmentCard.tsx` - Shows/manages device-to-gate assignments

**2. ResultsAggregator System** (`src/lib/sync/`)
- Created `ResultsAggregator.ts` - Aggregates timing from multiple gates:
  - Collects events from start, finish, and split gates
  - Calculates split times and segment velocities
  - Handles out-of-order event arrival
  - Generates comprehensive TimingResult with splits
  - Provides session statistics (best time, average, consistency)
- Created `useResultsAggregator.ts` hook for React integration

**3. Updated Exports**
- Updated `src/components/timing/index.ts` with new components
- Updated `src/lib/sync/index.ts` with ResultsAggregator exports
- Updated `src/hooks/index.ts` with useResultsAggregator export

#### Files Created
- `src/components/timing/SyncRoleIndicator.tsx`
- `src/components/timing/SyncStatusOverlay.tsx`
- `src/components/timing/GateControls.tsx`
- `src/components/timing/GateAssignmentCard.tsx`
- `src/lib/sync/ResultsAggregator.ts`
- `src/hooks/useResultsAggregator.ts`

#### Files Modified
- `src/components/timing/index.ts`
- `src/lib/sync/index.ts`
- `src/hooks/index.ts`

#### Technical Notes
- Role-specific UI adapts based on `BluetoothDeviceRole`: 'start' | 'finish' | 'lap'
- ResultsAggregator uses timeout system for incomplete runs (default 60s)
- GateAssignmentCard allows assigning discovered Bluetooth devices to specific gate positions
- SessionSetupScreen already has comprehensive multi-gate configuration UI

#### Next Steps
- Test multi-phone sync with real devices
- Integrate ResultsAggregator with TimerScreen
- Add visual split time display during runs

---

## 2026-01-06

### Session 1: Project Setup & Core Architecture

#### Completed Tasks

**1. Project Structure Setup**
- Created folder structure: `src/{components, screens, hooks, lib, stores, types, utils, constants}`
- Organized by feature for scalability

**2. Type Definitions** (`src/types/`)
- Created `index.ts` with all core types:
  - `TimingResult`, `Session`, `Athlete`
  - `PoseLandmark`, `PoseLandmarks`, `TorsoPosition`
  - `CameraConfig`, `CameraPosition`
  - `GhostGateCalibration`, `CalibrationQuality`
  - `TimingState`, `StartMethod`
- Created `navigation.ts` with type-safe navigation params

**3. Theme & Constants** (`src/constants/`)
- Created `theme.ts` with complete design system:
  - Color palette (primary, gray, semantic, timing)
  - Typography scale
  - Spacing system
  - Border radius tokens
  - Shadow definitions

**4. State Management** (`src/stores/`)
- Created Zustand stores with persistence:
  - `timingStore.ts` - Timer state, results, elapsed time
  - `sessionStore.ts` - Sessions, athletes, persistence to AsyncStorage
  - `settingsStore.ts` - All app settings with defaults

**5. Utility Functions** (`src/utils/`)
- `timing.ts` - Time formatting, velocity calculation, sub-frame interpolation, confidence scoring
- `formatting.ts` - Date formatting, distance, ordinals, pluralization

**6. Custom Hooks** (`src/hooks/`)
- `useTimer.ts` - Timer display with requestAnimationFrame
- `useKeepAwake.ts` - Screen wake lock
- `useHaptics.ts` - Haptic feedback
- `useSound.ts` - Audio feedback

**7. UI Components** (`src/components/ui/`)
- `Button.tsx` - Primary, secondary, outline, ghost, danger variants
- `Card.tsx` - Default, elevated, outlined variants
- `IconButton.tsx` - Circular icon buttons
- `Header.tsx` - Screen header with safe area support

**8. Camera Components** (`src/components/camera/`)
- `CameraPreview.tsx` - expo-camera wrapper with permissions
- `GateLine.tsx` - Virtual finish line overlay
- `PoseOverlay.tsx` - SVG skeleton visualization

**9. Timing Components** (`src/components/timing/`)
- `TimerDisplay.tsx` - Large timer with state colors
- `StartButton.tsx` - Circular start/stop/reset button
- `ResultCard.tsx` - Result display with confidence badges

**10. Screens** (`src/screens/`)
- `HomeScreen.tsx` - Dashboard with quick start, stats, recent sessions
- `TimerScreen.tsx` - Full-screen camera + timer
- `ResultsScreen.tsx` - Results list with stats summary
- `SettingsScreen.tsx` - All app settings organized by category

**11. Navigation** (`App.tsx`)
- React Navigation setup with:
  - Bottom tab navigator (Home, Results, Settings)
  - Stack navigator for modal screens (Timer)
  - Dark theme configuration
  - Type-safe navigation

**12. Core Libraries** (`src/lib/`)

*Timing Engine:*
- `TimingEngine.ts` - Core timing logic with sub-frame interpolation
- `GhostGate.ts` - Background subtraction for motion detection

*Pose Detection:*
- `PoseDetector.ts` - Abstract detector + mock for Expo Go
- `TorsoTracker.ts` - Kalman filtering for smooth tracking

*Multi-phone Sync:*
- `TimeSync.ts` - NTP-style clock synchronization
- `DeviceDiscovery.ts` - mDNS device discovery placeholder

**13. Documentation**
- Created `STYLE_GUIDE.md` - Complete design system reference
- Created `ACTIVITY_LOG.md` - This file

#### Dependencies Installed
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `@react-navigation/bottom-tabs`
- `react-native-screens`
- `react-native-safe-area-context`
- `zustand`
- `@react-native-async-storage/async-storage`
- `expo-camera`
- `react-native-svg`

#### Notes
- App runs in Expo Go for MVP testing
- Production build needed for:
  - react-native-vision-camera (120fps+)
  - Native pose detection (iOS Vision, Android MediaPipe)
  - Native monotonic timing

---

### Session 2: Core Libraries & Documentation

#### Completed Tasks

**1. Timing Engine** (`src/lib/timing/`)
- `TimingEngine.ts` - Core timing class with:
  - State management (idle, ready, running, stopped)
  - Frame processing pipeline
  - Sub-frame interpolation for precise crossing detection
  - Gate crossing detection logic
- `GhostGate.ts` - Background subtraction for motion detection:
  - Calibration with multiple frames
  - Motion region detection
  - Adaptive background updating

**2. Pose Detection Module** (`src/lib/pose/`)
- `PoseDetector.ts` - Abstract pose detection interface:
  - TORSO_LANDMARKS constants (shoulders: 11, 12; hips: 23, 24)
  - MockPoseDetector for Expo Go testing
  - Factory function for platform-specific detectors
- `TorsoTracker.ts` - Position tracking with:
  - Exponential smoothing
  - Velocity estimation
  - Position prediction between frames

**3. Multi-phone Sync Module** (`src/lib/sync/`)
- `TimeSync.ts` - NTP-style clock synchronization:
  - Offset calculation using NTP algorithm
  - Round-trip time measurement
  - Median filtering for stability
- `DeviceDiscovery.ts` - Device discovery placeholder:
  - mDNS service registration structure
  - Peer device management

**4. Session Setup Screen** (`src/screens/`)
- `SessionSetupScreen.tsx` - New session configuration:
  - Session name input
  - Location input
  - Distance selection (60m, 100m, 200m, 400m)
  - Start method selection with radio buttons
  - Session preview card

**5. Navigation Updates**
- Added `SessionSetup` route to stack navigator
- Updated HomeScreen to navigate to SessionSetup
- Added type-safe navigation params in `src/types/navigation.ts`

**6. Documentation**
- Created `STYLE_GUIDE.md` - Complete design system:
  - All color tokens with hex values
  - Typography scale
  - Spacing system
  - Border radius tokens
  - Component style specifications
- Updated `CLAUDE.md` with:
  - Mandatory style guide reference
  - Activity log requirements
  - Phase 1 marked as complete
  - Phase 2 roadmap

#### Files Changed
- `App.tsx` - Added SessionSetup route
- `src/screens/index.ts` - Export SessionSetupScreen
- `src/screens/HomeScreen.tsx` - Navigate to SessionSetup
- `src/types/index.ts` - Added navigation type exports
- `CLAUDE.md` - Major updates with style guide and activity log sections

#### Next Steps (Phase 2)
- Ghost Gate calibration flow screen
- Athlete management (add, edit, select)
- Result editing/review screen
- Improved error handling

---

### Session 3: Phase 2 Features

#### Completed Tasks

**1. Ghost Gate Calibration Screen** (`src/screens/GhostGateCalibrationScreen.tsx`)
- Multi-step calibration flow (intro → positioning → calibrating → complete)
- Animated progress bar during calibration
- Quality assessment display
- Camera preview with gate line overlay

**2. Athlete Management Screen** (`src/screens/AthleteListScreen.tsx`)
- List all athletes with avatar and details
- Add new athletes via modal
- Edit/delete existing athletes (long press)
- Selection mode for assigning to timing sessions
- Personal best display

**3. Result Detail Screen** (`src/screens/ResultDetailScreen.tsx`)
- Detailed view of timing result
- Edit time with manual override
- Performance stats (velocity, pace, km/h)
- Technical details (start method, frame number)
- Delete result functionality

**4. Navigation Updates**
- Added routes for all new screens in `App.tsx`
- Added Quick Actions in Settings screen:
  - "Manage Athletes" link
  - "Calibrate Ghost Gate" link
- Updated tab icons

**5. Bug Fixes**
- Fixed runtime error in `theme.ts` structure
- Fixed `global.nativeModuleProxy` issue in PoseDetector
- Fixed navigation types circular dependency
- Added proper SafeArea bottom padding to all screens

#### Files Created
- `src/screens/GhostGateCalibrationScreen.tsx`
- `src/screens/AthleteListScreen.tsx`
- `src/screens/ResultDetailScreen.tsx`

#### Files Modified
- `App.tsx` - Added new routes
- `src/screens/index.ts` - Export new screens
- `src/screens/SettingsScreen.tsx` - Added Quick Actions section
- `src/constants/theme.ts` - Fixed structure
- `src/lib/pose/PoseDetector.ts` - Fixed global check
- `src/lib/index.ts` - Disabled exports to prevent load errors

#### Phase 2 Status
- [x] Ghost Gate calibration flow
- [x] Athlete management
- [x] Result detail/edit screen
- [ ] Improved error handling
- [ ] Connect result detail to results list

---

### Session 4: Navigation & Polish

#### Completed Tasks

**1. Results to Detail Navigation**
- Connected ResultsScreen to ResultDetailScreen
- Tapping a result now navigates with `resultId` param
- Full result viewing/editing flow now works

**2. Error Boundaries**
- Created `ErrorBoundary` component with retry functionality
- Wrapped root App component to catch unhandled errors
- Displays user-friendly error message with "Try Again" button

#### Files Created
- `src/components/ui/ErrorBoundary.tsx` - React error boundary component

#### Files Modified
- `src/screens/ResultsScreen.tsx` - Added navigation.navigate to ResultDetail
- `src/components/ui/index.ts` - Export ErrorBoundary
- `App.tsx` - Wrapped app with ErrorBoundary

**3. iOS Liquid Glass UI Integration**
- Installed `@expo/ui`, `expo-glass-effect`, `expo-haptics`, `expo-av`
- Created `GlassCard` component with iOS 26+ Liquid Glass effect and fallback
- Created `GlassButton` component with glass blur and tint colors
- Updated HomeScreen to use Glass UI when available
- Platform detection for iOS 26+ using `isLiquidGlassAvailable()`

#### Files Created
- `src/components/ui/GlassCard.tsx` - Glass effect card component
- `src/components/ui/GlassButton.tsx` - Glass effect button component

#### Additional Files Modified
- `src/components/ui/index.ts` - Export GlassCard, GlassButton
- `src/components/ui/Card.tsx` - Accept StyleProp<ViewStyle> for style arrays
- `src/screens/HomeScreen.tsx` - Conditional Glass UI usage
- `src/utils/timing.ts` - Added `0` to decimals type union

#### Dependencies Added
- `@expo/ui` - SwiftUI components for React Native
- `expo-glass-effect` - iOS Liquid Glass effects
- `expo-haptics` - Native haptic feedback
- `expo-av` - Audio/video playback

#### Notes
- Liquid Glass requires iOS 26+ and development build (not Expo Go)
- Components gracefully fall back to standard styling on unsupported platforms
- SwiftUI components available for future native UI enhancements

---

### Session 5: Auto-Detection Integration

#### Completed Tasks

**1. Haptics & Sound Implementation**
- Implemented `useHaptics` hook with expo-haptics
  - Impact feedback (light, medium, heavy)
  - Notification feedback (success, warning, error)
  - Selection feedback
- Implemented `useSound` hook with expo-av
  - Generates tones programmatically (no external files needed)
  - Different frequencies for start, stop, beep, countdown

**2. Pose Detection Integration**
- Created `usePoseDetection` hook
  - Initializes MockPoseDetector (swappable for native in production)
  - Manages TorsoTracker for smooth position tracking
  - Processes frames and updates position state
  - Returns confidence and FPS metrics

**3. Auto-Timing Integration**
- Created `useAutoTiming` hook
  - Connects pose detection to TimingEngine
  - Detects gate line crossings automatically
  - Falls back to manual timing when disabled
  - Provides haptic/audio feedback on crossing

**4. TimerScreen Updates**
- Integrated auto-timing with TimerScreen
  - Uses useAutoTiming when auto-detection enabled
  - Falls back to useTimer for manual timing
  - Shows auto-detection status indicator
  - Displays FPS when detection active
  - Shows auto-detected results with confidence

#### Files Created
- `src/hooks/usePoseDetection.ts` - Pose detection management
- `src/hooks/useAutoTiming.ts` - Auto-timing with crossing detection

#### Files Modified
- `src/hooks/useHaptics.ts` - Full expo-haptics implementation
- `src/hooks/useSound.ts` - Full expo-av implementation with tone generation
- `src/hooks/index.ts` - Export new hooks
- `src/screens/TimerScreen.tsx` - Auto-timing integration + UI indicators

#### Architecture Notes
- **MockPoseDetector** currently generates simulated pose data for testing
- In production build, swap for native detectors:
  - iOS: VisionPoseDetector (VNDetectHumanBodyPoseRequest)
  - Android: MediaPipePoseDetector (BlazePose)
- Frame capture requires react-native-vision-camera (development build)
- All timing components are connected and ready for real pose data

#### Dependencies Confirmed
- expo-haptics: ~15.0.8
- expo-av: ~16.0.8
- expo-glass-effect: ~0.1.8
- @expo/ui: ~0.2.0-beta.9

#### Next Steps
- Create development build for native features
- Implement native pose detectors (iOS Vision, Android MediaPipe)
- Add react-native-vision-camera for real frame capture
- Production testing on real devices

---

### Session 6: Glass UI Completion & TypeScript Cleanup

#### Completed Tasks

**1. Glass UI Across All Screens**
- Updated SettingsScreen with GlassCard (all sections)
- Updated ResultDetailScreen with GlassCard
- Updated SessionSetupScreen with GlassCard (preview card)
- Updated AthleteListScreen with GlassCard
- Updated GhostGateCalibrationScreen with GlassCard
- All components use `useTheme()` context for dynamic colors
- Proper dark/light mode support throughout

**2. Theme Context Type Fixes**
- Fixed ThemeContext.tsx type incompatibility between lightColors/darkColors
- Created union types for ThemeColors and ThemeShadows
- App.tsx now spreads DefaultTheme for React Navigation 7 compatibility

**3. Package Cleanup**
- Removed deprecated expo-av (replaced by expo-audio)
- Removed expo-gl (causing peer dependency conflicts)
- Removed expo-video (not yet needed, had conflicts)
- All dependencies now install cleanly with --legacy-peer-deps

**4. GlassCard Component Update**
- Changed style prop type from ViewStyle to StyleProp<ViewStyle>
- Allows style arrays with conditional values (false | ViewStyle)

**5. Linter Integration**
- All screens updated to use `useTheme()` hook from contexts
- Dynamic color application for dark/light mode support
- Removed static color imports where theme context is used

#### Files Modified
- `src/contexts/ThemeContext.tsx` - Fixed color types
- `src/components/ui/GlassCard.tsx` - StyleProp type
- `src/screens/SettingsScreen.tsx` - Full Glass UI + theme
- `src/screens/ResultDetailScreen.tsx` - Glass UI
- `src/screens/SessionSetupScreen.tsx` - Glass UI + theme
- `src/screens/AthleteListScreen.tsx` - Glass UI
- `src/screens/GhostGateCalibrationScreen.tsx` - Glass UI
- `App.tsx` - Navigation theme fix
- `package.json` - Removed deprecated packages

#### Dependencies Removed
- expo-av (deprecated, replaced by expo-audio)
- expo-gl (peer dependency conflicts)
- expo-video (not yet needed)

#### Current Package Versions
- expo: ~54.0.30
- expo-audio: ~1.1.1
- expo-glass-effect: ~0.1.8
- expo-haptics: ~15.0.8
- react-native-vision-camera: ^4.7.3
- react-native-worklets-core: ^1.6.2
- react-native-reanimated: ~4.1.1

#### AI Integration Status
- **Pose Detection**: Architecture complete with MockPoseDetector
  - `src/lib/pose/PoseDetector.ts` - Abstract detector interface
  - `src/lib/pose/TorsoTracker.ts` - Position smoothing/tracking
  - `src/hooks/usePoseDetection.ts` - React hook for pose detection
  - `src/hooks/useAutoTiming.ts` - Connects pose to timing engine
- **Production Implementation Required**:
  - iOS: VNDetectHumanBodyPoseRequest (Vision framework)
  - Android: MediaPipe Pose / BlazePose
  - Requires development build (not Expo Go)

#### Multi-Phone Sync Status
- **Infrastructure Ready**:
  - `src/lib/sync/TimeSync.ts` - NTP-style clock synchronization
  - `src/lib/sync/DeviceDiscovery.ts` - mDNS device discovery placeholder
- **UI Not Yet Implemented**: No sync UI in screens yet
- **Production Implementation Required**:
  - Actual mDNS/Bonjour implementation for device discovery
  - WebSocket or TCP for sync messages
  - UI for connecting/managing paired devices

#### Next Steps
1. Create iOS development build (`npx expo run:ios`)
2. Implement native VisionPoseDetector for iOS
3. Test Glass UI on iOS 26+ device
4. Add multi-phone sync UI to settings/session screens
5. Implement actual device discovery and pairing

---

### Session 7: Multi-Phone Sync & Photo Finish Features

#### Completed Tasks

**1. Multi-Phone Timing Enhancements**
- Updated `SplitConfig` type to support custom gate configurations
- Added `GateConfig` interface with role, distance_m, deviceId, deviceName
- Changed `DeviceRole` from 'split' to 'lap' for consistency with gate naming
- Added gate distance tracking to `TimingEvent` interface
- Updated `SyncConnection` to track and broadcast gate distances
- Updated `useSyncConnection` hook with `setGateDistance` function

**2. Custom Gate Editor in SessionSetupScreen**
- Multi-phone timing toggle with custom gate configuration
- Add/remove lap gates at any distance
- Quick add buttons (10m, 20m, 30m, 40m)
- Finish gate distance selector (30m, 40m, 50m, 60m, 100m)
- Gate preview showing Start/Lap/Finish positions with badges
- Link to DeviceSyncScreen for connecting phones to gates

**3. DeviceSyncScreen Gate Assignment**
- Shows configured gates from current session (if available)
- Select which gate position this phone will be at
- Shows which gates are already assigned to other devices
- Falls back to manual role selection if no session configured
- Custom distance input for manual mode
- Updated instructions based on session configuration

**4. Sprint Timing System Overhaul (Photo Finish style)**
- New `SessionType`: 'flying' | 'standing' | 'block_start'
- Flying start config with timed zone + fly-in distance
- Standing/block start with total distance selection
- Velocity calculation from distance/time
- Created `src/utils/velocity.ts` with conversion functions
- Unit preferences: m/s, km/h, mph, metric/imperial

**5. Start Methods Update (Photo Finish style)**
- Changed start methods to match Photo Finish naming:
  - `ready_set_go` - Coach says commands, taps on "Go"
  - `three_two_one` - Countdown then tap to start
  - `touch` - Touch anywhere, release to start
  - `sound_detection` - Clap or starting gun triggers timer

**6. Sound Detection Implementation**
- Installed `expo-audio` (replaced deprecated expo-av)
- Created `useSoundDetection` hook with:
  - Microphone level monitoring
  - Threshold-based sound spike detection
  - Debouncing to prevent false triggers
  - Audio level visualization
- Integrated sound detection into TimerScreen
- Auto-starts listening when in ready state with sound_detection start method

**7. Athlete Queue & Timer UI Enhancements**
- Current athlete display showing who's running
- Athlete queue state management
- Retry run button - reset timer, keep same athlete
- Next athlete button - reset and advance to next in queue
- Sound detection status indicator with audio level bar

**8. Results & Velocity Display**
- Updated ResultCard to show max velocity in user's preferred unit
- Session type badge display
- Distance and fly-in info for flying starts

#### Files Created
- `src/utils/velocity.ts` - Velocity calculation and conversion utilities
- `src/hooks/useSoundDetection.ts` - Sound/clap detection for timer start

#### Files Modified
- `src/types/index.ts` - SessionType, StartMethod, GateConfig, GateRole, VelocityUnit, DistanceUnit
- `src/lib/sync/SyncConnection.ts` - Gate distance in TimingEvent, DeviceRole changed
- `src/lib/sync/DeviceDiscovery.ts` - DeviceRole updated to use 'lap'
- `src/hooks/useSyncConnection.ts` - gateDistance state and setGateDistance
- `src/hooks/index.ts` - Export useSoundDetection
- `src/stores/settingsStore.ts` - Units settings, updated default start method
- `src/stores/sessionStore.ts` - Updated default start method
- `src/screens/SessionSetupScreen.tsx` - Complete redesign with gate editor
- `src/screens/DeviceSyncScreen.tsx` - Gate assignment UI
- `src/screens/SettingsScreen.tsx` - Unit preferences (velocity, distance)
- `src/screens/TimerScreen.tsx` - Sound detection, athlete queue, retry/next buttons
- `src/components/timing/ResultCard.tsx` - Velocity display

#### Dependencies Changed
- Removed: `expo-av` (deprecated)
- Added: `expo-audio@1.1.1` (current recommended audio package)

#### Architecture Notes
- WiFi-based sync chosen over Bluetooth for better range (100m+) and precision (sub-5ms)
- Bluetooth could be added as alternative for remote locations
- Sound detection uses `useAudioRecorderState` for real-time metering
- Gate distances are now tracked end-to-end from session config to timing events

#### Photo Finish Feature Comparison
| Feature | Photo Finish | Track Speed |
|---------|--------------|-------------|
| Start Types | 5 types | 4 types (similar) |
| Flying Start | ✓ | ✓ with fly-in config |
| Velocity Display | Limited | Full (m/s, km/h, mph) |
| Multi-Phone | Multi Mode | Flexible gate positions |
| Athlete Queue | ✓ | ✓ (implemented) |
| Retry/Next | ✓ | ✓ (implemented) |
| Series Mode | ✓ | Pending |
| Sound Detection | ✓ | ✓ (implemented) |

#### Remaining Items
- Series/interval training mode (multiple runs with breaks)
- Improved results table view with splits columns
- Bluetooth as alternative to WiFi sync
- Flying start detection based on fly-in distance

---

### Session 8: Profile Tab & Navigation Restructure

#### Completed Tasks

**1. Profile Screen & Tab Navigation**
- Created `ProfileScreen.tsx` with:
  - Profile header with avatar, name, subtitle
  - Statistics card (sessions, runs, athletes)
  - Personal bests section by distance
  - Top speed display with velocity formatting
  - Quick actions (Manage Athletes, Calibrate Ghost Gate, Multi-Phone Sync)
  - Recent sessions list
  - App info (version)
- Settings icon in header navigates to Settings screen

**2. Navigation Restructure**
- Changed bottom tabs from Home/Results/Settings to Home/Results/Profile
- Moved Settings from tab to stack screen (accessible via Profile header icon)
- Updated `RootStackParamList` and `TabParamList` types

**3. Settings Screen Updates**
- Added back button for stack navigation (no longer a tab)
- Added `backButton` style to StyleSheet

**4. TypeScript Error Fixes**
- Fixed `formatTime(time, 2)` → `formatTime(time, { decimals: 2 })` in ProfileScreen
- Fixed type inference in `useBluetoothSync` callback - added explicit `BluetoothConnectionState` type

#### Files Created
- `src/screens/ProfileScreen.tsx` - New profile screen with stats and quick actions

#### Files Modified
- `App.tsx` - Navigation restructure (Profile tab, Settings stack screen)
- `src/screens/index.ts` - Export ProfileScreen
- `src/screens/SettingsScreen.tsx` - Added back button and style
- `src/hooks/useBluetoothSync.ts` - Fixed callback type annotation

#### TypeScript Status
- All TypeScript errors resolved
- `npx tsc --noEmit` passes cleanly

---

### Session 9: Native iOS Vision Pose Detection

#### Completed Tasks

**1. Removed TensorFlow.js**
- Uninstalled @tensorflow/tfjs, @tensorflow/tfjs-react-native, @tensorflow-models/pose-detection
- These had peer dependency conflicts and were slower (~15-30fps)

**2. Created Native iOS Vision Frame Processor Plugin**
- `plugins/vision-pose-detection/ios/VisionPoseFrameProcessor.swift`
  - Uses `VNDetectHumanBodyPoseRequest` for pose detection
  - Extracts 4 torso landmarks (shoulders + hips) per World Athletics Rule 164
  - Calculates lean-adaptive torso center for sprint finish detection
  - Returns normalized coordinates (0-1) with confidence scores
- `plugins/vision-pose-detection/ios/VisionPoseFrameProcessor.m`
  - Registers plugin with VisionCamera as "detectPose"
- `plugins/vision-pose-detection/withVisionPose.js`
  - Expo config plugin to copy native files during prebuild

**3. Created TypeScript Integration**
- `src/lib/pose/VisionPoseDetector.ts`
  - Type definitions for pose results
  - `isVisionPoseAvailable()` - Check if native detection available
  - `detectGateCrossing()` - Detect when torso crosses gate line
  - `interpolateCrossingTime()` - Sub-frame precision timing
  - `calculateTorsoVelocity()` - Velocity from torso movement
- `src/hooks/useVisionPose.ts`
  - Complete React hook for pose detection flow
  - Manages frame processing, tracking, gate crossing detection
  - Calls `onGateCrossing` callback with precise crossing time

**4. Updated Configuration**
- Added plugin to app.json plugins array
- Updated exports in src/lib/pose/index.ts
- Updated exports in src/hooks/index.ts

#### How Auto-Detection Works

```
Camera (60-120fps) → Vision Framework → Torso Landmarks → Gate Crossing → Timer Stop
                     VNDetectHuman      (shoulders+hips)   (sub-frame
                     BodyPoseRequest                        interpolation)
```

1. **Camera captures frames** via react-native-vision-camera
2. **Vision framework detects pose** - finds 4 torso points
3. **Calculate torso center** - weighted for sprint lean angle
4. **Track gate crossing** - when center crosses virtual "gate line"
5. **Sub-frame interpolation** - precise timing between frames

#### Files Created
- `plugins/vision-pose-detection/ios/VisionPoseFrameProcessor.swift`
- `plugins/vision-pose-detection/ios/VisionPoseFrameProcessor.m`
- `plugins/vision-pose-detection/withVisionPose.js`
- `src/lib/pose/VisionPoseDetector.ts`
- `src/hooks/useVisionPose.ts`

#### Files Modified
- `package.json` - Removed TensorFlow.js packages
- `app.json` - Added vision-pose-detection plugin
- `src/lib/pose/index.ts` - Export VisionPoseDetector
- `src/hooks/index.ts` - Export useVisionPose

#### Next Steps
1. Run `npx expo prebuild --platform ios` to generate native project
2. Run `npx expo run:ios` to build development client
3. Test pose detection on real iOS device
4. Integrate useVisionPose with TimerScreen

---

### Session 10: Multi-Device Sync & Series Training

#### Completed Tasks

**1. Dark Mode Theme Update**
- Updated dark mode background to navy/blue-gray (#222937)
- White text for high contrast
- Updated all screens to use `useTheme` hook
- Camera overlay screens (Timer, GhostGate) use fixed dark colors for visibility

**2. Bluetooth Multi-Device Support**
- Changed `connectedDevice` to `connectedDevices` Map (supports 5 simultaneous)
- Added `connectMultiple()` to connect to multiple devices at once
- Added `disconnectDevice()` to disconnect specific device
- Broadcast timing events to all connected devices in parallel
- Added `getDeviceByRole()` to find device by role
- Added `getConnectionCount()` and `isConnected()` helpers

**3. Series/Interval Training Mode**
- Created types: `SeriesConfig`, `SeriesState`, `SeriesRepResult`, `SeriesSummary`
- Added `sessionType: 'series'` to Session type
- Created `useSeries` hook with:
  - Set and rep tracking
  - Rest countdown timers (between reps and sets)
  - Auto-advance between reps
  - Series summary statistics (avg, best, worst, consistency)
- Created `SeriesSetupScreen` with:
  - Quick presets (Sprint Training, Speed Endurance, Acceleration Work)
  - Custom sets, reps, distance configuration
  - Adjustable rest periods
  - Target time setting
  - Auto-advance toggle
  - Session summary preview
- Added "Series Training" button to HomeScreen

**4. Documentation**
- Created `ROADMAP.md` with comprehensive feature checklist
- Tracks completed vs pending features across all phases

**5. Build Fixes**
- Fixed Vision pose Xcode plugin path (uses `${projectName}/${fileName}`)
- Fixed TypeScript navigation types in SeriesSetupScreen

#### Files Created
- `ROADMAP.md` - Feature tracking document
- `src/hooks/useSeries.ts` - Series state management hook
- `src/screens/SeriesSetupScreen.tsx` - Series configuration UI

#### Files Modified
- `src/constants/theme.ts` - Dark mode colors (#222937 background)
- `src/lib/sync/BluetoothSync.ts` - Multi-device support
- `src/hooks/useBluetoothSync.ts` - Expose multi-device methods
- `src/types/index.ts` - Series types
- `src/screens/HomeScreen.tsx` - Series Training button
- `src/screens/TimerScreen.tsx` - Theme colors
- `src/screens/GhostGateCalibrationScreen.tsx` - Theme colors
- `src/components/ui/ErrorBoundary.tsx` - Use darkColors fallback
- `App.tsx` - SeriesSetup route
- `plugins/vision-pose-detection/withVisionPose.js` - Fixed Xcode paths

#### TypeScript Status
- All TypeScript errors resolved
- `npx tsc --noEmit` passes cleanly
- Expo bundle exports successfully

#### Next Steps
1. Integrate series mode into TimerScreen (rest countdown UI, auto-advance)
2. Test on real iOS device with development build
3. Complete remaining ROADMAP items

---

### Session 11: EAS Build Fixes

#### Completed Tasks

**1. Resolved VisionCamera + Reanimated Conflict**
- VisionCamera v4.x requires New Architecture DISABLED
- Reanimated v4.x requires New Architecture ENABLED
- Solution: Downgrade Reanimated to v3.16.0 (works without new arch)

**2. Fixed expo-doctor Issues**
- Added missing peer dependencies: expo-font, expo-asset, expo-constants, expo-linking
- Removed invalid `deploymentTarget` from ios section (already configured in expo-build-properties)
- Fixed react version to match Expo SDK 54 (19.1.0)

**3. Build Configuration**
- `newArchEnabled: false` for VisionCamera compatibility
- deploymentTarget configured only in expo-build-properties plugin

#### Files Modified
- `package.json` - Downgraded reanimated, added peer deps, fixed react
- `package-lock.json` - Updated dependencies
- `app.json` - Removed duplicate deploymentTarget, newArchEnabled: false

#### Build Status
- TypeScript: Passes (`npx tsc --noEmit`)
- Ready for EAS build retry

#### Notes
- VisionCamera v5 (with new arch support) not yet released
- When v5 releases, can re-enable new architecture and upgrade Reanimated back to v4

---

### Session 12: EAS Build Fix - Reanimated v4 Upgrade

#### Completed Tasks

**1. Fixed 'folly/coro/Coroutine.h' Build Error**
- Root cause: `react-native-reanimated` v3.16.7 incompatible with Expo SDK 54
- Upgraded to `react-native-reanimated` v4.1.1 (required for SDK 54)

**2. Updated Expo Dependencies**
- `expo`: 54.0.30 → 54.0.31
- `react-native-reanimated`: 3.16.7 → 4.1.1

**3. Added Babel Configuration**
- Created `babel.config.js` with `react-native-reanimated/plugin`
- Required for worklet transformation with Vision Camera frame processor

#### Files Changed
- `package.json` - Updated expo and react-native-reanimated versions
- `package-lock.json` - Updated dependency tree
- `babel.config.js` - NEW: Added reanimated babel plugin

#### Build Status
- `npx expo install --check` passes (all dependencies compatible)
- Ready for EAS build retry

#### Notes
- Session 11 suggested downgrading Reanimated to v3, but that caused the folly/coro build error
- The correct fix is upgrading to v4.1.1 as required by Expo SDK 54
- VisionCamera v4.x works with Reanimated v4.x when using `runOnJS` pattern

---

### Session 13: Fix Two Worklet Runtimes Issue

#### Problem
- `global._createSerializableNumber is not a function` error when using VisionCamera frame processor
- Root cause: VisionCamera uses `react-native-worklets-core` runtime, Reanimated 4 uses `react-native-worklets` runtime
- Mixing primitives (runOnJS, useSharedValue) from different runtimes causes serialization errors

#### Solution
- Use ONLY `react-native-worklets-core` primitives inside frame processors
- `Worklets.createRunOnJS()` for calling back to JS thread
- `useSharedValue` from worklets-core (not Reanimated) for worklet-accessible state

#### Completed Tasks

**1. Fixed babel.config.js**
- Removed manual `react-native-reanimated/plugin` (babel-preset-expo handles it)
- Keep only `react-native-worklets-core/plugin` for VisionCamera frame processors

**2. Rewrote useVisionPose.ts**
- Removed all Reanimated imports (runOnJS, useSharedValue, useAnimatedReaction)
- Added imports from `react-native-worklets-core` (Worklets, useSharedValue)
- Created JS callbacks using `Worklets.createRunOnJS()`
- Use worklets-core's `useSharedValue` for worklet-accessible state
- Proper gate crossing detection tracking previous torso position

#### Files Modified
- `babel.config.js` - Simplified to only worklets-core plugin
- `src/hooks/useVisionPose.ts` - Complete rewrite using worklets-core primitives

#### Technical Details
- Two separate worklet runtimes exist in the app:
  - `react-native-worklets-core` (Margelo) - used by VisionCamera
  - `react-native-worklets` (Software Mansion) - used by Reanimated 4
- Frame processors run in VisionCamera's secondary JS runtime
- Must use worklets-core's primitives to call back to main JS thread
- Reanimated's primitives can still be used elsewhere in the app (animations, etc.)

#### Build Status
- TypeScript passes
- Native build succeeds
- Plugin loads: `VisionPose: Native plugin loaded successfully`

#### Next Steps
- Test pose detection on device (point camera at person)
- Verify gate crossing triggers timer stop

---

## Template for Future Entries

```markdown
## YYYY-MM-DD

### Session X: [Session Title]

#### Completed Tasks
- [ ] Task 1
- [ ] Task 2

#### Files Changed
- `path/to/file.ts` - Description

#### Dependencies Added/Removed
- Added: package-name
- Removed: package-name

#### Issues Encountered
- Issue description and resolution

#### Next Steps
- What to work on next
```
