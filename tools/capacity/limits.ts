export const CAPACITY_REASON_CODES = {
  frameTooLarge: "FRAME_TOO_LARGE",
  sessionCapacity: "SESSION_CAPACITY_LIMIT",
  nonceCache: "NONCE_CACHE_LIMIT",
  backpressure: "BACKPRESSURE_LIMIT",
  reconnectRate: "RECONNECT_RATE_LIMIT",
} as const;

export type CapacityReasonCode = typeof CAPACITY_REASON_CODES[keyof typeof CAPACITY_REASON_CODES];

export interface CapacityLimits {
  maxFrameBytes: number;
  maxConcurrentSessions: number;
  maxSeenNoncesPerSession: number;
  maxEvidenceRecords: number;
  maxPendingSendBytes: number;
  maxReconnectsPerWindow: number;
  reconnectWindowMs: number;
  maxSessionIdleMs: number;
}

export interface NonceEntry {
  nonce: string;
  timestamp: number;
}

export interface CapacitySnapshot {
  limits: CapacityLimits;
  activeSessions: number;
  routeEntries: number;
  nonceEntries: number;
  evidenceRecords: number;
  droppedEvidenceRecords: number;
  reconnectBuckets: number;
}

export const DEFAULT_CAPACITY_LIMITS: CapacityLimits = Object.freeze({
  maxFrameBytes: 512 * 1024,
  maxConcurrentSessions: 256,
  maxSeenNoncesPerSession: 4_096,
  maxEvidenceRecords: 50_000,
  maxPendingSendBytes: 1 * 1024 * 1024,
  maxReconnectsPerWindow: 8,
  reconnectWindowMs: 10_000,
  maxSessionIdleMs: 5 * 60_000,
});

const POSITIVE_INTEGER_FIELDS: Array<keyof CapacityLimits> = [
  "maxFrameBytes",
  "maxConcurrentSessions",
  "maxSeenNoncesPerSession",
  "maxEvidenceRecords",
  "maxPendingSendBytes",
  "maxReconnectsPerWindow",
  "reconnectWindowMs",
  "maxSessionIdleMs",
];

export function resolveCapacityLimits(
  overrides: Partial<CapacityLimits> = {},
): CapacityLimits {
  const limits: CapacityLimits = { ...DEFAULT_CAPACITY_LIMITS, ...overrides };
  for (const field of POSITIVE_INTEGER_FIELDS) {
    const value = limits[field];
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`invalid capacity limit ${field}: ${String(value)}`);
    }
  }
  if (limits.maxPendingSendBytes < limits.maxFrameBytes) {
    throw new Error("maxPendingSendBytes must be greater than or equal to maxFrameBytes");
  }
  return Object.freeze(limits);
}

export class CapacityController {
  readonly limits: CapacityLimits;
  private readonly reconnectHistory = new Map<string, number[]>();
  private droppedEvidenceRecords = 0;

  constructor(
    overrides: Partial<CapacityLimits> = {},
    private readonly clock: () => number = Date.now,
    private readonly replayWindowMs = 60_000,
  ) {
    this.limits = resolveCapacityLimits(overrides);
    if (!Number.isSafeInteger(replayWindowMs) || replayWindowMs <= 0) {
      throw new Error(`invalid replayWindowMs: ${replayWindowMs}`);
    }
  }

  frameReason(byteLength: number): CapacityReasonCode | null {
    return byteLength > this.limits.maxFrameBytes
      ? CAPACITY_REASON_CODES.frameTooLarge
      : null;
  }

  newSessionReason(currentSessions: number): CapacityReasonCode | null {
    return currentSessions >= this.limits.maxConcurrentSessions
      ? CAPACITY_REASON_CODES.sessionCapacity
      : null;
  }

  reconnectReason(clientId: string): CapacityReasonCode | null {
    const now = this.clock();
    const threshold = now - this.limits.reconnectWindowMs;
    const existing = this.reconnectHistory.get(clientId) ?? [];
    const retained = existing.filter((timestamp) => timestamp > threshold);
    if (retained.length >= this.limits.maxReconnectsPerWindow) {
      this.reconnectHistory.set(clientId, retained);
      return CAPACITY_REASON_CODES.reconnectRate;
    }
    retained.push(now);
    this.reconnectHistory.set(clientId, retained);
    return null;
  }

  pendingSendReason(bufferedBytes: number, frameBytes: number): CapacityReasonCode | null {
    if (bufferedBytes < 0 || frameBytes < 0) {
      throw new Error("bufferedBytes and frameBytes must be non-negative");
    }
    return bufferedBytes + frameBytes > this.limits.maxPendingSendBytes
      ? CAPACITY_REASON_CODES.backpressure
      : null;
  }

  pruneNonceCache(entries: NonceEntry[], seen: Set<string>): number {
    const threshold = this.clock() - this.replayWindowMs;
    let removed = 0;
    while (entries.length > 0 && entries[0].timestamp < threshold) {
      const entry = entries.shift()!;
      seen.delete(entry.nonce);
      removed += 1;
    }
    return removed;
  }

  trackNonceReason(
    nonce: string,
    timestamp: number,
    entries: NonceEntry[],
    seen: Set<string>,
  ): "REPLAYED_NONCE" | CapacityReasonCode | null {
    this.pruneNonceCache(entries, seen);
    if (seen.has(nonce)) {
      return "REPLAYED_NONCE";
    }
    if (seen.size >= this.limits.maxSeenNoncesPerSession) {
      return CAPACITY_REASON_CODES.nonceCache;
    }
    seen.add(nonce);
    entries.push({ nonce, timestamp });
    return null;
  }

  recordBounded<T>(records: T[], record: T): void {
    if (records.length >= this.limits.maxEvidenceRecords) {
      records.shift();
      this.droppedEvidenceRecords += 1;
    }
    records.push(record);
  }

  cleanupReconnectBuckets(): void {
    const threshold = this.clock() - this.limits.reconnectWindowMs;
    for (const [clientId, timestamps] of this.reconnectHistory.entries()) {
      const retained = timestamps.filter((timestamp) => timestamp > threshold);
      if (retained.length === 0) {
        this.reconnectHistory.delete(clientId);
      } else {
        this.reconnectHistory.set(clientId, retained);
      }
    }
  }

  snapshot(input: {
    activeSessions: number;
    routeEntries: number;
    nonceEntries: number;
    evidenceRecords: number;
  }): CapacitySnapshot {
    this.cleanupReconnectBuckets();
    return {
      limits: { ...this.limits },
      activeSessions: input.activeSessions,
      routeEntries: input.routeEntries,
      nonceEntries: input.nonceEntries,
      evidenceRecords: input.evidenceRecords,
      droppedEvidenceRecords: this.droppedEvidenceRecords,
      reconnectBuckets: this.reconnectHistory.size,
    };
  }
}
