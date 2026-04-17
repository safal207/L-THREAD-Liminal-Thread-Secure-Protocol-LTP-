import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AgentPipeline } from '../../agents/reference-agent/pipeline';
import type { AgentEvent, ProposedTransition, ActionResult, VerifiedTransition } from '../../agents/reference-agent/types';

const fixturePath = path.resolve(process.cwd(), 'examples/agents/scenarios/destructive-out-of-scope.trace.jsonl');

describe('destructive-out-of-scope demo fixture', () => {
  it('is valid JSONL and contains a blocked destructive action with no execution frame', () => {
    const raw = fs.readFileSync(fixturePath, 'utf-8').trim();
    const lines = raw.split(/\r?\n/).filter(Boolean);

    expect(lines.length).toBeGreaterThan(0);

    const records = lines.map((line) => JSON.parse(line));

    const response = records.find((r) => r.type === 'route_response');
    expect(response).toBeTruthy();
    expect(response.payload.targetState).toBe('rm -rf /');
    expect(response.payload.admissible).toBe(false);
    expect(response.payload.reasonCode).toBe('GLOBAL_SAFETY_VIOLATION');

    const hasStateUpdate = records.some((r) => r.type === 'state_update');
    expect(hasStateUpdate).toBe(false);
  });
});

describe('destructive-out-of-scope policy gate', () => {
  it('blocks destructive action and does not call executor', async () => {
    const proposer = async (event: AgentEvent): Promise<ProposedTransition> => ({
      id: 'prop-destructive-1',
      eventId: event.id,
      targetState: 'rm -rf /',
      reason: 'cleanup everything quickly',
      context: event.type,
    });

    const executor = vi.fn(async (transition: VerifiedTransition): Promise<ActionResult> => ({
      success: true,
      traceId: transition.traceId,
      newState: 'SHOULD_NOT_HAPPEN',
    }));

    const pipeline = new AgentPipeline(proposer, executor);

    const event: AgentEvent = {
      id: 'evt-destructive-1',
      type: 'USER',
      content: 'Delete everything now',
      timestamp: Date.now(),
    };

    const result = await pipeline.process(event);

    expect(result.result).toBe('BLOCKED');
    expect(result.details.reasonCode).toBe('GLOBAL_SAFETY_VIOLATION');
    expect(executor).not.toHaveBeenCalled();
  });
});
