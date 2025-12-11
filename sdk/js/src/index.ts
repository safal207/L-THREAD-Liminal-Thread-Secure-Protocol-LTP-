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

// Consciousness Web (web + orientation shell)
export {
  buildConsciousnessWeb,
  createDefaultOrientationShell,
  orientWeb,
} from './consciousnessWeb';

export type {
  ConsciousnessWeb,
  ThreadLink,
  WebNodeMetrics,
  OrientationShell,
  OrientationSector,
} from './consciousnessWeb.types';

// Orientation baseline and web utilities
export {
  ORIENTATION_BASELINE,
  applyWebUpdates,
  chooseDominantSector,
  createOrientationShell,
  createOrientationWeb,
  normalizeOrientation,
  updateActiveSector,
} from './orientation';
export type {
  OrientationPhase,
  OrientationWebSector,
  OrientationState,
  OrientationWeb,
  OrientationWebUpdate,
  SectorId,
} from './orientation';

// Liminal Time Weave (temporal branches)
export {
  appendNodeToBranch,
  computeBranchTrend,
  computeFocusMomentumScore,
  computeTimeWeaveSummary,
  createEmptyWeave,
  getBranch,
  summarizeWeave,
  upsertBranch,
} from './time/timeWeave';
export {
  computeAsymmetryMeta,
  computeTimeWeaveAsymmetry,
  detectBranchCollapse,
} from './time/timeWeaveAsymmetry';
export { computeTimeWeaveMeta } from './time/timeWeaveMeta';
export type {
  ThreadId,
  TimeBranch,
  TimeNode,
  TimePhase,
  TimeTick,
  TimeWeave,
  TimeWeaveAsymmetry,
  TimeWeaveAsymmetryMeta,
  TimeWeaveAsymmetryDirection,
  TimeWeaveDepth,
  BranchCollapseSignal,
  TimeWeaveMeta,
  TimeWeaveTrendSummary,
  TimeWeaveSummary,
  TimeWeaveHistory,
  TimeWeaveHistorySegment,
} from './time/timeWeaveTypes';

// Temporal Orientation Layer (Orientation Web x Time Weave)
export {
  buildTemporalOrientationView,
  buildViewFromWebAndAnchors,
  mapSectorToBranchId,
  pickNextSector,
  suggestNextSector,
} from './temporalOrientation/temporalOrientationEngine';
export { computeMomentumMetrics } from './temporalOrientation/fuzzyMomentum';
export type {
  NextThreadSuggestion,
  SectorTemporalSnapshot,
  TemporalOrientationSummary,
  TemporalOrientationView,
  TemporalSlope,
  TemporalTrend,
  MomentumMetrics,
} from './temporalOrientation/temporalOrientationTypes';
export type {
  TemporalOrientationBuildResult,
  NextSectorSuggestion,
} from './temporalOrientation/temporalOrientationEngine';

// Fuzzy routing (RouteHints + soft priority modes)
export {
  buildRouteHintsFromOrientation,
  computeRouteHintForSector,
  deriveRoutingIntent,
  routeWithFuzzyEngine,
} from './routing/fuzzyRoutingEngine';
export type {
  FuzzyRoutingContext,
  RouteHint,
  RoutingMode,
  RoutingPriority,
  RoutingIntent,
  RoutingResult,
  StringMode,
} from './routing/fuzzyRoutingEngine';
