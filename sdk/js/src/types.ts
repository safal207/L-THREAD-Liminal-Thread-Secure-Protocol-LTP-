/**
 * LTP (Liminal Thread Protocol) TypeScript Types
 * Version 0.1
 */

/**
 * Supported LTP message types
 */
export type SupportedMessageType =
  | 'handshake_init'
  | 'handshake_resume'
  | 'handshake_ack'
  | 'handshake_reject'
  | 'ping'
  | 'pong'
  | 'state_update'
  | 'event'
  | 'error';

/**
 * Affect metadata for liminal/emotional state
 */
export interface LtpAffect {
  /** Emotional valence: -1 (negative) to 1 (positive) */
  valence: number;
  /** Arousal level: -1 (calm) to 1 (excited) */
  arousal: number;
}

/**
 * Base metadata for all LTP messages
 */
export interface LtpMeta {
  client_id?: string;
  trace_id?: string;
  parent_span_id?: string;
  user_agent?: string;
  /** Emotional state metadata (for LRI and semantic layers) */
  affect?: LtpAffect;
  /** Context identifier (e.g., "focus_session", "evening_reflection") */
  context_tag?: string;
  [key: string]: unknown; // Allow custom metadata
}

/**
 * Base envelope for all LTP messages (except handshake)
 */
export interface LtpEnvelope<T = unknown> {
  type: SupportedMessageType;
  thread_id: string;
  session_id: string;
  timestamp: number;
  payload: T;
  meta?: LtpMeta;
  content_encoding?: ContentEncoding;
  nonce?: string;
  signature?: string;
}

export type ContentEncoding = 'json' | 'toon';

export interface LtpCodec {
  encodeJsonToToon?(value: unknown): string;
  decodeToonToJson?(toon: string): unknown;
}

/**
 * Handshake Init Message (Client → Server)
 */
export interface HandshakeInitMessage {
  type: 'handshake_init';
  ltp_version: string;
  client_id: string;
  device_fingerprint?: string;
  intent?: string;
  capabilities?: string[];
  metadata?: {
    sdk_version?: string;
    platform?: string;
    [key: string]: unknown;
  };
}

/**
 * Handshake Acknowledgment Message (Server → Client)
 */
export interface HandshakeAckMessage {
  type: 'handshake_ack';
  ltp_version: string;
  thread_id: string;
  session_id: string;
  server_capabilities: string[];
  heartbeat_interval_ms: number;
  resumed?: boolean;
  metadata?: {
    server_version?: string;
    region?: string;
    [key: string]: unknown;
  };
}

export interface HandshakeResumeMessage {
  type: 'handshake_resume';
  ltp_version: string;
  client_id: string;
  thread_id: string;
  resume_reason?: string;
}

export interface HandshakeRejectMessage {
  type: 'handshake_reject';
  ltp_version: string;
  reason: string;
  suggest_new?: boolean;
  metadata?: {
    [key: string]: unknown;
  };
}

/**
 * Ping Message Payload
 */
export interface PingPayload {
  // Empty or minimal
  [key: string]: unknown;
}

/**
 * Pong Message Payload
 */
export interface PongPayload {
  // Empty or echo
  [key: string]: unknown;
}

/**
 * State Update Message Payload
 */
export interface StateUpdatePayload {
  kind: 'minimal' | 'full' | 'delta';
  data: unknown;
}

/**
 * Event Message Payload
 */
export interface EventPayload {
  event_type: string;
  data: unknown;
}

/**
 * Error Message Payload
 */
export interface ErrorPayload {
  error_code: string;
  error_message: string;
  details?: {
    [key: string]: unknown;
  };
}

/**
 * Ping message type
 */
export type PingMessage = LtpEnvelope<PingPayload>;

/**
 * Pong message type
 */
export type PongMessage = LtpEnvelope<PongPayload>;

/**
 * State update message type
 */
export type StateUpdateMessage = LtpEnvelope<StateUpdatePayload>;

/**
 * Event message type
 */
export type EventMessage = LtpEnvelope<EventPayload>;

/**
 * Error message type
 */
export type ErrorMessage = LtpEnvelope<ErrorPayload>;

/**
 * Union type for all LTP messages
 */
export type LtpMessage =
  | HandshakeInitMessage
  | HandshakeResumeMessage
  | HandshakeAckMessage
  | HandshakeRejectMessage
  | PingMessage
  | PongMessage
  | StateUpdateMessage
  | EventMessage
  | ErrorMessage;

export interface LtpStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ReconnectStrategy {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface HeartbeatOptions {
  enabled?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * LTP Client options
 */
export interface LtpClientOptions {
  clientId?: string;
  deviceFingerprint?: string;
  intent?: string;
  capabilities?: string[];
  /** Default context tag to apply to all messages if not specified */
  defaultContextTag?: string;
  /** Default affect to apply to all messages if not specified */
  defaultAffect?: LtpAffect;
  metadata?: {
    [key: string]: unknown;
  };
  storage?: LtpStorage;
  reconnect?: ReconnectStrategy;
  heartbeat?: HeartbeatOptions;
  codec?: LtpCodec;
  preferredEncoding?: ContentEncoding;
}

/**
 * LTP Client event handlers
 */
export interface LtpClientEvents {
  onConnected?: (threadId: string, sessionId: string) => void;
  onDisconnected?: () => void;
  onError?: (error: ErrorPayload) => void;
  onStateUpdate?: (payload: StateUpdatePayload) => void;
  onEvent?: (payload: EventPayload) => void;
  onPong?: () => void;
  onMessage?: (message: LtpMessage) => void;
  onPermanentFailure?: (error: Error | string) => void;
}
