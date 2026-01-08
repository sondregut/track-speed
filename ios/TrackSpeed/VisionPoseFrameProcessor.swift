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

    // Reset frame buffer if requested
    if resetFrameBuffer {
      frameBuffer.removeAll()
      crossingCaptureFrames.removeAll()
      isCapturingCrossing = false
      postCrossingFrameCount = 0
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
   * Extract torso using hybrid approach:
   * 1. Use pose detection to identify torso Y region (shoulder to hip)
   * 2. Use person segmentation mask to find the actual body outline
   * 3. Apply "longest break" algorithm to find the widest body segment (chest)
   *
   * This achieves professional timing gate accuracy by detecting the actual
   * front of the chest, not just skeletal joint positions.
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

    // First, get pose-based torso data as fallback and for Y coordinates
    guard let poseTorsoData = extractTorso(from: observation, isFrontCamera: isFrontCamera, gateLineX: gateLineX) else {
      return nil
    }

    // If no segmentation mask available, use pose-based detection
    guard let mask = segmentationMask else {
      return poseTorsoData
    }

    // Get torso Y bounds from pose detection
    let torsoYBounds = getTorsoYBounds(from: observation)
    guard let yBounds = torsoYBounds else {
      return poseTorsoData
    }

    // Find the leading edge of the longest body segment at the gate line
    if let segmentationResult = findLongestBreakAtGateLine(
      mask: mask,
      gateLineX: gateLineX,
      torsoYMin: yBounds.minY,
      torsoYMax: yBounds.maxY,
      frameWidth: frameWidth,
      frameHeight: frameHeight,
      isFrontCamera: isFrontCamera,
      debugMode: debugMode
    ) {
      // Use segmentation-based X position with pose-based confidence
      var finalX = segmentationResult.leadingEdgeX
      if isFrontCamera {
        finalX = 1.0 - finalX
      }

      // Blend Y position: use segmentation center Y if available, else pose Y
      let blendedY = segmentationResult.segmentCenterY

      if debugMode && frameCount % 60 == 1 {
        print("[VisionPose] Segmentation: leadingX=\(String(format: "%.3f", finalX)), poseX=\(String(format: "%.3f", poseTorsoData.centerX)), segmentLength=\(segmentationResult.segmentLength)")
      }

      // Boost confidence when segmentation confirms pose detection
      let confidenceBoost: Float = 1.1  // 10% boost for segmentation-backed detection
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

  /**
   * "Longest Break" Algorithm - finds the widest continuous body segment crossing the gate line
   *
   * This mimics professional timing gate behavior:
   * 1. Sample the segmentation mask along the gate line
   * 2. In the torso Y region, find all continuous body segments
   * 3. The longest segment is the torso (not arms/legs)
   * 4. Return the leading edge (front) of that segment as the timing point
   *
   * The segmentation mask is in grayscale where values > threshold = person
   */
  private func findLongestBreakAtGateLine(
    mask: CVPixelBuffer,
    gateLineX: CGFloat,
    torsoYMin: CGFloat,
    torsoYMax: CGFloat,
    frameWidth: Int,
    frameHeight: Int,
    isFrontCamera: Bool,
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

    // Convert normalized coordinates to mask pixel coordinates
    let maskGateX = Int(gateLineX * CGFloat(maskWidth))

    // Vision coordinates have Y=0 at bottom, but mask has Y=0 at top
    // We need to flip the Y coordinates
    let maskTorsoYMin = Int((1.0 - torsoYMax) * CGFloat(maskHeight))
    let maskTorsoYMax = Int((1.0 - torsoYMin) * CGFloat(maskHeight))

    // Clamp to valid range
    let startY = max(0, maskTorsoYMin)
    let endY = min(maskHeight - 1, maskTorsoYMax)
    let sampleX = max(0, min(maskWidth - 1, maskGateX))

    // Threshold for body detection (0-255, typically ~127 works well)
    let bodyThreshold: UInt8 = 100

    // Find all continuous segments along the gate line in torso region
    var segments: [(startY: Int, endY: Int)] = []
    var currentSegmentStart: Int? = nil

    for y in startY...endY {
      // The mask is 8-bit grayscale (one byte per pixel)
      let pixelOffset = y * bytesPerRow + sampleX
      let pixelValue = baseAddress.load(fromByteOffset: pixelOffset, as: UInt8.self)

      let isBody = pixelValue > bodyThreshold

      if isBody && currentSegmentStart == nil {
        // Start of a new segment
        currentSegmentStart = y
      } else if !isBody && currentSegmentStart != nil {
        // End of current segment
        segments.append((startY: currentSegmentStart!, endY: y - 1))
        currentSegmentStart = nil
      }
    }

    // Don't forget the last segment if it extends to endY
    if let start = currentSegmentStart {
      segments.append((startY: start, endY: endY))
    }

    guard !segments.isEmpty else {
      if debugMode && frameCount % 60 == 1 {
        print("[VisionPose] Segmentation: No body segments found at gate line")
      }
      return nil
    }

    // Find the longest segment (the torso)
    let longestSegment = segments.max { ($0.endY - $0.startY) < ($1.endY - $1.startY) }!
    let segmentLength = longestSegment.endY - longestSegment.startY + 1

    // Minimum segment length threshold (at least 10% of torso region)
    let minSegmentLength = max(5, (endY - startY) / 10)
    guard segmentLength >= minSegmentLength else {
      if debugMode && frameCount % 60 == 1 {
        print("[VisionPose] Segmentation: Longest segment too small (\(segmentLength) pixels)")
      }
      return nil
    }

    // Now find the leading edge of the body at the center of this segment
    // This is the actual front of the chest
    let segmentCenterY = (longestSegment.startY + longestSegment.endY) / 2

    // Search horizontally at the segment center to find the leading edge
    // We search in both directions from the gate line to find where the body starts
    var leadingEdgeX: Int = sampleX

    // Determine search direction based on which side of the gate the body center is
    // For a runner crossing left-to-right, we want the rightmost body edge
    // For right-to-left, we want the leftmost edge
    // We use the pose detection to help determine direction

    // Search for the edge of the body in both directions
    // The "leading edge" is the frontmost part of the body at this Y level

    // First, find body bounds at this Y level
    var leftEdge = sampleX
    var rightEdge = sampleX

    // Search left
    for x in stride(from: sampleX, through: 0, by: -1) {
      let pixelOffset = segmentCenterY * bytesPerRow + x
      let pixelValue = baseAddress.load(fromByteOffset: pixelOffset, as: UInt8.self)
      if pixelValue > bodyThreshold {
        leftEdge = x
      } else if x < sampleX - 10 {
        // Stop if we've gone past the body
        break
      }
    }

    // Search right
    for x in sampleX..<maskWidth {
      let pixelOffset = segmentCenterY * bytesPerRow + x
      let pixelValue = baseAddress.load(fromByteOffset: pixelOffset, as: UInt8.self)
      if pixelValue > bodyThreshold {
        rightEdge = x
      } else if x > sampleX + 10 {
        // Stop if we've gone past the body
        break
      }
    }

    // The leading edge is whichever edge is closer to the gate line
    // (because that's the part of the body crossing first)
    let leftDistance = abs(sampleX - leftEdge)
    let rightDistance = abs(sampleX - rightEdge)

    // Choose the edge that's closer to the gate (the front of the body)
    if leftDistance < rightDistance {
      leadingEdgeX = leftEdge
    } else {
      leadingEdgeX = rightEdge
    }

    // Convert back to normalized coordinates
    let normalizedX = CGFloat(leadingEdgeX) / CGFloat(maskWidth)
    let normalizedCenterY = 1.0 - (CGFloat(segmentCenterY) / CGFloat(maskHeight))  // Flip Y back

    if debugMode && frameCount % 60 == 1 {
      print("[VisionPose] Segmentation: segment Y=\(longestSegment.startY)-\(longestSegment.endY), length=\(segmentLength), leadingX=\(leadingEdgeX)/\(maskWidth)")
    }

    return SegmentationResult(
      leadingEdgeX: normalizedX,
      segmentCenterY: normalizedCenterY,
      segmentLength: segmentLength
    )
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
}
