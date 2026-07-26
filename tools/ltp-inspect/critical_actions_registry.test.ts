import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRITICAL_ACTIONS } from './critical_actions';

describe('critical actions registry parity', () => {
  it('keeps inspector actions equal to the canonical frozen registry', () => {
    const registryPath = path.join(
      process.cwd(),
      'docs',
      'contracts',
      'ltp-critical-actions.v0.1.json',
    );
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
      actions: Record<string, unknown>;
    };

    expect([...CRITICAL_ACTIONS].sort()).toEqual(Object.keys(registry.actions).sort());
  });
});
