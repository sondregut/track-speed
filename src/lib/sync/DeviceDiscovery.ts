/**
 * DeviceDiscovery - Find other Track Speed devices on local network
 *
 * Uses mDNS/Bonjour via react-native-zeroconf for device discovery.
 * Requires development build (not Expo Go).
 */

import Zeroconf from 'react-native-zeroconf';
import { Platform } from 'react-native';

export interface DiscoveredDevice {
  id: string;
  name: string;
  address: string;
  port: number;
  role: 'start' | 'finish' | 'lap';
  distance?: number; // Distance marker in meters
  discoveredAt: number;
}

export interface DiscoveryConfig {
  serviceName: string;
  serviceType: string;
  domain: string;
  port: number;
  scanTimeout: number;
}

type DiscoveryCallback = (device: DiscoveredDevice) => void;
type LostCallback = (deviceId: string) => void;
type ErrorCallback = (error: Error) => void;

export class DeviceDiscovery {
  private config: DiscoveryConfig;
  private zeroconf: Zeroconf;
  private devices: Map<string, DiscoveredDevice> = new Map();
  private isScanning: boolean = false;
  private isPublishing: boolean = false;
  private onDeviceFound: DiscoveryCallback | null = null;
  private onDeviceLost: LostCallback | null = null;
  private onError: ErrorCallback | null = null;
  private localDevice: DiscoveredDevice | null = null;
  private deviceRole: DiscoveredDevice['role'] = 'finish';
  private deviceDistance?: number;

  constructor(config: Partial<DiscoveryConfig> = {}) {
    this.config = {
      serviceName: 'TrackSpeed',
      serviceType: '_trackspeed._tcp.',
      domain: 'local.',
      port: 5678,
      scanTimeout: 30000,
      ...config,
    };

    this.zeroconf = new Zeroconf();
    this.setupListeners();
  }

  /**
   * Setup Zeroconf event listeners
   */
  private setupListeners(): void {
    this.zeroconf.on('resolved', (service: any) => {
      console.log('DeviceDiscovery: Service resolved:', service);

      // Parse TXT record for role and distance
      const txtRecord = service.txt || {};
      const role = (txtRecord.role as DiscoveredDevice['role']) || 'finish';
      const distance = txtRecord.distance ? parseInt(txtRecord.distance, 10) : undefined;

      const device: DiscoveredDevice = {
        id: service.name,
        name: service.name,
        address: service.addresses?.[0] || service.host,
        port: service.port,
        role,
        distance,
        discoveredAt: Date.now(),
      };

      // Don't add our own device
      if (this.localDevice && device.id === this.localDevice.id) {
        return;
      }

      this.addDevice(device);
    });

    this.zeroconf.on('remove', (service: any) => {
      console.log('DeviceDiscovery: Service removed:', service);
      this.removeDevice(service.name);
    });

    this.zeroconf.on('error', (error: any) => {
      console.error('DeviceDiscovery: Error:', error);
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    });

    this.zeroconf.on('start', () => {
      console.log('DeviceDiscovery: Scan started');
    });

    this.zeroconf.on('stop', () => {
      console.log('DeviceDiscovery: Scan stopped');
      this.isScanning = false;
    });

    this.zeroconf.on('update', () => {
      console.log('DeviceDiscovery: Services updated');
    });
  }

  /**
   * Set callback for when a device is found
   */
  onFound(callback: DiscoveryCallback): void {
    this.onDeviceFound = callback;
  }

  /**
   * Set callback for when a device is lost
   */
  onLost(callback: LostCallback): void {
    this.onDeviceLost = callback;
  }

