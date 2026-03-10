import type { Anchor, AnchorError, ProvenanceConfig } from './types';
import { loadTraceTransitions } from './trace';

export interface AnchorWarning {
  claim: string;
  transition_id: string;
  reason: 'MISSING_HASH_SNIPPET';
}


export interface AnchorValidationResult {
  valid: boolean;
  errors: AnchorError[];
  warnings: AnchorWarning[];
}

export function validateAnchors(
  anchors: Anchor[],
  traceFile: string,
  config: ProvenanceConfig,
): AnchorValidationResult {
  const errors: AnchorError[] = [];
  const warnings: AnchorWarning[] = [];

  if (config.require_explicit_provenance && anchors.length === 0) {
    errors.push({ claim: 'NO_ANCHORS_DECLARED', reason: 'NO_ANCHORS_DECLARED' });
  }

  const transitions = loadTraceTransitions(traceFile);

  anchors.forEach((anchor) => {
    const transition = transitions.get(anchor.transition_id);
    if (!transition) {
      errors.push({ claim: anchor.claim, transition_id: anchor.transition_id, reason: 'NOT_FOUND' });
      return;
    }

    if (anchor.chunk_id && !transition.chunk_ids.has(anchor.chunk_id)) {
      errors.push({ claim: anchor.claim, transition_id: anchor.transition_id, reason: 'NOT_FOUND' });
    }

    if (anchor.hash_snippet) {
      if (config.strict_anchor_validation && transition.hash && !transition.hash.startsWith(anchor.hash_snippet)) {
        errors.push({ claim: anchor.claim, transition_id: anchor.transition_id, reason: 'HASH_MISMATCH' });
      }
    } else if (!config.strict_anchor_validation) {
      warnings.push({ claim: anchor.claim, transition_id: anchor.transition_id, reason: 'MISSING_HASH_SNIPPET' });
    }

    const status = transition.status ?? '';
    if (status.includes('rejected')) {
      errors.push({ claim: anchor.claim, transition_id: anchor.transition_id, reason: 'IN_REJECTED_BRANCH' });
    }
    if (status.includes('drifted') || status.includes('drift')) {
      errors.push({ claim: anchor.claim, transition_id: anchor.transition_id, reason: 'INADMISSIBLE' });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
