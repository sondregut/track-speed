import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { TimingState } from '../../types';

interface StartButtonProps {
  state: TimingState;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export function StartButton({
  state,
  onStart,
  onStop,
  onReset,
  disabled = false,
}: StartButtonProps) {
  const getButtonConfig = () => {
    switch (state) {
      case 'idle':
        return {
          label: 'START',
          color: colors.timing.ready,
          action: onStart,
        };
      case 'ready':
        return {
          label: 'READY',
          color: colors.timing.ready,
          action: onStart,
        };
      case 'running':
        return {
          label: 'STOP',
          color: colors.timing.stopped,
          action: onStop,
        };
      case 'stopped':
        return {
          label: 'RESET',
          color: colors.gray[600],
          action: onReset,
        };
      default:
        return {
          label: 'START',
          color: colors.timing.ready,
          action: onStart,
        };
    }
  };

  const config = getButtonConfig();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: config.color },
        disabled && styles.disabled,
      ]}
      onPress={config.action}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.label}>{config.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  label: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.white,
    letterSpacing: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
