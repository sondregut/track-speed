# Photo Finish Detection Implementation Plan

## Goal
Achieve the most accurate torso detection for sprint timing by implementing professional-grade algorithms that find the actual front of the chest, not skeletal joint estimates.

---

## Current Problem

Our current implementation uses pose detection (skeleton joints) to find the torso position. This has a fundamental limitation: **skeletal joints are on the SIDE of the body, not the front**.

When a runner passes in profile view:
- Shoulder and hip joints are detected at the side of the body
- The actual chest (front of torso) is ahead of these joints
- Our current 12% offset is an imprecise approximation

---

## Research Findings

### How Professional Systems Work

#### 1. FinishLynx (Olympic Standard)
- Uses **line-scan cameras** capturing 1,000-20,000 frames per second
- Captures thin vertical slices of the finish line
- Creates a composite image where time flows horizontally
- Officials manually place cursor on torso's leading edge
- Achieves 0.001s (1ms) accuracy

#### 2. TENDO / SmartSpeed ("Longest Break" Algorithm)
- Analyzes all beam interruptions as athlete passes
- **Key insight**: The torso creates the LONGEST continuous break
- Arms and legs create shorter, isolated breaks
- Takes the **beginning of the longest break** as timing point
- No estimation needed - directly measures widest body part

### iOS Vision Framework Capabilities

#### VNGeneratePersonSegmentationRequest (iOS 15+)
- Creates a binary silhouette mask of the person
- Returns pixel buffer with body outline
- Three quality levels:
  - `.fast` - Best for real-time video
  - `.balanced` - Good tradeoff
  - `.accurate` - Highest quality, slower

#### VNDetectHumanBodyPoseRequest (Already using)
- Returns 17 skeletal joint positions
- Used to identify torso region (shoulders to hips)

---

## Implementation Strategy

### Hybrid Approach: Pose Detection + Silhouette Analysis

Combine our existing pose detection with person segmentation to find the actual front of the body.

```
┌─────────────────────────────────────────────────────────┐
│                    DETECTION PIPELINE                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Pose Detection (existing)                           │
│     └── Get shoulder/hip Y coordinates                  │
│     └── Defines "torso region" vertically               │
│                                                          │
│  2. Person Segmentation (new)                           │
│     └── Get body silhouette mask                        │
│     └── Binary image of person outline                  │
│                                                          │
│  3. Gate Line Analysis (new)                            │
│     └── Sample pixels along gate line X position        │
│     └── Find where mask intersects gate line            │
│     └── Identify segments (arm, leg, torso)             │
│                                                          │
│  4. "Longest Break" Logic (new)                         │
│     └── In torso Y region, find longest continuous      │
│         segment of body pixels crossing gate line       │
│     └── Leading edge of longest segment = chest front   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed Implementation Steps

### Phase 1: Add Person Segmentation Request

**File:** `ios/TrackSpeed/VisionPoseFrameProcessor.swift`

```swift
// Add alongside existing poseRequest
private lazy var segmentationRequest: VNGeneratePersonSegmentationRequest = {
    let request = VNGeneratePersonSegmentationRequest()
    request.qualityLevel = .fast  // For real-time performance
    return request
}()
```

Run both requests together:
```swift
try handler.perform([poseRequest, segmentationRequest])
```

### Phase 2: Extract Body Mask at Gate Line

After getting segmentation result:
```swift
guard let segmentationResult = segmentationRequest.results?.first else { return }
let maskBuffer = segmentationResult.pixelBuffer

