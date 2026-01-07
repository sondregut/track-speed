import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { spacing, borderRadius, typography, darkColors } from '../constants/theme';
import { useTheme } from '../contexts';
import { CameraPreview, GateLine, PoseOverlay } from '../components/camera';
import { TimerDisplay, StartButton, ResultCard } from '../components/timing';
import { Header, IconButton, Button } from '../components/ui';
import { useTimer, useKeepAwake, useHaptics, useSound, useAutoTiming, useSyncConnection, useSoundDetection, useVisionPose } from '../hooks';
import { useSessionStore, useSettingsStore, useTimingStore } from '../stores';
import { Athlete, TimingResult } from '../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TimerScreenProps {
  navigation: any;
}

export function TimerScreen({ navigation }: TimerScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme(); // Use themed colors for indicators
  const { currentSession, athletes, selectedAthleteId, selectAthlete } = useSessionStore();
  const { timing: timingSettings } = useSettingsStore();
  const { results, resetTimer } = useTimingStore();
  const { trigger } = useHaptics();
  const { play } = useSound();

  // Manual timing hook (fallback)
  const manualTimer = useTimer();

  // Auto timing hook (when enabled)
  const autoTiming = useAutoTiming(0.7); // Gate at 70% of screen height

  // Sound detection for clap/gun start
  const soundDetection = useSoundDetection({ threshold: 0.25 });

  // Multi-device sync (declare before handleGateCrossing which uses it)
  const sync = useSyncConnection({ deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android' });

  // Track timer start time for Vision pose detection
  const timerStartTimeRef = useRef<number | null>(null);

  // Vision pose detection callback - triggers when torso crosses gate
  const handleGateCrossing = useCallback((crossingTimeMs: number, confidence: number) => {
    if (manualTimer.state !== 'running') return;

    // Calculate elapsed time from start
    const startTime = timerStartTimeRef.current;
    if (!startTime) return;

    const elapsedMs = crossingTimeMs - startTime;

    // Auto-stop the timer
    trigger('success');
    play('stop');

    // Broadcast to connected devices
    if (sync.isSynced && sync.deviceRole === 'finish') {
      sync.sendStop(elapsedMs);
    }

    manualTimer.stop({
      time_ms: elapsedMs,
      source: 'auto_detected',
      confidence: confidence,
      startMethod: timingSettings.defaultStartMethod,
      frameNumber: 0,
    });
  }, [manualTimer, trigger, play, sync, timingSettings.defaultStartMethod]);

  // Native iOS Vision pose detection (gate at 50% = center of screen)
  const visionPose = useVisionPose({
    gateLineX: 0.5,
    minConfidence: 0.5,
    enabled: timingSettings.autoDetectionEnabled && manualTimer.state === 'running',
    onGateCrossing: handleGateCrossing,
  });
  const remoteStartTime = useRef<number | null>(null);
  const [splitTimes, setSplitTimes] = useState<number[]>([]);

  // Athlete queue state
  const [athleteQueue, setAthleteQueue] = useState<string[]>([]);
  const [currentAthleteIndex, setCurrentAthleteIndex] = useState(0);

  // Get current athlete
  const currentAthlete = useMemo(() => {
    if (selectedAthleteId) {
      return athletes.find(a => a.id === selectedAthleteId);
    }
    if (athleteQueue.length > 0) {
      return athletes.find(a => a.id === athleteQueue[currentAthleteIndex]);
    }
    return null;
  }, [selectedAthleteId, athletes, athleteQueue, currentAthleteIndex]);

  // Get athlete results for current session
  const athleteResults = useMemo(() => {
    const resultsByAthlete: Record<string, TimingResult[]> = {};
    results.forEach(result => {
      const athleteId = result.athleteId || 'unknown';
      if (!resultsByAthlete[athleteId]) {
        resultsByAthlete[athleteId] = [];
      }
      resultsByAthlete[athleteId].push(result);
    });
    return resultsByAthlete;
  }, [results]);

  // Use native Vision pose detection when available, fall back to mock auto-timing
  const useNativeVision = visionPose.isAvailable && timingSettings.autoDetectionEnabled;
  const useMockAutoDetection = !useNativeVision && timingSettings.autoDetectionEnabled && autoTiming.isReady;
  const useSoundStart = currentSession?.startMethod === 'sound_detection';

  // Always use manual timer for state - Vision pose just triggers the stop
  const state = useMockAutoDetection ? autoTiming.timerState : manualTimer.state;

  // Debug: log session state
  useEffect(() => {
    console.log('Session debug:', {
      hasSession: !!currentSession,
      startMethod: currentSession?.startMethod,
      useSoundStart,
      timerState: state,
    });
  }, [currentSession, useSoundStart, state]);
  const elapsedTime = useMockAutoDetection ? autoTiming.elapsedTime : manualTimer.elapsedTime;
  const isRunning = state === 'running';

  // Vision Camera setup
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(cameraPosition);

  // Flip camera handler
  const handleFlipCamera = useCallback(() => {
    setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
  }, []);

  // Select format that supports high FPS for better timing accuracy
  const format = useCameraFormat(device, [
    { fps: 60 },
    { videoResolution: { width: 1920, height: 1080 } },
  ]);

  // Use the format's max FPS (capped at 60)
  const targetFps = format ? Math.min(format.maxFps, 60) : 30;

  const [cameraReady, setCameraReady] = useState(false);
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();

  // Sound detection trigger - when sound detected in ready state, START the timer
  useEffect(() => {
    if (useSoundStart && soundDetection.soundDetected && state === 'ready') {
      console.log('Sound detected! Starting timer...');
      // Record start time for pose detection
      timerStartTimeRef.current = Date.now();
      // Actually start the timer now
      trigger('medium');
      play('start');
      manualTimer.start(timingSettings.defaultStartMethod);
      soundDetection.resetDetection();
    }
  }, [soundDetection.soundDetected, useSoundStart, state, manualTimer, trigger, play, timingSettings.defaultStartMethod]);

  // Start sound detection when in ready state
  useEffect(() => {
    if (useSoundStart && state === 'ready' && !soundDetection.isListening) {
      soundDetection.startListening();
    } else if (!useSoundStart || state !== 'ready') {
      if (soundDetection.isListening) {
        soundDetection.stopListening();
      }
    }
  }, [useSoundStart, state, soundDetection.isListening]);

  // Handle incoming sync events
  useEffect(() => {
    if (sync.lastTimingEvent) {
      const event = sync.lastTimingEvent;

      switch (event.type) {
        case 'start':
          // Remote device started timing - start our timer too
          remoteStartTime.current = event.timestamp;
          trigger('medium');
          play('start');
          manualTimer.start(timingSettings.defaultStartMethod);
          break;

        case 'stop':
          // Remote device detected finish - record the time
          trigger('success');
          play('stop');
          if (event.data?.time_ms) {
            manualTimer.stop({
              time_ms: event.data.time_ms,
              source: 'auto_detected', // Use valid source type
              confidence: event.data.confidence ?? null,
              startMethod: timingSettings.defaultStartMethod,
              frameNumber: event.data.frameNumber ?? 0,
            });
          }
          break;

        case 'split':
          // Remote device recorded a split
          if (event.data?.time_ms) {
            setSplitTimes((prev) => [...prev, event.data!.time_ms!]);
            trigger('light');
          }
          break;

        case 'reset':
          // Remote device reset
          manualTimer.reset();
          remoteStartTime.current = null;
          setSplitTimes([]);
          break;
      }
    }
  }, [sync.lastTimingEvent]);

  // Keep screen awake during timing
  useKeepAwake(isRunning);

  // Get the last result for display
  const lastResult = results.length > 0 ? results[results.length - 1] : null;

  const handleStart = useCallback(() => {
    // For sound detection mode, go to 'ready' state and wait for sound
    if (useSoundStart) {
      console.log('Sound mode: Setting state to ready, waiting for sound...');
      // Reset Vision pose tracking
      if (useNativeVision) {
        visionPose.reset();
      }
      // Set to ready state - sound detection will start listening
      manualTimer.setState('ready');
      trigger('light');
      return;
    }

    // Record start time for Vision pose detection
    timerStartTimeRef.current = Date.now();

    // Reset Vision pose tracking
    if (useNativeVision) {
      visionPose.reset();
    }

    // Broadcast start to connected devices (if this is the start gate)
    if (sync.isSynced && sync.deviceRole === 'start') {
      sync.sendStart();
    }

    if (useMockAutoDetection) {
      autoTiming.start();
    } else {
      trigger('medium');
      play('start');
      manualTimer.start(timingSettings.defaultStartMethod);
    }
  }, [useNativeVision, useMockAutoDetection, useSoundStart, visionPose, autoTiming, manualTimer, trigger, play, timingSettings.defaultStartMethod, sync]);

  // Manual stop - always available as override even when auto-detection is on
  const handleStop = useCallback(() => {
    const stopTime = useMockAutoDetection ? autoTiming.elapsedTime : manualTimer.elapsedTime;

    // Broadcast stop to connected devices (if this is the finish gate)
    if (sync.isSynced && sync.deviceRole === 'finish') {
      sync.sendStop(stopTime);
    }

    if (useMockAutoDetection) {
      autoTiming.stop();
    } else {
      trigger('success');
      play('stop');
      manualTimer.stop({
        time_ms: stopTime,
        source: useNativeVision ? 'manual_override' : (sync.isSynced ? 'auto_detected' : 'manual_only'),
        confidence: null,
        startMethod: timingSettings.defaultStartMethod,
        frameNumber: 0,
      });
    }

    // Clear start time
    timerStartTimeRef.current = null;
  }, [useNativeVision, useMockAutoDetection, autoTiming, manualTimer, trigger, play, timingSettings.defaultStartMethod, sync]);

  const handleReset = useCallback(() => {
    trigger('light');

    // Broadcast reset to connected devices
    if (sync.isSynced) {
      sync.sendReset();
    }

    if (useMockAutoDetection) {
      autoTiming.reset();
    }

    // Reset Vision pose tracking
    if (useNativeVision) {
      visionPose.reset();
    }

    manualTimer.reset();
    remoteStartTime.current = null;
    timerStartTimeRef.current = null;
    setSplitTimes([]);
  }, [trigger, useNativeVision, useMockAutoDetection, visionPose, autoTiming, manualTimer, sync]);

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  // Retry the last run (reset timer but keep same athlete)
  const handleRetryRun = useCallback(() => {
    trigger('light');
    handleReset();
  }, [trigger, handleReset]);

  // Move to next athlete in queue
  const handleNextAthlete = useCallback(() => {
    trigger('light');
    handleReset();

    if (athleteQueue.length > 0) {
      const nextIndex = (currentAthleteIndex + 1) % athleteQueue.length;
      setCurrentAthleteIndex(nextIndex);
      selectAthlete(athleteQueue[nextIndex]);
    } else if (athletes.length > 0) {
      // Find current athlete index and move to next
      const currentIndex = athletes.findIndex(a => a.id === selectedAthleteId);
      const nextIndex = (currentIndex + 1) % athletes.length;
      selectAthlete(athletes[nextIndex].id);
    }
  }, [trigger, handleReset, athleteQueue, currentAthleteIndex, athletes, selectedAthleteId, selectAthlete]);

  // Select a specific athlete
  const handleSelectAthlete = useCallback((athleteId: string) => {
    selectAthlete(athleteId);
    if (state !== 'idle') {
      handleReset();
    }
  }, [selectAthlete, state, handleReset]);

  // Request camera permission if needed
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  return (
    <View style={styles.container}>
      {/* Camera Background - Use Vision Camera when native detection available */}
      {useNativeVision && device ? (
        <View style={StyleSheet.absoluteFill}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={true}
            frameProcessor={visionPose.frameProcessor}
            fps={targetFps}
            onInitialized={handleCameraReady}
          />
          {/* Gate Line Overlay - at 50% (center) for Vision pose */}
          <GateLine position={0.5} />
          {/* Show torso position indicator when detected */}
          {visionPose.isDetected && visionPose.torsoCenter && (
            <View
              style={[
                styles.torsoIndicator,
                {
                  left: `${visionPose.torsoCenter.x * 100}%`,
                  top: `${visionPose.torsoCenter.y * 100}%`,
                },
              ]}
            />
          )}
        </View>
      ) : (
        <CameraPreview onCameraReady={handleCameraReady}>
          {/* Gate Line Overlay */}
          <GateLine position={0.7} />
        </CameraPreview>
      )}

      {/* Header Overlay */}
      <Header
        title="Timer"
        subtitle={currentSession?.name || 'Quick Session'}
        transparent
        leftAction={
          <IconButton
            icon={<View style={styles.backIcon} />}
            onPress={() => navigation.goBack()}
            variant="ghost"
          />
        }
        rightAction={
          <TouchableOpacity style={styles.flipCameraButton} onPress={handleFlipCamera}>
            <Text style={styles.flipCameraIcon}>⟳</Text>
          </TouchableOpacity>
        }
      />

      {/* Timer Overlay */}
      <View style={[styles.timerOverlay, { bottom: insets.bottom + 20 }]}>
        {/* Timer Display - Glass effect on iOS 26+ */}
        {useGlassUI ? (
          <GlassView style={styles.timerGlass} glassEffectStyle="regular">
            <TimerDisplay
              time={elapsedTime}
              state={state}
              size="large"
              showMilliseconds={true}
            />
          </GlassView>
        ) : (
          <View style={styles.timerFallback}>
            <TimerDisplay
              time={elapsedTime}
              state={state}
              size="large"
              showMilliseconds={true}
            />
          </View>
        )}

        {/* Current Athlete Display */}
        {currentAthlete && (
          <View style={styles.currentAthleteContainer}>
            <Text style={styles.currentAthleteLabel}>Currently Running</Text>
            <Text style={styles.currentAthleteName}>{currentAthlete.name}</Text>
          </View>
        )}

        <View style={styles.controls}>
          <StartButton
            state={state}
            onStart={handleStart}
            onStop={handleStop}
            onReset={handleReset}
            disabled={!cameraReady}
          />
        </View>

        {/* Retry / Next Athlete Buttons */}
        {(state === 'stopped' || state === 'idle') && athletes.length > 0 && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRetryRun}
            >
              <Text style={styles.actionButtonIcon}>↺</Text>
              <Text style={styles.actionButtonText}>Retry run</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleNextAthlete}
            >
              <Text style={styles.actionButtonIcon}>▶</Text>
              <Text style={styles.actionButtonText}>Next athlete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status indicators */}
        <View style={styles.statusIndicators}>
          {/* Sound detection indicator */}
          {useSoundStart && (
            <View style={styles.autoIndicator}>
              <View style={[
                styles.autoIndicatorDot,
                { backgroundColor: soundDetection.isListening ? colors.timing.ready : colors.gray[500] }
              ]} />
              <Text style={styles.autoIndicatorText}>
                {soundDetection.isListening ? 'Listening for Sound' : 'Sound Detection'}
              </Text>
              {soundDetection.isListening && (
                <View style={[styles.audioLevelBar, { width: `${soundDetection.audioLevel * 100}%` }]} />
              )}
            </View>
          )}

          {/* Sync status indicator */}
          {sync.connectionState !== 'disconnected' && (
            <View style={styles.autoIndicator}>
              <View style={[
                styles.autoIndicatorDot,
                { backgroundColor: sync.isSynced ? colors.timing.ready : colors.warning[500] }
              ]} />
              <Text style={styles.autoIndicatorText}>
                {sync.isSynced
                  ? `Synced (${sync.deviceRole})`
                  : sync.connectionState === 'syncing'
                  ? 'Syncing...'
                  : 'Connected'}
              </Text>
              {sync.isSynced && (
                <Text style={styles.fpsText}>{sync.syncAccuracy.toFixed(1)}ms</Text>
              )}
            </View>
          )}

          {/* Vision Pose Detection indicator (native iOS) */}
          {useNativeVision && (
            <View style={styles.autoIndicator}>
              <View style={[
                styles.autoIndicatorDot,
                { backgroundColor: visionPose.isDetected ? colors.timing.ready : colors.gray[500] }
              ]} />
              <Text style={styles.autoIndicatorText}>
                {visionPose.isDetected
                  ? `Torso Detected (${visionPose.confidence.toFixed(0)}%)`
                  : 'Waiting for athlete...'}
              </Text>
              {visionPose.fps > 0 && (
                <Text style={styles.fpsText}>{visionPose.fps} fps</Text>
              )}
              {visionPose.processingTimeMs > 0 && (
                <Text style={styles.fpsText}>{visionPose.processingTimeMs.toFixed(1)}ms</Text>
              )}
            </View>
          )}

          {/* Fallback Auto-detection indicator (mock) */}
          {useMockAutoDetection && (
            <View style={styles.autoIndicator}>
              <View style={[
                styles.autoIndicatorDot,
                { backgroundColor: autoTiming.isReady ? colors.timing.ready : colors.gray[500] }
              ]} />
              <Text style={styles.autoIndicatorText}>
                {autoTiming.isReady ? 'Auto Detection Ready' : 'Auto Detection Off'}
              </Text>
              {autoTiming.fps > 0 && (
                <Text style={styles.fpsText}>{autoTiming.fps} fps</Text>
              )}
            </View>
          )}
        </View>

        {/* Split times display */}
        {splitTimes.length > 0 && (
          <View style={styles.splitContainer}>
            {splitTimes.map((time, index) => (
              <View key={index} style={styles.splitRow}>
                <Text style={styles.splitLabel}>Split {index + 1}</Text>
                <Text style={styles.splitTime}>{(time / 1000).toFixed(3)}s</Text>
              </View>
            ))}
          </View>
        )}

        {/* Show result card when stopped */}
        {state === 'stopped' && lastResult && (
          <View style={styles.resultContainer}>
            {useGlassUI ? (
              <GlassView style={styles.resultGlass} glassEffectStyle="clear">
                <ResultCard
                  result={lastResult}
                  distance={currentSession?.distance}
                  showDetails={true}
                />
              </GlassView>
            ) : (
              <ResultCard
                result={lastResult}
                distance={currentSession?.distance}
                showDetails={true}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// Camera overlay screens always use dark colors for visibility
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.black,
  },
  timerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  timerGlass: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    minWidth: 280,
  },
  timerFallback: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    minWidth: 280,
    backgroundColor: darkColors.black + 'B0',
  },
  controls: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  resultContainer: {
    marginTop: spacing.lg,
    width: '100%',
  },
  resultGlass: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  backIcon: {
    width: 24,
    height: 24,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: darkColors.white,
    transform: [{ rotate: '45deg' }],
  },
  statusIndicators: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
  },
  autoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: darkColors.black + '80',
    borderRadius: borderRadius.full,
  },
  autoIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  autoIndicatorText: {
    fontSize: typography.fontSize.sm,
    color: darkColors.white,
  },
  fpsText: {
    fontSize: typography.fontSize.xs,
    color: darkColors.gray[400],
    marginLeft: spacing.sm,
  },
  splitContainer: {
    marginTop: spacing.md,
    backgroundColor: darkColors.black + '80',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  splitLabel: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
  },
  splitTime: {
    fontSize: typography.fontSize.base,
    fontWeight: '600' as const,
    color: darkColors.white,
  },
  // Current athlete styles
  currentAthleteContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: darkColors.black + '80',
    borderRadius: borderRadius.lg,
  },
  currentAthleteLabel: {
    fontSize: typography.fontSize.xs,
    color: darkColors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  currentAthleteName: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700' as const,
    color: darkColors.white,
    marginTop: spacing.xs,
  },
  // Action buttons (retry/next)
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: darkColors.black + '80',
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  actionButtonIcon: {
    fontSize: typography.fontSize.lg,
    color: darkColors.white,
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    color: darkColors.white,
  },
  // Audio level indicator
  audioLevelBar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2,
    backgroundColor: darkColors.timing.ready,
    borderRadius: 1,
  },
  // Torso position indicator for Vision pose detection
  torsoIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: darkColors.timing.ready,
    borderWidth: 3,
    borderColor: darkColors.white,
    transform: [{ translateX: -10 }, { translateY: -10 }],
    shadowColor: darkColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  // Flip camera button
  flipCameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: darkColors.black + '80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipCameraIcon: {
    fontSize: 24,
    color: darkColors.white,
  },
});
