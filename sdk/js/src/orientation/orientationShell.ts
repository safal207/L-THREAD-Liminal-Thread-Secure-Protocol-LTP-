/**
 * Orientation Shell — «панцирь сознания».
 *
 * Задача:
 *   — держать активный сектор внимания;
 *   — управлять направлением восприятия;
 *   — давать системе точку входа перед переходами (L-THREAD).
 *
 * Это фундаментальная структура: мягкая, стабильная, расширяемая.
 */
import { ORIENTATION_BASELINE } from './orientationBaseline';
import { OrientationState } from './types';

export function normalizeOrientation(state: Partial<OrientationState>): OrientationState {
  const result: OrientationState = { ...ORIENTATION_BASELINE, ...state };

  if (typeof result.rotation !== 'number' || Number.isNaN(result.rotation)) {
    result.rotation = 0;
  }

  if (!result.activeSectorId) {
    result.activeSectorId = 'self';
  }

  if (!result.direction) {
    result.direction = ORIENTATION_BASELINE.direction;
  }

  if (typeof result.confidence !== 'number' || Number.isNaN(result.confidence)) {
    result.confidence = ORIENTATION_BASELINE.confidence;
  }

  return result;
}

export function createOrientationShell(params?: Partial<OrientationState>): OrientationState {
  return normalizeOrientation(params ?? {});
}
