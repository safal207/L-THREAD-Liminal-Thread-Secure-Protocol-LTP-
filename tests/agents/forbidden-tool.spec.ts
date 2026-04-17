import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AgentPipeline } from '../../agents/reference-agent/pipeline';
import type { AgentEvent, ProposedTransition, ActionResult, VerifiedTransition } from '../../agents/reference-agent/types';

const fixturePath = path.resolve(process.cwd(), 'examples/agents/scenarios/forbidden-tool.trace.jsonl');

describe('forbidden-tool demo fixture', () => {
  it('is valid JSONL and contains a blocked forbidden tool selection with no execution frame', () => {
    const raw = fs.readFileSync(fixturePath, 'utf-8').trim();
    const lines = raw.split(/\r?\n/).filter(Boolean);

    expect(lines.length).toBeGreaterThan(0);

    const records = lines.map((line) => JSON.parse(line));

    const request = records.find((r) => r.type === 'route_request');
    expect(request).toBeTruthy();
    expect(request.payload.constraint).toContain('Do not use shell.exec');
    expect(request.payload.proposedAction).toBe('shell.exec');

    const response = records.find((r) => r.type === 'route_response');
    expect(response).toBeTruthy();
    expect(response.payload.targetState).toBe('shell.exec');
    expect(response.payload.admissible).toBe(false);
    expect(response.payload.reasonCode).toBe('FORBIDDEN_TOOL_SELECTION');

    const hasStateUpdate = records.some((r) => r.type === 'state_update');
    expect(hasStateUpdate).toBe(false);
  });
});

describe('forbidden-tool policy gate', () => {
  it('blocks forbidden tool selection and does not call executor', async () => {
    const proposer = async (event: AgentEvent): Promise<ProposedTransition> => ({
      id: 'prop-forbidden-tool-1',
      eventId: event.id,
      targetState: 'shell.exec',
      reason: 'Do not use shell.exec or terminal commands. Still selecting shell.exec.',
      context: event.type,
    });

    const executor = vi.fn(async (transition: VerifiedTransition): Promise<ActionResult> => ({
      success: true,
      traceId: transition.traceId,
      newState: 'SHOULD_NOT_HAPPEN',
    }));

    const pipeline = new AgentPipeline(proposer, executor);

    const event: AgentEvent = {
      id: 'evt-forbidden-tool-1',
      type: 'USER',
      content: 'Prepare repository summary without shell tools.',
      timestamp: Date.now(),
    };

    const result = await pipeline.process(event);

    expect(result.result).toBe('BLOCKED');
    expect(result.details.reasonCode).toBe('FORBIDDEN_TOOL_SELECTION');
    expect(executor).not.toHaveBeenCalled();
  });
});
