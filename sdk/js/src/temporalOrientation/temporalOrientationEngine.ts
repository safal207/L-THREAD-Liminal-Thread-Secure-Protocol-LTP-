import type { OrientationWeb, OrientationWebSector } from '../orientation/orientationWeb.types';
import {
  computeBranchTrend,
  computeFocusMomentumScore,
  computeTimeWeaveSummary,
  getBranch,
} from '../time/timeWeave';
import type { TimeBranch, TimeWeave } from '../time/timeWeaveTypes';
import { anchorEventsBatch } from '../timeAnchors/timeAnchorEngine';
import type { OrientationEvent, TimeAnchorContext } from '../timeAnchors/timeAnchorTypes';
import type {
  SectorTemporalSnapshot,
  NextThreadSuggestion,
  TemporalOrientationSummary,
  TemporalOrientationView,
  TemporalTrend,
} from './temporalOrientationTypes';

function clampIntensity(intensity: number | undefined): number | undefined {
  if (typeof intensity !== 'number') {
    return undefined;
  }

  if (intensity < 0) {
    return 0;
  }

  if (intensity > 1) {
    return 1;
  }

  return intensity;
}

/**
 * Maps a sector / thread / node from the Orientation Web world
 * to a TimeWeave branchId (ThreadId).
 *
 * Currently, OrientationWebSector carries an `id` string which is reused as the threadId.
 * If the Orientation Web introduces a dedicated thread mapping later, this helper is the
 * single place to update the convention.
 */
export function mapSectorToBranchId(sector: OrientationWebSector): string {
  return sector.id;
}

export interface TemporalOrientationBuildResult {
  view: TemporalOrientationView;
  weave: TimeWeave;
}

/**
 * High-level helper that stitches OrientationWeb + OrientationEvents + TimeWeave
 * into a ready TemporalOrientationView.
 *
 * - Anchors incoming events into the weave (unless the list is empty, then it is a no-op).
 * - Builds a view from the updated weave so higher layers can reason about temporal trends.
 */
export function buildViewFromWebAndAnchors(
  web: OrientationWeb,
  events: OrientationEvent[],
  weave: TimeWeave,
  ctx?: Omit<TimeAnchorContext, 'weave'>,
): TemporalOrientationBuildResult {
  const hasEvents = Array.isArray(events) && events.length > 0;
  const anchorContext: TimeAnchorContext = { weave, ...(ctx ?? {}) };
  const updatedWeave = hasEvents ? anchorEventsBatch(events, anchorContext) : weave;
  const view = buildTemporalOrientationView(web, updatedWeave);

  return { view, weave: updatedWeave };
}

function getBranchSnapshot(branch: TimeBranch | undefined) {
  if (!branch || branch.nodes.length === 0) {
    return { lastTick: undefined, lastIntensity: undefined, branchTrend: undefined as TemporalTrend | undefined };
  }

  const lastNode = branch.nodes[branch.nodes.length - 1];

  if (!lastNode) {
    return { lastTick: undefined, lastIntensity: undefined, branchTrend: undefined };
  }
  const branchTrend = computeBranchTrend(branch) as TemporalTrend;

  return {
    lastTick: lastNode.tick,
    lastIntensity: clampIntensity(lastNode.intensity),
    branchTrend,
  };
}

export function buildSectorTemporalSnapshot(
  sector: OrientationWebSector,
  weave: TimeWeave,
): SectorTemporalSnapshot {
  const branchId = mapSectorToBranchId(sector);
  const branch = getBranch(weave, branchId);
  const { lastTick, lastIntensity, branchTrend } = getBranchSnapshot(branch);

  const intensityValue = lastIntensity ?? 0;
  const isActive = intensityValue > 0.3;

  return {
    sectorId: sector.id,
    branchId: branch ? branch.threadId : branchId,
    lastTick,
    lastIntensity,
    branchTrend,
    isActive,
    sourceSector: sector,
  };
}

function deriveGlobalTrend(trends: TemporalTrend[]): TemporalTrend {
  if (trends.length === 0) {
    return 'plateau';
  }

  const counts = trends.reduce(
    (acc, trend) => {
      acc[trend] = (acc[trend] ?? 0) + 1;
      return acc;
    },
    { rising: 0, falling: 0, plateau: 0, mixed: 0 } as Record<TemporalTrend, number>,
  );

  const majorityThreshold = Math.floor(trends.length / 2) + 1;

  if (counts.rising >= majorityThreshold) {
    return 'rising';
  }

  if (counts.falling >= majorityThreshold) {
    return 'falling';
  }

  if (counts.plateau >= majorityThreshold) {
    return 'plateau';
  }

  if (counts.mixed > 0) {
    return 'mixed';
  }

  return 'mixed';
}

