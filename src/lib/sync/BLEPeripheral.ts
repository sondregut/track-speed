/**
 * BLEPeripheral - TypeScript wrapper for native BLE Peripheral module
 *
 * Provides BLE advertising (GATT server) capabilities for iOS.
 * Allows this device to be discovered by other Track Speed devices.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { DeviceRole, TimingEvent } from './BluetoothSync';

// Native module interface
interface BLEPeripheralNativeModule {
  initialize(options: BLEPeripheralOptions): Promise<{ success: boolean }>;
  startAdvertising(): Promise<{ success: boolean; deviceName?: string; alreadyAdvertising?: boolean }>;
  stopAdvertising(): Promise<{ success: boolean }>;
  sendSyncResponse(response: SyncResponse): Promise<{ success: boolean }>;
  broadcastTimingEvent(event: TimingEvent): Promise<{ success: boolean }>;
  getState(): Promise<BLEPeripheralState>;
  cleanup(): Promise<{ success: boolean }>;
}

export interface BLEPeripheralOptions {
  deviceName?: string;
  deviceRole?: DeviceRole;
  gateDistance?: number;
}

export interface SyncResponse {
  type: 'sync_response';
  t1: number;  // Client send time
  t2: number;  // Server receive time
  t3: number;  // Server send time
  sequenceNumber: number;
}

export interface SyncRequest {
  type: 'sync_request';
  t1: number;
  sequenceNumber: number;
  centralId: string;
  t2?: number; // Added by native code
}

export interface BLEPeripheralState {
  state: 'poweredOn' | 'poweredOff' | 'resetting' | 'unauthorized' | 'unsupported' | 'unknown';
  isAdvertising: boolean;
  connectedCount: number;
}

// Event types
type StateChangedEvent = { state: string };
type AdvertisingStartedEvent = { deviceName: string };
type CentralConnectedEvent = { centralId: string; characteristicId: string };
type CentralDisconnectedEvent = { centralId: string };
type SyncRequestEvent = SyncRequest;
type TimingEventReceived = TimingEvent & { centralId: string };
type ErrorEvent = { message: string };

// Callbacks
type StateCallback = (state: BLEPeripheralState['state']) => void;
type AdvertisingCallback = (deviceName: string) => void;
type CentralConnectedCallback = (centralId: string) => void;
type CentralDisconnectedCallback = (centralId: string) => void;
type SyncRequestCallback = (request: SyncRequest) => void;
type TimingEventCallback = (event: TimingEventReceived) => void;
type ErrorCallback = (error: string) => void;

/**
 * BLEPeripheral class - manages BLE advertising and GATT server
 */
export class BLEPeripheral {
  private nativeModule: BLEPeripheralNativeModule | null = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private subscriptions: any[] = [];

  private isInitialized = false;
  private _isAdvertising = false;
  private _connectedCentralCount = 0;

  // Callbacks
  private onStateChange: StateCallback | null = null;
  private onAdvertisingStarted: AdvertisingCallback | null = null;
  private onAdvertisingStopped: (() => void) | null = null;
  private onCentralConnected: CentralConnectedCallback | null = null;
  private onCentralDisconnected: CentralDisconnectedCallback | null = null;
  private onSyncRequest: SyncRequestCallback | null = null;
  private onTimingEvent: TimingEventCallback | null = null;
  private onError: ErrorCallback | null = null;

  constructor() {
    // Only available on iOS
    if (Platform.OS === 'ios') {
      this.nativeModule = NativeModules.BLEPeripheralManager;

      if (this.nativeModule) {
        this.eventEmitter = new NativeEventEmitter(NativeModules.BLEPeripheralManager);
        this.setupEventListeners();
      }
    }
  }

  /**
   * Check if peripheral mode is available
   */
  get isAvailable(): boolean {
    return this.nativeModule !== null;
  }

  /**
   * Check if currently advertising
   */
  get isAdvertising(): boolean {
    return this._isAdvertising;
  }

  /**
   * Get connected central count
   */
  get connectedCentralCount(): number {
    return this._connectedCentralCount;
  }

  /**
   * Setup native event listeners
   */
  private setupEventListeners(): void {
    if (!this.eventEmitter) return;

    this.subscriptions.push(
      this.eventEmitter.addListener('onStateChanged', (event: StateChangedEvent) => {
        this.onStateChange?.(event.state as BLEPeripheralState['state']);
      })
    );

    this.subscriptions.push(
      this.eventEmitter.addListener('onAdvertisingStarted', (event: AdvertisingStartedEvent) => {
        this._isAdvertising = true;
        this.onAdvertisingStarted?.(event.deviceName);
      })
    );

    this.subscriptions.push(
      this.eventEmitter.addListener('onAdvertisingStopped', () => {
        this._isAdvertising = false;
        this.onAdvertisingStopped?.();
      })
    );

    this.subscriptions.push(
      this.eventEmitter.addListener('onCentralConnected', (event: CentralConnectedEvent) => {
        this._connectedCentralCount++;
        this.onCentralConnected?.(event.centralId);
      })
    );

    this.subscriptions.push(
      this.eventEmitter.addListener('onCentralDisconnected', (event: CentralDisconnectedEvent) => {
        this._connectedCentralCount = Math.max(0, this._connectedCentralCount - 1);
        this.onCentralDisconnected?.(event.centralId);
      })
    );

    this.subscriptions.push(
      this.eventEmitter.addListener('onSyncRequest', (event: SyncRequestEvent) => {
        this.onSyncRequest?.(event);
      })
    );

    this.subscriptions.push(
      this.eventEmitter.addListener('onTimingEvent', (event: TimingEventReceived) => {
        this.onTimingEvent?.(event);
      })
    );

    this.subscriptions.push(
      this.eventEmitter.addListener('onError', (event: ErrorEvent) => {
        this.onError?.(event.message);
      })
    );
  }