  /**
   * Set error callback
   */
  onErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Register this device for discovery (publish mDNS service)
   */
  async register(
    name: string,
    role: DiscoveredDevice['role'],
    distance?: number
  ): Promise<DiscoveredDevice> {
    this.deviceRole = role;
    this.deviceDistance = distance;

    try {
      // Publish service with TXT records for role and distance
      const txtRecord: Record<string, string> = {
        role,
        version: '1.0',
      };

      if (distance !== undefined) {
        txtRecord.distance = String(distance);
      }

      await this.zeroconf.publishService(
        this.config.serviceType,
        Platform.OS === 'ios' ? 'tcp' : 'tcp',
        this.config.domain,
        name,
        this.config.port,
        txtRecord
      );

      this.isPublishing = true;

      this.localDevice = {
        id: name,
        name,
        address: '0.0.0.0', // Will be resolved by other devices
        port: this.config.port,
        role,
        distance,
        discoveredAt: Date.now(),
      };

      console.log('DeviceDiscovery: Published service:', this.localDevice);
      return this.localDevice;
    } catch (error) {
      console.error('DeviceDiscovery: Failed to publish service:', error);
      throw error;
    }
  }

  /**
   * Unregister this device (unpublish mDNS service)
   */
  async unregister(): Promise<void> {
    try {
      if (this.isPublishing) {
        await this.zeroconf.unpublishService(this.localDevice?.name || '');
        this.isPublishing = false;
      }
      this.localDevice = null;
      console.log('DeviceDiscovery: Unpublished service');
    } catch (error) {
      console.error('DeviceDiscovery: Failed to unpublish service:', error);
    }
  }

  /**
   * Start scanning for devices
   */
  async startScan(): Promise<void> {
    if (this.isScanning) return;

    this.isScanning = true;
    console.log('DeviceDiscovery: Starting scan for', this.config.serviceType);

    try {
      this.zeroconf.scan(this.config.serviceType, 'tcp', this.config.domain);

      // Auto-stop after timeout
      setTimeout(() => {
        if (this.isScanning) {
          this.stopScan();
        }
      }, this.config.scanTimeout);
    } catch (error) {
      this.isScanning = false;
      console.error('DeviceDiscovery: Failed to start scan:', error);
      throw error;
    }
  }

  /**
   * Stop scanning for devices
   */
  stopScan(): void {
    if (!this.isScanning) return;

    this.zeroconf.stop();
    this.isScanning = false;
    console.log('DeviceDiscovery: Stopped scan');
  }

  /**
   * Add a discovered device
   */
  private addDevice(device: DiscoveredDevice): void {
    const existing = this.devices.get(device.id);

    // Update if exists, otherwise add
    this.devices.set(device.id, device);

    if (!existing) {
      this.onDeviceFound?.(device);
      console.log('DeviceDiscovery: Found new device:', device);
    }
  }

  /**
   * Remove a lost device
   */
  private removeDevice(deviceId: string): void {
    if (!this.devices.has(deviceId)) return;

    this.devices.delete(deviceId);
    this.onDeviceLost?.(deviceId);
    console.log('DeviceDiscovery: Lost device:', deviceId);
  }

  /**
   * Get all discovered devices
   */
  getDevices(): DiscoveredDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by ID
   */
  getDevice(id: string): DiscoveredDevice | undefined {
    return this.devices.get(id);
  }

  /**
   * Get local device info
   */
  getLocalDevice(): DiscoveredDevice | null {
    return this.localDevice;
  }

  /**
   * Check if scanning
   */
  getIsScanning(): boolean {
    return this.isScanning;
  }

  /**
   * Check if publishing
   */
  getIsPublishing(): boolean {
    return this.isPublishing;
  }

  /**
   * Clear all discovered devices
   */
  clear(): void {
    this.devices.clear();
  }

  /**
   * Cleanup - stop scanning and unpublish
   */
  async cleanup(): Promise<void> {
    this.stopScan();
    await this.unregister();
    this.clear();
  }
}

// Singleton instance
let discoveryInstance: DeviceDiscovery | null = null;

export function getDeviceDiscovery(
  config?: Partial<DiscoveryConfig>
): DeviceDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new DeviceDiscovery(config);
  }
  return discoveryInstance;
}
