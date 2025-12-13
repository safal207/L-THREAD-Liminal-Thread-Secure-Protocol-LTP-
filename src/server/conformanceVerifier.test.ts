import { describe, expect, it } from "vitest";
import { verifyConformance } from "./conformanceVerifier";

const helloFrame = {
  v: "0.1",
  id: "a",
  ts: 1,
  type: "hello" as const,
  payload: { role: "client", message: "hi" },
};

const heartbeatFrame = {
  v: "0.1",
  id: "b",
  ts: 2,
  type: "heartbeat" as const,
  payload: { seq: 1 },
};

describe("verifyConformance", () => {
  it("fails when first frame is not hello", () => {
    const result = verifyConformance([
      { ...heartbeatFrame, id: "x", ts: 10 },
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.some((msg) => msg.includes("hello"))).toBe(true);
  });

  it("warns on unknown frame type but remains ok", () => {
    const result = verifyConformance([
      helloFrame,
      { ...heartbeatFrame, type: "mystery", id: "m", ts: 3 },
    ]);

    expect(result.ok).toBe(true);
    expect(result.warnings.some((msg) => msg.includes("unknown type"))).toBe(true);
  });

  it("fails for unsupported protocol version", () => {
    const result = verifyConformance([
      { ...helloFrame, v: "0.2" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.some((msg) => msg.includes("unsupported version"))).toBe(true);
  });

  it("flags duplicate ids per sender as warnings", () => {
    const result = verifyConformance([
      helloFrame,
      { ...heartbeatFrame, id: "dup", from: "alice" },
      { ...heartbeatFrame, id: "dup", from: "alice", ts: 3 },
    ]);

    expect(result.ok).toBe(true);
    expect(result.warnings.some((msg) => msg.includes("duplicate frame id"))).toBe(true);
  });
});
