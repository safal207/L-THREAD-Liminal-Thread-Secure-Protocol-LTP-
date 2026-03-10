import { checkSemanticCoherence, type SemanticCoherenceResult } from './phase2';
import { validateAnchors, type AnchorValidationResult } from './phase1';
import type { Anchor, InspectionMode, LTPProvenanceConfig } from './types';

export type { InspectionMode } from './types';

export interface TwoPhaseResult {
  phase1: AnchorValidationResult | null;
  phase2: SemanticCoherenceResult | null;
  decision: 'PROCEED' | 'REJECT' | 'BLOCK' | 'AUDIT';
  reason?: string;
}

export function runTwoPhaseInspection(
  anchors: Anchor[],
  output: string | null,
  traceFile: string,
  config: LTPProvenanceConfig,
): TwoPhaseResult {
  const mode: InspectionMode = config.provenance_enforcement.mode ?? 'post';

  const phase1 = mode === 'post' ? null : validateAnchors(anchors, traceFile, config.provenance_enforcement);
  const phase2 = mode === 'pre' ? null : checkSemanticCoherence(output ?? '', anchors, traceFile, config.semantic_admissibility);

  if (mode === 'audit_only') {
    return { phase1, phase2, decision: 'AUDIT' };
  }

  if (mode === 'pre') {
    if (phase1 && !phase1.valid) return { phase1, phase2: null, decision: 'REJECT', reason: 'Phase 1 anchor validation failed' };
    return { phase1, phase2: null, decision: 'PROCEED' };
  }

  if (mode === 'post') {
    if (phase2 && !phase2.coherent) return { phase1: null, phase2, decision: 'BLOCK', reason: 'Phase 2 semantic coherence failed' };
    return { phase1: null, phase2, decision: 'PROCEED' };
  }

  if (phase1 && !phase1.valid) return { phase1, phase2: null, decision: 'REJECT', reason: 'Phase 1 anchor validation failed' };
  if (phase2 && !phase2.coherent) return { phase1, phase2, decision: 'BLOCK', reason: 'Phase 2 semantic coherence failed' };

  return { phase1, phase2, decision: 'PROCEED' };
}
