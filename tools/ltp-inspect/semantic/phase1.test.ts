import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateAnchors } from './phase1';
import type { Anchor } from './types';

const traceFile = path.join(__dirname, '..', 'fixtures', 'semantic', 'trace-semantic.jsonl');

describe('Phase 1 - Anchor Validation', () => {
  it('passes when all anchors exist in trace', () => {
    const anchors: Anchor[] = [{ claim: 'Paris is the capital of France', transition_id: 't1' }];
    const result = validateAnchors(anchors, traceFile, { require_explicit_provenance: true, strict_anchor_validation: false });
    expect(result.valid).toBe(true);
  });

  it('rejects fabricated transition_id not in trace', () => {
    const result = validateAnchors([{ claim: 'fake', transition_id: 'zzz' }], traceFile, { require_explicit_provenance: false, strict_anchor_validation: false });
    expect(result.valid).toBe(false);
    expect(result.errors[0].reason).toBe('NOT_FOUND');
  });

  it('rejects anchor with hash_snippet mismatch (strict mode)', () => {
    const result = validateAnchors([{ claim: 'Paris', transition_id: 't1', hash_snippet: 'deadbeef' }], traceFile, {
      require_explicit_provenance: false,
      strict_anchor_validation: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.reason === 'HASH_MISMATCH')).toBe(true);
  });

  it('rejects anchor in drifted branch', () => {
    const result = validateAnchors([{ claim: 'Mars', transition_id: 't2' }], traceFile, { require_explicit_provenance: false, strict_anchor_validation: false });
    expect(result.errors.some((error) => error.reason === 'INADMISSIBLE')).toBe(true);
  });

  it('rejects empty anchors when require_explicit_provenance=true', () => {
    const result = validateAnchors([], traceFile, { require_explicit_provenance: true, strict_anchor_validation: false });
    expect(result.valid).toBe(false);
    expect(result.errors[0].reason).toBe('NO_ANCHORS_DECLARED');
    expect(result.errors[0].transition_id).toBeUndefined();
  });

  it('passes empty anchors when require_explicit_provenance=false', () => {
    const result = validateAnchors([], traceFile, { require_explicit_provenance: false, strict_anchor_validation: false });
    expect(result.valid).toBe(true);
  });

  it('warns on missing hash_snippet in non-strict mode', () => {
    const result = validateAnchors([{ claim: 'Paris', transition_id: 't1' }], traceFile, { require_explicit_provenance: false, strict_anchor_validation: false });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
