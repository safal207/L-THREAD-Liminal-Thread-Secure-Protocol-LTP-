// SectorId — имя ориентационного сектора (внутренний, внешний, путь, прошлое, будущее и т.д.)
export type SectorId = string;

// OrientationState — состояние ориентации внимания и панциря сознания.
export interface OrientationState {
  /** Currently active sector of focus */
  activeSectorId: SectorId;
  /** Directional lean, defaults to neutral */
  direction: string;
  /** Rotation offset for the shell; kept numeric for safe math */
  rotation: number;
  /** Confidence level for the chosen orientation (0..1 range recommended) */
  confidence: number;
}
