
/**
 * Core Types for the LTP Reference Pipeline.
 */

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
}

/**
 * A unique symbol to ensure VerifiedTransition can only be created by the Admissibility Layer.
 * NOT EXPORTED to prevent forgery from other modules.
 * In a real package, this would be kept internal to the package.
 */
export const VERIFIED_BRAND = Symbol('LTP_VERIFIED_TRANSITION');

export interface VerifiedTransition {
  readonly [VERIFIED_BRAND]: true;
  id: string;
  originalProposalId: string;
  admissible: true;
  signedByLtp: true;
  timestamp: number;
  traceId: string;
  reason: string;
  targetState: string;
  params?: Record<string, unknown>;
}

export interface BlockedTransition {
  id: string;
  originalProposalId: string;
  admissible: false;
  reason: string;
  traceId: string;
  timestamp: number;
  violationType?: 'POLICY' | 'SAFETY' | 'UNCERTAINTY';
}

export type AdmissibilityResult = VerifiedTransition | BlockedTransition;

export interface ActionResult {
  success: boolean;
  newState?: string;
  output?: any;
  error?: string;
  traceId: string;
}
