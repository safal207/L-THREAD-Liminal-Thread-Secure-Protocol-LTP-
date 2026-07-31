const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const KNOWN_OPCODES = new Set(["handshake", "message", "ack", "resume", "migrate"]);

export type WireReason =
  | "ACCEPTED"
  | "EMPTY_FRAME"
  | "OVERSIZED_FRAME"
  | "INVALID_UTF8"
  | "INVALID_JSON"
  | "INVALID_ENVELOPE"
  | "UNKNOWN_OPCODE"
  | "INVALID_VERSION"
  | "INVALID_HASH"
  | "INVALID_NONCE";

export interface WireVerdict {
  ok: boolean;
  reason_code: WireReason;
  state_mutation_allowed: boolean;
}

function reject(reason_code: Exclude<WireReason, "ACCEPTED">): WireVerdict {
  return { ok: false, reason_code, state_mutation_allowed: false };
}

export function validateWireFrame(frame: Uint8Array, maxBytes = 64 * 1024): WireVerdict {
  if (frame.byteLength === 0) return reject("EMPTY_FRAME");
  if (frame.byteLength > maxBytes) return reject("OVERSIZED_FRAME");

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(frame);
  } catch {
    return reject("INVALID_UTF8");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return reject("INVALID_JSON");
  }

  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    return reject("INVALID_ENVELOPE");
  }

  const envelope = decoded as Record<string, unknown>;
  if (typeof envelope.opcode !== "string" || !KNOWN_OPCODES.has(envelope.opcode)) {
    return reject("UNKNOWN_OPCODE");
  }
  if (typeof envelope.protocol_version !== "string" || !VERSION_PATTERN.test(envelope.protocol_version)) {
    return reject("INVALID_VERSION");
  }
  if (typeof envelope.previous_hash !== "string" || !HASH_PATTERN.test(envelope.previous_hash)) {
    return reject("INVALID_HASH");
  }
  if (typeof envelope.nonce !== "string" || envelope.nonce.length < 8 || envelope.nonce.length > 128) {
    return reject("INVALID_NONCE");
  }
  if (!("payload" in envelope)) return reject("INVALID_ENVELOPE");

  return { ok: true, reason_code: "ACCEPTED", state_mutation_allowed: true };
}

export function encodeWireEnvelope(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
