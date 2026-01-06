import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts';
import { borderRadius } from '../../constants/theme';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  onPress,
  variant = 'ghost',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: colors.primary[500] };
      case 'secondary':
        return { backgroundColor: colors.gray[200] };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.primary,
        };
      case 'ghost':
        return { backgroundColor: 'transparent' };
    }
  };

  const buttonStyles = [
    styles.base,
    getVariantStyle(),
    styles[`${size}Size`],
    isDisabled && styles.disabled,
    style,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.primary[500]}
          size="small"
        />
      ) : (
        icon
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },

  // Sizes
  smallSize: {
    width: 32,
    height: 32,
  },
  mediumSize: {
    width: 44,
    height: 44,
  },
  largeSize: {
    width: 56,
    height: 56,
  },

  // Disabled
  disabled: {
    opacity: 0.5,
  },
});
