import VisionCamera
import Vision
import CoreImage
import UIKit

/**
 * VisionPoseFrameProcessor - iOS Vision Framework pose detection for sprint timing
 *
 * Uses VNDetectHumanBodyPoseRequest for accurate torso detection.
 * Per World Athletics Rule 164, only torso (shoulders + hips) triggers timing.
 */

@objc(VisionPoseFrameProcessorPlugin)
public class VisionPoseFrameProcessorPlugin: FrameProcessorPlugin {

  // Pose detection request
  private lazy var poseRequest: VNDetectHumanBodyPoseRequest = {
    return VNDetectHumanBodyPoseRequest()
  }()

  // Minimum confidence threshold
  private let minConfidence: Float = 0.5

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
  }

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    let startTime = CACurrentMediaTime()

    // Get pixel buffer from frame
    let buffer = frame.buffer
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else {
      return "{\"detected\":false}"
    }

    // Run pose detection
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])

    do {
      try handler.perform([poseRequest])
    } catch {
      return "{\"detected\":false}"
    }

    // Get results
    guard let observations = poseRequest.results, !observations.isEmpty else {
      return createJsonResult(detected: false, startTime: startTime)
    }

    // Use first person detected
    let observation = observations[0]

    // Extract torso landmarks
    guard let torsoData = extractTorso(from: observation) else {
      return createJsonResult(detected: false, startTime: startTime)
    }

    let processingTime = (CACurrentMediaTime() - startTime) * 1000
    let timestamp = Date().timeIntervalSince1970 * 1000

    // Return JSON string to bypass worklet serialization issues
    return String(format: "{\"detected\":true,\"confidence\":%.2f,\"torsoX\":%.6f,\"torsoY\":%.6f,\"timestamp\":%.0f,\"processingTimeMs\":%.2f}",
                  torsoData.confidence * 100,
                  torsoData.centerX,
                  torsoData.centerY,
                  timestamp,
                  processingTime)
  }

  // MARK: - Torso Extraction

  private struct TorsoData {
    let centerX: CGFloat
    let centerY: CGFloat
    let confidence: Float
  }

  private func extractTorso(from observation: VNHumanBodyPoseObservation) -> TorsoData? {
    do {
      let leftShoulder = try observation.recognizedPoint(.leftShoulder)
      let rightShoulder = try observation.recognizedPoint(.rightShoulder)
      let leftHip = try observation.recognizedPoint(.leftHip)
      let rightHip = try observation.recognizedPoint(.rightHip)

      // Check confidence
      let points = [leftShoulder, rightShoulder, leftHip, rightHip]
      guard points.allSatisfy({ $0.confidence >= minConfidence }) else {
        return nil
      }

      let avgConfidence = points.reduce(0) { $0 + $1.confidence } / Float(points.count)

      // Calculate torso center with lean-adaptive weighting
      let shoulderMidX = (leftShoulder.location.x + rightShoulder.location.x) / 2
      let shoulderMidY = (leftShoulder.location.y + rightShoulder.location.y) / 2
      let hipMidX = (leftHip.location.x + rightHip.location.x) / 2
      let hipMidY = (leftHip.location.y + rightHip.location.y) / 2

      let leanAngle = atan2(shoulderMidX - hipMidX, shoulderMidY - hipMidY)
      let leanFactor = sin(leanAngle) * 0.2
      let shoulderWeight = 0.5 - leanFactor
      let hipWeight = 0.5 + leanFactor

      let centerX = shoulderMidX * CGFloat(shoulderWeight) + hipMidX * CGFloat(hipWeight)
      let centerY = shoulderMidY * CGFloat(shoulderWeight) + hipMidY * CGFloat(hipWeight)

      return TorsoData(centerX: centerX, centerY: 1.0 - centerY, confidence: avgConfidence)

    } catch {
      return nil
    }
  }

  private func createJsonResult(detected: Bool, startTime: CFTimeInterval) -> String {
    let processingTime = (CACurrentMediaTime() - startTime) * 1000
    let timestamp = Date().timeIntervalSince1970 * 1000
    return String(format: "{\"detected\":%@,\"confidence\":0,\"torsoX\":0,\"torsoY\":0,\"timestamp\":%.0f,\"processingTimeMs\":%.2f}",
                  detected ? "true" : "false",
                  timestamp,
                  processingTime)
  }
}
