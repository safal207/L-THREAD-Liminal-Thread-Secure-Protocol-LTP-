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

export type ConsciousnessZone = 'calm' | 'growth' | 'recovery' | 'storm' | 'shift';

export interface TimeAnchor {
  offset: number; // relative step, negative for history, positive for projection
  label: string;
  confidence?: number; // 0..1
}

export interface FuturePath {
  role: 'primary' | 'recover' | 'explore' | string;
  label: string;
  path: ConsciousnessZone[];
  probability: number; // 0..1
}

export interface ConsciousnessSnapshot {
  orientation: ConsciousnessZone;
  focusMomentum: number;
  volatility: number;
  resilience: number;
  tension: number;
  turbulenceZones?: ConsciousnessZone[];
  timeAnchors: TimeAnchor[];
  futurePaths: FuturePath[];
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
