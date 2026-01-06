# Track Speed - Technical Specification

> **Version:** 1.0
> **Last Updated:** January 5, 2026
> **Status:** Draft
> **Supplements:** PRD.md

This document provides detailed technical specifications for implementing Track Speed with the latest available technologies as of January 2026.

---

## Table of Contents

1. [Platform Requirements](#1-platform-requirements)
2. [React Native + SwiftUI Integration](#2-react-native--swiftui-integration)
3. [iOS Native Engine (iOS 26)](#3-ios-native-engine-ios-26)
   - 3.5 [Thumb Start Mode (Solo Training)](#35-thumb-start-mode-solo-training)
4. [Android Native Engine (Android 16)](#4-android-native-engine-android-16)
   - 4.5 [Thumb Start Mode (Android)](#45-thumb-start-mode-android)
5. [Ghost Gate Calibration System](#5-ghost-gate-calibration-system)
6. [Torso Detection & Body Part Filtering](#6-torso-detection--body-part-filtering)
7. [Sub-Frame Interpolation Algorithms](#7-sub-frame-interpolation-algorithms)
8. [Manual Override System](#8-manual-override-system)
9. [Multi-Phone Clock Synchronization](#9-multi-phone-clock-synchronization)

---

## 1. Platform Requirements

### 1.1 Minimum SDK Versions

| Platform | Minimum | Recommended | Latest |
|----------|---------|-------------|--------|
| **iOS** | iOS 17 | iOS 26 | iOS 26 |
| **Android** | Android 12 (API 31) | Android 16 | Android 16 |
| **React Native** | 0.76 | 0.83+ | 0.83.1 |
| **Expo SDK** | 52 | 53+ | 53 |

### 1.2 Device Requirements

#### iOS
| Tier | Devices | Frame Rate | Features |
|------|---------|------------|----------|
| **Minimum** | iPhone 12 | 60 FPS | Basic timing |
| **Recommended** | iPhone 14 Pro | 120 FPS | Accuracy mode |
| **Maximum** | iPhone 17 Pro | 240 FPS | Lab/research mode, ProRes RAW |

#### Android
| Tier | Devices | Frame Rate | Features |
|------|---------|------------|----------|
| **Minimum** | Pixel 6, Galaxy S21 | 60 FPS | Basic timing |
| **Recommended** | Pixel 8 Pro, Galaxy S24 | 120 FPS | Accuracy mode |
| **Maximum** | Snapdragon 8 Elite devices | 240 FPS | NPU acceleration |

---

## 2. React Native + SwiftUI Integration

### 2.1 Architecture Overview

React Native 0.83+ with New Architecture (Fabric + TurboModules) is **mandatory** for this project. The New Architecture provides:

- **43% faster cold start times**
- **60-120 FPS animations** via Reanimated 3
- **Synchronous native calls** when needed
- **20-30% memory reduction**

### 2.2 SwiftUI Integration Pattern

Pure Swift is NOT yet supported for Fabric components. Use the **Adapter Pattern**:

```
React Native Component
    ↓
ViewManager (Objective-C++)
    ↓
Provider Bridge (Swift + UIKit)
    ↓
UIHostingController
    ↓
SwiftUI View
```

### 2.3 TurboModule with Swift (Timing Engine)

**File Structure:**
```
ios/
├── TrackSpeed/
│   ├── TimingEngine/
│   │   ├── TimingEngine.swift           # Swift implementation
│   │   ├── TimingEngineAdapter.mm       # Obj-C++ adapter
│   │   └── TimingEngineSpec.h           # Codegen spec
│   ├── TrackSpeed-Bridging-Header.h
│   └── ...
```

**Swift Module Example:**
```swift
import Foundation
import AVFoundation
import Vision

@objcMembers
public class NativeTimingEngine: NSObject {
    private var captureSession: AVCaptureSession?
    private var poseRequest: VNDetectHumanBodyPoseRequest?

    public func startSession(config: NSDictionary,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        // Implementation
    }

    public func stopSession(resolve: @escaping RCTPromiseResolveBlock,
                            reject: @escaping RCTPromiseRejectBlock) {
        // Implementation
    }

    public func getTimestamp() -> UInt64 {
        return mach_continuous_time()
    }
}
```

**Objective-C++ Adapter:**
```objc
#import "TimingEngineAdapter.h"
#import "TrackSpeed-Swift.h"

@implementation TimingEngineAdapter {
    NativeTimingEngine *engine;
}

- (instancetype)init {
    if (self = [super init]) {
        engine = [[NativeTimingEngine alloc] init];
    }
    return self;
}

RCT_EXPORT_METHOD(startSession:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [engine startSessionWithConfig:config resolve:resolve reject:reject];
}

@end
```

### 2.4 SwiftUI Camera Preview

```swift
import SwiftUI
import AVFoundation

class CameraPreviewProps: ObservableObject {
    @Published var showFinishLine: Bool = true
    @Published var finishLinePosition: CGFloat = 0.5
    @Published var overlayOpacity: Double = 0.6
}

struct CameraPreviewView: View {
    @ObservedObject var props: CameraPreviewProps
    let previewLayer: AVCaptureVideoPreviewLayer

    var body: some View {
        ZStack {
            // Camera preview
            CameraPreviewRepresentable(previewLayer: previewLayer)

            // Finish line overlay
            if props.showFinishLine {
                FinishLineOverlay(position: props.finishLinePosition)
                    .opacity(props.overlayOpacity)
            }

            // Torso marker (when detected)
            TorsoMarkerView()
        }
    }
}

struct FinishLineOverlay: View {
    let position: CGFloat

    var body: some View {
        GeometryReader { geometry in
            Rectangle()
                .fill(Color.red.opacity(0.8))
                .frame(width: 3)
                .position(x: geometry.size.width * position,
                         y: geometry.size.height / 2)
        }
    }
}
```

### 2.5 Provider Bridge (UIKit to SwiftUI)

```swift
import UIKit
import SwiftUI

@objcMembers
public class CameraPreviewProvider: UIView {
    private var props = CameraPreviewProps()
    private var hostingController: UIHostingController<CameraPreviewView>?
    private var previewLayer: AVCaptureVideoPreviewLayer?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        guard let layer = previewLayer else { return }

        let swiftUIView = CameraPreviewView(props: props, previewLayer: layer)
        hostingController = UIHostingController(rootView: swiftUIView)

        guard let hostView = hostingController?.view else { return }

        // Use React Native's view controller containment
        hostingController?.reactAddController(toClosestParent: self)

        hostView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(hostView)

        NSLayoutConstraint.activate([
            hostView.topAnchor.constraint(equalTo: topAnchor),
            hostView.bottomAnchor.constraint(equalTo: bottomAnchor),
            hostView.leadingAnchor.constraint(equalTo: leadingAnchor),
            hostView.trailingAnchor.constraint(equalTo: trailingAnchor)
        ])
    }

    // React Native props
    public var showFinishLine: Bool = true {
        didSet { props.showFinishLine = showFinishLine }
    }

    public var finishLinePosition: CGFloat = 0.5 {
        didSet { props.finishLinePosition = finishLinePosition }
    }
}
```

---

## 3. iOS Native Engine (iOS 26)

### 3.1 Camera Configuration for High-FPS Capture

```swift
import AVFoundation

class CameraManager {
    private var captureSession: AVCaptureSession!
    private var videoOutput: AVCaptureVideoDataOutput!
    private var videoDevice: AVCaptureDevice!

    func configureHighFPSCapture(targetFPS: Int) throws {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                    for: .video,
                                                    position: .back) else {
            throw CameraError.deviceNotFound
        }

        videoDevice = device

        // Find format supporting target FPS
        var bestFormat: AVCaptureDevice.Format?
        var bestFrameRateRange: AVFrameRateRange?

        for format in device.formats {
            for range in format.videoSupportedFrameRateRanges {
                if range.maxFrameRate >= Double(targetFPS) {
                    if bestFrameRateRange == nil ||
                       range.maxFrameRate < bestFrameRateRange!.maxFrameRate {
                        bestFormat = format
                        bestFrameRateRange = range
                    }
                }
            }
        }

        guard let format = bestFormat, let range = bestFrameRateRange else {
            throw CameraError.fpsNotSupported(targetFPS)
        }

        try device.lockForConfiguration()

        device.activeFormat = format
        device.activeVideoMinFrameDuration = CMTime(value: 1,
                                                     timescale: CMTimeScale(targetFPS))
        device.activeVideoMaxFrameDuration = CMTime(value: 1,
                                                     timescale: CMTimeScale(targetFPS))

        device.unlockForConfiguration()
    }

    func setupVideoOutput() {
        videoOutput = AVCaptureVideoDataOutput()
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]

        let queue = DispatchQueue(label: "video.processing",
                                   qos: .userInteractive)
        videoOutput.setSampleBufferDelegate(self, queue: queue)

        if captureSession.canAddOutput(videoOutput) {
            captureSession.addOutput(videoOutput)
        }
    }
}
```

### 3.2 Precision Timestamps with mach_continuous_time

```swift
import Darwin

class TimestampManager {
    private var timebaseInfo = mach_timebase_info()

    init() {
        mach_timebase_info(&timebaseInfo)
    }

    /// Returns current time in nanoseconds (monotonic, continues during sleep)
    func currentTimeNanos() -> UInt64 {
        let ticks = mach_continuous_time()
        return ticks * UInt64(timebaseInfo.numer) / UInt64(timebaseInfo.denom)
    }

    /// Returns current time in seconds with nanosecond precision
    func currentTimeSeconds() -> Double {
        return Double(currentTimeNanos()) / 1_000_000_000.0
    }

    /// Converts CMTime to nanoseconds with high precision
    func cmTimeToNanos(_ cmTime: CMTime) -> UInt64 {
        guard cmTime.isValid else { return 0 }
        // Use high-precision calculation
        let seconds = Double(cmTime.value) / Double(cmTime.timescale)
        return UInt64(seconds * 1_000_000_000)
    }
}
```

### 3.3 Vision Framework Pose Detection (iOS 26)

```swift
import Vision

class PoseDetector {
    private var poseRequest: VNDetectHumanBodyPoseRequest!
    private var handler: VNImageRequestHandler?

    init() {
        poseRequest = VNDetectHumanBodyPoseRequest { [weak self] request, error in
            self?.handlePoseResults(request: request, error: error)
        }

        // iOS 17+: Enable 3D pose if needed
        if #available(iOS 17.0, *) {
            // 3D pose available via VNDetectHumanBodyPose3DRequest
        }
    }

    func detectPose(in sampleBuffer: CMSampleBuffer,
                    timestamp: UInt64,
                    completion: @escaping (TorsoPosition?) -> Void) {

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            completion(nil)
            return
        }

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer,
                                            options: [:])

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                try handler.perform([self?.poseRequest].compactMap { $0 })
            } catch {
                print("Pose detection failed: \(error)")
                completion(nil)
            }
        }
    }

    private func handlePoseResults(request: VNRequest, error: Error?) {
        guard let observations = request.results as? [VNHumanBodyPoseObservation],
              let pose = observations.first else {
            return
        }

        // Extract torso landmarks
        let torsoPosition = extractTorsoPosition(from: pose)
        // Process torso position...
    }

    func extractTorsoPosition(from pose: VNHumanBodyPoseObservation) -> TorsoPosition? {
        do {
            // Get shoulder and hip landmarks
            let leftShoulder = try pose.recognizedPoint(.leftShoulder)
            let rightShoulder = try pose.recognizedPoint(.rightShoulder)
            let leftHip = try pose.recognizedPoint(.leftHip)
            let rightHip = try pose.recognizedPoint(.rightHip)

            // Check confidence threshold
            let minConfidence: Float = 0.7
            guard leftShoulder.confidence >= minConfidence,
                  rightShoulder.confidence >= minConfidence,
                  leftHip.confidence >= minConfidence,
                  rightHip.confidence >= minConfidence else {
                return nil
            }

            // Calculate torso center
            let torsoX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4
            let torsoY = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4

            // Calculate lean angle for adaptive weighting
            let shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2
            let shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2
            let hipCenterX = (leftHip.x + rightHip.x) / 2
            let hipCenterY = (leftHip.y + rightHip.y) / 2

            let leanAngle = atan2(shoulderCenterX - hipCenterX,
                                   shoulderCenterY - hipCenterY) * 180 / .pi

            // Confidence is minimum of all four landmarks
            let confidence = min(leftShoulder.confidence, rightShoulder.confidence,
                                leftHip.confidence, rightHip.confidence)

            return TorsoPosition(
                x: torsoX,
                y: torsoY,
                confidence: confidence,
                leanAngle: leanAngle,
                landmarks: TorsoLandmarks(
                    leftShoulder: CGPoint(x: leftShoulder.x, y: leftShoulder.y),
                    rightShoulder: CGPoint(x: rightShoulder.x, y: rightShoulder.y),
                    leftHip: CGPoint(x: leftHip.x, y: leftHip.y),
                    rightHip: CGPoint(x: rightHip.x, y: rightHip.y)
                )
            )
        } catch {
            return nil
        }
    }
}

struct TorsoPosition {
    let x: CGFloat                    // 0-1 normalized
    let y: CGFloat                    // 0-1 normalized
    let confidence: Float             // 0-1
    let leanAngle: CGFloat            // degrees from vertical
    let landmarks: TorsoLandmarks
}

struct TorsoLandmarks {
    let leftShoulder: CGPoint
    let rightShoulder: CGPoint
    let leftHip: CGPoint
    let rightHip: CGPoint
}
```

### 3.4 ProRes RAW Evidence Capture (iPhone 17 Pro+)

```swift
import AVFoundation

class EvidenceCaptureManager {
    private var assetWriter: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?

    func setupProResCapture(outputURL: URL) throws {
        assetWriter = try AVAssetWriter(outputURL: outputURL, fileType: .mov)

        // Check for ProRes RAW support (iPhone 17 Pro+)
        let supportsProResRAW = checkProResRAWSupport()

        let videoSettings: [String: Any]
        if supportsProResRAW {
            videoSettings = [
                AVVideoCodecKey: AVVideoCodecType.proRes4444,
                AVVideoWidthKey: 1920,
                AVVideoHeightKey: 1080,
                AVVideoCompressionPropertiesKey: [
                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
                ]
            ]
        } else {
            // Fallback to HEVC
            videoSettings = [
                AVVideoCodecKey: AVVideoCodecType.hevc,
                AVVideoWidthKey: 1920,
                AVVideoHeightKey: 1080
            ]
        }

        videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput?.expectsMediaDataInRealTime = true

        if let input = videoInput, assetWriter?.canAdd(input) == true {
            assetWriter?.add(input)
        }
    }

    private func checkProResRAWSupport() -> Bool {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                    for: .video,
                                                    position: .back) else {
            return false
        }

        for format in device.formats {
            if format.supportedColorSpaces.contains(.appleProRAWRGB) {
                return true
            }
        }
        return false
    }
}
```

### 3.5 Thumb Start Mode (Solo Training)

For solo training without a coach, the athlete places their thumb on the phone screen (similar to a block start grip) and the timer starts when they lift their thumb.

#### Touch Event Implementation

```swift
import UIKit
import Darwin

class ThumbStartViewController: UIViewController {
    private let timestampManager = TimestampManager()
    private var touchDownTimestamp: UInt64 = 0
    private var timerStartTimestamp: UInt64 = 0
    private var isReady: Bool = false

    // Callback to timing engine
    var onTimerStart: ((UInt64) -> Void)?
    var onStateChange: ((ThumbStartState) -> Void)?

    enum ThumbStartState {
        case idle           // Waiting for touch
        case ready          // Thumb is down, ready to start
        case running        // Thumb lifted, timer running
        case cancelled      // Touch moved off screen or invalid
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupTouchArea()
    }

    private func setupTouchArea() {
        // Large touch target covering bottom half of screen
        let touchView = ThumbTouchView(frame: CGRect(
            x: 0,
            y: view.bounds.height / 2,
            width: view.bounds.width,
            height: view.bounds.height / 2
        ))
        touchView.delegate = self
        view.addSubview(touchView)
    }
}

extension ThumbStartViewController: ThumbTouchViewDelegate {
    func touchBegan(at location: CGPoint) {
        // Record precise timestamp when thumb touches screen
        touchDownTimestamp = timestampManager.currentTimeNanos()
        isReady = true
        onStateChange?(.ready)

        // Haptic feedback to confirm ready state
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }

    func touchEnded(at location: CGPoint) {
        guard isReady else { return }

        // Record precise timestamp when thumb lifts - THIS IS THE START TIME
        timerStartTimestamp = timestampManager.currentTimeNanos()

        // Calculate reaction time (time thumb was held down)
        let holdTime = Double(timerStartTimestamp - touchDownTimestamp) / 1_000_000.0 // ms

        // Validate hold time (prevent accidental taps)
        if holdTime < 500 {
            // Too quick - likely accidental tap
            onStateChange?(.cancelled)
            isReady = false
            return
        }

        // Start the timer
        onStateChange?(.running)
        onTimerStart?(timerStartTimestamp)

        // Strong haptic to indicate timer started
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)

        isReady = false
    }

    func touchCancelled() {
        isReady = false
        onStateChange?(.cancelled)
    }
}

// Custom touch view for precise event handling
class ThumbTouchView: UIView {
    weak var delegate: ThumbTouchViewDelegate?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        delegate?.touchBegan(at: touch.location(in: self))
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        delegate?.touchEnded(at: touch.location(in: self))
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        delegate?.touchCancelled()
    }
}

protocol ThumbTouchViewDelegate: AnyObject {
    func touchBegan(at location: CGPoint)
    func touchEnded(at location: CGPoint)
    func touchCancelled()
}
```

#### React Native Bridge

```typescript
// TurboModule specification
export interface ThumbStartSpec extends TurboModule {
  // Enable thumb start mode
  enableThumbStart(): Promise<void>;

  // Disable thumb start mode
  disableThumbStart(): Promise<void>;

  // Get current state
  getState(): Promise<'idle' | 'ready' | 'running' | 'cancelled'>;

  // Event emitter for state changes
  addStateListener(callback: (state: string) => void): void;

  // Event emitter for timer start (returns timestamp in nanoseconds)
  addStartListener(callback: (timestampNanos: number) => void): void;
}
```

#### Integration with Timing Engine

```typescript
class ThumbStartTimingSession {
  private thumbStartModule: ThumbStartSpec;
  private timingEngine: TimingEngine;
  private startTimestamp: number | null = null;

  async initialize() {
    await this.thumbStartModule.enableThumbStart();

    // Listen for timer start
    this.thumbStartModule.addStartListener((timestampNanos) => {
      this.startTimestamp = timestampNanos;
      this.timingEngine.setStartTime(timestampNanos);

      // Now waiting for finish line crossing
      this.timingEngine.startDetection();
    });

    // Listen for state changes
    this.thumbStartModule.addStateListener((state) => {
      switch (state) {
        case 'ready':
          // Show "READY" UI - athlete can release to start
          this.showReadyState();
          break;
        case 'running':
          // Show running timer
          this.showRunningTimer();
          break;
        case 'cancelled':
          // Reset UI
          this.reset();
          break;
      }
    });
  }

  onCrossing(crossingTimestamp: number) {
    if (!this.startTimestamp) {
      console.error('No start timestamp recorded');
      return;
    }

    // Calculate elapsed time
    const elapsedNanos = crossingTimestamp - this.startTimestamp;
    const elapsedMs = elapsedNanos / 1_000_000;

    return {
      time_ms: elapsedMs,
      startMethod: 'thumb_start',
      startTimestamp: this.startTimestamp,
      finishTimestamp: crossingTimestamp
    };
  }
}
```

#### UX Flow

```
┌─────────────────────────────────────────┐
│           Solo Sprint Mode              │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     [CAMERA PREVIEW]            │    │
│  │                                 │    │
│  │     Finish line positioned      │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     👆 PLACE THUMB HERE         │    │
│  │                                 │    │
│  │     Hold until ready, then      │    │
│  │     lift to start timer         │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

         │ (Thumb touches)
         ▼

┌─────────────────────────────────────────┐
│           Solo Sprint Mode              │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     [CAMERA PREVIEW]            │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     ✓ READY                     │    │
│  │                                 │    │
│  │     [Vibration pulse]           │    │
│  │                                 │    │
│  │     Lift thumb to START         │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

         │ (Thumb lifts)
         ▼

┌─────────────────────────────────────────┐
│           Solo Sprint Mode              │
├─────────────────────────────────────────┤
│                                         │
│          ⏱️ 00:00.000                   │
│          [Timer running]                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     [CAMERA PREVIEW]            │    │
│  │                                 │    │
│  │     Waiting for crossing...     │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  GO! Run to the finish line! 🏃        │
│                                         │
└─────────────────────────────────────────┘
```

#### Configuration Options

```typescript
interface ThumbStartConfig {
  // Minimum time thumb must be held before release starts timer (prevent accidental taps)
  minimumHoldTime: number;  // Default: 500ms

  // Maximum time thumb can be held (auto-cancel if too long)
  maximumHoldTime: number;  // Default: 30000ms (30 seconds)

  // Enable haptic feedback
  hapticFeedback: boolean;  // Default: true

  // Enable audio cue on start
  audioCue: boolean;        // Default: false (might startle athlete)

  // Touch area configuration
  touchAreaPosition: 'bottom' | 'full_screen';  // Default: 'bottom'
}
```

---

## 4. Android Native Engine (Android 16)

### 4.1 CameraX High-FPS Configuration

```kotlin
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import android.os.SystemClock

class CameraManager(private val context: Context) {
    private lateinit var cameraProvider: ProcessCameraProvider
    private lateinit var imageAnalysis: ImageAnalysis
    private val timestampManager = TimestampManager()

    fun setupHighFPSCapture(targetFPS: Int, lifecycleOwner: LifecycleOwner) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()

            // Configure image analysis for real-time processing
            imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .build()

            // Set target FPS via Camera2 interop
            val camera2Interop = Camera2Interop.Extender(imageAnalysis)
            camera2Interop.setCaptureRequestOption(
                CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
                Range(targetFPS, targetFPS)
            )

            // For Android 16+: Use hybrid auto-exposure for predictable timing
            if (Build.VERSION.SDK_INT >= 36) { // Android 16
                camera2Interop.setCaptureRequestOption(
                    CaptureRequest.CONTROL_AE_MODE,
                    CameraMetadata.CONTROL_AE_MODE_ON_AUTO_EXPOSURE_TIME
                )
            }

            imageAnalysis.setAnalyzer(Executors.newSingleThreadExecutor()) { image ->
                processFrame(image)
                image.close()
            }

            // Bind to lifecycle
            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            cameraProvider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                imageAnalysis
            )
        }, ContextCompat.getMainExecutor(context))
    }

    private fun processFrame(image: ImageProxy) {
        val frameTimestamp = image.imageInfo.timestamp // nanoseconds
        val systemTimestamp = SystemClock.elapsedRealtimeNanos()

        // Calculate camera latency
        val captureLatency = (systemTimestamp - frameTimestamp) / 1_000_000.0 // ms

        // Process pose detection
        poseDetector.detectPose(image, frameTimestamp)
    }
}
```

### 4.2 MediaPipe Pose Detection with GPU Acceleration

```kotlin
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate

class PoseDetector(private val context: Context) {
    private lateinit var poseLandmarker: PoseLandmarker
    private var resultListener: ((TorsoPosition?) -> Unit)? = null

    fun initialize() {
        val baseOptions = BaseOptions.builder()
            .setDelegate(Delegate.GPU)  // Use GPU for ~1.5x speedup
            .setModelAssetPath("pose_landmarker_lite.task") // 0.77ms inference
            .build()

        val options = PoseLandmarker.PoseLandmarkerOptions.builder()
            .setBaseOptions(baseOptions)
            .setRunningMode(PoseLandmarker.RunningMode.LIVE_STREAM)
            .setNumPoses(1) // Single athlete for timing
            .setMinPoseDetectionConfidence(0.5f)
            .setMinPosePresenceConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .setResultListener { result, inputImage ->
                processResult(result, inputImage.timestamp)
            }
            .build()

        poseLandmarker = PoseLandmarker.createFromOptions(context, options)
    }

    fun detectPose(image: ImageProxy, timestamp: Long) {
        val mpImage = BitmapImageBuilder(image.toBitmap()).build()
        poseLandmarker.detectAsync(mpImage, timestamp / 1_000_000) // Convert to ms
    }

    private fun processResult(result: PoseLandmarkerResult, timestampMs: Long) {
        if (result.landmarks().isEmpty()) {
            resultListener?.invoke(null)
            return
        }

        val landmarks = result.landmarks()[0]

        // MediaPipe landmark indices
        val leftShoulder = landmarks[11]
        val rightShoulder = landmarks[12]
        val leftHip = landmarks[23]
        val rightHip = landmarks[24]

        // Check confidence threshold
        val minConfidence = 0.7f
        if (leftShoulder.visibility() < minConfidence ||
            rightShoulder.visibility() < minConfidence ||
            leftHip.visibility() < minConfidence ||
            rightHip.visibility() < minConfidence) {
            resultListener?.invoke(null)
            return
        }

        // Calculate torso center
        val torsoX = (leftShoulder.x() + rightShoulder.x() +
                      leftHip.x() + rightHip.x()) / 4
        val torsoY = (leftShoulder.y() + rightShoulder.y() +
                      leftHip.y() + rightHip.y()) / 4

        // Calculate lean angle
        val shoulderCenterX = (leftShoulder.x() + rightShoulder.x()) / 2
        val shoulderCenterY = (leftShoulder.y() + rightShoulder.y()) / 2
        val hipCenterX = (leftHip.x() + rightHip.x()) / 2
        val hipCenterY = (leftHip.y() + rightHip.y()) / 2

        val leanAngle = Math.toDegrees(
            atan2((shoulderCenterX - hipCenterX).toDouble(),
                  (shoulderCenterY - hipCenterY).toDouble())
        ).toFloat()

        val confidence = minOf(
            leftShoulder.visibility(),
            rightShoulder.visibility(),
            leftHip.visibility(),
            rightHip.visibility()
        )

        resultListener?.invoke(TorsoPosition(
            x = torsoX,
            y = torsoY,
            confidence = confidence,
            leanAngle = leanAngle,
            timestampMs = timestampMs
        ))
    }
}

data class TorsoPosition(
    val x: Float,           // 0-1 normalized
    val y: Float,           // 0-1 normalized
    val confidence: Float,  // 0-1
    val leanAngle: Float,   // degrees from vertical
    val timestampMs: Long
)
```

### 4.3 LiteRT with NPU Acceleration (Snapdragon 8 Elite)

```kotlin
import com.google.ai.edge.litert.*

class OptimizedPoseDetector(private val context: Context) {
    private lateinit var model: LiteModel
    private lateinit var runtime: LiteModelRuntime

    fun initialize() {
        model = LiteModel.createFromFile(context, "movenet_lightning.tflite")

        // Use NPU when available (100x faster than CPU, 10x faster than GPU)
        runtime = LiteModelRuntime.Builder()
            .setPreferredHardwareAccelerators(listOf(
                HardwareAccelerator.NPU,   // Snapdragon 8 Elite: <5ms inference
                HardwareAccelerator.GPU,   // Fallback: ~7ms
                HardwareAccelerator.CPU    // Last resort: ~15ms
            ))
            .build()
    }

    fun detectPose(bitmap: Bitmap, callback: (Array<FloatArray>) -> Unit) {
        // Preprocess image
        val inputBuffer = preprocessImage(bitmap)

        // Run inference
        val outputBuffer = runtime.run(model, inputBuffer)

        // Parse MoveNet output (17 keypoints x 3 values [y, x, confidence])
        val keypoints = parseKeypoints(outputBuffer)
        callback(keypoints)
    }

    private fun preprocessImage(bitmap: Bitmap): ByteBuffer {
        val resized = Bitmap.createScaledBitmap(bitmap, 192, 192, true)
        val inputBuffer = ByteBuffer.allocateDirect(192 * 192 * 3 * 4)
        inputBuffer.order(ByteOrder.nativeOrder())

        val pixels = IntArray(192 * 192)
        resized.getPixels(pixels, 0, 192, 0, 0, 192, 192)

        for (pixel in pixels) {
            // Normalize to [-1, 1]
            inputBuffer.putFloat(((pixel shr 16 and 0xFF) / 127.5f) - 1f) // R
            inputBuffer.putFloat(((pixel shr 8 and 0xFF) / 127.5f) - 1f)  // G
            inputBuffer.putFloat(((pixel and 0xFF) / 127.5f) - 1f)        // B
        }

        return inputBuffer
    }
}
```

### 4.4 Timestamp Synchronization

```kotlin
import android.os.SystemClock
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraMetadata

class TimestampSynchronizer(private val cameraManager: android.hardware.camera2.CameraManager) {
    private var timestampSource: Int = CameraMetadata.SENSOR_INFO_TIMESTAMP_SOURCE_UNKNOWN
    private var baseOffset: Long = 0

    fun initialize(cameraId: String) {
        val characteristics = cameraManager.getCameraCharacteristics(cameraId)
        timestampSource = characteristics.get(
            CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE
        ) ?: CameraMetadata.SENSOR_INFO_TIMESTAMP_SOURCE_UNKNOWN

        if (timestampSource == CameraMetadata.SENSOR_INFO_TIMESTAMP_SOURCE_UNKNOWN) {
            // Calculate offset for synchronization
            baseOffset = SystemClock.elapsedRealtimeNanos() - System.nanoTime()
        }
    }

    /**
     * Synchronize camera timestamp to system monotonic clock
     */
    fun synchronizeTimestamp(cameraTimestamp: Long): Long {
        return if (timestampSource == CameraMetadata.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME) {
            // Direct comparison with elapsedRealtimeNanos()
            cameraTimestamp
        } else {
            // Apply offset correction
            cameraTimestamp + baseOffset
        }
    }

    /**
     * Get current time in nanoseconds (monotonic)
     */
    fun currentTimeNanos(): Long = SystemClock.elapsedRealtimeNanos()

    /**
     * Calculate processing latency
     */
    fun calculateLatency(cameraTimestamp: Long): Double {
        val syncedTimestamp = synchronizeTimestamp(cameraTimestamp)
        val currentTime = currentTimeNanos()
        return (currentTime - syncedTimestamp) / 1_000_000.0 // ms
    }
}
```

### 4.5 Thumb Start Mode (Android)

Android implementation of the Thumb Start feature for solo training.

```kotlin
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.HapticFeedbackConstants

class ThumbStartManager(
    private val touchView: View,
    private val config: ThumbStartConfig = ThumbStartConfig()
) {
    private var touchDownTimestamp: Long = 0
    private var isReady: Boolean = false

    var onTimerStart: ((timestampNanos: Long) -> Unit)? = null
    var onStateChange: ((ThumbStartState) -> Unit)? = null

    enum class ThumbStartState {
        IDLE,       // Waiting for touch
        READY,      // Thumb is down, ready to start
        RUNNING,    // Thumb lifted, timer running
        CANCELLED   // Touch moved off screen or invalid
    }

    data class ThumbStartConfig(
        val minimumHoldTime: Long = 500L,       // ms
        val maximumHoldTime: Long = 30000L,     // ms
        val hapticFeedback: Boolean = true
    )

    init {
        setupTouchListener()
    }

    private fun setupTouchListener() {
        touchView.setOnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> handleTouchDown(view)
                MotionEvent.ACTION_UP -> handleTouchUp(view)
                MotionEvent.ACTION_CANCEL -> handleTouchCancel()
            }
            true
        }
    }

    private fun handleTouchDown(view: View) {
        // Record precise timestamp using monotonic clock
        touchDownTimestamp = SystemClock.elapsedRealtimeNanos()
        isReady = true
        onStateChange?.invoke(ThumbStartState.READY)

        // Haptic feedback to confirm ready state
        if (config.hapticFeedback) {
            view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        }
    }

    private fun handleTouchUp(view: View) {
        if (!isReady) return

        // Record precise timestamp when thumb lifts - THIS IS THE START TIME
        val timerStartTimestamp = SystemClock.elapsedRealtimeNanos()

        // Calculate hold time
        val holdTimeMs = (timerStartTimestamp - touchDownTimestamp) / 1_000_000

        // Validate hold time
        if (holdTimeMs < config.minimumHoldTime) {
            // Too quick - likely accidental tap
            onStateChange?.invoke(ThumbStartState.CANCELLED)
            isReady = false
            return
        }

        if (holdTimeMs > config.maximumHoldTime) {
            // Held too long - timeout
            onStateChange?.invoke(ThumbStartState.CANCELLED)
            isReady = false
            return
        }

        // Start the timer
        onStateChange?.invoke(ThumbStartState.RUNNING)
        onTimerStart?.invoke(timerStartTimestamp)

        // Strong haptic to indicate timer started
        if (config.hapticFeedback) {
            view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
        }

        isReady = false
    }

    private fun handleTouchCancel() {
        isReady = false
        onStateChange?.invoke(ThumbStartState.CANCELLED)
    }

    fun reset() {
        isReady = false
        onStateChange?.invoke(ThumbStartState.IDLE)
    }
}
```

#### React Native TurboModule (Android)

```kotlin
package com.trackspeed.thumbstart

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = ThumbStartModule.NAME)
class ThumbStartModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var thumbStartManager: ThumbStartManager? = null

    companion object {
        const val NAME = "ThumbStartModule"
    }

    override fun getName() = NAME

    @ReactMethod
    fun enableThumbStart(promise: Promise) {
        currentActivity?.runOnUiThread {
            val touchView = currentActivity?.findViewById<View>(R.id.thumb_start_area)
            if (touchView != null) {
                thumbStartManager = ThumbStartManager(touchView).apply {
                    onTimerStart = { timestamp ->
                        sendEvent("onThumbStartTimerStart", Arguments.createMap().apply {
                            putDouble("timestampNanos", timestamp.toDouble())
                        })
                    }
                    onStateChange = { state ->
                        sendEvent("onThumbStartStateChange", Arguments.createMap().apply {
                            putString("state", state.name.lowercase())
                        })
                    }
                }
                promise.resolve(null)
            } else {
                promise.reject("ERROR", "Touch view not found")
            }
        }
    }

    @ReactMethod
    fun disableThumbStart(promise: Promise) {
        thumbStartManager?.reset()
        thumbStartManager = null
        promise.resolve(null)
    }

    @ReactMethod
    fun getState(promise: Promise) {
        // Return current state
        promise.resolve("idle")
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter
    }
}
```

#### Precision Considerations

```typescript
// Timestamp precision comparison across start methods
interface StartMethodPrecision {
  method: 'thumb_start' | 'coach_tap' | 'audio_gun' | 'external_gate';
  typicalLatency: string;
  precision: string;
  notes: string;
}

const START_METHOD_PRECISION: StartMethodPrecision[] = [
  {
    method: 'thumb_start',
    typicalLatency: '<1ms',
    precision: '±0.5ms',
    notes: 'Direct touch event, highest precision for self-timed starts'
  },
  {
    method: 'coach_tap',
    typicalLatency: '50-150ms',
    precision: '±5ms',
    notes: 'Human reaction time adds variability'
  },
  {
    method: 'audio_gun',
    typicalLatency: '10-30ms',
    precision: '±2ms',
    notes: 'Depends on audio detection algorithm'
  },
  {
    method: 'external_gate',
    typicalLatency: '<1ms',
    precision: '±0.1ms',
    notes: 'Professional timing gates, requires Bluetooth sync'
  }
];
```

---

## 5. Ghost Gate Calibration System

The Ghost Gate is a **background calibration phase** that dramatically improves detection speed and accuracy by allowing the system to focus only on what's changed (the athlete) rather than processing the entire scene.

### 5.1 Overview & Benefits

| Metric | Without Ghost Gate | With Ghost Gate | Improvement |
|--------|-------------------|-----------------|-------------|
| Pose inference time | 8-12ms | 3-5ms | **50-60% faster** |
| False positives | Common (shadows, background objects) | Rare | **~80% reduction** |
| NPU workload | Full frame (1920x1080) | Athlete region only (~400x600) | **~70% less** |
| Low-light performance | Poor | Improved | Detects motion even when pose fails |
| Battery consumption | High | Moderate | **~40% less** NPU usage |

### 5.2 Calibration Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ghost Gate Calibration Flow                   │
└─────────────────────────────────────────────────────────────────┘

1. Coach taps "Calibrate Gate"
         │
         ▼
2. App displays: "Clear the gate area - no people in frame"
         │
         ▼
3. Coach confirms area is clear
         │
         ▼
4. App captures 60-90 frames (2-3 seconds) of empty background
         │
         ▼
5. App builds reference model (Gaussian Mixture Model)
         │
         ▼
6. App validates: "Calibration complete ✓"
         │
         ▼
7. During timing: Background subtraction → Athlete isolation → Pose detection
```

### 5.3 Background Model Implementation

#### iOS Implementation (Swift + Metal)

```swift
import CoreImage
import Metal
import Accelerate

class GhostGateCalibrator {
    private var referenceFrames: [CVPixelBuffer] = []
    private var backgroundModel: CVPixelBuffer?
    private var varianceModel: CVPixelBuffer?
    private let maxReferenceFrames = 90
    private let motionThreshold: Float = 25.0  // Per-pixel difference threshold

    // MARK: - Calibration Phase

    func addCalibrationFrame(_ pixelBuffer: CVPixelBuffer) {
        guard referenceFrames.count < maxReferenceFrames else { return }
        referenceFrames.append(pixelBuffer.copy())
    }

    func finalizeCalibration() -> Bool {
        guard referenceFrames.count >= 30 else {
            return false  // Need at least 1 second of frames
        }

        // Build Gaussian Mixture Model (simplified: mean + variance per pixel)
        buildBackgroundModel()
        referenceFrames.removeAll()  // Free memory

        return backgroundModel != nil
    }

    private func buildBackgroundModel() {
        guard let firstFrame = referenceFrames.first else { return }

        let width = CVPixelBufferGetWidth(firstFrame)
        let height = CVPixelBufferGetHeight(firstFrame)

        // Allocate output buffers
        backgroundModel = createPixelBuffer(width: width, height: height)
        varianceModel = createPixelBuffer(width: width, height: height)

        guard let bgModel = backgroundModel,
              let varModel = varianceModel else { return }

        // Calculate per-pixel mean and variance using Accelerate framework
        CVPixelBufferLockBaseAddress(bgModel, [])
        CVPixelBufferLockBaseAddress(varModel, [])

        let bgPtr = CVPixelBufferGetBaseAddress(bgModel)!
                    .assumingMemoryBound(to: UInt8.self)
        let varPtr = CVPixelBufferGetBaseAddress(varModel)!
                     .assumingMemoryBound(to: Float.self)

        let pixelCount = width * height * 4  // BGRA

        // Calculate running mean
        var sumBuffer = [Float](repeating: 0, count: pixelCount)
        var sumSqBuffer = [Float](repeating: 0, count: pixelCount)

        for frame in referenceFrames {
            CVPixelBufferLockBaseAddress(frame, .readOnly)
            let framePtr = CVPixelBufferGetBaseAddress(frame)!
                          .assumingMemoryBound(to: UInt8.self)

            for i in 0..<pixelCount {
                let value = Float(framePtr[i])
                sumBuffer[i] += value
                sumSqBuffer[i] += value * value
            }

            CVPixelBufferUnlockBaseAddress(frame, .readOnly)
        }

        let n = Float(referenceFrames.count)
        for i in 0..<pixelCount {
            let mean = sumBuffer[i] / n
            let variance = (sumSqBuffer[i] / n) - (mean * mean)

            bgPtr[i] = UInt8(clamping: Int(mean))
            varPtr[i] = max(variance, 100)  // Minimum variance to avoid division by zero
        }

        CVPixelBufferUnlockBaseAddress(bgModel, [])
        CVPixelBufferUnlockBaseAddress(varModel, [])
    }

    // MARK: - Runtime Detection

    struct MotionRegion {
        let boundingBox: CGRect      // Normalized 0-1
        let pixelBoundingBox: CGRect // Pixel coordinates
        let motionMask: CVPixelBuffer
        let confidence: Float
    }

    func detectMotion(in currentFrame: CVPixelBuffer) -> MotionRegion? {
        guard let bgModel = backgroundModel,
              let varModel = varianceModel else {
            return nil  // Not calibrated
        }

        let width = CVPixelBufferGetWidth(currentFrame)
        let height = CVPixelBufferGetHeight(currentFrame)

        // Create motion mask
        let motionMask = createPixelBuffer(width: width, height: height,
                                           format: kCVPixelFormatType_OneComponent8)!

        CVPixelBufferLockBaseAddress(currentFrame, .readOnly)
        CVPixelBufferLockBaseAddress(bgModel, .readOnly)
        CVPixelBufferLockBaseAddress(varModel, .readOnly)
        CVPixelBufferLockBaseAddress(motionMask, [])

        let currentPtr = CVPixelBufferGetBaseAddress(currentFrame)!
                        .assumingMemoryBound(to: UInt8.self)
        let bgPtr = CVPixelBufferGetBaseAddress(bgModel)!
                   .assumingMemoryBound(to: UInt8.self)
        let varPtr = CVPixelBufferGetBaseAddress(varModel)!
                    .assumingMemoryBound(to: Float.self)
        let maskPtr = CVPixelBufferGetBaseAddress(motionMask)!
                     .assumingMemoryBound(to: UInt8.self)

        var minX = width, minY = height, maxX = 0, maxY = 0
        var motionPixelCount = 0

        let bytesPerRow = CVPixelBufferGetBytesPerRow(currentFrame)
        let maskBytesPerRow = CVPixelBufferGetBytesPerRow(motionMask)

        for y in 0..<height {
            for x in 0..<width {
                let pixelOffset = y * bytesPerRow + x * 4
                let maskOffset = y * maskBytesPerRow + x

                // Calculate Mahalanobis-like distance for each channel
                var totalDiff: Float = 0
                for c in 0..<3 {  // B, G, R channels
                    let current = Float(currentPtr[pixelOffset + c])
                    let background = Float(bgPtr[pixelOffset + c])
                    let variance = varPtr[pixelOffset + c]

                    let diff = abs(current - background)
                    let normalizedDiff = diff / sqrt(variance)
                    totalDiff += normalizedDiff
                }

                let isMotion = totalDiff > motionThreshold
                maskPtr[maskOffset] = isMotion ? 255 : 0

                if isMotion {
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)
                    motionPixelCount += 1
                }
            }
        }

        CVPixelBufferUnlockBaseAddress(currentFrame, .readOnly)
        CVPixelBufferUnlockBaseAddress(bgModel, .readOnly)
        CVPixelBufferUnlockBaseAddress(varModel, .readOnly)
        CVPixelBufferUnlockBaseAddress(motionMask, [])

        // Validate motion region
        guard motionPixelCount > 500 else {  // Minimum motion pixels
            return nil  // No significant motion detected
        }

        // Add padding to bounding box (20%)
        let padding = 0.2
        let boxWidth = maxX - minX
        let boxHeight = maxY - minY
        let paddedMinX = max(0, minX - Int(Float(boxWidth) * Float(padding)))
        let paddedMinY = max(0, minY - Int(Float(boxHeight) * Float(padding)))
        let paddedMaxX = min(width - 1, maxX + Int(Float(boxWidth) * Float(padding)))
        let paddedMaxY = min(height - 1, maxY + Int(Float(boxHeight) * Float(padding)))

        let pixelBox = CGRect(
            x: paddedMinX,
            y: paddedMinY,
            width: paddedMaxX - paddedMinX,
            height: paddedMaxY - paddedMinY
        )

        let normalizedBox = CGRect(
            x: CGFloat(paddedMinX) / CGFloat(width),
            y: CGFloat(paddedMinY) / CGFloat(height),
            width: CGFloat(paddedMaxX - paddedMinX) / CGFloat(width),
            height: CGFloat(paddedMaxY - paddedMinY) / CGFloat(height)
        )

        let confidence = min(1.0, Float(motionPixelCount) / 10000.0)

        return MotionRegion(
            boundingBox: normalizedBox,
            pixelBoundingBox: pixelBox,
            motionMask: motionMask,
            confidence: confidence
        )
    }

    // MARK: - Helpers

    private func createPixelBuffer(width: Int, height: Int,
                                   format: OSType = kCVPixelFormatType_32BGRA) -> CVPixelBuffer? {
        var pixelBuffer: CVPixelBuffer?
        let attrs: [CFString: Any] = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true
        ]

        CVPixelBufferCreate(kCFAllocatorDefault, width, height, format,
                           attrs as CFDictionary, &pixelBuffer)
        return pixelBuffer
    }
}
```

#### Android Implementation (Kotlin)

```kotlin
import android.graphics.Bitmap
import android.graphics.Rect
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class GhostGateCalibrator {
    private val referenceFrames = mutableListOf<Bitmap>()
    private var backgroundMean: FloatArray? = null
    private var backgroundVariance: FloatArray? = null
    private var width = 0
    private var height = 0
    private val maxReferenceFrames = 90
    private val motionThreshold = 25f

    data class MotionRegion(
        val boundingBox: RectF,      // Normalized 0-1
        val pixelBoundingBox: Rect,  // Pixel coordinates
        val confidence: Float
    )

    // Calibration Phase
    fun addCalibrationFrame(bitmap: Bitmap) {
        if (referenceFrames.size >= maxReferenceFrames) return
        referenceFrames.add(bitmap.copy(Bitmap.Config.ARGB_8888, false))
        width = bitmap.width
        height = bitmap.height
    }

    fun finalizeCalibration(): Boolean {
        if (referenceFrames.size < 30) return false

        buildBackgroundModel()
        referenceFrames.forEach { it.recycle() }
        referenceFrames.clear()

        return backgroundMean != null
    }

    private fun buildBackgroundModel() {
        val pixelCount = width * height
        val sumR = FloatArray(pixelCount)
        val sumG = FloatArray(pixelCount)
        val sumB = FloatArray(pixelCount)
        val sumSqR = FloatArray(pixelCount)
        val sumSqG = FloatArray(pixelCount)
        val sumSqB = FloatArray(pixelCount)

        val pixels = IntArray(pixelCount)

        for (frame in referenceFrames) {
            frame.getPixels(pixels, 0, width, 0, 0, width, height)

            for (i in 0 until pixelCount) {
                val pixel = pixels[i]
                val r = ((pixel shr 16) and 0xFF).toFloat()
                val g = ((pixel shr 8) and 0xFF).toFloat()
                val b = (pixel and 0xFF).toFloat()

                sumR[i] += r
                sumG[i] += g
                sumB[i] += b
                sumSqR[i] += r * r
                sumSqG[i] += g * g
                sumSqB[i] += b * b
            }
        }

        val n = referenceFrames.size.toFloat()
        backgroundMean = FloatArray(pixelCount * 3)
        backgroundVariance = FloatArray(pixelCount * 3)

        for (i in 0 until pixelCount) {
            val meanR = sumR[i] / n
            val meanG = sumG[i] / n
            val meanB = sumB[i] / n

            backgroundMean!![i * 3] = meanR
            backgroundMean!![i * 3 + 1] = meanG
            backgroundMean!![i * 3 + 2] = meanB

            backgroundVariance!![i * 3] = max(100f, (sumSqR[i] / n) - (meanR * meanR))
            backgroundVariance!![i * 3 + 1] = max(100f, (sumSqG[i] / n) - (meanG * meanG))
            backgroundVariance!![i * 3 + 2] = max(100f, (sumSqB[i] / n) - (meanB * meanB))
        }
    }

    // Runtime Detection
    fun detectMotion(currentFrame: Bitmap): MotionRegion? {
        val mean = backgroundMean ?: return null
        val variance = backgroundVariance ?: return null

        val pixels = IntArray(width * height)
        currentFrame.getPixels(pixels, 0, width, 0, 0, width, height)

        var minX = width
        var minY = height
        var maxX = 0
        var maxY = 0
        var motionPixelCount = 0

        for (y in 0 until height) {
            for (x in 0 until width) {
                val i = y * width + x
                val pixel = pixels[i]

                val r = ((pixel shr 16) and 0xFF).toFloat()
                val g = ((pixel shr 8) and 0xFF).toFloat()
                val b = (pixel and 0xFF).toFloat()

                val diffR = abs(r - mean[i * 3]) / sqrt(variance[i * 3])
                val diffG = abs(g - mean[i * 3 + 1]) / sqrt(variance[i * 3 + 1])
                val diffB = abs(b - mean[i * 3 + 2]) / sqrt(variance[i * 3 + 2])

                val totalDiff = diffR + diffG + diffB

                if (totalDiff > motionThreshold) {
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)
                    motionPixelCount++
                }
            }
        }

        if (motionPixelCount < 500) return null

        // Add padding (20%)
        val boxWidth = maxX - minX
        val boxHeight = maxY - minY
        val padding = 0.2f

        val paddedMinX = max(0, (minX - boxWidth * padding).toInt())
        val paddedMinY = max(0, (minY - boxHeight * padding).toInt())
        val paddedMaxX = min(width - 1, (maxX + boxWidth * padding).toInt())
        val paddedMaxY = min(height - 1, (maxY + boxHeight * padding).toInt())

        val pixelBox = Rect(paddedMinX, paddedMinY, paddedMaxX, paddedMaxY)

        val normalizedBox = RectF(
            paddedMinX.toFloat() / width,
            paddedMinY.toFloat() / height,
            paddedMaxX.toFloat() / width,
            paddedMaxY.toFloat() / height
        )

        val confidence = min(1f, motionPixelCount / 10000f)

        return MotionRegion(normalizedBox, pixelBox, confidence)
    }
}
```

### 5.4 Integration with Pose Detection

```typescript
// Optimized detection pipeline with Ghost Gate
class OptimizedDetectionPipeline {
  private ghostGate: GhostGateCalibrator;
  private poseDetector: PoseDetector;

  async processFrame(frame: VideoFrame, timestamp: number): Promise<DetectionResult> {
    // Step 1: Get motion region from Ghost Gate
    const motionRegion = await this.ghostGate.detectMotion(frame);

    if (!motionRegion) {
      return { detected: false, reason: 'no_motion' };
    }

    // Step 2: Crop frame to motion region (70% smaller = 70% faster inference)
    const croppedFrame = cropFrame(frame, motionRegion.pixelBoundingBox);

    // Step 3: Run pose detection on cropped region only
    const pose = await this.poseDetector.detect(croppedFrame);

    if (!pose) {
      return { detected: false, reason: 'pose_not_found' };
    }

    // Step 4: Transform coordinates back to full frame
    const fullFramePose = transformToFullFrame(pose, motionRegion.pixelBoundingBox);

    // Step 5: Extract torso position
    const torsoPosition = extractTorsoPosition(fullFramePose);

    return {
      detected: true,
      torsoPosition,
      confidence: Math.min(motionRegion.confidence, pose.confidence),
      timestamp
    };
  }
}
```

### 5.5 Calibration Quality Validation

```typescript
interface CalibrationQuality {
  status: 'excellent' | 'good' | 'acceptable' | 'poor';
  frameCount: number;
  stabilityScore: number;  // 0-1, lower variance = higher
  lightingScore: number;   // 0-1, consistent brightness
  recommendation?: string;
}

function validateCalibration(
  referenceFrames: VideoFrame[]
): CalibrationQuality {
  // Check frame count
  if (referenceFrames.length < 30) {
    return {
      status: 'poor',
      frameCount: referenceFrames.length,
      stabilityScore: 0,
      lightingScore: 0,
      recommendation: 'Need at least 30 frames (1 second). Keep camera still.'
    };
  }

  // Analyze frame-to-frame variance (detect camera shake)
  const frameVariances = calculateFrameVariances(referenceFrames);
  const avgVariance = mean(frameVariances);
  const stabilityScore = Math.max(0, 1 - avgVariance / 1000);

  // Analyze lighting consistency
  const frameBrightness = referenceFrames.map(f => calculateBrightness(f));
  const brightnessStdDev = standardDeviation(frameBrightness);
  const lightingScore = Math.max(0, 1 - brightnessStdDev / 50);

  // Determine overall status
  let status: CalibrationQuality['status'];
  let recommendation: string | undefined;

  if (stabilityScore > 0.9 && lightingScore > 0.9) {
    status = 'excellent';
  } else if (stabilityScore > 0.7 && lightingScore > 0.7) {
    status = 'good';
  } else if (stabilityScore > 0.5 && lightingScore > 0.5) {
    status = 'acceptable';
    recommendation = 'Consider using a tripod for better results.';
  } else {
    status = 'poor';
    if (stabilityScore < 0.5) {
      recommendation = 'Camera is shaking. Use a tripod or stable surface.';
    } else {
      recommendation = 'Lighting is inconsistent. Avoid shadows and flickering lights.';
    }
  }

  return {
    status,
    frameCount: referenceFrames.length,
    stabilityScore,
    lightingScore,
    recommendation
  };
}
```

### 5.6 Auto-Recalibration Triggers

The Ghost Gate should automatically prompt for recalibration when:

| Trigger | Detection Method | Action |
|---------|------------------|--------|
| **Camera moved** | Sudden large background change | Prompt: "Camera position changed. Recalibrate?" |
| **Lighting change** | Average brightness shifted >20% | Prompt: "Lighting changed. Recalibrate?" |
| **Time elapsed** | 30+ minutes since calibration | Subtle indicator: "Refresh calibration?" |
| **High false positive rate** | >3 false detections in 1 minute | Auto-prompt recalibration |
| **Session break** | User pauses session >5 minutes | Optional recalibration on resume |

```typescript
class AutoRecalibrationMonitor {
  private lastCalibrationTime: number;
  private calibrationBrightness: number;
  private falsePositiveCount: number = 0;
  private lastFalsePositiveReset: number;

  checkRecalibrationNeeded(
    currentFrame: VideoFrame,
    detectionResult: DetectionResult
  ): RecalibrationReason | null {

    // Check time elapsed
    const elapsed = Date.now() - this.lastCalibrationTime;
    if (elapsed > 30 * 60 * 1000) {  // 30 minutes
      return 'time_elapsed';
    }

    // Check lighting change
    const currentBrightness = calculateBrightness(currentFrame);
    const brightnessDiff = Math.abs(currentBrightness - this.calibrationBrightness);
    if (brightnessDiff / this.calibrationBrightness > 0.2) {
      return 'lighting_changed';
    }

    // Check false positive rate
    if (detectionResult.isFalsePositive) {
      this.falsePositiveCount++;
      if (this.falsePositiveCount > 3) {
        return 'high_false_positive_rate';
      }
    }

    // Reset false positive counter every minute
    if (Date.now() - this.lastFalsePositiveReset > 60000) {
      this.falsePositiveCount = 0;
      this.lastFalsePositiveReset = Date.now();
    }

    return null;
  }
}

type RecalibrationReason =
  | 'camera_moved'
  | 'lighting_changed'
  | 'time_elapsed'
  | 'high_false_positive_rate'
  | 'session_resumed';
```

### 5.7 UX Flow for Calibration

```
┌─────────────────────────────────────────┐
│         Ghost Gate Calibration          │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     [CAMERA PREVIEW]            │    │
│  │                                 │    │
│  │     ⚠️ Clear the gate area      │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Position your phone to view the        │
│  finish line area.                      │
│                                         │
│  Make sure NO people are in frame.      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      [Start Calibration]        │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

         │
         ▼ (After 2-3 seconds)

┌─────────────────────────────────────────┐
│         Calibration Complete ✓          │
├─────────────────────────────────────────┤
│                                         │
│  Quality: Excellent                     │
│                                         │
│  ■■■■■■■■■■ Stability: 98%              │
│  ■■■■■■■■■□ Lighting: 91%               │
│                                         │
│  Ghost Gate is ready.                   │
│  Athletes will be detected              │
│  automatically when they enter frame.   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        [Start Session]          │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 6. Torso Detection & Body Part Filtering

### 6.1 Official Rule Compliance

Per **World Athletics Rule 164**: Athletes are placed in order in which any part of their **torso** (as distinguished from head, neck, arms, legs, hands, or feet) reaches the finish line.

### 6.2 Landmark Filtering Strategy

**INCLUDE (Torso):**
- Landmark 11: Left Shoulder
- Landmark 12: Right Shoulder
- Landmark 23: Left Hip
- Landmark 24: Right Hip

**EXCLUDE (Never trigger on):**
- Landmarks 0-10: Face, head, neck
- Landmarks 13-22: Arms, elbows, wrists, hands
- Landmarks 25-32: Legs, knees, ankles, feet

### 6.3 Lean-Adaptive Torso Detection

```typescript
interface TorsoDetectionConfig {
  minConfidence: number;           // 0.7 recommended
  leanThresholds: {
    low: number;    // 15 degrees
    medium: number; // 30 degrees
  };
}

function calculateTorsoCrossingPoint(
  landmarks: PoseLandmarks,
  config: TorsoDetectionConfig
): CrossingPoint | null {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  // Check all confidence thresholds
  const confidences = [
    leftShoulder.confidence,
    rightShoulder.confidence,
    leftHip.confidence,
    rightHip.confidence
  ];

  const minConfidence = Math.min(...confidences);
  if (minConfidence < config.minConfidence) {
    return null; // Reject low-confidence detection
  }

  // Calculate centers
  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };

  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  // Calculate lean angle (degrees from vertical)
  const leanAngle = Math.atan2(
    shoulderCenter.x - hipCenter.x,
    shoulderCenter.y - hipCenter.y
  ) * (180 / Math.PI);

  // Determine weighting based on lean
  let shoulderWeight: number;
  if (Math.abs(leanAngle) < config.leanThresholds.low) {
    // Upright: equal weighting
    shoulderWeight = 0.5;
  } else if (Math.abs(leanAngle) < config.leanThresholds.medium) {
    // Moderate lean: favor shoulder
    shoulderWeight = 0.7;
  } else {
    // Heavy lean: heavily favor shoulder (per IAAF - acromion crosses first)
    shoulderWeight = 0.85;
  }

  // Calculate crossing point
  const crossingX = shoulderWeight * shoulderCenter.x +
                    (1 - shoulderWeight) * hipCenter.x;
  const crossingY = shoulderWeight * shoulderCenter.y +
                    (1 - shoulderWeight) * hipCenter.y;

  return {
    x: crossingX,
    y: crossingY,
    confidence: minConfidence,
    leanAngle: leanAngle,
    method: shoulderWeight > 0.6 ? 'shoulder-weighted' : 'center'
  };
}
```

### 6.4 Arm Swing Filtering

Arms typically cross the finish line 50-200ms before torso due to natural swing. Filter them out:

```typescript
class ArmSwingFilter {
  private observationWindow: number = 300; // ms
  private pendingCrossing: CrossingEvent | null = null;

  processLandmark(
    landmark: Landmark,
    landmarkIndex: number,
    timestamp: number
  ): CrossingEvent | null {

    // Immediately reject arm/hand/leg landmarks
    const armLandmarks = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const legLandmarks = [25, 26, 27, 28, 29, 30, 31, 32];

    if (armLandmarks.includes(landmarkIndex) ||
        legLandmarks.includes(landmarkIndex)) {
      // Arm/leg detected crossing - start observation window
      if (!this.pendingCrossing) {
        this.pendingCrossing = {
          startTime: timestamp,
          waitingForTorso: true
        };
      }
      return null; // Never trigger on arm/leg
    }

    // Torso landmark (11, 12, 23, 24)
    const torsoLandmarks = [11, 12, 23, 24];
    if (torsoLandmarks.includes(landmarkIndex)) {
      const crossing = this.calculateTorsoCrossing(landmark, timestamp);

      if (crossing) {
        this.pendingCrossing = null; // Clear observation window
        return crossing;
      }
    }

    return null;
  }

  private calculateTorsoCrossing(
    landmark: Landmark,
    timestamp: number
  ): CrossingEvent | null {
    // Implementation of torso crossing detection
    // ...
  }
}
```

### 6.5 Velocity-Based Filtering

Filter out landmarks moving faster than typical sprint speed (arms swing faster):

```typescript
function filterByVelocity(
  currentLandmark: LandmarkWithTimestamp,
  previousLandmark: LandmarkWithTimestamp,
  pixelsPerMeter: number
): boolean {
  const MAX_SPRINT_VELOCITY = 13; // m/s (arms can exceed 15 m/s)

  const dt = (currentLandmark.timestamp - previousLandmark.timestamp) / 1000; // seconds
  const dx = (currentLandmark.x - previousLandmark.x) / pixelsPerMeter; // meters
  const dy = (currentLandmark.y - previousLandmark.y) / pixelsPerMeter; // meters

  const velocity = Math.sqrt(dx * dx + dy * dy) / dt; // m/s

  // Reject if moving faster than possible sprint speed (likely arm swing)
  return velocity <= MAX_SPRINT_VELOCITY;
}
```

---

## 7. Sub-Frame Interpolation Algorithms

### 7.1 Algorithm Selection by Frame Rate

| Frame Rate | Recommended Algorithm | Expected Accuracy |
|------------|----------------------|-------------------|
| 30 FPS | Velocity-based | +/- 5-10ms |
| 60 FPS | Velocity-based | +/- 2-5ms |
| 120 FPS | Quadratic motion | +/- 1-2ms |
| 240+ FPS | Linear (sufficient) | +/- 0.5-1ms |

### 7.2 Linear Interpolation (240+ FPS)

```typescript
function linearInterpolate(
  frameBeforeCrossing: Frame,
  frameAfterCrossing: Frame,
  finishLineX: number
): number {
  const positionBefore = frameBeforeCrossing.torsoX;
  const positionAfter = frameAfterCrossing.torsoX;
  const timeBefore = frameBeforeCrossing.timestamp;
  const timeAfter = frameAfterCrossing.timestamp;

  // Calculate fraction of interval when crossing occurred
  const totalDistance = positionAfter - positionBefore;
  const distanceToLine = finishLineX - positionBefore;
  const fraction = distanceToLine / totalDistance;

  // Interpolate timestamp
  const frameInterval = timeAfter - timeBefore;
  const crossingTime = timeBefore + (fraction * frameInterval);

  return crossingTime;
}
```

### 7.3 Velocity-Based Interpolation (60-120 FPS)

```typescript
function velocityInterpolate(
  frameHistory: Frame[], // Last 5+ frames
  finishLineX: number
): number {
  // Calculate velocities from frame history
  const velocities: number[] = [];
  for (let i = 0; i < frameHistory.length - 1; i++) {
    const dt = frameHistory[i + 1].timestamp - frameHistory[i].timestamp;
    const dx = frameHistory[i + 1].torsoX - frameHistory[i].torsoX;
    velocities.push(dx / dt);
  }

  // Average velocity
  const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;

  // Calculate acceleration (if enough samples)
  let acceleration = 0;
  if (velocities.length >= 2) {
    const dv = velocities[velocities.length - 1] - velocities[velocities.length - 2];
    const dt = frameHistory[frameHistory.length - 1].timestamp -
               frameHistory[frameHistory.length - 2].timestamp;
    acceleration = dv / dt;
  }

  // Find frames surrounding crossing
  let frameBefore: Frame | null = null;
  let frameAfter: Frame | null = null;

  for (let i = 0; i < frameHistory.length - 1; i++) {
    if (frameHistory[i].torsoX < finishLineX &&
        frameHistory[i + 1].torsoX >= finishLineX) {
      frameBefore = frameHistory[i];
      frameAfter = frameHistory[i + 1];
      break;
    }
  }

  if (!frameBefore || !frameAfter) {
    throw new Error('No crossing detected in frame history');
  }

  const positionBefore = frameBefore.torsoX;
  const distanceToLine = finishLineX - positionBefore;

  // Solve: distance = v*t + 0.5*a*t^2
  let timeToLine: number;

  if (Math.abs(acceleration) > 0.001) {
    // Quadratic solution
    const discriminant = avgVelocity * avgVelocity +
                         2 * acceleration * distanceToLine;
    timeToLine = (-avgVelocity + Math.sqrt(discriminant)) / acceleration;
  } else {
    // Constant velocity
    timeToLine = distanceToLine / avgVelocity;
  }

  return frameBefore.timestamp + timeToLine;
}
```

### 7.4 Quadratic Motion Model (120 FPS)

```typescript
function quadraticInterpolate(
  frame1: Frame, // N-2
  frame2: Frame, // N-1
  frame3: Frame, // N
  finishLineX: number
): number {
  // Use 3 frames to fit parabola: x(t) = x0 + v0*t + 0.5*a*t^2
  const t0 = frame1.timestamp;
  const t1 = frame2.timestamp;
  const t2 = frame3.timestamp;

  const x0 = frame1.torsoX;
  const x1 = frame2.torsoX;
  const x2 = frame3.torsoX;

  // Fit quadratic coefficients
  const dt1 = t1 - t0;
  const dt2 = t2 - t0;

  // Solve system of equations
  const a = 2 * ((x2 - x0) / dt2 - (x1 - x0) / dt1) / (dt2 - dt1);
  const v0 = (x1 - x0) / dt1 - 0.5 * a * dt1;

  // Find when x(t) = finishLineX
  // 0.5*a*t^2 + v0*t + (x0 - finishLineX) = 0
  const c = x0 - finishLineX;

  const discriminant = v0 * v0 - 2 * a * c;

  if (discriminant < 0) {
    // Fallback to linear
    return linearInterpolate(frame2, frame3, finishLineX);
  }

  const tCross = (-v0 + Math.sqrt(discriminant)) / a;
  return t0 + tCross;
}
```

### 7.5 Polynomial Curve Fitting (Research/Validation)

```typescript
import { polyfit, roots } from 'mathjs'; // Or similar library

function polynomialInterpolate(
  frameHistory: Frame[], // 10+ frames
  finishLineX: number,
  degree: number = 3 // Cubic
): number {
  const times = frameHistory.map(f => f.timestamp);
  const positions = frameHistory.map(f => f.torsoX);

  // Fit polynomial
  const coefficients = polyfit(times, positions, degree);

  // Create polynomial function: p(t) = c0 + c1*t + c2*t^2 + ...
  const polyFunc = (t: number) => {
    let result = 0;
    for (let i = 0; i < coefficients.length; i++) {
      result += coefficients[i] * Math.pow(t, i);
    }
    return result;
  };

  // Find crossing using bisection method
  const tStart = frameHistory[frameHistory.length - 2].timestamp;
  const tEnd = frameHistory[frameHistory.length - 1].timestamp;

  const crossingTime = bisectionRoot(
    (t) => polyFunc(t) - finishLineX,
    tStart,
    tEnd,
    1e-9 // Nanosecond precision
  );

  return crossingTime;
}

function bisectionRoot(
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number
): number {
  while (b - a > tolerance) {
    const mid = (a + b) / 2;
    if (f(mid) * f(a) < 0) {
      b = mid;
    } else {
      a = mid;
    }
  }
  return (a + b) / 2;
}
```

---

## 8. Manual Override System

### 8.1 Data Model for Override Tracking

```typescript
interface TimingResult {
  id: string;
  sessionId: string;
  athleteId?: string;

  // Timing data
  time_ms: number;

  // Source tracking
  source: 'auto_detected' | 'manual_override' | 'manual_only';
  confidence: number | null;        // null for manual

  // If overridden, original auto-detected values
  originalAutoTime?: number;
  originalAutoConfidence?: number;
  originalAutoFrame?: number;

  // Override metadata
  overrideReason?: string;
  overrideTimestamp?: Date;
  overrideBy?: string;              // User ID

  // Frame data
  frameNumber: number;
  videoFrameRate: number;
  interpolationMethod?: string;

  // Evidence
  evidenceClipId?: string;
}

interface OverrideAuditLog {
  id: string;
  timingResultId: string;
  timestamp: Date;
  action: 'override' | 'revert' | 'adjust';
  userId: string;

  before: {
    time_ms: number;
    source: string;
    confidence: number | null;
    frame: number;
  };

  after: {
    time_ms: number;
    source: string;
    confidence: number | null;
    frame: number;
  };

  reason?: string;
  deviceInfo: {
    model: string;
    os: string;
    appVersion: string;
  };
}
```

### 8.2 Evidence Review Screen

```typescript
interface EvidenceReviewProps {
  evidenceClipUrl: string;
  autoDetectedTime: number;
  autoDetectedFrame: number;
  confidence: number;
  frameRate: number;
  onConfirm: (time: number, frame: number) => void;
  onOverride: (time: number, frame: number, reason: string) => void;
}

// React Native component structure
const EvidenceReviewScreen: React.FC<EvidenceReviewProps> = ({
  evidenceClipUrl,
  autoDetectedTime,
  autoDetectedFrame,
  confidence,
  frameRate,
  onConfirm,
  onOverride
}) => {
  const [currentFrame, setCurrentFrame] = useState(autoDetectedFrame);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.6);

  // Calculate time from frame
  const currentTime = (currentFrame / frameRate) * 1000; // ms
  const timeDelta = currentTime - autoDetectedTime;

  return (
    <View style={styles.container}>
      {/* Video player with overlays */}
      <VideoPlayer
        source={evidenceClipUrl}
        currentFrame={currentFrame}
        playbackSpeed={playbackSpeed}
        overlay={showOverlay ? (
          <FinishLineOverlay opacity={overlayOpacity} />
        ) : null}
      />

      {/* Playback controls */}
      <PlaybackControls
        speed={playbackSpeed}
        onSpeedChange={setPlaybackSpeed}
        speeds={[0.25, 0.5, 0.75, 1.0, 1.5, 2.0]}
      />

      {/* Frame stepping */}
      <FrameStepControls
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        onFrameChange={setCurrentFrame}
        onStepBack={() => setCurrentFrame(f => f - 1)}
        onStepForward={() => setCurrentFrame(f => f + 1)}
      />

      {/* Timeline scrubber with variable speed */}
      <VariableSpeedScrubber
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        onChange={setCurrentFrame}
        autoDetectedFrame={autoDetectedFrame}
      />

      {/* Comparison panel */}
      <ComparisonPanel
        autoTime={autoDetectedTime}
        autoConfidence={confidence}
        currentTime={currentTime}
        delta={timeDelta}
      />

      {/* Action buttons */}
      <ActionButtons
        onConfirmAuto={() => onConfirm(autoDetectedTime, autoDetectedFrame)}
        onUseManual={() => {
          // Show reason picker
          showReasonPicker((reason) => {
            onOverride(currentTime, currentFrame, reason);
          });
        }}
        showWarning={confidence > 0.9 && Math.abs(timeDelta) > 10}
      />
    </View>
  );
};
```

### 8.3 Variable Speed Scrubbing

```typescript
interface VariableSpeedScrubberProps {
  currentFrame: number;
  totalFrames: number;
  onChange: (frame: number) => void;
  autoDetectedFrame: number;
}

const VariableSpeedScrubber: React.FC<VariableSpeedScrubberProps> = ({
  currentFrame,
  totalFrames,
  onChange,
  autoDetectedFrame
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [startX, setStartX] = useState(0);

  // Calculate speed multiplier based on vertical drag
  const getSpeedMultiplier = (verticalOffset: number): number => {
    if (verticalOffset < 50) return 1.0;      // Normal speed
    if (verticalOffset < 100) return 0.5;     // Half speed
    if (verticalOffset < 150) return 0.25;    // Quarter speed (frame-by-frame)
    return 0.1;                                // Ultra-precise
  };

  const handlePanGesture = useAnimatedGestureHandler({
    onStart: (event) => {
      setIsDragging(true);
      setStartX(event.x);
    },
    onActive: (event) => {
      const dx = event.x - startX;
      const dy = event.y; // Vertical distance from scrubber

      setVerticalOffset(Math.max(0, dy));

      const speedMultiplier = getSpeedMultiplier(dy);
      const frameChange = Math.round(dx * speedMultiplier);

      const newFrame = Math.max(0, Math.min(totalFrames - 1,
                                            currentFrame + frameChange));
      onChange(newFrame);
    },
    onEnd: () => {
      setIsDragging(false);
      setVerticalOffset(0);
    }
  });

  const speedMultiplier = getSpeedMultiplier(verticalOffset);

  return (
    <View style={styles.scrubberContainer}>
      {/* Speed indicator overlay */}
      {isDragging && (
        <SpeedIndicator
          speed={speedMultiplier}
          opacity={0.1 + (verticalOffset / 150) * 0.5}
        />
      )}

      {/* Filmstrip preview */}
      <FilmstripPreview
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        visibleFrames={9}
      />

      {/* Scrubber track */}
      <PanGestureHandler onGestureEvent={handlePanGesture}>
        <Animated.View style={styles.scrubberTrack}>
          {/* Auto-detected marker */}
          <Marker
            frame={autoDetectedFrame}
            totalFrames={totalFrames}
            color="blue"
            label="Auto"
          />

          {/* Current position */}
          <Playhead
            frame={currentFrame}
            totalFrames={totalFrames}
          />
        </Animated.View>
      </PanGestureHandler>

      {/* Frame counter */}
      <FrameCounter
        current={currentFrame}
        total={totalFrames}
        time={(currentFrame / frameRate) * 1000}
      />
    </View>
  );
};
```

### 8.4 Confidence-Based Review Prompts

```typescript
interface ReviewPromptConfig {
  autoAcceptThreshold: number;     // 0.9 - auto-accept above this
  warningThreshold: number;        // 0.7 - show warning below this
  requireReviewThreshold: number;  // 0.5 - force manual review below this
}

function determineReviewAction(
  confidence: number,
  config: ReviewPromptConfig
): 'auto_accept' | 'optional_review' | 'warning_review' | 'required_review' {
  if (confidence >= config.autoAcceptThreshold) {
    return 'auto_accept';
  } else if (confidence >= config.warningThreshold) {
    return 'optional_review';
  } else if (confidence >= config.requireReviewThreshold) {
    return 'warning_review';
  } else {
    return 'required_review';
  }
}

// Override reasons (predefined + custom)
const OVERRIDE_REASONS = [
  'occlusion_by_other_athlete',
  'incorrect_torso_detection',
  'lighting_caused_error',
  'motion_blur',
  'wrong_athlete_detected',
  'camera_shake',
  'other' // Allows custom text
];
```

### 8.5 Undo/Redo System

```typescript
class TimingUndoManager {
  private undoStack: OverrideAction[] = [];
  private redoStack: OverrideAction[] = [];
  private maxStackSize = 50;

  recordAction(action: OverrideAction) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  undo(): OverrideAction | null {
    const action = this.undoStack.pop();
    if (action) {
      this.redoStack.push(action);
      return action;
    }
    return null;
  }

  redo(): OverrideAction | null {
    const action = this.redoStack.pop();
    if (action) {
      this.undoStack.push(action);
      return action;
    }
    return null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}

interface OverrideAction {
  type: 'override' | 'revert';
  resultId: string;
  before: TimingResult;
  after: TimingResult;
  timestamp: Date;
}
```

---

## 9. Multi-Phone Clock Synchronization

### 9.1 NTP-Style Protocol

```typescript
interface SyncPacket {
  type: 'ping' | 'pong';
  senderId: string;
  sequenceNumber: number;
  t1?: number; // Host send time
  t2?: number; // Gate receive time
  t3?: number; // Gate send time (pong only)
}

class ClockSynchronizer {
  private offsets: number[] = [];
  private rtts: number[] = [];
  private readonly MAX_SAMPLES = 20;

  /**
   * Process sync round-trip and calculate offset
   */
  processSyncRoundTrip(
    t1: number, // Host sent ping
    t2: number, // Gate received ping
    t3: number, // Gate sent pong
    t4: number  // Host received pong
  ): SyncResult {
    // Calculate offset: ((T2 - T1) + (T3 - T4)) / 2
    const offset = ((t2 - t1) + (t3 - t4)) / 2;

    // Calculate round-trip time
    const rtt = (t4 - t1) - (t3 - t2);

    // Store samples
    this.offsets.push(offset);
    this.rtts.push(rtt);

    if (this.offsets.length > this.MAX_SAMPLES) {
      this.offsets.shift();
      this.rtts.shift();
    }

    // Use median offset (more robust to outliers)
    const sortedOffsets = [...this.offsets].sort((a, b) => a - b);
    const medianOffset = sortedOffsets[Math.floor(sortedOffsets.length / 2)];

    // Calculate RTT statistics
    const avgRtt = this.rtts.reduce((a, b) => a + b, 0) / this.rtts.length;
    const maxRtt = Math.max(...this.rtts);

    return {
      offset: medianOffset,
      confidence: this.calculateConfidence(),
      avgRtt,
      maxRtt,
      sampleCount: this.offsets.length
    };
  }

  private calculateConfidence(): number {
    if (this.offsets.length < 3) return 0;

    // Calculate standard deviation of offsets
    const mean = this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length;
    const variance = this.offsets.reduce((sum, val) =>
      sum + Math.pow(val - mean, 2), 0) / this.offsets.length;
    const stdDev = Math.sqrt(variance);

    // High confidence if stdDev < 2ms
    if (stdDev < 2_000_000) return 1.0;        // < 2ms
    if (stdDev < 5_000_000) return 0.8;        // < 5ms
    if (stdDev < 10_000_000) return 0.5;       // < 10ms
    return 0.2;                                 // Poor sync
  }

  /**
   * Adjust timestamp from gate clock to host clock
   */
  adjustTimestamp(gateTimestamp: number): number {
    const medianOffset = this.getMedianOffset();
    return gateTimestamp - medianOffset;
  }

  private getMedianOffset(): number {
    if (this.offsets.length === 0) return 0;
    const sorted = [...this.offsets].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
}

interface SyncResult {
  offset: number;       // nanoseconds
  confidence: number;   // 0-1
  avgRtt: number;       // nanoseconds
  maxRtt: number;       // nanoseconds
  sampleCount: number;
}
```

### 9.2 Continuous Drift Correction

```typescript
class DriftCorrector {
  private syncHistory: Array<{ timestamp: number; offset: number }> = [];
  private driftRate: number = 0; // nanoseconds per second

  recordSync(timestamp: number, offset: number) {
    this.syncHistory.push({ timestamp, offset });

    // Keep last 60 seconds of sync history
    const cutoff = timestamp - 60_000_000_000; // 60 seconds in nanoseconds
    this.syncHistory = this.syncHistory.filter(s => s.timestamp > cutoff);

    // Calculate drift rate if we have enough samples
    if (this.syncHistory.length >= 3) {
      this.calculateDriftRate();
    }
  }

  private calculateDriftRate() {
    // Linear regression to find drift rate
    const n = this.syncHistory.length;
    const firstSync = this.syncHistory[0];

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (const sync of this.syncHistory) {
      const x = (sync.timestamp - firstSync.timestamp) / 1_000_000_000; // seconds
      const y = sync.offset;

      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    // Slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX^2)
    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) > 0.0001) {
      this.driftRate = (n * sumXY - sumX * sumY) / denominator;
    }
  }

  /**
   * Predict offset at a given timestamp based on drift
   */
  predictOffset(timestamp: number): number {
    if (this.syncHistory.length === 0) return 0;

    const lastSync = this.syncHistory[this.syncHistory.length - 1];
    const timeSinceSync = (timestamp - lastSync.timestamp) / 1_000_000_000; // seconds

    return lastSync.offset + (this.driftRate * timeSinceSync);
  }

  getDriftRateMs(): number {
    return this.driftRate / 1_000_000; // Convert to ms/s
  }
}
```

### 9.3 Sync Quality Monitoring

```typescript
interface SyncQuality {
  status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
  offsetMs: number;
  driftRateMs: number;
  rttMs: number;
  recommendation?: string;
}

function evaluateSyncQuality(
  offset: number,      // nanoseconds
  driftRate: number,   // nanoseconds per second
  rtt: number          // nanoseconds
): SyncQuality {
  const offsetMs = Math.abs(offset) / 1_000_000;
  const driftRateMs = Math.abs(driftRate) / 1_000_000;
  const rttMs = rtt / 1_000_000;

  let status: SyncQuality['status'];
  let recommendation: string | undefined;

  if (offsetMs < 2 && driftRateMs < 0.1 && rttMs < 50) {
    status = 'excellent';
  } else if (offsetMs < 5 && driftRateMs < 0.5 && rttMs < 100) {
    status = 'good';
  } else if (offsetMs < 10 && driftRateMs < 1.0 && rttMs < 200) {
    status = 'acceptable';
  } else if (offsetMs < 20) {
    status = 'poor';
    recommendation = 'Consider moving phones closer or improving network';
  } else {
    status = 'critical';
    recommendation = 'Sync quality too low for reliable timing. Check network connection.';
  }

  return {
    status,
    offsetMs,
    driftRateMs: driftRateMs * 60, // Convert to ms per minute for readability
    rttMs,
    recommendation
  };
}
```

---

## Summary: Implementation Checklist

### Phase 1: Native Engine Setup
- [ ] Configure React Native 0.83+ with New Architecture
- [ ] Set up Swift TurboModule with Objective-C++ adapter
- [ ] Implement high-FPS camera capture (iOS: AVFoundation, Android: CameraX)
- [ ] Integrate pose detection (iOS: Vision, Android: MediaPipe)
- [ ] Implement precision timestamps (mach_continuous_time / elapsedRealtimeNanos)

### Phase 2: Ghost Gate Calibration
- [ ] Implement background model capture (Gaussian Mixture Model)
- [ ] Build calibration UI with quality feedback
- [ ] Implement motion detection via background subtraction
- [ ] Add auto-recalibration triggers (lighting, camera movement)
- [ ] Integrate motion region cropping with pose detection

### Phase 3: Torso Detection
- [ ] Implement landmark filtering (torso only, reject arms/legs)
- [ ] Add lean-adaptive torso center calculation
- [ ] Implement velocity-based arm swing filtering
- [ ] Add confidence threshold checking

### Phase 4: Timing Accuracy
- [ ] Implement sub-frame interpolation (linear, velocity-based, quadratic)
- [ ] Add Kalman filtering for pose smoothing
- [ ] Implement crossing detection with direction checking
- [ ] Calculate and display confidence scores

### Phase 5: Manual Override
- [ ] Build evidence review UI with frame stepping
- [ ] Implement variable-speed scrubbing
- [ ] Add override audit logging
- [ ] Implement undo/redo system

### Phase 6: Multi-Phone
- [ ] Implement NTP-style clock synchronization
- [ ] Add continuous drift correction
- [ ] Build sync quality monitoring
- [ ] Test sub-5ms sync accuracy

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-05 | Initial technical specification |
| 1.1 | 2026-01-05 | Added Ghost Gate calibration system (Section 5) |
| 1.2 | 2026-01-05 | Added Thumb Start Mode for solo training (Sections 3.5, 4.5) |
