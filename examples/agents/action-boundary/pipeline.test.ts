import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline';

describe('Action Boundary Pipeline', () => {
    it('blocks WEB origin critical actions (AGENTS.CRIT.WEB_DIRECT)', async () => {
        const trace = await runPipeline({
            id: 'test-1',
            source: 'WEB',
            payload: { intent: 'pay' }
        });

        const response = trace.find(f => f.type === 'route_response');
        expect(response).toBeDefined();
        expect(response?.payload.admissible).toBe(false);
        expect(response?.payload.reasonCode).toBe('AGENTS.CRIT.WEB_DIRECT');

        const execution = trace.find(f => f.type === 'state_update');
        expect(execution).toBeUndefined();
    });

    it('allows USER origin critical actions', async () => {
        const trace = await runPipeline({
            id: 'test-2',
            source: 'USER',
            payload: { intent: 'pay' }
        });

        const response = trace.find(f => f.type === 'route_response');
        expect(response).toBeDefined();
        expect(response?.payload.admissible).toBe(true);

        const execution = trace.find(f => f.type === 'state_update');
        expect(execution).toBeDefined();
    });
});
