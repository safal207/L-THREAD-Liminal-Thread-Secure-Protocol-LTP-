import { ORIENTATION_BASELINE } from './orientationBaseline';
import type { SectorId } from './types';
import type {
  OrientationPhase,
  OrientationWeb,
  OrientationWebSector,
  OrientationWebUpdate,
} from './orientationWeb.types';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isValidPhase(phase: string | undefined): phase is OrientationPhase {
  return phase === 'rising' || phase === 'stable' || phase === 'falling';
}

function createDefaultSector(id: SectorId): OrientationWebSector {
  return {
    id,
    tension: 0,
    pull: 0,
    resonance: 0,
    phase: 'stable',
  };
}

export function createOrientationWeb(
  sectorIds: SectorId[],
  initial?: Partial<OrientationWeb>
): OrientationWeb {
  const sectors: Record<SectorId, OrientationWebSector> = {};
  const initialSectors = initial?.sectors ?? {};

  sectorIds.forEach((id) => {
    const baseSector = createDefaultSector(id);
    const override = initialSectors[id];

    if (override) {
      sectors[id] = {
        ...baseSector,
        ...override,
        tension: clamp01(override.tension ?? baseSector.tension),
        pull: clamp01(override.pull ?? baseSector.pull),
        resonance: clamp01(override.resonance ?? baseSector.resonance),
        phase: override.phase ?? baseSector.phase,
      };
    } else {
      sectors[id] = baseSector;
    }
  });

  return {
    sectors,
    activeSectorId: initial?.activeSectorId ?? ORIENTATION_BASELINE.activeSectorId,
  };
}

export function applyWebUpdates(
  web: OrientationWeb,
  updates: OrientationWebUpdate[]
): OrientationWeb {
  if (!updates || updates.length === 0) {
    return web; // no movement if the field is quiet
  }

  const updatedSectors: Record<SectorId, OrientationWebSector> = { ...web.sectors };

  updates.forEach((update) => {
    const existing = updatedSectors[update.sectorId];
    if (!existing) {
      // Sector not present — safest behavior is to ignore the update.
      return;
    }

    const tension = clamp01(existing.tension + (update.deltaTension ?? 0));
    const pull = clamp01(existing.pull + (update.deltaPull ?? 0));
    const resonance = clamp01(existing.resonance + (update.deltaResonance ?? 0));

    const phase: OrientationPhase = isValidPhase(update.newPhase)
      ? update.newPhase
      : existing.phase;

    updatedSectors[update.sectorId] = {
      ...existing,
      tension,
      pull,
      resonance,
      phase,
    };
  });

  return {
    ...web,
    sectors: updatedSectors,
  };
}

function computeScore(sector: OrientationWebSector): number {
  // Pull is the strongest attractor, resonance refines alignment, tension adds urgency.
  return sector.pull * 0.5 + sector.resonance * 0.3 + sector.tension * 0.2;
}

export function chooseDominantSector(web: OrientationWeb): SectorId {
  const sectorEntries = Object.entries(web.sectors);

  if (sectorEntries.length === 0) {
    return ORIENTATION_BASELINE.activeSectorId;
  }

  let bestId: SectorId = ORIENTATION_BASELINE.activeSectorId;
  let bestScore = Number.NEGATIVE_INFINITY;
  const tiedIds: SectorId[] = [];

  for (const [id, sector] of sectorEntries) {
    const score = computeScore(sector);

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
      tiedIds.length = 0;
      tiedIds.push(id);
    } else if (score === bestScore) {
      tiedIds.push(id);
    }
  }

  if (tiedIds.length > 1) {
    if (tiedIds.includes(web.activeSectorId)) {
      return web.activeSectorId;
    }

    const sorted = [...tiedIds].sort();
    return sorted[0] ?? bestId;
  }

  return bestId;
}

export function updateActiveSector(web: OrientationWeb): OrientationWeb {
  const nextActive = chooseDominantSector(web);

  if (nextActive === web.activeSectorId) {
    return web;
  }

  return {
    ...web,
    activeSectorId: nextActive,
  };
}
