import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { PoseLandmarks } from '../../types';

interface PoseOverlayProps {
  landmarks: PoseLandmarks | null;
  width: number;
  height: number;
  showSkeleton?: boolean;
  showTorsoOnly?: boolean;
}

// Torso landmark indices (per World Athletics Rule 164)
const TORSO_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
};

// Skeleton connections
const SKELETON_CONNECTIONS = [
  // Torso
  [11, 12], // shoulders
  [11, 23], // left side
  [12, 24], // right side
  [23, 24], // hips
  // Arms (optional)
  [11, 13], // left upper arm
  [13, 15], // left forearm
  [12, 14], // right upper arm
  [14, 16], // right forearm
  // Legs (optional)
  [23, 25], // left thigh
  [25, 27], // left shin
  [24, 26], // right thigh
  [26, 28], // right shin
];

export function PoseOverlay({
  landmarks,
  width,
  height,
  showSkeleton = true,
  showTorsoOnly = true,
}: PoseOverlayProps) {
  if (!landmarks) return null;

  const connections = showTorsoOnly
    ? SKELETON_CONNECTIONS.slice(0, 4) // Only torso connections
    : SKELETON_CONNECTIONS;

  const landmarkIndices = showTorsoOnly
    ? Object.values(TORSO_LANDMARKS)
    : Object.keys(landmarks).map(Number);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Draw skeleton connections */}
        {showSkeleton &&
          connections.map(([start, end], index) => {
            const startLandmark = landmarks[start];
            const endLandmark = landmarks[end];

            if (!startLandmark || !endLandmark) return null;
            if (startLandmark.confidence < 0.5 || endLandmark.confidence < 0.5) return null;

            return (
              <Line
                key={`line-${index}`}
                x1={startLandmark.x * width}
                y1={startLandmark.y * height}
                x2={endLandmark.x * width}
                y2={endLandmark.y * height}
                stroke={colors.timing.active}
                strokeWidth={2}
                strokeOpacity={0.8}
              />
            );
          })}

        {/* Draw landmark points */}
        {landmarkIndices.map((index) => {
          const landmark = landmarks[index];
          if (!landmark || landmark.confidence < 0.5) return null;

          const isTorso = Object.values(TORSO_LANDMARKS).includes(index);

          return (
            <Circle
              key={`point-${index}`}
              cx={landmark.x * width}
              cy={landmark.y * height}
              r={isTorso ? 8 : 5}
              fill={isTorso ? colors.timing.active : colors.primary[400]}
              opacity={landmark.confidence}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
