declare module 'react-native-zeroconf' {
  export interface Service {
    name: string;
    fullName: string;
    host: string;
    port: number;
    txt: Record<string, string>;
    addresses: string[];
  }

  export default class Zeroconf {
    constructor();

    /**
     * Scan for services of a given type
     */
    scan(type?: string, protocol?: string, domain?: string): void;

    /**
     * Stop scanning
     */
    stop(): void;

    /**
     * Publish a service
     */
    publishService(
      type: string,
      protocol: string,
      domain: string,
      name: string,
      port: number,
      txt?: Record<string, string>
    ): Promise<void>;

    /**
     * Unpublish a service
     */
    unpublishService(name: string): Promise<void>;

    /**
     * Get list of resolved services
     */
    getServices(): Record<string, Service>;

    /**
     * Add listener for events
     */
    on(event: 'start' | 'stop' | 'found' | 'resolved' | 'remove' | 'update' | 'error', callback: (data?: any) => void): void;

    /**
     * Remove listener
     */
    removeListener(event: string, callback: (data?: any) => void): void;

    /**
     * Remove all listeners for an event
     */
    removeAllListeners(event?: string): void;

    /**
     * Remove device listeners (cleanup)
     */
    removeDeviceListeners(): void;

    /**
     * Add device listeners
     */
    addDeviceListeners(): void;
  }
}
