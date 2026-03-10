import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSemanticCoherence } from './phase2';
import type { Anchor } from './types';

const traceFile = path.join(__dirname, '..', 'fixtures', 'semantic', 'trace-semantic.jsonl');
const anchors: Anchor[] = [{ claim: 'Paris is the capital of France in 2024', transition_id: 't1' }];

describe('Phase 2 - Semantic Coherence', () => {
  it('passes coherent output anchored to declared transitions', () => {
    const output = 'Paris is the capital of France in 2024.';
    const result = checkSemanticCoherence(output, anchors, traceFile, { enabled: true, check_novel_facts: true });
    expect(result.coherent).toBe(true);
  });

  it('flags novel factual claim with no anchor (check_novel_facts=true)', () => {
    const output = 'Tokyo hosted 10 events in 2025.';
    const result = checkSemanticCoherence(output, anchors, traceFile, { enabled: true, check_novel_facts: true });
    expect(result.unanchored_claims.length).toBe(1);
    expect(result.drift_detected).toBe(true);
  });

  it('allows novel claim when check_novel_facts=false', () => {
    const output = 'Tokyo hosted 10 events in 2025.';
    const result = checkSemanticCoherence(output, anchors, traceFile, { enabled: true, check_novel_facts: false });
    expect(result.coherent).toBe(true);
  });

  it('detects semantic drift from previously committed state', () => {
    const output = 'Paris is the capital of France in 2024.';
    const driftAnchors: Anchor[] = [{ claim: 'Paris is the capital of France in 2024', transition_id: 'missing' }];
    const result = checkSemanticCoherence(output, driftAnchors, traceFile, { enabled: true, check_novel_facts: false });
    expect(result.violations.some((violation) => violation.reason === 'DRIFT_DETECTED')).toBe(true);
  });

  it('passes when all claims map to phase1-validated anchors', () => {
    const output = 'Paris is the capital of France in 2024. Paris remained stable in 2024.';
    const result = checkSemanticCoherence(output, anchors, traceFile, { enabled: true, check_novel_facts: true });
    expect(result.coherent).toBe(true);
  });
});
