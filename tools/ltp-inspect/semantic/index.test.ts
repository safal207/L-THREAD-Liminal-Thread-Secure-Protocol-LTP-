import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runTwoPhaseInspection } from './index';
import type { Anchor, LTPProvenanceConfig } from './types';

const traceFile = path.join(__dirname, '..', 'fixtures', 'semantic', 'trace-semantic.jsonl');
const anchors: Anchor[] = [{ claim: 'Paris is the capital of France in 2024', transition_id: 't1', hash_snippet: '12345678' }];
const config: LTPProvenanceConfig = {
  provenance_enforcement: {
    mode: 'two_phase',
    require_explicit_provenance: true,
    block_on_missing: 'post',
    strict_anchor_validation: true,
  },
  semantic_admissibility: {
    enabled: true,
    check_novel_facts: true,
  },
};

describe('Two-phase orchestration', () => {
  it('proceeds in two-phase mode for coherent output', () => {
    const result = runTwoPhaseInspection(anchors, 'Paris is the capital of France in 2024.', traceFile, config);
    expect(result.decision).toBe('PROCEED');
  });

  it('rejects fabricated anchor in pre mode', () => {
    const result = runTwoPhaseInspection([{ claim: 'x', transition_id: 'nope' }], null, traceFile, {
      ...config,
      provenance_enforcement: { ...config.provenance_enforcement, mode: 'pre' },
    });
    expect(result.decision).toBe('REJECT');
  });
});
