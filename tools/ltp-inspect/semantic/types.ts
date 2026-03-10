export type InspectionMode = 'audit_only' | 'post' | 'pre' | 'two_phase';

export interface Anchor {
  claim: string;
  transition_id: string;
  chunk_id?: string;
  hash_snippet?: string;
}

export interface ProvenanceConfig {
  require_explicit_provenance: boolean;
  strict_anchor_validation: boolean;
}

export interface SemanticAdmissibilityConfig {
  enabled: boolean;
  check_novel_facts: boolean;
}

export interface LTPProvenanceConfig {
  provenance_enforcement: {
    mode: InspectionMode;
    require_explicit_provenance: boolean;
    block_on_missing: 'pre' | 'post' | 'audit_only';
    strict_anchor_validation: boolean;
  };
  semantic_admissibility: SemanticAdmissibilityConfig;
}

export interface TraceTransition {
  transition_id: string;
  chunk_ids: Set<string>;
  hash?: string;
  status?: string;
  textBlob: string;
}
