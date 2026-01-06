/**
 * Expo Config Plugin for Vision Pose Detection
 *
 * Copies native iOS Vision framework pose detection files to the project
 * and properly adds them to the Xcode project.
 */

const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILES = ['VisionPoseFrameProcessor.swift', 'VisionPoseFrameProcessor.m'];

/**
 * Copy native files to ios directory during prebuild
 */
function withVisionPoseFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = config.modRequest.platformProjectRoot;

      // Find the .xcodeproj to get project name
      const xcodeProj = fs.readdirSync(iosDir).find(f => f.endsWith('.xcodeproj'));
      const projectName = xcodeProj ? xcodeProj.replace('.xcodeproj', '') : 'TrackSpeed';

      // Target directory: ios/ProjectName/ (same level as AppDelegate)
      const targetDir = path.join(iosDir, projectName);

      // Source directory
      const sourceDir = path.join(projectRoot, 'plugins', 'vision-pose-detection', 'ios');

      // Copy each file directly to the project folder
      for (const file of FILES) {
        const src = path.join(sourceDir, file);
        const dest = path.join(targetDir, file);

        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[VisionPose] Copied ${file} to ${targetDir}`);
        } else {
          console.error(`[VisionPose] ERROR: Source not found: ${src}`);
        }
      }

      return config;
    },
  ]);
}

/**
 * Add files to Xcode project
 */
function withVisionPoseXcode(config) {
  return withXcodeProject(config, async (config) => {
    const proj = config.modResults;
    const iosDir = config.modRequest.platformProjectRoot;

    // Get project name from xcodeproj
    const xcodeProj = fs.readdirSync(iosDir).find(f => f.endsWith('.xcodeproj'));
    const projectName = xcodeProj ? xcodeProj.replace('.xcodeproj', '') : 'TrackSpeed';

    // Get the native target
    const nativeTargets = proj.pbxNativeTargetSection();
    let targetUuid = null;

    for (const key in nativeTargets) {
      if (typeof nativeTargets[key] === 'object' && nativeTargets[key].productType === '"com.apple.product-type.application"') {
        targetUuid = key;
        break;
      }
    }

    if (!targetUuid) {
      console.error('[VisionPose] Could not find app target');
      return config;
    }

    // Get the main group (project folder group)
    const mainGroupId = proj.getFirstProject()?.firstProject?.mainGroup;
    if (!mainGroupId) {
      console.error('[VisionPose] Could not find main group');
      return config;
    }

    // Find the project name group (e.g., "TrackSpeed" folder)
    const mainGroup = proj.getPBXGroupByKey(mainGroupId);
    let projectGroupKey = null;

    if (mainGroup && mainGroup.children) {
      for (const child of mainGroup.children) {
        const childGroup = proj.getPBXGroupByKey(child.value);
        // Find the group that has source files (AppDelegate, etc.)
        if (childGroup && childGroup.children) {
          const hasAppDelegate = childGroup.children.some(c =>
            c.comment && (c.comment.includes('AppDelegate') || c.comment.includes('Info.plist'))
          );
          if (hasAppDelegate) {
            projectGroupKey = child.value;
            break;
          }
        }
      }
    }

    const targetGroupKey = projectGroupKey || mainGroupId;

    // Add each source file to the project with correct relative path
    for (const fileName of FILES) {
      try {
        // Use path relative to ios folder: "ProjectName/filename"
        const relativePath = `${projectName}/${fileName}`;
        proj.addSourceFile(relativePath, { target: targetUuid }, targetGroupKey);
        console.log(`[VisionPose] Added to Xcode: ${relativePath}`);
      } catch (e) {
        // File might already exist, that's okay
        console.log(`[VisionPose] Note for ${fileName}: ${e.message}`);
      }
    }

    return config;
  });
}

module.exports = function withVisionPose(config) {
  config = withVisionPoseFiles(config);
  config = withVisionPoseXcode(config);
  return config;
};
