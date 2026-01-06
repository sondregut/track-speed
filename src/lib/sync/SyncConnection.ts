/**
 * SyncConnection - Manages WebSocket connections for multi-device sync
 *
 * Handles:
 * - WebSocket server (when this device is master)
 * - WebSocket client (when connecting to master)
 * - Time sync messaging
 * - Timing event broadcast
 */

import { TimeSync, SyncMessage, SyncResult } from './TimeSync';
import { DiscoveredDevice } from './DeviceDiscovery';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'synced' | 'error';
export type DeviceRole = 'start' | 'finish' | 'lap';

export interface TimingEvent {
  type: 'start' | 'stop' | 'split' | 'reset';
  timestamp: number; // Synced timestamp
  deviceId: string;
  deviceRole: DeviceRole;
  gateDistance_m?: number; // Distance marker for this gate
  data?: {
    time_ms?: number;
    frameNumber?: number;
    confidence?: number;
  };
}

export interface SyncConnectionConfig {
  port: number;
  syncInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

type StateCallback = (state: ConnectionState) => void;
type TimingEventCallback = (event: TimingEvent) => void;
type SyncUpdateCallback = (result: SyncResult) => void;
type ErrorCallback = (error: Error) => void;

export class SyncConnection {
  private config: SyncConnectionConfig;
  private timeSync: TimeSync;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private deviceRole: DeviceRole = 'finish';
  private deviceName: string = '';
  private gateDistance_m?: number; // Distance marker for this device's gate
  private connectedDevice: DiscoveredDevice | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts: number = 0;
  private sequenceNumber: number = 0;

  // Callbacks
  private onStateChange: StateCallback | null = null;
  private onTimingEvent: TimingEventCallback | null = null;
  private onSyncUpdate: SyncUpdateCallback | null = null;
  private onError: ErrorCallback | null = null;

  constructor(config: Partial<SyncConnectionConfig> = {}) {
    this.config = {
      port: 5678,
      syncInterval: 5000,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      ...config,
    };

    this.timeSync = new TimeSync();
  }

