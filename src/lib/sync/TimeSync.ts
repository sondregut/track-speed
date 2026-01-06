/**
 * TimeSync - NTP-style time synchronization between devices
 *
 * For multi-phone timing setups, all devices need synchronized clocks.
 * This implements a simplified NTP algorithm to achieve <5ms sync accuracy
 * over local WiFi networks.
 */

export interface SyncPeer {
  id: string;
  name: string;
  address: string;
  port: number;
  lastSeen: number;
  offset: number; // Time offset in ms
  roundTripTime: number;
  syncQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface SyncMessage {
  type: 'request' | 'response';
  t1?: number; // Client send time
  t2?: number; // Server receive time
  t3?: number; // Server send time
  t4?: number; // Client receive time
  senderId: string;
  sequence: number;
}

export interface SyncConfig {
  syncInterval: number; // How often to sync (ms)
  sampleCount: number; // Number of samples for averaging
  outlierThreshold: number; // RTT threshold for discarding samples
  targetAccuracy: number; // Target sync accuracy in ms
}

export interface SyncResult {
  offset: number; // Time offset in ms (add to local time to get reference time)
  roundTripTime: number;
  accuracy: number;
  samples: number;
}

export class TimeSync {
  private config: SyncConfig;
  private peers: Map<string, SyncPeer> = new Map();
  private localId: string;
  private isMaster: boolean = false;
  private syncResults: SyncResult[] = [];
  private currentOffset: number = 0;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      syncInterval: 5000,
      sampleCount: 8,
      outlierThreshold: 100, // Discard RTT > 100ms
      targetAccuracy: 5,
      ...config,
    };

    this.localId = this.generateId();
  }

  /**
   * Generate unique device ID
   */
  private generateId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get local device ID
   */
  getLocalId(): string {
    return this.localId;
  }

  /**
   * Set this device as the master (reference time)
   */
  setAsMaster(): void {
    this.isMaster = true;
    this.currentOffset = 0;
  }

  /**
   * Check if this device is master
   */
  getIsMaster(): boolean {
    return this.isMaster;
  }

  /**
   * Get current time offset
   */
  getOffset(): number {
    return this.currentOffset;
  }

  /**
   * Get synchronized timestamp
   * Returns local timestamp adjusted by sync offset
   */
  getSyncedTime(): number {
    return performance.now() + this.currentOffset;
  }

  /**
   * Add a peer device
   */
  addPeer(peer: Omit<SyncPeer, 'lastSeen' | 'offset' | 'roundTripTime' | 'syncQuality'>): void {
    this.peers.set(peer.id, {
      ...peer,
      lastSeen: Date.now(),
      offset: 0,
      roundTripTime: 0,
      syncQuality: 'poor',
    });
  }

  /**
   * Remove a peer
   */
  removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  /**
   * Get all peers
   */
  getPeers(): SyncPeer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Create a sync request message
   */
  createSyncRequest(sequence: number): SyncMessage {
    return {
      type: 'request',
      t1: performance.now(),
      senderId: this.localId,
      sequence,
    };
  }

  /**
   * Process a sync request and create response (for master)
   */
  processRequest(request: SyncMessage): SyncMessage {
    const t2 = performance.now();

    return {
      type: 'response',
      t1: request.t1,
      t2,
      t3: performance.now(), // Could be same as t2 for immediate response
      senderId: this.localId,
      sequence: request.sequence,
    };
  }

  /**
   * Process a sync response and calculate offset
   */
  processResponse(response: SyncMessage, t4: number): SyncResult | null {
    if (!response.t1 || !response.t2 || !response.t3) {
      return null;
    }

    // NTP offset calculation:
    // offset = ((t2 - t1) + (t3 - t4)) / 2
    // RTT = (t4 - t1) - (t3 - t2)

    const offset = ((response.t2 - response.t1) + (response.t3 - t4)) / 2;
    const roundTripTime = (t4 - response.t1) - (response.t3 - response.t2);

    // Discard outliers
    if (roundTripTime > this.config.outlierThreshold) {
      console.log(`TimeSync: Discarding sample with RTT ${roundTripTime}ms`);
      return null;
    }

    const result: SyncResult = {
      offset,
      roundTripTime,
      accuracy: roundTripTime / 2, // Best case accuracy estimate
      samples: 1,
    };

    this.syncResults.push(result);

    // Keep only recent samples
    if (this.syncResults.length > this.config.sampleCount) {
      this.syncResults.shift();
    }

    // Update current offset using median of samples
    this.updateOffset();

    // Update peer info
    const peer = this.peers.get(response.senderId);
    if (peer) {
      peer.lastSeen = Date.now();
      peer.offset = this.currentOffset;
      peer.roundTripTime = roundTripTime;
      peer.syncQuality = this.calculateQuality(roundTripTime);
    }

    return result;
  }

  /**
   * Update current offset from samples
   */
  private updateOffset(): void {
    if (this.syncResults.length === 0) return;

    // Sort by offset and take median
    const sorted = [...this.syncResults].sort((a, b) => a.offset - b.offset);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      this.currentOffset = (sorted[mid - 1].offset + sorted[mid].offset) / 2;
    } else {
      this.currentOffset = sorted[mid].offset;
    }
  }

  /**
   * Calculate sync quality based on RTT
   */
  private calculateQuality(rtt: number): SyncPeer['syncQuality'] {
    if (rtt < 10) return 'excellent';
    if (rtt < 30) return 'good';
    if (rtt < 70) return 'fair';
    return 'poor';
  }

  /**
   * Get average sync accuracy
   */
  getAccuracy(): number {
    if (this.syncResults.length === 0) return Infinity;

    const sum = this.syncResults.reduce((acc, r) => acc + r.accuracy, 0);
    return sum / this.syncResults.length;
  }

  /**
   * Check if sync is good enough for timing
   */
  isSyncAccurate(): boolean {
    return this.getAccuracy() <= this.config.targetAccuracy;
  }

  /**
   * Reset sync state
   */
  reset(): void {
    this.syncResults = [];
    this.currentOffset = 0;
    this.peers.forEach((peer) => {
      peer.offset = 0;
      peer.roundTripTime = 0;
      peer.syncQuality = 'poor';
    });
  }

  /**
   * Get sync status summary
   */
  getStatus(): {
    isMaster: boolean;
    offset: number;
    accuracy: number;
    peerCount: number;
    isAccurate: boolean;
  } {
    return {
      isMaster: this.isMaster,
      offset: this.currentOffset,
      accuracy: this.getAccuracy(),
      peerCount: this.peers.size,
      isAccurate: this.isSyncAccurate(),
    };
  }
}
