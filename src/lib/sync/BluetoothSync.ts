/**
 * BluetoothSync - Bluetooth Low Energy sync for multi-device timing
 *
 * Uses BLE for device discovery and communication between phones.
 * One device acts as "peripheral" (advertises), others as "central" (scan & connect).
 *
 * Protocol:
 * - Start gate device advertises as peripheral
 * - Finish/split gates scan and connect as central
 * - Custom GATT service for timing data exchange
 */

import { BleManager, Device, State, Characteristic } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { TimeSync, SyncResult } from './TimeSync';

// Custom UUIDs for Track Speed service
const TRACK_SPEED_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
const TIMING_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef1';
const SYNC_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef2';
const DEVICE_INFO_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef3';

export type DeviceRole = 'start' | 'finish' | 'lap';
export type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'syncing' | 'synced' | 'error';

export interface BluetoothDevice {
  id: string;
  name: string;
  role: DeviceRole;
  distance_m?: number;
  rssi: number;
  device: Device;
}

export interface TimingEvent {
  type: 'start' | 'stop' | 'split' | 'reset';
  timestamp: number;
  deviceId: string;
  deviceRole: DeviceRole;
  gateDistance_m?: number;
  data?: {
    time_ms?: number;
    frameNumber?: number;
    confidence?: number;
  };
}

interface BluetoothSyncConfig {
  deviceName: string;
  deviceRole: DeviceRole;
  gateDistance_m?: number;
  scanTimeout: number;
  syncInterval: number;
}

type StateCallback = (state: ConnectionState) => void;
type DeviceFoundCallback = (device: BluetoothDevice) => void;
type DeviceLostCallback = (deviceId: string) => void;
type TimingEventCallback = (event: TimingEvent) => void;
type SyncUpdateCallback = (result: SyncResult) => void;
type ErrorCallback = (error: Error) => void;

export class BluetoothSync {
  private manager: BleManager;
  private config: BluetoothSyncConfig;
  private timeSync: TimeSync;

  private state: ConnectionState = 'disconnected';
  private discoveredDevices: Map<string, BluetoothDevice> = new Map();
  private connectedDevices: Map<string, BluetoothDevice> = new Map(); // Support multiple devices
  private isAdvertising: boolean = false;
  private scanSubscription: any = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private sequenceNumber: number = 0;

  // Max simultaneous connections (BLE typically supports 7-10)
  private static readonly MAX_CONNECTIONS = 5;

  // Callbacks
  private onStateChange: StateCallback | null = null;
  private onDeviceFound: DeviceFoundCallback | null = null;
  private onDeviceLost: DeviceLostCallback | null = null;
  private onTimingEvent: TimingEventCallback | null = null;
  private onSyncUpdate: SyncUpdateCallback | null = null;
  private onError: ErrorCallback | null = null;

  constructor(config: Partial<BluetoothSyncConfig> = {}) {
    this.config = {
      deviceName: 'TrackSpeed',
      deviceRole: 'finish',
      scanTimeout: 30000,
      syncInterval: 5000,
      ...config,
    };

    this.manager = new BleManager();
    this.timeSync = new TimeSync();
    this.setupManagerListener();
  }

  /**
   * Setup BLE manager state listener
   */
  private setupManagerListener(): void {
    this.manager.onStateChange((state) => {
      console.log('BluetoothSync: BLE state changed:', state);
      if (state === State.PoweredOn) {
        console.log('BluetoothSync: Bluetooth is ready');
      } else if (state === State.PoweredOff) {
        this.handleError(new Error('Bluetooth is turned off'));
      }
    }, true);
  }

  /**
   * Request Bluetooth permissions (Android)
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;

      if (apiLevel >= 31) {
        // Android 12+
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return Object.values(results).every(
          (result) => result === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 11 and below
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
    }

    // iOS handles permissions automatically
    return true;
  }

  /**
   * Check if Bluetooth is available and enabled
   */
  async isAvailable(): Promise<boolean> {
    const state = await this.manager.state();
    return state === State.PoweredOn;
  }

  /**
   * Set callbacks
   */
  onStateChanged(callback: StateCallback): void {
    this.onStateChange = callback;
  }

