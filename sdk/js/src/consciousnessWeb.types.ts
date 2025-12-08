import type { ThreadMap, ThreadPhase, ThreadScope, ThreadVector } from './threadLifeModel.types';

export interface ThreadLink {
  fromId: string;
  toId: string;
  kind: 'parent-child' | 'shared-tag' | 'shared-scope';
  weight: number; // 0..1 heuristic weight for influence or resonance
}

export interface WebNodeMetrics {
  threadId: string;
  energyLevel: number;
  resonanceLevel: number;
  degree: number;
  centralityScore: number;
}

export interface ConsciousnessWeb {
  ownerId: string;
  threads: ThreadVector[];
  links: ThreadLink[];
  metrics: WebNodeMetrics[];
}

export interface OrientationSector {
  id: string;
  label: string;
  scope?: ThreadScope;
  requiredTags?: string[];
}

export interface OrientationShell {
  sectors: OrientationSector[];
  activeSectorIds: string[];
}

export type { ThreadMap, ThreadVector, ThreadPhase, ThreadScope };
