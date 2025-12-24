export type ContextType = 'USER' | 'SYSTEM' | 'WEB' | 'MEMORY';

export interface AgentEvent {
  id: string;
  type: ContextType;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ProposedTransition {
  id: string;
  eventId: string;
  targetState: string;
  reason: string;
  params?: Record<string, unknown>;
  // The context of the event that triggered this proposal.
  // Crucial for the Admissibility Layer to make safety decisions.
  context: ContextType;
}

/**
 * A symbol to ensure VerifiedTransition can only be created by the Admissibility Layer.
 * NOT EXPORTED to prevent forgery.
 */
declare const VERIFIED_BRAND: unique symbol;

export interface VerifiedTransition {
  readonly [VERIFIED_BRAND]: true;
  id: string;
  originalProposalId: string;
  admissible: true;
  signedByLtp: true; // In a real system, this would be a crypto signature
  timestamp: number;
  traceId: string;
  reason: string; // Explanation of why it was allowed
  reasonCode?: string; // Stable machine-readable code
  targetState: string;
  params?: Record<string, unknown>;
  context: ContextType; // Preserved for audit
}

export interface BlockedTransition {
  id: string;
  originalProposalId: string;
  admissible: false;
  reason: string;
  reasonCode: string; // Stable machine-readable code (Mandatory for Blocked)
  traceId: string;
  timestamp: number;
  violationType?: 'POLICY' | 'SAFETY' | 'UNCERTAINTY';
  context: ContextType; // Preserved for audit
}

export type AdmissibilityResult = VerifiedTransition | BlockedTransition;

export interface ActionResult {
  success: boolean;
  newState?: string;
  output?: any;
  error?: string;
  traceId: string;
}

export enum ReasonCodes {
  WEB_ORIGIN_FORBIDDEN_FOR_CRITICAL_ACTION = 'WEB_ORIGIN_FORBIDDEN_FOR_CRITICAL_ACTION',
  MISSING_AUTHORITY = 'MISSING_AUTHORITY',
  UNTRUSTED_SOURCE = 'UNTRUSTED_SOURCE',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  GLOBAL_SAFETY_VIOLATION = 'GLOBAL_SAFETY_VIOLATION',
  PROMPT_INJECTION_DETECTED = 'PROMPT_INJECTION_DETECTED',
  ADMISSIBLE = 'ADMISSIBLE'
}

export interface AgentAction {
  agent_id: string;
  intent: string;
  action: string;
  inputs_digest: string;
  outputs_digest: string;
  digest_alg: 'sha256' | 'blake3';
  policy: {
    id: string;
    version: string;
    verdict: 'ALLOW' | 'DENY' | 'DEFER';
    reasons?: string[];
  };
  timestamp: number;
  signature: string;
  key_id: string;
  alg: 'ed25519' | 'secp256k1' | 'hmac-sha256';
  action_hash: string;
  prev_hash?: string;
}