  onDeviceDiscovered(callback: DeviceFoundCallback): void {
    this.onDeviceFound = callback;
  }

  onDeviceDisconnected(callback: DeviceLostCallback): void {
    this.onDeviceLost = callback;
  }

  onTimingEventReceived(callback: TimingEventCallback): void {
    this.onTimingEvent = callback;
  }

  onSyncUpdated(callback: SyncUpdateCallback): void {
    this.onSyncUpdate = callback;
  }

  onErrorOccurred(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Update state
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.onStateChange?.(state);
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    console.error('BluetoothSync:', error.message);
    this.setState('error');
    this.onError?.(error);
  }

  /**
   * Get current state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get TimeSync instance
   */
  getTimeSync(): TimeSync {
    return this.timeSync;
  }

  /**
   * Start scanning for other Track Speed devices
   */
  async startScan(): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      this.handleError(new Error('Bluetooth permissions not granted'));
      return;
    }

    const isReady = await this.isAvailable();
    if (!isReady) {
      this.handleError(new Error('Bluetooth is not available'));
      return;
    }

    this.setState('scanning');
    this.discoveredDevices.clear();
    console.log('BluetoothSync: Starting scan for Track Speed devices...');

    this.scanSubscription = this.manager.startDeviceScan(
      [TRACK_SPEED_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.error('BluetoothSync: Scan error:', error);
          this.handleError(error);
          return;
        }

        if (device && device.name?.startsWith('TrackSpeed')) {
          this.handleDeviceDiscovered(device);
        }
      }
    );

    // Auto-stop after timeout
    setTimeout(() => {
      this.stopScan();
    }, this.config.scanTimeout);
  }

  /**
   * Stop scanning
   */
  stopScan(): void {
    if (this.scanSubscription) {
      this.manager.stopDeviceScan();
      this.scanSubscription = null;
      console.log('BluetoothSync: Scan stopped');

      if (this.state === 'scanning') {
        this.setState('disconnected');
      }
    }
  }

  /**
   * Handle discovered device
   */
  private handleDeviceDiscovered(device: Device): void {
    // Parse device info from name or manufacturer data
    const nameParts = device.name?.split('_') || [];
    const role = (nameParts[1] as DeviceRole) || 'finish';
    const distance = nameParts[2] ? parseInt(nameParts[2], 10) : undefined;

    const btDevice: BluetoothDevice = {
      id: device.id,
      name: device.name || 'Unknown',
      role,
      distance_m: distance,
      rssi: device.rssi || -100,
      device,
    };

    const existing = this.discoveredDevices.get(device.id);
    this.discoveredDevices.set(device.id, btDevice);

    if (!existing) {
      console.log('BluetoothSync: Found device:', btDevice.name, btDevice.role);
      this.onDeviceFound?.(btDevice);
    }
  }

  /**
   * Connect to a device (supports multiple simultaneous connections)
   */
  async connect(device: BluetoothDevice): Promise<void> {
    // Check if already connected
    if (this.connectedDevices.has(device.id)) {
      console.log('BluetoothSync: Already connected to', device.name);
      return;
    }

    // Check max connections
    if (this.connectedDevices.size >= BluetoothSync.MAX_CONNECTIONS) {
      this.handleError(new Error(`Maximum ${BluetoothSync.MAX_CONNECTIONS} connections reached`));
      return;
    }

    this.stopScan();
    this.setState('connecting');
    console.log('BluetoothSync: Connecting to', device.name);

    try {
      // Connect to device
      const connected = await device.device.connect({
        timeout: 10000,
      });

      // Discover services
      await connected.discoverAllServicesAndCharacteristics();

      const connectedDevice: BluetoothDevice = {
        ...device,
        device: connected,
      };

      // Add to connected devices map
      this.connectedDevices.set(device.id, connectedDevice);

      this.setState('connected');
      console.log('BluetoothSync: Connected to', device.name, `(${this.connectedDevices.size} total)`);

      // Setup disconnect listener
      connected.onDisconnected((error, disconnectedDevice) => {
        console.log('BluetoothSync: Device disconnected:', disconnectedDevice?.name);
        this.handleDisconnect(device.id);
      });

      // Setup characteristic notifications
      await this.setupNotifications(connected);

      // Start time sync if first connection
      if (this.connectedDevices.size === 1) {
        this.startSync();
      }

    } catch (error) {
      console.error('BluetoothSync: Connection failed:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Connect to multiple devices at once
   */
  async connectMultiple(devices: BluetoothDevice[]): Promise<void> {
    for (const device of devices) {
      await this.connect(device);
    }
  }

  /**
   * Setup characteristic notifications
   */
  private async setupNotifications(device: Device): Promise<void> {
    try {
      // Monitor timing events
      device.monitorCharacteristicForService(
        TRACK_SPEED_SERVICE_UUID,
        TIMING_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('BluetoothSync: Notification error:', error);
            return;
          }
          if (characteristic?.value) {
            const data = this.decodeData(characteristic.value);
            if (data.type === 'timing_event') {
              this.onTimingEvent?.(data as TimingEvent);
            }
          }
        }
      );

      // Monitor sync messages
      device.monitorCharacteristicForService(
        TRACK_SPEED_SERVICE_UUID,
        SYNC_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('BluetoothSync: Sync notification error:', error);
            return;
          }
          if (characteristic?.value) {
            const data = this.decodeData(characteristic.value);
            this.handleSyncMessage(data);
          }
        }
      );
    } catch (error) {
      console.error('BluetoothSync: Failed to setup notifications:', error);
    }
  }

  /**
   * Handle sync message
   */
  private handleSyncMessage(message: any): void {
    if (message.type === 'sync_response') {
      const t4 = performance.now();
      const result = this.timeSync.processResponse(message, t4);
      if (result) {
        this.onSyncUpdate?.(result);
        if (this.timeSync.isSyncAccurate()) {
          this.setState('synced');
        } else {
          this.setState('syncing');
        }
      }
    }
  }

  /**
   * Disconnect from a specific device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (device) {
      try {
        await device.device.cancelConnection();
      } catch (error) {
        console.log('BluetoothSync: Error during disconnect:', error);
      }
      this.connectedDevices.delete(deviceId);
      this.onDeviceLost?.(deviceId);
    }

    // Update state based on remaining connections
    if (this.connectedDevices.size === 0) {
      this.stopSync();
      this.setState('disconnected');
      this.timeSync.reset();
    }
  }

  /**
   * Disconnect from all devices
   */
  async disconnect(): Promise<void> {
    this.stopSync();

    for (const [deviceId, device] of this.connectedDevices) {
      try {
        await device.device.cancelConnection();
      } catch (error) {
        console.log('BluetoothSync: Error during disconnect:', error);
      }
    }
    this.connectedDevices.clear();

    this.setState('disconnected');
    this.timeSync.reset();
  }

  /**
   * Handle disconnection of a specific device
   */
  private handleDisconnect(deviceId: string): void {
    this.connectedDevices.delete(deviceId);
    this.onDeviceLost?.(deviceId);

    if (this.connectedDevices.size === 0) {
      this.stopSync();
      this.setState('disconnected');
    }
  }

  /**
   * Start time sync loop
   */
  private startSync(): void {
    this.stopSync();
    this.setState('syncing');

    // Immediate first sync
    this.sendSyncRequest();

    // Periodic sync
    this.syncInterval = setInterval(() => {
      this.sendSyncRequest();
    }, this.config.syncInterval);
  }

  /**
   * Stop time sync loop
   */
  private stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Send sync request to all connected devices
   */
  private async sendSyncRequest(): Promise<void> {
    if (this.connectedDevices.size === 0) return;

    const request = this.timeSync.createSyncRequest(this.sequenceNumber++);
    await this.writeCharacteristic(
      SYNC_CHARACTERISTIC_UUID,
      { ...request, type: 'sync_request' }
    );
  }

  /**
   * Write to characteristic on all connected devices
   */
  private async writeCharacteristic(charUuid: string, data: any): Promise<void> {
    if (this.connectedDevices.size === 0) return;

    const encoded = this.encodeData(data);

    // Send to all connected devices in parallel
    const writePromises = Array.from(this.connectedDevices.values()).map(async (device) => {
      try {
        await device.device.writeCharacteristicWithResponseForService(
          TRACK_SPEED_SERVICE_UUID,
          charUuid,
          encoded
        );
      } catch (error) {
        console.error(`BluetoothSync: Write error to ${device.name}:`, error);
      }
    });

    await Promise.all(writePromises);
  }

  /**
   * Write to a specific device
   */
  private async writeToDevice(deviceId: string, charUuid: string, data: any): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) return;

    try {
      const encoded = this.encodeData(data);
      await device.device.writeCharacteristicWithResponseForService(
        TRACK_SPEED_SERVICE_UUID,
        charUuid,
        encoded
      );
    } catch (error) {
      console.error(`BluetoothSync: Write error to ${device.name}:`, error);
    }
  }

  /**
   * Broadcast timing event
   */
  async broadcastTimingEvent(
    event: Omit<TimingEvent, 'deviceId' | 'deviceRole' | 'timestamp' | 'gateDistance_m'>
  ): Promise<void> {
    const fullEvent: TimingEvent = {
      ...event,
      deviceId: this.timeSync.getLocalId(),
      deviceRole: this.config.deviceRole,
      gateDistance_m: this.config.gateDistance_m,
      timestamp: this.timeSync.getSyncedTime(),
    };

    await this.writeCharacteristic(TIMING_CHARACTERISTIC_UUID, {
      messageType: 'timing_event',
      ...fullEvent,
    });
  }

  /**
   * Send start signal
   */
  async sendStart(): Promise<void> {
    await this.broadcastTimingEvent({ type: 'start' });
  }

  /**
   * Send stop signal
   */
  async sendStop(time_ms: number, frameNumber?: number, confidence?: number): Promise<void> {
    await this.broadcastTimingEvent({
      type: 'stop',
      data: { time_ms, frameNumber, confidence },
    });
  }

  /**
   * Send split time
   */
  async sendSplit(time_ms: number): Promise<void> {
    await this.broadcastTimingEvent({
      type: 'split',
      data: { time_ms },
    });
  }

  /**
   * Send reset signal
   */
  async sendReset(): Promise<void> {
    await this.broadcastTimingEvent({ type: 'reset' });
  }

  /**
   * Encode data to base64
   */
  private encodeData(data: any): string {
    const json = JSON.stringify(data);
    return Buffer.from(json).toString('base64');
  }

  /**
   * Decode base64 data
   */
  private decodeData(base64: string): any {
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): BluetoothDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Get all connected devices
   */
  getConnectedDevices(): BluetoothDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Get connected device by ID
   */
  getConnectedDevice(deviceId?: string): BluetoothDevice | null {
    if (deviceId) {
      return this.connectedDevices.get(deviceId) || null;
    }
    // Return first connected device for backwards compatibility
    return this.connectedDevices.size > 0
      ? Array.from(this.connectedDevices.values())[0]
      : null;
  }

  /**
   * Get connected device by role
   */
  getDeviceByRole(role: DeviceRole): BluetoothDevice | null {
    for (const device of this.connectedDevices.values()) {
      if (device.role === role) return device;
    }
    return null;
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connectedDevices.size;
  }

  /**
   * Check if synced
   */
  isReady(): boolean {
    return this.state === 'synced';
  }

  /**
   * Check if connected to any device
   */
  isConnected(): boolean {
    return this.connectedDevices.size > 0;
  }

  /**
   * Get sync accuracy
   */
  getSyncAccuracy(): number {
    return this.timeSync.getAccuracy();
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    this.stopScan();
    await this.disconnect();
    this.discoveredDevices.clear();
    this.manager.destroy();
  }
}

// Singleton
let bluetoothSyncInstance: BluetoothSync | null = null;

export function getBluetoothSync(config?: Partial<BluetoothSyncConfig>): BluetoothSync {
  if (!bluetoothSyncInstance) {
    bluetoothSyncInstance = new BluetoothSync(config);
  }
  return bluetoothSyncInstance;
}
