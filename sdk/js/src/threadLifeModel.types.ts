/**
 * Thread Life Model types for semantic thread trajectories
 */

export type ThreadPhase =
  | 'birth'
  | 'active'
  | 'weakening'
  | 'switching'
  | 'archived';

export type ThreadScope =
  | 'individual'
  | 'family'
  | 'project'
  | 'system';

export interface ThreadVector {
  threadId: string;
  parentThreadId?: string;
  scope: ThreadScope;
  label?: string;
  createdAt: string;
  updatedAt: string;
  phase: ThreadPhase;
  /** 0..1 — how much energy / attention still flows into this thread */
  energyLevel: number;
  /** 0..1 — how resonant this thread is with its environment */
  resonanceLevel: number;
  /** free-form tags: "family", "liminal-os", "career", etc. */
  tags?: string[];
  /** optional external mapping (e.g. to L-EDGE, layers, OS components) */
  externalRef?: {
    system?: string;
    layerIds?: string[];
  };
}

export interface ThreadEvent {
  type:
    | 'goal-updated'
    | 'stress-increase'
    | 'relief'
    | 'new-opportunity'
    | 'family-resonance'
    | 'drop-in-attention'
    | 'success'
    | 'shutdown-request';
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface ThreadLifeTransition {
  from: ThreadPhase;
  to: ThreadPhase;
  reason: string;
}

export interface ThreadMap {
  ownerId: string;
  threads: ThreadVector[];
}
