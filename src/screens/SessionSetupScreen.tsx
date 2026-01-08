/**
 * SessionSetupScreen - Simplified Freelap-style setup wizard
 *
 * Three-step flow:
 * 1. Choose start method (Sound, Thumb, Gate)
 * 2. Configure gates (count, distances)
 * 3. Connect phones (if multi-phone)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts';
import { spacing, typography, borderRadius, colors } from '../constants/theme';
import { Header, Button } from '../components/ui';
import { StartMethodPicker, GateCountPicker, PhoneConnector } from '../components/setup';
import { useSessionStore } from '../stores';
import { useBluetoothSync } from '../hooks';
import type {
  SimpleStartMethod,
  PhoneRole,
  QuickSetupConfig,
  GateConfig,
  GateRole,
} from '../types';

type SetupStep = 'start' | 'gates' | 'connect';

// Map simple start method to legacy start method
function mapToLegacyStartMethod(method: SimpleStartMethod): 'sound_detection' | 'touch' | 'external_gate' {
  switch (method) {
    case 'sound': return 'sound_detection';
    case 'thumb': return 'touch';
    case 'gate': return 'external_gate';
  }
}

// Map PhoneRole to GateRole
function mapPhoneRoleToGateRole(role: PhoneRole): GateRole {
  switch (role) {
    case 'start': return 'start';
    case 'finish': return 'finish';
    case 'lap': return 'lap';
    case 'start_finish': return 'finish'; // For sound mode, the gate is finish
  }
}

export function SessionSetupScreen() {
  const { colors: themeColors, isDark } = useTheme();
  const navigation = useNavigation();
  const { createSession } = useSessionStore();

  // Bluetooth sync for multi-phone
  const {
    isScanning,
    discoveredDevices,
    connectedDevices,
    startScan,
    stopScan,
  } = useBluetoothSync();

  // Wizard step
  const [currentStep, setCurrentStep] = useState<SetupStep>('start');

  // Setup state
  const [startMethod, setStartMethod] = useState<SimpleStartMethod>('sound');
  const [gateCount, setGateCount] = useState<number>(1);
  const [totalDistance, setTotalDistance] = useState<number>(40);
  const [lapDistances, setLapDistances] = useState<number[]>([]);
  const [thisPhoneRole, setThisPhoneRole] = useState<PhoneRole>('start_finish');
  const [deviceAssignments, setDeviceAssignments] = useState<Map<string, PhoneRole>>(new Map());

  // Adjust gate count and phone role when start method changes
  const handleStartMethodChange = useCallback((method: SimpleStartMethod) => {
    setStartMethod(method);

    if (method === 'sound') {
      setGateCount(1);
      setThisPhoneRole('start_finish');
      setLapDistances([]);
    } else {
      if (gateCount < 2) setGateCount(2);
      setThisPhoneRole('finish'); // Default to finish for thumb/gate
    }
  }, [gateCount]);

  // Adjust lap distances when gate count changes
  const handleGateCountChange = useCallback((count: number) => {
    setGateCount(count);

    const lapCount = startMethod === 'sound' ? count - 1 : count - 2;

    if (lapCount <= 0) {
      setLapDistances([]);
    } else if (lapCount > lapDistances.length) {
      // Add new lap distances
      const newDistances = [...lapDistances];
      while (newDistances.length < lapCount) {
        const prev = newDistances.length > 0 ? newDistances[newDistances.length - 1] : 0;
        const next = newDistances.length > 0 ? totalDistance : totalDistance / 2;
        newDistances.push(Math.round((prev + next) / 2));
      }
      setLapDistances(newDistances);
    } else if (lapCount < lapDistances.length) {
      // Remove excess lap distances
      setLapDistances(lapDistances.slice(0, lapCount));
    }
  }, [startMethod, lapDistances, totalDistance]);

  // Get steps for current configuration
  const steps = useMemo((): SetupStep[] => {
    const base: SetupStep[] = ['start', 'gates'];
    // Add connect step if multi-phone (not sound with 1 gate)
    const needsConnect = !(startMethod === 'sound' && gateCount === 1);
    if (needsConnect) base.push('connect');
    return base;
  }, [startMethod, gateCount]);

  const currentStepIndex = steps.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(steps[currentStepIndex - 1]);
    } else {
      navigation.goBack();
    }
  };

  // Build gate configuration for session
  const buildGateConfig = (): GateConfig[] => {
    const gates: GateConfig[] = [];

    // Start gate (0m)
    gates.push({
      role: 'start',
      distance_m: 0,
    });

    // Lap gates
    lapDistances.forEach((distance) => {
      gates.push({
        role: 'lap',
        distance_m: distance,
      });
    });

    // Finish gate
    gates.push({
      role: 'finish',
      distance_m: totalDistance,
    });

    return gates;
  };

  const handleStartSession = () => {
    const gates = buildGateConfig();

    // Create session with new config
    const session = createSession({
      name: `${totalDistance}m Sprint`,
      sessionType: 'standing',
      startMethod: mapToLegacyStartMethod(startMethod),
      distance: totalDistance,
      standardConfig: {
        totalDistance_m: totalDistance,
      },
      splitConfig: lapDistances.length > 0 ? {
        enabled: true,
        distances_m: lapDistances,
        gates,
      } : undefined,
    });

    // Navigate to timer with role info
    navigation.navigate('Timer', {
      quickSetup: {
        startMethod,
        gateCount,
        totalDistance_m: totalDistance,
        gateDistances_m: [0, ...lapDistances, totalDistance],
        thisPhoneRole,
        gateDeviceIds: [], // Will be filled by Bluetooth
      } as QuickSetupConfig,
    });
  };

  // Connected devices for PhoneConnector
  const connectedDeviceList = useMemo(() => {
    return [...discoveredDevices, ...connectedDevices].map(d => ({
      id: d.id,
      name: d.name || 'Unknown Device',
      role: deviceAssignments.get(d.id),
      isConnected: connectedDevices.some(c => c.id === d.id),
    }));
  }, [discoveredDevices, connectedDevices, deviceAssignments]);

  // Check if setup is complete
  const isSetupComplete = useMemo(() => {
    if (startMethod === 'sound' && gateCount === 1) {
      return true; // Single phone sound mode is always ready
    }

    const neededDevices = gateCount - 1; // This phone is one
    const connectedCount = connectedDevices.length;
    return connectedCount >= neededDevices;
  }, [startMethod, gateCount, connectedDevices]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.secondary }]}>
      <Header
        title="Quick Setup"
        leftAction={
          <TouchableOpacity onPress={handleBack}>
            <Text style={[styles.navText, { color: themeColors.primary[500] }]}>
              {isFirstStep ? 'Cancel' : 'Back'}
            </Text>
          </TouchableOpacity>
        }
      />

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: index <= currentStepIndex
                    ? colors.primary[500]
                    : themeColors.background.tertiary,
                },
              ]}
            >
              <Text style={styles.stepNumber}>{index + 1}</Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor: index < currentStepIndex
                      ? colors.primary[500]
                      : themeColors.background.tertiary,
                  },
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Start Method */}
        {currentStep === 'start' && (
          <StartMethodPicker
            selected={startMethod}
            onSelect={handleStartMethodChange}
          />
        )}

        {/* Step 2: Gate Configuration */}
        {currentStep === 'gates' && (
          <GateCountPicker
            startMethod={startMethod}
            gateCount={gateCount}
            onGateCountChange={handleGateCountChange}
            totalDistance={totalDistance}
            onTotalDistanceChange={setTotalDistance}
            lapDistances={lapDistances}
            onLapDistancesChange={setLapDistances}
          />
        )}

        {/* Step 3: Phone Connection */}
        {currentStep === 'connect' && (
          <PhoneConnector
            startMethod={startMethod}
            gateCount={gateCount}
            thisPhoneRole={thisPhoneRole}
            onThisPhoneRoleChange={setThisPhoneRole}
            connectedDevices={connectedDeviceList}
            isScanning={isScanning}
            onStartScan={() => startScan()}
            onStopScan={() => stopScan()}
            onAssignRole={(deviceId, role) => {
              const newAssignments = new Map(deviceAssignments);
              newAssignments.set(deviceId, role);
              setDeviceAssignments(newAssignments);
            }}
            lapDistances={lapDistances}
            totalDistance={totalDistance}
          />
        )}
      </ScrollView>

      {/* Footer with navigation buttons */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.footer,
          { borderTopColor: themeColors.border.primary, backgroundColor: themeColors.background.primary },
        ]}
      >
        {isLastStep ? (
          <Button
            title="Start Session"
            onPress={handleStartSession}
            size="large"
            style={{ backgroundColor: colors.timing.ready }}
            disabled={!isSetupComplete && currentStep === 'connect'}
          />
        ) : (
          <Button
            title="Continue"
            onPress={handleNext}
            size="large"
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navText: {
    fontSize: typography.fontSize.base,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    color: 'white',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold as '700',
  },
  stepLine: {
    flex: 1,
    height: 3,
    marginHorizontal: spacing.sm,
    borderRadius: 1.5,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
  },
});
