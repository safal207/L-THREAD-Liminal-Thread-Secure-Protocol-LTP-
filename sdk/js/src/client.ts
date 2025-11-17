/**
 * LTP (Liminal Thread Protocol) Client
 * Version 0.4
 */

import { signMessage, verifySignature } from './crypto';
import {
  HandshakeInitMessage,
  HandshakeAckMessage,
  HandshakeResumeMessage,
  HandshakeRejectMessage,
  LtpEnvelope,
  LtpClientOptions,
  LtpClientEvents,
  StateUpdatePayload,
  EventPayload,
  ErrorPayload,
  LtpMessage,
  LtpAffect,
  LtpMeta,
  SupportedMessageType,
  LtpStorage,
  ReconnectStrategy,
  HeartbeatOptions,
  ContentEncoding,
  LtpLogger,
} from './types';

const LTP_VERSION = '0.3';
const SDK_VERSION = '0.3.0';
const SUBPROTOCOL = 'ltp.v0.3';

class MemoryStorage implements LtpStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

type NormalizedReconnectStrategy = Required<ReconnectStrategy>;
type NormalizedHeartbeatOptions = Required<HeartbeatOptions>;

function getDefaultStorage(): LtpStorage {
  if (typeof window !== 'undefined' && window?.localStorage) {
    return window.localStorage;
  }
  return new MemoryStorage();
}

const DEFAULT_RECONNECT: NormalizedReconnectStrategy = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

const DEFAULT_HEARTBEAT: NormalizedHeartbeatOptions = {
  enabled: true,
  intervalMs: 15000,
  timeoutMs: 45000,
};

/**
 * Default console-based logger implementation
 */
class ConsoleLogger implements LtpLogger {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.debug(`[LTP] ${message}`, meta);
    } else {
      console.debug(`[LTP] ${message}`);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.log(`[LTP] ${message}`, meta);
    } else {
      console.log(`[LTP] ${message}`);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.warn(`[LTP] ${message}`, meta);
    } else {
      console.warn(`[LTP] ${message}`);
    }
  }

  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    if (error || meta) {
      console.error(`[LTP] ${message}`, error || meta);
    } else {
      console.error(`[LTP] ${message}`);
    }
  }
}

const defaultLogger = new ConsoleLogger();

/**
 * LTP Client for establishing and managing liminal thread sessions
 */
export class LtpClient {
  private url: string;
  private options: LtpClientOptions;
  private events: LtpClientEvents;
  private ws: WebSocket | null = null;

  private threadId: string | null = null;
  private sessionId: string | null = null;
  private negotiatedHeartbeatMs: number = 15000;

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private forcedReconnectReason: string | null = null;

  private reconnectAttempts = 0;
  private lastReconnectDelayMs = 0;
  private isConnecting = false;
  private manualDisconnect = false;

  private isConnected = false;
  private isHandshakeComplete = false;
  private isAttemptingResume = false;

  private connectPromise: Promise<void> | null = null;
  private pendingConnectResolve?: (value: void | PromiseLike<void>) => void;
  private pendingConnectReject?: (reason?: unknown) => void;

  private storage: LtpStorage;
  private storageKeys: { thread: string; session: string };
  private reconnectConfig: NormalizedReconnectStrategy;
  private heartbeatConfig: NormalizedHeartbeatOptions;
  private logger: LtpLogger;

  /**
   * Create a new LTP client
   * @param url WebSocket URL (ws:// or wss://)
   * @param options Client configuration options
   * @param events Event handlers
   */
  constructor(url: string, options: LtpClientOptions = {}, events: LtpClientEvents = {}) {
    this.url = url;
    this.options = {
      clientId: options.clientId || this.generateClientId(),
      deviceFingerprint: options.deviceFingerprint,
      intent: options.intent || 'resonant_link',
      capabilities: options.capabilities || ['state-update', 'events', 'ping-pong'],
      defaultContextTag: options.defaultContextTag,
      defaultAffect: options.defaultAffect,
      metadata: {
        sdk_version: SDK_VERSION,
        platform: this.detectPlatform(),
        ...options.metadata,
      },
      storage: options.storage,
      reconnect: options.reconnect,
      heartbeat: options.heartbeat,
      codec: options.codec,
      preferredEncoding: options.preferredEncoding || 'json',
      logger: options.logger,
    };
    this.events = events;
    this.logger = this.options.logger || defaultLogger;

    this.storage = this.options.storage || getDefaultStorage();
    this.storageKeys = {
      thread: `ltp_thread_id:${this.options.clientId}`,
      session: `ltp_session_id:${this.options.clientId}`,
    };
    this.loadPersistedIds();

    this.reconnectConfig = {
      ...DEFAULT_RECONNECT,
      ...(this.options.reconnect || {}),
    };
    this.heartbeatConfig = {
      ...DEFAULT_HEARTBEAT,
      ...(this.options.heartbeat || {}),
    };
  }

