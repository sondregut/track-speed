# Track Speed - Development Roadmap

This document tracks all features and their completion status.

---

## Phase 1: MVP Foundation

| Feature | Status | Notes |
|---------|--------|-------|
| Expo project setup | Done | SDK 54, TypeScript |
| Basic navigation (tabs + stack) | Done | React Navigation 7 |
| Camera preview with permissions | Done | expo-camera + vision-camera |
| Simple timing (coach tap start) | Done | Manual start/stop |
| Results display | Done | List + detail views |
| Settings screen | Done | All categories |
| Core types & stores | Done | Zustand + AsyncStorage |

---

## Phase 2: Enhanced Timing

| Feature | Status | Notes |
|---------|--------|-------|
| Ghost Gate calibration flow | Done | Multi-step UI |
| Session setup screen | Done | Distance, start method |
| Athlete management | Done | Add/edit/delete |
| Result editing/review | Done | Manual override |
| Error boundaries | Done | Graceful error handling |
| iOS Liquid Glass UI | Done | GlassCard, GlassButton |
| Theme context (dark/light mode) | Done | Navy dark theme |
| Auto-detection mock | Done | Simulated pose detection |
| Haptic & audio feedback | Done | expo-haptics, expo-audio |
| Sound detection start | Done | Clap/gun detection |

---

## Phase 3: Production Features

### Native Pose Detection

| Feature | Status | Notes |
|---------|--------|-------|
| iOS Vision Framework plugin | Done | VNDetectHumanBodyPoseRequest |
| useVisionPose hook | Done | Gate crossing detection |
| Sub-frame interpolation | Done | ~10ms accuracy |
| Android MediaPipe/BlazePose | Pending | Need native module |
| Torso-only detection | Done | Per World Athletics Rule 164 |

### Multi-Phone Sync

| Feature | Status | Notes |
|---------|--------|-------|
| BLE device scanning | Done | react-native-ble-plx |
| BLE connection (central mode) | Done | Connect to other devices |
| BLE multi-device support | Done | Up to 5 simultaneous |
| BLE peripheral/advertising | Not Possible | Library limitation |
| WiFi/WebSocket sync | Done | SyncConnection.ts |
| NTP-style time sync | Done | 5ms target accuracy |
| mDNS device discovery | Done | react-native-zeroconf |
| DeviceSyncScreen UI | Done | Role selection, gate config |
| Persist device assignments | Pending | Save to session store |

### Session Types

| Feature | Status | Notes |
|---------|--------|-------|
| Flying start mode | Done | Fly-in distance config |
| Standing start mode | Done | Default mode |
| Block start mode | Done | Track starting blocks |
| Series/Interval mode | Pending | Multiple runs with rest |

---

## Phase 4: Advanced Features (Pending)

### Series/Interval Training

| Feature | Status | Notes |
|---------|--------|-------|
| Series types definition | Pending | Sets, reps, rest periods |
| SeriesSetupScreen | Pending | Configure intervals |
| Auto-advance between runs | Pending | Rest countdown |
| Series results summary | Pending | Aggregate stats |

### Results & Analytics

| Feature | Status | Notes |
|---------|--------|-------|
| Results table view | Pending | Spreadsheet-style |
| Splits columns | Pending | Multi-gate splits |
| Sort/filter results | Pending | By athlete, date, time |
| Export to CSV | Pending | Share results |
| Performance charts | Pending | Progress over time |

### Flying Start Detection

| Feature | Status | Notes |
|---------|--------|-------|
| Auto-detect fly-in zone | Pending | Based on distance config |
| Velocity in fly zone | Pending | Entry speed calculation |
| Timing zone validation | Pending | Ensure proper setup |

### Additional Features

| Feature | Status | Notes |
|---------|--------|-------|
| Video recording | Pending | Capture runs |
| Frame-by-frame review | Pending | Manual time adjustment |
| Cloud sync | Pending | Backup results |
| Coach/athlete profiles | Pending | Multi-user support |
| Training plans | Pending | Structured workouts |

---

## Known Limitations

1. **BLE Peripheral Mode**: `react-native-ble-plx` only supports central (client) mode, not peripheral (server/advertising). For 100m+ range, WiFi sync is recommended anyway.

2. **Native Pose Detection**: Requires development build (not Expo Go). iOS Vision works, Android MediaPipe needs implementation.

3. **120fps Camera**: Only available via react-native-vision-camera in development builds.

---

## Quick Commands

```bash
# Development
npx expo start

# iOS build (requires dev build for native features)
npx expo run:ios

# EAS build
eas build --platform ios --profile development

# Type checking
npx tsc --noEmit
```

---

## File Reference

| File | Purpose |
|------|---------|
| `ROADMAP.md` | This file - feature tracking |
| `ACTIVITY_LOG.md` | Session-by-session progress |
| `STYLE_GUIDE.md` | Design system reference |
| `PRD.md` | Product requirements |
| `TECHNICAL_SPEC.md` | Technical details |

---

*Last updated: 2026-01-06*
