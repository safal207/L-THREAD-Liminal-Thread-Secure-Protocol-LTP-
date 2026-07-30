import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHash,
  createHmac,
  timingSafeEqual,
} from "crypto";

export const REFERENCE_PROTOCOL_VERSION = "0.3";
export const REFERENCE_SUBPROTOCOL = "ltp.v0.3";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface LtpEnvelope {
  type: string;
  thread_id: string;
  session_id?: string;
  timestamp: number;
  nonce: string;
  payload: JsonValue;
  prev_message_hash?: string;
  meta?: Record<string, JsonValue>;
  content_encoding?: string;
  signature?: string;
  encrypted_metadata?: string;
  routing_tag?: string;
}

export interface HandshakeInit {
  type: "handshake_init";
  ltp_version: string;
  client_id: string;
  client_public_key?: string;
  client_ecdh_public_key?: string;
  client_ecdh_signature?: string;
  client_ecdh_timestamp?: number;
  capabilities?: string[];
  key_agreement?: Record<string, JsonValue>;
}

export interface HandshakeResume {
  type: "handshake_resume";
  ltp_version: string;
  client_id: string;
  thread_id: string;
  resume_reason?: string;
  client_public_key?: string;
  client_ecdh_public_key?: string;
  client_ecdh_signature?: string;
  client_ecdh_timestamp?: number;
  key_agreement?: Record<string, JsonValue>;
}

export interface HandshakeAck {
  type: "handshake_ack";
  ltp_version: string;
  thread_id: string;
  session_id: string;
  resumed: boolean;
  server_capabilities: string[];
  heartbeat_interval_ms: number;
  server_public_key: string;
  server_ecdh_public_key: string;
  server_ecdh_signature: string;
  server_ecdh_timestamp: number;
  key_agreement: Record<string, JsonValue>;
  metadata: Record<string, JsonValue>;
}

export interface HandshakeReject {
  type: "handshake_reject";
  ltp_version: string;
  reason: string;
  suggest_new: boolean;
  supported_versions?: string[];
}

export interface SessionKeys {
  encryptionKey: string;
  macKey: string;
  ivKey: string;
}

export interface EcdhKeyPair {
  publicKey: string;
  privateKey: string;
}

