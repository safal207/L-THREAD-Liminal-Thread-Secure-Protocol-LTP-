
import {
  ProposedTransition,
  VerifiedTransition,
  BlockedTransition,
  AdmissibilityResult,
  VERIFIED_SYMBOL,
  ActionResult
} from './types';
import { EnforcementError } from './errors';
import * as crypto from 'crypto';

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
        reason: 'Policy Violation: Unsafe action detected',
        traceId,
        timestamp: Date.now(),
        violationType: 'SAFETY'
      };
    }

    // 2. If Allowed, Mint the Verified Token
    // We cast to any to assign the symbol, or we can use a factory function inside the module
    const verified: VerifiedTransition = {
      [VERIFIED_SYMBOL]: true,
      id: crypto.randomUUID(),
      originalProposalId: proposal.id,
      admissible: true,
      signedByLtp: true,
      timestamp: Date.now(),
      traceId,
      reason: 'Admissible: Fits within safe orientation',
      targetState: proposal.targetState,
      params: proposal.params
    };

    return verified;
  }

  private isViolation(proposal: ProposedTransition): boolean {
    // Simple heuristic for demonstration: Block "transfer" or "delete" if reasons are weak
    const unsafeKeywords = ['delete', 'transfer_money', 'rm -rf'];

    // Check if target state or params look suspicious (mock logic)
    if (unsafeKeywords.some(k => proposal.targetState.includes(k))) {
      // In a real agent, we'd check context.
      // For this P0, we assume 'transfer_money' requires high confidence which we don't have in this mock.
      return true;
    }

    // Prompt Injection checks (rudimentary)
    if (proposal.reason && proposal.reason.toLowerCase().includes('ignore previous')) {
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
    if (!transition || transition[VERIFIED_SYMBOL] !== true) {
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
