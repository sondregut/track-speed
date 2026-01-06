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
      return ["detected": false, "error": "No pixel buffer"]
    }

    // Run pose detection
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])

    do {
      try handler.perform([poseRequest])
    } catch {
      return ["detected": false, "error": error.localizedDescription]
    }

    // Get results
    guard let observations = poseRequest.results, !observations.isEmpty else {
      return createResult(detected: false, startTime: startTime)
    }

    // Use first person detected
    let observation = observations[0]

    // Extract torso landmarks
    guard let torsoData = extractTorso(from: observation) else {
      return createResult(detected: false, startTime: startTime)
    }

    let processingTime = (CACurrentMediaTime() - startTime) * 1000

    return [
      "detected": true,
      "landmarks": torsoData.landmarks,
      "torsoCenter": torsoData.center,
      "confidence": torsoData.confidence,
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "processingTimeMs": processingTime,
      "frameWidth": CVPixelBufferGetWidth(pixelBuffer),
      "frameHeight": CVPixelBufferGetHeight(pixelBuffer)
    ] as [String: Any]
  }

  // MARK: - Torso Extraction

  private struct TorsoData {
    let landmarks: [String: Any]
    let center: [String: Any]
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

      let landmarks: [String: Any] = [
        "leftShoulder": pointToDict(leftShoulder),
        "rightShoulder": pointToDict(rightShoulder),
        "leftHip": pointToDict(leftHip),
        "rightHip": pointToDict(rightHip)
      ]

      let center = calculateCenter(
        leftShoulder: leftShoulder,
        rightShoulder: rightShoulder,
        leftHip: leftHip,
        rightHip: rightHip
      )

      return TorsoData(landmarks: landmarks, center: center, confidence: avgConfidence)

    } catch {
      return nil
    }
  }

  private func pointToDict(_ point: VNRecognizedPoint) -> [String: Any] {
    return [
      "x": point.location.x,
      "y": 1.0 - point.location.y,  // Flip Y for top-left origin
      "confidence": point.confidence
    ]
  }

  private func calculateCenter(
    leftShoulder: VNRecognizedPoint,
    rightShoulder: VNRecognizedPoint,
    leftHip: VNRecognizedPoint,
    rightHip: VNRecognizedPoint
  ) -> [String: Any] {

    let shoulderMidX = (leftShoulder.location.x + rightShoulder.location.x) / 2
    let shoulderMidY = (leftShoulder.location.y + rightShoulder.location.y) / 2
    let hipMidX = (leftHip.location.x + rightHip.location.x) / 2
    let hipMidY = (leftHip.location.y + rightHip.location.y) / 2

    // Lean-adaptive weighting for sprint detection
    let leanAngle = atan2(shoulderMidX - hipMidX, shoulderMidY - hipMidY)
    let leanFactor = sin(leanAngle) * 0.2
    let shoulderWeight = 0.5 - leanFactor
    let hipWeight = 0.5 + leanFactor

    let centerX = shoulderMidX * CGFloat(shoulderWeight) + hipMidX * CGFloat(hipWeight)
    let centerY = shoulderMidY * CGFloat(shoulderWeight) + hipMidY * CGFloat(hipWeight)

    return [
      "x": centerX,
      "y": 1.0 - centerY,
      "leanAngle": leanAngle,
      "leanFactor": leanFactor
    ]
  }

  private func createResult(detected: Bool, startTime: CFTimeInterval) -> [String: Any] {
    let processingTime = (CACurrentMediaTime() - startTime) * 1000
    return [
      "detected": detected,
      "landmarks": NSNull(),
      "torsoCenter": NSNull(),
      "confidence": 0,
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "processingTimeMs": processingTime
    ]
  }
}