  /**
   * Connect to LTP server and perform handshake
   */
  public async connect(): Promise<void> {
    if (this.isConnected && this.isHandshakeComplete) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.manualDisconnect = false;
    this.reconnectAttempts = 0;

    this.connectPromise = new Promise((resolve, reject) => {
      this.pendingConnectResolve = resolve;
      this.pendingConnectReject = reject;
      this.connectWebSocket();
    });

    return this.connectPromise;
  }

  /**
   * Disconnect from LTP server
   */
  public disconnect(): void {
    this.manualDisconnect = true;
    this.clearHeartbeatTimers();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isHandshakeComplete = false;
    this.connectPromise = null;

    if (this.pendingConnectReject) {
      this.pendingConnectReject(new Error('Disconnected by client'));
      this.pendingConnectReject = undefined;
      this.pendingConnectResolve = undefined;
    }
  }

  /**
   * Send state update message
   * @param payload State update payload
   * @param options Optional metadata overrides
   */
  public sendStateUpdate(
    payload: StateUpdatePayload,
    options?: { affect?: LtpAffect; contextTag?: string }
  ): void {
    if (!this.hasSessionContext()) {
      this.logger.error('Cannot send state update before handshake completes');
      return;
    }

    const metaOverrides: LtpMeta = {
      affect: options?.affect,
      context_tag: options?.contextTag,
    };

    // Prepare payload data with TOON encoding if needed
    const { encoded, encoding } = this.preparePayloadData(payload.data);
    const encodedPayload: StateUpdatePayload = {
      ...payload,
      data: encoded,
    };

    const envelope = this.buildEnvelope('state_update', encodedPayload, metaOverrides, encoding);
    this.send(envelope);
  }

  /**
   * Send event message
   * @param eventType Event type identifier
   * @param data Event data
   * @param options Optional metadata overrides
   */
  public sendEvent(
    eventType: string,
    data: Record<string, unknown>,
    options?: { affect?: LtpAffect; contextTag?: string }
  ): void {
    if (!this.hasSessionContext()) {
      this.logger.error('Cannot send event before handshake completes');
      return;
    }

    // Prepare payload data with TOON encoding if needed
    const { encoded, encoding } = this.preparePayloadData(data);
    const payload: EventPayload = {
      event_type: eventType,
      data: encoded as Record<string, unknown>,
    };

    const metaOverrides: LtpMeta = {
      affect: options?.affect,
      context_tag: options?.contextTag,
    };

    this.send(this.buildEnvelope('event', payload, metaOverrides, encoding));
  }

  /**
   * Send ping message (usually handled automatically by heartbeat)
   */
  public sendPing(): void {
    if (!this.hasSessionContext()) {
      this.logger.error('Cannot send ping before handshake completes');
      return;
    }

    this.send(this.buildEnvelope('ping', {}));
  }

  /**
   * Send custom LTP message with full control over meta and payload
   * Useful for LRI integration and advanced use cases
   */
  public sendMessage(message: {
    type: string;
    meta?: LtpMeta;
    payload: Record<string, unknown>;
  }): void {
    if (!this.hasSessionContext()) {
      this.logger.error('Cannot send message before handshake completes');
      return;
    }

    this.send(this.buildEnvelope(message.type as SupportedMessageType, message.payload, message.meta));
  }

  /**
   * Get current thread ID
   */
  public getThreadId(): string | null {
    return this.threadId;
  }

  /**
   * Get current session ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if client is connected
   */
  public isConnectedToServer(): boolean {
    return this.isConnected && this.isHandshakeComplete;
  }

  /**
   * Return last scheduled reconnect delay (testing helper)
   */
  public getLastReconnectDelayMs(): number {
    return this.lastReconnectDelayMs;
  }

  // Private methods

