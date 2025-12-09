import type { OrientationWeb, OrientationWebSector } from '../orientation/orientationWeb.types';
import type { TimeTick } from '../time/timeWeaveTypes';

export type TemporalTrend = 'rising' | 'falling' | 'plateau' | 'mixed';

export interface SectorTemporalSnapshot {
  sectorId: string;
  branchId?: string;
  lastTick?: TimeTick;
  lastIntensity?: number;
  branchTrend?: TemporalTrend;
  isActive: boolean;
  sourceSector?: OrientationWebSector;
}

export interface TemporalOrientationSummary {
  globalTrend: TemporalTrend;
  activeSectorCount: number;
  risingSectors: string[];
  fallingSectors: string[];
  plateauSectors: string[];

  /**
   * Optional TimeWeave depth indicator forwarded from TimeWeaveSummary.
   */
  timeWeaveDepthScore?: number;

  /**
   * Global momentum of focus in the TimeWeave.
   * Range: -1..1 (negative = dissipating, positive = concentrating focus).
   */
  focusMomentumScore?: number;
}

export interface TemporalOrientationView {
  web: OrientationWeb;
  sectors: SectorTemporalSnapshot[];
  summary: TemporalOrientationSummary;
}

export interface NextThreadSuggestion {
  fromSectorId: string;
  suggestedSectorId?: string;
  reason: string;
}
