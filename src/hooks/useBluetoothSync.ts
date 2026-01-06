/**
 * useBluetoothSync - React hook for Bluetooth multi-device synchronization
 *
 * Uses Bluetooth Low Energy for device discovery and connection.
 * Primary sync method - more reliable than WiFi for track environments.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BluetoothSync,
  getBluetoothSync,
  type BluetoothDevice,
  type BluetoothConnectionState,
  type BluetoothDeviceRole,
  type BluetoothTimingEvent,
  type SyncResult,
} from '../lib/sync';

// Re-export types for consumers
export type ConnectionState = BluetoothConnectionState;
export type DeviceRole = BluetoothDeviceRole;
export type TimingEvent = BluetoothTimingEvent;

interface UseBluetoothSyncOptions {
  deviceName?: string;
  autoScan?: boolean;
}

interface UseBluetoothSyncReturn {
  // Bluetooth state
  isBluetoothAvailable: boolean;
  hasPermissions: boolean;
  requestPermissions: () => Promise<boolean>;

  // Device discovery
  isScanning: boolean;
  discoveredDevices: BluetoothDevice[];
  startScan: () => Promise<void>;
  stopScan: () => void;

  // Connection
  connectionState: BluetoothConnectionState;
  connectedDevice: BluetoothDevice | null;
  connect: (device: BluetoothDevice) => Promise<void>;
  disconnect: () => Promise<void>;

  // Sync status
  isSynced: boolean;
  syncAccuracy: number;

  // Timing events
  lastTimingEvent: BluetoothTimingEvent | null;
  sendStart: () => Promise<void>;
  sendStop: (time_ms: number, frameNumber?: number, confidence?: number) => Promise<void>;
  sendSplit: (time_ms: number) => Promise<void>;
  sendReset: () => Promise<void>;

  // Role and distance
  deviceRole: BluetoothDeviceRole;
  setDeviceRole: (role: BluetoothDeviceRole) => void;
  gateDistance: number | undefined;
  setGateDistance: (distance: number) => void;

  // Error
  error: Error | null;
  clearError: () => void;
}

export function useBluetoothSync(options: UseBluetoothSyncOptions = {}): UseBluetoothSyncReturn {
  const { deviceName = 'TrackSpeed', autoScan = false } = options;

  // State
  const [isBluetoothAvailable, setIsBluetoothAvailable] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [connectionState, setConnectionState] = useState<BluetoothConnectionState>('disconnected');
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [syncAccuracy, setSyncAccuracy] = useState(Infinity);
  const [lastTimingEvent, setLastTimingEvent] = useState<BluetoothTimingEvent | null>(null);
  const [deviceRole, setDeviceRoleState] = useState<BluetoothDeviceRole>('finish');
  const [gateDistance, setGateDistanceState] = useState<number | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const bluetoothSync = useRef<BluetoothSync | null>(null);

  // Initialize Bluetooth
  useEffect(() => {
    const initBluetooth = async () => {
      try {
        const sync = getBluetoothSync({
          deviceName,
          deviceRole,
          gateDistance_m: gateDistance,
        });
        bluetoothSync.current = sync;

        // Check availability
        const available = await sync.isAvailable();
        setIsBluetoothAvailable(available);

        // Setup callbacks
        sync.onStateChanged((state: BluetoothConnectionState) => {
          setConnectionState(state);
          setIsSynced(state === 'synced');
          setIsScanning(state === 'scanning');
        });

        sync.onDeviceDiscovered((device) => {
          setDiscoveredDevices((prev) => {
            const existing = prev.find((d) => d.id === device.id);
            if (existing) {
              return prev.map((d) => (d.id === device.id ? device : d));
            }
            return [...prev, device];
          });
        });

        sync.onDeviceDisconnected((deviceId) => {
          setDiscoveredDevices((prev) => prev.filter((d) => d.id !== deviceId));
          setConnectedDevice(null);
        });

        sync.onSyncUpdated((result) => {
          setSyncAccuracy(result.accuracy);
        });

        sync.onTimingEventReceived((event) => {
          setLastTimingEvent(event);
        });

        sync.onErrorOccurred((err) => {
          setError(err);
        });

        // Request permissions
        const granted = await sync.requestPermissions();
        setHasPermissions(granted);

        // Auto-scan if enabled and permissions granted
        if (autoScan && granted && available) {
          await sync.startScan();
        }
      } catch (err) {
        console.error('useBluetoothSync: Init error:', err);
        setError(err instanceof Error ? err : new Error('Bluetooth init failed'));
      }
    };

    initBluetooth();

    return () => {
      bluetoothSync.current?.cleanup();
    };
  }, [deviceName, autoScan]);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!bluetoothSync.current) return false;
    const granted = await bluetoothSync.current.requestPermissions();
    setHasPermissions(granted);
    return granted;
  }, []);

  // Start scan
  const startScan = useCallback(async () => {
    if (!bluetoothSync.current) return;
    try {
      setDiscoveredDevices([]);
      await bluetoothSync.current.startScan();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Scan failed'));
    }
  }, []);

  // Stop scan
  const stopScan = useCallback(() => {
    bluetoothSync.current?.stopScan();
    setIsScanning(false);
  }, []);

  // Connect
  const connect = useCallback(async (device: BluetoothDevice) => {
    if (!bluetoothSync.current) return;
    try {
      await bluetoothSync.current.connect(device);
      setConnectedDevice(device);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Connection failed'));
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (!bluetoothSync.current) return;
    try {
      await bluetoothSync.current.disconnect();
      setConnectedDevice(null);
      setIsSynced(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Disconnect failed'));
    }
  }, []);

  // Set device role
  const setDeviceRole = useCallback((role: BluetoothDeviceRole) => {
    setDeviceRoleState(role);
  }, []);

  // Set gate distance
  const setGateDistance = useCallback((distance: number) => {
    setGateDistanceState(distance);
  }, []);

  // Timing events
  const sendStart = useCallback(async () => {
    await bluetoothSync.current?.sendStart();
  }, []);

  const sendStop = useCallback(async (time_ms: number, frameNumber?: number, confidence?: number) => {
    await bluetoothSync.current?.sendStop(time_ms, frameNumber, confidence);
  }, []);

  const sendSplit = useCallback(async (time_ms: number) => {
    await bluetoothSync.current?.sendSplit(time_ms);
  }, []);

  const sendReset = useCallback(async () => {
    await bluetoothSync.current?.sendReset();
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Bluetooth state
    isBluetoothAvailable,
    hasPermissions,
    requestPermissions,

    // Device discovery
    isScanning,
    discoveredDevices,
    startScan,
    stopScan,

    // Connection
    connectionState,
    connectedDevice,
    connect,
    disconnect,

    // Sync status
    isSynced,
    syncAccuracy,

    // Timing events
    lastTimingEvent,
    sendStart,
    sendStop,
    sendSplit,
    sendReset,

    // Role and distance
    deviceRole,
    setDeviceRole,
    gateDistance,
    setGateDistance,

    // Error
    error,
    clearError,
  };
}
