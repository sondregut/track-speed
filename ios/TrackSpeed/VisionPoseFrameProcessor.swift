import VisionCamera
import Vision
import CoreImage
import UIKit

/**
 * VisionPoseFrameProcessor - iOS Vision Framework pose detection for sprint timing
 *
 * Uses VNDetectHumanBodyPoseRequest for accurate torso detection.
 * Per World Athletics Rule 164, only torso (shoulders + hips) triggers timing.
 *
 * Supports:
 * - Front and back camera with correct orientation handling
 * - Device orientation detection
 * - Debug mode for development logging
 */

@objc(VisionPoseFrameProcessorPlugin)
public class VisionPoseFrameProcessorPlugin: FrameProcessorPlugin {

  // Pose detection request
  private lazy var poseRequest: VNDetectHumanBodyPoseRequest = {
    return VNDetectHumanBodyPoseRequest()
  }()

  // Person segmentation request for silhouette-based detection
  @available(iOS 15.0, *)
  private lazy var segmentationRequest: VNGeneratePersonSegmentationRequest = {
    let request = VNGeneratePersonSegmentationRequest()
    request.qualityLevel = .fast  // Real-time performance
    return request
  }()

  // Minimum confidence threshold
  private let minConfidence: Float = 0.5

  // Whether to use segmentation-based detection (more accurate but slower)
  private var useSegmentationDetection = true

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
  }

  // Frame counter for occasional logging
  private var frameCount = 0

  // Store orientation info for debug output
  private var lastOrientation: String = ""
  private var lastFrameSize: String = ""

  // MARK: - Temporal Tracking State (for V1.1 refined algorithm)

  /// Direction detection: track torso X over frames
  private var previousTorsoX: CGFloat? = nil
  private var movementDirection: MovementDirection = .unknown

  /// Smoothed leading edge X for temporal stability
  private var smoothedLeadingEdgeX: CGFloat? = nil

  /// Previous frame's leading edge for sub-frame interpolation
  private var previousLeadingEdgeX: CGFloat? = nil
  private var previousFrameTimestamp: TimeInterval = 0

  enum MovementDirection {
    case unknown
    case movingRight  // Increasing X, front = maxX
    case movingLeft   // Decreasing X, front = minX
  }

  // MARK: - Torso ROI Data Structures

  /// Shrunk torso region that excludes arms
  private struct TorsoROI {
    let minX: CGFloat  // Left bound (normalized 0-1)
    let maxX: CGFloat  // Right bound
    let minY: CGFloat  // Top bound (shoulder area, normalized 0-1, Vision coords: 0=bottom)
    let maxY: CGFloat  // Bottom bound (hip area)
    let chestBandMinY: CGFloat  // Chest band top
    let chestBandMaxY: CGFloat  // Chest band bottom
    let shoulderMidX: CGFloat   // For direction detection
  }

  // MARK: - Frame Buffer for Review

  /// Buffered frame data for review feature
  private struct BufferedFrame {
    let jpegData: Data
    let timestamp: TimeInterval
    let torsoX: CGFloat
    let torsoY: CGFloat
    let confidence: Float
  }

  /// Rolling buffer of recent frames (pre-crossing)
  /// At high FPS we skip frames to maintain ~0.5s of buffer without excessive memory
  private var frameBuffer: [BufferedFrame] = []
  private let targetBufferDuration: TimeInterval = 0.5  // 0.5 seconds of frames
  private let maxBufferFrames = 30  // Cap buffer size for memory efficiency

  /// Capture state
  private var isCapturingCrossing = false
  private var crossingCaptureFrames: [BufferedFrame] = []
  private var postCrossingFrameCount = 0
  private let targetPostDuration: TimeInterval = 0.5  // 0.5 seconds after crossing
  private var aiDetectedFrameIndex: Int = 0

  /// Frame skipping for high FPS - only buffer every Nth frame
  private var frameSkipCounter = 0
  private var currentFps: Double = 60.0
  private var lastFrameTime: TimeInterval = 0

  // MARK: - Slit-Scan Photo Finish Detection

  /// A single vertical strip sample at the gate line
  private struct SlitSample {
    let timestamp: TimeInterval      // CMSampleBuffer PTS in milliseconds
    let strip: [UInt8]               // Luma values (Y channel) for each row
    let torsoRowMask: [Bool]         // Which rows are part of the torso polygon
    let foregroundMask: [Bool]       // Which rows have foreground (motion)
    let presenceRatio: Float         // torsoForegroundCount / torsoMaskCount
  }

  /// State for slit-scan crossing detection
  private struct SlitScanState {
    var backgroundStrip: [Float]     // EMA of luma strips (background model)
    var backgroundInitialized: Bool  // Has background been initialized?
    var samples: [SlitSample]        // Rolling buffer of recent samples
    var wasAboveThreshold: Bool      // Hysteresis state: was presence ratio above T_on?
    var crossingDetected: Bool       // Has crossing been triggered this session?
    var crossingTimestamp: TimeInterval? // Interpolated crossing time (ms)
    var preCrossingIndex: Int?       // Index of sample just before crossing
    var postCrossingIndex: Int?      // Index of sample just after crossing
  }

  /// Slit-scan configuration constants
  private let slitWidth: Int = 3                    // Width of slit in pixels (1-3)
  private let backgroundAlpha: Float = 0.02         // EMA alpha for background update
  private let foregroundDelta: Float = 25.0         // Luma difference threshold for foreground
  private let presenceThresholdOn: Float = 0.25     // Hysteresis: trigger when above this
  private let presenceThresholdOff: Float = 0.15    // Hysteresis: reset when below this
  private let maxSamples: Int = 120                 // Max samples to keep (~2s at 60fps)
  private let minFramesBetweenCrossings: Int = 30   // Debounce (~0.5s at 60fps)

  /// Current slit-scan state
  private var slitScanState = SlitScanState(
    backgroundStrip: [],
    backgroundInitialized: false,
    samples: [],
    wasAboveThreshold: false,
    crossingDetected: false,
    crossingTimestamp: nil,
    preCrossingIndex: nil,
    postCrossingIndex: nil
  )

  /// Frame count since last crossing (for debounce)
  private var framesSinceLastCrossing: Int = 0

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    let startTime = CACurrentMediaTime()
    frameCount += 1

    // Parse arguments
    let cameraPosition = arguments?["cameraPosition"] as? String ?? "back"
    let debugMode = arguments?["debug"] as? Bool ?? false
    let captureFrame = arguments?["captureFrame"] as? Bool ?? false
    let gateLineX = arguments?["gateLineX"] as? Double ?? 0.5
    let isFrontCamera = cameraPosition == "front"
    let startFrameBufferCapture = arguments?["startFrameBufferCapture"] as? Bool ?? false
    let enableFrameBuffer = arguments?["enableFrameBuffer"] as? Bool ?? false
    let resetFrameBuffer = arguments?["resetFrameBuffer"] as? Bool ?? false
    let useSlitScan = arguments?["useSlitScan"] as? Bool ?? true  // Default to slit-scan mode
    let resetSlitScan = arguments?["resetSlitScan"] as? Bool ?? false

    // Reset frame buffer if requested
    if resetFrameBuffer {
      frameBuffer.removeAll()
      crossingCaptureFrames.removeAll()
      isCapturingCrossing = false
      postCrossingFrameCount = 0
    }

    // Reset slit-scan state if requested (for new timing session)
    if resetSlitScan {
      resetSlitScanState()
    }

    // Get pixel buffer from frame
    let buffer = frame.buffer
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else {
      return "{\"detected\":false,\"error\":\"no_buffer\"}"
    }

    // Get frame dimensions
    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    lastFrameSize = "\(width)x\(height)"

    // Get current device orientation
    let deviceOrientation = UIDevice.current.orientation

    // Calculate correct Vision orientation based on device orientation and camera
    let visionOrientation = calculateVisionOrientation(
      deviceOrientation: deviceOrientation,
      isFrontCamera: isFrontCamera
    )

    lastOrientation = "\(deviceOrientation.rawValue)->\(visionOrientation.rawValue)"

    // Debug logging (only every 60 frames and only in debug mode)
    if debugMode && frameCount % 60 == 1 {
      print("[VisionPose] Frame \(frameCount): size=\(width)x\(height), device=\(deviceOrientation.rawValue), vision=\(visionOrientation.rawValue), camera=\(cameraPosition)")
    }

    // Run pose detection with calculated orientation
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: visionOrientation, options: [:])

    // Build request list - always include pose, conditionally include segmentation
    var requests: [VNRequest] = [poseRequest]
    if #available(iOS 15.0, *), useSegmentationDetection {
      requests.append(segmentationRequest)
    }

    do {
      try handler.perform(requests)
    } catch {
      if debugMode {
        print("[VisionPose] ERROR: Vision request failed: \(error.localizedDescription)")
      }
      return String(format: "{\"detected\":false,\"error\":\"%@\"}",
                    error.localizedDescription.replacingOccurrences(of: "\"", with: "'"))
    }

    // Get pose results
    guard let observations = poseRequest.results else {
      return createJsonResult(detected: false, startTime: startTime, frameBase64: nil)
    }

    if observations.isEmpty {
      return createJsonResult(detected: false, startTime: startTime, frameBase64: nil)
    }

    // Use first person detected
    let observation = observations[0]

    // Get segmentation mask if available (iOS 15+)
    var segmentationMask: CVPixelBuffer? = nil
    if #available(iOS 15.0, *), useSegmentationDetection {
      segmentationMask = segmentationRequest.results?.first?.pixelBuffer
    }

    // Extract torso using hybrid approach: pose + segmentation "longest break" algorithm
    guard let torsoData = extractTorsoWithSegmentation(
      from: observation,
      segmentationMask: segmentationMask,
      frameWidth: width,
      frameHeight: height,
      isFrontCamera: isFrontCamera,
      gateLineX: CGFloat(gateLineX),
      debugMode: debugMode
    ) else {
      if debugMode && frameCount % 30 == 1 {
        print("[VisionPose] Person found but torso extraction failed (low confidence)")
      }
      return createJsonResult(detected: false, startTime: startTime, frameBase64: nil)
    }

    let processingTime = (CACurrentMediaTime() - startTime) * 1000
    let timestamp = Date().timeIntervalSince1970 * 1000

    // MARK: - Slit-Scan Processing
    var slitScanCrossing: SlitScanCrossingResult? = nil
    if useSlitScan {
      slitScanCrossing = processSlitScanFrame(
        pixelBuffer: pixelBuffer,
        observation: observation,
        gateLineX: CGFloat(gateLineX),
        timestamp: timestamp,
        debugMode: debugMode
      )
    }

    // Capture frame with overlays if requested
    var frameBase64: String? = nil
    if captureFrame {
      frameBase64 = captureFrameWithOverlays(
        pixelBuffer: pixelBuffer,
        torsoX: torsoData.centerX,
        torsoY: torsoData.centerY,
        gateLineX: CGFloat(gateLineX),
        orientation: visionOrientation,
        isFrontCamera: isFrontCamera
      )
    }

    // MARK: - Frame Buffer Logic

    // Create JPEG data for buffering (lighter weight than full overlays)
    var frameBufferFolderPath: String? = nil
    var captureComplete = false
    var capturedFrameCount = 0
    var capturedAiFrameIndex = 0

    if enableFrameBuffer || isCapturingCrossing {
      // Estimate FPS for adaptive frame skipping
      let currentTime = timestamp / 1000.0  // Convert to seconds
      if lastFrameTime > 0 {
        let deltaTime = currentTime - lastFrameTime
        if deltaTime > 0 {
          // Exponential moving average for FPS estimation
          let instantFps = 1.0 / deltaTime
          currentFps = currentFps * 0.9 + instantFps * 0.1
        }
      }
      lastFrameTime = currentTime

      // Calculate frame skip rate based on FPS
      // At 240fps, skip ~7/8 frames = buffer at ~30fps equivalent
      // At 120fps, skip ~3/4 frames = buffer at ~30fps equivalent
      // At 60fps or below, no skipping
      let targetBufferFps = 30.0
      let skipRate = max(1, Int(currentFps / targetBufferFps))
      frameSkipCounter += 1
      let shouldBufferFrame = (frameSkipCounter % skipRate == 0) || isCapturingCrossing

      if shouldBufferFrame {
        // Create lightweight JPEG for buffer
        if let jpegData = createFrameJpeg(pixelBuffer: pixelBuffer, orientation: visionOrientation, isFrontCamera: isFrontCamera) {
          let bufferedFrame = BufferedFrame(
            jpegData: jpegData,
            timestamp: timestamp,
            torsoX: torsoData.centerX,
            torsoY: torsoData.centerY,
            confidence: torsoData.confidence
          )

          if isCapturingCrossing {
            // We're in capture mode - collecting post-crossing frames
            crossingCaptureFrames.append(bufferedFrame)
            postCrossingFrameCount += 1

            // Check if we have enough post-crossing time elapsed (~0.5s)
            let firstPostCrossingTime = crossingCaptureFrames.count > frameBuffer.count
              ? crossingCaptureFrames[frameBuffer.count].timestamp
              : timestamp
            let elapsedPostCrossing = (timestamp - firstPostCrossingTime) / 1000.0  // seconds

            if elapsedPostCrossing >= targetPostDuration {
              // Capture complete - save to disk
              if let folderPath = saveFrameBufferToDisk(gateLineX: CGFloat(gateLineX)) {
                frameBufferFolderPath = folderPath
                captureComplete = true
                capturedFrameCount = crossingCaptureFrames.count
                capturedAiFrameIndex = aiDetectedFrameIndex
              }

              // Reset capture state
              isCapturingCrossing = false
              postCrossingFrameCount = 0
              crossingCaptureFrames.removeAll()
            }
          } else {
            // Normal buffering - maintain rolling buffer based on time
            frameBuffer.append(bufferedFrame)

            // Remove old frames beyond target duration
            while frameBuffer.count > 2 {
              let oldestTime = frameBuffer[0].timestamp
              let bufferDuration = (timestamp - oldestTime) / 1000.0  // seconds
              if bufferDuration > targetBufferDuration && frameBuffer.count > maxBufferFrames {
                frameBuffer.removeFirst()
              } else {
                break
              }
            }

            // Also cap at max frames for memory safety
            if frameBuffer.count > maxBufferFrames {
              frameBuffer.removeFirst()
            }

            // Check if we should start capture mode
            if startFrameBufferCapture && !isCapturingCrossing {
              isCapturingCrossing = true
              postCrossingFrameCount = 0
              // Copy current buffer as pre-crossing frames
              crossingCaptureFrames = frameBuffer
              aiDetectedFrameIndex = crossingCaptureFrames.count - 1  // AI detected this frame
              // Add current frame to capture
              crossingCaptureFrames.append(bufferedFrame)
              postCrossingFrameCount = 1
            }
          }
        }
      }
    }

    // Return JSON string with optional frame data and buffer info
    var jsonResult = String(format: "{\"detected\":true,\"confidence\":%.2f,\"torsoX\":%.6f,\"torsoY\":%.6f,\"timestamp\":%.0f,\"processingTimeMs\":%.2f",
                            torsoData.confidence * 100,
                            torsoData.centerX,
                            torsoData.centerY,
                            timestamp,
                            processingTime)

    if let base64 = frameBase64 {
      jsonResult += String(format: ",\"frameBase64\":\"%@\"", base64)
    }

    if captureComplete, let folderPath = frameBufferFolderPath {
      jsonResult += String(format: ",\"frameBufferPath\":\"%@\",\"frameCount\":%d,\"aiFrameIndex\":%d",
                          folderPath, capturedFrameCount, capturedAiFrameIndex)
    }

    // Add slit-scan results
    if let crossing = slitScanCrossing {
      jsonResult += String(format: ",\"slitScan\":{\"crossingDetected\":%@,\"presenceRatio\":%.4f,\"slitConfidence\":%.2f",
                          crossing.crossingDetected ? "true" : "false",
                          crossing.presenceRatio,
                          crossing.confidence)
      if let interpolatedTs = crossing.interpolatedTimestamp {
        jsonResult += String(format: ",\"interpolatedTimestamp\":%.3f", interpolatedTs)
      }
      jsonResult += "}"
    }

    jsonResult += "}"
    return jsonResult
  }

  // MARK: - Orientation Calculation

  /**
   * Calculate the correct CGImagePropertyOrientation for Vision framework
   * based on device orientation and camera position.
   *
   * The key insight is that:
   * - Back camera in portrait needs .right
   * - Front camera in portrait needs .leftMirrored (mirrored for selfie view)
   * - Landscape orientations need different mappings
   */
  private func calculateVisionOrientation(
    deviceOrientation: UIDeviceOrientation,
    isFrontCamera: Bool
  ) -> CGImagePropertyOrientation {

    // Handle unknown/flat orientations - default to portrait
    let effectiveOrientation: UIDeviceOrientation
    switch deviceOrientation {
    case .unknown, .faceUp, .faceDown:
      effectiveOrientation = .portrait
    default:
      effectiveOrientation = deviceOrientation
    }

    if isFrontCamera {
      // Front camera - needs mirroring for natural selfie view
      switch effectiveOrientation {
      case .portrait:
        return .leftMirrored
      case .portraitUpsideDown:
        return .rightMirrored
      case .landscapeLeft:
        return .upMirrored
      case .landscapeRight:
        return .downMirrored
      default:
        return .leftMirrored
      }
    } else {
      // Back camera
      switch effectiveOrientation {
      case .portrait:
        return .right
      case .portraitUpsideDown:
        return .left
      case .landscapeLeft:
        return .up
      case .landscapeRight:
        return .down
      default:
        return .right
      }
    }
  }

  // MARK: - Torso Extraction

  private struct TorsoData {
    let centerX: CGFloat
    let centerY: CGFloat
    let confidence: Float
  }

  /**
   * Extract torso center with multi-strategy approach:
   * 1. Full 4-point detection (both shoulders + both hips) - best for frontal poses
   * 2. Profile detection (1 shoulder + 1 hip + optional root) - for sideways poses
   * 3. Root-based detection (neck + root) - fallback using spine points
   *
   * This handles the common sprint timing scenario where runner passes sideways
   * through the gate (only one side of body visible to camera).
   *
   * For profile views, applies a chest offset toward the gate line since the
   * detected skeletal points are on the side of the body, not the front (chest).
   */
  private func extractTorso(from observation: VNHumanBodyPoseObservation, isFrontCamera: Bool, gateLineX: CGFloat = 0.5) -> TorsoData? {
    let minConf: Float = 0.3

    // Try to get all torso points
    let leftShoulder = try? observation.recognizedPoint(.leftShoulder)
    let rightShoulder = try? observation.recognizedPoint(.rightShoulder)
    let leftHip = try? observation.recognizedPoint(.leftHip)
    let rightHip = try? observation.recognizedPoint(.rightHip)
    let root = try? observation.recognizedPoint(.root) // Pelvis center - often visible in profile
    let neck = try? observation.recognizedPoint(.neck)

    // Helper to check if a point is valid (exists and meets confidence threshold)
    let isValid: (VNRecognizedPoint?) -> Bool = { point in
      guard let p = point else { return false }
      return p.confidence >= minConf
    }

    // Strategy 1: Full 4-point detection (frontal pose)
    if isValid(leftShoulder) && isValid(rightShoulder) && isValid(leftHip) && isValid(rightHip) {
      return computeTorsoCenter(
        shoulders: [leftShoulder!, rightShoulder!],
        hips: [leftHip!, rightHip!],
        isFrontCamera: isFrontCamera
      )
    }

    // Strategy 2: Profile detection - use whichever side is visible
    // Left side visible (runner facing left)
    if isValid(leftShoulder) && isValid(leftHip) {
      return computeTorsoFromSide(
        shoulder: leftShoulder!,
        hip: leftHip!,
        root: isValid(root) ? root : nil,
        isFrontCamera: isFrontCamera,
        gateLineX: gateLineX
      )
    }

    // Right side visible (runner facing right)
    if isValid(rightShoulder) && isValid(rightHip) {
      return computeTorsoFromSide(
        shoulder: rightShoulder!,
        hip: rightHip!,
        root: isValid(root) ? root : nil,
        isFrontCamera: isFrontCamera,
        gateLineX: gateLineX
      )
    }

    // Strategy 3: Spine-based fallback (neck + root/pelvis)
    if isValid(neck) && isValid(root) {
      return computeTorsoFromSpine(
        neck: neck!,
        root: root!,
        isFrontCamera: isFrontCamera
      )
    }

    // Strategy 4: Single shoulder + root (very profile view)
    if isValid(root) {
      if let shoulder = isValid(leftShoulder) ? leftShoulder : (isValid(rightShoulder) ? rightShoulder : nil) {
        return computeTorsoFromShoulderAndRoot(
          shoulder: shoulder,
          root: root!,
          isFrontCamera: isFrontCamera,
          gateLineX: gateLineX
        )
      }
    }

    return nil
  }

  // Full 4-point torso calculation with lean-adaptive weighting
  private func computeTorsoCenter(shoulders: [VNRecognizedPoint], hips: [VNRecognizedPoint], isFrontCamera: Bool) -> TorsoData {
    let avgConfidence = (shoulders.reduce(0) { $0 + $1.confidence } + hips.reduce(0) { $0 + $1.confidence }) / 4

    let shoulderMidX = (shoulders[0].location.x + shoulders[1].location.x) / 2
    let shoulderMidY = (shoulders[0].location.y + shoulders[1].location.y) / 2
    let hipMidX = (hips[0].location.x + hips[1].location.x) / 2
    let hipMidY = (hips[0].location.y + hips[1].location.y) / 2

    // Lean-adaptive weighting for sprinting pose
    let leanAngle = atan2(shoulderMidX - hipMidX, shoulderMidY - hipMidY)
    let leanFactor = sin(leanAngle) * 0.2
    let shoulderWeight = 0.5 - leanFactor
    let hipWeight = 0.5 + leanFactor

    var centerX = shoulderMidX * CGFloat(shoulderWeight) + hipMidX * CGFloat(hipWeight)
    let centerY = shoulderMidY * CGFloat(shoulderWeight) + hipMidY * CGFloat(hipWeight)

    if isFrontCamera {
      centerX = 1.0 - centerX
    }

    return TorsoData(centerX: centerX, centerY: 1.0 - centerY, confidence: avgConfidence)
  }

  // Profile detection: one shoulder + one hip visible
  // Applies chest offset toward the gate line since skeletal points are on the side of body
  private func computeTorsoFromSide(shoulder: VNRecognizedPoint, hip: VNRecognizedPoint, root: VNRecognizedPoint?, isFrontCamera: Bool, gateLineX: CGFloat) -> TorsoData {
    var avgConfidence = (shoulder.confidence + hip.confidence) / 2

    // For profile view when sprinting:
    // - Runner has forward lean, so CHEST is AHEAD of hip in direction of motion
    // - The visible shoulder indicates the forward edge of the torso
    // - Per World Athletics Rule 164 (now TR18), timing is based on the torso (chest)
    //
    // For Y position: blend shoulder and hip with chest being between them
    let shoulderWeightY: CGFloat = 0.45  // Chest is closer to shoulders than hips
    let hipWeightY: CGFloat = 0.55
    let centerY = shoulder.location.y * shoulderWeightY + hip.location.y * hipWeightY

    // Calculate torso height (shoulder to hip distance)
    let torsoHeight = abs(shoulder.location.y - hip.location.y)

    // Calculate base X position from skeleton
    var baseX: CGFloat
    if let root = root {
      // With root available, blend shoulder and root
      baseX = shoulder.location.x * 0.65 + root.location.x * 0.35
      avgConfidence = (shoulder.confidence + hip.confidence + root.confidence) / 3
    } else {
      // Without root, blend shoulder with hip
      baseX = shoulder.location.x * 0.55 + hip.location.x * 0.45
    }

    // CHEST OFFSET: Apply offset toward the gate line
    // The chest protrudes forward from the skeleton by approximately 12-15% of torso height
    // This accounts for the chest being ahead of the spine in the direction of running
    let chestOffsetFactor: CGFloat = 0.12  // 12% of torso height
    let chestOffset = torsoHeight * chestOffsetFactor

    // Determine direction to gate (in Vision coordinates, before front camera flip)
    // If gate is to the right of current position, chest offset should be positive
    // If gate is to the left, chest offset should be negative
    let directionToGate: CGFloat = gateLineX > baseX ? 1.0 : -1.0
    let centerX = baseX + (chestOffset * directionToGate)

    // Apply front camera flip after offset calculation
    var finalX = centerX
    if isFrontCamera {
      finalX = 1.0 - centerX
    }

    // Clamp to valid range
    finalX = max(0.0, min(1.0, finalX))

    // Slightly reduce confidence for profile detection (less reliable than frontal)
    return TorsoData(centerX: finalX, centerY: 1.0 - centerY, confidence: avgConfidence * 0.9)
  }

  // Spine-based detection using neck and root
  private func computeTorsoFromSpine(neck: VNRecognizedPoint, root: VNRecognizedPoint, isFrontCamera: Bool) -> TorsoData {
    let avgConfidence = (neck.confidence + root.confidence) / 2

    // Torso center is roughly 1/3 down from neck to root
    var centerX = (neck.location.x * 0.4 + root.location.x * 0.6)
    let centerY = (neck.location.y * 0.4 + root.location.y * 0.6)

    if isFrontCamera {
      centerX = 1.0 - centerX
    }

    // Lower confidence for spine-only detection
    return TorsoData(centerX: centerX, centerY: 1.0 - centerY, confidence: avgConfidence * 0.8)
  }

  // Shoulder + root fallback for extreme profile angles
  // Also applies chest offset toward the gate line
  private func computeTorsoFromShoulderAndRoot(shoulder: VNRecognizedPoint, root: VNRecognizedPoint, isFrontCamera: Bool, gateLineX: CGFloat) -> TorsoData {
    let avgConfidence = (shoulder.confidence + root.confidence) / 2

    // Calculate torso height from shoulder to root
    let torsoHeight = abs(shoulder.location.y - root.location.y)

    // Base position: midpoint between shoulder and root
    let baseX = (shoulder.location.x + root.location.x) / 2
    let centerY = (shoulder.location.y + root.location.y) / 2

    // Apply chest offset toward gate (same logic as computeTorsoFromSide)
    let chestOffsetFactor: CGFloat = 0.10  // 10% for lower confidence detection
    let chestOffset = torsoHeight * chestOffsetFactor
    let directionToGate: CGFloat = gateLineX > baseX ? 1.0 : -1.0
    let centerX = baseX + (chestOffset * directionToGate)

    var finalX = centerX
    if isFrontCamera {
      finalX = 1.0 - centerX
    }

    // Clamp to valid range
    finalX = max(0.0, min(1.0, finalX))

    // Lowest confidence tier
    return TorsoData(centerX: finalX, centerY: 1.0 - centerY, confidence: avgConfidence * 0.75)
  }

  // MARK: - Hybrid Torso Detection with Segmentation

  /**
   * Extract torso using V1.1 refined hybrid approach:
   * 1. Create a shrunk torso ROI from pose landmarks (excludes arms)
   * 2. Use person segmentation mask within this ROI only
   * 3. Find leading edge using contiguous run rule in chest band
   * 4. Aggregate with percentile and apply temporal smoothing
   *
   * This achieves professional timing gate accuracy by:
   * - Excluding arm swing via shrunk polygon
   * - Detecting the actual front of the chest, not skeletal joints
   */
  private func extractTorsoWithSegmentation(
    from observation: VNHumanBodyPoseObservation,
    segmentationMask: CVPixelBuffer?,
    frameWidth: Int,
    frameHeight: Int,
    isFrontCamera: Bool,
    gateLineX: CGFloat,
    debugMode: Bool
  ) -> TorsoData? {

    // First, get pose-based torso data as fallback
    guard let poseTorsoData = extractTorso(from: observation, isFrontCamera: isFrontCamera, gateLineX: gateLineX) else {
      return nil
    }

    // If no segmentation mask available, use pose-based detection
    guard let mask = segmentationMask else {
      return poseTorsoData
    }

    // V1.1: Create shrunk torso ROI that excludes arms
    guard let torsoROI = createShrunkTorsoROI(from: observation) else {
      return poseTorsoData
    }

    // Current timestamp for temporal tracking
    let currentTimestamp = Date().timeIntervalSince1970 * 1000

    // V1.1: Find leading edge using refined algorithm
    if let segmentationResult = findTorsoLeadingEdge(
      mask: mask,
      torsoROI: torsoROI,
      gateLineX: gateLineX,
      frameWidth: frameWidth,
      frameHeight: frameHeight,
      isFrontCamera: isFrontCamera,
      confidence: poseTorsoData.confidence,
      currentTimestamp: currentTimestamp,
      debugMode: debugMode
    ) {
      // Use segmentation-based X position
      var finalX = segmentationResult.leadingEdgeX
      if isFrontCamera {
        finalX = 1.0 - finalX
      }

      // SANITY CHECK: If segmentation X differs too much from pose X, fall back to pose
      // This prevents arm detection when arm swings in front of torso
      let maxAllowedDrift: CGFloat = 0.20  // 20% of frame width
      let drift = abs(finalX - poseTorsoData.centerX)

      if drift > maxAllowedDrift {
        if debugMode && frameCount % 30 == 1 {
          print("[VisionPose] V1.1: SANITY CHECK FAILED - drift=\(String(format: "%.3f", drift)) > max=\(maxAllowedDrift), using pose instead")
        }
        // Fall back to pose-based detection
        return poseTorsoData
      }

      // Use segmentation center Y
      let blendedY = segmentationResult.segmentCenterY

      if debugMode && frameCount % 60 == 1 {
        print("[VisionPose] V1.1: leadingX=\(String(format: "%.3f", finalX)), poseX=\(String(format: "%.3f", poseTorsoData.centerX)), drift=\(String(format: "%.3f", drift)), dir=\(movementDirection)")
      }

      // Boost confidence when segmentation confirms pose detection
      let confidenceBoost: Float = 1.1
      return TorsoData(
        centerX: finalX,
        centerY: blendedY,
        confidence: min(1.0, poseTorsoData.confidence * confidenceBoost)
      )
    }

    // Fallback to pose-based detection if segmentation analysis fails
    return poseTorsoData
  }

  /**
   * Get the Y bounds (shoulder to hip region) from pose detection
   * Returns normalized coordinates (0-1)
   */
  private func getTorsoYBounds(from observation: VNHumanBodyPoseObservation) -> (minY: CGFloat, maxY: CGFloat)? {
    let minConf: Float = 0.3

    let leftShoulder = try? observation.recognizedPoint(.leftShoulder)
    let rightShoulder = try? observation.recognizedPoint(.rightShoulder)
    let leftHip = try? observation.recognizedPoint(.leftHip)
    let rightHip = try? observation.recognizedPoint(.rightHip)
    let root = try? observation.recognizedPoint(.root)

    var yValues: [CGFloat] = []

    if let ls = leftShoulder, ls.confidence >= minConf { yValues.append(ls.location.y) }
    if let rs = rightShoulder, rs.confidence >= minConf { yValues.append(rs.location.y) }
    if let lh = leftHip, lh.confidence >= minConf { yValues.append(lh.location.y) }
    if let rh = rightHip, rh.confidence >= minConf { yValues.append(rh.location.y) }
    if let r = root, r.confidence >= minConf { yValues.append(r.location.y) }

    guard yValues.count >= 2 else { return nil }

    let minY = yValues.min()!
    let maxY = yValues.max()!

    // Add small margin (5% of torso height) for safety
    let margin = (maxY - minY) * 0.05
    return (minY: max(0, minY - margin), maxY: min(1, maxY + margin))
  }

  /// Result from segmentation mask analysis
  private struct SegmentationResult {
    let leadingEdgeX: CGFloat      // X position of the front of the longest segment
    let segmentCenterY: CGFloat    // Y center of the longest segment
    let segmentLength: Int         // Length of segment in pixels (for debugging)
  }

  // MARK: - V1.1 Refined Torso Leading Edge Detection

  /**
   * Creates a shrunk torso ROI from pose landmarks that excludes arms.
   * The raw shoulder/hip quad can include deltoids which stick out when arm swings.
   * We shrink inward by ~12% horizontally and shift top down by ~5% to get pure ribcage.
   */
  private func createShrunkTorsoROI(from observation: VNHumanBodyPoseObservation) -> TorsoROI? {
    let minConf: Float = 0.3

    // Get all 4 torso points
    guard let leftShoulder = try? observation.recognizedPoint(.leftShoulder),
          let rightShoulder = try? observation.recognizedPoint(.rightShoulder),
          let leftHip = try? observation.recognizedPoint(.leftHip),
          let rightHip = try? observation.recognizedPoint(.rightHip) else {
      return nil
    }

    // Need at least 2 points with good confidence
    let points = [leftShoulder, rightShoulder, leftHip, rightHip]
    let validPoints = points.filter { $0.confidence >= minConf }
    guard validPoints.count >= 2 else { return nil }

    // Calculate torso bounds
    let shoulderMidX = (leftShoulder.location.x + rightShoulder.location.x) / 2
    let shoulderMidY = (leftShoulder.location.y + rightShoulder.location.y) / 2
    let hipMidX = (leftHip.location.x + rightHip.location.x) / 2
    let hipMidY = (leftHip.location.y + rightHip.location.y) / 2

    // Calculate shoulder width and torso height
    let shoulderWidth = abs(rightShoulder.location.x - leftShoulder.location.x)
    let torsoHeight = abs(shoulderMidY - hipMidY)

    // Shrink horizontally by 30% on each side to exclude arms during swing
    // This is more aggressive than before (was 12%) to prevent arm detection
    let shrinkFactor: CGFloat = 0.30
    let horizontalShrink = shoulderWidth * shrinkFactor

    // Shift top edge down by 15% of torso height to exclude shoulders/deltoids
    let topShift = torsoHeight * 0.15

    // Calculate shrunk bounds
    let minX = min(leftShoulder.location.x, leftHip.location.x) + horizontalShrink
    let maxX = max(rightShoulder.location.x, rightHip.location.x) - horizontalShrink

    // Vision coordinates: Y=0 at bottom, Y=1 at top
    // Shoulders are higher (larger Y), hips are lower (smaller Y)
    let rawMinY = min(leftHip.location.y, rightHip.location.y)  // Hips (bottom)
    let rawMaxY = max(leftShoulder.location.y, rightShoulder.location.y)  // Shoulders (top)
    let minY = rawMinY + (torsoHeight * 0.10)  // Add 10% margin from hips
    let maxY = rawMaxY - topShift  // Shift down from shoulders

    // Calculate chest band: 25% down from shoulders, ±10% of torso height
    let chestY = shoulderMidY - (torsoHeight * 0.25)  // 25% down from shoulders
    let bandHalfHeight = torsoHeight * 0.10
    let chestBandMaxY = min(chestY + bandHalfHeight, maxY - torsoHeight * 0.10)  // Clamp
    let chestBandMinY = max(chestY - bandHalfHeight, minY + torsoHeight * 0.10)  // Clamp

    return TorsoROI(
      minX: max(0, minX),
      maxX: min(1, maxX),
      minY: max(0, minY),
      maxY: min(1, maxY),
      chestBandMinY: chestBandMinY,
      chestBandMaxY: chestBandMaxY,
      shoulderMidX: shoulderMidX
    )
  }

  /**
   * Find the leading edge of the torso using the refined V1.1 algorithm:
   * 1. Only analyze pixels within the shrunk torso ROI (excludes arms)
   * 2. For each Y in chest band, find the largest contiguous run of body pixels
   * 3. Take the front-most X of that run
   * 4. Aggregate using 90th percentile for robustness
   * 5. Apply confidence-weighted temporal smoothing
   */
  private func findTorsoLeadingEdge(
    mask: CVPixelBuffer,
    torsoROI: TorsoROI,
    gateLineX: CGFloat,
    frameWidth: Int,
    frameHeight: Int,
    isFrontCamera: Bool,
    confidence: Float,
    currentTimestamp: TimeInterval,
    debugMode: Bool
  ) -> SegmentationResult? {

    let maskWidth = CVPixelBufferGetWidth(mask)
    let maskHeight = CVPixelBufferGetHeight(mask)

    // Lock the pixel buffer for reading
    CVPixelBufferLockBaseAddress(mask, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(mask) else {
      return nil
    }

    let bytesPerRow = CVPixelBufferGetBytesPerRow(mask)

    // Step 1: Update movement direction based on torso center X
    updateMovementDirection(currentTorsoX: torsoROI.shoulderMidX)

    // Step 2: Convert ROI to mask pixel coordinates
    // Vision Y=0 at bottom, mask Y=0 at top, so flip
    let roiMinX = Int(torsoROI.minX * CGFloat(maskWidth))
    let roiMaxX = Int(torsoROI.maxX * CGFloat(maskWidth))
    let roiMinY = Int((1.0 - torsoROI.maxY) * CGFloat(maskHeight))  // Flip: Vision maxY -> mask minY
    let roiMaxY = Int((1.0 - torsoROI.minY) * CGFloat(maskHeight))  // Flip: Vision minY -> mask maxY

    // Chest band in mask coordinates
    let chestMinY = Int((1.0 - torsoROI.chestBandMaxY) * CGFloat(maskHeight))
    let chestMaxY = Int((1.0 - torsoROI.chestBandMinY) * CGFloat(maskHeight))

    // Clamp to valid ranges
    let startY = max(0, chestMinY)
    let endY = min(maskHeight - 1, chestMaxY)
    let startX = max(0, roiMinX)
    let endX = min(maskWidth - 1, roiMaxX)

    guard startY < endY && startX < endX else {
      return nil
    }

    // Threshold for body detection
    let bodyThreshold: UInt8 = 100

    // Step 3: For each Y in chest band, find the leading edge using contiguous run rule
    var leadingEdges: [CGFloat] = []

    for y in startY...endY {
      // Find the largest contiguous run of body pixels in this row within ROI
      if let leadingX = findLeadingEdgeInRow(
        baseAddress: baseAddress,
        bytesPerRow: bytesPerRow,
        y: y,
        startX: startX,
        endX: endX,
        threshold: bodyThreshold,
        direction: movementDirection
      ) {
        leadingEdges.append(CGFloat(leadingX) / CGFloat(maskWidth))
      }
    }

    guard !leadingEdges.isEmpty else {
      if debugMode && frameCount % 60 == 1 {
        print("[VisionPose] V1.1: No body pixels found in chest band ROI")
      }
      return nil
    }

    // Step 4: Aggregate using 90th percentile
    let rawLeadingEdgeX = computePercentile(values: leadingEdges, percentile: 0.90, direction: movementDirection)

    // Step 5: Apply confidence-weighted temporal smoothing (EMA)
    let smoothedX = applyTemporalSmoothing(rawX: rawLeadingEdgeX, confidence: confidence)

    // Calculate center Y of chest band for output
    let centerY = 1.0 - (CGFloat(startY + endY) / 2.0 / CGFloat(maskHeight))

    if debugMode && frameCount % 60 == 1 {
      print("[VisionPose] V1.1: direction=\(movementDirection), edges=\(leadingEdges.count), raw=\(String(format: "%.3f", rawLeadingEdgeX)), smoothed=\(String(format: "%.3f", smoothedX))")
    }

    // Store for sub-frame interpolation
    previousLeadingEdgeX = smoothedX
    previousFrameTimestamp = currentTimestamp

    return SegmentationResult(
      leadingEdgeX: smoothedX,
      segmentCenterY: centerY,
      segmentLength: leadingEdges.count
    )
  }

  /**
   * Find the leading edge X in a single row using contiguous run rule.
   * This prevents speckle noise from causing false triggers.
   */
  private func findLeadingEdgeInRow(
    baseAddress: UnsafeMutableRawPointer,
    bytesPerRow: Int,
    y: Int,
    startX: Int,
    endX: Int,
    threshold: UInt8,
    direction: MovementDirection
  ) -> Int? {

    // Find all contiguous runs in this row
    var runs: [(start: Int, end: Int)] = []
    var runStart: Int? = nil

    for x in startX...endX {
      let pixelOffset = y * bytesPerRow + x
      let pixelValue = baseAddress.load(fromByteOffset: pixelOffset, as: UInt8.self)
      let isBody = pixelValue > threshold

      if isBody && runStart == nil {
        runStart = x
      } else if !isBody && runStart != nil {
        runs.append((start: runStart!, end: x - 1))
        runStart = nil
      }
    }

    // Don't forget the last run
    if let start = runStart {
      runs.append((start: start, end: endX))
    }

    guard !runs.isEmpty else { return nil }

    // Find the largest contiguous run (should be the torso)
    guard let largestRun = runs.max(by: { ($0.end - $0.start) < ($1.end - $1.start) }) else {
      return nil
    }

    // Minimum run length to filter noise (at least 5 pixels or 10% of ROI width)
    let minRunLength = max(5, (endX - startX) / 10)
    guard (largestRun.end - largestRun.start + 1) >= minRunLength else {
      return nil
    }

    // Return the leading edge based on movement direction
    switch direction {
    case .movingRight:
      return largestRun.end  // Front is the right edge
    case .movingLeft:
      return largestRun.start  // Front is the left edge
    case .unknown:
      // Default: use the edge closer to the center of the row
      let midX = (startX + endX) / 2
      return abs(largestRun.start - midX) < abs(largestRun.end - midX) ? largestRun.start : largestRun.end
    }
  }

  /**
   * Update movement direction based on torso X position over frames.
   */
  private func updateMovementDirection(currentTorsoX: CGFloat) {
    if let prevX = previousTorsoX {
      let deltaX = currentTorsoX - prevX
      let threshold: CGFloat = 0.005  // Minimum movement to count

      if deltaX > threshold {
        movementDirection = .movingRight
      } else if deltaX < -threshold {
        movementDirection = .movingLeft
      }
      // If within threshold, keep previous direction
    }
    previousTorsoX = currentTorsoX
  }

  /**
   * Compute percentile of leading edge values.
   * For movingRight, we want high percentile of maxX values.
   * For movingLeft, we want low percentile (which means high percentile of minX values).
   */
  private func computePercentile(values: [CGFloat], percentile: Double, direction: MovementDirection) -> CGFloat {
    guard !values.isEmpty else { return 0.5 }

    let sorted: [CGFloat]
    switch direction {
    case .movingRight:
      sorted = values.sorted()  // Ascending, take high percentile
    case .movingLeft:
      sorted = values.sorted()  // Ascending, take low percentile (1 - percentile)
    case .unknown:
      sorted = values.sorted()
    }

    let adjustedPercentile: Double
    switch direction {
    case .movingRight:
      adjustedPercentile = percentile
    case .movingLeft:
      adjustedPercentile = 1.0 - percentile
    case .unknown:
      adjustedPercentile = 0.5
    }

    let index = Int(Double(sorted.count - 1) * adjustedPercentile)
    return sorted[max(0, min(index, sorted.count - 1))]
  }

  /**
   * Apply confidence-weighted exponential moving average for temporal smoothing.
   */
  private func applyTemporalSmoothing(rawX: CGFloat, confidence: Float) -> CGFloat {
    // Alpha based on confidence: high confidence = more responsive
    let alpha: CGFloat
    if confidence > 0.8 {
      alpha = 0.6  // Responsive
    } else if confidence > 0.5 {
      alpha = 0.4  // Moderate
    } else {
      alpha = 0.25  // Stable
    }

    if let prevSmoothed = smoothedLeadingEdgeX {
      let smoothed = prevSmoothed + alpha * (rawX - prevSmoothed)
      smoothedLeadingEdgeX = smoothed
      return smoothed
    } else {
      smoothedLeadingEdgeX = rawX
      return rawX
    }
  }

  private func createJsonResult(detected: Bool, startTime: CFTimeInterval, frameBase64: String?) -> String {
    let processingTime = (CACurrentMediaTime() - startTime) * 1000
    let timestamp = Date().timeIntervalSince1970 * 1000
    if let base64 = frameBase64 {
      return String(format: "{\"detected\":%@,\"confidence\":0,\"torsoX\":0,\"torsoY\":0,\"timestamp\":%.0f,\"processingTimeMs\":%.2f,\"frameBase64\":\"%@\"}",
                    detected ? "true" : "false",
                    timestamp,
                    processingTime,
                    base64)
    }
    return String(format: "{\"detected\":%@,\"confidence\":0,\"torsoX\":0,\"torsoY\":0,\"timestamp\":%.0f,\"processingTimeMs\":%.2f}",
                  detected ? "true" : "false",
                  timestamp,
                  processingTime)
  }

  // MARK: - Frame Capture with Overlays

  /**
   * Capture the current frame and draw overlays showing:
   * - Gate line (yellow vertical line)
   * - Torso indicator (green circle at detected position)
   *
   * Returns base64-encoded JPEG image
   */
  private func captureFrameWithOverlays(
    pixelBuffer: CVPixelBuffer,
    torsoX: CGFloat,
    torsoY: CGFloat,
    gateLineX: CGFloat,
    orientation: CGImagePropertyOrientation,
    isFrontCamera: Bool
  ) -> String? {

    // Convert pixel buffer to CIImage
    let ciImage = CIImage(cvPixelBuffer: pixelBuffer)

    // Apply orientation
    var orientedImage = ciImage.oriented(orientation)

    // Apply horizontal flip for front camera to match preview
    if isFrontCamera {
      orientedImage = orientedImage.transformed(by: CGAffineTransform(scaleX: -1, y: 1).translatedBy(x: -orientedImage.extent.width, y: 0))
    }

    // Get the context
    let context = CIContext(options: nil)

    // Render to CGImage
    guard let cgImage = context.createCGImage(orientedImage, from: orientedImage.extent) else {
      return nil
    }

    let imageWidth = CGFloat(cgImage.width)
    let imageHeight = CGFloat(cgImage.height)

    // Create a new graphics context to draw overlays
    UIGraphicsBeginImageContextWithOptions(CGSize(width: imageWidth, height: imageHeight), false, 1.0)
    guard let drawContext = UIGraphicsGetCurrentContext() else {
      UIGraphicsEndImageContext()
      return nil
    }

    // CGContext has origin at bottom-left, but we need top-left for correct orientation
    // Flip the context vertically before drawing
    drawContext.translateBy(x: 0, y: imageHeight)
    drawContext.scaleBy(x: 1.0, y: -1.0)

    // Draw the original image (now in correct orientation)
    drawContext.draw(cgImage, in: CGRect(x: 0, y: 0, width: imageWidth, height: imageHeight))

    // Flip back for overlay drawing (so overlays use top-left origin)
    drawContext.scaleBy(x: 1.0, y: -1.0)
    drawContext.translateBy(x: 0, y: -imageHeight)

    // Draw gate line (yellow, vertical)
    let gateX = gateLineX * imageWidth
    drawContext.setStrokeColor(UIColor.yellow.cgColor)
    drawContext.setLineWidth(4.0)
    drawContext.move(to: CGPoint(x: gateX, y: 0))
    drawContext.addLine(to: CGPoint(x: gateX, y: imageHeight))
    drawContext.strokePath()

    // Draw torso indicator (green circle)
    // Note: torsoY is already flipped (1.0 - y) so we need to flip back for drawing
    let indicatorX = torsoX * imageWidth
    let indicatorY = torsoY * imageHeight  // Already flipped in torso extraction
    let indicatorRadius: CGFloat = min(imageWidth, imageHeight) * 0.05

    // Outer circle (white border)
    drawContext.setStrokeColor(UIColor.white.cgColor)
    drawContext.setLineWidth(4.0)
    drawContext.addEllipse(in: CGRect(
      x: indicatorX - indicatorRadius,
      y: indicatorY - indicatorRadius,
      width: indicatorRadius * 2,
      height: indicatorRadius * 2
    ))
    drawContext.strokePath()

    // Inner circle (green fill)
    drawContext.setFillColor(UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 0.8).cgColor)
    drawContext.fillEllipse(in: CGRect(
      x: indicatorX - indicatorRadius * 0.6,
      y: indicatorY - indicatorRadius * 0.6,
      width: indicatorRadius * 1.2,
      height: indicatorRadius * 1.2
    ))

    // Draw crosshair on indicator
    drawContext.setStrokeColor(UIColor.white.cgColor)
    drawContext.setLineWidth(2.0)
    let crossSize: CGFloat = indicatorRadius * 0.4
    drawContext.move(to: CGPoint(x: indicatorX - crossSize, y: indicatorY))
    drawContext.addLine(to: CGPoint(x: indicatorX + crossSize, y: indicatorY))
    drawContext.move(to: CGPoint(x: indicatorX, y: indicatorY - crossSize))
    drawContext.addLine(to: CGPoint(x: indicatorX, y: indicatorY + crossSize))
    drawContext.strokePath()

    // Get the image with overlays
    guard let overlayImage = UIGraphicsGetImageFromCurrentImageContext() else {
      UIGraphicsEndImageContext()
      return nil
    }
    UIGraphicsEndImageContext()

    // Convert to JPEG and base64
    guard let jpegData = overlayImage.jpegData(compressionQuality: 0.7) else {
      return nil
    }

    return jpegData.base64EncodedString()
  }

  // MARK: - Frame Buffer Helpers

  /// Store gateLineX for use when saving frames with overlays
  private var storedGateLineX: CGFloat = 0.5

  /**
   * Draw overlays on existing JPEG data
   * Used when saving buffered frames to add gate line and torso indicator
   */
  private func addOverlaysToJpeg(
    jpegData: Data,
    torsoX: CGFloat,
    torsoY: CGFloat,
    gateLineX: CGFloat,
    isAiFrame: Bool = false
  ) -> Data? {
    guard let uiImage = UIImage(data: jpegData) else { return nil }

    let imageWidth = uiImage.size.width
    let imageHeight = uiImage.size.height

    UIGraphicsBeginImageContextWithOptions(CGSize(width: imageWidth, height: imageHeight), false, uiImage.scale)
    guard let context = UIGraphicsGetCurrentContext() else {
      UIGraphicsEndImageContext()
      return nil
    }

    // Draw original image
    uiImage.draw(at: .zero)

    // Draw gate line (yellow, vertical)
    let gateX = gateLineX * imageWidth
    context.setStrokeColor(UIColor.yellow.cgColor)
    context.setLineWidth(3.0)
    context.move(to: CGPoint(x: gateX, y: 0))
    context.addLine(to: CGPoint(x: gateX, y: imageHeight))
    context.strokePath()

    // Draw torso indicator (green/red circle based on AI frame)
    let indicatorX = torsoX * imageWidth
    let indicatorY = torsoY * imageHeight
    let indicatorRadius: CGFloat = min(imageWidth, imageHeight) * 0.04

    // Use different color for AI-detected frame
    let indicatorColor = isAiFrame
      ? UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 1.0)  // Green for AI frame
      : UIColor(red: 0.3, green: 0.6, blue: 0.9, alpha: 0.8)     // Blue for other frames

    // Outer circle (white border)
    context.setStrokeColor(UIColor.white.cgColor)
    context.setLineWidth(3.0)
    context.addEllipse(in: CGRect(
      x: indicatorX - indicatorRadius,
      y: indicatorY - indicatorRadius,
      width: indicatorRadius * 2,
      height: indicatorRadius * 2
    ))
    context.strokePath()

    // Inner circle (colored fill)
    context.setFillColor(indicatorColor.cgColor)
    context.fillEllipse(in: CGRect(
      x: indicatorX - indicatorRadius * 0.7,
      y: indicatorY - indicatorRadius * 0.7,
      width: indicatorRadius * 1.4,
      height: indicatorRadius * 1.4
    ))

    // Draw crosshair on indicator
    context.setStrokeColor(UIColor.white.cgColor)
    context.setLineWidth(2.0)
    let crossSize: CGFloat = indicatorRadius * 0.5
    context.move(to: CGPoint(x: indicatorX - crossSize, y: indicatorY))
    context.addLine(to: CGPoint(x: indicatorX + crossSize, y: indicatorY))
    context.move(to: CGPoint(x: indicatorX, y: indicatorY - crossSize))
    context.addLine(to: CGPoint(x: indicatorX, y: indicatorY + crossSize))
    context.strokePath()

    // Get result
    guard let overlayImage = UIGraphicsGetImageFromCurrentImageContext() else {
      UIGraphicsEndImageContext()
      return nil
    }
    UIGraphicsEndImageContext()

    return overlayImage.jpegData(compressionQuality: 0.85)
  }

  /**
   * Create a lightweight JPEG from pixel buffer for buffering
   */
  private func createFrameJpeg(pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation, isFrontCamera: Bool) -> Data? {
    let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
    var orientedImage = ciImage.oriented(orientation)

    // Apply horizontal flip for front camera to match preview
    if isFrontCamera {
      orientedImage = orientedImage.transformed(by: CGAffineTransform(scaleX: -1, y: 1).translatedBy(x: -orientedImage.extent.width, y: 0))
    }

    let context = CIContext(options: [.useSoftwareRenderer: false])
    guard let cgImage = context.createCGImage(orientedImage, from: orientedImage.extent) else {
      return nil
    }

    let uiImage = UIImage(cgImage: cgImage)
    return uiImage.jpegData(compressionQuality: 0.5)  // Lower quality for buffer
  }

  /**
   * Save all captured frames to disk with metadata
   * Returns folder path on success
   */
  private func saveFrameBufferToDisk(gateLineX: CGFloat) -> String? {
    // Create unique folder in temp directory
    let timestamp = Int(Date().timeIntervalSince1970 * 1000)
    let folderName = "crossing_\(timestamp)"
    let tempDir = FileManager.default.temporaryDirectory
    let folderURL = tempDir.appendingPathComponent(folderName)

    do {
      try FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)
    } catch {
      print("[VisionPose] Failed to create folder: \(error)")
      return nil
    }

    // Save each frame with overlays
    for (index, frame) in crossingCaptureFrames.enumerated() {
      let filename = String(format: "frame_%03d.jpg", index)
      let fileURL = folderURL.appendingPathComponent(filename)

      // Add overlays (gate line + torso indicator) to each frame
      let isAiFrame = index == aiDetectedFrameIndex
      let frameDataToSave: Data
      if let overlayData = addOverlaysToJpeg(
        jpegData: frame.jpegData,
        torsoX: frame.torsoX,
        torsoY: frame.torsoY,
        gateLineX: gateLineX,
        isAiFrame: isAiFrame
      ) {
        frameDataToSave = overlayData
      } else {
        // Fallback to raw frame if overlay fails
        frameDataToSave = frame.jpegData
      }

      do {
        try frameDataToSave.write(to: fileURL)
      } catch {
        print("[VisionPose] Failed to save frame \(index): \(error)")
      }
    }

    // Create metadata JSON
    var framesMetadata: [[String: Any]] = []
    for (index, frame) in crossingCaptureFrames.enumerated() {
      framesMetadata.append([
        "index": index,
        "timestamp": frame.timestamp,
        "torsoX": frame.torsoX,
        "torsoY": frame.torsoY,
        "confidence": frame.confidence
      ])
    }

    let metadata: [String: Any] = [
      "frameCount": crossingCaptureFrames.count,
      "aiDetectedFrameIndex": aiDetectedFrameIndex,
      "gateLineX": gateLineX,
      "frames": framesMetadata
    ]

    let metadataURL = folderURL.appendingPathComponent("metadata.json")
    do {
      let jsonData = try JSONSerialization.data(withJSONObject: metadata, options: .prettyPrinted)
      try jsonData.write(to: metadataURL)
    } catch {
      print("[VisionPose] Failed to save metadata: \(error)")
    }

    print("[VisionPose] Saved \(crossingCaptureFrames.count) frames to \(folderURL.path)")
    return folderURL.path
  }

  // MARK: - Slit-Scan Photo Finish Implementation

  /**
   * Extract a vertical luma strip at the gate line position.
   * Uses YCbCr pixel format (common for camera frames) to get Y (luma) channel.
   */
  private func extractLumaStrip(
    from pixelBuffer: CVPixelBuffer,
    gateLineX: CGFloat,
    slitWidth: Int = 3
  ) -> [UInt8]? {
    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)

    // Calculate center column for the gate line
    let centerX = Int(gateLineX * CGFloat(width))
    let halfWidth = slitWidth / 2

    // Ensure we're within bounds
    let startX = max(0, centerX - halfWidth)
    let endX = min(width - 1, centerX + halfWidth)

    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    // Get the Y plane (luma) - works for kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange/FullRange
    guard let yPlaneAddress = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else {
      // Fallback: try single-plane format (BGRA)
      return extractLumaFromBGRA(pixelBuffer: pixelBuffer, startX: startX, endX: endX, height: height)
    }

    let yBytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
    var strip = [UInt8](repeating: 0, count: height)

    // For each row, average the luma values across the slit width
    for y in 0..<height {
      var sum: Int = 0
      var count: Int = 0

      for x in startX...endX {
        let offset = y * yBytesPerRow + x
        let lumaValue = yPlaneAddress.load(fromByteOffset: offset, as: UInt8.self)
        sum += Int(lumaValue)
        count += 1
      }

      strip[y] = UInt8(sum / max(1, count))
    }

    return strip
  }

  /**
   * Fallback: extract luma from BGRA format pixel buffer
   */
  private func extractLumaFromBGRA(
    pixelBuffer: CVPixelBuffer,
    startX: Int,
    endX: Int,
    height: Int
  ) -> [UInt8]? {
    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      return nil
    }

    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    var strip = [UInt8](repeating: 0, count: height)

    for y in 0..<height {
      var sum: Int = 0
      var count: Int = 0

      for x in startX...endX {
        let offset = y * bytesPerRow + x * 4  // BGRA = 4 bytes per pixel
        let b = Int(baseAddress.load(fromByteOffset: offset, as: UInt8.self))
        let g = Int(baseAddress.load(fromByteOffset: offset + 1, as: UInt8.self))
        let r = Int(baseAddress.load(fromByteOffset: offset + 2, as: UInt8.self))

        // Convert RGB to luma: Y = 0.299*R + 0.587*G + 0.114*B
        let luma = (299 * r + 587 * g + 114 * b) / 1000
        sum += luma
        count += 1
      }

      strip[y] = UInt8(sum / max(1, count))
    }

    return strip
  }

  /**
   * Update the background model using exponential moving average.
   * Only updates when no significant foreground is detected (athlete not present).
   */
  private func updateBackgroundModel(
    strip: [UInt8],
    hasSignificantForeground: Bool
  ) {
    // Initialize background if needed
    if !slitScanState.backgroundInitialized || slitScanState.backgroundStrip.count != strip.count {
      slitScanState.backgroundStrip = strip.map { Float($0) }
      slitScanState.backgroundInitialized = true
      return
    }

    // Only update background when no significant foreground
    guard !hasSignificantForeground else { return }

    // EMA update: background = alpha * new + (1-alpha) * old
    for i in 0..<strip.count {
      let newVal = Float(strip[i])
      let oldVal = slitScanState.backgroundStrip[i]
      slitScanState.backgroundStrip[i] = backgroundAlpha * newVal + (1.0 - backgroundAlpha) * oldVal
    }
  }

  /**
   * Compute foreground mask by comparing current strip to background model.
   * A pixel is foreground if |current - background| > delta.
   */
  private func computeForegroundMask(strip: [UInt8]) -> [Bool] {
    guard slitScanState.backgroundInitialized,
          slitScanState.backgroundStrip.count == strip.count else {
      return [Bool](repeating: false, count: strip.count)
    }

    return zip(strip, slitScanState.backgroundStrip).map { (current, background) in
      abs(Float(current) - background) > foregroundDelta
    }
  }

  /**
   * Convert torso polygon (LS, RS, RH, LH) to a row mask indicating which Y values are torso.
   * Uses the pose observation to get the 4 torso landmarks.
   */
  private func createTorsoRowMask(
    from observation: VNHumanBodyPoseObservation,
    frameHeight: Int,
    gateLineX: CGFloat
  ) -> [Bool] {
    let minConf: Float = 0.3
    var mask = [Bool](repeating: false, count: frameHeight)

    // Get torso landmarks
    guard let leftShoulder = try? observation.recognizedPoint(.leftShoulder),
          let rightShoulder = try? observation.recognizedPoint(.rightShoulder),
          let leftHip = try? observation.recognizedPoint(.leftHip),
          let rightHip = try? observation.recognizedPoint(.rightHip) else {
      return mask
    }

    // Check confidence for at least 2 points
    let points = [leftShoulder, rightShoulder, leftHip, rightHip]
    let validPoints = points.filter { $0.confidence >= minConf }
    guard validPoints.count >= 2 else { return mask }

    // Get Y bounds (in Vision coordinates: 0 = bottom, 1 = top)
    let yCoords = points.filter { $0.confidence >= minConf }.map { $0.location.y }
    let minYVision = yCoords.min() ?? 0  // Hip area (bottom)
    let maxYVision = yCoords.max() ?? 1  // Shoulder area (top)

    // Shrink Y range by 10% on each end to exclude shoulders/deltoids and lower hips
    let yRange = maxYVision - minYVision
    let shrinkAmount = yRange * 0.10
    let shrunkMinY = minYVision + shrinkAmount
    let shrunkMaxY = maxYVision - shrinkAmount

    // Convert to pixel coordinates (flip Y: pixel 0 = top, Vision 0 = bottom)
    let startRow = Int((1.0 - shrunkMaxY) * CGFloat(frameHeight))
    let endRow = Int((1.0 - shrunkMinY) * CGFloat(frameHeight))

    // X bounds: check if torso polygon intersects the gate line at each Y
    // For simplicity, we use the shrunk X bounds from pose
    let xCoords = points.filter { $0.confidence >= minConf }.map { $0.location.x }
    let minX = xCoords.min() ?? 0
    let maxX = xCoords.max() ?? 1

    // Shrink X by 30% to exclude arms (same as TorsoROI)
    let xRange = maxX - minX
    let xShrink = xRange * 0.30
    let shrunkMinX = minX + xShrink
    let shrunkMaxX = maxX - xShrink

    // Only mark rows as torso if gate line is within the shrunk X bounds
    let gateInTorso = gateLineX >= shrunkMinX && gateLineX <= shrunkMaxX

    if gateInTorso {
      for row in max(0, startRow)..<min(frameHeight, endRow) {
        mask[row] = true
      }
    }

    return mask
  }

  /**
   * Result from slit-scan crossing detection
   */
  private struct SlitScanCrossingResult {
    let crossingDetected: Bool
    let interpolatedTimestamp: TimeInterval?  // In milliseconds
    let presenceRatio: Float
    let confidence: Float
  }

  /**
   * Process a single frame for slit-scan crossing detection.
   * This is the main entry point called each frame.
   */
  private func processSlitScanFrame(
    pixelBuffer: CVPixelBuffer,
    observation: VNHumanBodyPoseObservation,
    gateLineX: CGFloat,
    timestamp: TimeInterval,  // CMSampleBuffer PTS in ms
    debugMode: Bool
  ) -> SlitScanCrossingResult {
    let height = CVPixelBufferGetHeight(pixelBuffer)

    // Increment debounce counter
    framesSinceLastCrossing += 1

    // Step 1: Extract luma strip at gate line
    guard let strip = extractLumaStrip(from: pixelBuffer, gateLineX: gateLineX, slitWidth: slitWidth) else {
      return SlitScanCrossingResult(crossingDetected: false, interpolatedTimestamp: nil, presenceRatio: 0, confidence: 0)
    }

    // Step 2: Create torso row mask from pose
    let torsoMask = createTorsoRowMask(from: observation, frameHeight: height, gateLineX: gateLineX)
    let torsoPixelCount = torsoMask.filter { $0 }.count

    // Step 3: Compute foreground mask (before updating background)
    let foregroundMask = computeForegroundMask(strip: strip)
    let totalForegroundCount = foregroundMask.filter { $0 }.count

    // Step 4: Compute presence ratio = torso AND foreground / torso total
    let torsoForegroundCount = zip(torsoMask, foregroundMask).filter { $0 && $1 }.count
    let presenceRatio = torsoPixelCount > 0 ? Float(torsoForegroundCount) / Float(torsoPixelCount) : 0

    // Step 5: Determine if we have significant foreground (for background update)
    let significantForegroundThreshold = 0.10  // 10% of frame height
    let hasSignificantForeground = Float(totalForegroundCount) / Float(height) > Float(significantForegroundThreshold)

    // Step 6: Update background model (only when no athlete)
    updateBackgroundModel(strip: strip, hasSignificantForeground: hasSignificantForeground)

    // Step 7: Create and store sample
    let sample = SlitSample(
      timestamp: timestamp,
      strip: strip,
      torsoRowMask: torsoMask,
      foregroundMask: foregroundMask,
      presenceRatio: presenceRatio
    )

    slitScanState.samples.append(sample)

    // Trim buffer to max size
    if slitScanState.samples.count > maxSamples {
      slitScanState.samples.removeFirst()
    }

    // Step 8: Detect crossing with hysteresis
    let crossingResult = detectCrossingWithHysteresis(
      currentRatio: presenceRatio,
      currentTimestamp: timestamp,
      debugMode: debugMode
    )

    if debugMode && frameCount % 30 == 1 {
      print("[SlitScan] ratio=\(String(format: "%.3f", presenceRatio)), torsoRows=\(torsoPixelCount), fg=\(torsoForegroundCount), wasAbove=\(slitScanState.wasAboveThreshold)")
    }

    return crossingResult
  }

  /**
   * Detect crossing using hysteresis and linear interpolation.
   * Triggers when presence ratio rises above T_on, resets when it falls below T_off.
   */
  private func detectCrossingWithHysteresis(
    currentRatio: Float,
    currentTimestamp: TimeInterval,
    debugMode: Bool
  ) -> SlitScanCrossingResult {
    // Check debounce
    let canTrigger = framesSinceLastCrossing >= minFramesBetweenCrossings

    // Hysteresis state machine
    if !slitScanState.wasAboveThreshold {
      // We're below threshold - check if we should trigger
      if currentRatio >= presenceThresholdOn && canTrigger {
        // Rising edge detected - interpolate crossing time
        let interpolatedTime = interpolateCrossingTime(
          threshold: presenceThresholdOn,
          currentTimestamp: currentTimestamp,
          currentRatio: currentRatio
        )

        slitScanState.wasAboveThreshold = true
        slitScanState.crossingDetected = true
        slitScanState.crossingTimestamp = interpolatedTime
        framesSinceLastCrossing = 0

        if debugMode {
          print("[SlitScan] CROSSING DETECTED! ratio=\(String(format: "%.3f", currentRatio)), interpolated_t=\(String(format: "%.1f", interpolatedTime ?? 0))")
        }

        // Calculate confidence based on how clean the rise was
        let confidence = min(1.0, currentRatio / presenceThresholdOn)

        return SlitScanCrossingResult(
          crossingDetected: true,
          interpolatedTimestamp: interpolatedTime,
          presenceRatio: currentRatio,
          confidence: confidence
        )
      }
    } else {
      // We're above threshold - check if we should reset
      if currentRatio < presenceThresholdOff {
        slitScanState.wasAboveThreshold = false
        // Don't reset crossingDetected - that's for the session
      }
    }

    return SlitScanCrossingResult(
      crossingDetected: false,
      interpolatedTimestamp: nil,
      presenceRatio: currentRatio,
      confidence: 0
    )
  }

  /**
   * Interpolate the exact crossing time between two frames.
   * Uses linear interpolation: t* = t0 + ((T - r0) / (r1 - r0)) * (t1 - t0)
   */
  private func interpolateCrossingTime(
    threshold: Float,
    currentTimestamp: TimeInterval,
    currentRatio: Float
  ) -> TimeInterval? {
    // Need at least 2 samples for interpolation
    guard slitScanState.samples.count >= 2 else {
      return currentTimestamp
    }

    // Get previous sample
    let prevIndex = slitScanState.samples.count - 2
    let prevSample = slitScanState.samples[prevIndex]

    let t0 = prevSample.timestamp
    let r0 = prevSample.presenceRatio
    let t1 = currentTimestamp
    let r1 = currentRatio

    // Avoid division by zero
    guard r1 != r0 else { return currentTimestamp }

    // Linear interpolation
    let alpha = (threshold - r0) / (r1 - r0)

    // Clamp alpha to [0, 1] for safety
    let clampedAlpha = max(0, min(1, alpha))

    let interpolatedTime = t0 + TimeInterval(clampedAlpha) * (t1 - t0)

    return interpolatedTime
  }

  /**
   * Reset slit-scan state for a new timing session.
   */
  private func resetSlitScanState() {
    slitScanState = SlitScanState(
      backgroundStrip: slitScanState.backgroundStrip,  // Keep background model
      backgroundInitialized: slitScanState.backgroundInitialized,
      samples: [],
      wasAboveThreshold: false,
      crossingDetected: false,
      crossingTimestamp: nil,
      preCrossingIndex: nil,
      postCrossingIndex: nil
    )
    framesSinceLastCrossing = 0
  }
}
