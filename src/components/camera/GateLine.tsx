import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../../constants/theme';

interface GateLineProps {
  position?: number; // 0-1, position from top
  color?: string;
  thickness?: number;
  animated?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function GateLine({
  position = 0.5,
  color = colors.timing.gate,
  thickness = 3,
  animated = false,
}: GateLineProps) {
  return (
    <View
      style={[
        styles.line,
        {
          top: `${position * 100}%`,
          backgroundColor: color,
          height: thickness,
        },
        animated && styles.animated,
      ]}
    >
      {/* Left marker */}
      <View style={[styles.marker, styles.leftMarker, { backgroundColor: color }]} />
      {/* Right marker */}
      <View style={[styles.marker, styles.rightMarker, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  animated: {
    // Add pulse animation in production
    opacity: 0.9,
  },
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    top: -8,
  },
  leftMarker: {
    left: 10,
  },
  rightMarker: {
    right: 10,
  },
});
