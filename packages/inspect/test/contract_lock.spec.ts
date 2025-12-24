import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect, beforeAll } from 'vitest';
import { CRITICAL_ACTIONS, AGENT_RULES } from '../../../tools/ltp-inspect/critical_actions';

// Adjust path based on execution context (vitest runs from root usually, but check)
// If __dirname is package/inspect/test, then ../../docs/contracts... is correct relative to file.
const REGISTRY_PATH = path.resolve(__dirname, '../../../docs/contracts/ltp-critical-actions.v0.1.json');

describe('Contract Lock: Critical Actions', () => {
  let registry: any;

  beforeAll(() => {
    if (!fs.existsSync(REGISTRY_PATH)) {
      throw new Error(`Registry file not found: ${REGISTRY_PATH}`);
    }
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  });

  test('Code must match Registry for Critical Actions', () => {
    const registryActions = Object.keys(registry.actions).sort();
    const codeActions = [...CRITICAL_ACTIONS].sort();

    expect(codeActions).toEqual(registryActions);
  });

  test('Code must match Registry for Rules', () => {
    const registryRules = Object.keys(registry.rules).sort();
    const codeRules = Object.values(AGENT_RULES).sort();

    expect(codeRules).toEqual(registryRules);
  });
});
