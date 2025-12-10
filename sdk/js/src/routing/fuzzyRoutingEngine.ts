import type {
  TemporalOrientationSummary,
  TemporalOrientationView,
} from '../temporalOrientation/temporalOrientationTypes';

export type RoutingPriority = 'low' | 'normal' | 'high';
export type RoutingMode = 'explore' | 'exploit' | 'stabilize';

export interface FuzzyRoutingContext {
  timeWeaveDepthScore: number; // 0..1
  focusMomentumScore: number; // -1..1
  entropyLevel?: number; // 0..1 optional signal of noise/dispersion
  orientationSummary?: TemporalOrientationSummary;
}

export interface StringMode {
  sectorId: string;
  frequency: number; // 0..1
  amplitude: number; // 0..1
}

export interface RouteHint {
  sectorId: string;
  priority: RoutingPriority;
  mode: RoutingMode;
  depthScore: number;
  focusMomentumScore: number;
  reason: string;
  routeConfidence: number; // 0..1
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

// Depth membership helpers (0..1 → fuzzy membership 0..1)
export function lowDepth(depth: number): number {
  const d = clamp01(depth);
  if (d <= 0.2) return 1;
  if (d >= 0.5) return 0;
  return (0.5 - d) / (0.5 - 0.2);
}

export function mediumDepth(depth: number): number {
  const d = clamp01(depth);
  if (d <= 0.2 || d >= 0.9) return 0;
  if (d === 0.5) return 1;
  if (d < 0.5) return (d - 0.2) / (0.5 - 0.2);
  return (0.9 - d) / (0.9 - 0.5);
}

export function highDepth(depth: number): number {
  const d = clamp01(depth);
  if (d <= 0.5) return 0;
  if (d >= 0.9) return 1;
  return (d - 0.5) / (0.9 - 0.5);
}

// Momentum membership helpers (-1..1 → fuzzy membership 0..1)
export function falling(momentum: number): number {
  const m = clamp(momentum, -1, 1);
  if (m >= 0) return 0;
  if (m <= -0.5) return 1;
  return (-m) / 0.5;
}

export function stable(momentum: number): number {
  const m = clamp(momentum, -1, 1);
  const absM = Math.abs(m);
  if (absM >= 0.4) return 0;
  return 1 - absM / 0.4;
}

export function rising(momentum: number): number {
  const m = clamp(momentum, -1, 1);
  if (m <= 0) return 0;
  if (m >= 0.5) return 1;
  return (m - 0) / 0.5;
}

function buildReason(priority: RoutingPriority, mode: RoutingMode): string {
  if (priority === 'high' && mode === 'exploit') {
    return 'High depth with rising momentum → prioritize and exploit the active thread.';
  }

  if (priority === 'normal' && mode === 'explore') {
    return 'Medium signals with upward momentum → explore while maintaining cadence.';
  }

  if (priority === 'low' && mode === 'stabilize') {
    return 'Shallow or falling signals → stabilize and conserve attention.';
  }

  if (mode === 'stabilize') {
    return 'Momentum is soft or negative → prefer stabilization over expansion.';
  }

  if (mode === 'exploit') {
    return 'Depth is strong enough to exploit current sector signals.';
  }

  return 'Signals are moderate → explore with balanced priority.';
}

function applyStringModeAdjustments(
  scores: { high: number; normal: number; low: number },
  modeScores: { exploit: number; explore: number; stabilize: number },
  stringMode?: StringMode,
): void {
  if (!stringMode) {
    return;
  }

  const frequency = clamp01(stringMode.frequency);
  const amplitude = clamp01(stringMode.amplitude);

  // High frequency + amplitude hints the sector is resonant; slightly favor higher priority.
  const resonanceBoost = (frequency + amplitude) / 2;
  scores.high += resonanceBoost * 0.15;
  scores.normal += resonanceBoost * 0.05;

  // Strong amplitude with negative momentum should bias stabilization.
  if (amplitude > 0.7) {
    modeScores.stabilize += amplitude * 0.1;
  }
}

function applyEntropyPenalty(baseConfidence: number, entropyLevel?: number): number {
  if (entropyLevel == null) {
    return baseConfidence;
  }

  if (entropyLevel > 0.8) {
    return clamp01(baseConfidence * 0.75);
  }

  if (entropyLevel > 0.4) {
    return clamp01(baseConfidence * 0.9);
  }

  return baseConfidence;
}

function computeSoftContextAdjustments(
  ctx: FuzzyRoutingContext,
  sectorId: string,
  mode: RoutingMode,
): { confidenceDelta: number; reasonParts: string[] } {
  const summary = ctx.orientationSummary;
  if (!summary) {
    return { confidenceDelta: 0, reasonParts: [] };
  }

  const reasonParts: string[] = [];
  let delta = 0;

  if (summary.globalTrend === 'rising' && (mode === 'explore' || mode === 'exploit')) {
    delta += 0.05;
    reasonParts.push('orientation trend is rising');
  }

  if (summary.globalTrend === 'falling' && mode === 'stabilize') {
    delta += 0.05;
    reasonParts.push('orientation trend is falling');
  }

  if (summary.risingSectors?.includes(sectorId)) {
    delta += 0.04;
    reasonParts.push('sector is in rising set');
  }

  if (summary.fallingSectors?.includes(sectorId) && mode === 'stabilize') {
    delta += 0.03;
    reasonParts.push('sector shows falling signals');
  }

  return { confidenceDelta: delta, reasonParts };
}

function pickMaxKey<T extends string>(scores: Record<T, number>): T {
  const entries = Object.entries(scores) as [T, number][];
  if (entries.length === 0) {
    throw new Error('Cannot pick max key from an empty score record.');
  }

  const firstEntry = entries[0];
  if (!firstEntry) {
    throw new Error('Cannot pick max key from an empty score record.');
  }

  const [initialKey, initialValue] = firstEntry;
  let bestKey: T = initialKey;
  let bestValue = initialValue;

  entries.slice(1).forEach(([candidateKey, value]) => {
    if (value > bestValue) {
      bestKey = candidateKey;
      bestValue = value;
    }
  });

  return bestKey;
}

export function computeRouteHintForSector(
  sectorId: string,
  ctx: FuzzyRoutingContext,
  stringMode?: StringMode,
): RouteHint {
  const dLow = lowDepth(ctx.timeWeaveDepthScore);
  const dMed = mediumDepth(ctx.timeWeaveDepthScore);
  const dHigh = highDepth(ctx.timeWeaveDepthScore);

  const mFall = falling(ctx.focusMomentumScore);
  const mStable = stable(ctx.focusMomentumScore);
  const mRise = rising(ctx.focusMomentumScore);

  const priorityScores = {
    high: dHigh * (mRise * 0.7 + mStable * 0.3),
    normal: dMed * 0.8 + dHigh * 0.5 + mRise * 0.2,
    low: dLow + mFall * 0.5,
  };

  const modeScores = {
    exploit: dHigh * (mRise + mStable * 0.4) + dMed * mRise * 0.6,
    explore: (dLow + dMed) * (mRise + mStable * 0.5),
    stabilize: mFall + dHigh * (1 - mRise) * 0.5,
  };

  applyStringModeAdjustments(priorityScores, modeScores, stringMode);

  const priority = pickMaxKey<RoutingPriority>(priorityScores);

  const mode = pickMaxKey<RoutingMode>(modeScores);

  const normalizedMomentum = clamp01((ctx.focusMomentumScore + 1) / 2);
  const baseConfidence = clamp01(
    0.4 * clamp01(ctx.timeWeaveDepthScore) + 0.4 * normalizedMomentum + 0.2 * clamp01(priorityScores[priority]),
  );

  const softContext = computeSoftContextAdjustments(ctx, sectorId, mode);
  const confidentAfterContext = clamp01(baseConfidence + softContext.confidenceDelta);
  const routeConfidence = applyEntropyPenalty(confidentAfterContext, ctx.entropyLevel);

  const baseReason = buildReason(priority, mode);
  const reasonParts = [
    baseReason,
    ...softContext.reasonParts,
  ];

  if (ctx.entropyLevel != null && ctx.entropyLevel > 0.8) {
    reasonParts.push('entropy is high, applying safety penalty');
  } else if (ctx.entropyLevel != null && ctx.entropyLevel > 0.4) {
    reasonParts.push('entropy is moderate, confidence slightly reduced');
  }

  return {
    sectorId,
    priority,
    mode,
    depthScore: clamp01(ctx.timeWeaveDepthScore),
    focusMomentumScore: clamp(ctx.focusMomentumScore, -1, 1),
    routeConfidence,
    // Combine the base routing explanation with any soft-context notes.
    reason: reasonParts.filter(Boolean).join('; '),
  };
}

export function deriveEntropyFromOrientation(view: TemporalOrientationView): number {
  const summary = view.summary;
  const activeCount = summary.activeSectorCount ?? 0;
  const dispersion = (summary.risingSectors?.length ?? 0) + (summary.fallingSectors?.length ?? 0);
  const normalizedActive = clamp01(activeCount / 6);
  const normalizedDispersion = clamp01(dispersion / 8);

  return clamp01(normalizedActive * 0.6 + normalizedDispersion * 0.4);
}

export function buildRouteHintsFromOrientation(view: TemporalOrientationView): RouteHint[] {
  const ctx: FuzzyRoutingContext = {
    timeWeaveDepthScore: view.summary.timeWeaveDepthScore ?? 0,
    focusMomentumScore: view.summary.focusMomentumScore ?? 0,
    entropyLevel: deriveEntropyFromOrientation(view),
    orientationSummary: view.summary,
  };

  const sectorIds = Object.values(view.web.sectors).map((sector) => sector.id);

  return sectorIds.map((sectorId) => computeRouteHintForSector(sectorId, ctx));
}
