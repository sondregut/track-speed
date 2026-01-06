import VisionCamera
import Accelerate
import CoreImage
import UIKit

/**
 * GhostGateProcessor - Native background subtraction using Accelerate
 *
 * Uses vDSP for fast SIMD operations on pixel data.
 * Only processes the ROI (vertical scanline) for maximum performance.
 *
 * Performance: ~0.1-0.3ms per frame for ROI motion detection
 * vs ~2-5ms for full-frame JS implementation
 */

@objc(GhostGateProcessorPlugin)
public class GhostGateProcessorPlugin: FrameProcessorPlugin {

  // Background model (grayscale, float32)
  private var backgroundModel: [Float]?
  private var backgroundWidth: Int = 0
  private var backgroundHeight: Int = 0

  // ROI configuration (normalized 0-1)
  private var roiPosition: Float = 0.5
  private var roiWidth: Float = 0.1
  private var roiTop: Float = 0.1
  private var roiBottom: Float = 0.9

  // Calibration state
  private var isCalibrated: Bool = false
  private var calibrationFrames: [[Float]] = []
  private var calibrationTarget: Int = 30

  // Detection threshold
  private var motionThreshold: Float = 15.0

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)

    // Parse initial options
    if let position = options["roiPosition"] as? NSNumber {
      self.roiPosition = position.floatValue
    }
    if let width = options["roiWidth"] as? NSNumber {
      self.roiWidth = width.floatValue
    }
    if let top = options["roiTop"] as? NSNumber {
      self.roiTop = top.floatValue
    }
    if let bottom = options["roiBottom"] as? NSNumber {
      self.roiBottom = bottom.floatValue
    }
    if let threshold = options["motionThreshold"] as? NSNumber {
      self.motionThreshold = threshold.floatValue
    }
  }

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    let startTime = CACurrentMediaTime()

    // Handle commands
    if let command = arguments?["command"] as? String {
      return handleCommand(command, frame: frame, arguments: arguments)
    }

    // Default: detect motion in ROI
    return detectMotionInROI(frame: frame, startTime: startTime)
  }

  // MARK: - Command Handling

  private func handleCommand(_ command: String, frame: Frame, arguments: [AnyHashable: Any]?) -> [String: Any] {
    switch command {
    case "calibrate":
      return addCalibrationFrame(frame: frame)

    case "finishCalibration":
      return finishCalibration()

    case "quickCalibrate":
      return quickCalibrate(frame: frame)

    case "reset":
      return resetCalibration()

    case "setROI":
      return setROI(arguments: arguments)

    case "getState":
      return getState()

    default:
      return ["error": "Unknown command: \(command)"]
    }
  }

  // MARK: - Calibration

  private func addCalibrationFrame(frame: Frame) -> [String: Any] {
    guard let grayscale = extractGrayscaleROI(from: frame) else {
      return ["success": false, "error": "Failed to extract frame"]
    }

    calibrationFrames.append(grayscale.pixels)
    backgroundWidth = grayscale.width
    backgroundHeight = grayscale.height

    let progress = Float(calibrationFrames.count) / Float(calibrationTarget)

    return [
      "success": true,
      "frameCount": calibrationFrames.count,
      "progress": progress,
      "isComplete": calibrationFrames.count >= calibrationTarget
    ]
  }

  private func finishCalibration() -> [String: Any] {
    guard calibrationFrames.count >= 5 else {
      return ["success": false, "error": "Need at least 5 frames"]
    }

    let pixelCount = calibrationFrames[0].count
    var averaged = [Float](repeating: 0, count: pixelCount)

    // Average all calibration frames using vDSP
    for framePixels in calibrationFrames {
      vDSP_vadd(averaged, 1, framePixels, 1, &averaged, 1, vDSP_Length(pixelCount))
    }

    var divisor = Float(calibrationFrames.count)
    vDSP_vsdiv(averaged, 1, &divisor, &averaged, 1, vDSP_Length(pixelCount))

    backgroundModel = averaged
    isCalibrated = true
    calibrationFrames.removeAll()

    return [
      "success": true,
      "isCalibrated": true,
      "backgroundQuality": calculateBackgroundQuality()
    ]
  }

  private func quickCalibrate(frame: Frame) -> [String: Any] {
    guard let grayscale = extractGrayscaleROI(from: frame) else {
      return ["success": false, "error": "Failed to extract frame"]
    }

    backgroundModel = grayscale.pixels
    backgroundWidth = grayscale.width
    backgroundHeight = grayscale.height
    isCalibrated = true
    calibrationFrames.removeAll()

    return [
      "success": true,
      "isCalibrated": true,
      "backgroundQuality": 0.5 // Lower quality for single-frame
    ]
  }

  private func resetCalibration() -> [String: Any] {
    backgroundModel = nil
    isCalibrated = false
    calibrationFrames.removeAll()
    return ["success": true, "isCalibrated": false]
  }

  private func calculateBackgroundQuality() -> Float {
    // Simple quality metric based on variance
    guard let bg = backgroundModel, bg.count > 0 else { return 0 }

    var mean: Float = 0
    var stdDev: Float = 0
    vDSP_normalize(bg, 1, nil, 1, &mean, &stdDev, vDSP_Length(bg.count))

    // Lower stdDev = more uniform background = higher quality
    let quality = max(0, min(1, 1.0 - (stdDev / 128.0)))
    return quality
  }

  // MARK: - ROI Configuration

  private func setROI(arguments: [AnyHashable: Any]?) -> [String: Any] {
    if let position = arguments?["position"] as? NSNumber {
      roiPosition = position.floatValue
    }
    if let width = arguments?["width"] as? NSNumber {
      roiWidth = width.floatValue
    }
    if let top = arguments?["top"] as? NSNumber {
      roiTop = top.floatValue
    }
    if let bottom = arguments?["bottom"] as? NSNumber {
      roiBottom = bottom.floatValue
    }
    if let threshold = arguments?["motionThreshold"] as? NSNumber {
      motionThreshold = threshold.floatValue
    }

    // Reset calibration when ROI changes
    resetCalibration()

    return [
      "success": true,
      "roi": [
        "position": roiPosition,
        "width": roiWidth,
        "top": roiTop,
        "bottom": roiBottom
      ]
    ]
  }

  private func getState() -> [String: Any] {
    return [
      "isCalibrated": isCalibrated,
      "roi": [
        "position": roiPosition,
        "width": roiWidth,
        "top": roiTop,
        "bottom": roiBottom
      ],
      "motionThreshold": motionThreshold,
      "backgroundWidth": backgroundWidth,
      "backgroundHeight": backgroundHeight
    ]
  }

  // MARK: - Motion Detection

  private func detectMotionInROI(frame: Frame, startTime: CFTimeInterval) -> [String: Any] {
    guard isCalibrated, let background = backgroundModel else {
      // Not calibrated - return motion detected (safe default)
      return [
        "hasMotion": true,
        "intensity": 1.0,
        "isCalibrated": false,
        "processingTimeMs": (CACurrentMediaTime() - startTime) * 1000
      ]
    }

    guard let current = extractGrayscaleROI(from: frame) else {
      return ["hasMotion": false, "error": "Failed to extract ROI"]
    }

    // Ensure dimensions match
    guard current.pixels.count == background.count else {
      return [
        "hasMotion": true,
        "intensity": 1.0,
        "error": "Dimension mismatch, recalibration needed"
      ]
    }

    // Calculate absolute difference using vDSP
    var diff = [Float](repeating: 0, count: current.pixels.count)
    vDSP_vsub(background, 1, current.pixels, 1, &diff, 1, vDSP_Length(diff.count))
    vDSP_vabs(diff, 1, &diff, 1, vDSP_Length(diff.count))

    // Count pixels above threshold
    var motionCount: Float = 0
    var threshold = motionThreshold
    for i in 0..<diff.count {
      if diff[i] > threshold {
        motionCount += 1
      }
    }

    // Calculate intensity (0-1)
    let totalPixels = Float(diff.count)
    let motionRatio = motionCount / totalPixels

    // Calculate mean difference for intensity
    var meanDiff: Float = 0
    vDSP_meanv(diff, 1, &meanDiff, vDSP_Length(diff.count))
    let intensity = min(1.0, meanDiff / 50.0) // Normalize to 0-1

    // Motion detected if significant portion exceeds threshold
    let hasMotion = motionRatio > 0.02 || intensity > 0.03

    let processingTime = (CACurrentMediaTime() - startTime) * 1000

    var result: [String: Any] = [
      "hasMotion": hasMotion,
      "intensity": intensity,
      "motionRatio": motionRatio,
      "processingTimeMs": processingTime,
      "timestamp": Date().timeIntervalSince1970 * 1000
    ]

    // Add motion bounds if detected (find bounding box of motion)
    if hasMotion {
      if let bounds = findMotionBounds(diff: diff, width: current.width, height: current.height, threshold: motionThreshold) {
        result["motionBounds"] = bounds
      }
    }

    return result
  }

  // MARK: - Pixel Processing

  private struct GrayscaleROI {
    let pixels: [Float]
    let width: Int
    let height: Int
  }

  private func extractGrayscaleROI(from frame: Frame) -> GrayscaleROI? {
    let buffer = frame.buffer
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else {
      return nil
    }

    let frameWidth = CVPixelBufferGetWidth(pixelBuffer)
    let frameHeight = CVPixelBufferGetHeight(pixelBuffer)

    // Calculate ROI bounds in pixels
    let roiLeft = Int(Float(frameWidth) * (roiPosition - roiWidth / 2))
    let roiRight = Int(Float(frameWidth) * (roiPosition + roiWidth / 2))
    let roiTopPx = Int(Float(frameHeight) * roiTop)
    let roiBottomPx = Int(Float(frameHeight) * roiBottom)

    let left = max(0, roiLeft)
    let right = min(frameWidth, roiRight)
    let top = max(0, roiTopPx)
    let bottom = min(frameHeight, roiBottomPx)

    let roiWidthPx = right - left
    let roiHeightPx = bottom - top

    guard roiWidthPx > 0 && roiHeightPx > 0 else {
      return nil
    }

    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      return nil
    }

    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let pixelFormat = CVPixelBufferGetPixelFormatType(pixelBuffer)

    var grayscale = [Float](repeating: 0, count: roiWidthPx * roiHeightPx)
    var index = 0

    // Handle different pixel formats
    switch pixelFormat {
    case kCVPixelFormatType_32BGRA:
      for y in top..<bottom {
        let rowPtr = baseAddress.advanced(by: y * bytesPerRow).assumingMemoryBound(to: UInt8.self)
        for x in left..<right {
          let pixelOffset = x * 4
          let b = Float(rowPtr[pixelOffset])
          let g = Float(rowPtr[pixelOffset + 1])
          let r = Float(rowPtr[pixelOffset + 2])
          // Fast luminance approximation
          grayscale[index] = r * 0.299 + g * 0.587 + b * 0.114
          index += 1
        }
      }

    case kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
         kCVPixelFormatType_420YpCbCr8BiPlanarFullRange:
      // For YUV, just use Y plane (luminance)
      let yPlane = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0)!
      let yBytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)

      for y in top..<bottom {
        let rowPtr = yPlane.advanced(by: y * yBytesPerRow).assumingMemoryBound(to: UInt8.self)
        for x in left..<right {
          grayscale[index] = Float(rowPtr[x])
          index += 1
        }
      }

    default:
      return nil
    }

    return GrayscaleROI(pixels: grayscale, width: roiWidthPx, height: roiHeightPx)
  }

  private func findMotionBounds(diff: [Float], width: Int, height: Int, threshold: Float) -> [String: Float]? {
    var minX = width
    var maxX = 0
    var minY = height
    var maxY = 0
    var foundMotion = false

    for y in 0..<height {
      for x in 0..<width {
        let idx = y * width + x
        if diff[idx] > threshold {
          foundMotion = true
          minX = min(minX, x)
          maxX = max(maxX, x)
          minY = min(minY, y)
          maxY = max(maxY, y)
        }
      }
    }

    guard foundMotion else { return nil }

    // Convert to normalized coordinates within ROI
    return [
      "x": Float(minX) / Float(width),
      "y": Float(minY) / Float(height),
      "width": Float(maxX - minX) / Float(width),
      "height": Float(maxY - minY) / Float(height)
    ]
  }
}
