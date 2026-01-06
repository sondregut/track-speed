#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

@interface VisionPoseFrameProcessorPlugin : FrameProcessorPlugin
@end

VISION_EXPORT_FRAME_PROCESSOR(VisionPoseFrameProcessorPlugin, detectPose)
