export { ORIENTATION_BASELINE } from './orientationBaseline';
export { createOrientationShell, normalizeOrientation } from './orientationShell';
export type { OrientationState, SectorId } from './types';

export {
  applyWebUpdates,
  chooseDominantSector,
  createOrientationWeb,
  updateActiveSector,
} from './orientationWeb';
export type {
  OrientationPhase,
  OrientationWebSector,
  OrientationWeb,
  OrientationWebUpdate,
} from './orientationWeb.types';
