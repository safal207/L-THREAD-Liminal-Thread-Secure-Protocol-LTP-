import { OrientationState } from './types';

/**
 * ORIENTATION_BASELINE:
 * Базовое состояние ориентации сознания.
 * Используется, если входные данные неполные или отсутствуют.
 */
export const ORIENTATION_BASELINE: OrientationState = {
  activeSectorId: 'self', // внутренний центр
  direction: 'neutral', // нет смещения
  rotation: 0, // панцирь неподвижен
  confidence: 0.4, // умеренная уверенность
};
