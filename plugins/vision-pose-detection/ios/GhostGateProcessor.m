#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

@interface GhostGateProcessorPlugin : FrameProcessorPlugin
@end

@implementation GhostGateProcessorPlugin

+ (void)load {
  [FrameProcessorPluginRegistry addFrameProcessorPlugin:@"detectGhostGateMotion"
                                        withInitializer:^FrameProcessorPlugin* (VisionCameraProxyHolder* proxy, NSDictionary* options) {
    return [[GhostGateProcessorPlugin alloc] initWithProxy:proxy withOptions:options];
  }];
}

@end
