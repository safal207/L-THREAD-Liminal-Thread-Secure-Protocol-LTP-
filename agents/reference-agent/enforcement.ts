import {
  ProposedTransition,
  VerifiedTransition,
  BlockedTransition,
  AdmissibilityResult,
  ActionResult
} from './types';
import { EnforcementError } from './errors';
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
  reason: string
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

    // 1. Simulating Policy Checks
    if (this.isViolation(proposal)) {
      return {
        id: crypto.randomUUID(),
        originalProposalId: proposal.id,
        admissible: false,
        reason: 'Policy Violation: Unsafe action for this context',
        traceId,
        timestamp: Date.now(),
        violationType: 'SAFETY',
        context: proposal.context
      };
    }

    // 2. If Allowed, Mint the Verified Token
    // We use the internal factory to create the branded type
    const verified = mintVerifiedTransition(
      proposal,
      traceId,
      'Admissible: Fits within safe orientation'
    );

    return verified;
  }

  private isViolation(proposal: ProposedTransition): boolean {
    const { context, targetState, reason } = proposal;

    // RULE 1: CRITICAL ACTIONS (The "Web != Action" Rule)
    // If the context is untrusted (WEB), critical actions are FORBIDDEN.
    const criticalActions = ['transfer_money', 'delete_file', 'modify_system', 'send_email'];
    if (context === 'WEB' && criticalActions.some(action => targetState.includes(action))) {
        // Log this drift! This is the system catching a prompt injection or bad actor.
        console.warn(`[LTP] BLOCKED: Web content attempted critical action '${targetState}'`);
        return true;
    }

    // RULE 2: GLOBAL SAFETY (No nukes, even from users)
    const globallyBanned = ['rm -rf', 'format_disk'];
    if (globallyBanned.some(action => targetState.includes(action))) {
        return true;
    }

    // RULE 3: PROMPT INJECTION HEURISTICS (Defense in Depth)
    // Even if context is USER, we check for obvious manipulation attempts in the reason/chain of thought
    if (reason && reason.toLowerCase().includes('ignore previous instructions')) {
        return true;
    }

    return false;
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
