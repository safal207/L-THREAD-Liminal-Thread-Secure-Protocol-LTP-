
import {
  AgentEvent,
  ContextType,
  ProposedTransition,
  VerifiedTransition,
  ActionResult,
  AdmissibilityResult
} from './types';
import { LTPAdmissibilityChecker, ActionBoundary } from './enforcement';
import { EnforcementError } from './errors';
import * as crypto from 'crypto';

/**
 * A simple Classifier to determine context.
 */
export class ContextClassifier {
  classify(event: AgentEvent): ContextType {
    // Simple mock logic based on event type provided or content analysis
    if (event.type) return event.type;
    return 'USER'; // Default
  }
}

/**
 * The Reference Pipeline orchestrates the flow:
 * Event -> Proposed -> Check -> Action
 */
export class AgentPipeline {
  private admissibility: LTPAdmissibilityChecker;
  private boundary: ActionBoundary;
  private classifier: ContextClassifier;

  // Dependencies for "Planning" and "Execution" would be injected here
  // For the reference implementation, we allow passing a proposer function
  private proposalEngine: (event: AgentEvent) => Promise<ProposedTransition>;
  private actionExecutor: (transition: VerifiedTransition) => Promise<ActionResult>;

  constructor(
    proposalEngine: (event: AgentEvent) => Promise<ProposedTransition>,
    actionExecutor: (transition: VerifiedTransition) => Promise<ActionResult>
  ) {
    this.admissibility = new LTPAdmissibilityChecker();
    this.boundary = new ActionBoundary();
    this.classifier = new ContextClassifier();
    this.proposalEngine = proposalEngine;
    this.actionExecutor = actionExecutor;
  }

  async process(event: AgentEvent): Promise<{ result: 'ALLOWED' | 'BLOCKED', traceId: string, details: any }> {
    // 1. Context Classification
    const context = this.classifier.classify(event);
    // console.log(`[LTP] Context classified as: ${context}`);

    // 2. Propose Transition (Cognition Layer)
    // The "LLM" proposes, it does NOT execute.
    const proposal = await this.proposalEngine(event);

    // 3. Admissibility Check (LTP Layer)
    const checkResult: AdmissibilityResult = await this.admissibility.check(proposal);

    if (!checkResult.admissible) {
      // Blocked
      return {
        result: 'BLOCKED',
        traceId: checkResult.traceId,
        details: {
          reason: checkResult.reason,
          violation: 'violationType' in checkResult ? checkResult.violationType : undefined
        }
      };
    }

    // 4. Execution (Action Layer)
    // Must pass through the boundary
    const verifiedTransition = checkResult as VerifiedTransition;

    try {
      const result = await this.boundary.execute(verifiedTransition, this.actionExecutor);
      return {
        result: 'ALLOWED',
        traceId: verifiedTransition.traceId,
        details: {
          actionResult: result
        }
      };
    } catch (e) {
       if (e instanceof EnforcementError) {
         // This is critical - should theoretically never happen if pipeline is correct
         // but ensures we catch bypass attempts in compromised runtimes.
         console.error('CRITICAL: Enforcement Boundary Violation Attempted');
         throw e;
       }
       throw e;
    }
  }
}
