/**
 * useBluetoothSync - React hook for Bluetooth multi-device synchronization
 *
 * Uses Bluetooth Low Energy for device discovery and connection.
 * Primary sync method - more reliable than WiFi for track environments.
 *
 * Supports two modes:
 * - Host mode: Advertises as BLE peripheral, other devices connect to this device
 * - Client mode: Scans for and connects to host device
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
  getBLEPeripheral,
  type BLEPeripheral,
  type SyncRequest,
} from '../lib/sync';

// Re-export types for consumers
export type ConnectionState = BluetoothConnectionState;
export type DeviceRole = BluetoothDeviceRole;
export type TimingEvent = BluetoothTimingEvent;

// Session mode - determines BLE role
export type SessionMode = 'host' | 'client' | 'none';

interface UseBluetoothSyncOptions {
  deviceName?: string;
  autoScan?: boolean;
  sessionMode?: SessionMode;  // New: host = advertise, client = scan
}

interface UseBluetoothSyncReturn {
  // Bluetooth state
  isBluetoothAvailable: boolean;
  hasPermissions: boolean;
  requestPermissions: () => Promise<boolean>;

  // Session mode (host = advertise, client = scan)
  sessionMode: SessionMode;
  setSessionMode: (mode: SessionMode) => void;

  // Host mode (advertising/peripheral)
  isAdvertising: boolean;
  startHostSession: () => Promise<boolean>;
  stopHostSession: () => Promise<void>;
  connectedClientCount: number;  // Number of clients connected to us as host

  // Client mode (scanning/central) - Device discovery
  isScanning: boolean;
  discoveredDevices: BluetoothDevice[];
  startScan: () => Promise<void>;
  stopScan: () => void;

  // Connection (supports multiple devices)
  connectionState: BluetoothConnectionState;
  connectedDevice: BluetoothDevice | null; // First/primary device (backwards compat)
  connectedDevices: BluetoothDevice[]; // All connected devices
  connectionCount: number;
  connect: (device: BluetoothDevice) => Promise<void>;
  connectMultiple: (devices: BluetoothDevice[]) => Promise<void>;
  disconnect: () => Promise<void>;
  disconnectDevice: (deviceId: string) => Promise<void>;

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
  const { deviceName = 'TrackSpeed', autoScan = false, sessionMode: initialSessionMode = 'none' } = options;

  // State
  const [isBluetoothAvailable, setIsBluetoothAvailable] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [connectionState, setConnectionState] = useState<BluetoothConnectionState>('disconnected');
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [syncAccuracy, setSyncAccuracy] = useState(Infinity);
  const [lastTimingEvent, setLastTimingEvent] = useState<BluetoothTimingEvent | null>(null);
  const [deviceRole, setDeviceRoleState] = useState<BluetoothDeviceRole>('finish');
  const [gateDistance, setGateDistanceState] = useState<number | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  // Host mode state
  const [sessionMode, setSessionModeState] = useState<SessionMode>(initialSessionMode);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [connectedClientCount, setConnectedClientCount] = useState(0);

  // Derived state
  const connectedDevice = connectedDevices.length > 0 ? connectedDevices[0] : null;
  const connectionCount = connectedDevices.length;

  // Refs
  const bluetoothSync = useRef<BluetoothSync | null>(null);
  const blePeripheral = useRef<BLEPeripheral | null>(null);

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
          setConnectedDevices((prev) => prev.filter((d) => d.id !== deviceId));
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

    // Initialize BLE peripheral for host mode
    const initPeripheral = async () => {
      try {
        const peripheral = getBLEPeripheral();
        if (peripheral.isAvailable) {
          blePeripheral.current = peripheral;

          // Setup peripheral callbacks
          peripheral.setOnCentralConnected(() => {
            setConnectedClientCount((prev) => prev + 1);
          });

          peripheral.setOnCentralDisconnected(() => {
            setConnectedClientCount((prev) => Math.max(0, prev - 1));
          });

          peripheral.setOnSyncRequest((request: SyncRequest) => {
            // Handle sync request from client - respond with server timestamps
            if (request.t1 !== undefined && request.t2 !== undefined) {
              peripheral.sendSyncResponse(request.t1, request.t2, request.sequenceNumber);
            }
          });

          peripheral.setOnTimingEvent((event) => {
            setLastTimingEvent(event);
          });

          peripheral.setOnError((message) => {
            setError(new Error(message));
          });

          console.log('useBluetoothSync: BLE Peripheral available');
        }
      } catch (err) {
        console.warn('useBluetoothSync: Peripheral init failed:', err);
      }
    };

    initPeripheral();

    return () => {
      bluetoothSync.current?.cleanup();
      blePeripheral.current?.cleanup();
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

  // Connect to a single device
  const connect = useCallback(async (device: BluetoothDevice) => {
    if (!bluetoothSync.current) return;
    try {
      await bluetoothSync.current.connect(device);
      setConnectedDevices((prev) => {
        // Don't add if already in list
        if (prev.find((d) => d.id === device.id)) return prev;
        return [...prev, device];
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Connection failed'));
    }
  }, []);

  // Connect to multiple devices
  const connectMultiple = useCallback(async (devices: BluetoothDevice[]) => {
    if (!bluetoothSync.current) return;
    try {
      await bluetoothSync.current.connectMultiple(devices);
      setConnectedDevices((prev) => {
        const newDevices = devices.filter((d) => !prev.find((p) => p.id === d.id));
        return [...prev, ...newDevices];
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Connection failed'));
    }
  }, []);

  // Disconnect from all devices
  const disconnect = useCallback(async () => {
    if (!bluetoothSync.current) return;
    try {
      await bluetoothSync.current.disconnect();
      setConnectedDevices([]);
      setIsSynced(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Disconnect failed'));
    }
  }, []);

  // Disconnect from a specific device
  const disconnectDevice = useCallback(async (deviceId: string) => {
    if (!bluetoothSync.current) return;
    try {
      await bluetoothSync.current.disconnectDevice(deviceId);
      setConnectedDevices((prev) => prev.filter((d) => d.id !== deviceId));
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

  // Set session mode
  const setSessionMode = useCallback((mode: SessionMode) => {
    setSessionModeState(mode);
  }, []);

  // Start host session (advertising)
  const startHostSession = useCallback(async (): Promise<boolean> => {
    if (!blePeripheral.current) {
      setError(new Error('BLE Peripheral not available'));
      return false;
    }

    try {
      // Initialize peripheral with current settings
      await blePeripheral.current.initialize({
        deviceName,
        deviceRole,
        gateDistance,
      });

      // Start advertising
      const success = await blePeripheral.current.startAdvertising();
      if (success) {
        setIsAdvertising(true);
        setSessionModeState('host');
        console.log('useBluetoothSync: Host session started');
      }
      return success;
    } catch (err) {
      console.error('useBluetoothSync: Start host session failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to start host session'));
      return false;
    }
  }, [deviceName, deviceRole, gateDistance]);

  // Stop host session
  const stopHostSession = useCallback(async (): Promise<void> => {
    if (!blePeripheral.current) return;

    try {
      await blePeripheral.current.stopAdvertising();
      setIsAdvertising(false);
      setConnectedClientCount(0);
      setSessionModeState('none');
      console.log('useBluetoothSync: Host session stopped');
    } catch (err) {
      console.error('useBluetoothSync: Stop host session failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to stop host session'));
    }
  }, []);

  return {
    // Bluetooth state
    isBluetoothAvailable,
    hasPermissions,
    requestPermissions,

    // Session mode (host = advertise, client = scan)
    sessionMode,
    setSessionMode,

    // Host mode (advertising/peripheral)
    isAdvertising,
    startHostSession,
    stopHostSession,
    connectedClientCount,

    // Client mode (scanning/central) - Device discovery
    isScanning,
    discoveredDevices,
    startScan,
    stopScan,

    // Connection (supports multiple devices)
    connectionState,
    connectedDevice,
    connectedDevices,
    connectionCount,
    connect,
    connectMultiple,
    disconnect,
    disconnectDevice,

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
