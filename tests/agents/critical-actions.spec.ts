import { expect, describe, it } from 'vitest';
import { AgentPipeline } from '../../agents/reference-agent/pipeline';
import { AgentEvent, ProposedTransition, ActionResult, VerifiedTransition, ReasonCodes } from '../../agents/reference-agent/types';
import * as crypto from 'crypto';

// Mocks
const mockProposalEngine = (context: string, targetState: string) => async (event: AgentEvent): Promise<ProposedTransition> => {
  return {
    id: crypto.randomUUID(),
    eventId: event.id,
    targetState,
    reason: 'Testing purpose',
    context: event.type as any
  };
};

const mockExecutor = async (t: VerifiedTransition): Promise<ActionResult> => {
  return {
    success: true,
    traceId: t.traceId,
    newState: t.targetState
  };
};

describe('Agent Safety (v0.1) - Critical Actions', () => {

  const criticalActions = ['transfer_money', 'delete_data', 'send_email', 'approve_trade'];

  criticalActions.forEach(action => {
    it(`should BLOCK critical action '${action}' from WEB context`, async () => {
      const pipeline = new AgentPipeline(
        mockProposalEngine('WEB', action),
        mockExecutor
      );

      const event: AgentEvent = {
        id: 'evt-1',
        type: 'WEB',
        content: 'Malicious payload',
        timestamp: Date.now()
      };

      const result = await pipeline.process(event);

      expect(result.result).to.equal('BLOCKED');
      expect(result.details.reasonCode).to.equal(ReasonCodes.WEB_ORIGIN_FORBIDDEN_FOR_CRITICAL_ACTION);
    });
  });

  it('should ALLOW critical action from USER context', async () => {
      const action = 'transfer_money';
      const pipeline = new AgentPipeline(
        mockProposalEngine('USER', action),
        mockExecutor
      );

      const event: AgentEvent = {
        id: 'evt-2',
        type: 'USER',
        content: 'User command',
        timestamp: Date.now()
      };

      const result = await pipeline.process(event);

      expect(result.result).to.equal('ALLOWED');
  });

  it('should BLOCK globally banned action from ANY context', async () => {
      const action = 'rm -rf /';
      const pipeline = new AgentPipeline(
        mockProposalEngine('USER', action),
        mockExecutor
      );

      const event: AgentEvent = {
        id: 'evt-3',
        type: 'USER',
        content: 'User mistake',
        timestamp: Date.now()
      };

      const result = await pipeline.process(event);

      expect(result.result).to.equal('BLOCKED');
      expect(result.details.reasonCode).to.equal(ReasonCodes.GLOBAL_SAFETY_VIOLATION);
  });
});
