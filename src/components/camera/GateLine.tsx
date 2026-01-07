import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../constants/theme';

interface GateLineProps {
  position?: number; // 0-1, position from left (for vertical line)
  color?: string;
  thickness?: number;
  animated?: boolean;
}

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
          left: `${position * 100}%`,
          backgroundColor: color,
          width: thickness,
        },
        animated && styles.animated,
      ]}
    >
      {/* Top marker */}
      <View style={[styles.marker, styles.topMarker, { backgroundColor: color }]} />
      {/* Bottom marker */}
      <View style={[styles.marker, styles.bottomMarker, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 10,
  },
  animated: {
    opacity: 0.9,
  },
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    left: -8,
  },
  topMarker: {
    top: 40,
  },
  bottomMarker: {
    bottom: 40,
  },
});