function buildSummary(snapshots: SectorTemporalSnapshot[]): TemporalOrientationSummary {
  const risingSectors: string[] = [];
  const fallingSectors: string[] = [];
  const plateauSectors: string[] = [];
  const observedTrends: TemporalTrend[] = [];

  snapshots.forEach((snapshot) => {
    if (snapshot.branchTrend) {
      observedTrends.push(snapshot.branchTrend);

      if (snapshot.branchTrend === 'rising') {
        risingSectors.push(snapshot.sectorId);
      } else if (snapshot.branchTrend === 'falling') {
        fallingSectors.push(snapshot.sectorId);
      } else if (snapshot.branchTrend === 'plateau') {
        plateauSectors.push(snapshot.sectorId);
      }
    }
  });

  const globalTrend = deriveGlobalTrend(observedTrends);
  const activeSectorCount = snapshots.filter((item) => item.isActive).length;

  return {
    globalTrend,
    activeSectorCount,
    risingSectors,
    fallingSectors,
    plateauSectors,
  };
}

export function buildTemporalOrientationView(web: OrientationWeb, weave: TimeWeave): TemporalOrientationView {
  const sectors = Object.values(web.sectors).map((sector) => buildSectorTemporalSnapshot(sector, weave));
  const summary = buildSummary(sectors);
  const weaveSummary = computeTimeWeaveSummary(weave);
  const focusMomentumScore = computeFocusMomentumScore(weave);
  const summaryWithDepth: TemporalOrientationSummary = {
    ...summary,
    timeWeaveDepthScore: weaveSummary.depthScore,
    focusMomentumScore,
  };

  return {
    web,
    sectors,
    summary: summaryWithDepth,
  };
}

export function suggestNextSector(
  view: TemporalOrientationView,
  currentSectorId: string,
): NextThreadSuggestion {
  const currentSnapshot = view.sectors.find((item) => item.sectorId === currentSectorId);
  const risingTarget = view.summary.risingSectors[0];

  if (currentSnapshot?.branchTrend === 'falling' && risingTarget) {
    return {
      fromSectorId: currentSectorId,
      suggestedSectorId: risingTarget,
      reason: 'Current sector is falling; shifting towards a rising sector may stabilize orientation.',
    };
  }

  if (currentSnapshot?.branchTrend === 'plateau' && risingTarget) {
    return {
      fromSectorId: currentSectorId,
      suggestedSectorId: risingTarget,
      reason: 'Current sector is plateauing; consider following an upward trend.',
    };
  }

  return {
    fromSectorId: currentSectorId,
    suggestedSectorId: undefined,
    reason: 'No strong alternative trend detected; maintain current orientation.',
  };
}

export interface NextSectorSuggestion {
  fromSectorId: string;
  suggestedSectorId?: string;
  reason: string;
}

/**
 * Convenience wrapper to pick the next sector to focus on, based on temporal trends.
 * The logic prefers deterministic, upward momentum choices and avoids randomness.
 */
export function pickNextSector(
  view: TemporalOrientationView,
  currentSectorId: string,
): NextSectorSuggestion {
  const currentSnapshot = view.sectors.find((item) => item.sectorId === currentSectorId);
  const risingTargets = [...view.summary.risingSectors].filter((id) => id !== currentSectorId).sort();
  const plateauTargets = [...view.summary.plateauSectors].filter((id) => id !== currentSectorId).sort();

  const firstRising = risingTargets[0];

  if (currentSnapshot?.branchTrend === 'falling' && firstRising) {
    return {
      fromSectorId: currentSectorId,
      suggestedSectorId: firstRising,
      reason: 'Current sector is falling; shift attention toward a rising sector.',
    };
  }

  if (currentSnapshot?.branchTrend === 'plateau' && firstRising) {
    return {
      fromSectorId: currentSectorId,
      suggestedSectorId: firstRising,
      reason: 'Current sector is plateauing; following a rising trend may create momentum.',
    };
  }

  if (!currentSnapshot && firstRising) {
    return {
      fromSectorId: currentSectorId,
      suggestedSectorId: firstRising,
      reason: 'Sector not found in view; defaulting to the earliest rising sector.',
    };
  }

  const firstPlateau = plateauTargets[0];
  if (firstPlateau && !firstRising) {
    return {
      fromSectorId: currentSectorId,
      suggestedSectorId: firstPlateau,
      reason: 'No rising sectors detected; shifting toward a stable plateau sector.',
    };
  }

  return {
    fromSectorId: currentSectorId,
    suggestedSectorId: undefined,
    reason: 'No stronger temporal signal detected; maintain current focus.',
  };
}
