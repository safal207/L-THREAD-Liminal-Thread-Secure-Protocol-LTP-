import { describe, expect, it } from "vitest";
import { encodeWireEnvelope, validateWireFrame } from "./wire";

function validEnvelope(): Record<string, unknown> {
  return {
    opcode: "message",
    protocol_version: "0.6.0",
    previous_hash: "b".repeat(64),
    nonce: "nonce-12345678",
    payload: { ok: true },
  };
}

describe("WP6 malformed wire corpus", () => {
  it.each([
    [new Uint8Array(), "EMPTY_FRAME"],
    [new Uint8Array([0xc3, 0x28]), "INVALID_UTF8"],
    [new TextEncoder().encode('{"opcode":'), "INVALID_JSON"],
    [encodeWireEnvelope({ ...validEnvelope(), opcode: "unknown" }), "UNKNOWN_OPCODE"],
    [encodeWireEnvelope({ ...validEnvelope(), protocol_version: "vNext" }), "INVALID_VERSION"],
    [encodeWireEnvelope({ ...validEnvelope(), previous_hash: "broken" }), "INVALID_HASH"],
    [encodeWireEnvelope({ ...validEnvelope(), nonce: "x" }), "INVALID_NONCE"],
  ])("rejects malformed input without authorizing mutation", (frame, reason) => {
    const verdict = validateWireFrame(frame as Uint8Array);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason_code).toBe(reason);
    expect(verdict.state_mutation_allowed).toBe(false);
  });

  it("accepts a structurally valid authenticated envelope", () => {
    const verdict = validateWireFrame(encodeWireEnvelope(validEnvelope()));
    expect(verdict).toEqual({
      ok: true,
      reason_code: "ACCEPTED",
      state_mutation_allowed: true,
    });
  });

  it("rejects an oversized frame before decoding", () => {
    const verdict = validateWireFrame(new Uint8Array(1025), 1024);
    expect(verdict.reason_code).toBe("OVERSIZED_FRAME");
    expect(verdict.state_mutation_allowed).toBe(false);
  });
});
