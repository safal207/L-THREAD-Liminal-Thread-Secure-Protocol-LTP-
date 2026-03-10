import type { Anchor, SemanticAdmissibilityConfig } from './types';
import { loadTraceTransitions } from './trace';

export interface SemanticViolation {
  claim: string;
  reason: 'UNANCHORED_FACT' | 'DRIFT_DETECTED';
  anchor_transition_id?: string;
}

export interface SemanticCoherenceResult {
  coherent: boolean;
  drift_detected: boolean;
  violations: SemanticViolation[];
  unanchored_claims: string[];
}

function extractClaims(output: string): string[] {
  return output
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((sentence) => {
      if (!sentence) return false;
      const hasNumber = /\b\d{1,4}\b/.test(sentence);
      const hasDate = /\b\d{4}-\d{2}-\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(sentence);
      const properNouns = sentence.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
      return hasNumber || hasDate || properNouns.length >= 2;
    });
}

function claimMatchesAnchor(claim: string, anchor: Anchor): boolean {
  const a = anchor.claim.toLowerCase();
  const c = claim.toLowerCase();
  if (a.includes(c) || c.includes(a)) return true;
  const claimTokens = new Set(c.split(/[^a-z0-9]+/).filter((token) => token.length > 3));
  const anchorTokens = new Set(a.split(/[^a-z0-9]+/).filter((token) => token.length > 3));
  let overlap = 0;
  claimTokens.forEach((token) => {
    if (anchorTokens.has(token)) overlap += 1;
  });
  return overlap >= 2;
}

export function checkSemanticCoherence(
  output: string,
  declaredAnchors: Anchor[],
  traceFile: string,
  config: SemanticAdmissibilityConfig,
): SemanticCoherenceResult {
  const violations: SemanticViolation[] = [];
  const unanchored_claims: string[] = [];
  const claims = extractClaims(output);

  if (!config.enabled) {
    return { coherent: true, drift_detected: false, violations, unanchored_claims };
  }

  const transitions = loadTraceTransitions(traceFile);

  claims.forEach((claim) => {
    const mappedAnchor = declaredAnchors.find((anchor) => claimMatchesAnchor(claim, anchor));
    if (!mappedAnchor && config.check_novel_facts) {
      unanchored_claims.push(claim);
      violations.push({ claim, reason: 'UNANCHORED_FACT' });
      return;
    }

    if (mappedAnchor) {
      const transition = transitions.get(mappedAnchor.transition_id);
      if (!transition) {
        violations.push({ claim, reason: 'DRIFT_DETECTED', anchor_transition_id: mappedAnchor.transition_id });
        return;
      }
      const status = transition.status ?? '';
      if (status.includes('drift') || status.includes('rejected')) {
        violations.push({ claim, reason: 'DRIFT_DETECTED', anchor_transition_id: mappedAnchor.transition_id });
      }
    }
  });

  const drift_detected = unanchored_claims.length > 0 || violations.some((v) => v.reason === 'DRIFT_DETECTED');
  return {
    coherent: violations.length === 0,
    drift_detected,
    violations,
    unanchored_claims,
  };
}
