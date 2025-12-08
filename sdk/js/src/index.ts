/**
 * LTP (Liminal Thread Protocol) SDK
 * Version 0.4
 *
 * Entry point for the LTP client library
 */

export { LtpClient } from './client';

export type {
  SupportedMessageType,
  LtpAffect,
  LtpMeta,
  LtpEnvelope,
  ContentEncoding,
  LtpCodec,
  HandshakeInitMessage,
  HandshakeAckMessage,
  HandshakeResumeMessage,
  HandshakeRejectMessage,
  PingPayload,
  PongPayload,
  StateUpdatePayload,
  EventPayload,
  ErrorPayload,
  PingMessage,
  PongMessage,
  StateUpdateMessage,
  EventMessage,
  ErrorMessage,
  LtpMessage,
  LtpClientOptions,
  LtpClientEvents,
  LtpStorage,
  ReconnectStrategy,
  HeartbeatOptions,
  LtpLogger,
} from './types';

// Export cryptographic utilities (v0.4+)
export {
  signMessage,
  verifySignature,
  generateKeyPair,
  deriveSharedSecret,
  hkdf,
  deriveSessionKeys,
  encryptPayload,
  decryptPayload,
  encryptMetadata,
  decryptMetadata,
  generateRoutingTag,
  signEcdhPublicKey,
  verifyEcdhPublicKey,
  generateNonce,
  hashEnvelope,
} from './crypto';

// Thread Life Model (semantic layer)
export {
  computeNextPhase,
  applyTransition,
  registerNewThread,
  updateThreadFromEvent,
} from './threadLifeModel';

export type {
  ThreadPhase,
  ThreadScope,
  ThreadVector,
  ThreadEvent,
  ThreadLifeTransition,
  ThreadMap,
} from './threadLifeModel.types';
