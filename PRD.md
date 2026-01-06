# Track Speed - Product Requirements Document

> **Version:** 1.0
> **Last Updated:** January 5, 2026
> **Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Criteria](#3-goals--success-criteria)
4. [Target Users](#4-target-users)
5. [User Stories & Use Cases](#5-user-stories--use-cases)
6. [Functional Requirements](#6-functional-requirements)
7. [Technical Architecture](#7-technical-architecture)
8. [Tech Stack](#8-tech-stack)
9. [Accuracy Strategy](#9-accuracy-strategy)
10. [AI Integration](#10-ai-integration)
11. [Multi-Phone Timing System](#11-multi-phone-timing-system)
12. [User Experience & Workflows](#12-user-experience--workflows)
13. [Data Model](#13-data-model)
14. [API Specifications](#14-api-specifications)
15. [Export & Sharing](#15-export--sharing)
16. [Monetization Strategy](#16-monetization-strategy)
17. [Security & Privacy](#17-security--privacy)
18. [Validation & Trust](#18-validation--trust)
19. [Risks & Mitigations](#19-risks--mitigations)
20. [MVP Scope (90-Day Build)](#20-mvp-scope-90-day-build)
21. [Roadmap](#21-roadmap)
22. [Appendices](#22-appendices)

---

## 1. Executive Summary

### Product Name
**Track Speed** (working title)

### One-Line Description
A cross-platform mobile sprint timing system that delivers timing-gate accuracy, AI-assisted confidence scoring, and coach-first workflows using smartphones.

### Vision Statement
Track Speed becomes the definitive hub for sprint performance—accurate enough to trust, dramatically easier to use than hardware gates, AI-assisted for confidence, and indispensable over a training season.

### Key Differentiators
- **Sub-10ms typical error** under good conditions
- **Confidence scoring** on every measurement
- **Visual verification** with auto-captured evidence clips
- **Zero-touch workflows** for coaches
- **Multi-phone splits** without expensive hardware
- **Cross-platform** from day one (iOS + Android)

---

## 2. Problem Statement

### Current Market Pain Points

Accurate sprint timing is critical for performance assessment, yet existing solutions fail coaches and athletes in significant ways:

| Solution | Problems |
|----------|----------|
| **Timing Gates/Lasers** | Expensive ($2,000-$10,000+), fragile, tedious setup, requires dedicated equipment |
| **Stopwatches** | Human reaction time adds 0.2-0.4s error, no verification, no confidence metrics |
| **Existing Apps (e.g., Photo Finish)** | 30 FPS detection limit, minimal calibration, no AI assistance, weak multi-athlete workflows, poor longitudinal tracking |
| **Video Analysis** | Time-consuming manual review, requires expertise, not real-time |

### The Gap
No solution currently provides:
- Timing-gate-level accuracy in a smartphone
- Confidence metrics that tell coaches when to trust results
- Visual evidence for verification and athlete motivation
- Seamless multi-phone coordination for split times
- Season-long athlete intelligence and trend analysis

---

## 3. Goals & Success Criteria

### Primary Goals

| Goal | Success Metric | Target |
|------|----------------|--------|
| **Accuracy** | Typical error vs. timing gates | < 10ms under good conditions |
| **Reliability** | High-confidence measurement rate | > 90% of reps |
| **Usability** | Time from app open to first timing | < 60 seconds |
| **Adoption** | Coach retention after 30 days | > 40% |
| **Coverage** | Timing modes supported | All major sprint modes |

### Secondary Goals

| Goal | Success Metric | Target |
|------|----------------|--------|
| Cross-platform parity | Feature availability iOS vs Android | 100% |
| Offline functionality | Core features without internet | 100% |
| Multi-phone sync accuracy | Clock drift between devices | < 5ms |

### Non-Goals (v1)

- **NOT** a certified World Athletics FAT replacement
- **NOT** providing biomechanics or technique coaching claims
- **NOT** cloud-only processing (offline must work)
- **NOT** replacing professional timing systems for official competitions

---

## 4. Target Users

### Primary Users

#### 1. Sprint Coaches (Track & Field)
- **Context:** Runs 10-50 timed reps per practice session
- **Pain Points:** Setup time, accuracy doubts, no verification, manual logging
- **Goals:** Quick, trusted times with evidence; track athlete progress
- **Technical Comfort:** Moderate; uses smartphone daily but not power user

#### 2. Strength & Conditioning Coaches
- **Context:** Speed testing as part of broader athletic development
- **Pain Points:** Expensive timing equipment, limited access, inconsistent protocols
- **Goals:** Standardized, repeatable speed assessments
- **Technical Comfort:** Moderate to high

#### 3. Performance Labs / Sports Science Staff
- **Context:** Research, athlete monitoring, return-to-play protocols
- **Pain Points:** Need accuracy metrics, data export, longitudinal tracking
- **Goals:** Publishable-quality data, integration with other systems
- **Technical Comfort:** High

### Secondary Users

#### 4. Competitive Athletes (Self-Coached)
- **Context:** Training alone or with training partners
- **Pain Points:** No coach to run timing, no feedback on progress
- **Goals:** Self-service timing with motivation through evidence

#### 5. Collegiate Programs
- **Context:** Large athlete rosters, limited equipment budget
- **Pain Points:** Equipment bottlenecks, scheduling conflicts
- **Goals:** Scale timing across team with minimal equipment

#### 6. Academies and Youth Clubs
- **Context:** Developing athletes, parent engagement
- **Pain Points:** Demonstrating progress, engaging parents
- **Goals:** Shareable results, progress visualization

### User Personas

#### Persona 1: Coach Marcus
> **Role:** High school track coach, 15 years experience
> **Team Size:** 40 athletes
> **Tech:** iPhone 14, comfortable with apps
> **Quote:** "I need times I can trust without spending 10 minutes on setup."
> **Key Need:** Zero-touch workflow for practice; evidence for PRs

#### Persona 2: Dr. Sarah Chen
> **Role:** Sports scientist at D1 university
> **Athletes:** 200+ across multiple sports
> **Tech:** Android, data-focused
> **Quote:** "If I can't export the data with confidence intervals, it's useless for my research."
> **Key Need:** Accuracy metrics, CSV export, longitudinal tracking

#### Persona 3: Jake (Athlete)
> **Role:** College sprinter, self-coached in off-season
> **Tech:** iPhone, very comfortable
> **Quote:** "I want to see my fly-30 and know if I'm actually getting faster."
> **Key Need:** Easy self-timing, visual evidence, trend tracking

---

## 5. User Stories & Use Cases

### Epic 1: Basic Sprint Timing

#### US-1.1: Single Sprint Timing
> **As a** coach
> **I want to** time a single sprint from start to finish
> **So that** I can assess an athlete's speed

**Acceptance Criteria:**
- [ ] Can set up finish line in < 30 seconds
- [ ] Timing starts automatically on athlete movement or manual trigger
- [ ] Time displays immediately after athlete crosses finish
- [ ] Confidence indicator shows measurement quality
- [ ] Evidence clip auto-captures finish crossing

#### US-1.2: Fly Time Measurement
> **As a** coach
> **I want to** measure fly times (10m, 20m, 30m)
> **So that** I can assess maximum velocity

**Acceptance Criteria:**
- [ ] Can select fly distance (10/20/30m)
- [ ] Timing ignores acceleration zone
- [ ] Only measures athlete at top speed through zone
- [ ] Displays fly time with confidence

#### US-1.3: Standing Start with Reaction
> **As a** coach
> **I want to** measure reaction time + sprint time separately
> **So that** I can identify if reaction or speed needs work

**Acceptance Criteria:**
- [ ] Visual or audio start signal
- [ ] Reaction time captured separately
- [ ] Total time = reaction + sprint
- [ ] Both values displayed with confidence

### Epic 2: Multi-Rep Practice Sessions

#### US-2.1: Zero-Touch Practice Mode
> **As a** coach
> **I want to** run continuous practice reps without touching my phone
> **So that** I can focus on coaching, not technology

**Acceptance Criteria:**
- [ ] Start session once, then hands-free
- [ ] Auto-detects each rep start and finish
- [ ] Auto-rest timer between reps
- [ ] Announces times via audio (optional)
- [ ] Session continues until manually stopped

#### US-2.2: Multi-Athlete Queue
> **As a** coach
> **I want to** queue multiple athletes for sequential timing
> **So that** times are automatically attributed to the right person

**Acceptance Criteria:**
- [ ] Create/select athlete queue before session
- [ ] Auto-advance to next athlete after each rep
- [ ] Display "up next" athlete name
- [ ] Allow manual override/skip
- [ ] All times correctly attributed in results

### Epic 3: Split Times (Multi-Phone)

#### US-3.1: Two-Phone Split Timing
> **As a** coach
> **I want to** use two phones to capture split times
> **So that** I can analyze acceleration patterns

**Acceptance Criteria:**
- [ ] Host phone creates session, gate phone joins
- [ ] Phones sync clocks with < 5ms accuracy
- [ ] Each phone captures its gate crossing
- [ ] Host displays combined results (0-10, 10-20, etc.)
- [ ] Works over local Wi-Fi or internet

#### US-3.2: Acceleration Profiling
> **As a** a performance scientist
> **I want to** see 0-10, 10-20, 20-30, 30-40 splits
> **So that** I can identify acceleration vs. max velocity bottlenecks

**Acceptance Criteria:**
- [ ] Support up to 5 phones (start + 4 gates)
- [ ] Calculate and display each segment time
- [ ] Show acceleration curve visualization
- [ ] Compare to athlete's historical data
- [ ] Export split data

### Epic 4: Gun/Audio Starts

#### US-4.1: Gun Start Detection
> **As a** coach
> **I want to** use an actual starting gun/clapper
> **So that** I can simulate race conditions

**Acceptance Criteria:**
- [ ] App detects gunshot/clap audio
- [ ] Timestamp captured at audio event
- [ ] Reaction time = first movement - gun time
- [ ] Works with various audio sources (gun, clapper, whistle)
- [ ] Sensitivity adjustable

### Epic 5: Evidence & Verification

#### US-5.1: Finish Line Evidence Clip
> **As a** coach
> **I want to** see video evidence of each finish
> **So that** I can verify the timing and show the athlete

**Acceptance Criteria:**
- [ ] Auto-capture 2-3 second clip around finish
- [ ] Overlay shows: finish line, torso marker, timestamp
- [ ] Playback in slow motion available
- [ ] Save/share individual clips
- [ ] Storage managed automatically (configurable retention)

#### US-5.2: Confidence Scoring
> **As a** coach
> **I want to** see a confidence score for each time
> **So that** I know when to trust the measurement

**Acceptance Criteria:**
- [ ] Each rep shows: High / Medium / Low confidence
- [ ] If degraded, shows reason (lighting, occlusion, angle, etc.)
- [ ] Can filter session results by confidence level
- [ ] Confidence methodology documented for users

### Epic 6: Athlete Management & Trends

#### US-6.1: Athlete Profiles
> **As a** coach
> **I want to** maintain athlete profiles with PR history
> **So that** I can track long-term development

**Acceptance Criteria:**
- [ ] Create athlete with name, photo (optional), metadata
- [ ] Auto-track PRs by distance/mode
- [ ] View historical sessions and times
- [ ] Visualize trends over time
- [ ] Compare athletes

#### US-6.2: Season Analytics
> **As a** coach
> **I want to** see season-long trends and patterns
> **So that** I can adjust training programs

**Acceptance Criteria:**
- [ ] Dashboard shows team and individual trends
- [ ] Identify athletes improving/plateauing/declining
- [ ] Fatigue indicators (consistency degradation)
- [ ] Export analytics reports

---

## 6. Functional Requirements

### 6.1 Timing Modes

#### Supported in v1.0 (MVP+)

| Mode | Description | Start Trigger | End Trigger |
|------|-------------|---------------|-------------|
| **Standing Start (Reaction Excluded)** | Timer starts on first movement | Movement detection | Finish line crossing |
| **Standing Start (Reaction Included)** | Timer starts on signal | Visual/audio signal | Finish line crossing |
| **Block Start** | From starting blocks | Movement from blocks | Finish line crossing |
| **Gun Start** | Audio-triggered start | Gunshot/clap detection | Finish line crossing |
| **Fly 10** | 10m flying sprint | Entry into zone | Exit from zone |
| **Fly 20** | 20m flying sprint | Entry into zone | Exit from zone |
| **Fly 30** | 30m flying sprint | Entry into zone | Exit from zone |

#### Split Distances (Multi-Phone Required)

| Split | Phones Required |
|-------|-----------------|
| 0-10m | 2 (start + 10m) |
| 10-20m | 2 (10m + 20m) or 3 (start + 10m + 20m) |
| 20-30m | 2-4 phones depending on full profile |
| 30-40m | 2-5 phones |
| Full Profile (0-10-20-30-40) | 5 phones |

#### v1.1+ (Post-MVP)

| Mode | Description |
|------|-------------|
| Auto Max-Velocity Segment | Automatically identify fastest segment |
| Fatigue Scoring | Consistency analysis across reps |
| Block Clearance Time | Time from gun to leaving blocks |

### 6.2 Camera & Detection Requirements

| Requirement | Specification |
|-------------|---------------|
| Minimum frame rate | 60 FPS |
| Accuracy mode frame rate | 120-240 FPS (device-dependent) |
| Detection target | Torso center (shoulders + hips midpoint) |
| Minimum detection confidence | 70% pose confidence |
| Supported orientations | Landscape (primary), Portrait (supported) |
| Optimal camera angle | Perpendicular to running direction, 5-15m distance |
| Lighting requirement | Adequate ambient; accuracy mode requires good lighting |

### 6.3 Session Management

| Feature | Requirement |
|---------|-------------|
| Session creation | Name, date, location, mode, athletes |
| Rep logging | Automatic with manual override |
| Rest timer | Configurable intervals, auto or manual |
| Session pause/resume | Supported |
| Session notes | Free-text notes per session and per rep |
| Session export | CSV, PDF, shareable link |

### 6.4 Offline Functionality

| Feature | Offline Support |
|---------|-----------------|
| Single-phone timing | Full |
| Evidence capture | Full |
| Athlete profiles (local) | Full |
| Session history (local) | Full |
| Multi-phone timing | Local Wi-Fi only |
| Cloud sync | Requires internet |
| Sharing | Requires internet |

---

## 7. Technical Architecture

### 7.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VELOCITY GATE ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     React Native App Layer                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │
│  │    UI     │ │   State   │ │Navigation │ │  Frame        │   │
│  │Components │ │  (Zustand)│ │           │ │  Processor    │   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ Native Bridge
┌────────────────────────────┴────────────────────────────────────┐
│                    Native Timing Engine                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Platform Layer                        │    │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   │    │
│  │  │     iOS (Swift)     │  │   Android (Kotlin)      │   │    │
│  │  │  - AVFoundation     │  │  - CameraX              │   │    │
│  │  │  - Vision Framework │  │  - MediaPipe Pose       │   │    │
│  │  │  - Core ML          │  │  - TensorFlow Lite      │   │    │
│  │  │  - mach_continuous  │  │  - elapsedRealtimeNanos │   │    │
│  │  └─────────────────────┘  └─────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Computer Vision Pipeline                    │    │
│  │  Frame → Pose Detection → Torso Extraction →            │    │
│  │  Line Crossing → Timestamp → Confidence                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    Data & Sync Layer                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │
│  │   MMKV    │ │  SQLite   │ │  WebRTC   │ │ Cloud Sync    │   │
│  │  (Cache)  │ │ (Storage) │ │(Multi-Ph) │ │  (Optional)   │   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Component Diagram                           │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   UI Components  │     │  Business Logic  │     │    Native    │
├──────────────────┤     ├──────────────────┤     ├──────────────┤
│ - TimingScreen   │────▶│ - SessionManager │────▶│ - Camera     │
│ - SetupWizard    │     │ - AthleteManager │     │ - PoseEngine │
│ - ResultsView    │     │ - TimingEngine   │     │ - AudioProc  │
│ - AthleteList    │     │ - SyncManager    │     │ - ClipCapture│
│ - SettingsPanel  │     │ - ExportManager  │     │ - ClockSync  │
│ - EvidencePlayer │     │ - AIAssistant    │     │              │
└──────────────────┘     └──────────────────┘     └──────────────┘
         │                        │                       │
         └────────────────────────┴───────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │       Data Layer          │
                    ├───────────────────────────┤
                    │ - SessionRepository       │
                    │ - AthleteRepository       │
                    │ - SettingsRepository      │
                    │ - EvidenceStorage         │
                    │ - SyncQueue               │
                    └───────────────────────────┘
```

### 7.3 Timing Pipeline (Critical Path)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Timing Pipeline (per frame)                   │
└─────────────────────────────────────────────────────────────────┘

Frame Capture ──▶ Pose Detection ──▶ Torso Extraction ──▶
    │                  │                    │
    │ timestamp        │ landmarks          │ (x, y) center
    │ (monotonic)      │ confidence         │ velocity vector
    ▼                  ▼                    ▼
Line Crossing ──▶ Sub-Frame Interp ──▶ Confidence Calc ──▶ Result
    │                  │                    │                │
    │ crossed?         │ exact time         │ score          │ TimingEvent
    │ direction        │ (interpolated)     │ reasons        │
```

**Latency Budget (per frame @ 60 FPS = 16.67ms):**

| Stage | Target | Max |
|-------|--------|-----|
| Frame capture + timestamp | 1ms | 2ms |
| Pose detection | 8ms | 12ms |
| Torso + crossing logic | 1ms | 2ms |
| Confidence calculation | 1ms | 2ms |
| Result dispatch | 1ms | 2ms |
| **Total** | **12ms** | **20ms** |

> Note: At 120 FPS (8.33ms/frame), pose detection must complete in < 6ms, requiring model optimization or frame skipping strategy.

---

## 8. Tech Stack

### 8.1 Cross-Platform App Layer

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Framework** | React Native (Bare workflow) | Cross-platform, native performance access |
| **Language** | TypeScript | Type safety, developer productivity |
| **Navigation** | React Navigation 6+ | Industry standard, deep linking support |
| **State Management** | Zustand | Lightweight, TypeScript-friendly |
| **Local Storage** | MMKV | Fast synchronous storage for settings/cache |
| **Database** | SQLite (via expo-sqlite or react-native-sqlite-storage) | Relational data, offline-first |
| **Animations** | Reanimated 3 | 60fps animations, gesture handling |
| **Gestures** | Gesture Handler | Native gesture recognition |
| **Camera UI** | Vision Camera | Frame processor access, high FPS |
| **Multi-Phone Sync** | WebRTC (react-native-webrtc) | Low-latency data channels |
| **Crash Reporting** | Sentry | Production debugging |
| **Subscriptions** | RevenueCat | Cross-platform IAP management |
| **Analytics** | Mixpanel or Amplitude | User behavior tracking |

### 8.2 Native Timing Engine (iOS)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | Swift | Modern, performant, Apple ecosystem |
| **Camera** | AVFoundation | Direct camera control, frame timestamps |
| **Pose Detection** | Vision Framework | Apple-optimized person detection |
| **ML Inference** | Core ML | Hardware-accelerated pose models |
| **Timestamps** | mach_continuous_time | Monotonic, not affected by system time changes |
| **Audio Processing** | AVAudioEngine | Gun/clap detection |

### 8.3 Native Timing Engine (Android)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | Kotlin | Modern Android development |
| **Camera** | CameraX | Simplified high-FPS capture |
| **Pose Detection** | MediaPipe Pose (BlazePose) | Cross-platform, well-optimized |
| **ML Inference** | TensorFlow Lite | Custom model support |
| **Timestamps** | SystemClock.elapsedRealtimeNanos() | Monotonic clock |
| **Audio Processing** | AudioRecord + custom DSP | Gun/clap detection |

### 8.4 Backend Services (Optional Cloud)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Database** | Supabase (PostgreSQL) | Open-source, real-time, auth built-in |
| **Authentication** | Supabase Auth | Social + email, cross-platform |
| **File Storage** | Supabase Storage | Evidence clips |
| **API** | Supabase Edge Functions | Serverless, TypeScript |
| **Real-time Sync** | Supabase Realtime | Live session updates |

### 8.5 Development & DevOps

| Component | Technology |
|-----------|------------|
| **Monorepo** | Turborepo or Nx |
| **Package Manager** | pnpm |
| **Testing** | Jest, Detox (E2E) |
| **CI/CD** | GitHub Actions |
| **iOS Distribution** | Fastlane + App Store Connect |
| **Android Distribution** | Fastlane + Google Play Console |
| **Feature Flags** | LaunchDarkly or Statsig |

---

## 9. Accuracy Strategy

### 9.1 Frame Rate Strategy

| Mode | Frame Rate | Use Case | Device Requirements |
|------|------------|----------|---------------------|
| **Standard** | 60 FPS | Practice, general use | All supported devices |
| **Accuracy** | 120 FPS | Competition prep, PRs | iPhone 12+, flagship Android |
| **Maximum** | 240 FPS | Lab/research | iPhone Pro models only |

**Theoretical Precision:**
- 60 FPS: ±8.33ms frame uncertainty
- 120 FPS: ±4.17ms frame uncertainty
- 240 FPS: ±2.08ms frame uncertainty

### 9.2 Detection Target: Torso Center

**Why Torso (not feet or head):**
- Torso position is most stable during sprint
- Limbs introduce false triggers (arm swing, leg kick)
- Head can bob; feet leave ground
- Torso center approximates center of mass

**Torso Calculation:**
```
torso_x = (left_shoulder.x + right_shoulder.x + left_hip.x + right_hip.x) / 4
torso_y = (left_shoulder.y + right_shoulder.y + left_hip.y + right_hip.y) / 4
```

### 9.3 Sub-Frame Interpolation

To achieve better than frame-rate precision:

```
Given:
- Frame N-1: torso at position X1, time T1
- Frame N: torso at position X2, time T2
- Finish line at position Xf

If X1 < Xf < X2 (crossing occurred):

  velocity = (X2 - X1) / (T2 - T1)
  crossing_time = T1 + (Xf - X1) / velocity
```

**Interpolation adds ~2-3ms precision** under good conditions.

### 9.4 Confidence Scoring Algorithm

Each timing result includes a confidence score based on:

| Factor | Weight | High | Medium | Low |
|--------|--------|------|--------|-----|
| **Pose Detection Confidence** | 30% | > 90% | 70-90% | < 70% |
| **Lighting Conditions** | 20% | > 500 lux | 200-500 lux | < 200 lux |
| **Camera Angle** | 20% | 80-100° | 60-80° or 100-120° | < 60° or > 120° |
| **Occlusion** | 15% | None | Partial (< 20%) | Significant (> 20%) |
| **Frame Rate Achieved** | 15% | Target FPS | 90-100% of target | < 90% of target |

**Confidence Thresholds:**
- **High:** Score ≥ 85%
- **Medium:** Score 65-84%
- **Low:** Score < 65%

### 9.5 Error Sources & Mitigation

| Error Source | Magnitude | Mitigation |
|--------------|-----------|------------|
| Frame timing | ±4-8ms | Higher FPS, interpolation |
| Pose detection jitter | ±5-10ms | Kalman filtering, torso averaging |
| Camera rolling shutter | ±1-3ms | Global shutter preference (where available) |
| Clock drift (multi-phone) | ±2-5ms | Continuous sync protocol |
| Finish line calibration | ±5-20ms | AI-assisted setup validation |
| Human setup error | Variable | Visual guides, validation warnings |

### 9.6 Accuracy Targets

| Condition | Typical Error Target | Max Error (95th percentile) |
|-----------|---------------------|----------------------------|
| **Optimal** (good light, 120+ FPS, perpendicular) | < 5ms | < 15ms |
| **Good** (adequate light, 60 FPS, good angle) | < 10ms | < 25ms |
| **Acceptable** (low light, occlusion) | < 20ms | < 50ms |
| **Degraded** (poor conditions) | Warning displayed | Confidence: Low |

---

## 10. AI Integration

### 10.1 Principles

AI in Track Speed is **functional, not gimmicky**:
- Every AI feature solves a specific user problem
- AI assists; humans decide
- Transparency: users see why AI made suggestions
- Graceful degradation: app works fully without AI features

### 10.2 AI Feature Set

#### 10.2.1 Setup Validation

**Purpose:** Prevent poor-quality measurements before they happen

| Check | Detection Method | User Feedback |
|-------|------------------|---------------|
| Camera angle | Pose landmark geometry | "Camera too oblique - move to side" |
| Finish line alignment | Line detection + perspective | "Finish line not perpendicular" |
| Lighting | Frame brightness analysis | "Low light - accuracy may be reduced" |
| Distance | Person scale estimation | "Too close/far - optimal: 5-15m" |
| Stability | Frame motion analysis | "Camera unstable - use tripod" |

#### 10.2.2 Start Type Classification

**Purpose:** Auto-detect start type for correct timing mode

| Detected Pattern | Classification | Confidence Required |
|------------------|----------------|---------------------|
| Upright → movement | Standing start | 80% |
| Crouched → upright → movement | Block start | 85% |
| Already moving → zone entry | Flying start | 75% |
| Audio spike → movement | Gun start | 90% (audio + visual) |

#### 10.2.3 Multi-Hypothesis Timing

**Purpose:** Handle ambiguous crossings with probabilistic output

When crossing detection is uncertain:
```
Result: 5.23s (5.18s - 5.28s at 90% confidence)
```

User sees:
- Primary time: 5.23s
- Confidence: Medium
- Reason: "Multiple possible crossing points detected"
- Option: "View evidence clip"

#### 10.2.4 Post-Session Insights

**Purpose:** Turn data into actionable coaching insights

| Insight | Analysis Method | Example Output |
|---------|-----------------|----------------|
| Fatigue detection | Rep time variance | "Times degraded 8% over last 5 reps" |
| Acceleration vs max-V | Split comparison | "0-10 strong, 20-30 needs work" |
| Consistency scoring | CV of rep times | "High consistency (CV: 2.1%)" |
| PR proximity | Historical comparison | "Within 0.05s of PR - consider fresh attempt" |

### 10.3 AI Models

| Model | Purpose | Platform | Size |
|-------|---------|----------|------|
| **Pose Estimation** | Torso/landmark detection | Vision (iOS), MediaPipe (Android) | Built-in |
| **Setup Validator** | Camera/environment check | Core ML / TFLite | ~5MB |
| **Start Classifier** | Start type detection | Core ML / TFLite | ~3MB |
| **Audio Detector** | Gun/clap recognition | Custom DSP + small NN | ~1MB |

---

## 11. Multi-Phone Timing System

### 11.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Phone Architecture                      │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │  Host Phone  │  (Session control, results aggregation)
     │   (Coach)    │
     └──────┬───────┘
            │ WebRTC Data Channel
    ┌───────┴───────┬───────────────┬───────────────┐
    │               │               │               │
┌───┴───┐     ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
│Gate 1 │     │  Gate 2   │   │  Gate 3   │   │  Gate 4   │
│ (0m)  │     │  (10m)    │   │  (20m)    │   │  (30m)    │
└───────┘     └───────────┘   └───────────┘   └───────────┘
```

### 11.2 Roles

| Role | Responsibilities |
|------|------------------|
| **Host** | Creates session, manages athlete queue, receives all gate events, computes splits, displays results, stores session |
| **Gate** | Joins session, syncs clock with host, detects crossings, sends timing events, captures evidence clips |

### 11.3 Clock Synchronization Protocol

**NTP-style offset estimation:**

```
1. Host sends ping with timestamp T1
2. Gate receives at T2 (gate clock)
3. Gate sends pong with T2 and T3 (send time)
4. Host receives at T4

Offset = ((T2 - T1) + (T3 - T4)) / 2
RTT = (T4 - T1) - (T3 - T2)
```

**Sync schedule:**
- Initial sync: 10 ping-pong rounds, median offset
- Continuous: Every 5-10 seconds during session
- Drift correction: Applied to all timestamps

**Target accuracy:** < 5ms offset between any two phones

### 11.4 Event Packet Schema

```typescript
interface GateEvent {
  gate_id: string;                    // Unique gate identifier
  event_type: 'crossing' | 'start' | 'false_start';
  athlete_id?: string;                // If known
  frame_timestamp_ns: number;         // Frame capture time (device monotonic)
  adjusted_timestamp_ns: number;      // After clock offset correction
  crossing_time_ns: number;           // Sub-frame interpolated time
  confidence: number;                 // 0-100
  confidence_reasons?: string[];      // If degraded
  torso_position: { x: number; y: number };
  velocity_estimate: number;          // m/s estimate
  clip_id?: string;                   // Reference to evidence clip
}
```

### 11.5 Connection Management

| Scenario | Handling |
|----------|----------|
| Gate disconnects mid-session | Warning to host, session continues with remaining gates, reconnection attempted |
| Host disconnects | Gates pause, attempt reconnection, gates can store local data for recovery |
| High latency (> 500ms) | Warning displayed, sync frequency increased |
| No local network | Fall back to internet relay (higher latency) |

---

## 12. User Experience & Workflows

### 12.1 Information Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    App Navigation Structure                      │
└─────────────────────────────────────────────────────────────────┘

├── Home (Dashboard)
│   ├── Quick Start (New Session)
│   ├── Recent Sessions
│   └── Quick Stats
│
├── Sessions
│   ├── New Session
│   │   ├── Mode Selection
│   │   ├── Setup Wizard
│   │   └── Active Timing
│   ├── Session History
│   └── Session Detail
│       ├── Results List
│       ├── Evidence Clips
│       └── Analytics
│
├── Athletes
│   ├── Athlete List
│   ├── Athlete Detail
│   │   ├── Profile
│   │   ├── PRs
│   │   ├── Trends
│   │   └── Sessions
│   └── Add/Edit Athlete
│
├── Team (Pro)
│   ├── Team Dashboard
│   ├── Comparisons
│   └── Reports
│
└── Settings
    ├── Timing Preferences
    ├── Camera Settings
    ├── Evidence Storage
    ├── Account
    └── Subscription
```

### 12.2 Key Workflows

#### Workflow 1: Quick Single Timing

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Home   │───▶│  Mode   │───▶│  Setup  │───▶│  Ready  │
│         │    │ Select  │    │ Camera  │    │ Screen  │
└─────────┘    └─────────┘    └─────────┘    └────┬────┘
                                                  │
                                                  ▼
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Results │◀───│ Timing  │◀───│Detecting│◀───│ Athlete │
│ + Save  │    │ Display │    │ Crossing│    │  Runs   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

**Time to first timing:** < 60 seconds

#### Workflow 2: Zero-Touch Practice Mode

```
┌─────────────────────────────────────────────────────────────────┐
│                    Zero-Touch Practice Mode                      │
└─────────────────────────────────────────────────────────────────┘

1. Coach Setup (one-time):
   - Select mode (e.g., "Fly 30")
   - Select athletes (queue)
   - Set rest interval
   - Position phone, tap "Start Session"

2. Practice Loop (hands-free):
   ┌────────────────────────────────────────┐
   │                                        │
   │  ┌──────────┐    ┌──────────────────┐  │
   │  │  Waiting │───▶│ Athlete Detected │  │
   │  │ for Run  │    │   (Auto-start)   │  │
   │  └──────────┘    └────────┬─────────┘  │
   │       ▲                   │            │
   │       │                   ▼            │
   │  ┌────┴─────┐    ┌──────────────────┐  │
   │  │   Rest   │◀───│  Time Captured   │  │
   │  │  Timer   │    │ (Audio announce) │  │
   │  └──────────┘    └──────────────────┘  │
   │                                        │
   └────────────────────────────────────────┘

3. Coach ends session when done
```

#### Workflow 3: Multi-Phone Split Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Phone Setup Flow                        │
└─────────────────────────────────────────────────────────────────┘

Host Phone:                          Gate Phone(s):
┌───────────────┐                    ┌───────────────┐
│ Create Session│                    │  Open App     │
│ Select "Splits"│                   │               │
└───────┬───────┘                    └───────┬───────┘
        │                                    │
        ▼                                    ▼
┌───────────────┐                    ┌───────────────┐
│ Generate Code │                    │  "Join as     │
│ or QR         │                    │   Gate"       │
└───────┬───────┘                    └───────┬───────┘
        │                                    │
        │◀────────── Gate enters code ───────│
        │                                    │
        ▼                                    ▼
┌───────────────┐                    ┌───────────────┐
│ Gate Connected│                    │  Syncing...   │
│ Assign: "10m" │                    │  "Connected   │
└───────┬───────┘                    │   as Gate 2"  │
        │                            └───────┬───────┘
        │                                    │
    [Repeat for additional gates]            │
        │                                    │
        ▼                                    ▼
┌───────────────┐                    ┌───────────────┐
│ All Gates     │                    │ Ready -       │
│ Ready - Start │                    │ Position at   │
└───────────────┘                    │ 10m mark      │
                                     └───────────────┘
```

### 12.3 Key Screens

#### 12.3.1 Active Timing Screen (Coach View)

```
┌─────────────────────────────────────────┐
│ ← Session: Morning Practice    ⚙️  ⋮    │
├─────────────────────────────────────────┤
│                                         │
│         ┌─────────────────────┐         │
│         │                     │         │
│         │   CAMERA PREVIEW    │         │
│         │   [Finish line      │         │
│         │    overlay]         │         │
│         │                     │         │
│         └─────────────────────┘         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  LAST REP          CONFIDENCE  │    │
│  │    5.23s              ●●●○     │    │
│  │                       HIGH     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌───────────┐    ┌───────────────┐     │
│  │ SESSION   │    │   BEST TODAY  │     │
│  │ BEST: 5.18│    │     5.18s     │     │
│  │ AVG: 5.31 │    │   (PR: 5.12)  │     │
│  └───────────┘    └───────────────┘     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  UP NEXT: Marcus Johnson       │    │
│  │  REST: 2:34 remaining          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [View All Reps]      [End Session]     │
│                                         │
└─────────────────────────────────────────┘
```

#### 12.3.2 Evidence Review Screen

```
┌─────────────────────────────────────────┐
│ ← Evidence: Rep #7                      │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     [VIDEO PLAYER]              │    │
│  │     - Slow motion playback      │    │
│  │     - Finish line overlay       │    │
│  │     - Torso marker              │    │
│  │     - Timestamp display         │    │
│  │                                 │    │
│  │   advancement        [▶] 0.25x  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  TIME: 5.23s                    │    │
│  │  CONFIDENCE: High (92%)         │    │
│  │  CROSSING FRAME: #847           │    │
│  │  INTERPOLATED: +2.3ms           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [💾 Save Clip]  [📤 Share]  [🗑️ Delete]│
│                                         │
└─────────────────────────────────────────┘
```

### 12.4 Audio Feedback

| Event | Audio Cue |
|-------|-----------|
| Ready for timing | Subtle tone |
| Crossing detected | Short beep |
| Time captured | Voice: "{time} seconds" |
| Rest complete | Alert tone |
| Low confidence | Different tone + voice warning |
| Session started | Confirmation tone |
| Session ended | Summary voice |

---

## 13. Data Model

### 13.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Model (ERD)                              │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │       │    Team      │       │   Athlete    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)      │    ┌──│ id (PK)      │
│ email        │  │    │ name         │    │  │ team_id (FK) │
│ name         │  │    │ owner_id(FK) │◀───│  │ first_name   │
│ subscription │  │    │ created_at   │    │  │ last_name    │
│ created_at   │  └───▶│              │    │  │ birth_date   │
└──────────────┘       └──────────────┘    │  │ photo_url    │
                                           │  │ notes        │
                                           │  │ created_at   │
                                           │  └──────────────┘
                                           │          │
                                           │          │ 1:N
                                           │          ▼
┌──────────────┐       ┌──────────────┐    │  ┌──────────────┐
│   Session    │       │     Rep      │    │  │  AthletePR   │
├──────────────┤       ├──────────────┤    │  ├──────────────┤
│ id (PK)      │◀──┐   │ id (PK)      │    │  │ id (PK)      │
│ user_id (FK) │   │   │ session_id   │────┘  │ athlete_id   │
│ team_id (FK) │   │   │ athlete_id   │───────│ mode         │
│ name         │   │   │ rep_number   │       │ distance     │
│ date         │   │   │ time_ms      │       │ time_ms      │
│ location     │   └───│ splits_json  │       │ achieved_at  │
│ mode         │       │ confidence   │       │ rep_id (FK)  │
│ distance     │       │ conf_reasons │       └──────────────┘
│ settings_json│       │ start_type   │
│ status       │       │ evidence_id  │───┐
│ created_at   │       │ notes        │   │
└──────────────┘       │ created_at   │   │
                       └──────────────┘   │
                                          │
                       ┌──────────────┐   │
                       │   Evidence   │◀──┘
                       ├──────────────┤
                       │ id (PK)      │
                       │ rep_id (FK)  │
                       │ clip_url     │
                       │ thumbnail_url│
                       │ duration_ms  │
                       │ frame_count  │
                       │ crossing_frm │
                       │ overlay_data │
                       │ created_at   │
                       └──────────────┘
```

### 13.2 Core Schemas

#### User
```typescript
interface User {
  id: string;                    // UUID
  email: string;
  name: string;
  subscription_tier: 'free' | 'pro' | 'team';
  subscription_expires_at?: Date;
  settings: UserSettings;
  created_at: Date;
  updated_at: Date;
}

interface UserSettings {
  default_mode: TimingMode;
  default_distance: number;
  audio_feedback: boolean;
  voice_announcements: boolean;
  evidence_auto_save: boolean;
  evidence_retention_days: number;
  accuracy_mode_default: boolean;
  units: 'metric' | 'imperial';
}
```

#### Athlete
```typescript
interface Athlete {
  id: string;                    // UUID
  team_id?: string;              // FK to Team (optional for personal athletes)
  first_name: string;
  last_name: string;
  birth_date?: Date;
  photo_url?: string;
  gender?: 'male' | 'female' | 'other';
  notes?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### Session
```typescript
interface Session {
  id: string;                    // UUID
  user_id: string;               // FK to User
  team_id?: string;              // FK to Team
  name: string;
  date: Date;
  location?: string;
  location_coords?: { lat: number; lng: number };
  mode: TimingMode;
  distance_meters: number;
  settings: SessionSettings;
  status: 'active' | 'paused' | 'completed';
  gates?: GateConfig[];          // For multi-phone sessions
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

type TimingMode =
  | 'standing_start'
  | 'standing_start_reaction'
  | 'block_start'
  | 'gun_start'
  | 'fly';

interface SessionSettings {
  accuracy_mode: boolean;
  target_fps: number;
  rest_interval_seconds: number;
  auto_detect_reps: boolean;
  audio_feedback: boolean;
}

interface GateConfig {
  gate_id: string;
  device_id: string;
  distance_meters: number;
  role: 'start' | 'split' | 'finish';
  sync_offset_ns: number;
}
```

#### Rep
```typescript
interface Rep {
  id: string;                    // UUID
  session_id: string;            // FK to Session
  athlete_id?: string;           // FK to Athlete (optional if unknown)
  rep_number: number;            // Sequential within session
  time_ms: number;               // Primary timing result
  splits?: Split[];              // For multi-gate sessions

  // Confidence & quality
  confidence: number;            // 0-100
  confidence_level: 'high' | 'medium' | 'low';
  confidence_reasons?: string[]; // Why confidence was degraded

  // Start detection
  start_type: 'standing' | 'block' | 'flying' | 'gun';
  reaction_time_ms?: number;     // If reaction included

  // Evidence
  evidence_id?: string;          // FK to Evidence

  // Metadata
  notes?: string;
  is_pr: boolean;
  created_at: Date;
}

interface Split {
  gate_id: string;
  distance_meters: number;
  time_ms: number;               // Cumulative time at this gate
  split_ms: number;              // Time for this segment
  confidence: number;
}
```

#### Evidence
```typescript
interface Evidence {
  id: string;                    // UUID
  rep_id: string;                // FK to Rep
  clip_local_path: string;       // Local file path
  clip_cloud_url?: string;       // Cloud URL if synced
  thumbnail_local_path: string;
  thumbnail_cloud_url?: string;
  duration_ms: number;
  frame_count: number;
  fps: number;
  crossing_frame: number;        // Frame where crossing occurred
  overlay_data: OverlayData;     // Data for rendering overlays
  file_size_bytes: number;
  created_at: Date;
}

interface OverlayData {
  finish_line: { x1: number; y1: number; x2: number; y2: number };
  torso_positions: Array<{ frame: number; x: number; y: number }>;
  crossing_point: { x: number; y: number };
  timestamp_position: { x: number; y: number };
}
```

### 13.3 Local vs. Cloud Storage

| Data | Local | Cloud (Pro/Team) |
|------|-------|------------------|
| User settings | MMKV | Supabase |
| Athletes | SQLite | Supabase (sync) |
| Sessions | SQLite | Supabase (sync) |
| Reps | SQLite | Supabase (sync) |
| Evidence clips | File system | Supabase Storage (optional) |
| Evidence metadata | SQLite | Supabase (sync) |

---

## 14. API Specifications

### 14.1 Native Bridge API (React Native ↔ Native)

#### Timing Engine Commands

```typescript
// Start timing session
NativeTimingEngine.startSession(config: SessionConfig): Promise<void>

// Stop timing session
NativeTimingEngine.stopSession(): Promise<SessionResult>

// Pause/resume
NativeTimingEngine.pauseSession(): Promise<void>
NativeTimingEngine.resumeSession(): Promise<void>

// Manual trigger (if auto-detect disabled)
NativeTimingEngine.triggerStart(): Promise<void>
NativeTimingEngine.triggerFinish(): Promise<void>

// Configuration
NativeTimingEngine.setAccuracyMode(enabled: boolean): Promise<void>
NativeTimingEngine.setTargetFPS(fps: 60 | 120 | 240): Promise<FrameRateResult>
NativeTimingEngine.calibrateFinishLine(line: LineCoordinates): Promise<void>
```

#### Event Emitters

```typescript
// Timing events
NativeTimingEngine.addListener('onTimingResult', (result: TimingResult) => void)
NativeTimingEngine.addListener('onConfidenceWarning', (warning: ConfidenceWarning) => void)
NativeTimingEngine.addListener('onSetupValidation', (validation: SetupValidation) => void)

// Camera events
NativeTimingEngine.addListener('onFrameProcessed', (stats: FrameStats) => void)
NativeTimingEngine.addListener('onPoseDetected', (pose: PoseData) => void)

// Evidence events
NativeTimingEngine.addListener('onEvidenceCaptured', (evidence: EvidenceCapture) => void)
```

### 14.2 Multi-Phone Sync API

```typescript
// Host operations
MultiPhoneSync.createSession(config: MultiPhoneConfig): Promise<SessionCode>
MultiPhoneSync.getConnectedGates(): Promise<GateInfo[]>
MultiPhoneSync.assignGatePosition(gateId: string, distance: number): Promise<void>
MultiPhoneSync.startTiming(): Promise<void>
MultiPhoneSync.stopTiming(): Promise<MultiPhoneResult>

// Gate operations
MultiPhoneSync.joinAsGate(sessionCode: string): Promise<GateRole>
MultiPhoneSync.getSyncStatus(): Promise<SyncStatus>

// Events (both roles)
MultiPhoneSync.addListener('onGateConnected', (gate: GateInfo) => void)
MultiPhoneSync.addListener('onGateDisconnected', (gateId: string) => void)
MultiPhoneSync.addListener('onSyncUpdate', (sync: SyncStatus) => void)
MultiPhoneSync.addListener('onGateEvent', (event: GateEvent) => void)
```

### 14.3 Cloud API (Supabase)

#### Authentication
```
POST /auth/v1/signup
POST /auth/v1/token?grant_type=password
POST /auth/v1/token?grant_type=refresh_token
POST /auth/v1/logout
```

#### Data Sync
```
# Athletes
GET    /rest/v1/athletes?team_id=eq.{team_id}
POST   /rest/v1/athletes
PATCH  /rest/v1/athletes?id=eq.{id}
DELETE /rest/v1/athletes?id=eq.{id}

# Sessions
GET    /rest/v1/sessions?user_id=eq.{user_id}&order=date.desc
POST   /rest/v1/sessions
PATCH  /rest/v1/sessions?id=eq.{id}

# Reps
GET    /rest/v1/reps?session_id=eq.{session_id}&order=rep_number.asc
POST   /rest/v1/reps
PATCH  /rest/v1/reps?id=eq.{id}

# Evidence (metadata)
GET    /rest/v1/evidence?rep_id=eq.{rep_id}
POST   /rest/v1/evidence
```

#### File Storage
```
# Upload evidence clip
POST /storage/v1/object/evidence/{user_id}/{evidence_id}.mp4

# Get signed URL
POST /storage/v1/object/sign/evidence/{user_id}/{evidence_id}.mp4
```

---

## 15. Export & Sharing

### 15.1 Export Formats

#### CSV Export
```csv
Session: Morning Practice
Date: 2026-01-05
Mode: Fly 30
Location: Track Stadium

Rep,Athlete,Time (s),Splits,Confidence,Start Type,Notes
1,Marcus Johnson,3.42,"10m: 1.12, 20m: 2.28",High,Flying,
2,Sarah Williams,3.51,"10m: 1.15, 20m: 2.35",High,Flying,
3,Marcus Johnson,3.38,"10m: 1.10, 20m: 2.25",High,Flying,PR
...
```

#### PDF Report
- Header with session details
- Summary statistics (best, average, consistency)
- Individual rep table
- Optional: embedded evidence thumbnails
- Charts: trend over session, splits breakdown
- Branding: Track Speed logo

### 15.2 Sharing Options

| Share Type | Content | Access |
|------------|---------|--------|
| **Single Rep** | Time + evidence clip | Direct link, no auth |
| **Session Summary** | All reps, stats | Direct link, no auth |
| **Athlete Profile** | PRs, trends | Requires invite |
| **Team Dashboard** | Team stats | Team members only |

### 15.3 Share Link Structure
```
https://trackspeed.app/share/{share_type}/{share_id}?token={access_token}
```

---

## 16. Monetization Strategy

### 16.1 Tier Comparison

| Feature | Free | Pro ($9.99/mo) | Team ($29.99/mo) |
|---------|------|----------------|------------------|
| Single phone timing | ✓ | ✓ | ✓ |
| Reps per session | 10 | Unlimited | Unlimited |
| Sessions per month | 5 | Unlimited | Unlimited |
| Athletes | 3 | 25 | Unlimited |
| Timing modes | Basic (standing, fly) | All modes | All modes |
| Multi-phone splits | - | Up to 3 phones | Up to 5 phones |
| Accuracy mode | - | ✓ | ✓ |
| Evidence clips | Last 3 only | Unlimited | Unlimited |
| Evidence storage | 7 days | 90 days | 1 year |
| CSV export | - | ✓ | ✓ |
| PDF reports | - | ✓ | ✓ (branded) |
| Advanced analytics | - | ✓ | ✓ |
| Sharing | - | ✓ | ✓ |
| Team management | - | - | ✓ |
| Priority support | - | - | ✓ |

### 16.2 Pricing Strategy

- **Free tier:** Generous enough to demonstrate value, limited enough to encourage upgrade
- **Pro:** Target individual coaches and serious athletes
- **Team:** Target programs, clubs, and organizations
- **Annual discount:** 20% off (Pro: $95.88/yr, Team: $287.88/yr)

### 16.3 Conversion Funnel

```
Download → First Timing → Hit Free Limit → Upgrade Prompt
              ↓
         Evidence Value (see PR clip) → Upgrade Prompt
              ↓
         Multi-phone interest → Upgrade Prompt
```

---

## 17. Security & Privacy

### 17.1 Data Security

| Data Type | At Rest | In Transit | Access Control |
|-----------|---------|------------|----------------|
| User credentials | Hashed (bcrypt) | TLS 1.3 | Auth only |
| Personal data | Encrypted | TLS 1.3 | User + delegated |
| Session data | SQLite (local), encrypted (cloud) | TLS 1.3 | User + team |
| Evidence clips | File system (local), encrypted (cloud) | TLS 1.3 | User + shared |

### 17.2 Privacy Considerations

- **Athlete data:** Coaches own athlete data; athletes can request deletion
- **Video evidence:** Stored locally by default; cloud upload opt-in
- **Location:** Optional; used only for session context
- **Analytics:** Anonymized usage data only; no PII

### 17.3 Compliance

- GDPR: Data export, deletion requests, consent management
- COPPA: Parental consent for athletes under 13
- CCPA: California privacy rights

### 17.4 Permissions Required

| Permission | Platform | Purpose | Required |
|------------|----------|---------|----------|
| Camera | iOS/Android | Timing detection | Yes |
| Microphone | iOS/Android | Gun start detection | Optional |
| Local Network | iOS | Multi-phone sync | For splits |
| Photo Library | iOS/Android | Save evidence | Optional |
| Location | iOS/Android | Session location | Optional |

---

## 18. Validation & Trust

### 18.1 Accuracy Validation Plan

#### Phase 1: Internal Benchmarking
- Compare against Freelap timing system
- 100+ timed runs across conditions
- Document: mean bias, typical error, 95th percentile

#### Phase 2: External Validation
- Partner with university sports science program
- Independent testing protocol
- Published accuracy metrics

#### Phase 3: Continuous Monitoring
- In-app accuracy reporting (opt-in)
- Aggregate error statistics
- Model improvement based on real-world data

### 18.2 Trust Features

| Feature | Purpose |
|---------|---------|
| Confidence score | Tells users when to trust |
| Confidence reasons | Explains degradation |
| Evidence clips | Visual verification |
| Accuracy mode | Higher precision when needed |
| Setup validation | Prevents poor measurements |

### 18.3 Published Metrics

On website and in-app:
```
Track Speed Accuracy (validated against Freelap)
- Mean bias: +1.2ms
- Typical error: 8ms (standard conditions)
- 95th percentile error: 18ms
- Conditions: 60 FPS, good lighting, perpendicular angle
```

---

## 19. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Low light degrades accuracy** | High | Medium | Accuracy mode warnings, AI setup validation, minimum light threshold |
| **Device variability** | High | Medium | Capability detection, graceful degradation, device-specific calibration |
| **Clock drift (multi-phone)** | Medium | High | Continuous sync protocol, drift monitoring, sync quality indicator |
| **CV false positives** | Medium | Medium | Pose-based torso detection, confidence scoring, evidence review |
| **App Store rejection** | Low | High | Follow guidelines, no private APIs, thorough testing |
| **Competition (Photo Finish updates)** | Medium | Medium | Focus on differentiation (confidence, multi-phone, coach workflows) |
| **Model latency on older devices** | Medium | Medium | Frame skipping, reduced resolution mode, minimum device requirements |
| **User setup errors** | High | Medium | AI-assisted setup, visual guides, validation warnings |
| **Privacy concerns (video)** | Low | Medium | Local-first storage, clear consent, easy deletion |
| **Subscription fatigue** | Medium | Medium | Generous free tier, clear value proposition |

---

## 20. MVP Scope (90-Day Build)

### 20.1 MVP Features (Must-Have)

#### Core Timing
- [ ] Single phone finish line timing
- [ ] Standing start (movement-triggered)
- [ ] Fly 10 and Fly 30 modes
- [ ] 60 FPS detection (120 FPS stretch goal)
- [ ] Basic confidence indicator (High/Medium/Low)

#### Evidence
- [ ] Auto-captured 2-3s finish clips
- [ ] Finish line overlay on playback
- [ ] Save/delete clips
- [ ] Local storage with retention management

#### Session Management
- [ ] Create session with mode selection
- [ ] Rep list with times
- [ ] Session history
- [ ] Basic session export (CSV)

#### UX
- [ ] Camera setup with visual guides
- [ ] Real-time timing display
- [ ] Audio feedback (beep on capture)
- [ ] Basic settings

#### Platform
- [ ] iOS app (iPhone 12+ target)
- [ ] Android app (2021+ flagships target)
- [ ] React Native with native timing engine

### 20.2 MVP Features (Nice-to-Have)

- [ ] Two-phone split timing
- [ ] Gun start detection
- [ ] Detailed confidence reasons
- [ ] Athlete profiles
- [ ] Voice announcements

### 20.3 Post-MVP (v1.1+)

- Multi-phone (3+ gates)
- Block start mode
- Advanced analytics
- Team features
- Cloud sync
- Sharing

### 20.4 MVP Timeline

| Week | Focus |
|------|-------|
| 1-2 | Project setup, native module scaffolding, camera integration |
| 3-4 | Pose detection integration, torso tracking |
| 5-6 | Timing logic, crossing detection, basic UI |
| 7-8 | Evidence capture, playback, storage |
| 9-10 | Session management, rep logging, confidence scoring |
| 11-12 | Polish, testing, performance optimization |
| 13 | Beta testing, bug fixes |

---

## 21. Roadmap

### Phase 1: Foundation (Months 1-3)
- MVP launch (iOS + Android)
- Core timing functionality
- Evidence capture
- Basic session management

### Phase 2: Expansion (Months 4-6)
- Multi-phone splits (2 phones)
- All timing modes
- Athlete profiles
- Advanced confidence scoring
- Pro subscription launch

### Phase 3: Scale (Months 7-9)
- Multi-phone (3-5 gates)
- Team features
- Cloud sync
- Analytics dashboard
- Team subscription launch

### Phase 4: Intelligence (Months 10-12)
- AI insights (fatigue, bottlenecks)
- Season trends
- Comparative analytics
- API for integrations
- Hardware gate compatibility research

### Long-Term Vision (Year 2+)
- Official timing system partnerships
- Wearable integration (for reaction time)
- Biomechanics hints (non-claim)
- International expansion
- Enterprise features

---

## 22. Appendices

### Appendix A: Competitive Analysis

| Feature | Track Speed | Photo Finish | Freelap | SKLZ SPARQ |
|---------|---------------|--------------|---------|------------|
| Platform | iOS + Android | iOS | Hardware | Hardware |
| Price | Free-$30/mo | $5 one-time | $500+ | $200+ |
| Frame Rate | 60-240 FPS | 30 FPS | N/A (laser) | N/A |
| Confidence Score | Yes | No | N/A | No |
| Evidence Clips | Yes | Limited | No | No |
| Multi-Gate Splits | Yes (phones) | No | Yes ($$) | Limited |
| Offline | Yes | Yes | Yes | Yes |
| Athlete Management | Yes | Basic | No | No |
| Accuracy (claimed) | <10ms typical | ~30ms | <1ms | ~10ms |

### Appendix B: Device Requirements

#### iOS
- **Minimum:** iPhone 11, iOS 15+
- **Recommended:** iPhone 12+, iOS 16+
- **Accuracy Mode:** iPhone 12 Pro+ (120 FPS), iPhone 14 Pro+ (240 FPS)

#### Android
- **Minimum:** Android 10, camera2 API support, 60 FPS capable
- **Recommended:** 2021+ flagship (Pixel 6+, Samsung S21+, etc.)
- **Accuracy Mode:** 120 FPS capable device

### Appendix C: Glossary

| Term | Definition |
|------|------------|
| **FAT** | Fully Automatic Timing - official competition standard |
| **Fly time** | Time through a zone at maximum velocity (no acceleration phase) |
| **Split** | Intermediate time at a distance marker |
| **Torso** | Center of mass approximation using shoulder/hip landmarks |
| **Confidence** | Measure of timing measurement quality |
| **Evidence** | Video clip capturing the finish line crossing |
| **Gate** | A timing point in multi-phone setup |
| **Host** | Primary phone controlling a multi-phone session |

### Appendix D: References

- World Athletics Competition Rules (timing standards)
- Apple Vision Framework Documentation
- MediaPipe Pose Documentation
- React Native Performance Best Practices
- WebRTC Data Channels Specification

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-05 | - | Initial PRD |

---

*This document is confidential and intended for internal use only.*
