import type { SectorId } from './types';

export type OrientationPhase = 'rising' | 'stable' | 'falling';

export interface OrientationWebSector {
  id: SectorId;
  /** 0..1 — how much stress or tightness is present */
  tension: number;
  /** 0..1 — how much this sector currently pulls attention */
  pull: number;
  /** 0..1 — how coherent / aligned this sector is */
  resonance: number;
  phase: OrientationPhase;
}

export interface OrientationWeb {
  sectors: Record<SectorId, OrientationWebSector>;
  activeSectorId: SectorId;
}

export interface OrientationWebUpdate {
  sectorId: SectorId;
  deltaTension?: number;
  deltaPull?: number;
  deltaResonance?: number;
  newPhase?: OrientationPhase;
}
