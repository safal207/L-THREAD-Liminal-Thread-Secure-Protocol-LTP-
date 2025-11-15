/**
 * LTP (Liminal Thread Protocol) Client
 * Version 0.1
 */

import {
  HandshakeInitMessage,
  HandshakeAckMessage,
  LtpEnvelope,
  LtpClientOptions,
  LtpClientEvents,
  StateUpdatePayload,
  EventPayload,
  ErrorPayload,
  LtpMessage,
  LtpAffect,
} from './types';

const LTP_VERSION = '0.1';
const SDK_VERSION = '0.1.0';

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
  private heartbeatIntervalMs: number = 15000;
  private heartbeatTimer: NodeJS.Timeout | number | null = null;

  private isConnected: boolean = false;
  private isHandshakeComplete: boolean = false;

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
    };
    this.events = events;
  }

  /**
   * Connect to LTP server and perform handshake
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url, 'ltp.v0.1');

        this.ws.onopen = () => {
          console.log('[LTP] WebSocket connected, initiating handshake...');
          this.sendHandshakeInit();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as LtpMessage;
            this.handleMessage(message, resolve, reject);
          } catch (error) {
            console.error('[LTP] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[LTP] WebSocket error:', error);
          if (!this.isHandshakeComplete) {
            reject(new Error('WebSocket connection failed'));
          }
        };

        this.ws.onclose = () => {
          console.log('[LTP] WebSocket closed');
          this.handleDisconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from LTP server
   */
  public disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer as number);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isHandshakeComplete = false;
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
    this.send({
      type: 'state_update',
      thread_id: this.threadId!,
      session_id: this.sessionId!,
      timestamp: this.getTimestamp(),
      payload,
      meta: {
        client_id: this.options.clientId,
        affect: options?.affect || this.options.defaultAffect,
        context_tag: options?.contextTag || this.options.defaultContextTag,
      },
    });
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
    const payload: EventPayload = {
      event_type: eventType,
      data,
    };

    this.send({
      type: 'event',
      thread_id: this.threadId!,
      session_id: this.sessionId!,
      timestamp: this.getTimestamp(),
      payload,
      meta: {
        client_id: this.options.clientId,
        affect: options?.affect || this.options.defaultAffect,
        context_tag: options?.contextTag || this.options.defaultContextTag,
      },
    });
  }

  /**
   * Send ping message (usually handled automatically by heartbeat)
   */
  public sendPing(): void {
    this.send({
      type: 'ping',
      thread_id: this.threadId!,
      session_id: this.sessionId!,
      timestamp: this.getTimestamp(),
      payload: {},
      meta: {
        client_id: this.options.clientId,
      },
    });
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

  // Private methods

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

  private handleMessage(message: LtpMessage, resolve?: (value: void) => void, reject?: (reason?: unknown) => void): void {
    // Call generic message handler
    if (this.events.onMessage) {
      this.events.onMessage(message);
    }

    // Handle specific message types
    switch (message.type) {
      case 'handshake_ack':
        this.handleHandshakeAck(message as HandshakeAckMessage, resolve);
        break;

      case 'pong':
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
        this.handleError(message.payload as ErrorPayload, reject);
        break;

      default:
        console.log('[LTP] Received message:', message.type);
    }
  }

  private handleHandshakeAck(message: HandshakeAckMessage, resolve?: (value: void) => void): void {
    console.log('[LTP] Handshake acknowledged');

    this.threadId = message.thread_id;
    this.sessionId = message.session_id;
    this.heartbeatIntervalMs = message.heartbeat_interval_ms;
    this.isConnected = true;
    this.isHandshakeComplete = true;

    // Start heartbeat
    this.startHeartbeat();

    // Notify
    if (this.events.onConnected) {
      this.events.onConnected(this.threadId, this.sessionId);
    }

    if (resolve) {
      resolve();
    }
  }

  private handleError(payload: ErrorPayload, reject?: (reason?: unknown) => void): void {
    console.error('[LTP] Server error:', payload.error_code, payload.error_message);

    if (this.events.onError) {
      this.events.onError(payload);
    }

    if (!this.isHandshakeComplete && reject) {
      reject(new Error(`LTP Error: ${payload.error_code} - ${payload.error_message}`));
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.isHandshakeComplete = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer as number);
      this.heartbeatTimer = null;
    }

    if (this.events.onDisconnected) {
      this.events.onDisconnected();
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer as number);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendPing();
      }
    }, this.heartbeatIntervalMs);
  }

  private send(message: LtpEnvelope): void {
    if (!this.isConnected || !this.isHandshakeComplete) {
      console.error('[LTP] Cannot send message: not connected');
      return;
    }

    this.sendRaw(message);
  }

  private sendRaw(message: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[LTP] Cannot send message: WebSocket not open');
      return;
    }

    const json = JSON.stringify(message);
    this.ws.send(json);
  }

  private getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private detectPlatform(): string {
    if (typeof window !== 'undefined') {
      return 'web';
    } else if (typeof process !== 'undefined') {
      return 'node';
    }
    return 'unknown';
  }
}