// Sample the mask along the gate line X position
// Get all Y positions where body pixels exist
```

### Phase 3: Implement "Longest Break" Algorithm

```swift
func findTorsoFront(
    maskBuffer: CVPixelBuffer,
    gateLineX: Int,
    torsoYMin: Int,  // From shoulder Y
    torsoYMax: Int   // From hip Y
) -> Int? {

    // 1. Lock the pixel buffer
    CVPixelBufferLockBaseAddress(maskBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(maskBuffer, .readOnly) }

    // 2. Get pixel data at gateLineX for all Y in torso region
    // 3. Find continuous segments where mask > threshold
    // 4. Return the Y position where longest segment STARTS
    //    (that's the front of the torso)
}
```

### Phase 4: Refine Crossing Detection

Instead of using skeleton joint X position:
1. Get body silhouette at gate line
2. In torso region (shoulder Y to hip Y), find longest continuous body segment
3. The leading edge (first pixel) of that segment is the chest front
4. Use that X position for timing

---

## Algorithm: Longest Break Detection

```
Gate Line (vertical)
        │
        │    ← Arm (short segment)
        │
        │████ ← Start of torso (TIMING POINT)
        │████
        │████
        │████ ← End of torso
        │
        │    ← Gap
        │
        │██  ← Leg (medium segment)
        │██
        │
        ▼
```

The torso creates the longest continuous break. We detect:
1. All body segments crossing the gate line
2. Filter to only segments in torso Y range (shoulder to hip)
3. Find the longest one
4. Use its leading edge as the timing point

---

## Performance Considerations

### Real-time Requirements
- Current pose detection: ~5-10ms per frame
- Segmentation (.fast): ~10-15ms per frame
- Combined: ~15-25ms per frame
- Target: 60 FPS = 16.67ms budget

### Optimization Options
1. Run segmentation at lower resolution
2. Only run full analysis when torso is near gate
3. Use `.fast` quality level for live detection
4. Use `.accurate` for frame buffer review images

### Memory
- Segmentation mask is small (matches input resolution)
- Can be discarded after analysis each frame

---

## Testing Plan

1. **Unit Tests**
   - Longest break detection with synthetic masks
   - Edge cases: overlapping limbs, partial visibility

2. **Integration Tests**
   - Profile view: runner left-to-right
   - Profile view: runner right-to-left
   - Frontal approach (should still work)
   - Various running speeds

3. **Accuracy Validation**
   - Compare with manual frame review
   - Measure offset from actual chest position in captured frames

---

## Fallback Strategy

If segmentation fails or is too slow:
1. Fall back to current pose-based detection
2. Use velocity-based offset (track motion direction)
3. Allow manual adjustment in review screen

---

## Files to Modify

1. **`ios/TrackSpeed/VisionPoseFrameProcessor.swift`**
   - Add `VNGeneratePersonSegmentationRequest`
   - Add mask analysis functions
   - Implement longest break algorithm
   - Update `extractTorso()` to use silhouette

2. **`src/hooks/useVisionPose.ts`** (if needed)
   - Handle new output format

3. **`src/screens/TimerScreen.tsx`** (if needed)
   - Display confidence/method used

---

## Success Metrics

- **Accuracy**: Green indicator appears on actual chest front in review images
- **Performance**: Maintains 60 FPS on iPhone 12 and newer
- **Reliability**: Works in >95% of profile crossing scenarios

---

## References

- [TENDO ECP Technology](https://www.tendosport.com/what-is-error-correction-processing-technology-in-sports-timing-systems/)
- [FinishLynx FAT Systems](https://finishlynx.com/about-us/what-is-fully-automatic-timing/)
- [Apple VNGeneratePersonSegmentationRequest](https://developer.apple.com/documentation/vision/vngeneratepersonsegmentationrequest)
- [Kodeco Vision Tutorial](https://www.kodeco.com/29650263-person-segmentation-in-the-vision-framework)
- [World Athletics Photo Finish Guidelines](https://worldathletics.org/download/download?filename=4423f7ca-84bd-401d-b326-c074cebc4800.pdf)

---

## Timeline Estimate

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Add segmentation request | 1-2 hours |
| 2 | Extract mask at gate line | 2-3 hours |
| 3 | Implement longest break | 3-4 hours |
| 4 | Integration & testing | 2-3 hours |
| **Total** | | **8-12 hours** |
