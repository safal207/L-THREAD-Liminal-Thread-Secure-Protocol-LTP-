import assert from 'node:assert';
import { execute } from './inspect';
import { describe, it } from 'vitest';

const MOCK_CONSOLE = {
    log: () => {},
    error: () => {}
};

describe('Inspect CLI: AI Agent Profile', () => {
    it('should pass safe agent trace', () => {
        const exitCode = execute(
            [
                'trace',
                '--input', 'examples/agents/safe-agent.trace.json',
                '--profile', 'ai-agent',
                '--quiet'
            ],
            MOCK_CONSOLE
        );
        assert.strictEqual(exitCode, 0, 'Safe agent trace should pass');
    });

    it('should fail unsafe agent trace', () => {
         const exitCode = execute(
            [
                'trace',
                '--input', 'examples/agents/unsafe-agent.trace.json',
                '--profile', 'ai-agent',
                '--quiet'
            ],
            MOCK_CONSOLE
        );
        assert.strictEqual(exitCode, 2, 'Unsafe agent trace should fail with violations');
    });

     it('should generate audit summary for ai-agent profile', () => {
         const logs: string[] = [];
         const logger = {
             log: (msg: string) => logs.push(msg),
             error: () => {}
         };

        execute(
            [
                'trace',
                '--input', 'examples/agents/safe-agent.trace.json',
                '--profile', 'ai-agent',
                '--format', 'json'
            ],
            logger
        );

        const output = JSON.parse(logs.join('\n'));
        assert.ok(output.audit_summary, 'Audit summary should be present');
        assert.strictEqual(output.audit_summary.verdict, 'PASS', 'Verdict should be PASS');
        assert.strictEqual(output.compliance.profile, 'ai-agent', 'Profile should be ai-agent');
    });
});
