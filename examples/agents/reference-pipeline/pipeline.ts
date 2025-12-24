
import {
  AgentEvent,
  ContextType,
  ProposedTransition,
  VerifiedTransition,
  ActionResult,
  AdmissibilityResult
} from './types';
import { LTPAdmissibilityChecker, ActionBoundary, EnforcementError } from './enforcement';
import { HashChainLogger } from './logger';
import * as crypto from 'crypto';

export class AgentPipeline {
  private admissibility: LTPAdmissibilityChecker;
  private boundary: ActionBoundary;
  private logger: HashChainLogger;

  // Dependencies
  private proposalEngine: (event: AgentEvent) => Promise<ProposedTransition>;
  private actionExecutor: (transition: VerifiedTransition) => Promise<ActionResult>;

  constructor(
    proposalEngine: (event: AgentEvent) => Promise<ProposedTransition>,
    actionExecutor: (transition: VerifiedTransition) => Promise<ActionResult>
  ) {
    this.admissibility = new LTPAdmissibilityChecker();
    this.boundary = new ActionBoundary();
    this.logger = new HashChainLogger();
    this.proposalEngine = proposalEngine;
    this.actionExecutor = actionExecutor;
  }

  async process(event: AgentEvent): Promise<{ result: 'ALLOWED' | 'BLOCKED', traceId?: string, details?: any }> {
    const traceId = crypto.randomUUID(); // Pipeline level trace ID

    // 1. Ingest Event
    this.logger.append('EVENT', event, traceId);

    // 2. Propose Transition (Cognition)
    const proposal = await this.proposalEngine(event);
    this.logger.append('PROPOSAL', proposal, traceId);

    // 3. Admissibility Check (LTP)
    const checkResult: AdmissibilityResult = await this.admissibility.check(proposal);

    this.logger.append('CHECK', checkResult, traceId);

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

    // 4. Execution (Action)
    const verifiedTransition = checkResult as VerifiedTransition;

    // REPLAY CHECK
    if (this.logger.hasProcessed(verifiedTransition.traceId)) {
        console.error("REPLAY DETECTED");
        return { result: 'BLOCKED', details: { reason: "Replay Detected" } };
    }

    try {
      const result = await this.boundary.execute(verifiedTransition, this.actionExecutor);
      this.logger.append('ACTION', result, traceId);

      return {
        result: 'ALLOWED',
        traceId: verifiedTransition.traceId,
        details: {
          actionResult: result
        }
      };
    } catch (e) {
       if (e instanceof EnforcementError) {
         console.error('CRITICAL: Enforcement Boundary Violation Attempted');
       }
       throw e;
    }
  }

  getAuditLog() {
    return this.logger.getLog();
  }
}