function assertCanonicalValue(value: unknown, path = "$"): void {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string") {
      for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
          const next = value.charCodeAt(index + 1);
          if (!(next >= 0xdc00 && next <= 0xdfff)) {
            throw new Error(`lone UTF-16 surrogate at ${path}`);
          }
          index += 1;
        } else if (code >= 0xdc00 && code <= 0xdfff) {
          throw new Error(`lone UTF-16 surrogate at ${path}`);
        }
      }
    }
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`non-finite number at ${path}`);
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new Error(`unsafe integer at ${path}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertCanonicalValue(entry, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, entry] of Object.entries(value)) {
      assertCanonicalValue(key, `${path}.<key>`);
      assertCanonicalValue(entry, `${path}.${key}`);
    }
    return;
  }

  throw new Error(`non-JSON value at ${path}`);
}

function canonicalize(value: unknown): unknown {
  assertCanonicalValue(value);
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

export function serializeCanonicalEnvelope(message: Pick<
  LtpEnvelope,
  "type" | "thread_id" | "session_id" | "timestamp" | "nonce" | "payload" |
  "prev_message_hash" | "meta" | "content_encoding"
>): string {
  const serialized = JSON.stringify(canonicalize({
    type: message.type,
    thread_id: message.thread_id,
    session_id: message.session_id || "",
    timestamp: message.timestamp,
    nonce: message.nonce,
    payload: message.payload,
    prev_message_hash: message.prev_message_hash || "",
    meta: message.meta || {},
    content_encoding: message.content_encoding || "",
  }));
  if (serialized === undefined) {
    throw new Error("canonical serialization produced undefined");
  }
  return serialized;
}

export function hmacSha256(input: string | Buffer, key: string | Buffer): string {
  return createHmac("sha256", key).update(input).digest("hex");
}

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function signEnvelope(message: LtpEnvelope, macKey: string): string {
  return hmacSha256(serializeCanonicalEnvelope(message), macKey);
}

export function verifyEnvelopeSignature(message: LtpEnvelope, macKey: string): boolean {
  if (!message.signature || !/^[0-9a-f]{64}$/i.test(message.signature)) {
    return false;
  }
  const expected = Buffer.from(signEnvelope(message, macKey), "hex");
  const actual = Buffer.from(message.signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashEnvelope(message: LtpEnvelope): string {
  return sha256(serializeCanonicalEnvelope({
    type: message.type,
    thread_id: message.thread_id,
    session_id: message.session_id,
    timestamp: message.timestamp,
    nonce: message.nonce,
    payload: message.payload,
    prev_message_hash: message.prev_message_hash,
    meta: {},
    content_encoding: "",
  }));
}

export function frameDigest(rawFrame: string): string {
  return sha256(rawFrame);
}

export function generateEcdhKeyPair(seed?: string): EcdhKeyPair {
  const ecdh = createECDH("prime256v1");
  if (!seed) {
    ecdh.generateKeys();
  } else {
    let accepted = false;
    for (let counter = 0; counter < 1024 && !accepted; counter += 1) {
      const candidate = createHash("sha256").update(`${seed}:${counter}`).digest();
      try {
        ecdh.setPrivateKey(candidate);
        accepted = true;
      } catch {
        // Retry until the deterministic digest is a valid P-256 scalar.
      }
    }
    if (!accepted) {
      throw new Error("unable to derive deterministic P-256 private key");
    }
  }
  return {
    publicKey: ecdh.getPublicKey("hex"),
    privateKey: ecdh.getPrivateKey("hex"),
  };
}

export function deriveSharedSecret(privateKey: string, peerPublicKey: string): string {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(privateKey, "hex"));
  return ecdh.computeSecret(Buffer.from(peerPublicKey, "hex")).toString("hex");
}

function hkdf(sharedSecret: string, salt: string, info: string, keyLength: number): string {
  const prk = createHmac("sha256", salt).update(Buffer.from(sharedSecret, "hex")).digest();
  const infoBuffer = Buffer.from(info, "utf8");
  let previous = Buffer.alloc(0);
  let output = Buffer.alloc(0);
  for (let counter = 1; output.length < keyLength; counter += 1) {
    previous = createHmac("sha256", prk)
      .update(previous)
      .update(infoBuffer)
      .update(Buffer.from([counter]))
      .digest();
    output = Buffer.concat([output, previous]);
  }
  return output.subarray(0, keyLength).toString("hex");
}

export function deriveSessionKeys(sharedSecret: string, sessionId: string): SessionKeys {
  const salt = `ltp-v0.5-${sessionId}`;
  return {
    encryptionKey: hkdf(sharedSecret, salt, "ltp-encryption-key", 32),
    macKey: hkdf(sharedSecret, salt, "ltp-mac-key", 32),
    ivKey: hkdf(sharedSecret, salt, "ltp-iv-key", 16),
  };
}

export function signEcdhPublicKey(
  publicKey: string,
  entityId: string,
  timestamp: number,
  longTermSecret: string,
): string {
  return hmacSha256(`${publicKey}:${entityId}:${timestamp}`, longTermSecret);
}

export function verifyEcdhPublicKey(
  publicKey: string,
  entityId: string,
  timestamp: number,
  signature: string,
  longTermSecret: string,
  now: number,
  maxAgeMs = 300_000,
  maxFutureSkewMs = 5_000,
): boolean {
  const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const age = now - timestampMs;
  if (age > maxAgeMs || age < -maxFutureSkewMs || !/^[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }
  const expected = Buffer.from(
    signEcdhPublicKey(publicKey, entityId, timestamp, longTermSecret),
    "hex",
  );
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function generateNonce(
  macKey: string,
  entityId: string,
  timestamp: number,
  deterministicRandomHex: string,
): string {
  return hmacSha256(`${entityId}:${timestamp}:${deterministicRandomHex}`, macKey);
}

export function generateRoutingTag(threadId: string, sessionId: string, macKey: string): string {
  return hmacSha256(`${threadId}:${sessionId}`, macKey).slice(0, 32);
}

export function encryptMetadata(
  metadata: { thread_id: string; session_id: string; timestamp: number },
  encryptionKey: string,
  ivHex: string,
): string {
  const key = Buffer.from(encryptionKey.slice(0, 64), "hex");
  const iv = Buffer.from(ivHex, "hex");
  if (key.length !== 32 || iv.length !== 12) {
    throw new Error("AES-256-GCM requires a 32-byte key and 12-byte IV");
  }
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(metadata);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${ciphertext.toString("hex")}:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}`;
}

export function decryptMetadata(
  encryptedMetadata: string,
  encryptionKey: string,
): { thread_id: string; session_id: string; timestamp: number } {
  const parts = encryptedMetadata.split(":");
  if (parts.length !== 3) {
    throw new Error("encrypted metadata must use ciphertext:iv:tag format");
  }
  const [ciphertextHex, ivHex, tagHex] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey.slice(0, 64), "hex"),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
  const value = JSON.parse(plaintext) as Record<string, unknown>;
  if (
    typeof value.thread_id !== "string" ||
    typeof value.session_id !== "string" ||
    typeof value.timestamp !== "number"
  ) {
    throw new Error("decrypted metadata has invalid structure");
  }
  return {
    thread_id: value.thread_id,
    session_id: value.session_id,
    timestamp: value.timestamp,
  };
}
