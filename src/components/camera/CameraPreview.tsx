import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSettingsStore } from '../../stores';
import { colors, spacing } from '../../constants/theme';
import { Button } from '../ui/Button';

interface CameraPreviewProps {
  onCameraReady?: () => void;
  children?: React.ReactNode;
}

export function CameraPreview({ onCameraReady, children }: CameraPreviewProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraSettings = useSettingsStore((state) => state.camera);

  useEffect(() => {
    if (permission?.granted && onCameraReady) {
      onCameraReady();
    }
  }, [permission?.granted, onCameraReady]);

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera access is required</Text>
        <Text style={styles.subMessage}>
          Track Speed needs camera access to detect when you cross the finish line.
        </Text>
        <Button
          title="Grant Permission"
          onPress={requestPermission}
          style={styles.button}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraSettings.preferredPosition}
        // Note: expo-camera doesn't support frame rate/resolution settings directly
        // For production, use react-native-vision-camera
      >
        {children}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  message: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subMessage: {
    color: colors.gray[400],
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  button: {
    minWidth: 200,
  },
});
