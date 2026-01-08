import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission, PhotoFile } from 'react-native-vision-camera';
import { File, Directory, Paths } from 'expo-file-system';
import { spacing, borderRadius, typography, darkColors } from '../constants/theme';
import { useTheme } from '../contexts';
import { CameraPreview, GateLine, PoseOverlay } from '../components/camera';
import { TimerDisplay, StartButton, ResultCard } from '../components/timing';
import { Header, IconButton, Button } from '../components/ui';
import { useTimer, useKeepAwake, useHaptics, useSound, useAutoTiming, useSyncConnection, useSoundDetection, useVisionPose, useDeviceStability } from '../hooks';
import { useSessionStore, useSettingsStore, useTimingStore } from '../stores';
import { Athlete, TimingResult } from '../types';

// Common sprint distances in meters
const DISTANCE_OPTIONS = [10, 20, 30, 40, 50, 60, 100] as const;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function TimerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme(); // Use themed colors for indicators
  const { currentSession, athletes, selectedAthleteId, selectAthlete } = useSessionStore();
  const { timing: timingSettings } = useSettingsStore();
  const { results, resetTimer, updateResult, currentRunConfig, updateRunConfig, currentResult } = useTimingStore();
  const { trigger } = useHaptics();
  const { play } = useSound();

  // Camera ref for photo capture
  const cameraRef = useRef<Camera>(null);

  // Distance configuration state
  const [selectedDistance, setSelectedDistance] = useState<number>(currentRunConfig?.distance_m || 40);
  const [showDistancePicker, setShowDistancePicker] = useState(false);

  // Manual timing hook (fallback)
  const manualTimer = useTimer();

  // Auto timing hook (when enabled)
  const autoTiming = useAutoTiming(0.7); // Gate at 70% of screen height

  // Sound detection for clap/gun start
  const soundDetection = useSoundDetection({ threshold: 0.50 });

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

    // Start frame buffer capture - keep frame processor running for 1 second
    // to collect post-crossing frames for review feature
    // Using ref for SYNCHRONOUS update - critical to avoid race condition with timer stop
    isCapturingFrameBufferRef.current = true;
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
    }
    captureTimeoutRef.current = setTimeout(() => {
      isCapturingFrameBufferRef.current = false;
      forceRender(n => n + 1); // Trigger re-render to update enabled prop
    }, 1000); // 1 second should be enough for 0.5s post-crossing capture

    // Auto-stop the timer
    trigger('success');
    play('stop');

    // Broadcast to connected devices
    if (sync.isSynced && sync.deviceRole === 'finish') {
      sync.sendStop(elapsedMs);
    }

    // Safe to stop timer immediately now - isCapturingFrameBufferRef.current is already true
    // so the enabled prop will include it in the next render
    manualTimer.stop({
      time_ms: elapsedMs,
      source: 'auto_detected',
      confidence: confidence,
      startMethod: timingSettings.defaultStartMethod,
      frameNumber: 0,
      distance_m: selectedDistance,
    });
  }, [manualTimer, trigger, play, sync, timingSettings.defaultStartMethod, selectedDistance]);

  // Callback for crossing frame capture (finish photo with overlays)
  const handleCrossingFrame = useCallback((frameBase64: string) => {
    console.log('[Timer] Crossing frame captured, size:', frameBase64.length);
    // Store the frame for later - will be saved when result is created
    crossingFrameRef.current = frameBase64;
  }, []);

  // Ref to store captured crossing frame
  const crossingFrameRef = useRef<string | null>(null);

  // Callback for frame buffer ready (for manual review)
  const handleFrameBufferReady = useCallback((folderPath: string, frameCount: number, aiFrameIndex: number) => {
    console.log('[Timer] Frame buffer ready:', { folderPath, frameCount, aiFrameIndex });
    // Store for navigation to review screen
    frameBufferRef.current = { folderPath, frameCount, aiFrameIndex };

    // CRITICAL: Also update the result directly in the store
    // This handles the race condition where the callback fires AFTER navigation
    if (pendingResultIdRef.current) {
      console.log('[Timer] Updating result with frame buffer info (async):', pendingResultIdRef.current);
      updateResult(pendingResultIdRef.current, {
        frameBufferPath: folderPath,
        frameBufferCount: frameCount,
        aiFrameIndex: aiFrameIndex,
      });
      pendingResultIdRef.current = null; // Clear after updating
    }

    // Frame buffer capture is complete - stop the capture timer
    isCapturingFrameBufferRef.current = false;
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    forceRender(n => n + 1); // Trigger re-render to update enabled prop
  }, [updateResult]);

  // Ref to store frame buffer info
  const frameBufferRef = useRef<{ folderPath: string; frameCount: number; aiFrameIndex: number } | null>(null);

  // Ref to store the pending result ID for frame buffer callback
  // This handles the race condition where the callback fires AFTER navigation
  const pendingResultIdRef = useRef<string | null>(null);

  // Ref to keep frame processor running during post-crossing frame capture
  // Using a ref (not state) because it updates SYNCHRONOUSLY - critical for avoiding
  // race condition where manualTimer.stop() triggers re-render before state update applies
  const isCapturingFrameBufferRef = useRef(false);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // State to trigger re-render when capture ends (ref changes don't trigger re-renders)
  const [, forceRender] = useState(0);

  // Device stability detection (phone must be still and vertical)
  const deviceStability = useDeviceStability({ autoStart: true });

  // Native iOS Vision pose detection (gate at 50% = center of screen)
  // Keep frame processor running during frame buffer capture (after crossing)
  const visionPose = useVisionPose({
    gateLineX: 0.5,
    minConfidence: 0.5,
    enabled: timingSettings.autoDetectionEnabled && (manualTimer.state === 'running' || isCapturingFrameBufferRef.current),
    onGateCrossing: handleGateCrossing,
    captureOnCrossing: true,  // Enable finish photo capture with overlays
    enableFrameBuffer: true,  // Enable frame buffer for manual review
    onCrossingFrame: handleCrossingFrame,
    onFrameBufferReady: handleFrameBufferReady,
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
      useNativeVision,
      visionAvailable: visionPose.isAvailable,
      autoDetectionEnabled: timingSettings.autoDetectionEnabled,
    });
  }, [currentSession, useSoundStart, state, useNativeVision, visionPose.isAvailable, timingSettings.autoDetectionEnabled]);
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

  // Select format that supports highest FPS for better timing accuracy
  // iOS devices support: 30, 60, 120 (iPhone 8+), 240 (iPhone 8+ slo-mo)
  // At 240fps: ~4.17ms per frame = sub-frame interpolation to ~1ms accuracy
  // At 120fps: ~8.33ms per frame = sub-frame interpolation to ~2ms accuracy
  const format = useCameraFormat(device, [
    { fps: 240 },  // Request highest available (falls back gracefully)
    { videoResolution: { width: 1280, height: 720 } }, // Lower res for high FPS
  ]);

  // Use the format's max FPS - higher is better for timing precision
  // Note: Frame processor must complete in time (240fps = 4ms budget)
  const targetFps = format?.maxFps || 60;

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

  // Photo capture function - uses AI-captured crossing frame with overlays when available
  const captureFinishPhoto = useCallback(async (resultId: string): Promise<void> => {
    try {
      // Create photos directory if needed
      const fileName = `finish_${resultId}_${Date.now()}.jpg`;
      const photosDir = new Directory(Paths.document, 'photos');

      if (!photosDir.exists) {
        photosDir.create();
      }

      const destFile = new File(photosDir, fileName);

      // Check if we have an AI-captured crossing frame with overlays
      if (crossingFrameRef.current) {
        console.log('[Timer] Using AI crossing frame with overlays');

        // Decode base64 and write to file
        // The frame already has gate line + torso indicator drawn on it
        const base64Data = crossingFrameRef.current;

        // Write base64 data to file (expo-file-system/next handles this)
        await destFile.write(base64Data, { encoding: 'base64' });

        // Clear the ref for next capture
        crossingFrameRef.current = null;

        // Update the result with the photo URI
        updateResult(resultId, { finishPhotoUri: destFile.uri });
        console.log('[Timer] Finish photo with overlays saved:', destFile.uri);
        return;
      }

      // Fallback: take a snapshot if no AI frame available
      if (!cameraRef.current) {
        console.log('[Timer] No camera ref and no AI frame available');
        return;
      }

      console.log('[Timer] Falling back to camera snapshot (no AI frame)');
      const photo = await cameraRef.current.takeSnapshot({
        quality: 85,
      });

      // Copy from temp location to permanent storage
      const sourceFile = new File(photo.path);
      await sourceFile.copy(destFile);

      // Update the result with the photo URI
      updateResult(resultId, { finishPhotoUri: destFile.uri });
      console.log('[Timer] Finish photo (snapshot fallback) saved:', destFile.uri);
    } catch (error) {
      console.error('[Timer] Failed to capture finish photo:', error);
    }
  }, [updateResult]);

  // Navigate to RunResultScreen when timer stops with a new result
  const hasNavigatedRef = useRef<string | null>(null);
  const navigationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('Navigation effect:', { state, currentResultId: currentResult?.id, hasNavigated: hasNavigatedRef.current });

    // Navigate when we have a stopped state with a result we haven't navigated to yet
    if (state === 'stopped' && currentResult && hasNavigatedRef.current !== currentResult.id) {
      console.log('Navigating to RunResult:', currentResult.id);
      hasNavigatedRef.current = currentResult.id;

      // CRITICAL: Store the result ID for the async frame buffer callback
      // This allows handleFrameBufferReady to update the result even after navigation
      pendingResultIdRef.current = currentResult.id;

      // Capture photo immediately when timer stops
      captureFinishPhoto(currentResult.id);

      // Save frame buffer info for manual review (Photo Finish style)
      // This handles the case where frame buffer is already ready (synchronous)
      if (frameBufferRef.current) {
        console.log('[Timer] Saving frame buffer info (sync):', frameBufferRef.current);
        updateResult(currentResult.id, {
          frameBufferPath: frameBufferRef.current.folderPath,
          frameBufferCount: frameBufferRef.current.frameCount,
          aiFrameIndex: frameBufferRef.current.aiFrameIndex,
        });
        frameBufferRef.current = null; // Clear after saving
        pendingResultIdRef.current = null; // Already saved, no need for async update
      }

      // Store result ID to use in timeout (avoid closure issues)
      const resultId = currentResult.id;

      // Clear any existing timer
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }

      // Small delay to ensure the photo is captured
      // Use ref so cleanup doesn't cancel this
      navigationTimerRef.current = setTimeout(() => {
        navigationTimerRef.current = null;
        try {
          console.log('Attempting navigation to RunResult...');
          // Navigate to run-result screen with resultId param
          router.push(`/run-result?resultId=${resultId}`);
          console.log('Navigation completed');
        } catch (error) {
          console.error('Navigation error:', error);
        }
      }, 300);
    }
    // Don't return cleanup - we want the navigation to complete even if effect re-runs
  }, [state, currentResult, router, captureFinishPhoto]);

  // Reset navigation tracking when timer resets to idle
  useEffect(() => {
    if (state === 'idle') {
      hasNavigatedRef.current = null;
    }
  }, [state]);

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
        distance_m: selectedDistance,
      });
    }

    // Clear start time
    timerStartTimeRef.current = null;
  }, [useNativeVision, useMockAutoDetection, autoTiming, manualTimer, trigger, play, timingSettings.defaultStartMethod, sync, selectedDistance]);

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

    // Clear frame capture refs for next run
    crossingFrameRef.current = null;
    frameBufferRef.current = null;
    pendingResultIdRef.current = null;
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
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={true}
            video={true}
            photo={true}
            pixelFormat="yuv"
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

      {/* Stability Border Overlay - shows red/yellow/green based on phone position */}
      {deviceStability.isSupported && state === 'idle' && (
        <View
          style={[
            styles.stabilityBorder,
            {
              borderColor: deviceStability.isReady
                ? darkColors.timing.success
                : deviceStability.isStable
                ? darkColors.timing.warning
                : darkColors.timing.error,
            },
          ]}
          pointerEvents="none"
        >
          {/* Setup instructions when not ready */}
          {!deviceStability.isReady && (
            <View style={styles.stabilityOverlay}>
              <View style={styles.stabilityInstructions}>
                <Text style={styles.stabilityIcon}>
                  {deviceStability.isStable ? '⟳' : '⏸'}
                </Text>
                <Text style={styles.stabilityTitle}>
                  {deviceStability.message}
                </Text>
                <Text style={styles.stabilitySubtitle}>
                  {deviceStability.isStable
                    ? `Tilt: ${deviceStability.tiltAngle.toFixed(1)}°`
                    : 'Mount phone on tripod or stable surface'}
                </Text>
                {/* Stability score */}
                <View style={styles.stabilityScoreBar}>
                  <View
                    style={[
                      styles.stabilityScoreFill,
                      {
                        width: `${deviceStability.overallScore}%`,
                        backgroundColor: deviceStability.isReady
                          ? darkColors.timing.success
                          : deviceStability.isStable
                          ? darkColors.timing.warning
                          : darkColors.timing.error,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Ready badge when device is properly set up */}
      {deviceStability.isSupported && deviceStability.isReady && state === 'idle' && (
        <View style={styles.readyBadge}>
          <Text style={styles.readyBadgeText}>Ready</Text>
        </View>
      )}

      {/* Header Overlay */}
      <Header
        title="Timer"
        subtitle={currentSession?.name || 'Quick Session'}
        transparent
        leftAction={
          <IconButton
            icon={<View style={styles.backIcon} />}
            onPress={() => router.back()}
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

        {/* Distance Selector - tap to change */}
        <TouchableOpacity
          style={styles.distanceSelector}
          onPress={() => setShowDistancePicker(true)}
          disabled={isRunning}
        >
          <Text style={styles.distanceSelectorLabel}>Distance</Text>
          <Text style={styles.distanceSelectorValue}>{selectedDistance}m</Text>
        </TouchableOpacity>

        <View style={styles.controls}>
          <StartButton
            state={state}
            onStart={handleStart}
            onStop={handleStop}
            onReset={handleReset}
            disabled={!cameraReady}
          />
        </View>

        {/* Post-run UI is now handled by RunResultScreen */}

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

        {/* Result card is now shown in RunResultScreen */}
      </View>

      {/* Distance Picker Modal */}
      <Modal
        visible={showDistancePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDistancePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDistancePicker(false)}
        >
          <View style={styles.distancePickerModal}>
            <Text style={styles.distancePickerTitle}>Select Distance</Text>
            <View style={styles.distanceOptions}>
              {DISTANCE_OPTIONS.map((distance) => (
                <Pressable
                  key={distance}
                  style={[
                    styles.distanceOption,
                    selectedDistance === distance && styles.distanceOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedDistance(distance);
                    setShowDistancePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.distanceOptionText,
                      selectedDistance === distance && styles.distanceOptionTextSelected,
                    ]}
                  >
                    {distance}m
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.distancePickerCancel}
              onPress={() => setShowDistancePicker(false)}
            >
              <Text style={styles.distancePickerCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  // Post-run action buttons
  postRunActions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    minWidth: 160,
  },
  primaryActionIcon: {
    fontSize: typography.fontSize.xl,
    color: darkColors.white,
  },
  primaryActionText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600' as const,
    color: darkColors.white,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: darkColors.black + '90',
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: darkColors.gray[700],
  },
  secondaryActionIcon: {
    fontSize: typography.fontSize.base,
    color: darkColors.white,
  },
  secondaryActionText: {
    fontSize: typography.fontSize.sm,
    color: darkColors.white,
  },
  endSessionButton: {
    borderColor: darkColors.gray[500],
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
  // Distance selector
  distanceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: darkColors.black + '80',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  distanceSelectorLabel: {
    fontSize: typography.fontSize.sm,
    color: darkColors.gray[400],
  },
  distanceSelectorValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600' as const,
    color: darkColors.white,
  },
  // Distance picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  distancePickerModal: {
    backgroundColor: darkColors.gray[900],
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '80%',
    maxWidth: 300,
  },
  distancePickerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600' as const,
    color: darkColors.white,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  distanceOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: darkColors.gray[800],
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 70,
    alignItems: 'center',
  },
  distanceOptionSelected: {
    borderColor: darkColors.primary[500],
    backgroundColor: darkColors.primary[500] + '20',
  },
  distanceOptionText: {
    fontSize: typography.fontSize.base,
    fontWeight: '500' as const,
    color: darkColors.white,
  },
  distanceOptionTextSelected: {
    color: darkColors.primary[400],
  },
  distancePickerCancel: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  distancePickerCancelText: {
    fontSize: typography.fontSize.base,
    color: darkColors.gray[400],
  },
  // Device stability indicator styles
  stabilityBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderRadius: 0,
  },
  stabilityOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stabilityInstructions: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  stabilityIcon: {
    fontSize: 48,
    color: darkColors.white,
    marginBottom: spacing.md,
  },
  stabilityTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: darkColors.white,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stabilitySubtitle: {
    fontSize: typography.fontSize.base,
    color: darkColors.gray[300],
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  stabilityScoreBar: {
    width: 150,
    height: 6,
    backgroundColor: darkColors.gray[700],
    borderRadius: 3,
    overflow: 'hidden',
  },
  stabilityScoreFill: {
    height: '100%',
    borderRadius: 3,
  },
  readyBadge: {
    position: 'absolute',
    top: 100,
    right: spacing.md,
    backgroundColor: darkColors.timing.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    zIndex: 10,
  },
  readyBadgeText: {
    color: darkColors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
});
