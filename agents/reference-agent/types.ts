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
  targetState: string;
  params?: Record<string, unknown>;
  context: ContextType; // Preserved for audit
}

export interface BlockedTransition {
  id: string;
  originalProposalId: string;
  admissible: false;
  reason: string;
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
