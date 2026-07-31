import { describe, expect, it } from "vitest";
import {
  CAPACITY_REASON_CODES,
  CapacityController,
  resolveCapacityLimits,
} from "./limits";

describe("WP4 capacity controller", () => {
  it("rejects invalid or internally inconsistent limits", () => {
    expect(() => resolveCapacityLimits({ maxFrameBytes: 0 })).toThrow(/maxFrameBytes/);
    expect(() => resolveCapacityLimits({
      maxFrameBytes: 1024,
      maxPendingSendBytes: 512,
    })).toThrow(/maxPendingSendBytes/);
  });

  it("fails closed at frame, session and pending-send boundaries", () => {
    const controller = new CapacityController({
      maxFrameBytes: 128,
      maxPendingSendBytes: 256,
      maxConcurrentSessions: 2,
    });
    expect(controller.frameReason(128)).toBeNull();
    expect(controller.frameReason(129)).toBe(CAPACITY_REASON_CODES.frameTooLarge);
    expect(controller.newSessionReason(1)).toBeNull();
    expect(controller.newSessionReason(2)).toBe(CAPACITY_REASON_CODES.sessionCapacity);
    expect(controller.pendingSendReason(100, 156)).toBeNull();
    expect(controller.pendingSendReason(100, 157)).toBe(CAPACITY_REASON_CODES.backpressure);
  });

  it("bounds reconnect bursts with a stable reason code", () => {
    let now = 1_000;
    const controller = new CapacityController({
      maxReconnectsPerWindow: 2,
      reconnectWindowMs: 100,
    }, () => now);

    expect(controller.reconnectReason("client-a")).toBeNull();
    expect(controller.reconnectReason("client-a")).toBeNull();
    expect(controller.reconnectReason("client-a")).toBe(CAPACITY_REASON_CODES.reconnectRate);
    now += 101;
    expect(controller.reconnectReason("client-a")).toBeNull();
  });

  it("keeps replay protection bounded without evicting still-valid nonces", () => {
    let now = 10_000;
    const controller = new CapacityController({
      maxSeenNoncesPerSession: 2,
    }, () => now, 1_000);
    const entries: Array<{ nonce: string; timestamp: number }> = [];
    const seen = new Set<string>();

    expect(controller.trackNonceReason("a", 9_500, entries, seen)).toBeNull();
    expect(controller.trackNonceReason("b", 9_600, entries, seen)).toBeNull();
    expect(controller.trackNonceReason("a", 9_700, entries, seen)).toBe("REPLAYED_NONCE");
    expect(controller.trackNonceReason("c", 9_700, entries, seen)).toBe(CAPACITY_REASON_CODES.nonceCache);

    now = 10_601;
    expect(controller.trackNonceReason("c", 10_601, entries, seen)).toBeNull();
    expect([...seen]).toEqual(["c"]);
  });

  it("retains bounded evidence and reports dropped-record count", () => {
    const controller = new CapacityController({ maxEvidenceRecords: 2 });
    const evidence: number[] = [];
    controller.recordBounded(evidence, 1);
    controller.recordBounded(evidence, 2);
    controller.recordBounded(evidence, 3);
    expect(evidence).toEqual([2, 3]);
    expect(controller.snapshot({
      activeSessions: 1,
      routeEntries: 1,
      nonceEntries: 2,
      evidenceRecords: evidence.length,
    })).toMatchObject({
      evidenceRecords: 2,
      droppedEvidenceRecords: 1,
    });
  });
});
