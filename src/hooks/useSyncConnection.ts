/**
 * useSyncConnection - React hook for multi-device synchronization
 *
 * Provides:
 * - Device discovery
 * - Connection management
 * - Time sync status
 * - Timing event handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDeviceDiscovery,
  getSyncConnection,
  type DiscoveredDevice,
  type ConnectionState,
  type DeviceRole,
  type TimingEvent,
  type SyncResult,
} from '../lib/sync';

interface UseSyncConnectionOptions {
  deviceName?: string;
  autoScan?: boolean;
}

interface UseSyncConnectionReturn {
  // Device discovery
  isScanning: boolean;
  discoveredDevices: DiscoveredDevice[];
  startScan: () => Promise<void>;
  stopScan: () => void;

  // Device registration
  isRegistered: boolean;
  localDevice: DiscoveredDevice | null;
  register: (name: string, role: DeviceRole, distance?: number) => Promise<void>;
  unregister: () => Promise<void>;

  // Connection
  connectionState: ConnectionState;
  connectedDevice: DiscoveredDevice | null;
  connect: (device: DiscoveredDevice) => Promise<void>;
  disconnect: () => Promise<void>;

  // Sync status
  isSynced: boolean;
  syncAccuracy: number;
  lastSyncResult: SyncResult | null;

  // Timing events
  lastTimingEvent: TimingEvent | null;
  sendStart: () => void;
  sendStop: (time_ms: number, frameNumber?: number, confidence?: number) => void;
  sendSplit: (time_ms: number) => void;
  sendReset: () => void;

  // Role and distance
  deviceRole: DeviceRole;
  setDeviceRole: (role: DeviceRole) => void;
  gateDistance: number | undefined;
  setGateDistance: (distance: number) => void;

  // Error
  error: Error | null;
  clearError: () => void;
}

export function useSyncConnection(options: UseSyncConnectionOptions = {}): UseSyncConnectionReturn {
  const { deviceName = 'My Device', autoScan = false } = options;

  // State
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [isRegistered, setIsRegistered] = useState(false);
  const [localDevice, setLocalDevice] = useState<DiscoveredDevice | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectedDevice, setConnectedDevice] = useState<DiscoveredDevice | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [syncAccuracy, setSyncAccuracy] = useState(Infinity);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastTimingEvent, setLastTimingEvent] = useState<TimingEvent | null>(null);
  const [deviceRole, setDeviceRole] = useState<DeviceRole>('finish');
  const [gateDistance, setGateDistanceState] = useState<number | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const discovery = useRef(getDeviceDiscovery());
  const syncConnection = useRef(getSyncConnection());
  const currentDeviceName = useRef(deviceName);

  // Update device name ref
  useEffect(() => {
    currentDeviceName.current = deviceName;
  }, [deviceName]);

  // Setup discovery callbacks
  useEffect(() => {
    const disc = discovery.current;

    disc.onFound((device) => {
      setDiscoveredDevices((prev) => {
        const existing = prev.find((d) => d.id === device.id);
        if (existing) {
          return prev.map((d) => (d.id === device.id ? device : d));
        }
        return [...prev, device];
      });
    });

    disc.onLost((deviceId) => {
      setDiscoveredDevices((prev) => prev.filter((d) => d.id !== deviceId));
    });

    disc.onErrorCallback((err) => {
      setError(err);
    });

    return () => {
      disc.cleanup();
    };
  }, []);

  // Setup sync connection callbacks
  useEffect(() => {
    const sync = syncConnection.current;

    sync.onStateChanged((state) => {
      setConnectionState(state);
      setIsSynced(state === 'synced');
      setConnectedDevice(sync.getConnectedDevice());
    });

    sync.onSyncUpdated((result) => {
      setLastSyncResult(result);
      setSyncAccuracy(result.accuracy);
    });

    sync.onTimingEventReceived((event) => {
      setLastTimingEvent(event);
    });

    sync.onErrorOccurred((err) => {
      setError(err);
    });

    return () => {
      sync.disconnect();
    };
  }, []);

  // Auto-scan on mount if enabled
  useEffect(() => {
    if (autoScan) {
      startScan();
    }
  }, [autoScan]);

  // Discovery functions
  const startScan = useCallback(async () => {
    try {
      setIsScanning(true);
      setDiscoveredDevices([]);
      await discovery.current.startScan();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Scan failed'));
      setIsScanning(false);
    }
  }, []);

  const stopScan = useCallback(() => {
    discovery.current.stopScan();
    setIsScanning(false);
  }, []);

  // Registration functions
  const register = useCallback(async (name: string, role: DeviceRole, distance?: number) => {
    try {
      const device = await discovery.current.register(name, role, distance);
      setLocalDevice(device);
      setIsRegistered(true);
      setDeviceRole(role);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Registration failed'));
    }
  }, []);

  const unregister = useCallback(async () => {
    try {
      await discovery.current.unregister();
      setLocalDevice(null);
      setIsRegistered(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unregistration failed'));
    }
  }, []);

  // Set gate distance
  const setGateDistance = useCallback((distance: number) => {
    setGateDistanceState(distance);
    syncConnection.current.setGateDistance(distance);
  }, []);

  // Connection functions
  const connect = useCallback(async (device: DiscoveredDevice) => {
    try {
      await syncConnection.current.connect(device, deviceRole, currentDeviceName.current, gateDistance);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Connection failed'));
    }
  }, [deviceRole, gateDistance]);

  const disconnect = useCallback(async () => {
    try {
      await syncConnection.current.disconnect();
      setConnectedDevice(null);
      setIsSynced(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Disconnect failed'));
    }
  }, []);

  // Timing event functions
  const sendStart = useCallback(() => {
    syncConnection.current.sendStart();
  }, []);

  const sendStop = useCallback((time_ms: number, frameNumber?: number, confidence?: number) => {
    syncConnection.current.sendStop(time_ms, frameNumber, confidence);
  }, []);

  const sendSplit = useCallback((time_ms: number) => {
    syncConnection.current.sendSplit(time_ms);
  }, []);

  const sendReset = useCallback(() => {
    syncConnection.current.sendReset();
  }, []);

  // Error handling
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Device discovery
    isScanning,
    discoveredDevices,
    startScan,
    stopScan,

    // Device registration
    isRegistered,
    localDevice,
    register,
    unregister,

    // Connection
    connectionState,
    connectedDevice,
    connect,
    disconnect,

    // Sync status
    isSynced,
    syncAccuracy,
    lastSyncResult,

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
