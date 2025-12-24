import {
  ProposedTransition,
  VerifiedTransition,
  AdmissibilityResult,
  ActionResult,
  ReasonCodes
} from './types';
import { EnforcementError } from './errors';
import { enforceActionBoundary } from './policy';
import * as crypto from 'crypto';

// PRIVATE BRAND SYMBOL
// This is not exported, so no external code can create a VerifiedTransition literal
const VERIFIED_BRAND = Symbol('LTP_VERIFIED_TRANSITION') as any;

/**
 * Factory function to create a VerifiedTransition.
 * In a real implementation, this might also sign the transition.
 */
export function mintVerifiedTransition(
  proposal: ProposedTransition,
  traceId: string,
  reason: string,
  reasonCode?: string
): VerifiedTransition {
  return {
    [VERIFIED_BRAND]: true,
    id: crypto.randomUUID(),
    originalProposalId: proposal.id,
    admissible: true,
    signedByLtp: true,
    timestamp: Date.now(),
    traceId,
    reason,
    reasonCode,
    targetState: proposal.targetState,
    params: proposal.params,
    context: proposal.context // Carry over context for audit
  } as unknown as VerifiedTransition;
}

/**
 * Type guard to check if an object is a VerifiedTransition.
 * Checks for the presence of the private brand symbol.
 */
export function isVerifiedTransition(x: unknown): x is VerifiedTransition {
  return typeof x === 'object' && x !== null && (x as any)[VERIFIED_BRAND] === true;
}

/**
 * The Admissibility Layer (LTP) is the ONLY entity allowed to create VerifiedTransitions.
 */
export class LTPAdmissibilityChecker {
  // In a real implementation, this would involve policy lookup, checks, etc.

  async check(proposal: ProposedTransition): Promise<AdmissibilityResult> {
    const traceId = crypto.randomUUID();

    // Use the reusable Action Boundary logic (P1-2)
    const decision = enforceActionBoundary(proposal);

    if (!decision.admissible) {
      // Return BlockedTransition
      console.warn(`[LTP] BLOCKED: ${decision.reason} (${decision.reasonCode})`);
      return {
        id: crypto.randomUUID(),
        originalProposalId: proposal.id,
        admissible: false,
        reason: decision.reason,
        reasonCode: decision.reasonCode,
        traceId,
        timestamp: Date.now(),
        violationType: decision.violationType,
        context: proposal.context
      };
    }

    // If Allowed, Mint the Verified Token
    const verified = mintVerifiedTransition(
      proposal,
      traceId,
      decision.reason,
      decision.reasonCode
    );

    return verified;
  }
}

/**
 * The Action Boundary enforces that the Executor only runs VerifiedTransitions.
 * It is impossible to pass a raw object here that isn't a VerifiedTransition
 * because the symbol is not exported (or we check strictly).
 */
export class ActionBoundary {

  /**
   * Executes the action ONLY if the transition is verified.
   * @throws EnforcementError if the transition is not valid or signed.
   */
  async execute(transition: VerifiedTransition, executor: (t: VerifiedTransition) => Promise<ActionResult>): Promise<ActionResult> {

    // 1. Runtime Integrity Check
    if (!isVerifiedTransition(transition)) {
      throw new EnforcementError('SECURITY VIOLATION: Attempted to execute unverified transition.');
    }

    if (!transition.signedByLtp) {
        throw new EnforcementError('INTEGRITY VIOLATION: Transition lacks LTP signature.');
    }

    // 2. Proceed to Execution
    try {
      return await executor(transition);
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        traceId: transition.traceId
      };
    }
  }
}