  /**
   * Initialize the BLE peripheral
   */
  async initialize(options: BLEPeripheralOptions = {}): Promise<boolean> {
    if (!this.nativeModule) {
      console.warn('[BLEPeripheral] Not available on this platform');
      return false;
    }

    try {
      await this.nativeModule.initialize(options);
      this.isInitialized = true;
      console.log('[BLEPeripheral] Initialized');
      return true;
    } catch (error) {
      console.error('[BLEPeripheral] Initialize failed:', error);
      return false;
    }
  }

  /**
   * Start advertising as a BLE peripheral
   */
  async startAdvertising(): Promise<boolean> {
    if (!this.nativeModule) return false;

    if (!this.isInitialized) {
      console.warn('[BLEPeripheral] Not initialized');
      return false;
    }

    try {
      const result = await this.nativeModule.startAdvertising();
      this._isAdvertising = result.success;
      console.log('[BLEPeripheral] Started advertising:', result.deviceName);
      return result.success;
    } catch (error) {
      console.error('[BLEPeripheral] Start advertising failed:', error);
      return false;
    }
  }

  /**
   * Stop advertising
   */
  async stopAdvertising(): Promise<void> {
    if (!this.nativeModule) return;

    try {
      await this.nativeModule.stopAdvertising();
      this._isAdvertising = false;
      console.log('[BLEPeripheral] Stopped advertising');
    } catch (error) {
      console.error('[BLEPeripheral] Stop advertising failed:', error);
    }
  }

  /**
   * Send sync response to a connected central
   */
  async sendSyncResponse(t1: number, t2: number, sequenceNumber: number): Promise<void> {
    if (!this.nativeModule) return;

    const t3 = performance.now();

    const response: SyncResponse = {
      type: 'sync_response',
      t1,
      t2,
      t3,
      sequenceNumber,
    };

    try {
      await this.nativeModule.sendSyncResponse(response);
    } catch (error) {
      console.error('[BLEPeripheral] Send sync response failed:', error);
    }
  }

  /**
   * Broadcast timing event to all connected centrals
   */
  async broadcastTimingEvent(event: TimingEvent): Promise<void> {
    if (!this.nativeModule) return;

    try {
      await this.nativeModule.broadcastTimingEvent(event);
    } catch (error) {
      console.error('[BLEPeripheral] Broadcast timing event failed:', error);
    }
  }

  /**
   * Get current state
   */
  async getState(): Promise<BLEPeripheralState | null> {
    if (!this.nativeModule) return null;

    try {
      return await this.nativeModule.getState();
    } catch (error) {
      console.error('[BLEPeripheral] Get state failed:', error);
      return null;
    }
  }

  /**
   * Set callbacks
   */
  setOnStateChange(callback: StateCallback | null): void {
    this.onStateChange = callback;
  }

  setOnAdvertisingStarted(callback: AdvertisingCallback | null): void {
    this.onAdvertisingStarted = callback;
  }

  setOnAdvertisingStopped(callback: (() => void) | null): void {
    this.onAdvertisingStopped = callback;
  }

  setOnCentralConnected(callback: CentralConnectedCallback | null): void {
    this.onCentralConnected = callback;
  }

  setOnCentralDisconnected(callback: CentralDisconnectedCallback | null): void {
    this.onCentralDisconnected = callback;
  }

  setOnSyncRequest(callback: SyncRequestCallback | null): void {
    this.onSyncRequest = callback;
  }

  setOnTimingEvent(callback: TimingEventCallback | null): void {
    this.onTimingEvent = callback;
  }

  setOnError(callback: ErrorCallback | null): void {
    this.onError = callback;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Remove all event subscriptions
    for (const subscription of this.subscriptions) {
      subscription.remove();
    }
    this.subscriptions = [];

    if (this.nativeModule) {
      try {
        await this.nativeModule.cleanup();
      } catch (error) {
        console.error('[BLEPeripheral] Cleanup failed:', error);
      }
    }

    this.isInitialized = false;
    this._isAdvertising = false;
    this._connectedCentralCount = 0;
  }
}

// Singleton instance
let blePeripheralInstance: BLEPeripheral | null = null;

export function getBLEPeripheral(): BLEPeripheral {
  if (!blePeripheralInstance) {
    blePeripheralInstance = new BLEPeripheral();
  }
  return blePeripheralInstance;
}