  /**
   * Set callbacks
   */
  onStateChanged(callback: StateCallback): void {
    this.onStateChange = callback;
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
   * Update connection state
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.onStateChange?.(state);
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
   * Get connected device info
   */
  getConnectedDevice(): DiscoveredDevice | null {
    return this.connectedDevice;
  }

  /**
   * Set gate distance for this device
   */
  setGateDistance(distance: number): void {
    this.gateDistance_m = distance;
  }

  /**
   * Get gate distance
   */
  getGateDistance(): number | undefined {
    return this.gateDistance_m;
  }

  /**
   * Connect to a device (as client)
   */
  async connect(device: DiscoveredDevice, myRole: DeviceRole, myName: string, gateDistance?: number): Promise<void> {
    if (this.state === 'connected' || this.state === 'syncing' || this.state === 'synced') {
      await this.disconnect();
    }

    this.deviceRole = myRole;
    this.deviceName = myName;
    this.gateDistance_m = gateDistance;
    this.connectedDevice = device;
    this.setState('connecting');

    try {
      const wsUrl = `ws://${device.address}:${device.port}`;
      console.log('SyncConnection: Connecting to', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('SyncConnection: Connected');
        this.setState('connected');
        this.reconnectAttempts = 0;

        // Send handshake
        this.send({
          type: 'handshake',
          deviceId: this.timeSync.getLocalId(),
          deviceName: this.deviceName,
          deviceRole: this.deviceRole,
        });

        // Start time sync
        this.startSync();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('SyncConnection: Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('SyncConnection: Disconnected');
        this.handleDisconnect();
      };

      this.ws.onerror = (error) => {
        console.error('SyncConnection: WebSocket error:', error);
        this.onError?.(new Error('WebSocket connection failed'));
      };
    } catch (error) {
      console.error('SyncConnection: Failed to connect:', error);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<void> {
    this.stopSync();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectedDevice = null;
    this.setState('disconnected');
    this.timeSync.reset();
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: any): void {
    // Check for timing events which use messageType
    if (message.messageType === 'timing_event') {
      const { messageType, ...timingEvent } = message;
      this.onTimingEvent?.(timingEvent as TimingEvent);
      return;
    }

    switch (message.type) {
      case 'handshake':
        console.log('SyncConnection: Received handshake from', message.deviceName);
        // Add as peer for time sync
        this.timeSync.addPeer({
          id: message.deviceId,
          name: message.deviceName,
          address: this.connectedDevice?.address || '',
          port: this.connectedDevice?.port || 0,
        });
        break;

      case 'sync_request':
        // Master receives sync request, sends response
        const response = this.timeSync.processRequest(message as SyncMessage);
        this.send(response);
        break;

      case 'sync_response':
        // Client receives sync response
        const t4 = performance.now();
        const result = this.timeSync.processResponse(message as SyncMessage, t4);
        if (result) {
          this.onSyncUpdate?.(result);

          // Update state based on sync quality
          if (this.timeSync.isSyncAccurate()) {
            this.setState('synced');
          } else {
            this.setState('syncing');
          }
        }
        break;

      case 'ping':
        this.send({ type: 'pong', timestamp: performance.now() });
        break;

      default:
        console.log('SyncConnection: Unknown message type:', message.type);
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.stopSync();

    if (this.reconnectAttempts < this.config.maxReconnectAttempts && this.connectedDevice) {
      this.setState('connecting');
      this.reconnectAttempts++;

      console.log(`SyncConnection: Reconnecting (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        if (this.connectedDevice) {
          this.connect(this.connectedDevice, this.deviceRole, this.deviceName);
        }
      }, this.config.reconnectInterval);
    } else {
      this.setState('disconnected');
      this.connectedDevice = null;
    }
  }

  /**
   * Start time sync loop
   */
  private startSync(): void {
    this.stopSync();

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
   * Send sync request
   */
  private sendSyncRequest(): void {
    const request = this.timeSync.createSyncRequest(this.sequenceNumber++);
    this.send({ ...request, type: 'sync_request' });
  }

  /**
   * Send message to connected device
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast timing event to connected device
   */
  broadcastTimingEvent(event: Omit<TimingEvent, 'deviceId' | 'deviceRole' | 'timestamp' | 'gateDistance_m'>): void {
    const fullEvent: TimingEvent = {
      ...event,
      deviceId: this.timeSync.getLocalId(),
      deviceRole: this.deviceRole,
      gateDistance_m: this.gateDistance_m,
      timestamp: this.timeSync.getSyncedTime(),
    };

    this.send({ messageType: 'timing_event', ...fullEvent });
  }

  /**
   * Send start signal
   */
  sendStart(): void {
    this.broadcastTimingEvent({ type: 'start' });
  }

  /**
   * Send stop signal with time
   */
  sendStop(time_ms: number, frameNumber?: number, confidence?: number): void {
    this.broadcastTimingEvent({
      type: 'stop',
      data: { time_ms, frameNumber, confidence },
    });
  }

  /**
   * Send split time
   */
  sendSplit(time_ms: number): void {
    this.broadcastTimingEvent({
      type: 'split',
      data: { time_ms },
    });
  }

  /**
   * Send reset signal
   */
  sendReset(): void {
    this.broadcastTimingEvent({ type: 'reset' });
  }

  /**
   * Check if synced and ready
   */
  isReady(): boolean {
    return this.state === 'synced';
  }

  /**
   * Get sync accuracy in ms
   */
  getSyncAccuracy(): number {
    return this.timeSync.getAccuracy();
  }
}

// Singleton instance
let syncConnectionInstance: SyncConnection | null = null;

export function getSyncConnection(config?: Partial<SyncConnectionConfig>): SyncConnection {
  if (!syncConnectionInstance) {
    syncConnectionInstance = new SyncConnection(config);
  }
  return syncConnectionInstance;
}