  private connectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
    }

    this.isConnecting = true;

    this.ws = new WebSocket(this.url, SUBPROTOCOL);

    this.ws.onopen = () => {
      this.logger.info('WebSocket connected, initiating handshake...');
      this.isConnecting = false;
      if (this.threadId) {
        this.isAttemptingResume = true;
        this.sendHandshakeResume();
      } else {
        this.isAttemptingResume = false;
        this.sendHandshakeInit();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as LtpMessage;
        this.handleMessage(message);
      } catch (error) {
        this.logger.error('Failed to parse message', error);
      }
    };

    this.ws.onerror = (error) => {
      this.logger.error('WebSocket error', error);
    };

    this.ws.onclose = () => {
      this.logger.info('WebSocket closed');
      this.handleDisconnect('closed');
    };
  }

  private sendHandshakeInit(): void {
    const handshake: HandshakeInitMessage = {
      type: 'handshake_init',
      ltp_version: LTP_VERSION,
      client_id: this.options.clientId!,
      device_fingerprint: this.options.deviceFingerprint,
      intent: this.options.intent,
      capabilities: this.options.capabilities,
      metadata: this.options.metadata,
    };

    this.sendRaw(handshake);
  }

  private sendHandshakeResume(): void {
    if (!this.threadId) {
      this.sendHandshakeInit();
      return;
    }

    const resume: HandshakeResumeMessage = {
      type: 'handshake_resume',
      ltp_version: LTP_VERSION,
      client_id: this.options.clientId!,
      thread_id: this.threadId,
      resume_reason: 'automatic_reconnect',
    };

    this.sendRaw(resume);
  }

  private handleMessage(message: LtpMessage): void {
    // Verify signature if enabled (v0.4+)
    if (this.options.enableSignatureVerification && this.options.secretKey && message.signature) {
      // Run verification asynchronously to not block message handling
      verifySignature(message, this.options.secretKey).then((result) => {
        if (!result.valid) {
          this.logger.warn('Message signature verification failed', {
            type: message.type,
            error: result.error,
          });
          // Still process message for backward compatibility, but log warning
        }
      }).catch((error) => {
        this.logger.error('Failed to verify message signature', error);
      });
    }

    if (this.events.onMessage) {
      this.events.onMessage(message);
    }

    switch (message.type) {
      case 'handshake_ack':
        this.handleHandshakeAck(message as HandshakeAckMessage);
        break;
      case 'handshake_reject':
        this.handleHandshakeReject(message as HandshakeRejectMessage);
        break;
      case 'pong':
        this.clearHeartbeatTimeout();
        this.scheduleHeartbeatTimeout();
        if (this.events.onPong) {
          this.events.onPong();
        }
        break;
      case 'state_update':
        if (this.events.onStateUpdate) {
          this.events.onStateUpdate(message.payload as StateUpdatePayload);
        }
        break;
      case 'event':
        if (this.events.onEvent) {
          this.events.onEvent(message.payload as EventPayload);
        }
        break;
      case 'error':
        this.handleError(message.payload as ErrorPayload);
        break;
      default:
        this.logger.debug('Received message', { type: message.type });
    }
  }

  private handleHandshakeAck(message: HandshakeAckMessage): void {
    this.logger.info('Handshake acknowledged', {
      threadId: message.thread_id,
      sessionId: message.session_id,
      resumed: message.resumed,
    });

    this.threadId = message.thread_id;
    this.sessionId = message.session_id;
    this.negotiatedHeartbeatMs = message.heartbeat_interval_ms;
    this.persistIds();

    this.isConnected = true;
    this.isHandshakeComplete = true;
    this.isAttemptingResume = false;
    this.reconnectAttempts = 0;

    this.clearReconnectTimer();
    this.startHeartbeat();

    if (this.events.onConnected) {
      this.events.onConnected(this.threadId, this.sessionId);
    }

    if (this.pendingConnectResolve) {
      this.pendingConnectResolve();
      this.pendingConnectResolve = undefined;
      this.pendingConnectReject = undefined;
      this.connectPromise = null;
    }
  }

  private handleHandshakeReject(message: HandshakeRejectMessage): void {
    this.logger.warn('Handshake resume rejected', { reason: message.reason });

    if (this.isAttemptingResume) {
      this.isAttemptingResume = false;
      this.threadId = null;
      this.sessionId = null;
      this.storage.removeItem(this.storageKeys.thread);
      this.storage.removeItem(this.storageKeys.session);
      this.sendHandshakeInit();
      return;
    }

    this.emitPermanentFailure(`Handshake rejected: ${message.reason}`);
    if (this.ws) {
      this.ws.close();
    }
  }

  private handleError(payload: ErrorPayload): void {
    this.logger.error('Server error', undefined, {
      errorCode: payload.error_code,
      errorMessage: payload.error_message,
      details: payload.details,
    });

    if (this.events.onError) {
      this.events.onError(payload);
    }
  }

  private handleDisconnect(reason: string): void {
    this.isConnected = false;
    this.isHandshakeComplete = false;
    this.clearHeartbeatTimers();

    if (this.events.onDisconnected) {
      this.events.onDisconnected();
    }

    if (!this.manualDisconnect) {
      const reconnectReason = this.forcedReconnectReason || reason;
      this.forcedReconnectReason = null;
      this.scheduleReconnect(reconnectReason);
    }
  }

  private startHeartbeat(): void {
    if (!this.heartbeatConfig.enabled) {
      return;
    }

    this.clearHeartbeatTimers();
    const interval = this.options.heartbeat?.intervalMs || this.negotiatedHeartbeatMs;

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendPing();
      }
    }, interval);

    this.scheduleHeartbeatTimeout();
  }

  private clearHeartbeatTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.clearHeartbeatTimeout();
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private scheduleHeartbeatTimeout(): void {
    if (!this.heartbeatConfig.enabled) {
      return;
    }

    this.clearHeartbeatTimeout();
    this.heartbeatTimeout = setTimeout(() => {
      this.logger.warn('Heartbeat timeout, reconnecting...');
      this.forceReconnect('heartbeat_timeout');
    }, this.heartbeatConfig.timeoutMs);
  }

  private forceReconnect(reason: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.forcedReconnectReason = reason;
      this.ws.close();
      return;
    }
    this.handleDisconnect(reason);
  }

  private send(message: LtpEnvelope): void {
    if (!this.isConnected || !this.isHandshakeComplete || !this.ws) {
      this.logger.error('Cannot send message: not connected');
      return;
    }

    const nonce = this.generateNonce();

    // Generate signature asynchronously, but don't block sending
    this.generateSignature(message, nonce).then((signature) => {
      const envelopeWithSecurity: LtpEnvelope = {
        ...message,
        nonce,
        signature,
      };

      this.sendRaw(envelopeWithSecurity);
    }).catch((error) => {
      this.logger.error('Failed to generate signature, sending with placeholder', error);
      const envelopeWithSecurity: LtpEnvelope = {
        ...message,
        nonce,
        signature: 'v0-placeholder',
      };
      this.sendRaw(envelopeWithSecurity);
    });
  }

  private sendRaw(message: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.error('Cannot send message: WebSocket not open');
      return;
    }

    const json = JSON.stringify(message);
    this.ws.send(json);
  }

  private buildEnvelope<T>(
    type: SupportedMessageType,
    payload: T,
    metaOverrides?: LtpMeta,
    contentEncoding?: ContentEncoding
  ): LtpEnvelope<T> {
    if (!this.threadId || !this.sessionId) {
      throw new Error('Cannot build envelope without thread/session identifiers');
    }

    const meta = this.mergeMeta(metaOverrides);

    const envelope: LtpEnvelope<T> = {
      type,
      thread_id: this.threadId,
      session_id: this.sessionId,
      timestamp: this.getTimestamp(),
      payload,
      meta,
    };

    // Only add content_encoding if it's not the default JSON
    if (contentEncoding && contentEncoding !== 'json') {
      envelope.content_encoding = contentEncoding;
    }

    return envelope;
  }

  private mergeMeta(overrides?: LtpMeta): LtpMeta | undefined {
    const meta: LtpMeta = {
      client_id: this.options.clientId,
      affect: overrides?.affect || this.options.defaultAffect,
      context_tag: overrides?.context_tag || this.options.defaultContextTag,
      ...overrides,
    };

    Object.keys(meta).forEach((key) => {
      if ((meta as Record<string, unknown>)[key] === undefined) {
        delete (meta as Record<string, unknown>)[key];
      }
    });

    return Object.keys(meta).length ? meta : undefined;
  }

  private persistIds(): void {
    if (this.threadId) {
      this.storage.setItem(this.storageKeys.thread, this.threadId);
    }
    if (this.sessionId) {
      this.storage.setItem(this.storageKeys.session, this.sessionId);
    }
  }

  private loadPersistedIds(): void {
    this.threadId = this.storage.getItem(this.storageKeys.thread);
    this.sessionId = this.storage.getItem(this.storageKeys.session);
  }

  private scheduleReconnect(reason: string): void {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.reconnectConfig.maxRetries) {
      this.emitPermanentFailure(`Reconnect attempts exceeded after ${reason}`);
      return;
    }

    const delay = Math.min(
      this.reconnectConfig.baseDelayMs * Math.pow(2, this.reconnectAttempts),
      this.reconnectConfig.maxDelayMs
    );
    this.lastReconnectDelayMs = delay;
    this.reconnectAttempts += 1;

    this.logger.warn('Scheduling reconnect', { delayMs: delay, reason });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emitPermanentFailure(reason: string): void {
    const error = new Error(reason);
    this.logger.error('Permanent failure', undefined, { reason });

    if (this.events.onPermanentFailure) {
      this.events.onPermanentFailure(error);
    }

    if (this.pendingConnectReject) {
      this.pendingConnectReject(error);
      this.pendingConnectReject = undefined;
      this.pendingConnectResolve = undefined;
      this.connectPromise = null;
    }
  }

  /**
   * Generate cryptographically secure random hex string
   * Works in both browser (Web Crypto API) and Node.js (crypto module)
   */
  private generateSecureRandomHex(byteLength: number): string {
    // Browser environment
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const randomBytes = new Uint8Array(byteLength);
      window.crypto.getRandomValues(randomBytes);
      return Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Node.js environment
    if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        return crypto.randomBytes(byteLength).toString('hex');
      } catch (e) {
        this.logger.warn('Crypto module not available, falling back to UUID-based random');
      }
    }

    // Fallback: Use UUID v4 which has crypto-secure randomness
    // This is still better than Math.random()
    const uuid = this.generateUUIDv4();
    return uuid.replace(/-/g, '').substring(0, byteLength * 2);
  }

  /**
   * Generate UUID v4 (cryptographically secure in modern environments)
   */
  private generateUUIDv4(): string {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    // Polyfill for UUID v4 using crypto.getRandomValues or crypto.randomBytes
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);

      // Set version (4) and variant bits
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
    }

    // Last resort: timestamp-based (not crypto-secure, but better than nothing)
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).substring(2);
    this.logger.warn('Using non-crypto-secure UUID fallback');
    return `${timestamp}-${random}-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private generateNonce(): string {
    const randomHex = this.generateSecureRandomHex(8);
    return `${this.options.clientId}-${Date.now()}-${randomHex}`;
  }

  private hasSessionContext(): boolean {
    return Boolean(this.threadId && this.sessionId);
  }

  private async generateSignature(message: LtpEnvelope, nonce: string): Promise<string> {
    // If no secret key provided, use placeholder (backward compatibility with v0.3)
    if (!this.options.secretKey) {
      return 'v0-placeholder';
    }

    // Generate HMAC-SHA256 signature (v0.4+)
    try {
      const signature = await signMessage(
        {
          type: message.type,
          thread_id: message.thread_id || '',
          session_id: message.session_id,
          timestamp: message.timestamp,
          nonce,
          payload: message.payload,
        },
        this.options.secretKey
      );

      return signature;
    } catch (error) {
      this.logger.error('Failed to sign message', error);
      // Fallback to placeholder if signing fails
      return 'v0-placeholder';
    }
  }

  private getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  private generateClientId(): string {
    const randomHex = this.generateSecureRandomHex(8);
    return `client-${Date.now()}-${randomHex}`;
  }

  private detectPlatform(): string {
    if (typeof window !== 'undefined') {
      return 'web';
    }
    if (typeof process !== 'undefined') {
      return 'node';
    }
    return 'unknown';
  }

  /**
   * Prepare payload data with optional TOON encoding
   * @param data Original payload data
   * @returns Object with encoded data and encoding type
   */
  private preparePayloadData(data: unknown): { encoded: unknown; encoding: ContentEncoding } {
    // If TOON encoding is preferred and codec is available
    if (
      this.options.preferredEncoding === 'toon' &&
      this.options.codec?.encodeJsonToToon &&
      Array.isArray(data) &&
      data.length > 0
    ) {
      // Check if it's an array of objects (typical TOON use case)
      const firstElement = data[0];
      if (
        typeof firstElement === 'object' &&
        firstElement !== null &&
        !Array.isArray(firstElement)
      ) {
        // Check if all elements have similar structure (simple heuristic)
        const firstKeys = Object.keys(firstElement);
        const allSimilar = data.every(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            Object.keys(item).length === firstKeys.length &&
            firstKeys.every((key) => key in item)
        );

        if (allSimilar) {
          try {
            const toonString = this.options.codec.encodeJsonToToon(data);
            return { encoded: toonString, encoding: 'toon' };
          } catch (error) {
            this.logger.warn('TOON encoding failed, falling back to JSON', { error });
          }
        }
      }
    }

    // Default: return as-is with JSON encoding
    return { encoded: data, encoding: 'json' };
  }
}
